import { textColorOn } from "@/lib/wallet/themes";

// A close sketch of how a theme looks on the Google Wallet loyalty card
// (logo and name on top, the stamps, the banner at the bottom), so the admin
// can see a theme before customers do. Google draws the real one.

type Props = {
  color: string;
  heroUrl: string;
  heroAlt: string;
  cafeName: string;
  programName: string;
  stampsLabel: string;
  stamps: string;
};

export function WalletPreview({ color, heroUrl, heroAlt, cafeName, programName, stampsLabel, stamps }: Props) {
  const ink = textColorOn(color);
  return (
    <div
      className="w-full max-w-[22rem] overflow-hidden rounded-[1.4rem] shadow-[0_14px_30px_-18px_rgb(58_22_9/0.6)]"
      style={{ backgroundColor: color, color: ink }}
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <img src="/wallet/logo.png" alt="" width={36} height={36} className="size-9 rounded-full bg-white/90" />
        <p className="truncate text-sm font-medium">{cafeName}</p>
      </div>
      <p className="truncate px-4 pt-3 text-[1.35rem] leading-tight font-medium">{programName}</p>
      <div className="px-4 pt-3 pb-4">
        <p className="text-[0.7rem] font-medium tracking-wide uppercase opacity-80">{stampsLabel}</p>
        <p className="text-lg font-medium tabular">{stamps}</p>
      </div>
      <img src={heroUrl} alt={heroAlt} width={1032} height={336} className="block aspect-[1032/336] w-full object-cover" />
    </div>
  );
}
