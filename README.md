# UnfoldAI

AI-powered personal skill development. UnfoldAI is a personal mentor that understands your situation, gives you **one real-life challenge at a time**, waits for you to try it, analyses how it went, and tracks progress **only when there is evidence**.

**Cycle:** understand → identify → challenge → action → feedback → analysis → improvement.

## Features

- **Sign in:** Continue with Google (real OAuth) or email + password.
- **Onboarding:** short profile (name, age, profession, goal, about; skippable) → self-assessment of the **5 fixed core skills** (Communication, Confidence, Discipline, Problem-solving, Adaptability), 0–100.
- **Dashboard:** greeting, mentor message, overall development, skill cards (score, progress, challenges done, trend), add skills, recent activity, notifications.
- **Skills:** each skill has its own development framework (subskills, assessment criteria, challenge categories, feedback questions, progression). Add catalog skills (Networking, Public speaking, Leadership…) or create custom ones; duplicates are detected.
- **AI coach:** per-skill conversation that knows your history, asks one question at a time, then designs a personalised challenge (difficulty, objective, steps, example, feedback instructions). Options: take it, another one, make it easier, explain how, tell more.
- **Waiting state:** one active challenge per skill; it waits for you, no matter how long. Ask for help or abandon (never penalised).
- **Feedback:** completed / partial / unsuccessful / couldn't attempt, then skill-specific questions one at a time (voice input where the browser supports it).
- **Analysis:** what went well, areas to improve, next focus and subskill, recommended difficulty.
- **Two scores:** your **self-assessment** and UnfoldAI's **evidence-based assessment**. A backend scoring engine (`src/server/engine/scoring.ts`) decides every change: no increase without specific evidence, no penalties for unsuccessful attempts, max +5 per activity, every change stored with reason, previous score, new score and evidence.
- **Revise previous progress**, **Reports** (trend, self vs evidence, subskills, completion rate, most improved, repeated weaknesses, consistency), **Profile** (edit, skills, notifications, theme, password, logout, delete account).

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router, server actions) + TypeScript, mobile-first PWA |
| Styling | Tailwind CSS 4, dark design tokens (light theme optional) |
| Database | SQLite (local) via Prisma, switchable to Postgres |
| AI | Provider interface in `src/ai/`: Groq (free), Gemini (free), Claude (optional, paid) |
| Validation | Zod for forms and every AI response |

> The original brief suggested Expo + Express + MongoDB. This app keeps the existing Next.js codebase. The same features run in the phone browser and can be installed to the home screen. A native Expo client can be added later on top of the same services.

## Getting started

Requires Node.js 20+ and pnpm (`corepack enable pnpm`).

```bash
pnpm install
cp .env.example .env        # add GROQ_API_KEY (free) and Google OAuth keys
pnpm db:setup               # create the database and seed the skills
pnpm dev                    # http://localhost:3000
```

Without an AI key the app still works, using built-in challenges and clearly labelled basic analysis (which can only make small score changes).

- Tests: `pnpm test` · Type check: `pnpm typecheck` · Health: <http://localhost:3000/api/health>

## Project structure

```
app/                     pages, server actions (app/actions.ts), Google OAuth routes
src/ai/                  providers (groq, gemini, anthropic) + prompts & Zod schemas
src/server/auth/         sessions, passwords, Google OAuth
src/server/engine/       scoring engine, difficulty, memory, fallback challenges
src/server/services/     coach & challenges, skills, assessment, progress, notifications
src/server/skills/       skill catalog + development frameworks (seed source)
src/components/          UI components
prisma/                  schema, migrations, seed
```

## Security

- httpOnly session cookies (hashed tokens in the DB); OAuth `state` check; API keys only on the server.
- Every query is scoped to the signed-in user (ownership checks).
- Rate limits on login, sign-up, Google sign-in and AI calls. Zod validation everywhere.
- AI output is validated and never writes to the database directly; the backend decides scores.
- Account deletion removes all personal data. Security headers are set in `next.config.ts`.
