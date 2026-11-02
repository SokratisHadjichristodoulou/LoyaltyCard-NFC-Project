import type { Translator } from "@/i18n/translate";

/**
 * "Add to Apple Wallet" and/or "Add to Google Wallet". Plain links (not
 * next/link), so they are never prefetched: opening them makes the pass.
 * Before going live, swap these for Apple's and Google's official button
 * artwork (see README, Wallet passes).
 */
export function WalletButtons({
  t,
  apple,
  google,
  inGoogleWallet,
  failed,
}: {
  t: Translator;
  apple: boolean;
  google: boolean;
  inGoogleWallet: boolean;
  failed: "apple" | "google" | null;
}) {
  if (!apple && !google) return null;
  const button =
    "inline-flex min-h-12 items-center gap-2.5 rounded-full bg-[#1f1f1f] px-6 text-[0.95rem] font-medium text-white shadow-[0_8px_20px_-12px_rgb(0_0_0/0.8)] transition-transform active:scale-[0.98]";
  return (
    <div className="mt-8 grid justify-items-center gap-2.5 text-center">
      {failed && (
        <p role="alert" className="rounded-xl bg-berry-soft px-4 py-3 text-sm text-berry">
          {failed === "apple" ? t("wallet.errorApple") : t("wallet.error")}
        </p>
      )}
      {apple && (
        <a href="/wallet/apple" className={button}>
          <WalletGlyph className="size-5" />
          {t("wallet.addApple")}
        </a>
      )}
      {google && (
        <a href="/wallet/google" className={button}>
          <WalletGlyph className="size-5" />
          {t("wallet.add")}
        </a>
      )}
      <p className="max-w-[32ch] text-xs leading-relaxed text-muted">
        {google && !apple && inGoogleWallet ? t("wallet.added") : t("wallet.addHelp")}
      </p>
    </div>
  );
}

function WalletGlyph({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <path d="M6 6l9-2.6a1.5 1.5 0 0 1 1.9 1.2L17 6" />
      <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
