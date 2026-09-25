"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NICE_TO_HAVE_KEYS } from "@/lib/constants";
import type { ActionState } from "@/lib/types";
import { addAreaWithLocation } from "./areas";
import { clientWithSession, friendly, text, wholeNumber } from "./session";

/** Reads `area:<id>` = "yes" | "no" fields into { id: boolean }. */
function readRatings(formData: FormData): Record<string, boolean> {
  const ratings: Record<string, boolean> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("area:") && (value === "yes" || value === "no")) {
      ratings[key.slice("area:".length)] = value === "yes";
    }
  }
  return ratings;
}

export async function saveConstraints(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = text(formData, "groupId");
  const code = text(formData, "code");
  const submit = text(formData, "intent") === "submit";

  const maxRent = wholeNumber(formData, "maxRentShare");
  if (maxRent === null || maxRent <= 0) return { error: "Enter your maximum monthly rent share in ₹" };
  const minBathrooms = wholeNumber(formData, "minBathrooms");
  if (minBathrooms === null || minBathrooms < 0 || minBathrooms > 10) {
    return { error: "Minimum bathrooms must be between 0 and 10" };
  }

  const anchorLat = Number(text(formData, "anchorLat"));
  const anchorLng = Number(text(formData, "anchorLng"));
  const hasAnchor = text(formData, "anchorLat") !== "" && Number.isFinite(anchorLat) && Number.isFinite(anchorLng);
  const radius = wholeNumber(formData, "radiusKm");
  if (radius !== null && radius !== 3 && radius !== 5) return { error: "Pick a 3 km or 5 km radius" };

  const niceToHaves = formData
    .getAll("niceToHaves")
    .filter((v): v is string => typeof v === "string" && NICE_TO_HAVE_KEYS.includes(v));

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };
  const { error } = await supabase.rpc("save_constraints", {
    p_group: groupId,
    p_max_rent_share: maxRent,
    p_needs_lift: formData.get("needsLift") === "on",
    p_needs_parking: formData.get("needsParking") === "on",
    p_min_bathrooms: minBathrooms,
    p_needs_pet_friendly: formData.get("needsPetFriendly") === "on",
    p_nice_to_haves: niceToHaves,
    p_ratings: readRatings(formData),
    p_submit: submit,
    p_anchor_label: hasAnchor ? text(formData, "anchorLabel").slice(0, 300) : null,
    p_anchor_lat: hasAnchor ? anchorLat : null,
    p_anchor_lng: hasAnchor ? anchorLng : null,
    p_radius_km: radius,
  });
  if (error) return { error: friendly(error) };

  revalidatePath(`/g/${code}`, "layout");
  if (submit) redirect(`/g/${code}`);
  return { message: "Draft saved. Only you can see it." };
}

export async function rateNewAreas(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = text(formData, "groupId");
  const code = text(formData, "code");
  const ratings = readRatings(formData);
  if (!Object.keys(ratings).length) return { error: "Mark at least one area" };

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };
  const { error } = await supabase.rpc("rate_new_areas", { p_group: groupId, p_ratings: ratings });
  if (error) return { error: friendly(error) };
  revalidatePath(`/g/${code}`, "layout");
  return { message: "Saved" };
}

export async function addArea(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = text(formData, "groupId");
  const code = text(formData, "code");
  const name = text(formData, "areaName");
  if (!name) return { error: "Enter an area name" };

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };
  const { error } = await addAreaWithLocation(supabase, groupId, name);
  if (error) return { error: friendly(error) };
  revalidatePath(`/g/${code}`, "layout");
  return { message: `Added ${name}` };
}
