// Google Wallet settings from the environment. No server-only import, so it
// can be tested; the key itself is only ever read on the server.

export type GoogleWalletConfig = {
  issuerId: string;
  /** The service account's email (client_email in the key file). */
  email: string;
  /** The service account's private key, PEM (private_key in the key file). */
  privateKey: string;
};

/**
 * Reads GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_KEY (the service account's
 * JSON key file, pasted whole). Null when either is missing or the key file
 * doesn't parse: Google Wallet is then simply off.
 */
export function parseGoogleWalletConfig(issuerId: string | undefined, keyJson: string | undefined): GoogleWalletConfig | null {
  const issuer = issuerId?.trim();
  if (!issuer || !/^\d+$/.test(issuer) || !keyJson?.trim()) return null;
  try {
    const key = JSON.parse(keyJson) as { client_email?: unknown; private_key?: unknown };
    if (typeof key.client_email !== "string" || typeof key.private_key !== "string") return null;
    if (!key.private_key.includes("PRIVATE KEY")) return null;
    return { issuerId: issuer, email: key.client_email, privateKey: key.private_key };
  } catch {
    return null;
  }
}

export function googleWalletConfig() {
  return parseGoogleWalletConfig(process.env.GOOGLE_WALLET_ISSUER_ID, process.env.GOOGLE_WALLET_KEY);
}

/** One loyalty class per cafe: "<issuer>.<cafe slug>". */
export function classIdFor(issuerId: string, cafeSlug: string) {
  return `${issuerId}.${cafeSlug.replace(/[^A-Za-z0-9._-]/g, "-")}`;
}

/** One loyalty object per card: "<issuer>.card-<card id>". */
export function objectIdFor(issuerId: string, cardId: string) {
  return `${issuerId}.card-${cardId}`;
}
