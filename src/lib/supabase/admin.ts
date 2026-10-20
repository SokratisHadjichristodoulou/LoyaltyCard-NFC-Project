import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./types";

/**
 * Service-role client: bypasses RLS. Server-only, for the writes customers
 * are never allowed to make (cards, stamps, coupons). Never import this from
 * a client component.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
