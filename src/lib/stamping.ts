import "server-only";
import { cafeSlug } from "./env";
import { createAdminClient } from "./supabase/admin";

export type StampOutcome =
  | { result: "stamped"; stampCount: number }
  | { result: "coupon_issued"; stampCount: number; couponCode: string }
  | { result: "cooldown"; stampCount: number; retryAfterSeconds: number }
  | { result: "duplicate"; stampCount: number }
  | { result: "daily_limit" }
  | { result: "unknown_tag" | "inactive" };

/**
 * Adds one stamp for a customer at this site's cafe (cooldown, audit log and
 * coupon issuing all happen in the database function record_stamp).
 * Server-only: callers must already have verified why the stamp is deserved
 * (an NFC tap, or the dev-only test button). A tap passes its tag and
 * counter, so the same tap can never give two stamps. A simple tag (fixed
 * link, counter null) goes through record_simple_stamp: one stamp per day.
 */
export async function stampCustomer(
  customerId: string,
  tap: { tagId: string; counter: number | null } | null = null,
): Promise<StampOutcome> {
  const admin = createAdminClient();
  const cafe = await siteCafe();

  const { data, error } =
    tap && tap.counter === null
      ? await admin
          .rpc("record_simple_stamp", { p_cafe_id: cafe.id, p_customer_id: customerId, p_tag_id: tap.tagId })
          .single()
      : await admin
          .rpc("record_stamp", {
            p_cafe_id: cafe.id,
            p_customer_id: customerId,
            p_tag_id: tap?.tagId ?? null,
            p_tag_counter: tap?.counter ?? null,
          })
          .single();
  if (error || !data) throw error ?? new Error("record_stamp returned nothing");

  if (data.result === "daily_limit") return { result: "daily_limit" };
  if (data.result === "unknown_tag" || data.result === "inactive") return { result: data.result };
  const stampCount = data.stamp_count ?? 0;

  if (data.result === "coupon_issued") {
    return { result: "coupon_issued", stampCount, couponCode: data.coupon_code! };
  }
  if (data.result === "cooldown") {
    return { result: "cooldown", stampCount, retryAfterSeconds: data.retry_after_seconds ?? 0 };
  }
  if (data.result === "duplicate") return { result: "duplicate", stampCount };
  return { result: "stamped", stampCount };
}

/** Where to send the customer after a stamp attempt. */
export function outcomePath(outcome: StampOutcome) {
  switch (outcome.result) {
    case "coupon_issued":
      return "/coupon?new=1";
    case "cooldown":
      return `/?cooldown=${outcome.retryAfterSeconds}`;
    case "duplicate":
      return "/tap/problem?r=replayed";
    case "daily_limit":
      return "/?daily=1";
    case "unknown_tag":
    case "inactive":
      return `/tap/problem?r=${outcome.result}`;
    default:
      return "/?stamped=1";
  }
}

/** This deployment's cafe (CAFE_SLUG). */
export async function siteCafe() {
  const { data, error } = await createAdminClient().from("cafes").select("id").eq("slug", cafeSlug()).single();
  if (error || !data) throw new Error(`Cafe "${cafeSlug()}" not found. Did you run supabase/seed.sql?`);
  return data;
}
