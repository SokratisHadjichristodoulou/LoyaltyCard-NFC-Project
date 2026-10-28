"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin writes. Each checks the role first, then writes with the service role,
// always limited to the admin's own cafe.

/** On error, `values` holds what was typed, so the form can show it again. */
export type FormState = { ok?: boolean; error?: string; values?: Record<string, string> };

/** Accepts "04:A1:B2..." or "04 a1 b2..." and returns "04A1B2...". */
function normaliseUid(input: string) {
  return input.replace(/[\s:-]/g, "").toUpperCase();
}

export async function addTag(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole("admin");
  const typed = { label: String(formData.get("label") ?? ""), tag_uid: String(formData.get("tag_uid") ?? "") };
  const label = typed.label.trim();
  const uid = normaliseUid(typed.tag_uid);
  if (!label || label.length > 60) return { error: "label", values: typed };
  if (!/^[0-9A-F]{8,20}$/.test(uid)) return { error: "uid", values: typed };

  const { error } = await createAdminClient().from("tags").insert({ cafe_id: profile.cafe_id!, label, tag_uid: uid });
  if (error) return { error: error.code === "23505" ? "duplicate" : "failed", values: typed };
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function setTagActive(formData: FormData) {
  const profile = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await createAdminClient().from("tags").update({ active }).eq("id", id).eq("cafe_id", profile.cafe_id!);
  revalidatePath("/admin/tags");
}

/** Gives a tag a new simple link (any earlier one stops working), or removes it to make the tag secure again. */
export async function setTagSimple(formData: FormData) {
  const profile = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const simple_token = formData.get("simple") === "true" ? randomBytes(16).toString("base64url") : null;
  await createAdminClient().from("tags").update({ simple_token }).eq("id", id).eq("cafe_id", profile.cafe_id!);
  revalidatePath("/admin/tags");
}

export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole("admin");
  const typed = {
    stamps_required: String(formData.get("stamps_required") ?? ""),
    coupon_valid_days: String(formData.get("coupon_valid_days") ?? ""),
    cooldown_minutes: String(formData.get("cooldown_minutes") ?? ""),
  };
  const stamps = Number(typed.stamps_required);
  const days = Number(typed.coupon_valid_days);
  const minutes = Number(typed.cooldown_minutes);
  const valid =
    Number.isInteger(stamps) && stamps >= 1 && stamps <= 50 &&
    Number.isInteger(days) && days >= 1 && days <= 730 &&
    Number.isFinite(minutes) && minutes >= 0 && minutes <= 1440;
  if (!valid) return { error: "invalid", values: typed };

  const { error } = await createAdminClient()
    .from("cafes")
    .update({ stamps_required: stamps, coupon_valid_days: days, stamp_cooldown_seconds: Math.round(minutes * 60) })
    .eq("id", profile.cafe_id!);
  if (error) return { error: "failed", values: typed };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
