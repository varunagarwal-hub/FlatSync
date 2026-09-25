"use client";

import { useEffect, useState } from "react";
import { acres99Url, noBrokerUrl } from "@/lib/searchLinks";
import type { Locality } from "@/lib/types";

/**
 * Localities inside everyone's radius, each with links to NoBroker and 99acres
 * search pages. The links only open those sites in a new tab; nothing is fetched.
 */
export function OverlapLocalities({
  groupId,
  stored,
  fromAreas,
}: {
  groupId: string;
  /** Saved lookup result; null means it hasn't been looked up yet. */
  stored: Locality[] | null;
  /** The group's own areas that sit inside the overlap zone. */
  fromAreas: Locality[];
}) {
  const [looked, setLooked] = useState<Locality[] | null>(stored);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stored !== null) return;
    let cancelled = false;
    fetch("/api/overlap-localities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    })
      .then((r) => r.json())
      .then((body: { ok: boolean; localities?: Locality[]; error?: string }) => {
        if (cancelled) return;
        if (body.ok) setLooked(body.localities ?? []);
        else setError(body.error ?? "Couldn't look up localities.");
      })
      .catch(() => !cancelled && setError("Couldn't look up localities. Reload the page to try again."));
    return () => {
      cancelled = true;
    };
  }, [groupId, stored]);

  const all: Locality[] = [];
  for (const l of [...fromAreas, ...(looked ?? [])]) {
    if (!all.some((x) => x.name.toLowerCase() === l.name.toLowerCase())) all.push(l);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-extrabold">Search inside the yellow zone</h3>
      {all.length > 0 && (
        <ul className="divide-y-2 divide-dashed divide-line overflow-hidden rounded-[18px] border-2 border-edge bg-paper">
          {all.map((l) => (
            <li key={l.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm font-bold">
              <span>
                {l.name}
                {l.city && <span className="text-faint">, {l.city}</span>}
              </span>
              <span className="flex gap-2">
                <a className="btn-secondary min-h-9 px-3 py-1 text-xs" href={noBrokerUrl(l.name, l.city)} target="_blank" rel="noopener noreferrer">
                  NoBroker ↗
                </a>
                <a className="btn-secondary min-h-9 px-3 py-1 text-xs" href={acres99Url(l.name, l.city)} target="_blank" rel="noopener noreferrer">
                  99acres ↗
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      {looked === null && !error && <p className="text-sm text-faint">Looking up localities in the overlap zone…</p>}
      {error && <p className="text-sm text-give-fg">{error}</p>}
      {looked !== null && all.length === 0 && (
        <p className="text-sm text-faint">No named localities found in the overlap zone.</p>
      )}
      <p className="hint">
        These open each site's own search in a new tab. Found something? Add it here with “Add listing” or “Paste listing”.
      </p>
    </div>
  );
}
