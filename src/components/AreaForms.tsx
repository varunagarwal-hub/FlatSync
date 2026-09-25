"use client";

import { useActionState, useState } from "react";
import { addArea, rateNewAreas } from "@/app/actions/constraints";
import type { Area } from "@/lib/types";
import { AreaRatingList, type RatingValue } from "./AreaRatingList";
import { FormMessage, SubmitButton, useControlledFormAction } from "./FormBits";

export function AddAreaForm({ groupId, code }: { groupId: string; code: string }) {
  const [state, action] = useActionState(addArea, undefined);
  return (
    <form action={action} className="card space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="code" value={code} />
      <label className="label" htmlFor="areaName">
        Add an area to the group's list
      </label>
      <div className="flex gap-2">
        <input id="areaName" name="areaName" className="input" placeholder="e.g. Indiranagar" maxLength={60} />
        <SubmitButton variant="secondary" pendingText="Adding…">
          Add
        </SubmitButton>
      </div>
      <p className="hint">Everyone sees the same list and rates each area privately.</p>
      <FormMessage state={state} />
    </form>
  );
}

/** For areas added after you submitted. Existing ratings can't change. */
export function RateNewAreasForm({ groupId, code, areas }: { groupId: string; code: string; areas: Area[] }) {
  const { state, pending, onSubmit } = useControlledFormAction(rateNewAreas);
  const [ratings, setRatings] = useState<Record<string, RatingValue>>({});
  return (
    <form onSubmit={onSubmit} className="card space-y-3 border-sun">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="code" value={code} />
      <div>
        <h2 className="font-semibold">New areas to rate</h2>
        <p className="hint">These were added after you submitted. Listings there are flagged until you rate them.</p>
      </div>
      <AreaRatingList areas={areas} value={ratings} onChange={(id, v) => setRatings((r) => ({ ...r, [id]: v }))} />
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save ratings</SubmitButton>
    </form>
  );
}
