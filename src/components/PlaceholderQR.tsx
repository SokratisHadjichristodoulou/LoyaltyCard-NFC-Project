/**
 * PLACEHOLDER. Draws a QR-looking pattern derived from the coupon code so each
 * coupon looks different, but it is NOT scannable. A later step replaces this
 * with a real QR that encodes a signed verification URL.
 */
const SIZE = 25;

function seeded(text: string) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

function inFinder(x: number, y: number) {
  return (x < 8 && y < 8) || (x > SIZE - 9 && y < 8) || (x < 8 && y > SIZE - 9);
}

export function PlaceholderQR({ code, label, className = "" }: { code: string; label: string; className?: string }) {
  const rand = seeded(code);
  let d = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (inFinder(x, y)) continue;
      if (rand() > 0.52) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  const finders = [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ];
  return (
    <svg viewBox={`-2 -2 ${SIZE + 4} ${SIZE + 4}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={SIZE + 4} height={SIZE + 4} fill="#fff" />
      <path d={d} fill="currentColor" />
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`} fill="currentColor">
          <path d={`M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z`} fillRule="evenodd" />
          <rect x={x + 2} y={y + 2} width="3" height="3" />
        </g>
      ))}
    </svg>
  );
}
