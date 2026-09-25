"use client";

import { useState } from "react";
import { addListing } from "@/app/actions/listings";
import { NICE_TO_HAVES } from "@/lib/constants";
import type { Area, Tri } from "@/lib/types";
import { FormMessage, SubmitButton, useControlledFormAction } from "./FormBits";

const TRI_OPTIONS: { value: Tri; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

function TriField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: Tri | "";
  onChange: (v: Tri) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-2">
      <legend className="float-left text-sm">{label}</legend>
      <div className="flex gap-1">
        {TRI_OPTIONS.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span className="inline-block rounded-md border border-stone-300 px-2.5 py-1 text-xs peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600/40">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Controlled so a failed save never wipes what you typed.
export function ListingForm({ groupId, code, areas }: { groupId: string; code: string; areas: Area[] }) {
  const { state, pending, onSubmit } = useControlledFormAction(addListing);
  const [areaId, setAreaId] = useState(areas.length ? "" : "__new");
  const [newArea, setNewArea] = useState("");
  const [totalRent, setTotalRent] = useState("");
  const [floor, setFloor] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [lift, setLift] = useState<Tri | "">("");
  const [parking, setParking] = useState<Tri | "">("");
  const [pets, setPets] = useState<Tri | "">("");
  const [bathrooms, setBathrooms] = useState("");
  const [bathroomsUnsure, setBathroomsUnsure] = useState(false);
  const [features, setFeatures] = useState<Record<string, Tri>>(
    Object.fromEntries(NICE_TO_HAVES.map((n) => [n.key, "unsure" as Tri])),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="code" value={code} />

      <section className="card grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="areaId">
            Area
          </label>
          <select id="areaId" name="areaId" className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)} required>
            <option value="" disabled>
              Choose an area
            </option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="__new">+ New area…</option>
          </select>
          {areaId === "__new" && (
            <input
              name="newArea"
              className="input mt-2"
              placeholder="New area name"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value)}
              maxLength={60}
              required
            />
          )}
        </div>
        <div>
          <label className="label" htmlFor="totalRent">
            Total monthly rent (₹)
          </label>
          <input
            id="totalRent"
            name="totalRent"
            className="input"
            inputMode="numeric"
            placeholder="54000"
            value={totalRent}
            onChange={(e) => setTotalRent(e.target.value)}
            required
          />
          <p className="hint mt-1">For the whole flat.</p>
        </div>
        <div>
          <label className="label" htmlFor="floor">
            Floor
          </label>
          <input
            id="floor"
            name="floor"
            type="number"
            min={-2}
            max={200}
            className="input"
            placeholder="0 for ground"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="url">
            Link <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            id="url"
            name="url"
            type="url"
            className="input"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold">Must-have facts</h2>
          <p className="hint">If you don't know, pick Not sure. The listing gets flagged “confirm before visiting”.</p>
        </div>
        <TriField name="lift" label="Lift" value={lift} onChange={setLift} />
        <TriField name="parking" label="Parking" value={parking} onChange={setParking} />
        <TriField name="petFriendly" label="Pet-friendly" value={pets} onChange={setPets} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="bathrooms" className="text-sm">
            Bathrooms
          </label>
          <div className="flex items-center gap-3">
            <input
              id="bathrooms"
              name="bathrooms"
              type="number"
              min={0}
              max={20}
              className="input w-20"
              value={bathroomsUnsure ? "" : bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
              disabled={bathroomsUnsure}
              required={!bathroomsUnsure}
            />
            <label className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                name="bathroomsUnsure"
                checked={bathroomsUnsure}
                onChange={(e) => setBathroomsUnsure(e.target.checked)}
                className="size-4 accent-teal-700"
              />
              Not sure
            </label>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Nice-to-haves</h2>
        {NICE_TO_HAVES.map((n) => (
          <TriField
            key={n.key}
            name={`feature:${n.key}`}
            label={n.label}
            value={features[n.key]}
            onChange={(v) => setFeatures((f) => ({ ...f, [n.key]: v }))}
          />
        ))}
      </section>

      <section className="card">
        <label className="label" htmlFor="notes">
          Notes <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          className="input"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…" pending={pending}>
        Add listing
      </SubmitButton>
    </form>
  );
}
