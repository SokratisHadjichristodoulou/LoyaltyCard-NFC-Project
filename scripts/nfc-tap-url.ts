// Makes a valid tap URL, exactly as a programmed tag would, for testing
// without a physical tag. Each counter can be used once; use a higher one
// for the next test tap.
//
//   npm run nfc:url -- 04A1B2C3D4E5F6 12
//
// The tag must be registered in Admin > NFC tags. Uses NFC_TAG_SECRET and
// NEXT_PUBLIC_SITE_URL (defaults to http://localhost:3000).

import { simulateSun, tagKeys } from "../src/lib/nfc/sdm";

const uid = (process.argv[2] ?? "").replace(/[\s:-]/g, "").toUpperCase();
const counter = Number(process.argv[3]);
const secret = process.env.NFC_TAG_SECRET ?? "";
const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

if (!/^[0-9A-F]{14}$/.test(uid) || !Number.isInteger(counter) || counter < 1 || counter > 0xffffff) {
  console.error("Usage: npm run nfc:url -- <7-byte UID> <counter 1-16777215>");
  process.exit(1);
}
if (secret.length < 32) {
  console.error("Set NFC_TAG_SECRET (at least 32 characters) in .env.local first.");
  process.exit(1);
}

const keys = tagKeys(secret, uid);
const { e, c } = simulateSun(keys.sdmMetaRead, keys.sdmFileRead, uid, counter);
console.log(`${site}/tap?e=${e}&c=${c}`);
