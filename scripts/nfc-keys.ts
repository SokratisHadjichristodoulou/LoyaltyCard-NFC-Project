// Prints what is needed to program one NTAG 424 DNA tag for this site.
//
//   npm run nfc:keys -- 04A1B2C3D4E5F6
//
// Reads NFC_TAG_SECRET and NEXT_PUBLIC_SITE_URL from the environment
// (.env.local is loaded if present). Keys are printed, never stored.

import { tagKeys } from "../src/lib/nfc/sdm";

const uid = (process.argv[2] ?? "").replace(/[\s:-]/g, "").toUpperCase();
const secret = process.env.NFC_TAG_SECRET ?? "";
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

if (!/^[0-9A-F]{14}$/.test(uid)) fail("Give the tag's 7-byte UID, e.g. npm run nfc:keys -- 04A1B2C3D4E5F6");
if (secret.length < 32) fail("Set NFC_TAG_SECRET (at least 32 characters) in .env.local first.");
if (!site.startsWith("https://")) fail("Set NEXT_PUBLIC_SITE_URL to the live https:// address in .env.local first.");

const keys = tagKeys(secret, uid);
const hex = (b: Buffer) => b.toString("hex").toUpperCase();

// The NDEF file the tag serves: NLEN (2) + record header D1 01 <len> 55 + URI code 04 (https://)
const uri = `${site.slice("https://".length)}/tap?e=${"0".repeat(32)}&c=${"0".repeat(16)}`;
const before = 7;
const piccOffset = before + uri.indexOf("e=") + 2;
const macOffset = before + uri.indexOf("c=") + 2;
const toHex3 = (n: number) => n.toString(16).toUpperCase().padStart(6, "0");

console.log(`
NTAG 424 DNA setup for tag ${uid}
${"=".repeat(40)}

Keys (AES-128). Change them from the factory zeros, key 0 last:
  Key 0  app master       ${hex(keys.appMaster)}
  Key 1  SDM meta read    ${hex(keys.sdmMetaRead)}   (same on every tag)
  Key 2  SDM file read    ${hex(keys.sdmFileRead)}
  Key 3  (unused)         ${hex(keys.key3)}
  Key 4  (unused)         ${hex(keys.key4)}

NDEF URL record (URI prefix "https://"):
  https://${uri}

Secure Dynamic Messaging (SDM) on the NDEF file (file 02):
  SDM enabled, UID mirror on, read counter mirror on, encrypted PICC data
  SDMMetaRead key:   1
  SDMFileRead key:   2
  SDMCtrRet key:     F (no access)
  PICCDataOffset:    ${piccOffset} (0x${toHex3(piccOffset)})   where e=… starts
  SDMMACInputOffset: ${macOffset} (0x${toHex3(macOffset)})   same as below: MAC over no data
  SDMMACOffset:      ${macOffset} (0x${toHex3(macOffset)})   where c=… starts
  Access: read free (E), write key 0, read-write key 0, change key 0

Keep this output private. Anyone with key 2 for this tag could make fake taps.
`);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
