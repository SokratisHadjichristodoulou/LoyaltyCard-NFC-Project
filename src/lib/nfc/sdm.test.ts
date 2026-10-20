import { describe, expect, it } from "vitest";
import { aesCmac, decryptPiccData, sdmMac, simulateSun, tagKeys, verifySun, verifyTap } from "./sdm";

const hex = (s: string) => Buffer.from(s, "hex");

describe("AES-CMAC (RFC 4493 test vectors)", () => {
  const key = hex("2b7e151628aed2a6abf7158809cf4f3c");
  it("empty message", () => {
    expect(aesCmac(key, Buffer.alloc(0)).toString("hex")).toBe("bb1d6929e95937287fa37d129b756746");
  });
  it("one block", () => {
    expect(aesCmac(key, hex("6bc1bee22e409f96e93d7e117393172a")).toString("hex")).toBe("070a16b46b4d4144f79bdd9dd04a287c");
  });
  it("40 bytes", () => {
    const m = hex("6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411");
    expect(aesCmac(key, m).toString("hex")).toBe("dfa66747de9ae63030ca32611497c827");
  });
  it("64 bytes", () => {
    const m = hex(
      "6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710",
    );
    expect(aesCmac(key, m).toString("hex")).toBe("51f0bebf7e3b9d92fc49741779363cfe");
  });
});

describe("NTAG 424 SUN (NXP AN12196 example, factory keys)", () => {
  const zero = Buffer.alloc(16);
  const e = "EF963FF7828658A599F3041510671E88";
  const c = "94EED9EE65337086";

  it("decrypts the PICC data to the UID and tap counter", () => {
    expect(decryptPiccData(zero, hex(e))).toEqual({ uid: "04DE5F1EACC040", counter: 61 });
  });
  it("computes the same MAC as the tag", () => {
    expect(sdmMac(zero, hex("04DE5F1EACC040"), 61).toString("hex").toUpperCase()).toBe(c);
  });
  it("accepts the genuine tap", () => {
    expect(verifySun(e, c, zero, () => zero)).toEqual({ ok: true, tap: { uid: "04DE5F1EACC040", counter: 61 } });
  });
  it("rejects a changed MAC", () => {
    expect(verifySun(e, "94EED9EE65337087", zero, () => zero)).toEqual({ ok: false, reason: "bad_mac" });
  });
  it("rejects changed PICC data", () => {
    expect(verifySun("EF963FF7828658A599F3041510671E89", c, zero, () => zero).ok).toBe(false);
  });
  it("rejects the right data with the wrong tag key", () => {
    expect(verifySun(e, c, zero, () => Buffer.alloc(16, 1))).toEqual({ ok: false, reason: "bad_mac" });
  });
  it("rejects malformed input", () => {
    expect(verifySun("zz", c, zero, () => zero)).toEqual({ ok: false, reason: "malformed" });
    expect(verifySun(e, undefined, zero, () => zero)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("keys derived from NFC_TAG_SECRET", () => {
  const secret = "test-secret-0123456789abcdef0123456789abcdef";

  it("are stable, 16 bytes, and different per tag except the shared meta read key", () => {
    const a = tagKeys(secret, "04A1B2C3D4E5F6");
    const b = tagKeys(secret, "04a1b2c3d4e5f6");
    const other = tagKeys(secret, "04FFFFFFFFFFFF");
    expect(a.sdmFileRead.equals(b.sdmFileRead)).toBe(true);
    expect(a.sdmFileRead).toHaveLength(16);
    expect(a.sdmFileRead.equals(other.sdmFileRead)).toBe(false);
    expect(a.appMaster.equals(other.appMaster)).toBe(false);
    expect(a.sdmMetaRead.equals(other.sdmMetaRead)).toBe(true);
    expect(new Set([a.appMaster, a.sdmMetaRead, a.sdmFileRead, a.key3, a.key4].map((k) => k.toString("hex"))).size).toBe(5);
  });

  it("a simulated tap from one tag verifies, and cannot be passed off as another tag", () => {
    const keys = tagKeys(secret, "04A1B2C3D4E5F6");
    const { e, c } = simulateSun(keys.sdmMetaRead, keys.sdmFileRead, "04A1B2C3D4E5F6", 1234);
    expect(verifyTap(secret, e, c)).toEqual({ ok: true, tap: { uid: "04A1B2C3D4E5F6", counter: 1234 } });
    const forged = simulateSun(keys.sdmMetaRead, keys.sdmFileRead, "04FFFFFFFFFFFF", 1234);
    expect(verifyTap(secret, forged.e, forged.c).ok).toBe(false);
    expect(verifyTap("another-secret-0123456789abcdef0123456789", e, c).ok).toBe(false);
  });

  it("refuses a short secret", () => {
    expect(() => tagKeys("short", "04A1B2C3D4E5F6")).toThrow();
  });
});
