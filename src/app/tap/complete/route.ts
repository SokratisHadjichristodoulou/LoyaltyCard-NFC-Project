import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { nfcTagSecret } from "@/lib/env";
import { PENDING_TAP_COOKIE, readPendingTap } from "@/lib/nfc/pending";
import { TAP_COMPLETE_PATH } from "@/lib/nfc/paths";
import { siteOrigin } from "@/lib/site";
import { outcomePath, stampCustomer } from "@/lib/stamping";

/** After signing in: turns the waiting tap into a stamp. */
export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const user = await getUser();
  const fromLink = request.nextUrl.searchParams.get("p") ?? undefined;
  if (!user) {
    const next = fromLink ? `${TAP_COMPLETE_PATH}?p=${fromLink}` : TAP_COMPLETE_PATH;
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`);
  }

  // The cookie from this browser, or (simple tags) the copy in the sign-in link.
  const secret = nfcTagSecret();
  const pending = secret
    ? readPendingTap(secret, (await cookies()).get(PENDING_TAP_COOKIE)?.value) ?? readPendingTap(secret, fromLink)
    : null;

  const response = NextResponse.redirect(
    pending
      ? origin + outcomePath(await stampCustomer(user.id, { tagId: pending.tagId, counter: pending.counter }))
      : `${origin}/tap/problem?r=expired`,
  );
  response.cookies.delete({ name: PENDING_TAP_COOKIE, path: "/tap" });
  return response;
}
