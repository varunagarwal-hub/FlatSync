"use client";

import { useActionState } from "react";
import { setListingFact } from "@/app/actions/listings";
import type { FactField, Listing, Tri } from "@/lib/types";
import { FormMessage, SubmitButton } from "./FormBits";

const LABELS: Record<FactField, string> = {
  lift: "Lift",
  parking: "Parking",
  bathrooms: "Bathrooms",
  pet_friendly: "Pet-friendly",
};
const TRI_TEXT: Record<Tri, string> = { yes: "Yes", no: "No", unsure: "Not sure" };

function current(listing: Listing, field: FactField): string {
  const raw = field === "bathrooms" ? listing.bathrooms : listing[field];
  const shown = raw === null ? "Not sure" : typeof raw === "number" ? String(raw) : TRI_TEXT[raw];
  return listing.unconfirmed.includes(field)
    ? raw === null || raw === "unsure"
      ? "Not stated in the listing"
      : `Listing says ${shown} – not confirmed`
    : shown;
}

function FactRow({ listing, field, code }: { listing: Listing; field: FactField; code: string }) {
  const [state, action] = useActionState(setListingFact, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <input type="hidden" name="listingId" value={listing.id} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="field" value={field} />
      <span>
        <span className="font-medium">{LABELS[field]}:</span>{" "}
        <span className="text-amber-800">{current(listing, field)}</span>
      </span>
      {field === "bathrooms" ? (
        <span className="flex items-center gap-2">
          <input
            name="value"
            type="number"
            min={0}
            max={20}
            required
            aria-label="Number of bathrooms"
            defaultValue={listing.bathrooms ?? ""}
            className="input w-20 py-1"
          />
          <SubmitButton variant="secondary" pendingText="…">
            Confirm
          </SubmitButton>
        </span>
      ) : (
        <span className="flex gap-1">
          {(["yes", "no", "unsure"] as const).map((v) => (
            <SubmitButton key={v} name="value" value={v} variant="secondary" pendingText="…">
              {TRI_TEXT[v]}
            </SubmitButton>
          ))}
        </span>
      )}
      {state?.error && (
        <div className="w-full">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

/** Must-have facts that still need a human: pasted-and-unconfirmed, or Not sure. */
export function ListingFacts({ listing, code }: { listing: Listing; code: string }) {
  const fields = (["lift", "parking", "bathrooms", "pet_friendly"] as const).filter(
    (f) =>
      listing.unconfirmed.includes(f) || (f === "bathrooms" ? listing.bathrooms === null : listing[f] === "unsure"),
  );
  if (!fields.length) return null;
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1">
      <summary className="cursor-pointer py-1 text-sm font-medium text-amber-900">
        {fields.length} fact{fields.length === 1 ? "" : "s"} to confirm (called the owner or visited? Update them here)
      </summary>
      <div className="divide-y divide-amber-100">
        {fields.map((f) => (
          <FactRow key={f} listing={listing} field={f} code={code} />
        ))}
      </div>
    </details>
  );
}
