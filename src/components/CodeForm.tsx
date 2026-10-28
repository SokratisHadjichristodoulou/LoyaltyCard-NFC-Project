"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { verifyCode, type CodeState } from "@/app/login/actions";

type Labels = { code: string; submit: string; errors: Record<NonNullable<CodeState["error"]>, string> };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-13 shrink-0 rounded-full bg-espresso px-6 font-semibold text-gold-light ring-1 ring-gold/50 ring-inset disabled:opacity-70"
    >
      {label}
    </button>
  );
}

/** The 6-digit code from the sign-in email, typed on the page the customer is already on. */
export function CodeForm({ next, labels }: { next: string; labels: Labels }) {
  const [state, action] = useActionState<CodeState, FormData>(verifyCode, {});
  useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);
  return (
    <form action={action} noValidate className="grid gap-2">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="code" className="text-sm font-semibold text-roast">
        {labels.code}
      </label>
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "code-error" : undefined}
          className="min-h-13 w-0 min-w-0 flex-1 rounded-2xl border border-line bg-foam px-4 text-center font-mono text-xl tracking-[0.3em] text-espresso focus:border-gold-ink focus:outline-none aria-invalid:border-berry"
        />
        <SubmitButton label={labels.submit} />
      </div>
      {state.error && (
        <p id="code-error" role="alert" className="rounded-xl bg-berry-soft px-4 py-3 text-sm leading-relaxed text-berry">
          {labels.errors[state.error]}
        </p>
      )}
    </form>
  );
}
