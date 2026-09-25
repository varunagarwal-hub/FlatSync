import Link from "next/link";
import { notFound } from "next/navigation";
import { Counter } from "@/components/Counter";
import { ListingDetails, ListingStatusBadge } from "@/components/ListingDetails";
import { ListingFacts } from "@/components/ListingFacts";
import { loadGroup } from "@/lib/data";

export default async function ListingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadGroup(code);
  if (data.kind !== "member") notFound();

  const { group, listings, areas, members, match } = data;
  const resultById = new Map(match?.results.map((r) => [r.listing.id, r]));
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? "Unknown area";
  const memberName = (id: string) => members.find((m) => m.member_id === id)?.display_name ?? "someone";

  return (
    <div className="space-y-6">
      <Counter
        added={listings.length}
        ruledOut={match?.counts.ruledOut ?? null}
        shortlisted={match?.counts.shortlisted ?? null}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All listings</h2>
        <Link href={`/g/${group.code}/listings/new`} className="btn-primary">
          Add listing
        </Link>
      </div>

      {listings.length === 0 && (
        <p className="card text-sm text-muted">
          No listings yet. Anyone in the group can add one they've found. This app never searches for listings itself.
        </p>
      )}

      <ul className="space-y-3">
        {listings.map((listing) => {
          const r = resultById.get(listing.id);
          return (
            <li key={listing.id} className={`card space-y-3 ${r?.status === "ruled_out" ? "opacity-75" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <ListingDetails listing={listing} areaName={areaName(listing.area_id)} />
                <ListingStatusBadge status={r?.status ?? "pending"} />
              </div>
              {r && r.ruledOutReasons.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-bad-fg">
                  {r.ruledOutReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              {r && r.confirmReasons.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-give-fg">
                  {r.confirmReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
              <ListingFacts listing={listing} code={group.code} />
              <p className="hint">
                Added by {memberName(listing.added_by)}
                {listing.source === "pasted" && " · filled in from a pasted listing"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
