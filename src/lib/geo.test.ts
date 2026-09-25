import { describe, expect, it } from "vitest";
import { distanceKm, insideAll, overlapZone, samplePoints } from "./geo";
import { acres99Url, noBrokerUrl } from "./searchLinks";

const koramangala = { lat: 12.9352, lng: 77.6245 };
const hsr = { lat: 12.9116, lng: 77.6389 };
const whitefield = { lat: 12.9698, lng: 77.75 };

describe("geo", () => {
  it("measures distances in km", () => {
    expect(distanceKm(koramangala, hsr)).toBeCloseTo(3.05, 1);
    expect(distanceKm(koramangala, whitefield)).toBeCloseTo(14.1, 0);
  });

  it("finds an overlap zone only when all circles intersect", () => {
    const a = { ...koramangala, radiusKm: 3 };
    const b = { ...hsr, radiusKm: 5 };
    expect(overlapZone([a, b]).length).toBeGreaterThan(0);
    expect(overlapZone([a, { ...whitefield, radiusKm: 5 }])).toEqual([]);
  });

  it("samples points that are inside every circle", () => {
    const circles = [
      { ...koramangala, radiusKm: 5 },
      { ...hsr, radiusKm: 5 },
    ];
    const pts = samplePoints(circles, 5);
    expect(pts.length).toBeGreaterThan(1);
    expect(pts.length).toBeLessThanOrEqual(5);
    for (const p of pts) expect(insideAll(p, circles)).toBe(true);
  });
});

describe("search links", () => {
  it("builds NoBroker and 99acres locality URLs with site city names", () => {
    expect(noBrokerUrl("HSR Layout", "Bengaluru")).toBe("https://www.nobroker.in/flats-for-rent-in-hsr-layout_bangalore");
    expect(acres99Url("Sector 45", "Gurugram")).toBe("https://www.99acres.com/rent-property-in-sector-45-gurgaon-ffid");
  });
});
