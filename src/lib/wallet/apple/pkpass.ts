// Packs a .pkpass: pass.json, translations and images, manifest.json (SHA-1
// of every file) and the signature of the manifest, zipped. Pure, so tested.

import { signDetached, type Signer } from "./pkcs7";
import { stringsFile } from "./pass";
import { zip } from "./zip";

async function sha1Hex(data: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", data));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type PassContent = {
  passJson: object;
  strings: { el: Map<string, string>; en: Map<string, string> };
  /** File name ("icon@2x.png", "strip.png", ...) to PNG bytes. */
  images: Record<string, Uint8Array<ArrayBuffer>>;
};

export async function packPass({ passJson, strings, images }: PassContent, signer: Signer) {
  const files: Record<string, Uint8Array<ArrayBuffer>> = {
    "pass.json": new TextEncoder().encode(JSON.stringify(passJson)),
    "el.lproj/pass.strings": stringsFile(strings.el),
    "en.lproj/pass.strings": stringsFile(strings.en),
    ...images,
  };
  const manifest: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) manifest[name] = await sha1Hex(data);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));

  return zip([
    ...Object.entries(files).map(([name, data]) => ({ name, data })),
    { name: "manifest.json", data: manifestBytes },
    { name: "signature", data: await signDetached(manifestBytes, signer) },
  ]);
}

/** PNG files start with these 8 bytes (Apple Wallet only takes PNG). */
export function isPng(data: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return data.length > 8 && signature.every((b, i) => data[i] === b);
}
