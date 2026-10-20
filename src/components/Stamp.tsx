/** Shared SVG defs for every stamp on the page (ink texture + text ring). */
export function StampDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <filter id="cp-ink" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="1" seed="2" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.8 1.6" result="speckle" />
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
        <path id="cp-ring" d="M50 50 m-33 0 a33 33 0 1 1 66 0 a33 33 0 1 1 -66 0" />
      </defs>
    </svg>
  );
}

/** Two halves of a roasted bean, echoing the "pause" bars of the logo. */
function Bean() {
  return (
    <g>
      <rect x="37" y="34" width="11" height="32" rx="5.5" fill="currentColor" />
      <rect x="52" y="34" width="11" height="32" rx="5.5" fill="currentColor" />
      <path d="M42.5 37 c-3 8 3 18 0 26 M57.5 37 c-3 8 3 18 0 26" stroke="var(--color-crema)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  );
}

export function CupGlyph({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 16h20v7a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9v-7Z" />
      <path d="M28 18h2.5a3.5 3.5 0 0 1 0 7H28" />
      <path d="M14 6c-1.5 2 1.5 3.5 0 6M19 5c-1.5 2 1.5 3.5 0 6M24 6c-1.5 2 1.5 3.5 0 6" />
    </svg>
  );
}

export function StampMark({ ringText, free = false }: { ringText: string; free?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="stamp-mark size-full text-ink" aria-hidden>
      <g filter="url(#cp-ink)">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3.2" />
        <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <text fill="currentColor" fontSize="9.2" fontWeight="700" letterSpacing="1.4" style={{ fontFamily: "var(--font-sans)" }}>
          <textPath href="#cp-ring" textLength="205" lengthAdjust="spacing">
            {ringText}
          </textPath>
        </text>
        {free ? (
          <g transform="translate(30 29) scale(1)" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 16h20v7a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9v-7Z" fill="currentColor" />
            <path d="M28 18h2.5a3.5 3.5 0 0 1 0 7H28" />
          </g>
        ) : (
          <g transform="translate(50 50) scale(.62) translate(-50 -50)">
            <Bean />
          </g>
        )}
      </g>
    </svg>
  );
}
