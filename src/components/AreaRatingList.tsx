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
    return <p className="text-sm text-stone-500">No areas yet. Add the areas you're considering below.</p>;
  }
  return (
    <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
      {areas.map((area) => (
        <li key={area.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span className="text-sm">{area.name}</span>
          <div className="flex gap-1" role="radiogroup" aria-label={area.name}>
            {(
              [
                ["yes", "Acceptable", "peer-checked:bg-teal-700 peer-checked:text-white peer-checked:border-teal-700"],
                ["no", "Not acceptable", "peer-checked:bg-red-700 peer-checked:text-white peer-checked:border-red-700"],
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
                  className={`inline-block rounded-md border border-stone-300 px-2.5 py-1 text-xs peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600/40 ${checked}`}
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
