"use client";

import { useActionState } from "react";
import { updateName, type AccountFormState } from "@/app/account/actions";

type Labels = { label: string; save: string; saved: string; errors: Record<string, string> };

export function NameForm({ current, labels }: { current: string; labels: Labels }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateName, {});
  return (
    <form action={action} className="grid gap-3">
      <label htmlFor="display_name" className="sr-only">{labels.label}</label>
      <div className="flex gap-2">
        <input
          id="display_name"
          name="display_name"
          maxLength={80}
          autoComplete="given-name"
          defaultValue={state.value ?? current}
          className="min-h-12 w-0 min-w-0 flex-1 rounded-2xl border border-line bg-foam px-4 text-base text-espresso focus:border-gold-ink focus:outline-none"
        />
        <button type="submit" disabled={pending} className="min-h-12 shrink-0 rounded-2xl border border-espresso px-5 font-semibold disabled:opacity-70">
          {labels.save}
        </button>
      </div>
      {(state.ok || state.error) && (
        <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-berry" : "text-olive"}`}>
          {state.error ? labels.errors[state.error] ?? labels.errors.failed : labels.saved}
        </p>
      )}
    </form>
  );
}
