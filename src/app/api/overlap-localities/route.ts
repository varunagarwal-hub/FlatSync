import { NextResponse, type NextRequest } from "next/server";
import { samplePoints } from "@/lib/geo";
import { anchorCircle } from "@/lib/matching";
import { reverseLocality } from "@/lib/nominatim";
import { createClient } from "@/lib/supabase/server";
import type { Locality, MemberConstraints } from "@/lib/types";

export const maxDuration = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Finds neighbourhood names inside the overlap zone (after the reveal) and
// saves them on the group, so OpenStreetMap is asked once per group.
export async function POST(request: NextRequest) {
  const { groupId } = (await request.json().catch(() => ({}))) as { groupId?: string };
  if (!groupId) return NextResponse.json({ ok: false, error: "Missing group" }, { status: 400 });

  const supabase = await createClient();
  const { data: revealed } = await supabase.rpc("group_revealed", { p_group: groupId });
  const { data: isMember } = await supabase.rpc("is_group_member", { p_group: groupId });
  if (isMember !== true || revealed !== true) {
    return NextResponse.json({ ok: false, error: "Available once everyone has submitted" }, { status: 403 });
  }

  const { data: group } = await supabase.from("groups").select("overlap_localities").eq("id", groupId).single();
  if (group?.overlap_localities) return NextResponse.json({ ok: true, localities: group.overlap_localities });

  const { data: members } = await supabase.from("members").select("id").eq("group_id", groupId);
  const { data: constraints } = await supabase
    .from("member_constraints")
    .select("*")
    .in("member_id", (members ?? []).map((m) => m.id));
  const circles = ((constraints ?? []) as MemberConstraints[]).map(anchorCircle).filter((c) => c !== null);

  const localities: Locality[] = [];
  try {
    for (const [i, p] of samplePoints(circles, 5).entries()) {
      if (i > 0) await sleep(1100); // Nominatim: at most 1 request per second
      const found = await reverseLocality(p);
      if (found && !localities.some((l) => l.name.toLowerCase() === found.name.toLowerCase())) {
        localities.push({ name: found.name, city: found.city, lat: p.lat, lng: p.lng });
      }
    }
  } catch (err) {
    console.error("Reverse geocoding failed:", err);
    return NextResponse.json(
      { ok: false, error: "Couldn't look up localities right now. Reload the page to try again." },
      { status: 502 },
    );
  }

  const { error } = await supabase.rpc("set_overlap_localities", { p_group: groupId, p_localities: localities });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, localities });
}
