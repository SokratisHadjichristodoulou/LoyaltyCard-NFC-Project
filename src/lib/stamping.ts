import "server-only";
import { cafeSlug } from "./env";
import { createAdminClient } from "./supabase/admin";

export type StampOutcome =
  | { result: "stamped"; stampCount: number }
  | { result: "coupon_issued"; stampCount: number; couponCode: string }
  | { result: "cooldown"; stampCount: number; retryAfterSeconds: number };

/**
 * Adds one stamp for a customer at this site's cafe (cooldown, audit log and
 * coupon issuing all happen in the database function record_stamp).
 * Server-only: callers must already have verified why the stamp is deserved
 * (an NFC tap, or the dev-only test button).
 */
export async function stampCustomer(customerId: string, tagId: string | null = null): Promise<StampOutcome> {
  const admin = createAdminClient();
  const { data: cafe, error: cafeError } = await admin.from("cafes").select("id").eq("slug", cafeSlug()).single();
  if (cafeError || !cafe) throw new Error(`Cafe "${cafeSlug()}" not found. Did you run supabase/seed.sql?`);

  const { data, error } = await admin
    .rpc("record_stamp", { p_cafe_id: cafe.id, p_customer_id: customerId, p_tag_id: tagId })
    .single();
  if (error || !data) throw error ?? new Error("record_stamp returned nothing");

  if (data.result === "coupon_issued") {
    return { result: "coupon_issued", stampCount: data.stamp_count, couponCode: data.coupon_code! };
  }
  if (data.result === "cooldown") {
    return { result: "cooldown", stampCount: data.stamp_count, retryAfterSeconds: data.retry_after_seconds ?? 0 };
  }
  return { result: "stamped", stampCount: data.stamp_count };
}
