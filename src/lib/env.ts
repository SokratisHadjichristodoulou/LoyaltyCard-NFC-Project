// Central place for configuration read from the environment.

/** Mock data is a dev-only preview tool: `MOCK_DATA=1 npm run dev`. */
export function isMockMode() {
  return process.env.MOCK_DATA === "1" && process.env.NODE_ENV !== "production";
}

/** Dev-only "add a test stamp" button, for trying the flow without NFC tags. */
export function isDevStampEnabled() {
  return process.env.DEV_STAMPS === "1" && process.env.NODE_ENV !== "production";
}

export function isSupabaseConfigured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in, or run the dev server with MOCK_DATA=1.`,
    );
  }
  return value;
}

export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const supabaseServiceRoleKey = () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Which cafe this deployment serves (cafes.slug). */
export const cafeSlug = () => process.env.CAFE_SLUG || "coffee-pause-cyprus";

/** Secret all NFC tag keys are derived from. Never sent to the browser. */
export function nfcTagSecret() {
  const value = process.env.NFC_TAG_SECRET;
  return value && value.length >= 32 ? value : null;
}
