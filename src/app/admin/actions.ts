"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAnyWalletEnabled, syncWalletThemes, syncWalletThemesLater } from "@/lib/wallet/updates";
import { isBuiltinHero } from "@/lib/wallet/themes";

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
  // The passes show the number of stamps for a free coffee: bring them up to date.
  await syncWalletThemesLater();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Wallet themes
// ---------------------------------------------------------------------------


const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function addWalletTheme(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await requireRole("admin");
  const field = (name: string) => String(formData.get(name) ?? "");
  const typed = {
    preset: field("preset"),
    name: field("name"),
    background_color: field("background_color"),
    hero_builtin: field("hero_builtin"),
    hero_url: field("hero_url"),
    message_el: field("message_el"),
    message_en: field("message_en"),
    starts_on: field("starts_on"),
    ends_on: field("ends_on"),
    repeats_yearly: formData.get("repeats_yearly") === "on" ? "on" : "",
    notify: formData.get("notify") === "on" ? "on" : "",
  };
  const name = typed.name.trim();
  const color = typed.background_color.trim().toLowerCase();
  const heroUrl = typed.hero_url.trim();
  const hero = heroUrl || typed.hero_builtin;
  const messageEl = typed.message_el.trim();
  const messageEn = typed.message_en.trim();
  const yearly = typed.repeats_yearly === "on";

  if (!name || name.length > 40) return { error: "name", values: typed };
  if (!/^#[0-9a-f]{6}$/.test(color)) return { error: "color", values: typed };
  if (heroUrl ? !/^https:\/\/[^\s"<>]+$/.test(heroUrl) || heroUrl.length > 500 : !isBuiltinHero(hero)) {
    return { error: "image", values: typed };
  }
  if (messageEl.length > 120 || messageEn.length > 120) return { error: "message", values: typed };
  if (!DATE.test(typed.starts_on) || !DATE.test(typed.ends_on)) return { error: "dates", values: typed };
  if (!yearly && typed.ends_on < typed.starts_on) return { error: "dates", values: typed };

  const { error } = await createAdminClient().from("wallet_themes").insert({
    cafe_id: profile.cafe_id!,
    name,
    background_color: color,
    hero_image: hero,
    message_el: messageEl || null,
    message_en: messageEn || null,
    starts_on: typed.starts_on,
    ends_on: typed.ends_on,
    repeats_yearly: yearly,
    notify: typed.notify === "on",
  });
  if (error) return { error: "failed", values: typed };
  await syncWalletThemesLater();
  revalidatePath("/admin/wallet");
  return { ok: true };
}

export async function setWalletThemeActive(formData: FormData) {
  const profile = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await createAdminClient().from("wallet_themes").update({ active }).eq("id", id).eq("cafe_id", profile.cafe_id!);
  await syncWalletThemesLater();
  revalidatePath("/admin/wallet");
}

export async function deleteWalletTheme(formData: FormData) {
  const profile = await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  await createAdminClient().from("wallet_themes").delete().eq("id", id).eq("cafe_id", profile.cafe_id!);
  await syncWalletThemesLater();
  revalidatePath("/admin/wallet");
}

/** "Update all cards now": waits for Google, so the admin sees whether it worked. */
export async function syncWalletNow(_prev: FormState): Promise<FormState> {
  await requireRole("admin");
  if (!isAnyWalletEnabled()) return { error: "syncOff" };
  try {
    const { googleNotified, appleMore } = await syncWalletThemes(await siteOrigin(), { force: true });
    revalidatePath("/admin/wallet");
    return { ok: true, values: { notified: googleNotified ? "1" : "", appleMore: appleMore ? "1" : "" } };
  } catch (error) {
    console.error("Wallet: theme update failed", error);
    return { error: "syncFailed" };
  }
}
