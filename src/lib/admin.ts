import "server-only";
import { requireRole } from "./auth";
import { createClient } from "./supabase/server";

/**
 * Data for the admin pages. Everything is read as the signed-in admin; the
 * database functions return only their own cafe's data.
 */
export async function adminClient() {
  const profile = await requireRole("admin");
  return { profile, supabase: await createClient() };
}

export async function loadOverview() {
  const { supabase } = await adminClient();
  const [stats, activity] = await Promise.all([
    supabase.rpc("admin_stats", { p_days: 30 }),
    supabase.rpc("admin_activity", { p_limit: 15 }),
  ]);
  if (stats.error) throw stats.error;
  if (activity.error) throw activity.error;
  return { stats: stats.data, activity: activity.data ?? [] };
}

export async function loadCustomers(search: string) {
  const { supabase } = await adminClient();
  const { data, error } = await supabase.rpc("admin_customers");
  if (error) throw error;
  const q = search.trim().toLowerCase();
  const rows = data ?? [];
  return q
    ? rows.filter((r) => r.email.toLowerCase().includes(q) || (r.display_name ?? "").toLowerCase().includes(q))
    : rows;
}

export async function loadTags() {
  const { profile, supabase } = await adminClient();
  const { data, error } = await supabase
    .from("tags")
    .select("id, label, tag_uid, active, created_at")
    .eq("cafe_id", profile.cafe_id!)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadCafeSettings() {
  const { profile, supabase } = await adminClient();
  const { data, error } = await supabase
    .from("cafes")
    .select("name, stamps_required, coupon_valid_days, stamp_cooldown_seconds")
    .eq("id", profile.cafe_id!)
    .single();
  if (error) throw error;
  return data;
}
