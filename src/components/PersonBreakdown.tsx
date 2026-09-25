import type { MemberBreakdown } from "@/lib/matching";

export function PersonBreakdown({ person }: { person: MemberBreakdown }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <h4 className="mb-2 text-sm font-semibold">{person.name}</h4>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-teal-700">Gets</p>
      <ul className="mb-3 space-y-0.5 text-sm">
        {person.gets.length ? person.gets.map((g) => <li key={g}>✓ {g}</li>) : <li className="text-stone-400">—</li>}
      </ul>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-700">Compromising on</p>
      <ul className="space-y-0.5 text-sm">
        {person.compromises.length ? (
          person.compromises.map((c) => <li key={c}>• {c}</li>)
        ) : (
          <li className="text-stone-400">Nothing</li>
        )}
      </ul>
    </div>
  );
}
