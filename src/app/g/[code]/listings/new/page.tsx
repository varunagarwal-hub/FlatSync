import { notFound } from "next/navigation";
import { ListingForm } from "@/components/ListingForm";
import { loadGroup } from "@/lib/data";

export default async function NewListingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadGroup(code);
  if (data.kind !== "member") notFound();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Add a listing</h2>
        <p className="text-sm text-stone-600">Something one of you found. Everyone in the group will see it.</p>
      </div>
      <ListingForm groupId={data.group.id} code={data.group.code} areas={data.areas} />
    </div>
  );
}
