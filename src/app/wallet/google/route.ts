import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isMockMode } from "@/lib/env";
import { siteOrigin } from "@/lib/site";
import { isGoogleWalletEnabled, saveToGoogleWalletUrl } from "@/lib/wallet/google/sync";

/**
 * GET /wallet/google
 * "Add to Google Wallet": creates or refreshes the customer's pass, then
 * sends them to Google to save it. Pressing it again is harmless.
 */
export async function GET() {
  const origin = await siteOrigin();
  if (isMockMode() || !isGoogleWalletEnabled()) return NextResponse.redirect(`${origin}/`);

  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/wallet/google")}`);

  try {
    return NextResponse.redirect(await saveToGoogleWalletUrl(origin, user.id));
  } catch (error) {
    console.error("Google Wallet: could not create the pass", error);
    return NextResponse.redirect(`${origin}/?wallet=error`);
  }
}
