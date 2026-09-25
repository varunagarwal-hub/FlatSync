import polygonClipping, { type MultiPolygon, type Ring } from "polygon-clipping";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Circle extends LatLng {
  radiusKm: number;
}

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function insideCircle(p: LatLng, c: Circle): boolean {
  return distanceKm(p, c) <= c.radiusKm;
}

/** Inside every circle, i.e. inside the overlap zone. */
export function insideAll(p: LatLng, circles: Circle[]): boolean {
  return circles.every((c) => insideCircle(p, c));
}

/** A circle as a closed polygon ring of [lng, lat] points. */
export function circleRing(c: Circle, steps = 72): Ring {
  const ring: Ring = [];
  const d = c.radiusKm / EARTH_KM;
  const lat1 = rad(c.lat);
  const lng1 = rad(c.lng);
  for (let i = 0; i <= steps; i++) {
    const brng = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([deg(lng2), deg(lat2)]);
  }
  return ring;
}

/** The area inside every circle, as [lng, lat] polygons. Empty if they don't all overlap. */
export function overlapZone(circles: Circle[]): MultiPolygon {
  if (!circles.length) return [];
  const polys = circles.map((c) => [circleRing(c)]);
  if (polys.length === 1) return [polys[0]];
  return polygonClipping.intersection(polys[0], ...polys.slice(1));
}

/**
 * A handful of points spread inside the overlap zone, used to look up the
 * localities it covers. Always includes a central point when one exists.
 */
export function samplePoints(circles: Circle[], max = 5): LatLng[] {
  const zone = overlapZone(circles);
  if (!zone.length) return [];
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const poly of zone) {
    for (const [lng, lat] of poly[0]) {
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    }
  }
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  const grid: LatLng[] = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const p = { lat: minLat + ((i + 0.5) / n) * (maxLat - minLat), lng: minLng + ((j + 0.5) / n) * (maxLng - minLng) };
      if (insideAll(p, circles)) grid.push(p);
    }
  }
  // Farthest-point picking keeps the samples spread out.
  const picked: LatLng[] = insideAll(center, circles) ? [center] : grid.length ? [grid[0]] : [];
  while (picked.length < max) {
    let best: LatLng | null = null;
    let bestDist = -1;
    for (const p of grid) {
      const d = Math.min(...picked.map((q) => distanceKm(p, q)));
      if (d > bestDist) { bestDist = d; best = p; }
    }
    if (!best || bestDist < 0.4) break; // closer than ~400 m adds nothing
    picked.push(best);
  }
  return picked;
}
