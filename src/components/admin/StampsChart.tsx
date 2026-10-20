import type { Translator } from "@/i18n/translate";
import { intlLocale, type Locale } from "@/i18n/config";

type Day = { day: string; stamps: number; redeemed: number };

/** A tidy y-axis maximum and its gridlines (e.g. 7 -> 8 with lines at 2, 4, 6, 8). */
function scale(max: number) {
  if (max <= 4) return { top: 4, ticks: [1, 2, 3, 4] };
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((s) => max / s <= 4) ?? Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: top / step }, (_, i) => (i + 1) * step) };
}

/**
 * Stamps per day: one series, so no legend; the title names it. Each bar has
 * a hover/focus tooltip, and the same numbers are available as a table.
 */
export function StampsChart({ t, days }: { t: Translator; days: Day[] }) {
  const locale = intlLocale[t.locale as Locale];
  const short = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
  const max = Math.max(0, ...days.map((d) => d.stamps));
  const { top, ticks } = scale(max);
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`);

  return (
    <figure className="rounded-[1.5rem] border border-line bg-crema/70 p-4 sm:p-5">
      <figcaption>
        <p className="font-display text-xl font-medium">{t("admin.chart.title")}</p>
        <p className="text-sm text-muted">{t("admin.chart.subtitle")}</p>
      </figcaption>

      {max === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t("admin.chart.empty")}</p>
      ) : (
        <div className="mt-7 grid grid-cols-[auto_1fr] gap-x-2">
          {/* y-axis labels */}
          <div aria-hidden className="relative h-40 w-6 text-right text-[0.7rem] text-muted tabular">
            {ticks.map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(v / top) * 100}%` }}>
                {v}
              </span>
            ))}
          </div>

          <div className="relative h-40">
            {/* recessive gridlines */}
            {ticks.map((v) => (
              <span key={v} aria-hidden className="absolute inset-x-0 border-t border-line/70" style={{ bottom: `${(v / top) * 100}%` }} />
            ))}
            <span aria-hidden className="absolute inset-x-0 bottom-0 border-t border-muted/50" />

            <ol className="absolute inset-0 flex items-end gap-[2px]">
              {days.map((d, i) => {
                // Keep tooltips inside the chart at both ends.
                const align = i < 4 ? "left-0" : i > days.length - 5 ? "right-0" : "left-1/2 -translate-x-1/2";
                const label = t.plural("admin.chart.tooltip", { count: d.stamps, date: long.format(fmt(d.day)) });
                return (
                  <li key={d.day} className="group relative flex h-full min-w-0 flex-1 items-end" tabIndex={0} aria-label={label}>
                    {/* hit target is the whole column, bigger than the bar */}
                    <span
                      className="w-full rounded-t-[4px] bg-chart transition-opacity group-hover:opacity-80 group-focus:opacity-80"
                      style={{ height: d.stamps ? `max(2px, ${(d.stamps / top) * 100}%)` : 0 }}
                    />
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute bottom-full ${align} z-10 mb-1.5 hidden rounded-lg bg-espresso px-2.5 py-1.5 text-xs whitespace-nowrap text-crema shadow-lg group-hover:block group-focus:block`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* x-axis: first, middle and last day */}
          <div />
          <div aria-hidden className="mt-1.5 flex justify-between text-[0.7rem] text-muted">
            {[days[0], days[Math.floor(days.length / 2)], days[days.length - 1]].map((d) => (
              <span key={d.day}>{short.format(fmt(d.day))}</span>
            ))}
          </div>
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-roast">{t("admin.chart.showTable")}</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left tabular">
            <thead className="sticky top-0 bg-foam text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">{t("admin.chart.day")}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t("admin.chart.stamps")}</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{t("admin.chart.redeemed")}</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line/70">
                  <th scope="row" className="px-3 py-1.5 font-normal">{long.format(fmt(d.day))}</th>
                  <td className="px-3 py-1.5 text-right">{d.stamps}</td>
                  <td className="px-3 py-1.5 text-right">{d.redeemed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
