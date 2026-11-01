# UnfoldAI

AI-powered personal skill development. UnfoldAI assesses your current abilities, gives you one small real-world challenge at a time, learns from your reflections, and tracks real skill growth.

- **12 core skills** every user develops (Communication, Confidence, Critical Thinking, …)
- **12 optional specific skills** users choose (Public Speaking, Negotiation, Leadership, …)

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 |
| Database | SQLite (local) via Prisma — switchable to Postgres |
| AI | Google Gemini free tier, behind a provider interface (`src/ai/`) |
| Validation | Zod (forms and AI output) |

## How it works

1. **Sign up** and pick your own level (Beginner → Expert) for each skill.
2. **Choose a skill** to work on and **describe your real situation**.
3. UnfoldAI gives you **one practical step** for that situation.
4. Do it, then **give feedback** on how it went.
5. UnfoldAI identifies your **pain points** and gives the **next step** targeting them.
6. Every day your **mentor checks in**: a personal message about last time and today's focus, a 🔥 streak, a weekly review, and an **Ask your mentor** chat that knows your situation.
7. Your **level goes up** as your performance improves (Beginner 0–25, Developing 25–45, Capable 45–65, Strong 65–85, Expert 85–100).

## Getting started

Requires Node.js 20+ and pnpm (`corepack enable pnpm`).

```bash
pnpm install
cp .env.example .env        # optional: add GEMINI_API_KEY (free: https://aistudio.google.com/apikey)
pnpm db:setup               # create the database and seed the 24 skills
pnpm dev                    # http://localhost:3000
```

Without an AI key the app still works, using built-in practical steps and rule-based feedback analysis.

- Tests: `pnpm test` · Type check: `pnpm typecheck` · Health: <http://localhost:3000/api/health>

## Project structure

```
app/                  pages and API routes
src/ai/               AI provider interface, Gemini provider, structured output
src/lib/              shared utilities (database client)
src/server/engine/    scoring, level-ups, skill suggestion, memory, fallback steps
src/server/services/  sessions, feedback analysis, assessment, skills
src/server/skills/    skill catalog (source of truth for seeding)
prisma/               schema, migrations, seed
```

## Roadmap

0. Foundation — project setup, schema, AI layer ✅
1. Auth, onboarding, skill selection ✅
2. Self-selected levels ✅
3. Situation-based practical steps ✅
4. Feedback, pain points, next step, level-ups ✅
5. Dashboard and progress tracking ✅
6. Daily mentor: check-in, daily steps, streak, weekly review, mentor chat ✅
7. Reminders (email / notifications), hardening — next
