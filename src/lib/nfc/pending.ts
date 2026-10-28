// A verified tap waiting for the customer to sign in. Stored in an httpOnly
// cookie as "payload.signature" (HMAC-SHA256 with a key derived from
// NFC_TAG_SECRET), so it cannot be forged or edited, and it expires quickly.

import { createHmac, timingSafeEqual } from "node:crypto";

/** counter is null for a simple tag (fixed link, no tap counter). */
export type PendingTap = { tagId: string; counter: number | null; expiresAt: number };

export const PENDING_TAP_COOKIE = "cp_pending_tap";
export const PENDING_TAP_MINUTES = 15;

const key = (secret: string) => createHmac("sha256", secret).update("cp:pending-tap").digest();

export function signPendingTap(secret: string, tap: PendingTap) {
  const payload = Buffer.from(JSON.stringify([tap.tagId, tap.counter, tap.expiresAt])).toString("base64url");
  const sig = createHmac("sha256", key(secret)).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readPendingTap(secret: string, value: string | undefined, now = Date.now()): PendingTap | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", key(secret)).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const [tagId, counter, expiresAt] = JSON.parse(Buffer.from(payload, "base64url").toString()) as [string, number | null, number];
    if (typeof tagId !== "string" || !(counter === null || Number.isInteger(counter)) || typeof expiresAt !== "number") return null;
    return expiresAt > now ? { tagId, counter, expiresAt } : null;
  } catch {
    return null;
  }
}
