"use client";

import { useState } from "react";

/** A link shown in full, with a button that copies it (for pasting into an NFC app). */
export function CopyLink({ url, label, copiedLabel }: { url: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 flex-1 rounded-xl bg-crema px-3 py-2 text-xs break-all text-espresso select-all">{url}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked: the link stays selectable by hand.
          }
        }}
        className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold text-roast ring-1 ring-line hover:text-espresso"
      >
        <span aria-live="polite">{copied ? copiedLabel : label}</span>
      </button>
    </div>
  );
}
