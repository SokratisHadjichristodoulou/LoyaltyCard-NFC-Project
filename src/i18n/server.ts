import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, matchAcceptLanguage, type Locale } from "./config";
import { createTranslator } from "./translate";

/**
 * Explicit choice (cookie set by the EL / EN toggle) wins, then the browser
 * language, then Greek.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return matchAcceptLanguage((await headers()).get("accept-language"));
}

export async function getT() {
  return createTranslator(await getLocale());
}
