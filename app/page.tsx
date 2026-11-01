import { redirect } from "next/navigation";
import { CORE_SKILLS, SPECIFIC_SKILLS } from "@/server/skills/catalog";
import { getCurrentUser } from "@/server/auth/session";
import { ButtonLink } from "@/components/ui";

const STEPS = [
  { title: "Assess", text: "Find out where you are today across 12 core skills." },
  { title: "Challenge", text: "Get one small, real-world challenge at a time." },
  { title: "Reflect", text: "Tell us how it went and what was hard." },
  { title: "Grow", text: "Each next challenge adapts to you. Track real progress." },
];

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">UnfoldAI</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Build real skills, one small challenge at a time.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Not a chatbot. Not motivation. Practical challenges personalized to you, that get smarter
          with every reflection.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/signup">Get started — it's free</ButtonLink>
          <ButtonLink href="/login" variant="secondary">Log in</ButtonLink>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-sm font-semibold text-brand-600">0{i + 1}</span>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.text}</p>
          </div>
        ))}
      </section>

      <section className="mt-14 grid gap-8 md:grid-cols-2">
        <SkillList title="Core skills" subtitle="Everyone develops these" skills={CORE_SKILLS} />
        <SkillList title="Specific skills" subtitle="Pick the ones you want" skills={SPECIFIC_SKILLS} />
      </section>
    </main>
  );
}

function SkillList({
  title,
  subtitle,
  skills,
}: {
  title: string;
  subtitle: string;
  skills: { slug: string; name: string }[];
}) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-slate-500">{subtitle}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {skills.map((s) => (
          <li key={s.slug} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
