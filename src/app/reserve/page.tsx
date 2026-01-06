import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getStripeClient } from "@/lib/stripe";
import { nextEvent } from "@/config/event";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Generate spiral path points (clockwise from center, starting right)
function generateSpiralPath(turns = 4, maxRadius = 120) {
  const points = [];
  const steps = 200;
  
  for (let i = 0; i <= steps; i++) {
    // Start at angle 0 (pointing right), go counter-clockwise (negative angles)
    const t = -(i / steps) * turns * Math.PI * 2;
    const radius = (i / steps) * maxRadius;
    const x = radius * Math.cos(t);
    const y = -radius * Math.sin(t); // Flip on horizontal axis (negate y)
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  
  return points.join(' ');
}

async function verifyPayment(sessionId: string): Promise<boolean> {
  try {
    const stripe = getStripeClient();

    // Retrieve the checkout session from Stripe directly
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("Session details:", {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
    });

    // Verify the session is paid and completed
    if (session.payment_status === "paid" && session.status === "complete") {
      return true;
    }

    console.log("Session not verified:", {
      payment_status: session.payment_status,
      status: session.status,
    });
    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Payment verification error:", errorMessage);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    return false;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; [key: string]: string | string[] | undefined }>;
}) {
  try {
    const params = await searchParams;
    const sessionId = params.session_id;

    // Debug: Log what we received
    console.log('Reserve page accessed with params:', params);
    console.log('Session ID from URL:', sessionId);

    // If no session_id, redirect to home
    if (!sessionId || typeof sessionId !== 'string') {
      console.log('No valid session_id found, redirecting to home');
      redirect('/');
    }

    // Verify the payment with Stripe
    console.log('Verifying payment for session:', sessionId);
    const isVerified = await verifyPayment(sessionId);

    if (!isVerified) {
      console.log('Payment verification failed, redirecting to home');
      redirect('/');
    }

    console.log('Payment verified successfully');
    
    // Try to set cookie, but don't fail if it doesn't work
    try {
      const cookieStore = await cookies();
      cookieStore.set('payment_verified', sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    } catch (cookieError) {
      console.warn('Failed to set cookie (non-critical):', cookieError);
      // Continue anyway - cookie is just for convenience
    }
  } catch (error) {
    console.error('Error in reserve page:', error);
    // On any error, redirect to home for safety
    redirect('/');
  }

  const spiralPath = generateSpiralPath(4, 120);
  return (
    <main className="relative h-screen overflow-hidden bg-[#111111] text-white">
      <div className="relative mx-auto flex h-screen max-w-2xl flex-col px-6 pt-20 pb-10">
        <div className="flex flex-1 items-center justify-between">
          <div>
            <h1 className="text-sm">you&apos;re in.</h1>

            <p className="mt-6 text-sm text-white/70">
              thank you for reserving your spot.
            </p>

            <div className="mt-8 space-y-1">
              <p className="text-sm text-white/90">
                {nextEvent.date} • {nextEvent.time}
              </p>
              <p className="text-sm text-white/90">{nextEvent.place}</p>
              <p className="text-sm text-white/90">{nextEvent.address}</p>
            </div>

            <div className="mt-8">
              <Link
                href="/manifesto"
                className="text-sm text-[#05fd00] hover:text-[#05fd00]/80"
              >
                read the manifesto →
              </Link>
            </div>

            <p className="mt-8 text-sm text-white/50">
              see you there.
            </p>
          </div>

          {/* Spiral */}
          <div className="pointer-events-none flex-shrink-0">
            <svg
              width="300"
              height="300"
              viewBox="0 0 300 300"
              className="text-white/15"
            >
              <defs>
                <style>{`
                  .spiral-path {
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 1.2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                    stroke-dasharray: 3000;
                    stroke-dashoffset: 3000;
                    animation: drawSpiral 18s ease-in-out forwards;
                  }
                  @keyframes drawSpiral {
                    to {
                      stroke-dashoffset: 0;
                    }
                  }
                `}</style>
              </defs>
              <g transform="translate(150, 150)">
                <path
                  className="spiral-path"
                  d={spiralPath}
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </main>
  );
}