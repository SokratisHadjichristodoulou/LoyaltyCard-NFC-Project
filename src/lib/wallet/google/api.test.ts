import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { googleWallet, GoogleWalletError } = await import("./api");

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = {
  issuerId: "3388000000012345678",
  email: "wallet@project.iam.gserviceaccount.com",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};

type Call = { url: string; method: string; body?: string; auth?: string };

/** Stubs fetch: the token endpoint always works; API answers come from `answers` in order. */
function stubGoogle(answers: { status: number; body?: unknown }[]) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    calls.push({ url, method: init.method ?? "GET", body: init.body?.toString(), auth: headers?.authorization });
    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({ access_token: "token-1", expires_in: 3600 });
    }
    const answer = answers.shift() ?? { status: 200, body: {} };
    return Response.json(answer.body ?? {}, { status: answer.status });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("Google Wallet API client", () => {
  it("gets a token with a signed service-account assertion, then updates the object", async () => {
    const calls = stubGoogle([{ status: 200 }]);
    await googleWallet.upsertObject(config, { id: "338.card-1" });

    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    const form = new URLSearchParams(calls[0].body);
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    const claims = JSON.parse(Buffer.from(form.get("assertion")!.split(".")[1], "base64url").toString());
    expect(claims).toMatchObject({
      iss: config.email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
    });

    expect(calls[1]).toMatchObject({
      method: "PUT",
      url: "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/338.card-1",
      auth: "Bearer token-1",
    });
  });

  it("reuses the token, and creates the object when it doesn't exist yet", async () => {
    const calls = stubGoogle([{ status: 404, body: { error: { message: "not found" } } }, { status: 200 }]);
    await googleWallet.upsertObject(config, { id: "338.card-2" });
    expect(calls.map((c) => `${c.method} ${c.url.replace("https://walletobjects.googleapis.com/walletobjects/v1", "")}`)).toEqual([
      "PUT /loyaltyObject/338.card-2",
      "POST /loyaltyObject",
    ]);
    expect(JSON.parse(calls[1].body!)).toEqual({ id: "338.card-2" });
  });

  it("reports Google's error message and status", async () => {
    stubGoogle([{ status: 400, body: { error: { message: "Invalid hexBackgroundColor" } } }]);
    const failure = googleWallet.upsertClass(config, { id: "338.cp" });
    await expect(failure).rejects.toBeInstanceOf(GoogleWalletError);
    await expect(failure).rejects.toMatchObject({
      status: 400,
      message: "Google Wallet 400: Invalid hexBackgroundColor",
    });
  });

  it("adds a message with the request shape Google expects", async () => {
    const calls = stubGoogle([{ status: 200 }]);
    await googleWallet.addObjectMessage(config, "338.card-1", { id: "m1", messageType: "TEXT_AND_NOTIFY" });
    expect(calls[0].url).toBe("https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/338.card-1/addMessage");
    expect(JSON.parse(calls[0].body!)).toEqual({ message: { id: "m1", messageType: "TEXT_AND_NOTIFY" } });
  });
});
