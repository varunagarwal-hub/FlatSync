import type { MemberStatus } from "@/lib/types";

/** Who has joined and submitted. Never shows anyone's answers. */
export function SubmissionStatus({ members, size }: { members: MemberStatus[]; size: number }) {
  const submitted = members.filter((m) => m.submitted).length;
  const emptySlots = Math.max(0, size - members.length);

  return (
    <div className="card">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Constraints</h2>
        <span className="text-sm text-stone-500">
          {submitted} of {size} submitted
        </span>
      </div>
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.member_id} className="flex items-center justify-between text-sm">
            <span>
              {m.display_name}
              {m.is_me && <span className="text-stone-400"> (you)</span>}
            </span>
            {m.submitted ? (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">Submitted</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Filling in</span>
            )}
          </li>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <li key={`empty-${i}`} className="flex items-center justify-between text-sm text-stone-400">
            <span>Waiting for someone to join</span>
            <span className="text-xs">—</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
