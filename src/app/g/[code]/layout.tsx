import Link from "next/link";
import { AvatarStack } from "@/components/Avatar";
import { GroupNav } from "@/components/GroupNav";
import { JoinGroupForm } from "@/components/GroupForms";
import { ShareCode } from "@/components/ShareCode";
import { loadGroup } from "@/lib/data";
import { memberColor } from "@/lib/memberColors";

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
      <main className="mx-auto max-w-md space-y-5">
        <Link href="/" className="text-xs font-bold tracking-[0.1em] text-violet uppercase dark:text-link">
          FlatSync
        </Link>
        <div className="card space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold">Join this group</h1>
            <p className="text-sm text-muted">You're not in this group yet on this device. Enter your name to join.</p>
          </div>
          <JoinGroupForm defaultCode={code.toUpperCase().slice(0, 6)} />
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Link href="/" className="text-xs font-bold tracking-[0.1em] text-violet uppercase dark:text-link">
              FlatSync
            </Link>
            <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">{data.group.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <AvatarStack
              people={data.members.map((m, i) => ({ id: m.member_id, name: m.display_name, color: memberColor(i) }))}
            />
            <ShareCode code={data.group.code} />
          </div>
        </div>
        <GroupNav code={data.group.code} />
      </header>
      {children}
    </main>
  );
}
