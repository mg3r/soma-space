import { createHmac, timingSafeEqual } from "crypto";
import { supabase } from "./supabase";

const GUEST_TOKEN_SECRET = process.env.WAIVER_GUEST_SECRET || process.env.NEXTAUTH_SECRET || "soma-waiver-guest-fallback";

const GUEST_TOKEN_DELIM = "::";

/** Create a signed token for guest waiver link (session_id + guest_index + email). */
export function createGuestWaiverToken(
  sessionId: string,
  guestIndex: number,
  email: string
): string {
  const payload = `${sessionId}${GUEST_TOKEN_DELIM}${guestIndex}${GUEST_TOKEN_DELIM}${email.trim().toLowerCase()}`;
  const sig = createHmac("sha256", GUEST_TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}${GUEST_TOKEN_DELIM}${sig}`).toString("base64url");
}

/** Verify guest waiver token; returns true if valid. */
export function verifyGuestWaiverToken(
  token: string,
  sessionId: string,
  guestIndex: number,
  email: string
): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const last = decoded.lastIndexOf(GUEST_TOKEN_DELIM);
    if (last === -1) return false;
    const payload = decoded.slice(0, last);
    const sig = decoded.slice(last + GUEST_TOKEN_DELIM.length);
    const parts = payload.split(GUEST_TOKEN_DELIM);
    if (parts.length !== 3) return false;
    const [s, i, e] = parts;
    if (s !== sessionId || String(guestIndex) !== i || e !== email.trim().toLowerCase()) return false;
    const expected = createHmac("sha256", GUEST_TOKEN_SECRET).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export type WaiverSignature = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  waiver_version: string;
  created_at: string;
};

/**
 * Check if an email has already signed the waiver
 */
export async function hasSignedWaiver(email: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from("waiver_signatures")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Batch check waiver status for multiple emails (one query).
 * Returns a map of normalized email -> true if signed, false otherwise.
 */
export async function getWaiverStatusForEmails(
  emails: string[]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  if (!supabase || emails.length === 0) return result;
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return result;
  normalized.forEach((e) => (result[e] = false));
  try {
    const { data, error } = await supabase
      .from("waiver_signatures")
      .select("email")
      .in("email", normalized);
    if (!error && data) {
      data.forEach((row: { email: string }) => {
        if (row.email) result[row.email.toLowerCase()] = true;
      });
    }
  } catch {
    // leave all false
  }
  return result;
}

/**
 * Record a waiver signature (upsert by email so we keep latest name)
 */
export async function recordWaiverSignature(
  email: string,
  firstName: string,
  lastName: string,
  opts?: { ipAddress?: string; userAgent?: string; waiverVersion?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Waiver storage is not configured." };
  }
  try {
    const normalized = email.trim().toLowerCase();
    const { error } = await supabase.from("waiver_signatures").upsert(
      {
        email: normalized,
        first_name: (firstName || "").trim(),
        last_name: (lastName || "").trim(),
        ip_address: opts?.ipAddress || null,
        user_agent: opts?.userAgent || null,
        waiver_version: opts?.waiverVersion || "1",
        signed_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
    if (error) {
      console.error("Waiver sign error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}
