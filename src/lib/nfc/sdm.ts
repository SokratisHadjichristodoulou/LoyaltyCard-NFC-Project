// NTAG 424 DNA "Secure Unique NFC" (SUN) verification, following NXP AN12196.
//
// Each tap, the tag puts two values into its URL:
//   e = PICC data: tag UID + tap counter, AES-128 encrypted with the
//       SDM meta read key (the same for every tag in this deployment)
//   c = SDM MAC: 8-byte AES-CMAC over the tap, with a session key derived
//       from the tag's own SDM file read key, its UID and the counter
// No imports from Next.js or Supabase, so this can be unit-tested and reused
// by the command-line tools in scripts/.

import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from "node:crypto";

const ZERO_IV = Buffer.alloc(16);
/** PICCDataTag: UID mirrored, counter mirrored, UID length 7. */
const PICC_DATA_TAG = 0xc7;

// ---------------------------------------------------------------------------
// AES-CMAC (RFC 4493)
// ---------------------------------------------------------------------------

function aesEcbEncrypt(key: Buffer, block: Buffer) {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

function shiftLeft(block: Buffer) {
  const out = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) out[i] = ((block[i] << 1) | (i < 15 ? block[i + 1] >> 7 : 0)) & 0xff;
  return out;
}

function subkeys(key: Buffer) {
  const l = aesEcbEncrypt(key, Buffer.alloc(16));
  const k1 = shiftLeft(l);
  if (l[0] & 0x80) k1[15] ^= 0x87;
  const k2 = shiftLeft(k1);
  if (k1[0] & 0x80) k2[15] ^= 0x87;
  return { k1, k2 };
}

export function aesCmac(key: Buffer, message: Buffer) {
  const { k1, k2 } = subkeys(key);
  const blocks = Math.max(1, Math.ceil(message.length / 16));
  const complete = message.length > 0 && message.length % 16 === 0;
  const last = Buffer.alloc(16);
  message.copy(last, 0, (blocks - 1) * 16);
  if (complete) {
    for (let i = 0; i < 16; i++) last[i] ^= k1[i];
  } else {
    last[message.length - (blocks - 1) * 16] = 0x80;
    for (let i = 0; i < 16; i++) last[i] ^= k2[i];
  }
  let x = Buffer.alloc(16);
  for (let b = 0; b < blocks - 1; b++) {
    const y = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) y[i] = x[i] ^ message[b * 16 + i];
    x = aesEcbEncrypt(key, y);
  }
  for (let i = 0; i < 16; i++) last[i] ^= x[i];
  return aesEcbEncrypt(key, last);
}

/** NTAG 424 truncated MAC: the 8 bytes at odd positions of the full CMAC. */
function truncate(mac: Buffer) {
  return Buffer.from([1, 3, 5, 7, 9, 11, 13, 15].map((i) => mac[i]));
}

// ---------------------------------------------------------------------------
// SUN message
// ---------------------------------------------------------------------------

export type Tap = { uid: string; counter: number };

export type VerifyResult = { ok: true; tap: Tap } | { ok: false; reason: "malformed" | "bad_mac" };

/** The tap's MAC: SV2 = 3CC3 0001 0080 || UID || counter (LSB first). */
export function sdmMac(fileReadKey: Buffer, uid: Buffer, counter: number, input: Buffer = Buffer.alloc(0)) {
  const ctr = Buffer.from([counter & 0xff, (counter >> 8) & 0xff, (counter >> 16) & 0xff]);
  const sv2 = Buffer.concat([Buffer.from("3cc300010080", "hex"), uid, ctr]);
  const sessionKey = aesCmac(fileReadKey, sv2);
  return truncate(aesCmac(sessionKey, input));
}

export function decryptPiccData(metaReadKey: Buffer, encrypted: Buffer): Tap | null {
  if (encrypted.length !== 16) return null;
  const decipher = createDecipheriv("aes-128-cbc", metaReadKey, ZERO_IV);
  decipher.setAutoPadding(false);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  if (plain[0] !== PICC_DATA_TAG) return null;
  const uid = plain.subarray(1, 8);
  const counter = plain[8] | (plain[9] << 8) | (plain[10] << 16);
  return { uid: uid.toString("hex").toUpperCase(), counter };
}

const HEX32 = /^[0-9a-fA-F]{32}$/;
const HEX16 = /^[0-9a-fA-F]{16}$/;

/**
 * Verifies the e= and c= values from a tap URL.
 * fileReadKeyFor gets the decrypted UID and returns that tag's MAC key.
 */
export function verifySun(
  e: string | null | undefined,
  c: string | null | undefined,
  metaReadKey: Buffer,
  fileReadKeyFor: (uid: string) => Buffer,
): VerifyResult {
  if (!e || !c || !HEX32.test(e) || !HEX16.test(c)) return { ok: false, reason: "malformed" };
  const tap = decryptPiccData(metaReadKey, Buffer.from(e, "hex"));
  if (!tap) return { ok: false, reason: "bad_mac" };
  const expected = sdmMac(fileReadKeyFor(tap.uid), Buffer.from(tap.uid, "hex"), tap.counter);
  const given = Buffer.from(c, "hex");
  if (!timingSafeEqual(expected, given)) return { ok: false, reason: "bad_mac" };
  return { ok: true, tap };
}

/** Builds e= and c= the way a tag would. Used by tests and the tap simulator. */
export function simulateSun(metaReadKey: Buffer, fileReadKey: Buffer, uid: string, counter: number, padding = Buffer.alloc(5)) {
  const uidBytes = Buffer.from(uid, "hex");
  const ctr = Buffer.from([counter & 0xff, (counter >> 8) & 0xff, (counter >> 16) & 0xff]);
  const plain = Buffer.concat([Buffer.from([PICC_DATA_TAG]), uidBytes, ctr, padding]);
  const cipher = createCipheriv("aes-128-cbc", metaReadKey, ZERO_IV);
  cipher.setAutoPadding(false);
  const e = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    e: e.toString("hex").toUpperCase(),
    c: sdmMac(fileReadKey, uidBytes, counter).toString("hex").toUpperCase(),
  };
}

// ---------------------------------------------------------------------------
// Keys: everything derives from one secret (NFC_TAG_SECRET), nothing stored.
// ---------------------------------------------------------------------------

function derive(secret: string, label: string) {
  if (!secret || secret.length < 32) throw new Error("NFC_TAG_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(label).digest().subarray(0, 16);
}

export type TagKeys = {
  /** Key 0: application master key, needed to change the tag's settings later. */
  appMaster: Buffer;
  /** Key 1: SDM meta read key (decrypts e=). Shared by all tags. */
  sdmMetaRead: Buffer;
  /** Key 2: SDM file read key (checks c=). Unique per tag. */
  sdmFileRead: Buffer;
  /** Keys 3 and 4 are unused; set them so no factory key is left on the tag. */
  key3: Buffer;
  key4: Buffer;
};

export const sdmMetaReadKey = (secret: string) => derive(secret, "cp:sdm-meta-read");

export function tagKeys(secret: string, uid: string): TagKeys {
  const u = uid.toUpperCase();
  return {
    appMaster: derive(secret, `cp:app-master:${u}`),
    sdmMetaRead: sdmMetaReadKey(secret),
    sdmFileRead: derive(secret, `cp:sdm-file-read:${u}`),
    key3: derive(secret, `cp:key3:${u}`),
    key4: derive(secret, `cp:key4:${u}`),
  };
}

/** Verifies a tap with keys derived from the deployment secret. */
export function verifyTap(secret: string, e: string | null | undefined, c: string | null | undefined) {
  return verifySun(e, c, sdmMetaReadKey(secret), (uid) => tagKeys(secret, uid).sdmFileRead);
}
