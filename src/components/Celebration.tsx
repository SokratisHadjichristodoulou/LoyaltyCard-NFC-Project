// A burst of coffee beans from the centre of the card. Pure CSS, server-rendered,
// hidden for people who prefer reduced motion.
const BEANS = 18;

export function Celebration() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-visible">
      {Array.from({ length: BEANS }, (_, i) => {
        const angle = (i / BEANS) * Math.PI * 2 + (i % 2 ? 0.18 : -0.1);
        const dist = 120 + ((i * 37) % 70);
        const style = {
          "--x": `${Math.round(Math.cos(angle) * dist)}px`,
          "--y": `${Math.round(Math.sin(angle) * dist * 0.8)}px`,
          "--spin": `${(i % 2 ? 1 : -1) * (180 + i * 23)}deg`,
          "--delay": `${1100 + (i % 6) * 40}ms`,
        } as React.CSSProperties;
        const tone = i % 3 === 0 ? "bg-caramel" : i % 3 === 1 ? "bg-roast" : "bg-ink";
        return (
          <span
            key={i}
            className={`bean absolute top-1/2 left-1/2 h-4.5 w-3 rounded-[50%] ${tone}`}
            style={style}
          >
            <span className="absolute inset-y-0.5 left-1/2 w-px -translate-x-1/2 rounded-full bg-crema/70" />
          </span>
        );
      })}
    </div>
  );
}
