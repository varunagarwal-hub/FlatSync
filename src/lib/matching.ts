import { BOOLEAN_MUST_HAVES, niceToHaveLabel } from "./constants";
import { formatINR, joinNames } from "./format";
import type { Area, AreaRating, Listing, MemberConstraints } from "./types";

export interface MatchMember {
  id: string;
  name: string;
}

export interface MatchInput {
  members: MatchMember[];
  constraints: MemberConstraints[];
  ratings: AreaRating[];
  areas: Area[];
  listings: Listing[];
}

export type ListingStatus = "ruled_out" | "flagged" | "clear";

export interface MemberBreakdown {
  memberId: string;
  name: string;
  /** Even split of the total rent. */
  share: number;
  budget: number;
  gets: string[];
  compromises: string[];
}

export interface ListingResult {
  listing: Listing;
  areaName: string;
  status: ListingStatus;
  /** Why the listing is out. Non-empty iff status is "ruled_out". */
  ruledOutReasons: string[];
  /** What to confirm before visiting. Non-empty iff status is "flagged" (or also ruled out). */
  confirmReasons: string[];
  /** Number of (member, nice-to-have) pairs the listing definitely has. */
  score: number;
  maxScore: number;
  breakdown: MemberBreakdown[];
}

export interface MatchSummary {
  combinedBudget: number;
  /** Every listing, in the order given. */
  results: ListingResult[];
  /** Listings that are not ruled out, best first. */
  shortlist: ListingResult[];
  /** Up to 3 from the shortlist. Always presented as a set, never a single pick. */
  top: ListingResult[];
  counts: { added: number; ruledOut: number; shortlisted: number };
}

export const TOP_N = 3;

export function matchListings(input: MatchInput): MatchSummary {
  const constraintsByMember = new Map(input.constraints.map((c) => [c.member_id, c]));
  // Only members who have answers take part (after the reveal, that's everyone).
  const people = input.members
    .map((m) => ({ ...m, c: constraintsByMember.get(m.id) }))
    .filter((p): p is MatchMember & { c: MemberConstraints } => p.c !== undefined);

  const combinedBudget = people.reduce((sum, p) => sum + p.c.max_rent_share, 0);
  const areaNames = new Map(input.areas.map((a) => [a.id, a.name]));
  const ratings = new Map(input.ratings.map((r) => [`${r.member_id}:${r.area_id}`, r.acceptable]));

  const results = input.listings.map((listing) =>
    evaluateListing(listing, people, combinedBudget, areaNames.get(listing.area_id) ?? "Unknown area", ratings),
  );

  const shortlist = results.filter((r) => r.status !== "ruled_out").sort(compareResults);

  return {
    combinedBudget,
    results,
    shortlist,
    top: shortlist.slice(0, TOP_N),
    counts: {
      added: results.length,
      ruledOut: results.length - shortlist.length,
      shortlisted: shortlist.length,
    },
  };
}

/** More preferences met first; then fewer things to confirm; then cheaper; then older. */
function compareResults(a: ListingResult, b: ListingResult): number {
  return (
    b.score - a.score ||
    a.confirmReasons.length - b.confirmReasons.length ||
    a.listing.total_rent - b.listing.total_rent ||
    a.listing.created_at.localeCompare(b.listing.created_at)
  );
}

function evaluateListing(
  listing: Listing,
  people: (MatchMember & { c: MemberConstraints })[],
  combinedBudget: number,
  areaName: string,
  ratings: Map<string, boolean>,
): ListingResult {
  const ruledOut: string[] = [];
  const confirm: string[] = [];

  // Area
  const rejectedBy = people.filter((p) => ratings.get(`${p.id}:${listing.area_id}`) === false);
  const unratedBy = people.filter((p) => ratings.get(`${p.id}:${listing.area_id}`) === undefined);
  if (rejectedBy.length) {
    ruledOut.push(`${areaName} is not acceptable to ${joinNames(rejectedBy.map((p) => p.name))}`);
  }
  if (unratedBy.length) {
    const verb = unratedBy.length > 1 ? "haven't" : "hasn't";
    confirm.push(`${joinNames(unratedBy.map((p) => p.name))} ${verb} rated ${areaName} yet`);
  }

  // Yes/No must-haves
  for (const mh of BOOLEAN_MUST_HAVES) {
    const needers = people.filter((p) => p.c[mh.need]);
    if (!needers.length) continue;
    const value = listing[mh.field];
    const who = joinNames(needers.map((p) => p.name));
    const verb = needers.length > 1 ? "need" : "needs";
    if (value === "no") ruledOut.push(`No ${mh.label.toLowerCase()}, which ${who} ${verb}`);
    else if (value === "unsure") confirm.push(`${mh.label}: not confirmed (${who} ${verb} it)`);
  }

  // Bathrooms
  const bathNeeders = people.filter((p) => p.c.min_bathrooms > 0);
  if (bathNeeders.length) {
    if (listing.bathrooms === null) {
      const most = Math.max(...bathNeeders.map((p) => p.c.min_bathrooms));
      confirm.push(`Number of bathrooms not confirmed (need at least ${most})`);
    } else {
      const short = bathNeeders.filter((p) => listing.bathrooms! < p.c.min_bathrooms);
      if (short.length) {
        const detail = short.map((p) => `${p.name} needs ${p.c.min_bathrooms}`).join(", ");
        ruledOut.push(`Only ${plural(listing.bathrooms, "bathroom")} (${detail})`);
      }
    }
  }

  // Combined budget
  if (listing.total_rent > combinedBudget) {
    ruledOut.push(
      `${formatINR(listing.total_rent)} is ${formatINR(listing.total_rent - combinedBudget)} over the combined budget of ${formatINR(combinedBudget)}`,
    );
  }

  // Soft preferences
  let score = 0;
  let maxScore = 0;
  for (const p of people) {
    for (const key of p.c.nice_to_haves) {
      maxScore++;
      if (listing.features[key] === "yes") score++;
    }
  }

  const status: ListingStatus = ruledOut.length ? "ruled_out" : confirm.length ? "flagged" : "clear";

  return {
    listing,
    areaName,
    status,
    ruledOutReasons: ruledOut,
    confirmReasons: confirm,
    score,
    maxScore,
    breakdown: people.map((p) => memberBreakdown(listing, p, people.length, areaName, ratings)),
  };
}

function memberBreakdown(
  listing: Listing,
  p: MatchMember & { c: MemberConstraints },
  groupSize: number,
  areaName: string,
  ratings: Map<string, boolean>,
): MemberBreakdown {
  const gets: string[] = [];
  const compromises: string[] = [];
  const share = Math.round(listing.total_rent / groupSize);

  const rating = ratings.get(`${p.id}:${listing.area_id}`);
  if (rating === true) gets.push(`An area they're OK with (${areaName})`);
  else if (rating === undefined) compromises.push(`Hasn't rated ${areaName} yet`);
  else compromises.push(`${areaName} is an area they rejected`);

  if (share <= p.c.max_rent_share) {
    gets.push(`${formatINR(share)} share, within their ${formatINR(p.c.max_rent_share)} max`);
  } else {
    compromises.push(
      `An even split (${formatINR(share)}) is ${formatINR(share - p.c.max_rent_share)} over their ${formatINR(p.c.max_rent_share)} max`,
    );
  }

  for (const mh of BOOLEAN_MUST_HAVES) {
    if (!p.c[mh.need]) continue;
    const value = listing[mh.field];
    if (value === "yes") gets.push(mh.label);
    else if (value === "unsure") compromises.push(`${mh.label} not confirmed yet`);
    else compromises.push(`No ${mh.label.toLowerCase()}`);
  }

  if (p.c.min_bathrooms > 0) {
    if (listing.bathrooms === null) compromises.push("Number of bathrooms not confirmed yet");
    else if (listing.bathrooms >= p.c.min_bathrooms) gets.push(`${plural(listing.bathrooms, "bathroom")}`);
    else compromises.push(`Only ${plural(listing.bathrooms, "bathroom")} (wants ${p.c.min_bathrooms})`);
  }

  for (const key of p.c.nice_to_haves) {
    const label = niceToHaveLabel(key);
    const value = listing.features[key];
    if (value === "yes") gets.push(label);
    else if (value === "no") compromises.push(`${label}: no`);
    else compromises.push(`${label}: unknown`);
  }

  return { memberId: p.id, name: p.name, share, budget: p.c.max_rent_share, gets, compromises };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
