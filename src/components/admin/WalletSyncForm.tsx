"use client";

import { useActionState } from "react";
import { syncWalletNow, type FormState } from "@/app/admin/actions";

type Labels = { syncNow: string; synced: string; syncedNotified: string; syncedAppleMore: string; errors: Record<string, string> };

/** "Update all cards now": switches every pass to the current theme straight away. */
export function WalletSyncForm({ labels, disabled }: { labels: Labels; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(syncWalletNow, {});
  return (
    <form action={action} className="grid justify-items-start gap-3">
      <button
        type="submit"
        disabled={pending || disabled}
        className="min-h-11 rounded-full bg-foam px-5 text-sm font-semibold text-roast ring-1 ring-line hover:text-espresso disabled:opacity-60"
      >
        {labels.syncNow}
      </button>
      {(state.error || state.ok) && (
        <p role={state.error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-berry-soft text-berry" : "bg-olive-soft text-olive"}`}>
          {state.error
            ? labels.errors[state.error]
            : [state.values?.notified ? labels.syncedNotified : labels.synced, state.values?.appleMore ? labels.syncedAppleMore : ""].join(" ")}
        </p>
      )}
    </form>
  );
}
