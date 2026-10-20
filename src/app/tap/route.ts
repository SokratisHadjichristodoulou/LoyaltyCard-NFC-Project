import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { nfcTagSecret } from "@/lib/env";
import { PENDING_TAP_COOKIE, PENDING_TAP_MINUTES, signPendingTap } from "@/lib/nfc/pending";
import { TAP_COMPLETE_PATH } from "@/lib/nfc/paths";
import { checkTap } from "@/lib/nfc/tap";
import { siteOrigin } from "@/lib/site";
import { outcomePath, stampCustomer } from "@/lib/stamping";

/**
 * GET /tap?e=<encrypted PICC data>&c=<SDM MAC>
 * Opened on the customer's phone when the barista taps an NTAG 424 tag.
 */
export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const params = request.nextUrl.searchParams;
  const check = await checkTap(params.get("e"), params.get("c"));
  if (!check.ok) return NextResponse.redirect(`${origin}/tap/problem?r=${check.problem}`);

  const user = await getUser();
  if (user) {
    const outcome = await stampCustomer(user.id, { tagId: check.tagId, counter: check.counter });
    return NextResponse.redirect(origin + outcomePath(outcome));
  }

  // Signed out: keep the verified tap for a few minutes while they sign in.
  const response = NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(TAP_COMPLETE_PATH)}`);
  response.cookies.set(
    PENDING_TAP_COOKIE,
    signPendingTap(nfcTagSecret()!, {
      tagId: check.tagId,
      counter: check.counter,
      expiresAt: Date.now() + PENDING_TAP_MINUTES * 60_000,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/tap",
      maxAge: PENDING_TAP_MINUTES * 60,
    },
  );
  return response;
}
