import "server-only";
import { base64url } from "../google/jwt";
import type { AppleWalletConfig } from "./config";
import { pemBlocks } from "./der";

// Tells an iPhone that a pass changed: an empty push through APNs, with the
// Pass Type ID as topic and token-based (.p8 key) authentication. The phone
// then asks the web service for the new pass. Apple only delivers these from
// the production APNs, so this can't be tried from a local dev server.

const APNS = "https://api.push.apple.com/3/device/";

let cachedToken: { keyId: string; token: string; issuedAt: number } | null = null;

/** The provider token (ES256 JWT). Apple wants it renewed at most hourly, and not much more often. */
export async function providerToken(config: AppleWalletConfig, now = Date.now()) {
  if (cachedToken && cachedToken.keyId === config.apnsKeyId && now - cachedToken.issuedAt < 50 * 60_000) {
    return cachedToken.token;
  }
  const der = pemBlocks(config.apnsKeyPem, "PRIVATE KEY")[0];
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const unsigned = `${base64url(JSON.stringify({ alg: "ES256", kid: config.apnsKeyId }))}.${base64url(
    JSON.stringify({ iss: config.teamId, iat: Math.floor(now / 1000) }),
  )}`;
  // Web Crypto gives the raw r || s signature JWS expects.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
  const token = `${unsigned}.${base64url(signature)}`;
  cachedToken = { keyId: config.apnsKeyId, token, issuedAt: now };
  return token;
}

export type PushResult = "sent" | "gone" | "failed";

/** "gone" means the phone no longer has the pass (or the token is bad): forget the registration. */
export async function pushPassUpdate(config: AppleWalletConfig, pushToken: string): Promise<PushResult> {
  if (!/^[0-9a-fA-F]{20,200}$/.test(pushToken)) return "gone";
  const response = await fetch(APNS + pushToken, {
    method: "POST",
    headers: {
      authorization: `bearer ${await providerToken(config)}`,
      "apns-topic": config.passTypeId,
      "apns-push-type": "background",
      "apns-priority": "5",
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (response.ok) return "sent";
  const reason = ((await response.json().catch(() => null)) as { reason?: string } | null)?.reason ?? response.statusText;
  if (response.status === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic") return "gone";
  if (reason === "ExpiredProviderToken" || reason === "InvalidProviderToken") cachedToken = null;
  console.error(`Apple Wallet: push failed (${response.status} ${reason})`);
  return "failed";
}
