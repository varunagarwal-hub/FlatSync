"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NICE_TO_HAVE_KEYS } from "@/lib/constants";
import type { ActionState, Tri } from "@/lib/types";
import { clientWithSession, friendly, text, wholeNumber } from "./session";

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

  const supabase = await clientWithSession();

  let areaId = text(formData, "areaId");
  if (areaId === "__new") {
    const newArea = text(formData, "newArea");
    if (!newArea) return { error: "Enter the new area's name" };
    const { data, error } = await supabase.rpc("add_area", { p_group: groupId, p_name: newArea });
    if (error || !data) return { error: friendly(error, "Couldn't add the area") };
    areaId = data as string;
  }
  if (!areaId) return { error: "Pick an area" };

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
  });
  if (error) return { error: friendly(error) };

  revalidatePath(`/g/${code}`, "layout");
  redirect(`/g/${code}/listings`);
}
