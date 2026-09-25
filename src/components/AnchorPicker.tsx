"use client";

import { useState } from "react";
import { MapView } from "./MapView";

export interface Anchor {
  label: string;
  lat: number;
  lng: number;
}

interface Place extends Anchor {
  city: string | null;
}

/**
 * Anchor location (geocoded with OpenStreetMap Nominatim) + 3 or 5 km radius.
 * Submits as hidden fields anchorLabel / anchorLat / anchorLng / radiusKm.
 */
export function AnchorPicker({
  anchor,
  radius,
  onAnchor,
  onRadius,
}: {
  anchor: Anchor | null;
  radius: 3 | 5 | null;
  onAnchor: (a: Anchor | null) => void;
  onRadius: (r: 3 | 5) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (q.length < 3) {
      setError("Type at least 3 characters, e.g. your office or a landmark.");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const body = (await res.json()) as { ok: boolean; places?: Place[]; error?: string };
      if (!body.ok) throw new Error(body.error);
      setResults(body.places ?? []);
    } catch (err) {
      setResults(null);
      setError(err instanceof Error && err.message ? err.message : "Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="anchorLabel" value={anchor?.label ?? ""} />
      <input type="hidden" name="anchorLat" value={anchor?.lat ?? ""} />
      <input type="hidden" name="anchorLng" value={anchor?.lng ?? ""} />
      <input type="hidden" name="radiusKm" value={radius ?? ""} />

      {anchor ? (
        <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
          <span>
            <span className="text-stone-500">Anchor: </span>
            {anchor.label}
          </span>
          <button
            type="button"
            className="text-xs font-medium text-teal-700 hover:underline"
            onClick={() => {
              onAnchor(null);
              setResults(null);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="label" htmlFor="anchorQuery">
            Anchor location
          </label>
          <div className="flex gap-2">
            <input
              id="anchorQuery"
              className="input"
              placeholder="e.g. your office, college or a landmark"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter searches instead of submitting the whole form
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
            />
            <button type="button" className="btn-secondary" onClick={search} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {results && results.length === 0 && (
            <p className="text-sm text-stone-600">No matches. Try adding the city, e.g. “Ecospace, Bengaluru”.</p>
          )}
          {results && results.length > 0 && (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
              {results.map((p) => (
                <li key={`${p.lat},${p.lng}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
                    onClick={() => onAnchor({ label: p.label, lat: p.lat, lng: p.lng })}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">Search results come from OpenStreetMap.</p>
        </div>
      )}

      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="label float-left mr-2 mb-0">Radius</legend>
        {([3, 5] as const).map((r) => (
          <label key={r} className="cursor-pointer">
            <input
              type="radio"
              className="peer sr-only"
              name="radiusChoice"
              checked={radius === r}
              onChange={() => onRadius(r)}
            />
            <span className="inline-block rounded-md border border-stone-300 px-3 py-1 text-sm peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600/40">
              {r} km
            </span>
          </label>
        ))}
      </fieldset>

      {anchor && (
        <MapView
          height={220}
          circles={[{ name: "You", lat: anchor.lat, lng: anchor.lng, radiusKm: radius ?? 3, color: "#4f46e5" }]}
        />
      )}
    </div>
  );
}
