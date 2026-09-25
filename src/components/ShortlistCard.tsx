import type { ListingResult } from "@/lib/matching";
import { ListingDetails, ListingStatusBadge } from "./ListingDetails";
import { PersonBreakdown } from "./PersonBreakdown";

export function ShortlistCard({ result }: { result: ListingResult }) {
  return (
    <article className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <ListingDetails listing={result.listing} areaName={result.areaName} />
        <div className="flex flex-col items-end gap-1">
          <ListingStatusBadge status={result.status} />
          <span className="text-xs text-stone-500">
            {result.score} of {result.maxScore} nice-to-haves met
          </span>
        </div>
      </div>

      {result.confirmReasons.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Confirm before visiting</p>
          <ul className="mt-1 list-disc pl-5">
            {result.confirmReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {result.breakdown.map((p) => (
          <PersonBreakdown key={p.memberId} person={p} />
        ))}
      </div>
    </article>
  );
}
