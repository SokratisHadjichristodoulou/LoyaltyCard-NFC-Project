// Shared by the browser scanner and the server: no server-only imports.

const CODE = /^CP(?:-[2-9A-HJ-NP-Z]{4}){4}$/;

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
