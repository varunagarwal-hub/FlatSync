import Link from "next/link";
import { notFound } from "next/navigation";
import { ConstraintsSummary } from "@/components/ConstraintsSummary";
import { Counter } from "@/components/Counter";
import { ShortlistCard } from "@/components/ShortlistCard";
import { SubmissionStatus } from "@/components/SubmissionStatus";
import { WhereToLook } from "@/components/WhereToLook";
import { GROUP_SIZE } from "@/lib/constants";
import { loadGroup, type MemberGroupData } from "@/lib/data";
import { formatINR, joinNames } from "@/lib/format";
import { TOP_N } from "@/lib/matching";

export default async function GroupOverview({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadGroup(code);
  if (data.kind !== "member") notFound(); // the layout shows the join form

  const { group, members, me, match } = data;
  const base = `/g/${group.code}`;

  return (
    <div className="space-y-6">
      <Counter
        added={data.listings.length}
        ruledOut={match?.counts.ruledOut ?? null}
        shortlisted={match?.counts.shortlisted ?? null}
      />

      {match ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Options to consider together</h2>
            <p className="text-sm text-stone-600">
              Up to {TOP_N} listings that pass everyone's must-haves, areas and the combined budget of{" "}
              {formatINR(match.combinedBudget)}. They're ordered by how many nice-to-haves they meet. That's a starting
              point for discussion, not a verdict.
            </p>
          </div>

          {match.top.length === 0 ? (
            <div className="card text-sm text-stone-600">
              {data.listings.length === 0 ? (
                <>No listings yet. </>
              ) : (
                <>Nothing passes everyone's constraints yet. See why on the <Link className="text-teal-700 underline" href={`${base}/listings`}>listings page</Link>. </>
              )}
              <Link className="font-medium text-teal-700 underline" href={`${base}/listings/new`}>
                Add a listing
              </Link>
            </div>
          ) : (
            <>
              {match.top.length < TOP_N && (
                <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">
                  Only {match.top.length} listing{match.top.length === 1 ? " passes" : "s pass"} so far. Add more so you have
                  options to compare.
                </p>
              )}
              <div className="space-y-4">
                {match.top.map((r) => (
                  <ShortlistCard key={r.listing.id} result={r} />
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
        <Waiting data={data} />
      )}

      <WhereToLook data={data} />

      <div className="grid gap-6 sm:grid-cols-2">
        <SubmissionStatus members={members} />
        {data.revealed && (
          <div className="card space-y-3 sm:col-span-2">
            <h2 className="font-semibold">Everyone's constraints</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {members.map((m) => {
                const c = data.constraints.find((x) => x.member_id === m.member_id);
                return c ? (
                  <ConstraintsSummary key={m.member_id} name={m.display_name} c={c} areas={data.areas} ratings={data.ratings} />
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Waiting({ data }: { data: MemberGroupData }) {
  const { members, me, group } = data;
  const missing = members.filter((m) => !m.submitted && !m.is_me).map((m) => m.display_name);
  const toJoin = GROUP_SIZE - members.length;

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">The shortlist appears once all {GROUP_SIZE} of you have submitted</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
        {!me.submitted && (
          <li>
            <Link href={`/g/${group.code}/constraints`} className="font-medium text-teal-700 underline">
              Fill in your constraints
            </Link>{" "}
            (only you can see them for now).
          </li>
        )}
        {toJoin > 0 && (
          <li>
            Waiting for {toJoin} more {toJoin === 1 ? "person" : "people"} to join. Share code{" "}
            <span className="font-mono">{group.code}</span>.
          </li>
        )}
        {missing.length > 0 && <li>Waiting on {joinNames(missing)} to submit.</li>}
        <li>
          You can already{" "}
          <Link href={`/g/${group.code}/listings/new`} className="text-teal-700 underline">
            add listings
          </Link>
          . They're checked once everyone's in.
        </li>
      </ul>
    </section>
  );
}
