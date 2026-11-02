import "server-only";
import { after } from "next/server";
import { cardNumberFor } from "@/lib/card";
import { couponCheckUrlAt } from "@/lib/coupons";
import { cafeSlug } from "@/lib/env";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { activeTheme, cyprusToday, type Theme } from "../themes";
import { googleWallet, GoogleWalletError, signWithServiceAccount } from "./api";
import { classIdFor, googleWalletConfig, objectIdFor, type GoogleWalletConfig } from "./config";
import {
  buildLoyaltyClass,
  buildLoyaltyObject,
  buildRetiredObject,
  couponMessage,
  saveLinkClaims,
  themeMessage,
} from "./pass";

// Keeps Google Wallet in step with the database. Every function is a no-op
// (or says so) when Google Wallet isn't configured, and the ones called after
// a stamp or redeem never throw: the stamp counts even if Google is down.

type PassRow = Database["public"]["Functions"]["wallet_pass_data"]["Returns"][number];

export function isGoogleWalletEnabled() {
  return googleWalletConfig() !== null;
}

function requireConfig() {
  const config = googleWalletConfig();
  if (!config) throw new Error("Google Wallet is not configured (GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_KEY)");
  return config;
}

async function loadCafe() {
  const { data, error } = await createAdminClient()
    .from("cafes")
    .select("id, name, slug, stamps_required, wallet_theme_key")
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

/** The theme that is on today at this site's cafe. */
export async function currentTheme(): Promise<Theme> {
  const cafe = await loadCafe();
  return activeTheme(await loadThemes(cafe.id), cyprusToday());
}

async function passData(cafeId: string, customerId: string): Promise<PassRow | null> {
  const { data, error } = await createAdminClient()
    .rpc("wallet_pass_data", { p_cafe_id: cafeId, p_customer_id: customerId })
    .maybeSingle();
  if (error) throw error;
  return data;
}

function objectFor(config: GoogleWalletConfig, origin: string, row: PassRow, objectId: string, couponIssued = false) {
  return buildLoyaltyObject(
    {
      objectId,
      classId: classIdFor(config.issuerId, cafeSlug()),
      cardNumber: cardNumberFor(row.card_id),
      customerName: row.display_name,
      stamps: row.stamp_count,
      goal: row.stamps_required,
      coupon:
        row.coupon_code && row.coupon_expires_at
          ? { code: row.coupon_code, checkUrl: couponCheckUrlAt(origin, row.coupon_code), expiresAt: row.coupon_expires_at }
          : null,
      origin,
    },
    // A new coupon's message is added separately, with a notification.
    { couponMessageType: couponIssued ? null : "TEXT" },
  );
}

/**
 * Updates the loyalty class (logo, colour, banner, greeting) to today's
 * theme. When a different theme has started since the last update and it
 * has "notify" on, every customer with the card gets a notification, once.
 */
export async function syncGoogleTheme(origin: string): Promise<{ theme: Theme; notified: boolean }> {
  const config = requireConfig();
  const cafe = await loadCafe();
  const theme = activeTheme(await loadThemes(cafe.id), cyprusToday());
  const classId = classIdFor(config.issuerId, cafe.slug);

  await googleWallet.upsertClass(
    config,
    buildLoyaltyClass({ classId, cafeName: cafe.name, stampsRequired: cafe.stamps_required, theme, origin }),
  );

  let notified = false;
  if (theme.key !== cafe.wallet_theme_key) {
    // Only the first caller to record the switch sends the notification.
    const update = createAdminClient().from("cafes").update({ wallet_theme_key: theme.key }).eq("id", cafe.id);
    const { data: claimed, error } = await (cafe.wallet_theme_key === null
      ? update.is("wallet_theme_key", null)
      : update.eq("wallet_theme_key", cafe.wallet_theme_key)
    ).select("id");
    if (error) throw error;
    if (claimed?.length && theme.notify) {
      await googleWallet.addClassMessage(config, classId, themeMessage(theme, cafe.name));
      notified = true;
    }
  }
  return { theme, notified };
}

/**
 * Creates (or refreshes) the customer's pass and returns the "Add to Google
 * Wallet" link for it. The link only names the pass, so it stays short.
 */
export async function saveToGoogleWalletUrl(origin: string, customerId: string) {
  const config = requireConfig();
  const cafe = await loadCafe();
  const admin = createAdminClient();

  const { error: cardError } = await admin
    .from("cards")
    .upsert({ cafe_id: cafe.id, customer_id: customerId }, { onConflict: "cafe_id,customer_id", ignoreDuplicates: true });
  if (cardError) throw cardError;
  const row = await passData(cafe.id, customerId);
  if (!row) throw new Error("Card not found after creating it");

  const objectId = row.object_id ?? objectIdFor(config.issuerId, row.card_id);
  // The class must exist before the first pass: set it up on first use.
  if (cafe.wallet_theme_key === null) await syncGoogleTheme(origin);
  const object = objectFor(config, origin, row, objectId);
  try {
    await googleWallet.upsertObject(config, object);
  } catch (error) {
    if (!(error instanceof GoogleWalletError)) throw error;
    // Most likely the class is missing or out of date: update it and try once more.
    await syncGoogleTheme(origin);
    await googleWallet.upsertObject(config, object);
  }

  if (!row.object_id) {
    const { error } = await admin.from("cards").update({ google_wallet_object_id: objectId }).eq("id", row.card_id);
    if (error) throw error;
  }

  const jwt = await signWithServiceAccount(
    config,
    saveLinkClaims({ email: config.email, origin, objectId, classId: classIdFor(config.issuerId, cafe.slug) }),
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/**
 * Brings the customer's pass up to date (stamps, name, coupon QR). Does
 * nothing if they haven't added it. With couponIssued, also sends the
 * "free coffee ready" notification.
 */
export async function refreshGooglePass(origin: string, customerId: string, { couponIssued = false } = {}) {
  const config = googleWalletConfig();
  if (!config) return;
  const cafe = await loadCafe();
  const row = await passData(cafe.id, customerId);
  if (!row?.object_id) return;

  await googleWallet.upsertObject(config, objectFor(config, origin, row, row.object_id, couponIssued));
  if (couponIssued && row.coupon_code) {
    try {
      await googleWallet.addObjectMessage(config, row.object_id, couponMessage(row.coupon_code, "TEXT_AND_NOTIFY"));
    } catch (error) {
      // Google allows a few notifications per pass per day; the pass itself is already up to date.
      console.warn("Google Wallet: coupon notification not sent", error);
    }
  }
}

/**
 * Schedules refreshGooglePass to run after the response is sent, so the
 * customer isn't kept waiting for Google. Errors are logged, never thrown.
 */
export async function refreshGooglePassLater(customerId: string, options: { couponIssued?: boolean } = {}) {
  if (!isGoogleWalletEnabled()) return;
  const origin = await siteOrigin();
  after(async () => {
    try {
      await refreshGooglePass(origin, customerId, options);
    } catch (error) {
      console.error("Google Wallet: pass update failed", error);
    }
  });
}

/** Empties the customer's pass (no name, stamps or coupon) when they delete their account. */
export async function retireGooglePass(customerId: string) {
  const config = googleWalletConfig();
  if (!config) return;
  const { data } = await createAdminClient()
    .from("cards")
    .select("google_wallet_object_id")
    .eq("customer_id", customerId)
    .not("google_wallet_object_id", "is", null);
  for (const card of data ?? []) {
    try {
      await googleWallet.updateObject(config, buildRetiredObject(card.google_wallet_object_id!, classIdFor(config.issuerId, cafeSlug())));
    } catch (error) {
      console.error("Google Wallet: could not empty the pass of a deleted account", error);
    }
  }
}

/**
 * The daily job (POST /api/wallet/daily): switches the passes to today's
 * theme and takes expired coupons off them. Handles at most `limit` coupons
 * per call, so one call stays within the host's limits; `more` says to call
 * again.
 */
export async function runDailyWalletJob(origin: string, limit = 10) {
  const { theme, notified } = await syncGoogleTheme(origin);
  const cafe = await loadCafe();

  const { data, error } = await createAdminClient().rpc("wallet_expire_coupons", { p_cafe_id: cafe.id, p_limit: limit });
  if (error) throw error;
  const rows = data ?? [];
  const customers = [...new Set(rows.filter((r) => r.has_pass).map((r) => r.customer_id))];

  let refreshed = 0;
  let failed = 0;
  for (const customerId of customers) {
    try {
      await refreshGooglePass(origin, customerId);
      refreshed++;
    } catch (error) {
      failed++;
      console.error("Google Wallet: pass update failed", error);
    }
  }
  return { theme: theme.key, notified, expired: rows.length, refreshed, failed, more: rows.length >= limit };
}

/** For the admin page: is Google Wallet on, and how many cards have a pass. */
export async function googleWalletStatus(cafeId: string) {
  const { count, error } = await createAdminClient()
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("cafe_id", cafeId)
    .not("google_wallet_object_id", "is", null);
  if (error) throw error;
  return { enabled: isGoogleWalletEnabled(), passes: count ?? 0 };
}
