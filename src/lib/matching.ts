import { BOOLEAN_MUST_HAVES, niceToHaveLabel } from "./constants";
import { formatINR, joinNames } from "./format";
import { distanceKm, type Circle, type LatLng } from "./geo";
import type { Area, AreaRating, FactField, Listing, MemberConstraints, Tri } from "./types";

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
  /** Distance from their anchor to the listing's area, if both are known. */
  distanceKm: number | null;
  gets: string[];
  compromises: string[];
}

export interface ListingResult {
  listing: Listing;
  areaName: string;
  /** Where the listing is on the map (its area's location), if known. */
  location: LatLng | null;
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

/** A must-have as matching sees it: facts taken from a pasted listing count as Not sure until confirmed. */
export function effectiveFact(listing: Listing, field: Exclude<FactField, "bathrooms">): Tri {
  return listing.unconfirmed?.includes(field) ? "unsure" : listing[field];
}

export function effectiveBathrooms(listing: Listing): number | null {
  return listing.unconfirmed?.includes("bathrooms") ? null : listing.bathrooms;
}

export function anchorCircle(c: MemberConstraints): Circle | null {
  return c.anchor_lat !== null && c.anchor_lng !== null && c.radius_km
    ? { lat: c.anchor_lat, lng: c.anchor_lng, radiusKm: c.radius_km }
    : null;
}

type Person = MatchMember & { c: MemberConstraints; circle: Circle | null };

export function matchListings(input: MatchInput): MatchSummary {
  const constraintsByMember = new Map(input.constraints.map((c) => [c.member_id, c]));
  // Only members who have answers take part (after the reveal, that's everyone).
  const people = input.members
    .map((m) => ({ ...m, c: constraintsByMember.get(m.id) }))
    .filter((p): p is MatchMember & { c: MemberConstraints } => p.c !== undefined)
    .map((p): Person => ({ ...p, circle: anchorCircle(p.c) }));

  const combinedBudget = people.reduce((sum, p) => sum + p.c.max_rent_share, 0);
  const areas = new Map(input.areas.map((a) => [a.id, a]));
  const ratings = new Map(input.ratings.map((r) => [`${r.member_id}:${r.area_id}`, r.acceptable]));

  const results = input.listings.map((listing) =>
    evaluateListing(listing, people, combinedBudget, areas.get(listing.area_id), ratings),
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
  people: Person[],
  combinedBudget: number,
  area: Area | undefined,
  ratings: Map<string, boolean>,
): ListingResult {
  const ruledOut: string[] = [];
  const confirm: string[] = [];
  const areaName = area?.name ?? "Unknown area";
  const location = area && area.lat !== null && area.lng !== null ? { lat: area.lat, lng: area.lng } : null;

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
    const value = effectiveFact(listing, mh.field);
    const who = joinNames(needers.map((p) => p.name));
    const verb = needers.length > 1 ? "need" : "needs";
    if (value === "no") ruledOut.push(`No ${mh.label.toLowerCase()}, which ${who} ${verb}`);
    else if (value === "unsure") confirm.push(`${mh.label}: ${unconfirmedNote(listing, mh.field)} (${who} ${verb} it)`);
  }

  // Bathrooms
  const bathNeeders = people.filter((p) => p.c.min_bathrooms > 0);
  if (bathNeeders.length) {
    const baths = effectiveBathrooms(listing);
    if (baths === null) {
      const most = Math.max(...bathNeeders.map((p) => p.c.min_bathrooms));
      confirm.push(`Bathrooms: ${unconfirmedNote(listing, "bathrooms")} (need at least ${most})`);
    } else {
      const short = bathNeeders.filter((p) => baths < p.c.min_bathrooms);
      if (short.length) {
        const detail = short.map((p) => `${p.name} needs ${p.c.min_bathrooms}`).join(", ");
        ruledOut.push(`Only ${plural(baths, "bathroom")} (${detail})`);
      }
    }
  }

  // Anchor radius: a flag, not a rule-out
  const withCircle = people.filter((p) => p.circle);
  if (withCircle.length) {
    if (!location) {
      confirm.push(`Distance not checked: ${areaName} isn't on the map yet`);
    } else {
      const outside = withCircle
        .map((p) => ({ p, d: distanceKm(location, p.circle!) }))
        .filter(({ p, d }) => d > p.circle!.radiusKm);
      if (outside.length) {
        const detail = outside.map(({ p, d }) => `${p.name}'s ${p.circle!.radiusKm} km (${d.toFixed(1)} km away)`);
        confirm.push(`Outside ${joinNames(detail)} radius`);
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
    location,
    status,
    ruledOutReasons: ruledOut,
    confirmReasons: confirm,
    score,
    maxScore,
    breakdown: people.map((p) => memberBreakdown(listing, p, people.length, areaName, location, ratings)),
  };
}

function memberBreakdown(
  listing: Listing,
  p: Person,
  groupSize: number,
  areaName: string,
  location: LatLng | null,
  ratings: Map<string, boolean>,
): MemberBreakdown {
  const gets: string[] = [];
  const compromises: string[] = [];
  const share = Math.round(listing.total_rent / groupSize);

  const rating = ratings.get(`${p.id}:${listing.area_id}`);
  if (rating === true) gets.push(`An area they're OK with (${areaName})`);
  else if (rating === undefined) compromises.push(`Hasn't rated ${areaName} yet`);
  else compromises.push(`${areaName} is an area they rejected`);

  let dist: number | null = null;
  if (p.circle && location) {
    dist = distanceKm(location, p.circle);
    if (dist <= p.circle.radiusKm) gets.push(`${dist.toFixed(1)} km from their anchor (within ${p.circle.radiusKm} km)`);
    else compromises.push(`${dist.toFixed(1)} km from their anchor, outside their ${p.circle.radiusKm} km radius`);
  }

  if (share <= p.c.max_rent_share) {
    gets.push(`${formatINR(share)} share, within their ${formatINR(p.c.max_rent_share)} max`);
  } else {
    compromises.push(
      `An even split (${formatINR(share)}) is ${formatINR(share - p.c.max_rent_share)} over their ${formatINR(p.c.max_rent_share)} max`,
    );
  }

  for (const mh of BOOLEAN_MUST_HAVES) {
    if (!p.c[mh.need]) continue;
    const value = effectiveFact(listing, mh.field);
    if (value === "yes") gets.push(mh.label);
    else if (value === "unsure") compromises.push(`${mh.label} not confirmed yet`);
    else compromises.push(`No ${mh.label.toLowerCase()}`);
  }

  if (p.c.min_bathrooms > 0) {
    const baths = effectiveBathrooms(listing);
    if (baths === null) compromises.push("Number of bathrooms not confirmed yet");
    else if (baths >= p.c.min_bathrooms) gets.push(`${plural(baths, "bathroom")}`);
    else compromises.push(`Only ${plural(baths, "bathroom")} (wants ${p.c.min_bathrooms})`);
  }

  for (const key of p.c.nice_to_haves) {
    const label = niceToHaveLabel(key);
    const value = listing.features[key];
    if (value === "yes") gets.push(label);
    else if (value === "no") compromises.push(`${label}: no`);
    else compromises.push(`${label}: unknown`);
  }

  return { memberId: p.id, name: p.name, share, budget: p.c.max_rent_share, distanceKm: dist, gets, compromises };
}

/** "listing says Yes, not confirmed" for pasted facts; plain "not confirmed" otherwise. */
function unconfirmedNote(listing: Listing, field: FactField): string {
  if (!listing.unconfirmed?.includes(field)) return "not confirmed";
  const raw = field === "bathrooms" ? listing.bathrooms : listing[field];
  if (raw === null || raw === "unsure") return "not stated in the listing";
  const shown = field === "bathrooms" ? String(raw) : raw === "yes" ? "Yes" : "No";
  return `listing says ${shown}, not confirmed`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
