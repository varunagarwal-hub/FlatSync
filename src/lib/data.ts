import "server-only";
import { cache } from "react";
import { matchListings, type MatchSummary } from "./matching";
import { createClient } from "./supabase/server";
import type { Area, AreaRating, Group, Listing, MemberConstraints, MemberStatus } from "./types";

export type GroupData =
  | { kind: "not-member" }
  | {
      kind: "member";
      group: Group;
      members: MemberStatus[];
      me: MemberStatus;
      areas: Area[];
      listings: Listing[];
      /** Your own answers always; everyone's once revealed (enforced by RLS). */
      constraints: MemberConstraints[];
      ratings: AreaRating[];
      revealed: boolean;
      /** Whether you created the group (only the creator can change its size). */
      isCreator: boolean;
      match: MatchSummary | null;
    };

export type MemberGroupData = Extract<GroupData, { kind: "member" }>;

/** Everything a group page needs. Cached per request, so layout and page share it. */
export const loadGroup = cache(async (rawCode: string): Promise<GroupData> => {
  const code = rawCode.toUpperCase();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "not-member" };

  // RLS only returns the group if the caller is a member.
  const { data: group } = await supabase
    .from("groups")
    .select("id, code, name, created_at, size, created_by, overlap_localities")
    .eq("code", code)
    .maybeSingle<Group>();
  if (!group) return { kind: "not-member" };

  const [membersRes, areasRes, listingsRes] = await Promise.all([
    supabase.rpc("member_statuses", { p_group: group.id }),
    supabase.from("areas").select("id, name, lat, lng, city").eq("group_id", group.id).order("name").returns<Area[]>(),
    supabase
      .from("listings")
      .select("*")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false })
      .returns<Listing[]>(),
  ]);
  const firstError = membersRes.error ?? areasRes.error ?? listingsRes.error;
  if (firstError) throw new Error(firstError.message);

  const members = (membersRes.data ?? []) as MemberStatus[];
  const me = members.find((m) => m.is_me);
  if (!me) return { kind: "not-member" };
  const memberIds = members.map((m) => m.member_id);

  const [constraintsRes, ratingsRes] = await Promise.all([
    supabase.from("member_constraints").select("*").in("member_id", memberIds).returns<MemberConstraints[]>(),
    supabase.from("area_ratings").select("*").in("member_id", memberIds).returns<AreaRating[]>(),
  ]);
  const secondError = constraintsRes.error ?? ratingsRes.error;
  if (secondError) throw new Error(secondError.message);

  const constraints = constraintsRes.data ?? [];
  const ratings = ratingsRes.data ?? [];
  const areas = areasRes.data ?? [];
  const listings = listingsRes.data ?? [];
  const revealed = members.length === group.size && members.every((m) => m.submitted);

  const match = revealed
    ? matchListings({
        members: members.map((m) => ({ id: m.member_id, name: m.display_name })),
        constraints,
        ratings,
        areas,
        listings,
      })
    : null;

  const isCreator = group.created_by === user.id;
  return { kind: "member", group, members, me, areas, listings, constraints, ratings, revealed, isCreator, match };
});
