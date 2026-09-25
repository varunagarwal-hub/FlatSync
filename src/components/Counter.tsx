/** Listings added · ruled out · shortlisted. Ruled out/shortlisted are unknown until the reveal. */
export function Counter({
  added,
  ruledOut,
  shortlisted,
}: {
  added: number;
  ruledOut: number | null;
  shortlisted: number | null;
}) {
  const cells = [
    { label: "added", value: added, tile: "bg-paper", num: "text-ink" },
    { label: "ruled out", value: ruledOut, tile: "bg-paper", num: "text-bad-fg" },
    { label: "shortlisted", value: shortlisted, tile: "bg-sun", num: "text-night", labelTone: "text-night font-bold" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cells.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border-2 border-edge px-3 py-2.5 shadow-[3px_3px_0_var(--shadow)] ${c.tile}`}
        >
          <div className={`font-display text-3xl font-extrabold tabular-nums ${c.value === null ? "opacity-30" : c.num}`}>
            {c.value ?? "–"}
          </div>
          <div className={`text-xs font-medium ${c.labelTone ?? "text-muted"}`}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
