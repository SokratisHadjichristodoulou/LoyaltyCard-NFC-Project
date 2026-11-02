import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cardNumberFor } from "@/lib/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { couponOf, ensureCard, loadCafe, passData, themeFor, type WalletCafe } from "../data";
import { isBuiltinHero, type Theme } from "../themes";
import { pushPassUpdate } from "./apns";
import { appleWalletConfig, isAppleWalletEnabled, type AppleWalletConfig } from "./config";
import { buildApplePass, type ApplePassCard } from "./pass";
import { isPng, packPass } from "./pkpass";
import { nextUpdateTag } from "./service";
import { importRsaSigningKey, type Signer } from "./pkcs7";

// Apple Wallet: makes the signed .pkpass, answers the iPhone's update web
// service (src/app/api/apple-wallet), and pushes "your pass changed" through
// APNs. Every function does nothing (or says so) when Apple Wallet isn't
// configured. See also ../updates.ts.

/** Where Apple's web service lives; Apple appends /v1/... */
export const WEB_SERVICE_PATH = "/api/apple-wallet";

export { isAppleWalletEnabled };

function requireConfig() {
  const config = appleWalletConfig();
  if (!config) throw new Error("Apple Wallet is not configured (APPLE_WALLET_* and APPLE_APNS_* settings)");
  return config;
}

let signer: { keyPem: string; value: Promise<Signer> } | null = null;
function signerFor(config: AppleWalletConfig) {
  if (!signer || signer.keyPem !== config.keyPem) {
    const value = importRsaSigningKey(config.keyPem).then((privateKey) => ({ certificate: config.certificate, chain: config.chain, privateKey }));
    value.catch(() => (signer = null));
    signer = { keyPem: config.keyPem, value };
  }
  return signer.value;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** A file from public/: through the Workers assets binding when there is one, else over HTTP. */
async function publicFile(origin: string, path: string) {
  const url = `${origin}${path}`;
  let response: Response | null = null;
  try {
    const assets = getCloudflareContext().env.ASSETS;
    if (assets) response = await assets.fetch(url);
  } catch {
    // Not on Cloudflare (e.g. next dev): fall through to a normal request.
  }
  response ??= await fetch(url);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

const ICONS = ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png"];

async function passImages(origin: string, theme: Theme) {
  const images: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (const name of ICONS) images[name] = await publicFile(origin, `/wallet/apple/${name}`);

  // The theme's own banner, if it is a PNG Apple can show (Apple Wallet takes PNG only).
  if (theme.heroImage.startsWith("https://")) {
    try {
      const response = await fetch(theme.heroImage);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (response.ok && isPng(bytes)) return { ...images, "strip@2x.png": bytes };
    } catch (error) {
      console.warn("Apple Wallet: could not load the theme's own banner", error);
    }
  }
  const strip = isBuiltinHero(theme.heroImage) ? theme.heroImage : "default";
  for (const suffix of ["", "@2x", "@3x"]) {
    images[`strip${suffix}.png`] = await publicFile(origin, `/wallet/apple/strip-${strip}${suffix}.png`);
  }
  return images;
}

// ---------------------------------------------------------------------------
// Passes
// ---------------------------------------------------------------------------

type PassRecord = { serial_number: string; card_id: string | null; auth_token: string; updated_at: string };

async function makePass(origin: string, config: AppleWalletConfig, cafe: WalletCafe, pass: PassRecord) {
  let card: ApplePassCard | null = null;
  if (pass.card_id) {
    const { data, error } = await createAdminClient().from("cards").select("customer_id").eq("id", pass.card_id).single();
    if (error) throw error;
    const row = await passData(cafe.id, data.customer_id);
    if (row) {
      card = {
        cardNumber: cardNumberFor(row.card_id),
        customerName: row.display_name,
        stamps: row.stamp_count,
        goal: row.stamps_required,
        coupon: couponOf(row, origin),
      };
    }
  }
  const theme = await themeFor(cafe);
  const content = buildApplePass({
    passTypeId: config.passTypeId,
    teamId: config.teamId,
    serial: pass.serial_number,
    authToken: pass.auth_token,
    webServiceUrl: `${origin}${WEB_SERVICE_PATH}`,
    cafeName: cafe.name,
    origin,
    theme,
    card,
  });
  return packPass({ ...content, images: await passImages(origin, theme) }, await signerFor(config));
}

/** The customer's .pkpass, for "Add to Apple Wallet". Creates the pass record the first time. */
export async function applePassForCustomer(origin: string, customerId: string) {
  const config = requireConfig();
  const cafe = await loadCafe();
  await ensureCard(cafe.id, customerId);
  const row = await passData(cafe.id, customerId);
  if (!row) throw new Error("Card not found after creating it");

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("apple_wallet_passes").upsert(
    { serial_number: row.card_id, cafe_id: cafe.id, card_id: row.card_id, auth_token: randomBytes(32).toString("base64url") },
    { onConflict: "serial_number", ignoreDuplicates: true },
  );
  if (insertError) throw insertError;
  const { data: pass, error } = await admin
    .from("apple_wallet_passes")
    .select("serial_number, card_id, auth_token, updated_at")
    .eq("serial_number", row.card_id)
    .single();
  if (error) throw error;
  return makePass(origin, config, cafe, pass);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The pass record if the request's "Authorization: ApplePass <token>" matches
 * it, else null. Compares digests, so it takes the same time either way.
 */
export async function authorizedPass(serial: string, authorization: string | null): Promise<PassRecord | null> {
  if (!UUID.test(serial) || !authorization?.startsWith("ApplePass ")) return null;
  const { data } = await createAdminClient()
    .from("apple_wallet_passes")
    .select("serial_number, card_id, auth_token, updated_at")
    .eq("serial_number", serial.toLowerCase())
    .maybeSingle();
  if (!data) return null;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`ApplePass ${data.auth_token}`)) ? data : null;
}

/** The latest .pkpass for a phone asking with a valid token. */
export async function applePassForDevice(origin: string, pass: PassRecord) {
  return makePass(origin, requireConfig(), await loadCafe(), pass);
}

// ---------------------------------------------------------------------------
// Web service: registrations
// ---------------------------------------------------------------------------

export async function registerDevice(device: string, serial: string, pushToken: string) {
  const { data, error } = await createAdminClient().rpc("apple_wallet_register", {
    p_device: device,
    p_serial: serial.toLowerCase(),
    p_push_token: pushToken,
  });
  if (error) throw error;
  return data;
}

export async function unregisterDevice(device: string, serial: string) {
  const { error } = await createAdminClient()
    .from("apple_wallet_registrations")
    .delete()
    .eq("device_library_id", device)
    .eq("serial_number", serial.toLowerCase());
  if (error) throw error;
}

/**
 * The phone's passes changed since `since` (the tag we gave it last time:
 * milliseconds), and the tag to use next time. Null when nothing changed.
 */
export async function updatedSerials(device: string, since: string | null) {
  const sinceMs = since && /^\d{1,15}$/.test(since) ? Number(since) : null;
  const { data, error } = await createAdminClient().rpc("apple_wallet_updated_serials", {
    p_device: device,
    p_since: sinceMs === null ? null : new Date(sinceMs).toISOString(),
  });
  if (error) throw error;
  if (!data?.length) return null;
  return { serialNumbers: data.map((r) => r.serial_number), lastUpdated: nextUpdateTag(data.map((r) => r.updated_at)) };
}

// ---------------------------------------------------------------------------
// Pushes
// ---------------------------------------------------------------------------

/**
 * Sends the pushes still owed (for one pass, or any), at most `limit`. Phones
 * that no longer hold the pass are forgotten. `more` means call again.
 */
export async function pushOwed(cafeId: string, { serial = null as string | null, limit = 10 } = {}) {
  const config = appleWalletConfig();
  if (!config) return { sent: 0, more: false };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apple_wallet_claim_pushes", { p_cafe_id: cafeId, p_serial: serial, p_limit: limit });
  if (error) throw error;
  let sent = 0;
  for (const claim of data ?? []) {
    const result = await pushPassUpdate(config, claim.push_token).catch((e) => {
      console.error("Apple Wallet: push failed", e);
      return "failed" as const;
    });
    if (result === "sent") sent++;
    if (result === "gone") {
      await admin.from("apple_wallet_registrations").delete()
        .eq("device_library_id", claim.device_library_id).eq("serial_number", claim.serial_number);
    }
  }
  return { sent, more: (data?.length ?? 0) >= limit };
}

/** Marks the customer's pass changed and tells their phones. Does nothing without an Apple pass. */
export async function refreshApplePass(cafe: WalletCafe, customerId: string) {
  if (!isAppleWalletEnabled()) return;
  const { data: serial, error } = await createAdminClient().rpc("apple_wallet_touch", { p_cafe_id: cafe.id, p_customer_id: customerId });
  if (error) throw error;
  if (serial) await pushOwed(cafe.id, { serial });
}

/** The customer's Apple pass serial numbers (before deleting their account). */
export async function applePassSerials(customerId: string) {
  if (!isAppleWalletEnabled()) return [];
  const { data } = await createAdminClient().from("cards").select("id").eq("customer_id", customerId);
  const ids = (data ?? []).map((c) => c.id);
  if (!ids.length) return [];
  const { data: passes } = await createAdminClient().from("apple_wallet_passes").select("serial_number").in("card_id", ids);
  return (passes ?? []).map((p) => p.serial_number);
}

/**
 * Brings every pass to today's theme. With `force` (an admin changed
 * something) always; otherwise only when a different theme has started.
 * Pushes the first batch; `more` means pushes are still owed.
 */
export async function syncAppleTheme(cafe: WalletCafe, theme: Theme, { force = false, limit = 10 } = {}) {
  if (!isAppleWalletEnabled()) return { changed: false, more: false };
  const admin = createAdminClient();
  let changed = force;
  if (theme.key !== cafe.apple_wallet_theme_key) {
    const update = admin.from("cafes").update({ apple_wallet_theme_key: theme.key }).eq("id", cafe.id);
    const { data: claimed, error } = await (cafe.apple_wallet_theme_key === null
      ? update.is("apple_wallet_theme_key", null)
      : update.eq("apple_wallet_theme_key", cafe.apple_wallet_theme_key)
    ).select("id");
    if (error) throw error;
    changed ||= !!claimed?.length;
  }
  if (changed) {
    const { error } = await admin.rpc("apple_wallet_touch_all", { p_cafe_id: cafe.id });
    if (error) throw error;
  }
  if (limit === 0) return { changed, more: changed };
  const { more } = await pushOwed(cafe.id, { limit });
  return { changed, more };
}

/** How many of the cafe's cards are in Apple Wallet on at least one phone. */
export async function applePassCount(cafeId: string) {
  const { data, error } = await createAdminClient().rpc("apple_wallet_pass_count", { p_cafe_id: cafeId });
  if (error) throw error;
  return data ?? 0;
}
