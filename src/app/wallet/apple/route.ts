import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isMockMode } from "@/lib/env";
import { siteOrigin } from "@/lib/site";
import { applePassForCustomer, isAppleWalletEnabled } from "@/lib/wallet/apple/sync";

/**
 * GET /wallet/apple
 * "Add to Apple Wallet": the customer's signed .pkpass. Safari opens it in
 * the Wallet "Add" sheet. Downloading it again gives the same pass.
 */
export async function GET() {
  const origin = await siteOrigin();
  if (isMockMode() || !isAppleWalletEnabled()) return NextResponse.redirect(`${origin}/`);

  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent("/wallet/apple")}`);

  try {
    const pass = await applePassForCustomer(origin, user.id);
    return new NextResponse(pass, {
      headers: {
        "content-type": "application/vnd.apple.pkpass",
        "content-disposition": 'attachment; filename="coffee-pause.pkpass"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Apple Wallet: could not make the pass", error);
    return NextResponse.redirect(`${origin}/?wallet=apple-error`);
  }
}
