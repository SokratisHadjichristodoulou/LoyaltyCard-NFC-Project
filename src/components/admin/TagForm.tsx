"use client";

import { useActionState } from "react";
import { addTag, type FormState } from "@/app/admin/actions";

type Labels = {
  label: string;
  labelPlaceholder: string;
  uid: string;
  uidPlaceholder: string;
  uidHelp: string;
  add: string;
  saved: string;
  errors: Record<string, string>;
};

export function TagForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTag, {});

  const input =
    "min-h-12 w-full rounded-2xl border border-line bg-foam px-4 text-base text-espresso placeholder:text-muted/70 focus:border-gold-ink focus:outline-none";
  return (
    <form action={action} className="grid gap-4 rounded-[1.5rem] border border-line bg-crema/70 p-5 sm:grid-cols-2">
      <div className="grid gap-1.5">
        <label htmlFor="tag-label" className="text-sm font-semibold text-roast">{labels.label}</label>
        <input id="tag-label" name="label" maxLength={60} required defaultValue={state.values?.label} placeholder={labels.labelPlaceholder} className={input} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="tag-uid" className="text-sm font-semibold text-roast">{labels.uid}</label>
        <input
          id="tag-uid"
          name="tag_uid"
          required
          defaultValue={state.values?.tag_uid}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder={labels.uidPlaceholder}
          aria-describedby="tag-uid-help"
          className={`${input} font-mono uppercase`}
        />
        <p id="tag-uid-help" className="text-xs text-muted">{labels.uidHelp}</p>
      </div>
      {(state.error || state.ok) && (
        <p
          role={state.error ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm sm:col-span-2 ${state.error ? "bg-berry-soft text-berry" : "bg-olive-soft text-olive"}`}
        >
          {state.error ? labels.errors[state.error] ?? labels.errors.failed : labels.saved}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-full bg-espresso px-6 font-semibold text-gold-light ring-1 ring-gold/50 ring-inset disabled:opacity-70 sm:col-span-2 sm:justify-self-start"
      >
        {labels.add}
      </button>
    </form>
  );
}
