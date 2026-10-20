"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RedeemButton({ code, label, pendingLabel, errorLabel }: { code: string; label: string; pendingLabel: string; errorLabel: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function redeem() {
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json().catch(() => ({}))) as { result?: string };
      if (!res.ok || !body.result) throw new Error("redeem failed");
      // The server page shows the outcome (and the coupon's new status).
      router.replace(`/staff?code=${encodeURIComponent(code)}&done=${body.result}`);
      router.refresh();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={redeem}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-olive px-7 text-lg font-semibold text-paper shadow-[0_10px_24px_-12px_rgb(58_22_9/0.6)] active:scale-[0.98] disabled:opacity-70"
      >
        {pending ? pendingLabel : label}
      </button>
      {failed && (
        <p role="alert" className="rounded-xl bg-berry-soft px-4 py-3 text-sm text-berry">
          {errorLabel}
        </p>
      )}
    </div>
  );
}
