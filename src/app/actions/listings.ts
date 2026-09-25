"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NICE_TO_HAVE_KEYS } from "@/lib/constants";
import type { ActionState, FactField, Tri } from "@/lib/types";
import { addAreaWithLocation } from "./areas";
import { clientWithSession, friendly, text, wholeNumber } from "./session";

const FACT_FIELDS: FactField[] = ["lift", "parking", "bathrooms", "pet_friendly"];

function tri(formData: FormData, key: string): Tri | null {
  const v = text(formData, key);
  return v === "yes" || v === "no" || v === "unsure" ? v : null;
}

export async function addListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = text(formData, "groupId");
  const code = text(formData, "code");

  const totalRent = wholeNumber(formData, "totalRent");
  if (totalRent === null || totalRent <= 0) return { error: "Enter the total monthly rent in ₹" };
  const floor = wholeNumber(formData, "floor");
  if (floor === null || floor < -2 || floor > 200) return { error: "Enter the floor (0 for ground)" };

  const url = text(formData, "url");
  if (url && !/^https?:\/\/\S+$/i.test(url)) return { error: "The link must start with http:// or https://" };

  const lift = tri(formData, "lift");
  const parking = tri(formData, "parking");
  const petFriendly = tri(formData, "petFriendly");
  if (!lift || !parking || !petFriendly) return { error: "Answer Yes, No or Not sure for lift, parking and pets" };

  let bathrooms: number | null = null;
  if (formData.get("bathroomsUnsure") !== "on") {
    bathrooms = wholeNumber(formData, "bathrooms");
    if (bathrooms === null || bathrooms < 0 || bathrooms > 20) {
      return { error: "Enter the number of bathrooms, or tick Not sure" };
    }
  }

  const features: Record<string, Tri> = {};
  for (const key of NICE_TO_HAVE_KEYS) features[key] = tri(formData, `feature:${key}`) ?? "unsure";

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };

  let areaId = text(formData, "areaId");
  if (areaId === "__new") {
    const newArea = text(formData, "newArea");
    if (!newArea) return { error: "Enter the new area's name" };
    const { data, error } = await addAreaWithLocation(supabase, groupId, newArea);
    if (error || !data) return { error: friendly(error, "Couldn't add the area") };
    areaId = data as string;
  } else if (areaId) {
    // Older areas may predate map locations; fill one in now if missing.
    const { data: area } = await supabase.from("areas").select("name, lat").eq("id", areaId).maybeSingle();
    if (area && area.lat === null) await addAreaWithLocation(supabase, groupId, area.name);
  }
  if (!areaId) return { error: "Pick an area" };

  const source = text(formData, "source") === "pasted" ? "pasted" : "manual";
  const unconfirmed = formData
    .getAll("unconfirmed")
    .filter((v): v is FactField => typeof v === "string" && (FACT_FIELDS as string[]).includes(v));

  const { data: me, error: meError } = await supabase.rpc("my_member_id", { p_group: groupId });
  if (meError || !me) return { error: friendly(meError, "You're not in this group") };

  const { error } = await supabase.from("listings").insert({
    group_id: groupId,
    area_id: areaId,
    total_rent: totalRent,
    floor,
    url: url || null,
    lift,
    parking,
    bathrooms,
    pet_friendly: petFriendly,
    features,
    notes: text(formData, "notes") || null,
    added_by: me,
    source,
    unconfirmed: source === "pasted" ? unconfirmed : [],
  });
  if (error) return { error: friendly(error) };

  revalidatePath(`/g/${code}`, "layout");
  redirect(`/g/${code}/listings`);
}

/** Confirm or correct one must-have fact on a listing (clears "from listing - not confirmed"). */
export async function setListingFact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const listingId = text(formData, "listingId");
  const code = text(formData, "code");
  const field = text(formData, "field");
  const value = text(formData, "value");
  if (!(FACT_FIELDS as string[]).includes(field)) return { error: "Unknown field" };

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };
  const { error } = await supabase.rpc("set_listing_fact", { p_listing: listingId, p_field: field, p_value: value });
  if (error) return { error: friendly(error) };

  revalidatePath(`/g/${code}`, "layout");
  return { message: "Saved" };
}
