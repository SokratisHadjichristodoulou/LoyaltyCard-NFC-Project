import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { nfcTagSecret } from "@/lib/env";
import { PENDING_TAP_COOKIE, readPendingTap } from "@/lib/nfc/pending";
import { TAP_COMPLETE_PATH } from "@/lib/nfc/paths";
import { siteOrigin } from "@/lib/site";
import { outcomePath, stampCustomer } from "@/lib/stamping";

/** After signing in: turns the waiting tap into a stamp, once. */
export async function GET() {
  const origin = await siteOrigin();
  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(TAP_COMPLETE_PATH)}`);

  const secret = nfcTagSecret();
  const pending = secret ? readPendingTap(secret, (await cookies()).get(PENDING_TAP_COOKIE)?.value) : null;

  const response = NextResponse.redirect(
    pending
      ? origin + outcomePath(await stampCustomer(user.id, { tagId: pending.tagId, counter: pending.counter }))
      : `${origin}/tap/problem?r=expired`,
  );
  response.cookies.delete({ name: PENDING_TAP_COOKIE, path: "/tap" });
  return response;
}
