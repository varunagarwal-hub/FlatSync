-- FlatSync 0002: anchor + radius per member, area coordinates, pasted
-- listings with unconfirmed facts, and cached overlap-zone localities.
-- Additive only: existing groups, answers and listings keep working.

-- ---------------------------------------------------------------- columns

alter table public.member_constraints
  add column anchor_label text check (anchor_label is null or char_length(anchor_label) <= 300),
  add column anchor_lat   double precision check (anchor_lat is null or anchor_lat between -90 and 90),
  add column anchor_lng   double precision check (anchor_lng is null or anchor_lng between -180 and 180),
  add column radius_km    smallint check (radius_km is null or radius_km in (3, 5)),
  add constraint member_constraints_anchor_pair check ((anchor_lat is null) = (anchor_lng is null));

alter table public.areas
  add column lat  double precision check (lat is null or lat between -90 and 90),
  add column lng  double precision check (lng is null or lng between -180 and 180),
  add column city text check (city is null or char_length(city) <= 80),
  add constraint areas_coords_pair check ((lat is null) = (lng is null));

alter table public.listings
  add column source text not null default 'manual' check (source in ('manual', 'pasted')),
  -- must-have fields that came from a pasted listing and no member has confirmed yet
  add column unconfirmed text[] not null default '{}'
    check (unconfirmed <@ array['lift', 'parking', 'bathrooms', 'pet_friendly']::text[]);

alter table public.groups
  -- [{ "name": "...", "city": "...", "lat": 0, "lng": 0 }, ...]; null = not computed yet
  add column overlap_localities jsonb
    check (overlap_localities is null or jsonb_typeof(overlap_localities) = 'array');

-- ---------------------------------------------------------------- save_constraints (+ anchor, radius)

drop function public.save_constraints(uuid, integer, boolean, boolean, integer, boolean, text[], jsonb, boolean);

create function public.save_constraints(
  p_group              uuid,
  p_max_rent_share     integer,
  p_needs_lift         boolean,
  p_needs_parking      boolean,
  p_min_bathrooms      integer,
  p_needs_pet_friendly boolean,
  p_nice_to_haves      text[],
  p_ratings            jsonb,
  p_submit             boolean,
  p_anchor_label       text default null,
  p_anchor_lat         double precision default null,
  p_anchor_lng         double precision default null,
  p_radius_km          integer default null
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
  if (p_anchor_lat is null) <> (p_anchor_lng is null) then
    raise exception 'Invalid anchor location';
  end if;
  if p_radius_km is not null and p_radius_km not in (3, 5) then
    raise exception 'Radius must be 3 km or 5 km';
  end if;

  insert into member_constraints (
    member_id, max_rent_share, needs_lift, needs_parking, min_bathrooms,
    needs_pet_friendly, nice_to_haves, anchor_label, anchor_lat, anchor_lng, radius_km
  ) values (
    v_member, p_max_rent_share, coalesce(p_needs_lift, false), coalesce(p_needs_parking, false),
    coalesce(p_min_bathrooms, 0), coalesce(p_needs_pet_friendly, false), coalesce(p_nice_to_haves, '{}'),
    nullif(btrim(p_anchor_label), ''), p_anchor_lat, p_anchor_lng, p_radius_km
  )
  on conflict (member_id) do update set
    max_rent_share     = excluded.max_rent_share,
    needs_lift         = excluded.needs_lift,
    needs_parking      = excluded.needs_parking,
    min_bathrooms      = excluded.min_bathrooms,
    needs_pet_friendly = excluded.needs_pet_friendly,
    nice_to_haves      = excluded.nice_to_haves,
    anchor_label       = excluded.anchor_label,
    anchor_lat         = excluded.anchor_lat,
    anchor_lng         = excluded.anchor_lng,
    radius_km          = excluded.radius_km,
    updated_at         = now();

  delete from area_ratings where member_id = v_member;
  insert into area_ratings (member_id, area_id, acceptable)
  select v_member, a.id, (p_ratings ->> a.id::text)::boolean
    from areas a
   where a.group_id = p_group
     and jsonb_typeof(p_ratings -> a.id::text) = 'boolean';

  if p_submit then
    if p_anchor_lat is null or p_radius_km is null then
      raise exception 'Pick your anchor location and a 3 km or 5 km radius before submitting';
    end if;
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

-- ---------------------------------------------------------------- add_area (+ coordinates)

drop function public.add_area(uuid, text);

-- Adds an area (or returns the existing one with the same name). Coordinates
-- fill in an existing area that doesn't have any yet.
create function public.add_area(
  p_group uuid,
  p_name  text,
  p_lat   double precision default null,
  p_lng   double precision default null,
  p_city  text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_group_member(p_group) then
    raise exception 'You are not a member of this group';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'Invalid area location';
  end if;

  select id into v_id from areas
   where group_id = p_group and lower(btrim(name)) = lower(btrim(p_name));

  if v_id is null then
    insert into areas (group_id, name, lat, lng, city)
    values (p_group, btrim(p_name), p_lat, p_lng, nullif(btrim(p_city), ''))
    on conflict do nothing
    returning id into v_id;

    if v_id is null then -- lost a race with an identical insert
      select id into v_id from areas
       where group_id = p_group and lower(btrim(name)) = lower(btrim(p_name));
    end if;
  end if;

  if p_lat is not null then
    update areas set lat = p_lat, lng = p_lng, city = coalesce(city, nullif(btrim(p_city), ''))
     where id = v_id and lat is null;
  end if;

  return v_id;
end
$$;

-- ---------------------------------------------------------------- set_listing_fact

-- Any member can confirm or correct a must-have fact on a listing.
-- p_value: 'yes' | 'no' | 'unsure' for lift/parking/pet_friendly;
--          a whole number or 'unsure' for bathrooms.
create function public.set_listing_fact(p_listing uuid, p_field text, p_value text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
begin
  select group_id into v_group from listings where id = p_listing;
  if v_group is null or not is_group_member(v_group) then
    raise exception 'Listing not found';
  end if;

  if p_field in ('lift', 'parking', 'pet_friendly') then
    if p_value not in ('yes', 'no', 'unsure') then
      raise exception 'Answer Yes, No or Not sure';
    end if;
    update listings set
      lift         = case when p_field = 'lift'         then p_value::tri else lift end,
      parking      = case when p_field = 'parking'      then p_value::tri else parking end,
      pet_friendly = case when p_field = 'pet_friendly' then p_value::tri else pet_friendly end,
      unconfirmed  = array_remove(unconfirmed, p_field)
    where id = p_listing;
  elsif p_field = 'bathrooms' then
    if p_value <> 'unsure' and (p_value !~ '^\d{1,2}$' or p_value::int > 20) then
      raise exception 'Enter the number of bathrooms (0-20) or Not sure';
    end if;
    update listings set
      bathrooms   = case when p_value = 'unsure' then null else p_value::smallint end,
      unconfirmed = array_remove(unconfirmed, 'bathrooms')
    where id = p_listing;
  else
    raise exception 'Unknown field %', p_field;
  end if;
end
$$;

-- ---------------------------------------------------------------- set_overlap_localities

create function public.set_overlap_localities(p_group uuid, p_localities jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_group_member(p_group) then
    raise exception 'You are not a member of this group';
  end if;
  if not group_revealed(p_group) then
    raise exception 'The overlap zone is only known once everyone has submitted';
  end if;
  if p_localities is null or jsonb_typeof(p_localities) <> 'array' or jsonb_array_length(p_localities) > 50 then
    raise exception 'Invalid localities';
  end if;
  update groups set overlap_localities = p_localities where id = p_group;
end
$$;

-- ---------------------------------------------------------------- grants

revoke all on function
  public.save_constraints(uuid, integer, boolean, boolean, integer, boolean, text[], jsonb, boolean, text, double precision, double precision, integer),
  public.add_area(uuid, text, double precision, double precision, text),
  public.set_listing_fact(uuid, text, text),
  public.set_overlap_localities(uuid, jsonb)
from public, anon;

grant execute on function
  public.save_constraints(uuid, integer, boolean, boolean, integer, boolean, text[], jsonb, boolean, text, double precision, double precision, integer),
  public.add_area(uuid, text, double precision, double precision, text),
  public.set_listing_fact(uuid, text, text),
  public.set_overlap_localities(uuid, jsonb)
to authenticated;
