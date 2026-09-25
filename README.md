# FlatSync

Helps a group of 2 to 6 friends (3 by default) shortlist one shared flat. The app never searches for or scrapes listings. The friends add the ones they find.

1. One person creates a group, picks how many people it's for (2–6), and shares the 6-character code. The creator can change the size until answers are revealed, e.g. lower it if someone drops out.
2. Each member privately fills in their constraints: max rent share (₹), areas (acceptable / not), must-haves (lift, parking, min bathrooms, pet-friendly) and nice-to-haves. Nobody can see anyone else's answers until the group is full and everyone has submitted, and answers lock on submit.
3. Anyone adds listings (area, total rent, floor, link) with each must-have marked Yes / No / Not sure.
4. Once everyone has submitted, the app rules out listings that break a must-have, sit in a rejected area, or exceed the combined budget. "Not sure" on a needed must-have gets flagged **confirm before visiting** instead of passing. What's left is ranked by nice-to-haves met, and the top 3 are shown with a per-person breakdown of what each person gets and compromises on.

### Maps, localities and pasted listings

- **Anchor + radius.** In the constraints form, each member searches for an anchor location (OpenStreetMap Nominatim) and picks a 3 km or 5 km radius. Like every other answer, it stays private until everyone submits.
- **Map.** The overview page shows a Leaflet map with each member's circle and the zone inside all of them. Before the reveal you only see your own circle.
- **Localities to search.** For localities inside the overlap zone, buttons open NoBroker and 99acres search pages in a new tab. The app builds the links but never fetches or scrapes those sites.
- **Paste listing.** When adding a listing, paste its text or upload a screenshot. A server-side route sends only that text or image to Google Gemini, which returns the area, rent, floor, lift, parking, bathrooms and pets. The form is filled in for you to check. Every extracted must-have is marked "From listing – not confirmed" and counts as Not sure in matching until a member confirms it on the listings page. If Gemini fails or is rate-limited, you get a friendly message and fill the form in by hand. Manual entry works as before.
- **Radius flags.** A listing outside someone's radius is flagged (not ruled out), naming whose radius and how far away it is. A listing's location is its area's location, geocoded when the area is added.

## Stack

Next.js 16 (App Router, server actions) · Supabase (Postgres, RLS, anonymous auth) · Tailwind 4 · Vitest.

## Setup

1. **Create a Supabase project.**
2. **Enable anonymous sign-ins:** Authentication → Sign In / Providers → *Allow anonymous sign-ins*. Members don't create accounts. Each browser gets an anonymous session, which is how the app knows who is who.
3. **Run the migrations, in order:** paste `supabase/migrations/0001_init.sql` into the SQL editor and run it, then do the same with `0002_maps_and_paste.sql` and `0003_group_size.sql`. Or use `supabase db push` with the Supabase CLI.
4. **Configure env:** copy `.env.example` to `.env.local` and fill in the project URL and anon (or publishable) key from Project Settings → API.
5. Run it:

   ```bash
   npm install
   npm run dev
   ```

## Deploy on Vercel

1. Push the repo to GitHub and import it in Vercel. The framework is auto-detected.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `GEMINI_API_KEY` under Project → Settings → Environment Variables. `GEMINI_API_KEY` must not start with `NEXT_PUBLIC_`, so it stays on the server. Without it, "Paste listing" shows a message and manual entry still works.
3. Deploy.

Optional: in Supabase, turn on CAPTCHA for anonymous sign-ins (Authentication → Attack Protection) to limit abuse.

## Tests

```bash
npm test
```

- `src/lib/matching.test.ts` covers every matching rule: hard filters, "not sure" flags, ranking, tie-breaks and the per-person breakdown.
- `supabase/tests/migration.test.ts` runs the real migration in PGlite (in-process Postgres) with a stub of Supabase's auth schema. It checks the privacy rules as each user: answers hidden until everyone submits, the group-size cap (groups of 2 to 6), the submission lock, and that non-members see nothing.

## How the privacy works

The rule is enforced in Postgres, not just hidden in the UI:

- `member_constraints` and `area_ratings` have RLS policies that return a row only to its owner, or to fellow members once `group_revealed()` is true (the group is full and everyone has submitted).
- These tables have no insert or update policies. Writes go through the `save_constraints` / `rate_new_areas` RPCs, which refuse changes after submission.
- `member_statuses()` tells the group who has submitted without exposing what they said.

## Matching rules (`src/lib/matching.ts`)

| Situation | Result |
| --- | --- |
| Area marked not acceptable by anyone | Ruled out |
| A must-have someone needs is **No** (or too few bathrooms) | Ruled out |
| Total rent > sum of everyone's max share | Ruled out |
| A must-have someone needs is **Not sure** | Flagged: confirm before visiting |
| Area someone hasn't rated yet (added after they submitted) | Flagged |

Flagged listings stay on the shortlist, with the flag shown. Ranking: nice-to-haves met (one point per person per preference marked Yes), then fewer things to confirm, then lower rent. The app shows up to 3 options as a set and never names a single winner. If fewer than 3 pass, it says so and asks for more listings.

The budget check uses the combined budget, as specified. If an even split puts someone over their personal max, it shows as a compromise in that person's breakdown, not as a rule-out.

## Layout

```
supabase/migrations/0001_init.sql   schema, RLS, RPCs
supabase/tests/                     migration + privacy tests (PGlite)
src/proxy.ts                        refreshes the Supabase session cookie
src/lib/matching.ts                 pure matching function (+ tests)
src/lib/data.ts                     loads everything a group page needs
src/app/actions/                    server actions: groups, constraints, listings
src/app/g/[code]/                   overview, constraints, listings, add listing
src/components/                     forms, shortlist cards, counter, etc.
```
