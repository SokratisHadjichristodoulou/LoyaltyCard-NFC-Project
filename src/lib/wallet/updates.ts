import "server-only";
import { after } from "next/server";
import { siteOrigin } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { applePassCount, isAppleWalletEnabled, pushOwed, refreshApplePass, syncAppleTheme } from "./apple/sync";
import { loadCafe, themeFor } from "./data";
import { googlePassCount, isGoogleWalletEnabled, refreshGooglePass, syncGoogleTheme } from "./google/sync";

// What the rest of the site calls when something on the cards changes. It
// updates whichever wallets are set up (Google, Apple, both or neither) and
// never throws into a stamp or redeem: errors are logged.

export function isAnyWalletEnabled() {
  return isGoogleWalletEnabled() || isAppleWalletEnabled();
}

/**
 * After the response is sent: brings the customer's wallet passes up to
 * date (new stamp, coupon issued or used). couponIssued also notifies them.
 */
export async function updateWalletPassesLater(customerId: string, options: { couponIssued?: boolean } = {}) {
  if (!isAnyWalletEnabled()) return;
  const origin = await siteOrigin();
  after(async () => {
    try {
      const cafe = await loadCafe();
      await Promise.all([
        refreshGooglePass(origin, cafe, customerId, options).catch((e) => console.error("Google Wallet: pass update failed", e)),
        refreshApplePass(cafe, customerId).catch((e) => console.error("Apple Wallet: pass update failed", e)),
      ]);
    } catch (error) {
      console.error("Wallet: pass update failed", error);
    }
  });
}

/** After the response: tells the phones holding these (now emptied) Apple passes. */
export async function pushApplePassesLater(serials: string[]) {
  if (!serials.length || !isAppleWalletEnabled()) return;
  after(async () => {
    try {
      const cafe = await loadCafe();
      for (const serial of serials) await pushOwed(cafe.id, { serial });
    } catch (error) {
      console.error("Apple Wallet: push failed", error);
    }
  });
}

/**
 * Brings both wallets to today's theme. `force` (after an admin change)
 * re-sends the look even when the theme is the same one.
 */
export async function syncWalletThemes(origin: string, { force = false, applePushes = 10 } = {}) {
  const cafe = await loadCafe();
  const theme = await themeFor(cafe);
  const google = isGoogleWalletEnabled() ? await syncGoogleTheme(origin, { cafe, theme }) : null;
  const apple = isAppleWalletEnabled() ? await syncAppleTheme(cafe, theme, { force, limit: applePushes }) : null;
  return { cafe, theme, googleNotified: google?.notified ?? false, appleMore: apple?.more ?? false };
}

/** syncWalletThemes in the background (after an admin change). */
export async function syncWalletThemesLater() {
  if (!isAnyWalletEnabled()) return;
  const origin = await siteOrigin();
  after(async () => {
    try {
      await syncWalletThemes(origin, { force: true });
    } catch (error) {
      console.error("Wallet: theme update failed", error);
    }
  });
}

/**
 * The daily job (POST /api/wallet/daily): switches the passes to today's
 * theme, takes expired coupons off them, and sends Apple pushes still owed.
 * Small batches, so one call stays within the Workers free plan's 50
 * outgoing requests; `more` says to call again.
 */
export async function runDailyWalletJob(origin: string) {
  const COUPONS = 4;
  const PUSHES = 10;
  // The theme's pushes are sent below with the others, in one batch.
  const { cafe, theme, googleNotified } = await syncWalletThemes(origin, { applePushes: 0 });

  const { data, error } = await createAdminClient().rpc("wallet_expire_coupons", { p_cafe_id: cafe.id, p_limit: COUPONS });
  if (error) throw error;
  const rows = data ?? [];
  const customers = [...new Set(rows.filter((r) => r.has_pass).map((r) => r.customer_id))];

  let refreshed = 0;
  let failed = 0;
  for (const customerId of customers) {
    try {
      await refreshGooglePass(origin, cafe, customerId);
      await refreshApplePass(cafe, customerId);
      refreshed++;
    } catch (error) {
      failed++;
      console.error("Wallet: pass update failed", error);
    }
  }
  const apple = await pushOwed(cafe.id, { limit: PUSHES });
  return {
    theme: theme.key,
    notified: googleNotified,
    expired: rows.length,
    refreshed,
    failed,
    applePushes: apple.sent,
    more: rows.length >= COUPONS || apple.more,
  };
}

/** For the admin page: which wallets are on, and how many cards are in each. */
export async function walletStatus(cafeId: string) {
  const [google, apple] = await Promise.all([
    isGoogleWalletEnabled() ? googlePassCount(cafeId) : 0,
    isAppleWalletEnabled() ? applePassCount(cafeId) : 0,
  ]);
  return {
    google: { enabled: isGoogleWalletEnabled(), passes: google },
    apple: { enabled: isAppleWalletEnabled(), passes: apple },
  };
}
