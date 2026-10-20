import type { Translator } from "@/i18n/translate";
import { STAMP_GOAL, type Card } from "@/lib/mock-data";
import { CupGlyph, StampDefs, StampMark } from "./Stamp";
import { Celebration } from "./Celebration";

// Hand-placed tilts so the card looks stamped by a person, not a printer.
const TILTS = [-9, 6, -3, 11, -7, 4, -12, 8, -5, 3];

export function StampCard({ card, t }: { card: Card; t: Translator }) {
  const filled = Math.min(card.stamps, STAMP_GOAL);
  const complete = filled >= STAMP_GOAL;
  const newestIndex = card.justStamped && filled > 0 ? filled - 1 : -1;
  const remaining = STAMP_GOAL - filled;

  return (
    <section aria-labelledby="card-heading" className="relative">
      <StampDefs />
      <div
        className={`relative overflow-hidden rounded-[1.75rem] border border-line bg-crema shadow-[0_1px_0_#fff_inset,0_18px_40px_-24px_rgb(43_27_19/0.45),0_2px_6px_-2px_rgb(43_27_19/0.12)] ${
          newestIndex >= 0 ? "card-thud" : ""
        }`}
      >
        {/* Ticket notches */}
        <span aria-hidden className="absolute top-[4.6rem] -left-3 size-6 rounded-full border border-line bg-paper" />
        <span aria-hidden className="absolute top-[4.6rem] -right-3 size-6 rounded-full border border-line bg-paper" />

        <div className="flex items-end justify-between px-6 pt-5 pb-4">
          <div>
            <h2 id="card-heading" className="text-[0.7rem] font-semibold tracking-[0.28em] text-caramel-ink uppercase">
              {t("card.eyebrow")}
            </h2>
            <p className="sr-only">{t("card.progressLabel", { count: filled, goal: STAMP_GOAL })}</p>
            <p aria-hidden className="mt-1 font-display text-[2.6rem] leading-none font-medium tabular">
              {filled}
              <span className="text-[1.5rem] text-muted">/{STAMP_GOAL}</span>
            </p>
          </div>
          <p className="pb-1 text-xs font-medium tracking-[0.18em] text-muted tabular">
            {t("card.number")} {card.cardNumber}
          </p>
        </div>

        <div aria-hidden className="mx-5 border-t-2 border-dotted border-line" />

        <ol className="grid grid-cols-5 gap-x-2.5 gap-y-3 px-5 pt-5 pb-4 min-[400px]:gap-x-3.5">
          {Array.from({ length: STAMP_GOAL }, (_, i) => {
            const n = i + 1;
            const isFilled = i < filled;
            const isFree = n === STAMP_GOAL;
            return (
              <li
                key={n}
                className={`relative aspect-square rounded-full ${i === newestIndex ? "stamp-new" : ""}`}
                style={{ ["--tilt" as string]: `${TILTS[i]}deg` }}
              >
                <span className="sr-only">{isFilled ? t("card.stampAlt", { n }) : t("card.emptyAlt", { n })}</span>
                {isFilled ? (
                  <StampMark ringText={t("card.stampText")} free={isFree} />
                ) : isFree ? (
                  <span aria-hidden className="flex size-full flex-col items-center justify-center rounded-full border-[1.5px] border-dashed border-caramel bg-foam/70 text-caramel-ink">
                    <CupGlyph className="size-[46%]" />
                    <span className="mt-px text-[clamp(0.4rem,1.7vw,0.52rem)] font-bold tracking-[0.06em] uppercase min-[400px]:tracking-[0.12em]">{t("card.freeSlot")}</span>
                  </span>
                ) : (
                  <span aria-hidden className="flex size-full items-center justify-center rounded-full border-[1.5px] border-dashed border-line font-display text-lg text-muted italic tabular">
                    {n}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <p className="flex items-center justify-center gap-2 border-t border-line/70 bg-foam/60 px-5 py-3 text-xs font-medium tracking-wide text-muted">
          <CupGlyph className="size-4" />
          {t("card.rule")}
        </p>
      </div>

      {complete && <Celebration />}

      {!complete && (
        <p className="mt-5 text-center font-display text-xl leading-snug text-roast italic">
          {t.plural("card.remaining", { count: remaining })}
        </p>
      )}

      {newestIndex >= 0 && (
        <p role="status" className="sr-only">
          {t("card.justAdded")}
        </p>
      )}
    </section>
  );
}
