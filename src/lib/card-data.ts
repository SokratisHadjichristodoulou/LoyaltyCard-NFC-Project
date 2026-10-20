import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { effectiveStatus, type Card, type Coupon } from "./card";
import { cafeSlug, isMockMode } from "./env";
import { getCard as getMockCard, getScenarioName } from "./mock-data";
import { getUser } from "./auth";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";

export type CardView =
  | { source: "mock"; card: Card; state: string }
  | { source: "db"; card: Card; state?: undefined };

/**
 * The card for the current request. In mock mode it comes from mock-data.ts
 * (and honours `?state=`); otherwise from the database for the signed-in
 * customer, who is sent to /login when signed out.
 */
export async function getCardView(
  stateParam: string | string[] | undefined,
  returnTo: string,
  { justStamped = false }: { justStamped?: boolean } = {},
): Promise<CardView> {
  if (isMockMode()) {
    return { source: "mock", card: getMockCard(stateParam), state: getScenarioName(stateParam) };
  }
  const card = await loadCard(returnTo);
  return { source: "db", card: { ...card, justStamped: justStamped && card.stamps > 0 } };
}

const loadCard = cache(async (returnTo: string): Promise<Card> => {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  const supabase = await createClient();

  const { data: cafe, error: cafeError } = await supabase
    .from("cafes")
    .select("id, stamps_required")
    .eq("slug", cafeSlug())
    .single();
  if (cafeError || !cafe) throw new Error(`Cafe "${cafeSlug()}" not found. Did you run supabase/seed.sql?`);

  // First visit: create the customer's card. Customers cannot insert cards
  // themselves (RLS), so this uses the service role, scoped to this user.
  const { error: upsertError } = await createAdminClient()
    .from("cards")
    .upsert({ cafe_id: cafe.id, customer_id: user.id }, { onConflict: "cafe_id,customer_id", ignoreDuplicates: true });
  if (upsertError) throw upsertError;

  // Everything below is read as the customer, so RLS decides what they see.
  const [{ data: card, error: cardError }, { data: profile }, { data: coupons }] = await Promise.all([
    supabase.from("cards").select("id, stamp_count").eq("cafe_id", cafe.id).eq("customer_id", user.id).single(),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    supabase
      .from("coupons")
      .select("code, status, issued_at, expires_at, redeemed_at")
      .eq("cafe_id", cafe.id)
      .eq("customer_id", user.id)
      .order("issued_at", { ascending: false })
      .limit(5),
  ]);
  if (cardError || !card) throw cardError ?? new Error("Card not found after creating it");

  return {
    customerName: profile?.display_name ?? null,
    cardNumber: card.id.replace(/-/g, "").slice(0, 4).toUpperCase(),
    stamps: card.stamp_count,
    goal: cafe.stamps_required,
    justStamped: false,
    coupon: pickCoupon(coupons ?? []),
  };
});

type CouponRow = { code: string; status: Coupon["status"]; issued_at: string; expires_at: string; redeemed_at: string | null };

/** Show a usable coupon first; otherwise the most recent one. */
function pickCoupon(rows: CouponRow[]): Coupon | null {
  const coupons = rows.map(
    (r): Coupon => ({
      code: r.code,
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
      usedAt: r.redeemed_at ?? undefined,
      status: effectiveStatus(r.status, r.expires_at),
    }),
  );
  return coupons.find((c) => c.status === "valid") ?? coupons[0] ?? null;
}
