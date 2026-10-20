export const locales = ["el", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "el";
export const LOCALE_COOKIE = "cp_lang";

// BCP 47 tags used for date formatting.
export const intlLocale: Record<Locale, string> = {
  el: "el-GR",
  en: "en-GB",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Picks the first supported language from an Accept-Language header. */
export function matchAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
