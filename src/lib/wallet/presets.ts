// Ready-made themes the admin can start from. Pure, so it can be tested.

import type { BuiltinHero, Theme } from "./themes";

export type PresetId = "christmas" | "easter" | "summer" | "autumn" | "blank";

export type ThemePreset = {
  id: PresetId;
  background_color: string;
  hero_builtin: BuiltinHero;
  message_el: string;
  message_en: string;
  starts_on: string;
  ends_on: string;
  repeats_yearly: boolean;
  notify: boolean;
};

/** Orthodox Easter Sunday (Gregorian date, YYYY-MM-DD), valid 1900–2099. */
export function orthodoxEaster(year: number) {
  // Meeus' Julian algorithm, then +13 days from the Julian to the Gregorian calendar.
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return isoDate(new Date(Date.UTC(year, month - 1, day + 13)));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

/** The presets, with dates for the coming season counted from `today` (YYYY-MM-DD). */
export function themePresets(today: string): ThemePreset[] {
  const year = Number(today.slice(0, 4));
  // Easter: Holy Week to the Sunday after, for the next Easter that hasn't ended yet.
  let easter = orthodoxEaster(year);
  if (addDays(easter, 7) < today) easter = orthodoxEaster(year + 1);

  return [
    {
      id: "christmas",
      background_color: "#7d1d1d",
      hero_builtin: "christmas",
      message_el: "Καλά Χριστούγεννα από το Coffee Pause!",
      message_en: "Merry Christmas from Coffee Pause!",
      starts_on: `${year}-12-01`,
      ends_on: `${year + 1}-01-06`,
      repeats_yearly: true,
      notify: true,
    },
    {
      id: "easter",
      background_color: "#4f5d3a",
      hero_builtin: "easter",
      message_el: "Καλό Πάσχα!",
      message_en: "Happy Easter!",
      starts_on: addDays(easter, -7),
      ends_on: addDays(easter, 7),
      repeats_yearly: false,
      notify: true,
    },
    {
      id: "summer",
      background_color: "#1f5f73",
      hero_builtin: "summer",
      message_el: "Καλό καλοκαίρι! Ο freddo σου σε περιμένει.",
      message_en: "Happy summer! Your freddo is waiting.",
      starts_on: `${year}-06-15`,
      ends_on: `${year}-08-31`,
      repeats_yearly: true,
      notify: false,
    },
    {
      id: "autumn",
      background_color: "#6e3412",
      hero_builtin: "autumn",
      message_el: "Καλό φθινόπωρο!",
      message_en: "Happy autumn!",
      starts_on: `${year}-10-01`,
      ends_on: `${year}-11-15`,
      repeats_yearly: true,
      notify: false,
    },
    {
      id: "blank",
      background_color: "#3a1609",
      hero_builtin: "default",
      message_el: "",
      message_en: "",
      starts_on: today,
      ends_on: addDays(today, 14),
      repeats_yearly: false,
      notify: false,
    },
  ];
}

/** A preset shown as if it were on (for the mock-data preview). */
export function presetAsTheme(preset: ThemePreset): Theme {
  return {
    key: `preset:${preset.id}`,
    name: preset.id,
    backgroundColor: preset.background_color,
    heroImage: preset.hero_builtin,
    message: { el: preset.message_el || null, en: preset.message_en || null },
    notify: false,
    id: `preset:${preset.id}`,
    startedOn: preset.starts_on,
  };
}
