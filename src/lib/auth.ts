import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./supabase/server";
import type { Role } from "./supabase/types";

/** Only allow redirects to paths on this site ("/coupon"), never "//evil.com". */
export function safeNext(next: string | string[] | undefined | null, fallback = "/") {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

export const getUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, role, cafe_id, preferred_language").eq("id", user.id).single();
  return data;
});

/** Which roles may open each protected area. */
export const areaRoles: Record<"staff" | "admin", Role[]> = {
  staff: ["staff", "admin"],
  admin: ["admin"],
};

/**
 * Server-side check for protected pages (the proxy checks too; this keeps the
 * page safe even if the proxy matcher changes).
 */
export async function requireRole(area: keyof typeof areaRoles, returnTo: string = `/${area}`) {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!areaRoles[area].includes(profile.role)) redirect("/not-allowed");
  return profile;
}
