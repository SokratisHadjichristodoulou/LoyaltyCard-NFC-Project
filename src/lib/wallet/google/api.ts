import "server-only";
import type { GoogleWalletConfig } from "./config";
import { importPrivateKey, signJwt } from "./jwt";

// The few Google Wallet REST calls the site makes, with a service account.
// Reference: https://developers.google.com/wallet/reference/rest

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

export class GoogleWalletError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`Google Wallet ${status}: ${message}`);
  }
}

// One access token per server instance, reused until shortly before it expires.
let cachedToken: { email: string; token: string; expiresAt: number } | null = null;
const keys = new Map<string, Promise<CryptoKey>>();

function signingKey(config: GoogleWalletConfig) {
  let key = keys.get(config.privateKey);
  if (!key) {
    key = importPrivateKey(config.privateKey);
    key.catch(() => keys.delete(config.privateKey));
    keys.set(config.privateKey, key);
  }
  return key;
}

/** Signs a JWT with the service account's key (also used for the save link). */
export async function signWithServiceAccount(config: GoogleWalletConfig, claims: Record<string, unknown>) {
  return signJwt(claims, await signingKey(config));
}

async function accessToken(config: GoogleWalletConfig) {
  if (cachedToken && cachedToken.email === config.email && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signWithServiceAccount(config, {
    iss: config.email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new GoogleWalletError(response.status, `token request failed: ${body?.error_description ?? response.statusText}`);
  }
  cachedToken = { email: config.email, token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function call(config: GoogleWalletConfig, method: "GET" | "POST" | "PUT", path: string, body?: unknown) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken(config)}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new GoogleWalletError(response.status, error?.error?.message ?? response.statusText);
  }
  return response.json() as Promise<unknown>;
}

type Resource = { id: string };
type Kind = "loyaltyClass" | "loyaltyObject";

/** Replaces the resource, or creates it the first time. */
async function upsert(config: GoogleWalletConfig, kind: Kind, resource: Resource) {
  try {
    return await call(config, "PUT", `/${kind}/${encodeURIComponent(resource.id)}`, resource);
  } catch (error) {
    if (!(error instanceof GoogleWalletError) || error.status !== 404) throw error;
    return call(config, "POST", `/${kind}`, resource);
  }
}

export const googleWallet = {
  upsertClass: (config: GoogleWalletConfig, resource: Resource) => upsert(config, "loyaltyClass", resource),
  upsertObject: (config: GoogleWalletConfig, resource: Resource) => upsert(config, "loyaltyObject", resource),
  /** Replaces an object that must already exist (404 if it doesn't). */
  updateObject: (config: GoogleWalletConfig, resource: Resource) =>
    call(config, "PUT", `/loyaltyObject/${encodeURIComponent(resource.id)}`, resource),
  addClassMessage: (config: GoogleWalletConfig, classId: string, message: unknown) =>
    call(config, "POST", `/loyaltyClass/${encodeURIComponent(classId)}/addMessage`, { message }),
  addObjectMessage: (config: GoogleWalletConfig, objectId: string, message: unknown) =>
    call(config, "POST", `/loyaltyObject/${encodeURIComponent(objectId)}/addMessage`, { message }),
};
