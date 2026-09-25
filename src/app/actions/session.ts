import "server-only";
import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Returns a Supabase client with a session, signing in anonymously if needed.
 * On failure returns an error message for the form instead of throwing, since
 * production hides thrown messages behind a generic error page.
 */
export async function clientWithSession(): Promise<{ supabase: Client; error?: never } | { supabase?: never; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("signInAnonymously failed:", error);
      return {
        error: `Couldn't start a session (${error.message}). Check that anonymous sign-ins are enabled in Supabase and that the Supabase URL and key on Vercel are correct.`,
      };
    }
  }
  return { supabase };
}

/** The RPCs raise messages written for people; pass them through. */
export function friendly(error: { message: string } | null | undefined, fallback = "Something went wrong") {
  return error?.message?.trim() || fallback;
}

export function text(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Parses "45,000", "₹45000" or "-1" into an integer; null if it isn't one. */
export function wholeNumber(formData: FormData, key: string): number | null {
  const raw = text(formData, key).replace(/[,\s₹]/g, "");
  if (!/^-?\d+$/.test(raw)) return null;
  return Number(raw);
}
