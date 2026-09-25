-- FlatSync 0003: groups of 2 to 6 people instead of exactly 3.
-- Existing groups default to 3, so nothing about them changes.

alter table public.groups
  add column size smallint not null default 3 check (size between 2 and 6);

-- ---------------------------------------------------------------- reveal

-- Answers unlock once the group is full and everyone in it has submitted.
create or replace function public.group_revealed(p_group uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (select count(*) from members where group_id = p_group) = g.size
     and (select count(*)
            from member_constraints c
            join members m on m.id = c.member_id
           where m.group_id = p_group and c.submitted_at is not null) = g.size
    from groups g
   where g.id = p_group
$$;

-- ---------------------------------------------------------------- member cap

create or replace function public.enforce_member_cap()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_size smallint;
begin
  select size into v_size from groups where id = new.group_id for update;
  if (select count(*) from members where group_id = new.group_id) >= v_size then
    raise exception 'This group is full (% people)', v_size;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------- create / join

drop function public.create_group(text, text);

create function public.create_group(p_name text, p_display_name text, p_size integer default 3)
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
  if p_size is null or p_size not between 2 and 6 then
    raise exception 'A group can have 2 to 6 people';
  end if;

  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from groups where code = v_code);
  end loop;

  insert into groups (code, name, created_by, size)
  values (v_code, btrim(p_name), auth.uid(), p_size)
  returning id into v_group;

  insert into members (group_id, user_id, display_name)
  values (v_group, auth.uid(), btrim(p_display_name));

  return v_code;
end
$$;

create or replace function public.join_group(p_code text, p_display_name text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code  text := upper(btrim(p_code));
  v_group uuid;
  v_size  smallint;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id, size into v_group, v_size from groups where code = v_code for update;
  if v_group is null then
    raise exception 'No group found with code %', v_code;
  end if;

  if exists (select 1 from members where group_id = v_group and user_id = auth.uid()) then
    return v_code; -- already a member; joining again is a no-op
  end if;

  if (select count(*) from members where group_id = v_group) >= v_size then
    raise exception 'This group is full (% people)', v_size;
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

-- ---------------------------------------------------------------- change size

-- The creator can change the size until answers are revealed, but never below
-- the number of people already in the group. Lowering it to the current count
-- (say, someone dropped out) can trigger the reveal straight away.
create function public.set_group_size(p_group uuid, p_size integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_creator uuid;
  v_members integer;
begin
  select created_by into v_creator from groups where id = p_group for update;
  if v_creator is null or not is_group_member(p_group) then
    raise exception 'Group not found';
  end if;
  if v_creator <> auth.uid() then
    raise exception 'Only the person who created the group can change its size';
  end if;
  if group_revealed(p_group) then
    raise exception 'Answers are already revealed, so the group size is fixed';
  end if;
  if p_size is null or p_size not between 2 and 6 then
    raise exception 'A group can have 2 to 6 people';
  end if;
  select count(*) into v_members from members where group_id = p_group;
  if p_size < v_members then
    raise exception '% people have already joined, so the size can''t be less than %', v_members, v_members;
  end if;
  update groups set size = p_size where id = p_group;
end
$$;

-- ---------------------------------------------------------------- grants

revoke all on function public.create_group(text, text, integer), public.set_group_size(uuid, integer) from public, anon;
grant execute on function public.create_group(text, text, integer), public.set_group_size(uuid, integer) to authenticated;
