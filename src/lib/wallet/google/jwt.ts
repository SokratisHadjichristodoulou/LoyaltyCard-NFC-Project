// RS256 JSON Web Tokens with the Web Crypto API, which both Node and
// Cloudflare Workers have. Used for Google's OAuth token request and for the
// "Add to Google Wallet" link. No server-only import, so it can be tested.

const encoder = new TextEncoder();

export function base64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Imports a PKCS #8 PEM private key ("-----BEGIN PRIVATE KEY-----"), as in a Google service account key file. */
export async function importPrivateKey(pem: string) {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function signJwt(claims: Record<string, unknown>, key: CryptoKey) {
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}
