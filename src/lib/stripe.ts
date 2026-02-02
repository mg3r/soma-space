import Stripe from "stripe";

/**
 * Get the current mode: APP_MODE overrides STRIPE_MODE when set (one toggle for test/live).
 */
function getMode(): "test" | "live" {
  const appMode = process.env.APP_MODE?.toLowerCase();
  if (appMode === "test" || appMode === "live") return appMode;
  const stripeMode = process.env.STRIPE_MODE?.toLowerCase();
  return stripeMode === "live" ? "live" : "test";
}

/**
 * Get the appropriate Stripe secret key based on the current mode (test or live)
 */
export function getStripeSecretKey(): string {
  const isTestMode = getMode() === "test";

  if (isTestMode) {
    const testKey = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
    if (!testKey) {
      throw new Error("STRIPE_SECRET_KEY_TEST is not configured for test mode");
    }
    if (!testKey.startsWith("sk_test_")) {
      console.warn("Warning: Test mode is enabled but key doesn't start with 'sk_test_'");
    }
    return testKey;
  } else {
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;
    if (!liveKey) {
      throw new Error("STRIPE_SECRET_KEY_LIVE is not configured for live mode");
    }
    if (!liveKey.startsWith("sk_live_")) {
      console.warn("Warning: Live mode is enabled but key doesn't start with 'sk_live_'");
    }
    return liveKey;
  }
}

/**
 * Get a Stripe client instance with the appropriate key
 */
export function getStripeClient(): Stripe {
  const secretKey = getStripeSecretKey();
  return new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Check if we're in test mode (APP_MODE or STRIPE_MODE)
 */
export function isTestMode(): boolean {
  return getMode() === "test";
}

