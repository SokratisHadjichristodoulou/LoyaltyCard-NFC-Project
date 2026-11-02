import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { WalletThemeRow } from "@/lib/supabase/types";
import { classIdFor, objectIdFor, parseGoogleWalletConfig } from "./google/config";
import { base64url, importPrivateKey, signJwt } from "./google/jwt";
import { buildLoyaltyClass, buildLoyaltyObject, saveLinkClaims, themeMessage } from "./google/pass";
import { orthodoxEaster, themePresets } from "./presets";
import { activeTheme, cardPalette, currentRunStart, cyprusToday, DEFAULT_THEME, heroImageUrl, textColorOn } from "./themes";

const theme = (over: Partial<WalletThemeRow>): WalletThemeRow => ({
  id: "t1",
  cafe_id: "c1",
  name: "Christmas",
  background_color: "#7a1f1f",
  hero_image: "christmas",
  message_el: "Καλά Χριστούγεννα!",
  message_en: "Merry Christmas!",
  starts_on: "2000-12-01",
  ends_on: "2001-01-06",
  repeats_yearly: true,
  notify: true,
  active: true,
  created_at: "2026-11-01T10:00:00Z",
  ...over,
});

describe("themes", () => {
  it("a yearly theme across New Year is on in December and early January", () => {
    const t = theme({});
    expect(currentRunStart(t, "2026-11-30")).toBeNull();
    expect(currentRunStart(t, "2026-12-01")).toBe("2026-12-01");
    expect(currentRunStart(t, "2026-12-31")).toBe("2026-12-01");
    expect(currentRunStart(t, "2027-01-06")).toBe("2026-12-01");
    expect(currentRunStart(t, "2027-01-07")).toBeNull();
  });

  it("a yearly theme within one year ignores the stored year", () => {
    const t = theme({ starts_on: "2000-06-01", ends_on: "2000-08-31" });
    expect(currentRunStart(t, "2031-07-15")).toBe("2031-06-01");
    expect(currentRunStart(t, "2031-09-01")).toBeNull();
  });

  it("a one-off theme only runs on its own dates", () => {
    const t = theme({ starts_on: "2027-04-25", ends_on: "2027-05-03", repeats_yearly: false });
    expect(currentRunStart(t, "2027-04-30")).toBe("2027-04-25");
    expect(currentRunStart(t, "2028-04-30")).toBeNull();
  });

  it("uses the everyday look when no theme is on, or the theme is switched off", () => {
    expect(activeTheme([], "2026-12-10")).toEqual(DEFAULT_THEME);
    expect(activeTheme([theme({ active: false })], "2026-12-10")).toEqual(DEFAULT_THEME);
    expect(activeTheme([theme({})], "2026-07-10")).toEqual(DEFAULT_THEME);
  });

  it("the theme that started most recently wins, and each run has its own key", () => {
    const winter = theme({ id: "winter", starts_on: "2000-12-01", ends_on: "2001-02-28" });
    const newYear = theme({ id: "newyear", name: "New Year", starts_on: "2000-12-30", ends_on: "2001-01-02" });
    expect(activeTheme([winter, newYear], "2026-12-20").id).toBe("winter");
    expect(activeTheme([winter, newYear], "2026-12-31").id).toBe("newyear");
    expect(activeTheme([winter, newYear], "2027-01-02").key).toBe("newyear:2026-12-30");
    expect(activeTheme([winter, newYear], "2027-12-31").key).toBe("newyear:2027-12-30");
  });

  it("finds banners: built-in names on this site, https addresses as they are", () => {
    expect(heroImageUrl("christmas", "https://card.example.com")).toBe("https://card.example.com/wallet/heroes/christmas.png");
    expect(heroImageUrl("https://cdn.example.com/x.png", "https://card.example.com")).toBe("https://cdn.example.com/x.png");
    expect(heroImageUrl("unknown", "https://card.example.com")).toBe("https://card.example.com/wallet/heroes/default.png");
  });

  it("today is counted in Cyprus time", () => {
    expect(cyprusToday(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
    expect(cyprusToday(new Date("2026-12-31T21:30:00Z"))).toBe("2026-12-31");
  });
});

describe("config", () => {
  const key = JSON.stringify({ client_email: "wallet@project.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" });

  it("is off unless both settings are there and valid", () => {
    expect(parseGoogleWalletConfig(undefined, key)).toBeNull();
    expect(parseGoogleWalletConfig("3388000000012345678", undefined)).toBeNull();
    expect(parseGoogleWalletConfig("not-a-number", key)).toBeNull();
    expect(parseGoogleWalletConfig("3388000000012345678", "{not json")).toBeNull();
    expect(parseGoogleWalletConfig("3388000000012345678", JSON.stringify({ client_email: "x" }))).toBeNull();
  });

  it("reads the issuer and the service account key file", () => {
    expect(parseGoogleWalletConfig(" 3388000000012345678 ", key)).toMatchObject({
      issuerId: "3388000000012345678",
      email: "wallet@project.iam.gserviceaccount.com",
    });
  });

  it("makes ids Google accepts", () => {
    expect(classIdFor("338", "coffee-pause-cyprus")).toBe("338.coffee-pause-cyprus");
    expect(classIdFor("338", "café pause")).toBe("338.caf--pause");
    expect(objectIdFor("338", "6f1c2d3e-0000-4000-8000-000000000001")).toBe("338.card-6f1c2d3e-0000-4000-8000-000000000001");
  });
});

describe("jwt", () => {
  it("base64url has no padding or unsafe characters", () => {
    expect(base64url(new Uint8Array([251, 255, 191]))).toBe("-_-_");
    expect(base64url("a")).toBe("YQ");
  });

  it("signs RS256 tokens a standard verifier accepts (key with escaped newlines too)", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    for (const variant of [pem, pem.replace(/\n/g, "\\n")]) {
      const jwt = await signJwt({ iss: "me", n: 1 }, await importPrivateKey(variant));
      const [header, payload, signature] = jwt.split(".");
      expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
      expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({ iss: "me", n: 1 });
      const ok = verify("sha256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"));
      expect(ok).toBe(true);
    }
  });
});

describe("pass", () => {
  const origin = "https://card.example.com";
  const base = {
    objectId: "338.card-1",
    classId: "338.coffee-pause-cyprus",
    cardNumber: "6F1C",
    customerName: "Μαρία",
    stamps: 7,
    goal: 10,
    coupon: null,
    origin,
  };

  it("shows the stamps, name and card number, and no QR code without a coupon", () => {
    const object = buildLoyaltyObject(base);
    expect(object).toMatchObject({ id: "338.card-1", classId: "338.coffee-pause-cyprus", state: "ACTIVE", accountId: "6F1C", accountName: "Μαρία" });
    expect(object.loyaltyPoints.balance).toEqual({ string: "7/10" });
    expect(object.loyaltyPoints.localizedLabel.translatedValues).toEqual([{ language: "el", value: "Σφραγίδες" }]);
    expect(object).not.toHaveProperty("barcode");
    expect(object.messages).toEqual([]);
  });

  it("leaves the name out when the customer has none", () => {
    expect(buildLoyaltyObject({ ...base, customerName: null })).not.toHaveProperty("accountName");
  });

  it("shows a usable coupon as the staff page's QR code, with its expiry", () => {
    const coupon = { code: "CP-7K4Q-29XM-HD3P-WR8N", checkUrl: `${origin}/staff?code=CP-7K4Q-29XM-HD3P-WR8N`, expiresAt: "2027-01-31T10:00:00Z" };
    const object = buildLoyaltyObject({ ...base, stamps: 0, coupon });
    expect(object.barcode).toEqual({ type: "QR_CODE", value: coupon.checkUrl, alternateText: coupon.code });
    expect(object.textModulesData?.[0].body).toBe("Show the QR code at the counter. Valid until 31 January 2027.");
    expect(object.textModulesData?.[0].localizedBody.translatedValues[0].value).toContain("31 Ιανουαρίου 2027");
    expect(object.messages).toMatchObject([{ id: "coupon-CP-7K4Q-29XM-HD3P-WR8N", messageType: "TEXT" }]);
    // When the coupon is new, its message is sent separately (with a notification).
    expect(buildLoyaltyObject({ ...base, coupon }, { couponMessageType: null }).messages).toEqual([]);
  });

  it("the class carries the theme's colour, banner and greeting", () => {
    const christmas = activeTheme([theme({})], "2026-12-10");
    const cls = buildLoyaltyClass({ classId: "338.cp", cafeName: "Coffee Pause Cyprus", stampsRequired: 10, theme: christmas, origin });
    expect(cls).toMatchObject({
      id: "338.cp",
      issuerName: "Coffee Pause Cyprus",
      hexBackgroundColor: "#7a1f1f",
      reviewStatus: "UNDER_REVIEW",
      programLogo: { sourceUri: { uri: `${origin}/wallet/logo.png` } },
      heroImage: { sourceUri: { uri: `${origin}/wallet/heroes/christmas.png` } },
    });
    expect(cls.textModulesData.map((m) => m.id)).toEqual(["theme", "rule"]);
    expect(cls.textModulesData[0].localizedBody.translatedValues[0].value).toBe("Καλά Χριστούγεννα!");
    expect(cls.textModulesData[1].body).toBe("1 stamp for every coffee. At 10 stamps, your next coffee is on us.");

    const everyday = buildLoyaltyClass({ classId: "338.cp", cafeName: "Coffee Pause Cyprus", stampsRequired: 10, theme: DEFAULT_THEME, origin });
    expect(everyday.textModulesData.map((m) => m.id)).toEqual(["rule"]);
    expect(everyday.heroImage.sourceUri.uri).toBe(`${origin}/wallet/heroes/default.png`);
  });

  it("the theme notification uses the greeting, or the cafe's name without one", () => {
    const christmas = activeTheme([theme({})], "2026-12-10");
    expect(themeMessage(christmas, "Coffee Pause Cyprus")).toMatchObject({
      header: "Merry Christmas!",
      messageType: "TEXT_AND_NOTIFY",
      id: "theme-t1-2026-12-01",
    });
    const plain = activeTheme([theme({ message_el: null, message_en: null })], "2026-12-10");
    expect(themeMessage(plain, "Coffee Pause Cyprus").header).toBe("From Coffee Pause Cyprus");
  });

  it("the save link names only the existing pass", () => {
    expect(saveLinkClaims({ email: "sa@x", origin, objectId: "338.card-1", classId: "338.cp", now: 1_700_000_000_000 })).toEqual({
      iss: "sa@x",
      aud: "google",
      typ: "savetowallet",
      iat: 1_700_000_000,
      origins: [origin],
      payload: { loyaltyObjects: [{ id: "338.card-1", classId: "338.cp" }] },
    });
  });
});

describe("presets", () => {
  it("knows Orthodox Easter", () => {
    expect(orthodoxEaster(2025)).toBe("2025-04-20");
    expect(orthodoxEaster(2026)).toBe("2026-04-12");
    expect(orthodoxEaster(2027)).toBe("2027-05-02");
    expect(orthodoxEaster(2028)).toBe("2028-04-16");
  });

  it("offers the coming Easter, a week either side", () => {
    const easter = (today: string) => themePresets(today).find((p) => p.id === "easter")!;
    expect(easter("2026-11-02")).toMatchObject({ starts_on: "2027-04-25", ends_on: "2027-05-09", repeats_yearly: false });
    expect(easter("2027-05-05")).toMatchObject({ starts_on: "2027-04-25", ends_on: "2027-05-09" });
  });

  it("every preset is a valid theme", () => {
    for (const p of themePresets("2026-11-02")) {
      expect(p.background_color).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.repeats_yearly || p.ends_on >= p.starts_on).toBe(true);
    }
  });
});

describe("text colour", () => {
  it("is white on dark colours and dark on light ones", () => {
    expect(textColorOn("#3a1609")).toBe("#ffffff");
    expect(textColorOn("#7d1d1d")).toBe("#ffffff");
    expect(textColorOn("#f3e6d0")).toBe("#2c1209");
    expect(textColorOn("#ffcc00")).toBe("#2c1209");
  });
});

describe("card palette", () => {
  it("lightens the ink and lines on a dark theme", () => {
    const p = cardPalette("#7d1d1d");
    expect(p["--color-crema"]).toBe("#7d1d1d");
    expect(p["--color-espresso"]).toBe("#fbf6ec");
    expect(p["--color-ink"]).toBe("#f3e6d0");
  });

  it("keeps the usual dark ink on a light theme", () => {
    const p = cardPalette("#f3e6d0");
    expect(p["--color-crema"]).toBe("#f3e6d0");
    expect(p).not.toHaveProperty("--color-espresso");
    expect(p).not.toHaveProperty("--color-ink");
  });
});
