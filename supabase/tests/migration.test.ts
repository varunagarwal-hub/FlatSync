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

async function save(user: string, group: string, maxRent: number, ratings: Record<string, boolean>, submit: boolean) {
  await q(user, "select save_constraints($1, $2, true, false, 2, false, $3, $4, $5)", [
    group,
    maxRent,
    ["balcony"],
    JSON.stringify(ratings),
    submit,
  ]);
}

let code: string;
let group: string;
let area1: string;
let area2: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(Object.values(users).map((id) => `insert into auth.users values ('${id}');`).join("\n"));
  await db.exec(readFileSync(join(__dirname, "../migrations/0001_init.sql"), "utf8"));
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
    await expect(q(users.dev, "select join_group($1, 'Dev')", [code])).rejects.toThrow(/already has 3 members/);
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
