import { formatFloor, formatINR } from "@/lib/format";
import type { ListingResult } from "@/lib/matching";
import type { MemberColor } from "@/lib/memberColors";
import { ListingStatusBadge } from "./ListingDetails";
import { PersonBreakdown } from "./PersonBreakdown";

/** One option in the shortlist. Options are lettered, never crowned: the group decides. */
export function ShortlistCard({
  result,
  letter,
  colors,
}: {
  result: ListingResult;
  letter: string;
  colors: Record<string, MemberColor>;
}) {
  const { listing } = result;
  const pct = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;
  const baths = listing.unconfirmed.includes("bathrooms") || listing.bathrooms === null ? null : listing.bathrooms;

  return (
    <article className="overflow-hidden rounded-[22px] border-2 border-edge bg-paper shadow-[5px_5px_0_var(--shadow)]">
      <div className="space-y-2 px-4 pt-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="pill-dark">Option {letter}</span>
          <ListingStatusBadge status={result.status} />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-2xl font-extrabold">{result.areaName}</h3>
          {listing.url && (
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-sm font-bold text-link underline decoration-2 underline-offset-2"
            >
              View listing ↗
            </a>
          )}
        </div>
        <p className="flex flex-wrap gap-x-2 text-sm font-medium">
          <span>{formatINR(listing.total_rent)}/mo</span>
          <span className="text-faint">·</span>
          <span>{formatFloor(listing.floor)}</span>
          {baths !== null && (
            <>
              <span className="text-faint">·</span>
              <span>
                {baths} bath{baths === 1 ? "" : "s"}
              </span>
            </>
          )}
        </p>
        {result.maxScore > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <div
              className="flex h-3 flex-1 overflow-hidden rounded-full border-2 border-edge bg-soft"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={result.maxScore}
              aria-valuenow={result.score}
              aria-label="Nice-to-haves met"
            >
              <div className="bg-violet" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold whitespace-nowrap">
              {result.score} of {result.maxScore} wishes
            </span>
          </div>
        )}
        {listing.notes && <p className="text-sm text-muted italic">“{listing.notes}”</p>}
      </div>

      {result.confirmReasons.length > 0 && (
        <div className="border-t-2 border-edge bg-sun/25 px-4 py-3 text-sm">
          <p className="font-bold">Confirm before visiting</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {result.confirmReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="divide-y divide-dashed divide-line border-t-2 border-edge">
        {result.breakdown.map((p) => (
          <PersonBreakdown key={p.memberId} person={p} color={colors[p.memberId]} />
        ))}
      </div>
    </article>
  );
}
