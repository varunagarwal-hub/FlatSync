import { NextResponse, type NextRequest } from "next/server";
import { extractListing, type ExtractInput } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const MAX_TEXT = 20_000;
const MAX_IMAGE_BASE64 = 4_000_000; // ~3 MB image; the client downsizes screenshots first
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MESSAGES = {
  not_configured: "Reading listings isn't set up on this site yet. Please fill in the details below.",
  rate_limited: "The listing reader is busy right now. Fill in the details below, or try again in a minute.",
  failed: "Couldn't read that listing. Please fill in the details below.",
};

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let body: { groupId?: unknown; text?: unknown; image?: { mimeType?: unknown; data?: unknown } };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request", 400);
  }

  // Only signed-in members of the group can use the key.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || typeof body.groupId !== "string") return fail("Sign in to your group first", 401);
  const { data: isMember } = await supabase.rpc("is_group_member", { p_group: body.groupId });
  if (isMember !== true) return fail("You're not a member of this group", 403);

  let input: ExtractInput;
  if (typeof body.text === "string" && body.text.trim()) {
    if (body.text.length > MAX_TEXT) return fail("That's too much text. Paste just the listing.", 413);
    input = { text: body.text.trim() };
  } else if (body.image && typeof body.image.data === "string" && typeof body.image.mimeType === "string") {
    if (!IMAGE_TYPES.includes(body.image.mimeType)) return fail("Upload a JPG, PNG or WebP screenshot", 415);
    if (body.image.data.length > MAX_IMAGE_BASE64) return fail("That screenshot is too large", 413);
    input = { image: { mimeType: body.image.mimeType, data: body.image.data } };
  } else {
    return fail("Paste some listing text or add a screenshot", 400);
  }

  const result = await extractListing(input);
  if (!result.ok) return fail(MESSAGES[result.reason], result.reason === "rate_limited" ? 429 : 502);
  return NextResponse.json({ ok: true, data: result.data });
}
