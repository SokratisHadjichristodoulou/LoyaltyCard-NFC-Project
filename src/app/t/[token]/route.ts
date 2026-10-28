import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { nfcTagSecret } from "@/lib/env";
import { PENDING_TAP_COOKIE, PENDING_TAP_MINUTES, signPendingTap } from "@/lib/nfc/pending";
import { TAP_COMPLETE_PATH } from "@/lib/nfc/paths";
import { siteOrigin } from "@/lib/site";
import { outcomePath, siteCafe, stampCustomer } from "@/lib/stamping";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /t/<token>
 * Opened when a simple tag (a fixed link written with any NFC app) is
 * tapped. The link never changes, so record_simple_stamp allows one stamp
 * per customer per day. Secure tags use /tap instead.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const origin = await siteOrigin();
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return NextResponse.redirect(`${origin}/tap/problem?r=invalid`);

  const { data: tag, error } = await createAdminClient()
    .from("tags")
    .select("id, cafe_id, active")
    .eq("simple_token", token)
    .maybeSingle();
  if (error) throw error;
  const cafe = await siteCafe();
  if (!tag || tag.cafe_id !== cafe.id) return NextResponse.redirect(`${origin}/tap/problem?r=unknown_tag`);
  if (!tag.active) return NextResponse.redirect(`${origin}/tap/problem?r=inactive`);

  const user = await getUser();
  if (user) {
    const outcome = await stampCustomer(user.id, { tagId: tag.id, counter: null });
    return NextResponse.redirect(origin + outcomePath(outcome));
  }

  // Signed out: keep the tap for a few minutes while they sign in. It goes in
  // a cookie and also in the sign-in link, so it survives the email opening
  // in another browser (e.g. inside the Gmail app). Reusing it can't give more
  // than the tag's own link already does: one stamp per day.
  const secret = nfcTagSecret();
  if (!secret) return NextResponse.redirect(`${origin}/tap/problem?r=not_configured`);
  const pending = signPendingTap(secret, { tagId: tag.id, counter: null, expiresAt: Date.now() + PENDING_TAP_MINUTES * 60_000 });
  const next = `${TAP_COMPLETE_PATH}?p=${pending}`;
  const response = NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`);
  response.cookies.set(
    PENDING_TAP_COOKIE,
    pending,
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
