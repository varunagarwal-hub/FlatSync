import type { MemberBreakdown } from "@/lib/matching";
import type { MemberColor } from "@/lib/memberColors";
import { Avatar } from "./Avatar";

/** One person's row on an option card: what they get (green) and give up (amber). */
export function PersonBreakdown({ person, color }: { person: MemberBreakdown; color: MemberColor }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar name={person.name} color={color} size={30} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-bold">{person.name}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label={`What ${person.name} gets`}>
          {person.gets.map((g) => (
            <li key={g} className="chip-get">
              {g}
            </li>
          ))}
        </ul>
        {person.compromises.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label={`What ${person.name} gives up`}>
            {person.compromises.map((c) => (
              <li key={c} className="chip-give">
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs font-medium text-get-fg">Not giving anything up</p>
        )}
      </div>
    </div>
  );
}
