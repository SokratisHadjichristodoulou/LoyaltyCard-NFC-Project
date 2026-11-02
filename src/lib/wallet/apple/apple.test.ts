import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { DEFAULT_THEME, activeTheme } from "../themes";
import { parseAppleWalletConfig } from "./config";
import { issuerAndSerial, oid, pemBlocks, setOf, utcTime } from "./der";
import { buildApplePass, stringsFile, type ApplePassInput } from "./pass";
import { isPng, packPass } from "./pkpass";
import { nextUpdateTag, parseServicePath } from "./service";
import { importRsaSigningKey, signDetached } from "./pkcs7";
import { crc32, zip } from "./zip";

function hasOpenssl() {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * A throwaway chain like Apple's: root CA -> intermediate ("WWDR") -> pass
 * certificate. Made with openssl, so the tests check against a real verifier.
 */
function makeChain() {
  const dir = mkdtempSync(join(tmpdir(), "pkpass-"));
  const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
  run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "root.key", "-out", "root.pem", "-days", "2", "-subj", "/CN=Test Root",
    "-addext", "basicConstraints=critical,CA:true", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
  run("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "wwdr.key", "-out", "wwdr.csr", "-subj", "/CN=Test WWDR");
  writeFileSync(join(dir, "ca.ext"), "basicConstraints=critical,CA:true\nkeyUsage=critical,keyCertSign,cRLSign\n");
  run("x509", "-req", "-in", "wwdr.csr", "-CA", "root.pem", "-CAkey", "root.key", "-CAcreateserial", "-out", "wwdr.pem", "-days", "2", "-extfile", "ca.ext");
  run("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "pass.key", "-out", "pass.csr", "-subj", "/UID=pass.com.example.card/CN=Pass Type ID: pass.com.example.card");
  run("x509", "-req", "-in", "pass.csr", "-CA", "wwdr.pem", "-CAkey", "wwdr.key", "-CAcreateserial", "-out", "pass.pem", "-days", "2");
  run("rsa", "-in", "pass.key", "-traditional", "-out", "pass-pkcs1.key");
  const read = (f: string) => readFileSync(join(dir, f), "utf8");
  return { dir, run, root: read("root.pem"), wwdr: read("wwdr.pem"), cert: read("pass.pem"), key: read("pass.key"), keyPkcs1: read("pass-pkcs1.key") };
}

describe.skipIf(!hasOpenssl())("pass signature (PKCS #7)", () => {
  const chain = makeChain();

  it("finds the certificate's issuer and serial number as openssl reports them", () => {
    const der = pemBlocks(chain.cert, "CERTIFICATE")[0];
    const { issuer, serial } = issuerAndSerial(der);
    expect(issuer[0]).toBe(0x30);
    expect(serial[0]).toBe(0x02);
    const serialHex = Buffer.from(serial.subarray(2)).toString("hex").replace(/^00/, "").toUpperCase();
    const reported = chain.run("x509", "-in", "pass.pem", "-noout", "-serial").toString().trim().replace("serial=", "");
    expect(serialHex).toBe(reported.replace(/^0+/, "").padStart(serialHex.length, "0"));
  });

  for (const [label, key] of [["PKCS #8 key", "key"], ["PKCS #1 key", "keyPkcs1"]] as const) {
    it(`openssl verifies the detached signature and its chain (${label})`, async () => {
      const manifest = new TextEncoder().encode(JSON.stringify({ "pass.json": "0123" }));
      const signature = await signDetached(manifest, {
        certificate: pemBlocks(chain.cert, "CERTIFICATE")[0],
        chain: pemBlocks(chain.wwdr, "CERTIFICATE"),
        privateKey: await importRsaSigningKey(chain[key]),
      });
      writeFileSync(join(chain.dir, "manifest.json"), manifest);
      writeFileSync(join(chain.dir, "signature"), signature);
      const out = chain.run(
        "smime", "-verify", "-binary", "-inform", "DER", "-in", "signature", "-content", "manifest.json",
        "-CAfile", "root.pem", "-purpose", "any", "-out", "/dev/null",
      );
      expect(out.toString()).toBe("");

      // A changed manifest must fail.
      writeFileSync(join(chain.dir, "manifest.json"), "{}");
      expect(() =>
        chain.run("smime", "-verify", "-binary", "-inform", "DER", "-in", "signature", "-content", "manifest.json", "-CAfile", "root.pem", "-purpose", "any", "-out", "/dev/null"),
      ).toThrow();
    });
  }

  it("says clearly when the key is missing or encrypted", async () => {
    await expect(importRsaSigningKey("-----BEGIN ENCRYPTED PRIVATE KEY-----\nabc\n-----END ENCRYPTED PRIVATE KEY-----")).rejects.toThrow(/decrypted/);
  });
});

describe("DER", () => {
  it("encodes object identifiers and times like the standard examples", () => {
    expect(Buffer.from(oid("1.2.840.113549.1.7.2")).toString("hex")).toBe("06092a864886f70d010702");
    expect(Buffer.from(oid("2.16.840.1.101.3.4.2.1")).toString("hex")).toBe("0609608648016503040201");
    expect(new TextDecoder().decode(utcTime(new Date("2026-11-02T09:05:07Z")).subarray(2))).toBe("261102090507Z");
  });

  it("sorts SET OF elements", () => {
    expect([...setOf(Uint8Array.of(2, 1, 9), Uint8Array.of(2, 1, 3))]).toEqual([0x31, 6, 2, 1, 3, 2, 1, 9]);
  });

  it("reads PEM blocks among other lines and with escaped newlines", () => {
    const pem = "Bag Attributes\n    friendlyName: x\n-----BEGIN CERTIFICATE-----\nAQID\n-----END CERTIFICATE-----\n";
    expect([...pemBlocks(pem, "CERTIFICATE")[0]]).toEqual([1, 2, 3]);
    expect([...pemBlocks(pem.replace(/\n/g, "\\n"), "CERTIFICATE")[0]]).toEqual([1, 2, 3]);
  });
});

/** Reads a ZIP back (stored or deflated entries) to check what zip() wrote. */
function unzip(archive: Uint8Array) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const localAt = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(archive.subarray(at + 46, at + 46 + nameLength));
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    const raw = archive.subarray(dataAt, dataAt + view.getUint32(at + 20, true));
    const data = method === 0 ? raw : new Uint8Array(inflateRawSync(raw));
    expect(data.length).toBe(size);
    expect(crc32(data)).toBe(crc);
    files[name] = data;
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return files;
}

describe("zip", () => {
  it("has the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes an archive that reads back, including UTF-8 names", () => {
    const files = { "pass.json": new TextEncoder().encode('{"a":1}'), "el.lproj/pass.strings": Uint8Array.of(0xff, 0xfe, 0x41, 0) };
    const archive = zip(Object.entries(files).map(([name, data]) => ({ name, data })));
    expect(unzip(archive)).toEqual(files);
  });

  it.skipIf(!hasOpenssl())("is accepted by the system unzip tool", () => {
    let unzipTool = true;
    try {
      execFileSync("unzip", ["-v"], { stdio: "ignore" });
    } catch {
      unzipTool = false;
    }
    if (!unzipTool) return;
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    writeFileSync(join(dir, "t.zip"), zip([{ name: "a.txt", data: new TextEncoder().encode("hello") }]));
    expect(execFileSync("unzip", ["-p", join(dir, "t.zip"), "a.txt"]).toString()).toBe("hello");
  });
});


const passInput = (over: Partial<ApplePassInput> = {}): ApplePassInput => ({
  passTypeId: "pass.com.example.card",
  teamId: "ABCDE12345",
  serial: "6f1c2d3e-0000-4000-8000-000000000001",
  authToken: "t".repeat(43),
  webServiceUrl: "https://card.example.com/api/apple-wallet",
  cafeName: "Coffee Pause Cyprus",
  origin: "https://card.example.com",
  theme: DEFAULT_THEME,
  card: { cardNumber: "6F1C", customerName: "Μαρία", stamps: 7, goal: 10, coupon: null },
  ...over,
});

const coupon = { code: "CP-7K4Q-29XM-HD3P-WR8N", checkUrl: "https://card.example.com/staff?code=CP-7K4Q-29XM-HD3P-WR8N", expiresAt: "2027-01-31T10:00:00.000Z" };

describe("Apple pass content", () => {
  it("is a store card with the stamps, the customer and the update service", () => {
    const { passJson } = buildApplePass(passInput());
    expect(passJson).toMatchObject({
      formatVersion: 1,
      passTypeIdentifier: "pass.com.example.card",
      teamIdentifier: "ABCDE12345",
      serialNumber: "6f1c2d3e-0000-4000-8000-000000000001",
      webServiceURL: "https://card.example.com/api/apple-wallet",
      authenticationToken: "t".repeat(43),
      backgroundColor: "rgb(58, 22, 9)",
      foregroundColor: "rgb(255, 255, 255)",
      sharingProhibited: true,
    });
    const card = (passJson as { storeCard: Record<string, { key: string; value: string; changeMessage?: string }[]> }).storeCard;
    expect(card.headerFields[0]).toMatchObject({ key: "stamps", label: "Stamps", value: "7/10" });
    expect(card.secondaryFields[0]).toMatchObject({ key: "reward", value: "At 10 stamps" });
    expect(card.secondaryFields[0].changeMessage).toBeUndefined();
    expect(card.auxiliaryFields.map((f) => f.value)).toEqual(["Μαρία", "6F1C"]);
    expect(passJson).not.toHaveProperty("barcodes");
  });

  it("with a coupon: the QR code, its expiry and a lock-screen message", () => {
    const { passJson, strings } = buildApplePass(passInput({ card: { ...passInput().card!, stamps: 0, coupon } }));
    expect(passJson).toMatchObject({
      barcodes: [{ format: "PKBarcodeFormatQR", message: coupon.checkUrl, messageEncoding: "iso-8859-1", altText: coupon.code }],
    });
    const card = (passJson as { storeCard: Record<string, { key: string; value: string; changeMessage?: string }[]> }).storeCard;
    expect(card.secondaryFields[0]).toMatchObject({ value: "Ready ☕", changeMessage: "Free coffee: %@" });
    expect(card.backFields.find((f) => f.key === "valid")).toMatchObject({ value: coupon.expiresAt, dateStyle: "PKDateStyleLong" });
    expect(strings.el.get("Free coffee: %@")).toBe("Δωρεάν καφές: %@");
    expect(strings.el.get("Ready ☕")).toBe("Έτοιμος ☕");
  });

  it("takes the theme's colours and greeting; notify adds a change message", () => {
    const christmas = activeTheme(
      [{ id: "t1", cafe_id: "c", name: "Christmas", background_color: "#f3e6d0", hero_image: "christmas", message_el: "Καλά Χριστούγεννα!",
         message_en: "Merry Christmas!", starts_on: "2000-12-01", ends_on: "2001-01-06", repeats_yearly: true, notify: true, active: true, created_at: "x" }],
      "2026-12-10",
    );
    const { passJson, strings } = buildApplePass(passInput({ theme: christmas }));
    expect(passJson).toMatchObject({ backgroundColor: "rgb(243, 230, 208)", foregroundColor: "rgb(44, 18, 9)" });
    const season = (passJson as { storeCard: { backFields: { key: string }[] } }).storeCard.backFields[0];
    expect(season).toMatchObject({ key: "season", value: "Merry Christmas!", changeMessage: "%@" });
    expect(strings.el.get("Merry Christmas!")).toBe("Καλά Χριστούγεννα!");
  });

  it("a deleted account's pass is voided and holds nothing personal", () => {
    const { passJson } = buildApplePass(passInput({ card: null }));
    expect(passJson).toMatchObject({ voided: true });
    expect(JSON.stringify(passJson)).not.toMatch(/Μαρία|6F1C|7\/10/);
  });

  it("writes pass.strings as UTF-16 with escapes", () => {
    const file = stringsFile(new Map([['Say "hi"', "Πες \"γεια\""]]));
    expect([...file.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    expect(Buffer.from(file.subarray(2)).toString("utf16le")).toBe('"Say \\"hi\\"" = "Πες \\"γεια\\"";\n');
  });
});

describe("Apple Wallet config", () => {
  const pem = (type: string) => `-----BEGIN ${type}-----\nAQID\n-----END ${type}-----`;
  const env = {
    APPLE_WALLET_PASS_TYPE_ID: "pass.com.coffeepause.card",
    APPLE_WALLET_TEAM_ID: "ABCDE12345",
    APPLE_WALLET_CERT: pem("CERTIFICATE"),
    APPLE_WALLET_KEY: pem("PRIVATE KEY"),
    APPLE_WALLET_WWDR: pem("CERTIFICATE"),
    APPLE_APNS_KEY_ID: "KEY1234567",
    APPLE_APNS_KEY: pem("PRIVATE KEY"),
  };

  it("is on only with every setting present and well-formed", () => {
    expect(parseAppleWalletConfig(env)).toMatchObject({ passTypeId: "pass.com.coffeepause.card", teamId: "ABCDE12345", apnsKeyId: "KEY1234567" });
    for (const name of Object.keys(env)) expect(parseAppleWalletConfig({ ...env, [name]: undefined }), name).toBeNull();
    expect(parseAppleWalletConfig({ ...env, APPLE_WALLET_PASS_TYPE_ID: "com.coffeepause.card" })).toBeNull();
    expect(parseAppleWalletConfig({ ...env, APPLE_WALLET_KEY: pem("ENCRYPTED PRIVATE KEY") })).toBeNull();
    expect(parseAppleWalletConfig({ ...env, APPLE_WALLET_KEY: pem("RSA PRIVATE KEY") })).not.toBeNull();
  });
});

describe.skipIf(!hasOpenssl())("the .pkpass file", () => {
  const chain = makeChain();
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("holds every file, a manifest of their SHA-1s, and a signature openssl accepts", async () => {
    const { passJson, strings } = buildApplePass(passInput({ card: { ...passInput().card!, coupon } }));
    const archive = await packPass(
      { passJson, strings, images: { "icon.png": png, "logo@2x.png": png, "strip@2x.png": png } },
      {
        certificate: pemBlocks(chain.cert, "CERTIFICATE")[0],
        chain: pemBlocks(chain.wwdr, "CERTIFICATE"),
        privateKey: await importRsaSigningKey(chain.key),
      },
    );
    const files = unzip(archive);
    expect(Object.keys(files).sort()).toEqual(
      ["el.lproj/pass.strings", "en.lproj/pass.strings", "icon.png", "logo@2x.png", "manifest.json", "pass.json", "signature", "strip@2x.png"],
    );
    expect(JSON.parse(new TextDecoder().decode(files["pass.json"]))).toEqual(passJson);
    const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as Record<string, string>;
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(files).filter((f) => f !== "manifest.json" && f !== "signature").sort());
    for (const [name, hash] of Object.entries(manifest)) expect(createHash("sha1").update(files[name]).digest("hex"), name).toBe(hash);

    writeFileSync(join(chain.dir, "manifest.json"), files["manifest.json"]);
    writeFileSync(join(chain.dir, "signature"), files["signature"]);
    expect(() =>
      chain.run("smime", "-verify", "-binary", "-inform", "DER", "-in", "signature", "-content", "manifest.json", "-CAfile", "root.pem", "-purpose", "any", "-out", "/dev/null"),
    ).not.toThrow();
  });

  it("knows a PNG", () => {
    expect(isPng(png)).toBe(true);
    expect(isPng(new TextEncoder().encode("<html>"))).toBe(false);
  });
});

describe("web service paths", () => {
  const type = "pass.com.example.card";
  const serial = "6f1c2d3e-0000-4000-8000-000000000001";

  it("reads every call Apple makes", () => {
    expect(parseServicePath("POST", ["devices", "abc123", "registrations", type, serial], type)).toEqual({ kind: "register", device: "abc123", serial });
    expect(parseServicePath("DELETE", ["devices", "abc123", "registrations", type, serial], type)).toEqual({ kind: "unregister", device: "abc123", serial });
    expect(parseServicePath("GET", ["devices", "abc123", "registrations", type], type)).toEqual({ kind: "list", device: "abc123" });
    expect(parseServicePath("GET", ["passes", type, serial], type)).toEqual({ kind: "pass", serial });
    expect(parseServicePath("POST", ["log"], type)).toEqual({ kind: "log" });
  });

  it("refuses another pass type, bad ids, wrong methods and extra parts", () => {
    expect(parseServicePath("GET", ["passes", "pass.other.app", serial], type)).toBeNull();
    expect(parseServicePath("GET", ["passes", type, "../etc"], type)).toBeNull();
    expect(parseServicePath("POST", ["devices", "a b", "registrations", type, serial], type)).toBeNull();
    expect(parseServicePath("GET", ["devices", "abc", "registrations", type, serial], type)).toBeNull();
    expect(parseServicePath("POST", ["passes", type, serial], type)).toBeNull();
    expect(parseServicePath("GET", ["passes", type, serial, "x"], type)).toBeNull();
    expect(parseServicePath("GET", [], type)).toBeNull();
  });
});

describe("update tags", () => {
  it("is just past the latest change, microseconds included", () => {
    const tag = nextUpdateTag(["2026-11-02T10:00:00.123456+00:00", "2026-11-02T09:00:00+00:00"]);
    expect(Number(tag)).toBe(Date.parse("2026-11-02T10:00:00.124Z"));
  });
});
