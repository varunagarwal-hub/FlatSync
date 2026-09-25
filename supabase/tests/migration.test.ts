// Runs the real migration in PGlite (in-process Postgres) with a stub of
// Supabase's auth schema and roles, then checks the privacy rules as each user.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- Supabase grants table access broadly and relies on RLS
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const users = {
  asha: "00000000-0000-0000-0000-00000000000a",
  bea: "00000000-0000-0000-0000-00000000000b",
  chitra: "00000000-0000-0000-0000-00000000000c",
  dev: "00000000-0000-0000-0000-00000000000d",
  eve: "00000000-0000-0000-0000-00000000000e",
  fay: "00000000-0000-0000-0000-00000000000f",
  gus: "00000000-0000-0000-0000-000000000010",
};

let db: PGlite;

async function as<T>(user: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    await tx.exec("set local role authenticated");
    return fn(tx);
  });
}

async function q<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) {
  return as(user, async (tx) => (await tx.query<T>(sql, params)).rows);
}

async function save(
  user: string,
  group: string,
  maxRent: number,
  ratings: Record<string, boolean>,
  submit: boolean,
  anchor: { lat: number; lng: number; radius: number } | null = { lat: 12.9352, lng: 77.6245, radius: 5 },
) {
  await q(
    user,
    `select save_constraints(p_group => $1, p_max_rent_share => $2, p_needs_lift => true, p_needs_parking => false,
       p_min_bathrooms => 2, p_needs_pet_friendly => false, p_nice_to_haves => $3, p_ratings => $4, p_submit => $5,
       p_anchor_label => $6, p_anchor_lat => $7, p_anchor_lng => $8, p_radius_km => $9)`,
    [group, maxRent, ["balcony"], JSON.stringify(ratings), submit, anchor ? "Test anchor" : null, anchor?.lat ?? null, anchor?.lng ?? null, anchor?.radius ?? null],
  );
}

let code: string;
let group: string;
let area1: string;
let area2: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(Object.values(users).map((id) => `insert into auth.users values ('${id}');`).join("\n"));
  for (const file of ["0001_init.sql", "0002_maps_and_paste.sql", "0003_group_size.sql"]) {
    await db.exec(readFileSync(join(__dirname, "../migrations", file), "utf8"));
  }
}, 30_000);

describe("groups and membership", () => {
  it("creates a group with a 6-character code", async () => {
    [{ code }] = await q<{ code: string }>(users.asha, "select create_group('Flat hunt', 'Asha') as code");
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    [{ id: group }] = await q<{ id: string }>(users.asha, "select id from groups where code = $1", [code]);
  });

  it("hides the group from non-members", async () => {
    expect(await q(users.bea, "select * from groups")).toHaveLength(0);
  });

  it("lets people join by code (case-insensitive) and rejects duplicate names", async () => {
    await q(users.bea, "select join_group($1, 'Bea')", [code.toLowerCase()]);
    await expect(q(users.chitra, "select join_group($1, 'bea')", [code])).rejects.toThrow(/already called/);
    await q(users.chitra, "select join_group($1, 'Chitra')", [code]);
    expect(await q(users.bea, "select * from groups")).toHaveLength(1);
  });

  it("re-joining is a no-op and a 4th member is refused", async () => {
    await q(users.bea, "select join_group($1, 'Bea')", [code]);
    await expect(q(users.dev, "select join_group($1, 'Dev')", [code])).rejects.toThrow("This group is full (3 people)");
    expect(await q(users.asha, "select * from members")).toHaveLength(3);
  });

  it("rejects unknown codes", async () => {
    await expect(q(users.dev, "select join_group('ZZZZZZ', 'Dev')")).rejects.toThrow(/No group found/);
  });

  it("blocks direct inserts into members", async () => {
    await expect(
      q(users.dev, "insert into members (group_id, user_id, display_name) values ($1, $2, 'Dev')", [group, users.dev]),
    ).rejects.toThrow();
  });
});

describe("areas and listings", () => {
  it("adds areas, de-duplicating by name", async () => {
    [{ id: area1 }] = await q<{ id: string }>(users.asha, "select add_area($1, 'Koramangala') as id", [group]);
    const [{ id: again }] = await q<{ id: string }>(users.bea, "select add_area($1, ' koramangala ') as id", [group]);
    expect(again).toBe(area1);
    [{ id: area2 }] = await q<{ id: string }>(users.bea, "select add_area($1, 'HSR Layout') as id", [group]);
    await expect(q(users.dev, "select add_area($1, 'Nope')", [group])).rejects.toThrow(/not a member/);
  });

  it("lets members add listings only as themselves", async () => {
    const [{ id: ashaMember }] = await q<{ id: string }>(users.asha, "select my_member_id($1) as id", [group]);
    const [{ id: beaMember }] = await q<{ id: string }>(users.bea, "select my_member_id($1) as id", [group]);
    const insert = `insert into listings (group_id, area_id, total_rent, floor, url, lift, parking, bathrooms, pet_friendly, added_by)
                    values ($1, $2, 45000, 3, 'https://example.com/flat', 'yes', 'unsure', 2, 'no', $3)`;
    await q(users.asha, insert, [group, area1, ashaMember]);
    await expect(q(users.asha, insert, [group, area1, beaMember])).rejects.toThrow(/row-level security/);
    await expect(q(users.dev, insert, [group, area1, ashaMember])).rejects.toThrow(/row-level security/);
    expect(await q(users.chitra, "select * from listings")).toHaveLength(1);
    expect(await q(users.dev, "select * from listings")).toHaveLength(0);
  });

  it("rejects non-http links", async () => {
    const [{ id: me }] = await q<{ id: string }>(users.asha, "select my_member_id($1) as id", [group]);
    await expect(
      q(
        users.asha,
        `insert into listings (group_id, area_id, total_rent, floor, url, lift, parking, pet_friendly, added_by)
         values ($1, $2, 1, 1, 'javascript:alert(1)', 'yes', 'yes', 'yes', $3)`,
        [group, area1, me],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("private constraints", () => {
  it("refuses to submit without an anchor and radius", async () => {
    await expect(save(users.asha, group, 20000, { [area1]: true, [area2]: false }, true, null)).rejects.toThrow(/anchor location/);
    await expect(
      save(users.asha, group, 20000, { [area1]: true, [area2]: false }, false, { lat: 12.9, lng: 77.6, radius: 4 }),
    ).rejects.toThrow(/3 km or 5 km/);
  });

  it("refuses to submit until every area is rated", async () => {
    await expect(save(users.asha, group, 20000, { [area1]: true }, true)).rejects.toThrow(/every area/);
  });

  it("keeps answers private while not everyone has submitted", async () => {
    await save(users.asha, group, 20000, { [area1]: true, [area2]: false }, true);
    await save(users.bea, group, 18000, { [area1]: true, [area2]: true }, true);
    await save(users.chitra, group, 22000, { [area1]: true, [area2]: true }, false); // draft only

    for (const u of [users.asha, users.bea, users.chitra]) {
      expect(await q(u, "select * from member_constraints")).toHaveLength(1); // only their own
      expect(await q(u, "select * from area_ratings")).toHaveLength(2);
    }
    expect(await q(users.asha, "select group_revealed($1) as r", [group])).toEqual([{ r: false }]);
  });

  it("shows who has submitted, but not what", async () => {
    const rows = await q(users.bea, "select display_name, submitted, is_me from member_statuses($1)", [group]);
    expect(rows).toEqual([
      { display_name: "Asha", submitted: true, is_me: false },
      { display_name: "Bea", submitted: true, is_me: true },
      { display_name: "Chitra", submitted: false, is_me: false },
    ]);
    expect(await q(users.dev, "select * from member_statuses($1)", [group])).toHaveLength(0);
  });

  it("locks answers once submitted", async () => {
    await expect(save(users.asha, group, 99999, { [area1]: true, [area2]: true }, false)).rejects.toThrow(/locked/);
    await expect(q(users.asha, "update member_constraints set max_rent_share = 1")).resolves.toBeDefined();
    const [{ max_rent_share }] = await q<{ max_rent_share: number }>(users.asha, "select max_rent_share from member_constraints");
    expect(max_rent_share).toBe(20000); // the direct update matched no rows (no update policy)
  });

  it("reveals everyone's answers once all 3 submit, to members only", async () => {
    await save(users.chitra, group, 22000, { [area1]: true, [area2]: true }, true);
    expect(await q(users.asha, "select * from member_constraints")).toHaveLength(3);
    expect(await q(users.asha, "select * from area_ratings")).toHaveLength(6);
    expect(await q(users.dev, "select * from member_constraints")).toHaveLength(0);
  });

  it("lets submitted members rate newly added areas, without changing old ratings", async () => {
    const [{ id: area3 }] = await q<{ id: string }>(users.asha, "select add_area($1, 'Indiranagar') as id", [group]);
    await q(users.bea, "select rate_new_areas($1, $2)", [group, JSON.stringify({ [area3]: false, [area1]: false })]);
    const rows = await q<{ area_id: string; acceptable: boolean }>(
      users.bea,
      "select area_id, acceptable from area_ratings r join members m on m.id = r.member_id where m.user_id = $1",
      [users.bea],
    );
    expect(rows.find((r) => r.area_id === area3)?.acceptable).toBe(false);
    expect(rows.find((r) => r.area_id === area1)?.acceptable).toBe(true); // unchanged
  });
});

describe("0002: maps and pasted listings", () => {
  it("stores the anchor and radius with the (private) answers", async () => {
    const rows = await q<{ anchor_label: string; radius_km: number }>(
      users.chitra,
      "select anchor_label, radius_km from member_constraints c join members m on m.id = c.member_id where m.user_id = $1",
      [users.chitra],
    );
    expect(rows).toEqual([{ anchor_label: "Test anchor", radius_km: 5 }]);
  });

  it("add_area stores coordinates, and fills them in for an existing area without any", async () => {
    const [{ id }] = await q<{ id: string }>(users.asha, "select add_area($1, 'Koramangala', 12.93, 77.62, 'Bengaluru') as id", [group]);
    expect(id).toBe(area1); // existing area, coords filled in
    const [row] = await q(users.bea, "select lat, lng, city from areas where id = $1", [area1]);
    expect(row).toEqual({ lat: 12.93, lng: 77.62, city: "Bengaluru" });
    // a second call does not overwrite
    await q(users.asha, "select add_area($1, 'Koramangala', 1, 1, 'Elsewhere')", [group]);
    const [again] = await q(users.bea, "select lat from areas where id = $1", [area1]);
    expect(again).toEqual({ lat: 12.93 });
  });

  it("pasted listings keep unconfirmed facts until a member confirms them", async () => {
    const [{ id: me }] = await q<{ id: string }>(users.asha, "select my_member_id($1) as id", [group]);
    const [{ id: listing }] = await q<{ id: string }>(
      users.asha,
      `insert into listings (group_id, area_id, total_rent, floor, lift, parking, bathrooms, pet_friendly, added_by, source, unconfirmed)
       values ($1, $2, 40000, 2, 'yes', 'unsure', 2, 'no', $3, 'pasted', '{lift,parking,bathrooms,pet_friendly}') returning id`,
      [group, area1, me],
    );
    await q(users.chitra, "select set_listing_fact($1, 'lift', 'yes')", [listing]);
    await q(users.bea, "select set_listing_fact($1, 'bathrooms', '3')", [listing]);
    const [row] = await q(users.asha, "select lift, bathrooms, unconfirmed from listings where id = $1", [listing]);
    expect(row).toEqual({ lift: "yes", bathrooms: 3, unconfirmed: ["parking", "pet_friendly"] });

    await expect(q(users.bea, "select set_listing_fact($1, 'lift', 'maybe')", [listing])).rejects.toThrow(/Yes, No or Not sure/);
    await expect(q(users.dev, "select set_listing_fact($1, 'lift', 'no')", [listing])).rejects.toThrow(/not found/);
    await expect(
      q(users.asha, `insert into listings (group_id, area_id, total_rent, floor, lift, parking, pet_friendly, added_by, unconfirmed)
                     values ($1, $2, 1, 1, 'yes', 'yes', 'yes', $3, '{rent}')`, [group, area1, me]),
    ).rejects.toThrow(/check constraint/);
  });

  it("only saves overlap localities after the reveal, and only for members", async () => {
    const data = JSON.stringify([{ name: "Koramangala", city: "Bengaluru", lat: 12.93, lng: 77.62 }]);
    await q(users.asha, "select set_overlap_localities($1, $2)", [group, data]);
    const [row] = await q<{ overlap_localities: unknown[] }>(users.bea, "select overlap_localities from groups where id = $1", [group]);
    expect(row.overlap_localities).toHaveLength(1);
    await expect(q(users.dev, "select set_overlap_localities($1, $2)", [group, data])).rejects.toThrow(/not a member/);

    // a fresh, unrevealed group refuses
    const [{ code: code2 }] = await q<{ code: string }>(users.dev, "select create_group('Other', 'Dev') as code");
    const [{ id: group2 }] = await q<{ id: string }>(users.dev, "select id from groups where code = $1", [code2]);
    await expect(q(users.dev, "select set_overlap_localities($1, $2)", [group2, data])).rejects.toThrow(/once everyone has submitted/);
  });
});

describe("0003: group size", () => {
  const ratingsFor = async (user: string, g: string) => {
    const areas = await q<{ id: string }>(user, "select id from areas where group_id = $1", [g]);
    return Object.fromEntries(areas.map((a) => [a.id, true]));
  };

  it("existing groups default to 3", async () => {
    const [row] = await q(users.asha, "select size from groups where id = $1", [group]);
    expect(row).toEqual({ size: 3 });
  });

  it("rejects sizes outside 2 to 6", async () => {
    await expect(q(users.eve, "select create_group('Big', 'Eve', 7)")).rejects.toThrow(/2 to 6/);
    await expect(q(users.eve, "select create_group('Solo', 'Eve', 1)")).rejects.toThrow(/2 to 6/);
  });

  it("a group of 2 reveals once both submit, and is full at 2", async () => {
    const [{ code: c }] = await q<{ code: string }>(users.eve, "select create_group('Pair', 'Eve', 2) as code");
    const [{ id: g }] = await q<{ id: string }>(users.eve, "select id from groups where code = $1", [c]);
    await q(users.fay, "select join_group($1, 'Fay')", [c]);
    await expect(q(users.gus, "select join_group($1, 'Gus')", [c])).rejects.toThrow(/full \(2 people\)/);

    await q(users.eve, "select add_area($1, 'Indiranagar')", [g]);
    await save(users.eve, g, 25000, await ratingsFor(users.eve, g), true);
    expect(await q(users.fay, "select * from member_constraints")).toHaveLength(0); // still hidden
    await save(users.fay, g, 25000, await ratingsFor(users.fay, g), true);
    expect(await q(users.eve, "select group_revealed($1) as r", [g])).toEqual([{ r: true }]);
    expect(await q(users.eve, "select * from member_constraints")).toHaveLength(2);
  });

  it("a group of 4 waits for the 4th person; the creator can shrink it to 3 instead", async () => {
    const [{ code: c }] = await q<{ code: string }>(users.dev, "select create_group('Four', 'Dev', 4) as code");
    const [{ id: g }] = await q<{ id: string }>(users.dev, "select id from groups where code = $1", [c]);
    await q(users.eve, "select join_group($1, 'Eve')", [c]);
    await q(users.gus, "select join_group($1, 'Gus')", [c]);
    await q(users.dev, "select add_area($1, 'Jayanagar')", [g]);
    for (const u of [users.dev, users.eve, users.gus]) await save(u, g, 20000, await ratingsFor(u, g), true);
    expect(await q(users.dev, "select group_revealed($1) as r", [g])).toEqual([{ r: false }]); // 3 of 4

    await expect(q(users.eve, "select set_group_size($1, 3)", [g])).rejects.toThrow(/Only the person who created/);
    await expect(q(users.dev, "select set_group_size($1, 2)", [g])).rejects.toThrow(/can't be less than 3/);
    await q(users.dev, "select set_group_size($1, 3)", [g]);
    expect(await q(users.dev, "select group_revealed($1) as r", [g])).toEqual([{ r: true }]);
    await expect(q(users.dev, "select set_group_size($1, 4)", [g])).rejects.toThrow(/already revealed/);
  });
});
