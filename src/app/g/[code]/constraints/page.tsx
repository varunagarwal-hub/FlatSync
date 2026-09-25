import { notFound } from "next/navigation";
import { AddAreaForm, RateNewAreasForm } from "@/components/AreaForms";
import { ConstraintsForm } from "@/components/ConstraintsForm";
import { ConstraintsSummary } from "@/components/ConstraintsSummary";
import { loadGroup } from "@/lib/data";

export default async function ConstraintsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadGroup(code);
  if (data.kind !== "member") notFound();

  const { group, me, areas, ratings } = data;
  const mine = data.constraints.find((c) => c.member_id === me.member_id) ?? null;
  const myRatings = ratings.filter((r) => r.member_id === me.member_id);

  if (mine?.submitted_at) {
    const rated = new Set(myRatings.map((r) => r.area_id));
    const unrated = areas.filter((a) => !rated.has(a.id));
    return (
      <div className="space-y-6">
        <div className="card space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Your constraints are submitted</h2>
            <p className="text-sm text-stone-600">
              {data.revealed
                ? "Everyone has submitted, so all answers are now visible to the group."
                : "They're locked, and hidden from the others until everyone submits."}
            </p>
          </div>
          <ConstraintsSummary name={me.display_name} c={mine} areas={areas} ratings={ratings} />
        </div>
        {unrated.length > 0 && <RateNewAreasForm groupId={group.id} code={group.code} areas={unrated} />}
        <AddAreaForm groupId={group.id} code={group.code} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Your constraints</h2>
        <p className="text-sm text-stone-600">
          Private until everyone in the group submits. Nobody, including you, can see anyone else's answers before then.
        </p>
      </div>
      <ConstraintsForm groupId={group.id} code={group.code} areas={areas} existing={mine} myRatings={myRatings} />
      <AddAreaForm groupId={group.id} code={group.code} />
    </div>
  );
}
