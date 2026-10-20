import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";

/**
 * Where the magic link lands. Handles both link styles Supabase can send:
 *   ?code=...                    (PKCE; same browser that asked for the link)
 *   ?token_hash=...&type=email   (works on any device; see README, email template)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = await siteOrigin();
  const next = safeNext(params.get("next"));
  const fail = () => NextResponse.redirect(`${origin}/login?error=link_invalid`);

  if (!isSupabaseConfigured()) return fail();

  const supabase = await createClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };
  if (error) return fail();

  // Use the language saved on the profile unless this browser already chose one.
  const cookieStore = await cookies();
  if (!cookieStore.get(LOCALE_COOKIE)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("preferred_language").eq("id", user.id).single()
      : { data: null };
    if (profile && isLocale(profile.preferred_language)) {
      cookieStore.set(LOCALE_COOKIE, profile.preferred_language, { path: "/", maxAge: 31536000, sameSite: "lax" });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
