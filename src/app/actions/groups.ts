"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_GROUP_SIZE, MAX_GROUP_SIZE, MIN_GROUP_SIZE } from "@/lib/constants";
import type { ActionState } from "@/lib/types";
import { clientWithSession, friendly, text, wholeNumber } from "./session";

function readSize(formData: FormData): number | null {
  const size = wholeNumber(formData, "size") ?? DEFAULT_GROUP_SIZE;
  return size >= MIN_GROUP_SIZE && size <= MAX_GROUP_SIZE ? size : null;
}

export async function createGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "groupName");
  const displayName = text(formData, "displayName");
  if (!name) return { error: "Give the group a name" };
  if (!displayName) return { error: "Enter your name" };
  const size = readSize(formData);
  if (size === null) return { error: `A group can have ${MIN_GROUP_SIZE} to ${MAX_GROUP_SIZE} people` };

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };
  const { data, error } = await supabase.rpc("create_group", { p_name: name, p_display_name: displayName, p_size: size });
  if (error || !data) return { error: friendly(error, "Couldn't create the group") };
  redirect(`/g/${data}`);
}

export async function joinGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = text(formData, "code").toUpperCase();
  const displayName = text(formData, "displayName");
  if (!/^[A-Z0-9]{6}$/.test(code)) return { error: "Codes are 6 letters and numbers" };
  if (!displayName) return { error: "Enter your name" };

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };
  const { data, error } = await supabase.rpc("join_group", { p_code: code, p_display_name: displayName });
  if (error || !data) return { error: friendly(error, "Couldn't join the group") };
  redirect(`/g/${data}`);
}

/** Creator only, before the reveal. Never below the number of people already in. */
export async function setGroupSize(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = text(formData, "groupId");
  const code = text(formData, "code");
  const size = readSize(formData);
  if (size === null) return { error: `A group can have ${MIN_GROUP_SIZE} to ${MAX_GROUP_SIZE} people` };

  const { supabase, error: sessionError } = await clientWithSession();
  if (!supabase) return { error: sessionError };
  const { error } = await supabase.rpc("set_group_size", { p_group: groupId, p_size: size });
  if (error) return { error: friendly(error) };
  revalidatePath(`/g/${code}`, "layout");
  return { message: `Group size set to ${size}` };
}
