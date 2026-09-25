import { memberColor } from "@/lib/memberColors";
import type { MemberStatus } from "@/lib/types";
import { Avatar } from "./Avatar";

/** Who has joined and submitted. Never shows anyone's answers. */
export function SubmissionStatus({ members, size }: { members: MemberStatus[]; size: number }) {
  const submitted = members.filter((m) => m.submitted).length;
  const emptySlots = Math.max(0, size - members.length);

  return (
    <div className="card space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold">Who's in</h2>
        <span className="text-sm font-bold text-muted">
          {submitted} of {size} submitted
        </span>
      </div>
      <ul className="space-y-2.5">
        {members.map((m, i) => (
          <li key={m.member_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2.5 font-medium">
              <Avatar name={m.display_name} color={memberColor(i)} size={30} />
              {m.display_name}
              {m.is_me && <span className="text-faint">(you)</span>}
            </span>
            {m.submitted ? <span className="chip-get font-bold">Submitted</span> : <span className="chip-give font-bold">Filling in</span>}
          </li>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <li key={`empty-${i}`} className="flex items-center gap-2.5 text-sm text-faint">
            <span className="inline-flex size-[30px] items-center justify-center rounded-full border-2 border-dashed border-faint">
              ?
            </span>
            Waiting for someone to join
          </li>
        ))}
      </ul>
    </div>
  );
}
