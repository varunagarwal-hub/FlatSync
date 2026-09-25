import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/nominatim";
import { createClient } from "@/lib/supabase/server";

// Server-side proxy for Nominatim search, so every request carries the app's
// User-Agent and results are cached. Called on a button press, never per keystroke.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3 || q.length > 200) {
    return NextResponse.json({ ok: false, error: "Type at least 3 characters" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Join a group first" }, { status: 401 });

  try {
    const places = await searchPlaces(q, { limit: 5 });
    return NextResponse.json({ ok: true, places });
  } catch (err) {
    console.error("Geocode failed:", err);
    return NextResponse.json(
      { ok: false, error: "Couldn't search OpenStreetMap right now. Try again in a moment." },
      { status: 502 },
    );
  }
}
