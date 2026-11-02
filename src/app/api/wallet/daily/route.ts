import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { siteOrigin } from "@/lib/site";
import { isGoogleWalletEnabled, runDailyWalletJob } from "@/lib/wallet/google/sync";

/**
 * POST /api/wallet/daily   Authorization: Bearer <WALLET_CRON_SECRET>
 * Called once a day by .github/workflows/wallet-daily.yml: switches every
 * Google Wallet pass to today's theme and takes expired coupons off them.
 * Each call handles a batch; while the answer says "more": true, call again.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WALLET_CRON_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  // Compare digests, so the check takes the same time whatever was sent.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const sent = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(sent), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isGoogleWalletEnabled()) return NextResponse.json({ error: "wallet_off" }, { status: 503 });

  try {
    return NextResponse.json(await runDailyWalletJob(await siteOrigin()));
  } catch (error) {
    console.error("Google Wallet: daily job failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
