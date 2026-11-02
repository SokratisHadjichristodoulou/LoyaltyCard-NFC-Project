import "server-only";
import { couponCheckUrlAt } from "@/lib/coupon-code";
import { cafeSlug } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { activeTheme, cyprusToday, type Theme } from "./themes";

// Database reads shared by the Google and Apple wallet code.

export type WalletCafe = {
  id: string;
  name: string;
  slug: string;
  stamps_required: number;
  wallet_theme_key: string | null;
  apple_wallet_theme_key: string | null;
};

export async function loadCafe(): Promise<WalletCafe> {
  const { data, error } = await createAdminClient()
    .from("cafes")
    .select("id, name, slug, stamps_required, wallet_theme_key, apple_wallet_theme_key")
    .eq("slug", cafeSlug())
    .single();
  if (error || !data) throw error ?? new Error(`Cafe "${cafeSlug()}" not found`);
  return data;
}

export async function loadThemes(cafeId: string) {
  const { data, error } = await createAdminClient()
    .from("wallet_themes")
    .select("*")
    .eq("cafe_id", cafeId)
    .order("starts_on", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function themeFor(cafe: WalletCafe): Promise<Theme> {
  return activeTheme(await loadThemes(cafe.id), cyprusToday());
}

/** The theme that is on today at this site's cafe. */
export async function currentTheme(): Promise<Theme> {
  return themeFor(await loadCafe());
}

export type PassRow = Database["public"]["Functions"]["wallet_pass_data"]["Returns"][number];

/** Everything a customer's pass shows (stamps, name, usable coupon), or null without a card. */
export async function passData(cafeId: string, customerId: string): Promise<PassRow | null> {
  const { data, error } = await createAdminClient()
    .rpc("wallet_pass_data", { p_cafe_id: cafeId, p_customer_id: customerId })
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function couponOf(row: PassRow, origin: string) {
  return row.coupon_code && row.coupon_expires_at
    ? { code: row.coupon_code, checkUrl: couponCheckUrlAt(origin, row.coupon_code), expiresAt: row.coupon_expires_at }
    : null;
}

/** Creates the customer's card if it doesn't exist yet. */
export async function ensureCard(cafeId: string, customerId: string) {
  const { error } = await createAdminClient()
    .from("cards")
    .upsert({ cafe_id: cafeId, customer_id: customerId }, { onConflict: "cafe_id,customer_id", ignoreDuplicates: true });
  if (error) throw error;
}
