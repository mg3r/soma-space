import Stripe from "stripe";

/**
 * Get the appropriate Stripe secret key based on the current mode (test or live)
 */
export function getStripeSecretKey(): string {
  const mode = process.env.STRIPE_MODE || 'test'; // Default to test mode for safety
  const isTestMode = mode === 'test';
  
  if (isTestMode) {
    const testKey = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
    if (!testKey) {
      throw new Error("STRIPE_SECRET_KEY_TEST is not configured for test mode");
    }
    if (!testKey.startsWith('sk_test_')) {
      console.warn("Warning: Test mode is enabled but key doesn't start with 'sk_test_'");
    }
    return testKey;
  } else {
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY;
    if (!liveKey) {
      throw new Error("STRIPE_SECRET_KEY_LIVE is not configured for live mode");
    }
    if (!liveKey.startsWith('sk_live_')) {
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
 * Check if we're in test mode
 */
export function isTestMode(): boolean {
  const mode = process.env.STRIPE_MODE || 'test';
  return mode === 'test';
}

