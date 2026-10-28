"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/i18n/server";
import { LOGIN_EMAIL_COOKIE } from "./constants";

export type LoginError = "invalid_email" | "rate_limited" | "send_failed" | "not_configured";
export type LoginState = { error?: LoginError; email?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!isSupabaseConfigured()) return { error: "not_configured", email };
  if (email.length > 254 || !EMAIL.test(email)) return { error: "invalid_email", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
      // Read once, by the signup trigger, to set the profile language.
      data: { preferred_language: await getLocale() },
    },
  });

  if (error) {
    const rateLimited = error.status === 429 || error.code === "over_email_send_rate_limit";
    return { error: rateLimited ? "rate_limited" : "send_failed", email };
  }

  // Shown on the next screen; kept out of the URL.
  (await cookies()).set(LOGIN_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 15,
    path: "/login",
  });
  redirect(`/login/check-email?next=${encodeURIComponent(next)}`);
}

export type CodeState = { error?: "code_invalid" | "code_expired_session"; redirectTo?: string };

/**
 * Signs in with the 6-digit code from the email, in this same browser. This
 * keeps the session where the customer tapped the tag, even when their email
 * app would open the link in a browser of its own.
 */
export async function verifyCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  const next = safeNext(String(formData.get("next") ?? ""));
  const email = (await cookies()).get(LOGIN_EMAIL_COOKIE)?.value;
  if (!email || !isSupabaseConfigured()) return { error: "code_expired_session" };
  if (!/^\d{6,10}$/.test(token)) return { error: "code_invalid" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: "code_invalid" };
  // A full page load (not a client-side redirect), so a route like
  // /tap/complete runs and the address bar ends on the card.
  return { redirectTo: next };
}
