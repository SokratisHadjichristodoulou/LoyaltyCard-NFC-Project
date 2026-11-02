import { generateKeyPairSync, verify } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppleWalletConfig } from "./config";

vi.mock("server-only", () => ({}));
const { providerToken, pushPassUpdate } = await import("./apns");

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const config: AppleWalletConfig = {
  passTypeId: "pass.com.example.card",
  teamId: "ABCDE12345",
  certificate: new Uint8Array(),
  keyPem: "",
  chain: [],
  apnsKeyId: "KEY1234567",
  apnsKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const TOKEN = "a".repeat(64);

afterEach(() => vi.unstubAllGlobals());

function stubApns(status: number, body: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 200 ? null : JSON.stringify(body), { status });
  });
  return calls;
}

describe("APNs", () => {
  it("signs an ES256 provider token a standard verifier accepts, and reuses it", async () => {
    const now = Date.UTC(2026, 10, 2);
    const token = await providerToken(config, now);
    const [header, claims, signature] = token.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({ iss: "ABCDE12345", iat: now / 1000 });
    const ok = verify("sha256", Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);
    expect(await providerToken(config, now + 49 * 60_000)).toBe(token);
    expect(await providerToken(config, now + 51 * 60_000)).not.toBe(token);
  });

  it("sends an empty push with the pass type as topic", async () => {
    const calls = stubApns(200);
    expect(await pushPassUpdate(config, TOKEN)).toBe("sent");
    expect(calls[0].url).toBe(`https://api.push.apple.com/3/device/${TOKEN}`);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["apns-topic"]).toBe("pass.com.example.card");
    expect(headers.authorization).toMatch(/^bearer ey/);
    expect(calls[0].init.body).toBe("{}");
  });

  it("says when the phone no longer has the pass", async () => {
    stubApns(410, { reason: "Unregistered" });
    expect(await pushPassUpdate(config, TOKEN)).toBe("gone");
    stubApns(400, { reason: "BadDeviceToken" });
    expect(await pushPassUpdate(config, TOKEN)).toBe("gone");
    expect(await pushPassUpdate(config, "not-a-token")).toBe("gone");
  });

  it("reports other failures without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubApns(403, { reason: "InvalidProviderToken" });
    expect(await pushPassUpdate(config, TOKEN)).toBe("failed");
  });
});
