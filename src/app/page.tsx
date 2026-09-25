import { CreateGroupForm, JoinGroupForm } from "@/components/GroupForms";

export default async function Home({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const { join } = await searchParams;
  const joinCode = typeof join === "string" ? join.toUpperCase().slice(0, 6) : "";

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">FlatSync</h1>
        <p className="max-w-2xl text-stone-600">
          For 2 to 6 friends looking for one flat. Each of you privately sets your budget, areas and must-haves. You add
          the listings you find yourselves, and the app rules out what doesn't work for someone. It then shows up to three
          options with what each of you gets and gives up.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className={`card space-y-4 ${joinCode ? "sm:order-2" : ""}`}>
          <h2 className="text-lg font-semibold">Start a group</h2>
          <CreateGroupForm />
        </section>
        <section className={`card space-y-4 ${joinCode ? "ring-2 ring-teal-600/30 sm:order-1" : ""}`}>
          <h2 className="text-lg font-semibold">Join a group</h2>
          <JoinGroupForm defaultCode={joinCode} />
        </section>
      </div>

      <ol className="grid gap-3 text-sm text-stone-600 sm:grid-cols-4">
        {[
          "One person creates the group and shares the code.",
          "Each of you fills in your constraints. Nobody sees anyone else's until everyone submits.",
          "Anyone adds listings they've found: area, rent, floor, link.",
          "See the top 3 options with a per-person breakdown.",
        ].map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-semibold text-teal-700">{i + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
    </main>
  );
}
