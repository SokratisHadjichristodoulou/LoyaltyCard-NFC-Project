"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { sendMagicLink, type LoginError, type LoginState } from "@/app/login/actions";

type Labels = {
  email: string;
  placeholder: string;
  submit: string;
  errors: Record<LoginError, string>;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-espresso px-7 text-base font-semibold text-gold-light ring-1 ring-gold/50 ring-inset transition-[transform,opacity] active:scale-[0.98] disabled:opacity-70"
    >
      {label}
      <span aria-hidden>{pending ? "…" : "→"}</span>
    </button>
  );
}

export function LoginForm({ next, labels, initialError }: { next: string; labels: Labels; initialError?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const error = state.error ? labels.errors[state.error] : initialError;

  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-semibold text-roast">
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.email}
          placeholder={labels.placeholder}
          aria-invalid={!!state.error}
          aria-describedby={error ? "login-error" : undefined}
          className="min-h-13 w-full rounded-2xl border border-line bg-foam px-4 text-base text-espresso placeholder:text-muted/70 focus:border-gold-ink focus:outline-none aria-invalid:border-berry"
        />
      </div>
      {error && (
        <p id="login-error" role="alert" className="rounded-xl bg-berry-soft px-4 py-3 text-sm leading-relaxed text-berry">
          {error}
        </p>
      )}
      <SubmitButton label={labels.submit} />
    </form>
  );
}
