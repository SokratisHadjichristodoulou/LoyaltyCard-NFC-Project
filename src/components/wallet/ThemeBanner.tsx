import { heroImageUrl, textColorOn, type Theme } from "@/lib/wallet/themes";

/** The seasonal banner above the stamp card, matching the wallet pass. */
export function ThemeBanner({ theme, locale }: { theme: Theme; locale: "el" | "en" }) {
  const greeting = (locale === "el" ? theme.message.el || theme.message.en : theme.message.en || theme.message.el) ?? null;
  return (
    <figure
      className="rise-in mb-5 overflow-hidden rounded-[1.5rem] ring-1 ring-line"
      style={{ backgroundColor: theme.backgroundColor, color: textColorOn(theme.backgroundColor) }}
    >
      <img
        src={heroImageUrl(theme.heroImage, "")}
        alt=""
        width={1032}
        height={336}
        className="block aspect-[1032/336] w-full object-cover"
      />
      {greeting && <figcaption className="px-5 py-3 text-center font-display text-lg leading-snug italic">{greeting}</figcaption>}
    </figure>
  );
}
