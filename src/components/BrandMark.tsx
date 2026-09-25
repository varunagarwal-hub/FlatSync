// Three friends' circles meeting in the middle: the FlatSync mark.
// The circles sit on an exact triangle around one centre, share the same
// transparency, and all outlines are drawn after all fills, so no circle
// sits "on top" of the others.

const CX = 120;
const CY = 116;
const SPREAD = 40; // distance of each circle's centre from the middle
const R = 64;

const CIRCLES = [
  { color: "#FF5A36", angle: -150 }, // coral, top left
  { color: "#6C4CF1", angle: -30 }, // violet, top right
  { color: "#19B38A", angle: 90 }, // mint, bottom
].map((c) => {
  const a = (c.angle * Math.PI) / 180;
  return { ...c, x: CX + SPREAD * Math.cos(a), y: CY + SPREAD * Math.sin(a) };
});

export function BrandMark({ className, animate = false }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 240 232" className={className} aria-hidden="true">
      <g className={animate ? "pop-in" : undefined} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        {/* white base so the colours blend the same on light and dark pages */}
        {CIRCLES.map((c) => (
          <circle key={`b-${c.color}`} cx={c.x} cy={c.y} r={R} fill="#FFFFFF" />
        ))}
        {CIRCLES.map((c) => (
          <circle key={`f-${c.color}`} cx={c.x} cy={c.y} r={R} fill={c.color} fillOpacity={0.78} />
        ))}
        {CIRCLES.map((c) => (
          <circle key={`s-${c.color}`} cx={c.x} cy={c.y} r={R} fill="none" stroke="#1B1740" strokeWidth={3.5} />
        ))}
        <circle cx={CX} cy={CY} r={17} fill="#FFC226" stroke="#1B1740" strokeWidth={3.5} />
      </g>
    </svg>
  );
}

/** Logo + name, for the top of the landing page. */
export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark className="size-11 shrink-0" />
      <span className="font-display text-3xl font-extrabold tracking-tight text-violet sm:text-4xl dark:text-link">
        FlatSync
      </span>
    </span>
  );
}
