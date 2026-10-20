import { describe, expect, it } from "vitest";
import { readPendingTap, signPendingTap } from "./pending";

const secret = "test-secret-0123456789abcdef0123456789abcdef";
const tap = { tagId: "tag-1", counter: 42, expiresAt: 2_000_000 };

describe("pending tap cookie", () => {
  it("round-trips before it expires", () => {
    expect(readPendingTap(secret, signPendingTap(secret, tap), 1_000_000)).toEqual(tap);
  });
  it("is refused after it expires", () => {
    expect(readPendingTap(secret, signPendingTap(secret, tap), 2_000_001)).toBeNull();
  });
  it("is refused when edited", () => {
    const [, sig] = signPendingTap(secret, tap).split(".");
    const edited = Buffer.from(JSON.stringify(["tag-1", 43, 2_000_000])).toString("base64url");
    expect(readPendingTap(secret, `${edited}.${sig}`, 1_000_000)).toBeNull();
  });
  it("is refused with another secret, or when missing or garbled", () => {
    expect(readPendingTap("other-secret-0123456789abcdef0123456789abcd", signPendingTap(secret, tap), 1_000_000)).toBeNull();
    expect(readPendingTap(secret, undefined)).toBeNull();
    expect(readPendingTap(secret, "nonsense")).toBeNull();
    expect(readPendingTap(secret, "a.b")).toBeNull();
  });
});
