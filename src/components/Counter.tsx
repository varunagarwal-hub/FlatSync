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
    { label: "Listings added", value: added, tone: "text-stone-900" },
    { label: "Ruled out", value: ruledOut, tone: "text-red-700" },
    { label: "Shortlisted", value: shortlisted, tone: "text-teal-700" },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm">
      {cells.map((c) => (
        <div key={c.label} className="px-3 py-4 text-center">
          <div className={`text-3xl font-semibold tabular-nums ${c.value === null ? "text-stone-300" : c.tone}`}>
            {c.value ?? "–"}
          </div>
          <div className="mt-1 text-xs text-stone-500">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
