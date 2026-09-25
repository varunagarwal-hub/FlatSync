"use client";

import { useActionState } from "react";
import { setGroupSize } from "@/app/actions/groups";
import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from "@/lib/constants";
import { FormMessage, SubmitButton } from "./FormBits";

/** Shown to the group's creator until answers are revealed. */
export function GroupSizeControl({
  groupId,
  code,
  size,
  joined,
}: {
  groupId: string;
  code: string;
  size: number;
  joined: number;
}) {
  const [state, action] = useActionState(setGroupSize, undefined);
  const min = Math.max(MIN_GROUP_SIZE, joined);
  const options = Array.from({ length: MAX_GROUP_SIZE - min + 1 }, (_, i) => min + i);

  return (
    <form action={action} className="card space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="code" value={code} />
      <label className="label" htmlFor="groupSize">
        Group size
      </label>
      <div className="flex gap-2">
        <select id="groupSize" name="size" className="input" defaultValue={size} key={size}>
          {options.map((n) => (
            <option key={n} value={n}>
              {n} people{n === joined ? " (everyone who has joined)" : ""}
            </option>
          ))}
        </select>
        <SubmitButton variant="secondary">Change</SubmitButton>
      </div>
      <p className="hint">
        Someone not joining after all? Lower it to {joined} and answers unlock as soon as everyone here has submitted.
        Only you, as the creator, can change this.
      </p>
      <FormMessage state={state} />
    </form>
  );
}
