import "server-only";
import { cardNumberFor } from "@/lib/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { couponOf, ensureCard, loadCafe, passData, themeFor, type PassRow, type WalletCafe } from "../data";
import type { Theme } from "../themes";
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

// Keeps Google Wallet in step with the database. Every function does nothing
// (or says so) when Google Wallet isn't configured. See also ../updates.ts.

export function isGoogleWalletEnabled() {
  return googleWalletConfig() !== null;
}

function requireConfig() {
  const config = googleWalletConfig();
  if (!config) throw new Error("Google Wallet is not configured (GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_KEY)");
  return config;
}

function objectFor(config: GoogleWalletConfig, cafe: WalletCafe, origin: string, row: PassRow, objectId: string, couponIssued = false) {
  return buildLoyaltyObject(
    {
      objectId,
      classId: classIdFor(config.issuerId, cafe.slug),
      cardNumber: cardNumberFor(row.card_id),
      customerName: row.display_name,
      stamps: row.stamp_count,
      goal: row.stamps_required,
      coupon: couponOf(row, origin),
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
export async function syncGoogleTheme(
  origin: string,
  context?: { cafe: WalletCafe; theme: Theme },
): Promise<{ theme: Theme; notified: boolean }> {
  const config = requireConfig();
  const cafe = context?.cafe ?? (await loadCafe());
  const theme = context?.theme ?? (await themeFor(cafe));
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
  await ensureCard(cafe.id, customerId);
  const row = await passData(cafe.id, customerId);
  if (!row) throw new Error("Card not found after creating it");

  const objectId = row.object_id ?? objectIdFor(config.issuerId, row.card_id);
  // The class must exist before the first pass: set it up on first use.
  if (cafe.wallet_theme_key === null) await syncGoogleTheme(origin, { cafe, theme: await themeFor(cafe) });
  const object = objectFor(config, cafe, origin, row, objectId);
  try {
    await googleWallet.upsertObject(config, object);
  } catch (error) {
    if (!(error instanceof GoogleWalletError)) throw error;
    // Most likely the class is missing or out of date: update it and try once more.
    await syncGoogleTheme(origin);
    await googleWallet.upsertObject(config, object);
  }

  if (!row.object_id) {
    const { error } = await createAdminClient().from("cards").update({ google_wallet_object_id: objectId }).eq("id", row.card_id);
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
export async function refreshGooglePass(origin: string, cafe: WalletCafe, customerId: string, { couponIssued = false } = {}) {
  const config = googleWalletConfig();
  if (!config) return;
  const row = await passData(cafe.id, customerId);
  if (!row?.object_id) return;

  await googleWallet.upsertObject(config, objectFor(config, cafe, origin, row, row.object_id, couponIssued));
  if (couponIssued && row.coupon_code) {
    try {
      await googleWallet.addObjectMessage(config, row.object_id, couponMessage(row.coupon_code, "TEXT_AND_NOTIFY"));
    } catch (error) {
      // Google allows a few notifications per pass per day; the pass itself is already up to date.
      console.warn("Google Wallet: coupon notification not sent", error);
    }
  }
}

/** Empties the customer's pass (no name, stamps or coupon) when they delete their account. */
export async function retireGooglePass(customerId: string) {
  const config = googleWalletConfig();
  if (!config) return;
  const cafe = await loadCafe();
  const { data } = await createAdminClient()
    .from("cards")
    .select("google_wallet_object_id")
    .eq("customer_id", customerId)
    .not("google_wallet_object_id", "is", null);
  for (const card of data ?? []) {
    try {
      await googleWallet.updateObject(config, buildRetiredObject(card.google_wallet_object_id!, classIdFor(config.issuerId, cafe.slug)));
    } catch (error) {
      console.error("Google Wallet: could not empty the pass of a deleted account", error);
    }
  }
}

/** How many of the cafe's cards have a Google Wallet pass. */
export async function googlePassCount(cafeId: string) {
  const { count, error } = await createAdminClient()
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("cafe_id", cafeId)
    .not("google_wallet_object_id", "is", null);
  if (error) throw error;
  return count ?? 0;
}
