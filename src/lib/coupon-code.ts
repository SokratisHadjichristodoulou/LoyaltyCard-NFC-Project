// Shared by the browser scanner and the server: no server-only imports.

const CODE = /^CP(?:-[2-9A-HJ-NP-Z]{4}){4}$/;

/**
 * What a coupon's QR code opens: the staff page with the code filled in.
 * The code itself is the secret (16 random characters); the staff page looks
 * it up and redeems it once, so a screenshot cannot be used twice.
 */
export function couponCheckUrlAt(origin: string, code: string) {
  return `${origin}/staff?code=${encodeURIComponent(code)}`;
}

/** Normalises what staff type: trims, upper-cases, keeps it short. */
export function normaliseCode(input: string) {
  return input.trim().toUpperCase().slice(0, 64);
}

/**
 * Gets a coupon code out of a scanned QR: either our link
 * (https://…/staff?code=CP-…) or a bare code.
 */
export function codeFromScan(text: string): string | null {
  try {
    const fromUrl = new URL(text).searchParams.get("code");
    if (fromUrl) return normaliseCode(fromUrl);
  } catch {
    // not a URL
  }
  const code = normaliseCode(text);
  return CODE.test(code) ? code : null;
}
