import { ImageResponse } from "next/og";

export const runtime = "edge";

const QUICKSAND_URL = "/fonts/Quicksand.ttf";
const MONTSERRAT_URL = "/fonts/Montserrat.ttf";

/**
 * GET /api/checkout-image?event_name=RENEWAL&primary_color=05fd00
 * Generates a Stripe checkout product image: "soma space presents [event name]"
 * "soma space presents" in Quicksand, event name in Montserrat (primary color).
 * Used when event config has no custom stripe_image_url.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventName =
      searchParams.get("event_name") || searchParams.get("event_id") || "soma space";
    let primaryColor = searchParams.get("primary_color") || "05fd00";
    if (primaryColor.startsWith("#")) primaryColor = primaryColor.slice(1);

    // Ensure hex is 6 chars for consistency
    const color = primaryColor.length >= 6 ? `#${primaryColor.slice(0, 6)}` : `#${primaryColor.padEnd(6, "0")}`;

    const base = new URL(request.url).origin;
    const [quicksandRes, montserratRes] = await Promise.all([
      fetch(new URL(QUICKSAND_URL, base).href),
      fetch(new URL(MONTSERRAT_URL, base).href),
    ]);
    if (!quicksandRes.ok || !montserratRes.ok) {
      console.error("[checkout-image] Font fetch failed", { quicksand: quicksandRes.status, montserrat: montserratRes.status });
      return new Response("Failed to load fonts", { status: 500 });
    }
    const quicksandData = await quicksandRes.arrayBuffer();
    const montserratData = await montserratRes.arrayBuffer();

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#111111",
            fontFamily: "Quicksand, system-ui, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                fontFamily: "Quicksand",
                fontSize: 28,
                color: "rgba(255,255,255,0.85)",
                textTransform: "lowercase",
                letterSpacing: "0.02em",
              }}
            >
              soma space presents
            </div>
            <div
              style={{
                width: 80,
                height: 2,
                background: color,
                borderRadius: 1,
              }}
            />
            <div
              style={{
                fontFamily: "Montserrat",
                fontSize: 56,
                fontWeight: 400,
                color,
                textTransform: "lowercase",
                letterSpacing: "-0.02em",
              }}
            >
              {eventName}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: "Quicksand", data: quicksandData, style: "normal" },
          { name: "Montserrat", data: montserratData, style: "normal" },
        ],
      }
    );
  } catch (e) {
    console.error("[checkout-image]", e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
