import { BrandMark, Wordmark } from "@/components/BrandMark";
import { CreateGroupForm, JoinGroupForm } from "@/components/GroupForms";

const STEPS = [
  { title: "Start a group", body: "Pick how many of you (2–6) and share the code." },
  { title: "Answer privately", body: "Budget, areas, must-haves, wishes. Hidden until everyone submits." },
  { title: "Add what you find", body: "Paste a listing or a screenshot. The app fills in the details." },
  { title: "Talk it through", body: "Up to 3 options, with what each of you gets and gives up." },
];

const STEP_COLORS = ["bg-coral text-night", "bg-violet text-white", "bg-mint text-night", "bg-sun text-night"];

export default async function Home({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const { join } = await searchParams;
  const joinCode = typeof join === "string" ? join.toUpperCase().slice(0, 6) : "";

  return (
    <main className="space-y-10">
      <header className="grid items-center gap-6 sm:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <p className="m-0">
            <Wordmark />
          </p>
          <h1 className="text-5xl leading-[0.95] font-extrabold sm:text-6xl">
            One flat that works for{" "}
            <span className="relative inline-block">
              <span className="relative z-10">all of you</span>
              <span className="absolute inset-x-0 bottom-1 -z-0 h-4 rounded-full bg-sun sm:h-5 dark:-bottom-1 dark:h-1.5 sm:dark:h-2" aria-hidden="true" />
            </span>
            .
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Everyone sets their budget, areas and must-haves in private. You add the listings you find, and the app rules
            out what doesn't work for someone. You're left with a few options and the trade-offs, so the choice is
            yours to make together.
          </p>
        </div>
        <BrandMark animate className="mx-auto hidden w-full max-w-[260px] sm:block" />
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className={`card space-y-4 ${joinCode ? "sm:order-2" : ""}`}>
          <h2 className="text-2xl font-extrabold">Start a group</h2>
          <CreateGroupForm />
        </section>
        <section className={`card space-y-4 ${joinCode ? "bg-sun/20 sm:order-1" : ""}`}>
          <h2 className="text-2xl font-extrabold">{joinCode ? "You've been invited" : "Join a group"}</h2>
          <JoinGroupForm defaultCode={joinCode} />
        </section>
      </div>

      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card-flat space-y-2">
            <span
              className={`inline-flex size-8 items-center justify-center rounded-full border-2 border-edge font-display text-sm font-extrabold ${STEP_COLORS[i]}`}
            >
              {i + 1}
            </span>
            <p className="font-display text-base font-extrabold">{s.title}</p>
            <p className="text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <p className="text-center text-xs text-faint">
        FlatSync never searches or scrapes property sites. You add the listings; it helps you decide.
      </p>
    </main>
  );
}
