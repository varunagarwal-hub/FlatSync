import Link from "next/link";
import type { MemberGroupData } from "@/lib/data";
import { insideAll, overlapZone, type Circle } from "@/lib/geo";
import { anchorCircle } from "@/lib/matching";
import type { Locality } from "@/lib/types";
import { MapView, type MapCircle, type MapPin } from "./MapView";
import { OverlapLocalities } from "./OverlapLocalities";

const MEMBER_COLORS = ["#4f46e5", "#db2777", "#ea580c", "#0891b2", "#65a30d", "#9333ea"];
const STATUS_COLORS = { clear: "#0f766e", flagged: "#d97706", ruled_out: "#dc2626" } as const;

/** Map of everyone's radius (only your own before the reveal) plus the overlap zone's localities. */
export function WhereToLook({ data }: { data: MemberGroupData }) {
  const { group, members, constraints, areas, listings, revealed, match, me } = data;

  const circles: (MapCircle & Circle)[] = [];
  members.forEach((m, i) => {
    const c = constraints.find((x) => x.member_id === m.member_id);
    const circle = c && anchorCircle(c);
    if (!circle || (!revealed && !m.is_me)) return;
    circles.push({
      ...circle,
      name: m.is_me ? `${m.display_name} (you)` : m.display_name,
      color: MEMBER_COLORS[i % MEMBER_COLORS.length],
    });
  });
  const myCircleMissing = !circles.some((c) => c.name.endsWith("(you)"));

  const resultById = new Map(match?.results.map((r) => [r.listing.id, r]));
  const pins: MapPin[] = listings.flatMap((l) => {
    const area = areas.find((a) => a.id === l.area_id);
    if (!area || area.lat === null || area.lng === null) return [];
    const status = resultById.get(l.id)?.status;
    return [
      {
        lat: area.lat,
        lng: area.lng,
        label: `${area.name} · ₹${l.total_rent.toLocaleString("en-IN")}${status ? ` · ${status.replace("_", " ")}` : ""}`,
        color: status ? STATUS_COLORS[status] : "#78716c",
      },
    ];
  });

  const everyoneHasAnchor = revealed && circles.length === members.length;
  const hasOverlap = everyoneHasAnchor && overlapZone(circles).length > 0;
  const areaLocalities: Locality[] = hasOverlap
    ? areas
        .filter((a) => a.lat !== null && a.lng !== null && insideAll({ lat: a.lat, lng: a.lng }, circles))
        .map((a) => ({ name: a.name, city: a.city, lat: a.lat!, lng: a.lng! }))
    : [];

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Where to look</h2>
        <p className="text-sm text-stone-600">
          {revealed
            ? "Each circle is one person's radius around their anchor. The shaded teal zone is inside everyone's radius."
            : "You see only your own radius for now. Everyone's circles and the shared zone appear once everyone has submitted."}
        </p>
      </div>

      {circles.length > 0 || pins.length > 0 ? <MapView circles={circles} pins={pins} showOverlap={revealed} /> : null}

      {myCircleMissing && !me.submitted && (
        <p className="text-sm text-stone-600">
          <Link href={`/g/${group.code}/constraints`} className="font-medium text-teal-700 underline">
            Pick your anchor and radius
          </Link>{" "}
          to see your circle here.
        </p>
      )}

      {circles.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
          {circles.map((c) => (
            <li key={c.name} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full" style={{ background: c.color }} />
              {c.name}: {c.radiusKm} km
            </li>
          ))}
          {pins.length > 0 && (
            <li className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-full border border-stone-800 bg-stone-400" />
              Listings (by area)
            </li>
          )}
        </ul>
      )}

      {revealed && !everyoneHasAnchor && (
        <p className="text-sm text-stone-600">
          Not everyone set an anchor (their answers were submitted before this feature existed), so there's no shared
          zone to show.
        </p>
      )}
      {everyoneHasAnchor && !hasOverlap && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The circles don't all overlap, so no place is within everyone's radius. Every listing will be flagged
          for someone. Talk about who can stretch their distance.
        </p>
      )}
      {hasOverlap && (
        <OverlapLocalities groupId={group.id} stored={group.overlap_localities} fromAreas={areaLocalities} />
      )}
    </section>
  );
}
