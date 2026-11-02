// Apple Wallet settings from the environment. No server-only import, so it
// can be tested; the keys are only ever read on the server.

import { pemBlocks } from "./der";

export type AppleWalletConfig = {
  /** e.g. pass.com.coffeepause.card */
  passTypeId: string;
  /** The Apple developer team (10 characters). */
  teamId: string;
  /** The Pass Type ID certificate (DER). */
  certificate: Uint8Array;
  /** Its private key (PEM), unencrypted. */
  keyPem: string;
  /** Apple's WWDR intermediate certificate(s) (DER). */
  chain: Uint8Array[];
  /** The APNs auth key (.p8) and its id, for update pushes. */
  apnsKeyId: string;
  apnsKeyPem: string;
};

type Env = Record<string, string | undefined>;

/**
 * Reads the APPLE_WALLET_* and APPLE_APNS_* settings. Null when any is
 * missing or malformed: Apple Wallet is then simply off.
 */
export function parseAppleWalletConfig(env: Env): AppleWalletConfig | null {
  const passTypeId = env.APPLE_WALLET_PASS_TYPE_ID?.trim();
  const teamId = env.APPLE_WALLET_TEAM_ID?.trim();
  const apnsKeyId = env.APPLE_APNS_KEY_ID?.trim();
  const certPem = env.APPLE_WALLET_CERT ?? "";
  const keyPem = env.APPLE_WALLET_KEY ?? "";
  const wwdrPem = env.APPLE_WALLET_WWDR ?? "";
  const apnsKeyPem = env.APPLE_APNS_KEY ?? "";

  if (!passTypeId || !/^pass\.[A-Za-z0-9.-]+$/.test(passTypeId)) return null;
  if (!teamId || !/^[A-Z0-9]{10}$/.test(teamId)) return null;
  if (!apnsKeyId || !/^[A-Z0-9]{10}$/.test(apnsKeyId)) return null;
  try {
    const certificate = pemBlocks(certPem, "CERTIFICATE")[0];
    const chain = pemBlocks(wwdrPem, "CERTIFICATE");
    const hasKey = pemBlocks(keyPem, "PRIVATE KEY").length > 0 || pemBlocks(keyPem, "RSA PRIVATE KEY").length > 0;
    const hasApnsKey = pemBlocks(apnsKeyPem, "PRIVATE KEY").length > 0;
    if (!certificate || chain.length === 0 || !hasKey || !hasApnsKey) return null;
    return { passTypeId, teamId, certificate, keyPem, chain, apnsKeyId, apnsKeyPem };
  } catch {
    return null; // not valid base64
  }
}

export function appleWalletConfig() {
  return parseAppleWalletConfig(process.env);
}
