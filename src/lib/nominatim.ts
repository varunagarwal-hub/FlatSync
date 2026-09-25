import "server-only";
import type { LatLng } from "./geo";

// OpenStreetMap Nominatim. Usage policy: identify the app, max ~1 request/second,
// no autocomplete, cache results. https://operations.osmfoundation.org/policies/nominatim/
const BASE = "https://nominatim.openstreetmap.org";
const HEADERS = {
  "User-Agent": "FlatSync/1.0 (https://github.com/varunagarwal-hub/FlatSync)",
  "Accept-Language": "en",
};
const WEEK = 60 * 60 * 24 * 7;

export interface Place extends LatLng {
  label: string;
  city: string | null;
}

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  residential?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state_district?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

function cityOf(a: NominatimAddress | undefined): string | null {
  return a?.city ?? a?.town ?? a?.state_district ?? a?.village ?? null;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${BASE}${path}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params })}`;
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: WEEK } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return (await res.json()) as T;
}

/** Up to `limit` places in India matching the text, optionally biased towards a point. */
export async function searchPlaces(q: string, opts: { near?: LatLng | null; limit?: number } = {}): Promise<Place[]> {
  const params: Record<string, string> = { q, countrycodes: "in", limit: String(opts.limit ?? 5) };
  if (opts.near) {
    const d = 0.3; // ~30 km box to prefer nearby matches (not a hard filter)
    params.viewbox = [opts.near.lng - d, opts.near.lat + d, opts.near.lng + d, opts.near.lat - d].join(",");
  }
  const rows = await get<NominatimResult[]>("/search", params);
  return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon), city: cityOf(r.address) }));
}

/** The neighbourhood-level name for a point, e.g. "Koramangala". */
export async function reverseLocality(p: LatLng): Promise<{ name: string; city: string | null } | null> {
  const r = await get<NominatimResult & { error?: string }>("/reverse", {
    lat: String(p.lat),
    lon: String(p.lng),
    zoom: "15",
  });
  if (r.error || !r.address) return null;
  const a = r.address;
  const name = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.residential ?? a.city_district ?? null;
  return name ? { name, city: cityOf(a) } : null;
}
