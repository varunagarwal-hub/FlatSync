import { describe, expect, it } from "vitest";
import { matchListings, type MatchInput } from "./matching";
import type { Listing, MemberConstraints } from "./types";

const members = [
  { id: "a", name: "Asha" },
  { id: "b", name: "Bea" },
  { id: "c", name: "Chitra" },
];
const areas = [
  { id: "koramangala", name: "Koramangala" },
  { id: "hsr", name: "HSR Layout" },
  { id: "whitefield", name: "Whitefield" },
];

function constraints(member_id: string, over: Partial<MemberConstraints> = {}): MemberConstraints {
  return {
    member_id,
    max_rent_share: 20000,
    needs_lift: false,
    needs_parking: false,
    min_bathrooms: 0,
    needs_pet_friendly: false,
    nice_to_haves: [],
    submitted_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

let seq = 0;
function listing(over: Partial<Listing> = {}): Listing {
  seq++;
  return {
    id: `l${seq}`,
    area_id: "koramangala",
    total_rent: 45000,
    floor: 2,
    url: null,
    lift: "yes",
    parking: "yes",
    bathrooms: 3,
    pet_friendly: "yes",
    features: {},
    notes: null,
    added_by: "a",
    created_at: `2026-09-0${Math.min(seq, 9)}T00:00:00Z`,
    ...over,
  };
}

// Everyone accepts Koramangala and HSR; Chitra rejects Whitefield.
const ratings = [
  ...members.flatMap((m) => [
    { member_id: m.id, area_id: "koramangala", acceptable: true },
    { member_id: m.id, area_id: "hsr", acceptable: true },
  ]),
  { member_id: "a", area_id: "whitefield", acceptable: true },
  { member_id: "b", area_id: "whitefield", acceptable: true },
  { member_id: "c", area_id: "whitefield", acceptable: false },
];

function run(listings: Listing[], cs?: MemberConstraints[], extra: Partial<MatchInput> = {}) {
  return matchListings({
    members,
    constraints: cs ?? members.map((m) => constraints(m.id)),
    ratings,
    areas,
    listings,
    ...extra,
  });
}

describe("hard filters", () => {
  it("passes a listing that breaks nothing", () => {
    const r = run([listing()]).results[0];
    expect(r.status).toBe("clear");
    expect(r.ruledOutReasons).toEqual([]);
    expect(r.confirmReasons).toEqual([]);
  });

  it("rules out a listing in an area anyone rejected", () => {
    const r = run([listing({ area_id: "whitefield" })]).results[0];
    expect(r.status).toBe("ruled_out");
    expect(r.ruledOutReasons.join()).toMatch(/Whitefield is not acceptable to Chitra/);
  });

  it("rules out a listing over the combined budget, but not one exactly at it", () => {
    const [over, exact] = run([listing({ total_rent: 60001 }), listing({ total_rent: 60000 })]).results;
    expect(over.status).toBe("ruled_out");
    expect(over.ruledOutReasons.join()).toMatch(/over the combined budget/);
    expect(exact.status).toBe("clear");
  });

  it("uses the sum of individual budgets as the combined budget", () => {
    const cs = [
      constraints("a", { max_rent_share: 15000 }),
      constraints("b", { max_rent_share: 20000 }),
      constraints("c", { max_rent_share: 25000 }),
    ];
    const summary = run([listing({ total_rent: 60000 })], cs);
    expect(summary.combinedBudget).toBe(60000);
    expect(summary.results[0].status).toBe("clear");
  });

  it("rules out when a needed must-have is No", () => {
    const cs = members.map((m) => constraints(m.id, { needs_lift: m.id === "b" }));
    const r = run([listing({ lift: "no" })], cs).results[0];
    expect(r.status).toBe("ruled_out");
    expect(r.ruledOutReasons).toContain("No lift, which Bea needs");
  });

  it("ignores must-haves nobody needs", () => {
    const r = run([listing({ lift: "no", parking: "no", pet_friendly: "no", bathrooms: 1 })]).results[0];
    expect(r.status).toBe("clear");
  });

  it("rules out when bathrooms are below anyone's minimum", () => {
    const cs = members.map((m) => constraints(m.id, { min_bathrooms: m.id === "c" ? 3 : 1 }));
    const r = run([listing({ bathrooms: 2 })], cs).results[0];
    expect(r.status).toBe("ruled_out");
    expect(r.ruledOutReasons).toContain("Only 2 bathrooms (Chitra needs 3)");
  });
});

describe("not sure = confirm before visiting", () => {
  it("flags instead of passing when a needed must-have is Not sure", () => {
    const cs = members.map((m) => constraints(m.id, { needs_parking: m.id !== "a" }));
    const r = run([listing({ parking: "unsure" })], cs).results[0];
    expect(r.status).toBe("flagged");
    expect(r.confirmReasons).toEqual(["Parking: not confirmed (Bea and Chitra need it)"]);
  });

  it("flags unknown bathroom count when someone has a minimum", () => {
    const cs = members.map((m) => constraints(m.id, { min_bathrooms: 2 }));
    const r = run([listing({ bathrooms: null })], cs).results[0];
    expect(r.status).toBe("flagged");
    expect(r.confirmReasons[0]).toMatch(/bathrooms not confirmed \(need at least 2\)/);
  });

  it("does not flag Not sure on a must-have nobody needs", () => {
    const r = run([listing({ lift: "unsure" })]).results[0];
    expect(r.status).toBe("clear");
  });

  it("flags an area someone hasn't rated", () => {
    const r = run([listing({ area_id: "new-area" })], undefined, {
      areas: [...areas, { id: "new-area", name: "Indiranagar" }],
    }).results[0];
    expect(r.status).toBe("flagged");
    expect(r.confirmReasons[0]).toMatch(/Asha, Bea and Chitra haven't rated Indiranagar/);
  });

  it("a hard failure wins over a flag", () => {
    const cs = members.map((m) => constraints(m.id, { needs_lift: true, needs_parking: true }));
    const r = run([listing({ lift: "no", parking: "unsure" })], cs).results[0];
    expect(r.status).toBe("ruled_out");
  });
});

describe("ranking and shortlist", () => {
  const cs = [
    constraints("a", { nice_to_haves: ["balcony", "furnished"] }),
    constraints("b", { nice_to_haves: ["balcony"] }),
    constraints("c", { nice_to_haves: ["gym"] }),
  ];

  it("scores one point per member per nice-to-have that is Yes", () => {
    const r = run([listing({ features: { balcony: "yes", gym: "unsure", furnished: "no" } })], cs).results[0];
    expect(r.score).toBe(2); // balcony for Asha + balcony for Bea
    expect(r.maxScore).toBe(4);
  });

  it("ranks by preferences met and returns at most 3", () => {
    const l1 = listing({ features: { gym: "yes" } }); // 1
    const l2 = listing({ features: { balcony: "yes", furnished: "yes", gym: "yes" } }); // 4
    const l3 = listing({ features: {} }); // 0
    const l4 = listing({ features: { balcony: "yes" } }); // 2
    const l5 = listing({ features: { balcony: "yes", furnished: "yes", gym: "yes" }, area_id: "whitefield" }); // out
    const s = run([l1, l2, l3, l4, l5], cs);
    expect(s.top.map((r) => r.listing.id)).toEqual([l2.id, l4.id, l1.id]);
    expect(s.shortlist).toHaveLength(4);
    expect(s.counts).toEqual({ added: 5, ruledOut: 1, shortlisted: 4 });
  });

  it("breaks ties by fewer things to confirm, then lower rent", () => {
    const needsLift = cs.map((c) => ({ ...c, needs_lift: true }));
    const flagged = listing({ lift: "unsure", total_rent: 30000 });
    const pricey = listing({ total_rent: 50000 });
    const cheap = listing({ total_rent: 40000 });
    const s = run([flagged, pricey, cheap], needsLift);
    expect(s.shortlist.map((r) => r.listing.id)).toEqual([cheap.id, pricey.id, flagged.id]);
  });

  it("keeps flagged listings on the shortlist", () => {
    const needsPets = cs.map((c) => ({ ...c, needs_pet_friendly: true }));
    const s = run([listing({ pet_friendly: "unsure" })], needsPets);
    expect(s.top).toHaveLength(1);
    expect(s.top[0].status).toBe("flagged");
  });

  it("returns an empty shortlist when nothing passes", () => {
    const s = run([listing({ total_rent: 999999 })]);
    expect(s.top).toEqual([]);
    expect(s.counts).toEqual({ added: 1, ruledOut: 1, shortlisted: 0 });
  });
});

describe("per-person breakdown", () => {
  it("lists what each person gets and compromises on", () => {
    const cs = [
      constraints("a", { max_rent_share: 12000, needs_lift: true, nice_to_haves: ["balcony", "gym"] }),
      constraints("b", { max_rent_share: 25000, min_bathrooms: 2, nice_to_haves: ["ac"] }),
      constraints("c", { max_rent_share: 25000 }),
    ];
    const r = run([listing({ total_rent: 45000, features: { balcony: "yes", gym: "no" } })], cs).results[0];
    const [asha, bea, chitra] = r.breakdown;

    expect(asha.share).toBe(15000);
    expect(asha.gets).toEqual(expect.arrayContaining(["Lift", "Balcony"]));
    expect(asha.compromises).toEqual(
      expect.arrayContaining(["Gym: no",expect.stringMatching(/over their ₹12,000 max/)]),
    );

    expect(bea.gets).toEqual(expect.arrayContaining(["3 bathrooms"]));
    expect(bea.compromises).toContain("AC: unknown");

    expect(chitra.compromises).toEqual([]);
    expect(chitra.gets[0]).toMatch(/Koramangala/);
  });
});
