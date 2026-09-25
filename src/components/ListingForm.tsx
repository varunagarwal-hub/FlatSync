"use client";

import { useState } from "react";
import { addListing } from "@/app/actions/listings";
import { matchArea } from "@/lib/areaMatch";
import { NICE_TO_HAVES } from "@/lib/constants";
import type { Area, FactField, Tri } from "@/lib/types";
import { FormMessage, SubmitButton, useControlledFormAction } from "./FormBits";
import { PasteListing, type Extracted } from "./PasteListing";

const triOf = (b: boolean | null): Tri => (b === null ? "unsure" : b ? "yes" : "no");

function FromListingBadge({ onConfirm }: { onConfirm: () => void }) {
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="rounded-full bg-give px-2 py-0.5 font-medium text-give-fg ring-1 ring-sun">
        From listing – not confirmed
      </span>
      <button type="button" className="font-medium text-link hover:underline" onClick={onConfirm}>
        Confirm
      </button>
    </span>
  );
}

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
  fromListing = false,
  onConfirm,
}: {
  name: string;
  label: string;
  value: Tri | "";
  onChange: (v: Tri) => void;
  fromListing?: boolean;
  onConfirm?: () => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-2">
      <legend className="float-left flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {label}
        {fromListing && onConfirm && <FromListingBadge onConfirm={onConfirm} />}
      </legend>
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
            <span className="inline-block rounded-full border-2 border-edge bg-paper font-bold text-ink peer-focus-visible:ring-4 peer-focus-visible:ring-violet/40 px-3 py-1.5 text-xs peer-checked:bg-violet peer-checked:text-white">
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
  // Must-have facts filled in by the listing reader that nobody has confirmed yet.
  const [source, setSource] = useState<"manual" | "pasted">("manual");
  const [fromListing, setFromListing] = useState<FactField[]>([]);
  const confirm = (f: FactField) => setFromListing((cur) => cur.filter((x) => x !== f));
  const byHand =
    <T,>(f: FactField, set: (v: T) => void) =>
    (v: T) => {
      set(v);
      confirm(f); // choosing a value yourself counts as confirming it
    };

  function fill(d: Extracted) {
    if (d.area) {
      const m = matchArea(d.area, areas);
      if ("areaId" in m) setAreaId(m.areaId);
      else {
        setAreaId("__new");
        setNewArea(m.newName);
      }
    }
    if (d.rent !== null) setTotalRent(String(d.rent));
    if (d.floor !== null) setFloor(String(d.floor));
    setLift(triOf(d.lift));
    setParking(triOf(d.parking));
    setPets(triOf(d.pets_allowed));
    setBathroomsUnsure(d.bathrooms === null);
    setBathrooms(d.bathrooms === null ? "" : String(d.bathrooms));
    setSource("pasted");
    setFromListing(["lift", "parking", "bathrooms", "pet_friendly"]);
  }

  return (
    <div className="space-y-6">
      <PasteListing groupId={groupId} onExtracted={fill} />
      <form onSubmit={onSubmit} className="space-y-6">
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="source" value={source} />
        {fromListing.map((f) => (
          <input key={f} type="hidden" name="unconfirmed" value={f} />
        ))}
        <input type="hidden" name="code" value={code} />

        <section className="card grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="areaId">
              Area
            </label>
            <select
              id="areaId"
              name="areaId"
              className="input"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              required
            >
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
              Link <span className="font-normal text-faint">(optional)</span>
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
            <p className="hint">
              If you don't know, pick Not sure. The listing gets flagged “confirm before visiting”.
            </p>
          </div>
          <TriField
            name="lift"
            label="Lift"
            value={lift}
            onChange={byHand("lift", setLift)}
            fromListing={fromListing.includes("lift")}
            onConfirm={() => confirm("lift")}
          />
          <TriField
            name="parking"
            label="Parking"
            value={parking}
            onChange={byHand("parking", setParking)}
            fromListing={fromListing.includes("parking")}
            onConfirm={() => confirm("parking")}
          />
          <TriField
            name="petFriendly"
            label="Pet-friendly"
            value={pets}
            onChange={byHand("pet_friendly", setPets)}
            fromListing={fromListing.includes("pet_friendly")}
            onConfirm={() => confirm("pet_friendly")}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <label htmlFor="bathrooms">Bathrooms</label>
              {fromListing.includes("bathrooms") && <FromListingBadge onConfirm={() => confirm("bathrooms")} />}
            </span>
            <div className="flex items-center gap-3">
              <input
                id="bathrooms"
                name="bathrooms"
                type="number"
                min={0}
                max={20}
                className="input w-20"
                value={bathroomsUnsure ? "" : bathrooms}
                onChange={(e) => byHand("bathrooms", setBathrooms)(e.target.value)}
                disabled={bathroomsUnsure}
                required={!bathroomsUnsure}
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  name="bathroomsUnsure"
                  checked={bathroomsUnsure}
                  onChange={(e) => byHand("bathrooms", setBathroomsUnsure)(e.target.checked)}
                  className="size-4 accent-violet"
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
            Notes <span className="font-normal text-faint">(optional)</span>
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

        {fromListing.length > 0 && (
          <p className="text-sm text-give-fg">
            {fromListing.length} must-have fact{fromListing.length === 1 ? "" : "s"} still marked “From listing – not
            confirmed”. That's fine: they count as Not sure until someone confirms them on the listings page.
          </p>
        )}
        <FormMessage state={state} />
        <SubmitButton pendingText="Adding…" pending={pending}>
          Add listing
        </SubmitButton>
      </form>
    </div>
  );
}
