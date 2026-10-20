"use client";

import { useActionState } from "react";
import { updateSettings, type FormState } from "@/app/admin/actions";

type Values = { stamps_required: number; coupon_valid_days: number; cooldown_minutes: number };
type Labels = {
  stampsRequired: string;
  couponDays: string;
  cooldown: string;
  cooldownHelp: string;
  save: string;
  saved: string;
  errors: Record<string, string>;
};

export function SettingsForm({ values, labels }: { values: Values; labels: Labels }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSettings, {});
  const input =
    "min-h-12 w-full rounded-2xl border border-line bg-foam px-4 text-base text-espresso tabular focus:border-gold-ink focus:outline-none";
  return (
    <form action={action} className="grid max-w-md gap-5">
      <div className="grid gap-1.5">
        <label htmlFor="stamps_required" className="text-sm font-semibold text-roast">{labels.stampsRequired}</label>
        <input id="stamps_required" name="stamps_required" type="number" inputMode="numeric" min={1} max={50} required defaultValue={state.values?.stamps_required ?? values.stamps_required} className={input} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="coupon_valid_days" className="text-sm font-semibold text-roast">{labels.couponDays}</label>
        <input id="coupon_valid_days" name="coupon_valid_days" type="number" inputMode="numeric" min={1} max={730} required defaultValue={state.values?.coupon_valid_days ?? values.coupon_valid_days} className={input} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="cooldown_minutes" className="text-sm font-semibold text-roast">{labels.cooldown}</label>
        <input id="cooldown_minutes" name="cooldown_minutes" type="number" inputMode="decimal" min={0} max={1440} step="0.5" required defaultValue={state.values?.cooldown_minutes ?? values.cooldown_minutes} aria-describedby="cooldown-help" className={input} />
        <p id="cooldown-help" className="text-xs text-muted">{labels.cooldownHelp}</p>
      </div>
      {(state.error || state.ok) && (
        <p role={state.error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-berry-soft text-berry" : "bg-olive-soft text-olive"}`}>
          {state.error ? labels.errors[state.error] ?? labels.errors.failed : labels.saved}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 justify-self-start rounded-full bg-espresso px-7 font-semibold text-gold-light ring-1 ring-gold/50 ring-inset disabled:opacity-70"
      >
        {labels.save}
      </button>
    </form>
  );
}
