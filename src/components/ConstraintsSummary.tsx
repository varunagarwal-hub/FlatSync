import { niceToHaveLabel } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import type { MemberColor } from "@/lib/memberColors";
import type { Area, AreaRating, MemberConstraints } from "@/lib/types";
import { Avatar } from "./Avatar";

/** Read-only view of one member's answers. */
export function ConstraintsSummary({
  name,
  color,
  c,
  areas,
  ratings,
}: {
  name: string;
  color?: MemberColor;
  c: MemberConstraints;
  areas: Area[];
  ratings: AreaRating[];
}) {
  const mine = ratings.filter((r) => r.member_id === c.member_id);
  const nameOf = (id: string) => areas.find((a) => a.id === id)?.name ?? "?";
  const ok = mine.filter((r) => r.acceptable).map((r) => nameOf(r.area_id));
  const no = mine.filter((r) => !r.acceptable).map((r) => nameOf(r.area_id));
  const musts = [
    c.needs_lift && "Lift",
    c.needs_parking && "Parking",
    c.needs_pet_friendly && "Pet-friendly",
    c.min_bathrooms > 0 && `${c.min_bathrooms}+ bathroom${c.min_bathrooms === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border-2 border-line bg-soft p-3.5 text-sm">
      <h3 className="mb-2.5 flex items-center gap-2 text-base font-extrabold">
        {color && <Avatar name={name} color={color} size={26} />}
        {name}
      </h3>
      <dl className="space-y-1">
        <Row label="Max share" value={formatINR(c.max_rent_share)} />
        <Row
          label="Anchor"
          value={c.anchor_lat !== null && c.radius_km ? `${c.anchor_label ?? "Pinned location"} (${c.radius_km} km)` : "Not set"}
        />
        <Row label="OK areas" value={ok.join(", ") || "—"} />
        <Row label="Not OK" value={no.join(", ") || "—"} />
        <Row label="Must-haves" value={musts.join(", ") || "None"} />
        <Row label="Nice-to-haves" value={c.nice_to_haves.map(niceToHaveLabel).join(", ") || "None"} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-faint">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
