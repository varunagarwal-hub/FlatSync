import "server-only";
import { searchPlaces } from "@/lib/nominatim";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Adds (or finds) an area and puts it on the map. Geocoding is best effort,
 * biased towards the caller's own anchor: if OpenStreetMap is down or doesn't
 * know the name, the area is still added, just without coordinates.
 */
export async function addAreaWithLocation(supabase: Client, groupId: string, name: string) {
  let lat: number | null = null;
  let lng: number | null = null;
  let city: string | null = null;
  try {
    const { data: meId } = await supabase.rpc("my_member_id", { p_group: groupId });
    const { data: mine } = meId
      ? await supabase.from("member_constraints").select("anchor_lat, anchor_lng").eq("member_id", meId).maybeSingle()
      : { data: null };
    const near = mine?.anchor_lat != null && mine?.anchor_lng != null ? { lat: mine.anchor_lat, lng: mine.anchor_lng } : null;
    const [place] = await searchPlaces(name, { near, limit: 1 });
    if (place) ({ lat, lng, city } = place);
  } catch (err) {
    console.error(`Couldn't geocode area "${name}":`, err);
  }
  return supabase.rpc("add_area", { p_group: groupId, p_name: name, p_lat: lat, p_lng: lng, p_city: city });
}
