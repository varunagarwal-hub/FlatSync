"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/types";
import { clientWithSession, friendly, text } from "./session";

export async function createGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = text(formData, "groupName");
  const displayName = text(formData, "displayName");
  if (!name) return { error: "Give the group a name" };
  if (!displayName) return { error: "Enter your name" };

  const supabase = await clientWithSession();
  const { data, error } = await supabase.rpc("create_group", { p_name: name, p_display_name: displayName });
  if (error || !data) return { error: friendly(error, "Couldn't create the group") };
  redirect(`/g/${data}`);
}

export async function joinGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = text(formData, "code").toUpperCase();
  const displayName = text(formData, "displayName");
  if (!/^[A-Z0-9]{6}$/.test(code)) return { error: "Codes are 6 letters and numbers" };
  if (!displayName) return { error: "Enter your name" };

  const supabase = await clientWithSession();
  const { data, error } = await supabase.rpc("join_group", { p_code: code, p_display_name: displayName });
  if (error || !data) return { error: friendly(error, "Couldn't join the group") };
  redirect(`/g/${data}`);
}
