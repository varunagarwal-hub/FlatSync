"use client";

import { useActionState } from "react";
import { createGroup, joinGroup } from "@/app/actions/groups";
import { DEFAULT_GROUP_SIZE, MAX_GROUP_SIZE, MIN_GROUP_SIZE } from "@/lib/constants";
import { FormMessage, SubmitButton } from "./FormBits";

export function CreateGroupForm() {
  const [state, action] = useActionState(createGroup, undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="groupName">
          Group name
        </label>
        <input id="groupName" name="groupName" className="input" placeholder="e.g. Bangalore flat hunt" maxLength={80} required />
      </div>
      <div>
        <label className="label" htmlFor="createName">
          Your name
        </label>
        <input id="createName" name="displayName" className="input" maxLength={40} required />
      </div>
      <div>
        <label className="label" htmlFor="size">
          How many people, including you?
        </label>
        <select id="size" name="size" className="input" defaultValue={DEFAULT_GROUP_SIZE}>
          {Array.from({ length: MAX_GROUP_SIZE - MIN_GROUP_SIZE + 1 }, (_, i) => MIN_GROUP_SIZE + i).map((n) => (
            <option key={n} value={n}>
              {n} people
            </option>
          ))}
        </select>
        <p className="hint mt-1">Answers unlock once this many people have joined and submitted. You can change it later.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating…">Create group</SubmitButton>
    </form>
  );
}

export function JoinGroupForm({ defaultCode = "" }: { defaultCode?: string }) {
  const [state, action] = useActionState(joinGroup, undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="code">
          Group code
        </label>
        <input
          id="code"
          name="code"
          className="input font-mono uppercase tracking-widest"
          defaultValue={defaultCode}
          placeholder="K7QP2M"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="joinName">
          Your name
        </label>
        <input id="joinName" name="displayName" className="input" maxLength={40} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Joining…">Join group</SubmitButton>
    </form>
  );
}
