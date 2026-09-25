-- FlatSync: schema, privacy rules and RPCs.
--
-- Privacy model:
--   * Everything is scoped to groups; you can only see a group you belong to.
--   * member_constraints and area_ratings are readable by their owner, and by
--     the rest of the group only once all 3 members have submitted
--     (group_revealed). This is enforced by RLS, not just the UI.
--   * Constraints and area ratings are written only through security-definer
--     RPCs, which also enforce the "locked once submitted" rule.
--
-- Users sign in with Supabase anonymous auth, so every caller has the
-- `authenticated` role and an auth.uid().

create type public.tri as enum ('yes', 'no', 'unsure');

-- ---------------------------------------------------------------- tables

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.members (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 40),
  joined_at     timestamptz not null default now(),
  unique (group_id, user_id)
);
create unique index members_group_name_key on public.members (group_id, lower(btrim(display_name)));
create index members_user_id_idx on public.members (user_id);

create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now(),
  unique (id, group_id)
);
create unique index areas_group_name_key on public.areas (group_id, lower(btrim(name)));

create table public.member_constraints (
  member_id           uuid primary key references public.members (id) on delete cascade,
  max_rent_share      integer not null check (max_rent_share > 0),
  needs_lift          boolean not null default false,
  needs_parking       boolean not null default false,
  min_bathrooms       smallint not null default 1 check (min_bathrooms between 0 and 10),
  needs_pet_friendly  boolean not null default false,
  nice_to_haves       text[] not null default '{}',
  submitted_at        timestamptz,
  updated_at          timestamptz not null default now()
);

create table public.area_ratings (
  member_id   uuid not null references public.members (id) on delete cascade,
  area_id     uuid not null references public.areas (id) on delete cascade,
  acceptable  boolean not null,
  primary key (member_id, area_id)
);

create table public.listings (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  area_id       uuid not null,
  total_rent    integer not null check (total_rent > 0),
  floor         smallint not null check (floor between -2 and 200),
  url           text check (url is null or url ~* '^https?://[^\s]+$'),
  lift          public.tri not null,
  parking       public.tri not null,
  bathrooms     smallint check (bathrooms is null or bathrooms between 0 and 20), -- null = not sure
  pet_friendly  public.tri not null,
  features      jsonb not null default '{}' check (jsonb_typeof(features) = 'object'),
  notes         text check (notes is null or char_length(notes) <= 500),
  added_by      uuid not null references public.members (id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- the area must belong to the same group as the listing
  foreign key (area_id, group_id) references public.areas (id, group_id)
);
create index listings_group_id_idx on public.listings (group_id);

-- ---------------------------------------------------------------- helpers
-- Security definer so RLS policies can call them without recursing into
-- the members table's own policy.

create function public.my_member_id(p_group uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from members where group_id = p_group and user_id = auth.uid()
$$;

create function public.is_group_member(p_group uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from members where group_id = p_group and user_id = auth.uid())
$$;

create function public.group_revealed(p_group uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (select count(*) from members where group_id = p_group) = 3
     and (select count(*)
            from member_constraints c
            join members m on m.id = c.member_id
           where m.group_id = p_group and c.submitted_at is not null) = 3
$$;

-- Can the caller read this member's private answers?
create function public.can_see_private(p_member uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from members m
     where m.id = p_member
       and (m.user_id = auth.uid()
            or (is_group_member(m.group_id) and group_revealed(m.group_id)))
  )
$$;

-- ---------------------------------------------------------------- member cap

create function public.enforce_member_cap()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from groups where id = new.group_id for update;
  if (select count(*) from members where group_id = new.group_id) >= 3 then
    raise exception 'This group already has 3 members';
  end if;
  return new;
end
$$;

create trigger members_cap
  before insert on public.members
  for each row execute function public.enforce_member_cap();

-- ---------------------------------------------------------------- RPCs

create function public.create_group(p_name text, p_display_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars, no I/O/0/1
  v_code  text;
  v_bytes bytea;
  v_group uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from groups where code = v_code);
  end loop;

  insert into groups (code, name, created_by)
  values (v_code, btrim(p_name), auth.uid())
  returning id into v_group;

  insert into members (group_id, user_id, display_name)
  values (v_group, auth.uid(), btrim(p_display_name));

  return v_code;
end
$$;

create function public.join_group(p_code text, p_display_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code  text := upper(btrim(p_code));
  v_group uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into v_group from groups where code = v_code for update;
  if v_group is null then
    raise exception 'No group found with code %', v_code;
  end if;

  if exists (select 1 from members where group_id = v_group and user_id = auth.uid()) then
    return v_code; -- already a member; joining again is a no-op
  end if;

  if (select count(*) from members where group_id = v_group) >= 3 then
    raise exception 'This group already has 3 members';
  end if;

  if exists (select 1 from members
              where group_id = v_group
                and lower(btrim(display_name)) = lower(btrim(p_display_name))) then
    raise exception 'Someone in this group is already called %', btrim(p_display_name);
  end if;

  insert into members (group_id, user_id, display_name)
  values (v_group, auth.uid(), btrim(p_display_name));

  return v_code;
end
$$;

-- Who is in the group and whether they have submitted -- never their answers.
create function public.member_statuses(p_group uuid)
returns table (member_id uuid, display_name text, submitted boolean, is_me boolean)
language sql stable security definer set search_path = public
as $$
  select m.id, m.display_name, c.submitted_at is not null, m.user_id = auth.uid()
    from members m
    left join member_constraints c on c.member_id = m.id
   where m.group_id = p_group
     and is_group_member(p_group)
   order by m.joined_at
$$;

-- Adds an area to the group (or returns the existing one with the same name).
create function public.add_area(p_group uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_group_member(p_group) then
    raise exception 'You are not a member of this group';
  end if;

  select id into v_id from areas
   where group_id = p_group and lower(btrim(name)) = lower(btrim(p_name));
  if v_id is not null then
    return v_id;
  end if;

  insert into areas (group_id, name) values (p_group, btrim(p_name))
  on conflict do nothing
  returning id into v_id;

  if v_id is null then -- lost a race with an identical insert
    select id into v_id from areas
     where group_id = p_group and lower(btrim(name)) = lower(btrim(p_name));
  end if;
  return v_id;
end
$$;

-- Saves the caller's constraints as a draft, or submits (and locks) them.
-- p_ratings is a JSON object: { "<area uuid>": true | false, ... }
create function public.save_constraints(
  p_group              uuid,
  p_max_rent_share     integer,
  p_needs_lift         boolean,
  p_needs_parking      boolean,
  p_min_bathrooms      integer,
  p_needs_pet_friendly boolean,
  p_nice_to_haves      text[],
  p_ratings            jsonb,
  p_submit             boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_member    uuid := my_member_id(p_group);
  v_submitted timestamptz;
begin
  if v_member is null then
    raise exception 'You are not a member of this group';
  end if;

  select submitted_at into v_submitted
    from member_constraints where member_id = v_member for update;
  if v_submitted is not null then
    raise exception 'Your answers are already submitted and locked';
  end if;

  if p_max_rent_share is null or p_max_rent_share <= 0 then
    raise exception 'Enter your maximum monthly rent share';
  end if;
  if p_ratings is null or jsonb_typeof(p_ratings) <> 'object' then
    raise exception 'Invalid area ratings';
  end if;

  insert into member_constraints as mc (
    member_id, max_rent_share, needs_lift, needs_parking, min_bathrooms,
    needs_pet_friendly, nice_to_haves
  ) values (
    v_member, p_max_rent_share, coalesce(p_needs_lift, false), coalesce(p_needs_parking, false),
    coalesce(p_min_bathrooms, 0), coalesce(p_needs_pet_friendly, false), coalesce(p_nice_to_haves, '{}')
  )
  on conflict (member_id) do update set
    max_rent_share     = excluded.max_rent_share,
    needs_lift         = excluded.needs_lift,
    needs_parking      = excluded.needs_parking,
    min_bathrooms      = excluded.min_bathrooms,
    needs_pet_friendly = excluded.needs_pet_friendly,
    nice_to_haves      = excluded.nice_to_haves,
    updated_at         = now();

  delete from area_ratings where member_id = v_member;
  insert into area_ratings (member_id, area_id, acceptable)
  select v_member, a.id, (p_ratings ->> a.id::text)::boolean
    from areas a
   where a.group_id = p_group
     and jsonb_typeof(p_ratings -> a.id::text) = 'boolean';

  if p_submit then
    if not exists (select 1 from areas where group_id = p_group) then
      raise exception 'Add at least one area before submitting';
    end if;
    if exists (select 1 from areas a
                where a.group_id = p_group
                  and not exists (select 1 from area_ratings r
                                   where r.member_id = v_member and r.area_id = a.id)) then
      raise exception 'Mark every area as acceptable or not before submitting';
    end if;
    update member_constraints set submitted_at = now() where member_id = v_member;
  end if;
end
$$;

-- Rates areas the caller has not rated yet (e.g. areas added after they
-- submitted). Existing ratings are never changed.
create function public.rate_new_areas(p_group uuid, p_ratings jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_member uuid := my_member_id(p_group);
begin
  if v_member is null then
    raise exception 'You are not a member of this group';
  end if;
  if p_ratings is null or jsonb_typeof(p_ratings) <> 'object' then
    raise exception 'Invalid area ratings';
  end if;

  insert into area_ratings (member_id, area_id, acceptable)
  select v_member, a.id, (p_ratings ->> a.id::text)::boolean
    from areas a
   where a.group_id = p_group
     and jsonb_typeof(p_ratings -> a.id::text) = 'boolean'
  on conflict (member_id, area_id) do nothing;
end
$$;

-- ---------------------------------------------------------------- RLS

alter table public.groups             enable row level security;
alter table public.members            enable row level security;
alter table public.areas              enable row level security;
alter table public.member_constraints enable row level security;
alter table public.area_ratings       enable row level security;
alter table public.listings           enable row level security;

create policy "members read their groups" on public.groups
  for select to authenticated using (is_group_member(id));

create policy "members read fellow members" on public.members
  for select to authenticated using (is_group_member(group_id));

create policy "members read group areas" on public.areas
  for select to authenticated using (is_group_member(group_id));

create policy "own answers, or everyone's after reveal" on public.member_constraints
  for select to authenticated using (can_see_private(member_id));

create policy "own ratings, or everyone's after reveal" on public.area_ratings
  for select to authenticated using (can_see_private(member_id));

create policy "members read group listings" on public.listings
  for select to authenticated using (is_group_member(group_id));

create policy "members add listings as themselves" on public.listings
  for insert to authenticated
  with check (is_group_member(group_id) and added_by = my_member_id(group_id));

-- No other write policies: groups, members, areas, constraints and ratings
-- change only through the RPCs above.

-- ---------------------------------------------------------------- grants

revoke all on all functions in schema public from public, anon;
grant execute on function
  public.my_member_id(uuid),
  public.is_group_member(uuid),
  public.group_revealed(uuid),
  public.can_see_private(uuid),
  public.create_group(text, text),
  public.join_group(text, text),
  public.member_statuses(uuid),
  public.add_area(uuid, text),
  public.save_constraints(uuid, integer, boolean, boolean, integer, boolean, text[], jsonb, boolean),
  public.rate_new_areas(uuid, jsonb)
to authenticated;

revoke all on all tables in schema public from anon;
