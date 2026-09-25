import Link from "next/link";
import type { MemberGroupData } from "@/lib/data";
import { insideAll, overlapZone, type Circle } from "@/lib/geo";
import { anchorCircle } from "@/lib/matching";
import { memberColor } from "@/lib/memberColors";
import type { Locality } from "@/lib/types";
import { MapView, type MapCircle, type MapPin } from "./MapView";
import { OverlapLocalities } from "./OverlapLocalities";

const STATUS_COLORS = { clear: "#19B38A", flagged: "#FFC226", ruled_out: "#D63A18" } as const;

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
      color: memberColor(i).bg,
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
        <h2 className="text-2xl font-extrabold">Where to look</h2>
        <p className="text-sm text-muted">
          {revealed
            ? "Each circle is one person's radius around their anchor. The yellow zone is inside everyone's radius."
            : "You see only your own radius for now. Everyone's circles and the shared zone appear once everyone has submitted."}
        </p>
      </div>

      {circles.length > 0 || pins.length > 0 ? <MapView circles={circles} pins={pins} showOverlap={revealed} /> : null}

      {myCircleMissing && !me.submitted && (
        <p className="text-sm text-muted">
          <Link href={`/g/${group.code}/constraints`} className="font-medium text-link underline">
            Pick your anchor and radius
          </Link>{" "}
          to see your circle here.
        </p>
      )}

      {circles.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {circles.map((c) => (
            <li key={c.name} className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-full border-2 border-edge" style={{ background: c.color }} />
              {c.name}: {c.radiusKm} km
            </li>
          ))}
          {pins.length > 0 && (
            <li className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-full border-2 border-edge bg-mint" />
              Listings (by area)
            </li>
          )}
        </ul>
      )}

      {revealed && !everyoneHasAnchor && (
        <p className="text-sm text-muted">
          Not everyone set an anchor (their answers were submitted before this feature existed), so there's no shared
          zone to show.
        </p>
      )}
      {everyoneHasAnchor && !hasOverlap && (
        <p className="rounded-lg bg-give px-3 py-2 text-sm text-give-fg">
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
