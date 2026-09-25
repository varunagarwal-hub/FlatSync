import Link from "next/link";
import { GroupNav } from "@/components/GroupNav";
import { JoinGroupForm } from "@/components/GroupForms";
import { ShareCode } from "@/components/ShareCode";
import { loadGroup } from "@/lib/data";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = await loadGroup(code);

  if (data.kind === "not-member") {
    return (
      <main className="mx-auto max-w-md space-y-4">
        <Link href="/" className="text-sm text-teal-700 hover:underline">
          ← FlatSync
        </Link>
        <div className="card space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Join this group</h1>
            <p className="text-sm text-stone-600">You're not in this group yet on this device. Enter your name to join.</p>
          </div>
          <JoinGroupForm defaultCode={code.toUpperCase().slice(0, 6)} />
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-xs text-stone-500 hover:underline">
              FlatSync
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">{data.group.name}</h1>
          </div>
          <ShareCode code={data.group.code} />
        </div>
        <GroupNav code={data.group.code} />
      </header>
      {children}
    </main>
  );
}
