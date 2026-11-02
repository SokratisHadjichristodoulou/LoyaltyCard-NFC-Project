// Seasonal themes for the wallet pass (and the banner on the card page).
// Pure functions, no server-only imports, so they can be unit-tested.

import type { WalletThemeRow } from "@/lib/supabase/types";

/** Banners that ship with the site, in public/wallet/heroes/<name>.png. */
export const BUILTIN_HEROES = ["default", "christmas", "easter", "summer", "autumn"] as const;
export type BuiltinHero = (typeof BUILTIN_HEROES)[number];

export type Theme = {
  /** Changes whenever a different theme (or a new run of the same one) starts. */
  key: string;
  name: string;
  backgroundColor: string;
  /** A built-in banner name or an https address. */
  heroImage: string;
  message: { el: string | null; en: string | null };
  notify: boolean;
  /** The theme's own row; null for the built-in default look. */
  id: string | null;
  /** First day of the current run (YYYY-MM-DD); null for the default look. */
  startedOn: string | null;
};

/** The everyday look, used whenever no seasonal theme is on. */
export const DEFAULT_THEME: Theme = {
  key: "default",
  name: "Coffee Pause",
  backgroundColor: "#3a1609",
  heroImage: "default",
  message: { el: null, en: null },
  notify: false,
  id: null,
  startedOn: null,
};

export function isBuiltinHero(value: string): value is BuiltinHero {
  return (BUILTIN_HEROES as readonly string[]).includes(value);
}

/** Where Google (and the card page) loads a theme's banner from. */
export function heroImageUrl(hero: string, origin: string) {
  return hero.startsWith("https://") ? hero : `${origin}/wallet/heroes/${isBuiltinHero(hero) ? hero : "default"}.png`;
}

/** Today's date in Cyprus, YYYY-MM-DD. */
export function cyprusToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Nicosia", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * If the theme is on today, the first day of its current run (YYYY-MM-DD);
 * otherwise null. Yearly themes compare only day and month, and may cross New
 * Year (1 Dec to 6 Jan).
 */
export function currentRunStart(
  theme: Pick<WalletThemeRow, "starts_on" | "ends_on" | "repeats_yearly">,
  today: string,
): string | null {
  if (!theme.repeats_yearly) {
    return theme.starts_on <= today && today <= theme.ends_on ? theme.starts_on : null;
  }
  const start = theme.starts_on.slice(5); // "MM-DD"
  const end = theme.ends_on.slice(5);
  const day = today.slice(5);
  const year = Number(today.slice(0, 4));
  if (start <= end) return start <= day && day <= end ? `${year}-${start}` : null;
  if (day >= start) return `${year}-${start}`;
  if (day <= end) return `${year - 1}-${start}`;
  return null;
}

/**
 * The theme that is on today. When several are on, the one that started most
 * recently wins (so a short theme inside a longer one shows), then the newest.
 */
export function activeTheme(themes: WalletThemeRow[], today: string): Theme {
  let best: { row: WalletThemeRow; start: string } | null = null;
  for (const row of themes) {
    if (!row.active) continue;
    const start = currentRunStart(row, today);
    if (!start) continue;
    if (!best || start > best.start || (start === best.start && row.created_at > best.row.created_at)) {
      best = { row, start };
    }
  }
  if (!best) return DEFAULT_THEME;
  const { row, start } = best;
  return {
    key: `${row.id}:${start}`,
    name: row.name,
    backgroundColor: row.background_color,
    heroImage: row.hero_image,
    message: { el: row.message_el || null, en: row.message_en || null },
    notify: row.notify,
    id: row.id,
    startedOn: start,
  };
}

/** White or dark text, whichever reads better on the theme colour (like Google does on the pass). */
export function textColorOn(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Contrast against white vs against the dark text colour (#2c1209, luminance ~0.012).
  return (1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.062) ? "#ffffff" : "#2c1209";
}
