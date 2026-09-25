import Link from "next/link";
import { notFound } from "next/navigation";
import { ConstraintsSummary } from "@/components/ConstraintsSummary";
import { Counter } from "@/components/Counter";
import { GroupSizeControl } from "@/components/GroupSizeControl";
import { RevealCelebration } from "@/components/RevealCelebration";
import { ShortlistCard } from "@/components/ShortlistCard";
import { SubmissionStatus } from "@/components/SubmissionStatus";
import { WhereToLook } from "@/components/WhereToLook";
import { loadGroup, type MemberGroupData } from "@/lib/data";
import { formatINR, joinNames } from "@/lib/format";
import { TOP_N } from "@/lib/matching";
import { colorMap, memberColor } from "@/lib/memberColors";

export default async function GroupOverview({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadGroup(code);
  if (data.kind !== "member") notFound(); // the layout shows the join form

  const { group, members, match } = data;
  const base = `/g/${group.code}`;
  const colors = colorMap(members.map((m) => m.member_id));
  const optionWord = match?.top.length === 1 ? "option" : "options";

  return (
    <div className="space-y-7">
      {match && (
        <RevealCelebration
          groupId={group.id}
          people={members.map((m, i) => ({ name: m.display_name, color: memberColor(i) }))}
          optionCount={match.top.length}
        />
      )}

      <Counter
        added={data.listings.length}
        ruledOut={match?.counts.ruledOut ?? null}
        shortlisted={match?.counts.shortlisted ?? null}
      />

      {match ? (
        <section id="options" className="scroll-mt-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold">
              {match.top.length > 0 ? `${match.top.length} ${optionWord} to talk about` : "No options yet"}
            </h2>
            <p className="max-w-2xl text-sm text-muted">
              Up to {TOP_N} listings that pass everyone's must-haves, areas and the combined budget of{" "}
              <b className="text-ink">{formatINR(match.combinedBudget)}</b>. Ordered by how many wishes they meet: a
              starting point for the conversation, not a verdict.
            </p>
          </div>

          {match.top.length === 0 ? (
            <div className="card space-y-3 text-sm text-muted">
              <p>
                {data.listings.length === 0 ? (
                  "No listings yet. Found one on WhatsApp or a property site? Paste it in."
                ) : (
                  <>
                    Nothing passes everyone's constraints yet. See why on the{" "}
                    <Link className="font-bold text-link underline" href={`${base}/listings`}>
                      listings page
                    </Link>
                    .
                  </>
                )}
              </p>
              <Link className="btn-primary" href={`${base}/listings/new`}>
                + Add a listing
              </Link>
            </div>
          ) : (
            <>
              {match.top.length < TOP_N && (
                <p className="rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm text-muted">
                  Only {match.top.length} listing{match.top.length === 1 ? " passes" : "s pass"} so far.{" "}
                  <Link className="font-bold text-link underline" href={`${base}/listings/new`}>
                    Add more
                  </Link>{" "}
                  so you have options to compare.
                </p>
              )}
              <div className="grid gap-5 lg:grid-cols-2">
                {match.top.map((r, i) => (
                  <ShortlistCard key={r.listing.id} result={r} letter={String.fromCharCode(65 + i)} colors={colors} />
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
        <div className="space-y-4">
          <SubmissionStatus members={members} size={group.size} />
          {data.isCreator && !data.revealed && (
            <GroupSizeControl groupId={group.id} code={group.code} size={group.size} joined={members.length} />
          )}
        </div>
        {data.revealed && (
          <div className="card space-y-4 sm:col-span-2">
            <h2 className="text-lg font-extrabold">Everyone's answers</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {members.map((m) => {
                const c = data.constraints.find((x) => x.member_id === m.member_id);
                return c ? (
                  <ConstraintsSummary
                    key={m.member_id}
                    name={m.display_name}
                    color={colors[m.member_id]}
                    c={c}
                    areas={data.areas}
                    ratings={data.ratings}
                  />
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
  const toJoin = group.size - members.length;
  const steps = [
    !me.submitted && {
      key: "you",
      body: (
        <>
          <Link href={`/g/${group.code}/constraints`} className="font-bold text-link underline">
            Fill in your constraints
          </Link>
          . Only you can see them for now.
        </>
      ),
    },
    toJoin > 0 && {
      key: "join",
      body: (
        <>
          Waiting for {toJoin} more {toJoin === 1 ? "person" : "people"} to join. Share code{" "}
          <span className="font-mono font-bold">{group.code}</span>.
        </>
      ),
    },
    missing.length > 0 && { key: "submit", body: <>Waiting on {joinNames(missing)} to submit.</> },
    {
      key: "listings",
      body: (
        <>
          Meanwhile,{" "}
          <Link href={`/g/${group.code}/listings/new`} className="font-bold text-link underline">
            add listings
          </Link>
          . They're checked once everyone's in.
        </>
      ),
    },
  ].filter(Boolean) as { key: string; body: React.ReactNode }[];

  return (
    <section className="card space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-bold tracking-[0.1em] text-violet uppercase dark:text-link">Almost there</p>
        <h2 className="text-2xl font-extrabold">Options unlock when all {group.size} of you have submitted</h2>
      </div>
      <ul className="space-y-2.5 text-sm">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-block size-3 shrink-0 rounded-full border-2 border-edge bg-sun" aria-hidden="true" />
            <span className="text-muted">{s.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
