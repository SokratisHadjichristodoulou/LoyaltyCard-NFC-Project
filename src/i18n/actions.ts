"use server";

import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, isLocale } from "./config";

/** Saves the language choice in a cookie and, when signed in, on the profile. */
export async function setLanguage(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const user = await getUser();
  if (user) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ preferred_language: locale }).eq("id", user.id);
  }
}
