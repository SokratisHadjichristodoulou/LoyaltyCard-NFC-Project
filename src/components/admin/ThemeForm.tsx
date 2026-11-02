"use client";

import { useActionState, useEffect, useState } from "react";
import { addWalletTheme, type FormState } from "@/app/admin/actions";
import type { Messages } from "@/i18n/types";
import type { PresetId, ThemePreset } from "@/lib/wallet/presets";
import { BUILTIN_HEROES, heroImageUrl } from "@/lib/wallet/themes";
import { WalletPreview } from "@/components/wallet/WalletPreview";

type Labels = Messages["admin"]["wallet"];
type Values = {
  preset: PresetId;
  name: string;
  background_color: string;
  hero_builtin: string;
  hero_url: string;
  message_el: string;
  message_en: string;
  starts_on: string;
  ends_on: string;
  repeats_yearly: boolean;
  notify: boolean;
};

function fromPreset(preset: ThemePreset, labels: Labels): Values {
  return {
    preset: preset.id,
    name: preset.id === "blank" ? "" : labels.presets[preset.id],
    background_color: preset.background_color,
    hero_builtin: preset.hero_builtin,
    hero_url: "",
    message_el: preset.message_el,
    message_en: preset.message_en,
    starts_on: preset.starts_on,
    ends_on: preset.ends_on,
    repeats_yearly: preset.repeats_yearly,
    notify: preset.notify,
  };
}

type Props = {
  presets: ThemePreset[];
  labels: Labels;
  preview: { cafeName: string; programName: string; stampsLabel: string; stamps: string };
};

export function ThemeForm({ presets, labels, preview }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(addWalletTheme, {});
  const [values, setValues] = useState<Values>(() => fromPreset(presets[0], labels));
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  // After a theme is saved, start again from the same preset.
  useEffect(() => {
    if (state.ok) setValues((v) => fromPreset(presets.find((p) => p.id === v.preset) ?? presets[0], labels));
  }, [state, presets, labels]);

  const url = values.hero_url.trim();
  const heroUrl = /^https:\/\/\S+$/.test(url) ? url : heroImageUrl(values.hero_builtin, "");
  const input =
    "min-h-12 w-full rounded-2xl border border-line bg-foam px-4 text-base text-espresso placeholder:text-muted/70 focus:border-gold-ink focus:outline-none";
  const label = "text-sm font-semibold text-roast";

  return (
    <form action={action} className="grid gap-6 rounded-[1.5rem] border border-line bg-crema/70 p-5">
      <div className="grid justify-items-center gap-3">
        <WalletPreview
          color={values.background_color}
          heroUrl={heroUrl}
          heroAlt={labels.previewAlt.replace("{name}", values.name)}
          {...preview}
        />
        {(values.message_el || values.message_en) && (
          <p className="max-w-[22rem] text-center font-display text-lg text-roast italic">{values.message_el || values.message_en}</p>
        )}
      </div>
      <div className="grid content-start gap-5">
        <div className="grid gap-1.5">
          <label htmlFor="theme-preset" className={label}>{labels.preset}</label>
          <select
            id="theme-preset"
            name="preset"
            value={values.preset}
            onChange={(e) => setValues(fromPreset(presets.find((p) => p.id === e.target.value) ?? presets[0], labels))}
            className={input}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{labels.presets[p.id]}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-1.5">
            <label htmlFor="theme-name" className={label}>{labels.name}</label>
            <input id="theme-name" name="name" required maxLength={40} value={values.name} onChange={(e) => set("name", e.target.value)} className={input} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="theme-color" className={label}>{labels.color}</label>
            <input
              id="theme-color"
              name="background_color"
              type="color"
              value={values.background_color}
              onChange={(e) => set("background_color", e.target.value)}
              className="h-12 w-20 cursor-pointer rounded-2xl border border-line bg-foam px-1.5"
            />
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className={`${label} mb-1.5`}>{labels.banner}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BUILTIN_HEROES.map((hero) => (
              <label
                key={hero}
                className="relative cursor-pointer overflow-hidden rounded-xl ring-1 ring-line has-[:checked]:ring-[3px] has-[:checked]:ring-gold-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-ink"
              >
                <input
                  type="radio"
                  name="hero_builtin"
                  value={hero}
                  checked={values.hero_builtin === hero}
                  onChange={() => set("hero_builtin", hero)}
                  className="sr-only"
                />
                <img src={heroImageUrl(hero, "")} alt="" width={1032} height={336} className="block aspect-[1032/336] w-full object-cover" />
                <span className="block bg-foam px-2 py-1 text-xs font-semibold text-roast">{labels.banners[hero]}</span>
              </label>
            ))}
          </div>
          <label htmlFor="theme-url" className="mt-2 text-sm text-roast">{labels.ownImage}</label>
          <input
            id="theme-url"
            name="hero_url"
            type="url"
            inputMode="url"
            placeholder="https://"
            value={values.hero_url}
            onChange={(e) => set("hero_url", e.target.value)}
            aria-describedby="theme-url-help"
            className={input}
          />
          <p id="theme-url-help" className="text-xs text-muted">{labels.ownImageHelp}</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="theme-msg-el" className={label}>{labels.messageEl}</label>
            <input id="theme-msg-el" name="message_el" maxLength={120} placeholder={labels.messagePlaceholderEl} value={values.message_el} onChange={(e) => set("message_el", e.target.value)} className={input} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="theme-msg-en" className={label}>{labels.messageEn}</label>
            <input id="theme-msg-en" name="message_en" maxLength={120} placeholder={labels.messagePlaceholderEn} value={values.message_en} onChange={(e) => set("message_en", e.target.value)} className={input} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="theme-from" className={label}>{labels.from}</label>
            <input id="theme-from" name="starts_on" type="date" required value={values.starts_on} onChange={(e) => set("starts_on", e.target.value)} className={input} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="theme-until" className={label}>{labels.until}</label>
            <input id="theme-until" name="ends_on" type="date" required value={values.ends_on} onChange={(e) => set("ends_on", e.target.value)} className={input} />
          </div>
        </div>

        <div className="grid gap-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="repeats_yearly" checked={values.repeats_yearly} onChange={(e) => set("repeats_yearly", e.target.checked)} aria-describedby="theme-yearly-help" className="mt-1 size-5 accent-espresso" />
            <span>
              <span className="block text-sm font-semibold text-roast">{labels.yearly}</span>
              <span id="theme-yearly-help" className="block text-xs text-muted">{labels.yearlyHelp}</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="notify" checked={values.notify} onChange={(e) => set("notify", e.target.checked)} aria-describedby="theme-notify-help" className="mt-1 size-5 accent-espresso" />
            <span>
              <span className="block text-sm font-semibold text-roast">{labels.notify}</span>
              <span id="theme-notify-help" className="block text-xs text-muted">{labels.notifyHelp}</span>
            </span>
          </label>
        </div>

        {(state.error || state.ok) && (
          <p role={state.error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-berry-soft text-berry" : "bg-olive-soft text-olive"}`}>
            {state.error ? (labels.errors as Record<string, string>)[state.error] ?? labels.errors.failed : labels.saved}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="min-h-12 justify-self-start rounded-full bg-espresso px-7 font-semibold text-gold-light ring-1 ring-gold/50 ring-inset disabled:opacity-70"
        >
          {labels.add}
        </button>
      </div>

    </form>
  );
}
