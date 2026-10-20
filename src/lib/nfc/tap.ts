import "server-only";
import { nfcTagSecret } from "@/lib/env";
import { siteCafe } from "@/lib/stamping";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTap } from "./sdm";

export type TapProblem = "not_configured" | "invalid" | "replayed" | "unknown_tag" | "inactive";
export type TapCheck = { ok: true; tagId: string; counter: number } | { ok: false; problem: TapProblem };

/**
 * Checks a tap URL's e= and c= values and records the tap counter.
 * After this returns ok, the same URL can never be used again.
 */
export async function checkTap(e: string | null, c: string | null): Promise<TapCheck> {
  const secret = nfcTagSecret();
  if (!secret) return { ok: false, problem: "not_configured" };

  const verified = verifyTap(secret, e, c);
  if (!verified.ok) return { ok: false, problem: "invalid" };

  const { data, error } = await createAdminClient()
    .rpc("consume_tag_tap", { p_uid: verified.tap.uid, p_counter: verified.tap.counter })
    .single();
  if (error || !data) throw error ?? new Error("consume_tag_tap returned nothing");
  if (data.result !== "ok") return { ok: false, problem: data.result };

  // A tag registered for another cafe cannot stamp cards here.
  const cafe = await siteCafe();
  if (data.cafe_id !== cafe.id) return { ok: false, problem: "unknown_tag" };
  return { ok: true, tagId: data.tag_id!, counter: verified.tap.counter };
}
