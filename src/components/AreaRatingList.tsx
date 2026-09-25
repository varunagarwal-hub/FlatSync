"use client";

import type { Area } from "@/lib/types";

export type RatingValue = "yes" | "no" | "";

/** One Acceptable / Not acceptable choice per area. Submits as `area:<id>` = yes | no. */
export function AreaRatingList({
  areas,
  value,
  onChange,
}: {
  areas: Area[];
  value: Record<string, RatingValue>;
  onChange: (areaId: string, v: RatingValue) => void;
}) {
  if (!areas.length) {
    return <p className="text-sm text-faint">No areas yet. Add the areas you're considering below.</p>;
  }
  return (
    <ul className="divide-y-2 divide-dashed divide-line overflow-hidden rounded-[18px] border-2 border-edge bg-paper">
      {areas.map((area) => (
        <li key={area.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm">{area.name}</span>
          <div className="flex gap-1" role="radiogroup" aria-label={area.name}>
            {(
              [
                ["yes", "Acceptable", "peer-checked:bg-mint peer-checked:text-night"],
                ["no", "Not acceptable", "peer-checked:bg-coral peer-checked:text-night"],
              ] as const
            ).map(([v, label, checked]) => (
              <label key={v} className="cursor-pointer">
                <input
                  type="radio"
                  className="peer sr-only"
                  name={`area:${area.id}`}
                  value={v}
                  checked={value[area.id] === v}
                  onChange={() => onChange(area.id, v)}
                />
                <span
                  className={`inline-block rounded-full border-2 border-edge bg-paper px-3 py-1.5 text-xs font-bold text-ink peer-focus-visible:ring-4 peer-focus-visible:ring-violet/40 ${checked}`}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
