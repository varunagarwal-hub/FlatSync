"use client";

import { useState } from "react";
import { saveConstraints } from "@/app/actions/constraints";
import { NICE_TO_HAVES } from "@/lib/constants";
import type { Area, AreaRating, MemberConstraints } from "@/lib/types";
import { AnchorPicker, type Anchor } from "./AnchorPicker";
import { AreaRatingList, type RatingValue } from "./AreaRatingList";
import { FormMessage, SubmitButton, useControlledFormAction } from "./FormBits";

// Inputs are controlled so a failed save never wipes what you typed.
export function ConstraintsForm({
  groupId,
  code,
  areas,
  existing,
  myRatings,
}: {
  groupId: string;
  code: string;
  areas: Area[];
  existing: MemberConstraints | null;
  myRatings: AreaRating[];
}) {
  const { state, pending, onSubmit } = useControlledFormAction(saveConstraints);
  const [maxRent, setMaxRent] = useState(existing ? String(existing.max_rent_share) : "");
  const [needsLift, setNeedsLift] = useState(existing?.needs_lift ?? false);
  const [needsParking, setNeedsParking] = useState(existing?.needs_parking ?? false);
  const [needsPets, setNeedsPets] = useState(existing?.needs_pet_friendly ?? false);
  const [minBathrooms, setMinBathrooms] = useState(String(existing?.min_bathrooms ?? 1));
  const [nice, setNice] = useState<string[]>(existing?.nice_to_haves ?? []);
  const [ratings, setRatings] = useState<Record<string, RatingValue>>(() =>
    Object.fromEntries(myRatings.map((r) => [r.area_id, r.acceptable ? "yes" : "no"])),
  );

  const [anchor, setAnchor] = useState<Anchor | null>(
    existing?.anchor_lat != null && existing.anchor_lng != null
      ? { label: existing.anchor_label ?? "Saved location", lat: existing.anchor_lat, lng: existing.anchor_lng }
      : null,
  );
  const [radius, setRadius] = useState<3 | 5 | null>(
    existing?.radius_km === 3 || existing?.radius_km === 5 ? existing.radius_km : null,
  );

  const unrated = areas.filter((a) => !ratings[a.id]).length;
  const missing = [
    unrated > 0 && `rate all areas (${unrated} left)`,
    (!anchor || !radius) && "pick your anchor and radius",
  ].filter(Boolean);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="code" value={code} />

      <section className="card space-y-3">
        <h2 className="font-semibold">Budget</h2>
        <div className="max-w-xs">
          <label className="label" htmlFor="maxRentShare">
            Your maximum monthly rent share (₹)
          </label>
          <input
            id="maxRentShare"
            name="maxRentShare"
            className="input"
            inputMode="numeric"
            placeholder="20000"
            value={maxRent}
            onChange={(e) => setMaxRent(e.target.value)}
            required
          />
          <p className="hint mt-1">Your share only, not the whole flat's rent.</p>
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold">Where you need to be close to</h2>
          <p className="hint">
            Pick a place you travel to often, like your office or college, and how far from it you're willing to live.
            Listings outside your radius get flagged. The group sees your anchor after everyone submits.
          </p>
        </div>
        <AnchorPicker anchor={anchor} radius={radius} onAnchor={setAnchor} onRadius={setRadius} />
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold">Areas</h2>
          <p className="hint">A listing in an area anyone marks “Not acceptable” is ruled out.</p>
        </div>
        <AreaRatingList areas={areas} value={ratings} onChange={(id, v) => setRatings((r) => ({ ...r, [id]: v }))} />
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold">Must-haves</h2>
          <p className="hint">A listing that doesn't have one of these is ruled out.</p>
        </div>
        <div className="space-y-2 text-sm">
          <Checkbox name="needsLift" label="Lift" checked={needsLift} onChange={setNeedsLift} />
          <Checkbox name="needsParking" label="Parking" checked={needsParking} onChange={setNeedsParking} />
          <Checkbox name="needsPetFriendly" label="Pet-friendly" checked={needsPets} onChange={setNeedsPets} />
        </div>
        <div className="max-w-[10rem]">
          <label className="label" htmlFor="minBathrooms">
            Minimum bathrooms
          </label>
          <input
            id="minBathrooms"
            name="minBathrooms"
            type="number"
            min={0}
            max={10}
            className="input"
            value={minBathrooms}
            onChange={(e) => setMinBathrooms(e.target.value)}
            required
          />
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold">Nice-to-haves</h2>
          <p className="hint">These don't rule anything out. They decide the ranking.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {NICE_TO_HAVES.map((n) => (
            <Checkbox
              key={n.key}
              name="niceToHaves"
              value={n.key}
              label={n.label}
              checked={nice.includes(n.key)}
              onChange={(on) => setNice((cur) => (on ? [...cur, n.key] : cur.filter((k) => k !== n.key)))}
            />
          ))}
        </div>
      </section>

      <div className="space-y-3">
        <FormMessage state={state} />
        <p className="text-sm text-muted">
          Your answers stay private until everyone in the group submits. Once you submit, they're locked.
          {missing.length > 0 && ` To submit, ${missing.join(" and ")}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="intent" value="draft" variant="secondary" pending={pending}>
            Save draft
          </SubmitButton>
          <SubmitButton name="intent" value="submit" pendingText="Submitting…" pending={pending}>
            Submit and lock
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function Checkbox({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value?: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-violet"
      />
      {label}
    </label>
  );
}
