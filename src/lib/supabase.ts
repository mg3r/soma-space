import { createClient } from "@supabase/supabase-js";

const appMode = process.env.APP_MODE?.toLowerCase();

const supabaseUrl =
  appMode === "test"
    ? process.env.NEXT_PUBLIC_SUPABASE_URL_TEST
    : appMode === "live"
      ? process.env.NEXT_PUBLIC_SUPABASE_URL_LIVE
      : process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceKey =
  appMode === "test"
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_TEST
    : appMode === "live"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_LIVE
      : process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create Supabase client only if credentials are provided
// This allows the app to work without Supabase (falls back to env vars)
export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/** Whether the app is using live Supabase/Stripe (from APP_MODE or STRIPE_MODE). */
export const isAppLiveMode = (): boolean =>
  process.env.APP_MODE?.toLowerCase() === "live" ||
  (process.env.APP_MODE == null && process.env.STRIPE_MODE?.toLowerCase() === "live");
