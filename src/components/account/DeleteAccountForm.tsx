"use client";

import { useActionState } from "react";
import { deleteAccount, type AccountFormState } from "@/app/account/actions";

type Labels = { confirm: string; button: string; errors: Record<string, string> };

export function DeleteAccountForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="grid gap-4">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-roast">
        <input type="checkbox" name="confirm" className="mt-0.5 size-5 shrink-0 accent-[var(--color-berry)]" />
        <span>{labels.confirm}</span>
      </label>
      {state.error && (
        <p role="alert" className="rounded-xl bg-berry-soft px-4 py-3 text-sm text-berry">
          {labels.errors[state.error] ?? labels.errors.failed}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-fit rounded-full border-2 border-berry px-6 font-semibold text-berry hover:bg-berry-soft disabled:opacity-70"
      >
        {labels.button}
      </button>
    </form>
  );
}
