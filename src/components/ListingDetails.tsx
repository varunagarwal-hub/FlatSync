import { NICE_TO_HAVES } from "@/lib/constants";
import { formatFloor, formatINR } from "@/lib/format";
import type { ListingStatus } from "@/lib/matching";
import type { FactField, Listing, Tri } from "@/lib/types";

const TRI_TEXT: Record<Tri, string> = { yes: "Yes", no: "No", unsure: "Not sure" };
const TRI_TONE: Record<Tri, string> = {
  yes: "text-teal-800",
  no: "text-red-700",
  unsure: "text-amber-700",
};

export function ListingStatusBadge({ status }: { status: ListingStatus | "pending" }) {
  const styles = {
    clear: "bg-teal-50 text-teal-800 ring-teal-200",
    flagged: "bg-amber-50 text-amber-800 ring-amber-200",
    ruled_out: "bg-red-50 text-red-800 ring-red-200",
    pending: "bg-stone-100 text-stone-600 ring-stone-200",
  }[status];
  const text = {
    clear: "Passes everyone's must-haves",
    flagged: "Confirm before visiting",
    ruled_out: "Ruled out",
    pending: "Waiting for everyone's constraints",
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${styles}`}>{text}</span>;
}

/** Area, rent, floor, link and the Yes/No/Not sure facts about a listing. */
export function ListingDetails({ listing, areaName }: { listing: Listing; areaName: string }) {
  const facts: { label: string; value: Tri | string; field: FactField }[] = [
    { label: "Lift", value: listing.lift, field: "lift" },
    { label: "Parking", value: listing.parking, field: "parking" },
    { label: "Pets", value: listing.pet_friendly, field: "pet_friendly" },
    { label: "Bathrooms", value: listing.bathrooms === null ? "unsure" : String(listing.bathrooms), field: "bathrooms" },
  ];
  const unconfirmed = listing.unconfirmed ?? [];
  const features = NICE_TO_HAVES.filter((n) => listing.features[n.key] === "yes");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold">{areaName}</h3>
        <span className="font-medium">{formatINR(listing.total_rent)}/month</span>
        <span className="text-sm text-stone-500">{formatFloor(listing.floor)}</span>
        {listing.url && (
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            View listing ↗
          </a>
        )}
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {facts.map((f) => {
          const isTri = f.value === "yes" || f.value === "no" || f.value === "unsure";
          return (
            <div key={f.label} className="flex gap-1">
              <dt className="text-stone-500">{f.label}:</dt>
              <dd className={isTri ? TRI_TONE[f.value as Tri] : ""}>
                {isTri ? TRI_TEXT[f.value as Tri] : f.value}
                {unconfirmed.includes(f.field) && f.value !== "unsure" && (
                  <span className="text-amber-700" title="From the pasted listing. Counts as Not sure until confirmed.">
                    {" "}(from listing, unconfirmed)
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {features.length > 0 && (
        <p className="text-sm text-stone-600">Has: {features.map((f) => f.label).join(", ")}</p>
      )}
      {listing.notes && <p className="text-sm italic text-stone-600">“{listing.notes}”</p>}
    </div>
  );
}
