# UnfoldAI — Progress Notes

> This file is updated after every step. Newest updates are at the top of "Log".
> Open the app: http://localhost:3000 (while the dev server is running)

---

## 👉 Right now

**Working on:** Nothing right now — mobile app redesign is finished. Waiting for your next instructions.

**Status:** ✅ All 10 steps done, tested, saved to GitHub.

**How to use it on your phone:** your phone and computer must be on the same Wi-Fi; open the app in the phone's browser, then "Add to Home Screen". (Or open http://localhost:3000 on the computer and make the browser window narrow.)

---

## Current task: Mobile app + minimal design

What you asked for:
- Feel like a mobile app, not a website
- Clean login — no extra questions
- Don't ask the user many questions
- Nothing forced — extra choices hidden in a menu the user can open if they want
- Very minimal

Plan (✅ done · ⏳ in progress · ⬜ not started):

| # | Step | Status |
|---|------|--------|
| 1 | Phone-size layout + bottom tab bar (Today · Mentor · Progress · Me) | ✅ |
| 2 | Installable on phone home screen (opens full-screen like an app) | ✅ |
| 3 | Clean login & sign-up: only email + password | ✅ |
| 4 | Remove forced onboarding + level quiz (12 core skills start automatically) | ✅ |
| 5 | "Me" tab: optional hidden sections — my skills, my levels, about me, log out | ✅ |
| 6 | Today screen: mentor message + one text box "What's going on today?" (skill choice hidden in a small menu) | ✅ |
| 7 | Feedback: just "Did it / Didn't" + "How did it go?" (ratings hidden in "More detail") | ✅ |
| 8 | Mentor tab: full-screen chat | ✅ |
| 9 | Progress tab: levels, streak, weekly review (history hidden) | ✅ |
| 10 | Test everything, save to GitHub | ✅ |

---

## Known problems

- **Free Gemini AI is slow / not answering** (17–119 seconds, then stopped). Probably the free usage limit.
  The app still works using built-in steps and messages, but it feels less personal.
  **Fix options:** wait for the daily limit to reset, or add **Groq** (free, answers in 1–3 seconds) — needs a free key from https://console.groq.com/keys
- Reminders (notifications/email) not built yet — planned for later.

---

## What's already built

| Feature | Status |
|---|---|
| Sign up / log in | ✅ |
| 12 core skills + 12 optional specific skills | ✅ |
| Choose a skill + describe your situation → AI gives one practical step | ✅ |
| Feedback → AI finds pain points → next step targets them | ✅ |
| Levels (Beginner → Expert) that go up with performance, "Level up!" message | ✅ |
| Daily mentor message, daily step, 🔥 streak, weekly review | ✅ |
| "Ask your mentor" chat | ✅ |
| Works even when AI is down (built-in fallbacks) | ✅ |
| Mobile-app design: bottom tabs, minimal screens, installable, nothing forced | ✅ |
| Automated tests (15) + full flow test | ✅ |
| Code saved on GitHub: https://github.com/sameergarg001/finnal_unflodai | ✅ |

---

## Log

### 2026-11-01
- Step 10 ✅ Re-took all screenshots — all 5 problems confirmed fixed. Signed up as a brand-new user in a real browser: only email + password, then straight to Today. 15 automated tests pass. Saved to GitHub.
- Step 10 (testing) Took iPhone-size screenshots of all 9 screens and checked them. Found and fixed 5 problems:
  1. A black "N" developer badge covered the Today tab → hidden.
  2. Missing full stop in the mentor's message → fixed.
  3. Without AI, "next step" repeated the same step → now it's always different, and the 3rd time it becomes "Try again" with a plan for your pain point.
  4. On the Mentor tab, both "Mentor" and "Me" were highlighted → fixed.
  5. Progress showed 12 identical bars → now only skills you've worked on; the rest are under "Other skills".
- Step 9 ✅ Progress tab: 3 small boxes on top (🔥 streak, best streak, steps done), "This week" review (only shows once there's something to review), Levels list (↑ green when you've leveled up). "What your mentor noticed" and "Past steps" are closed sections.
- Step 8 ✅ Mentor tab: full-screen chat like a messaging app (your messages on the right in blue, mentor on the left), round send button.
- Step 7 ✅ Step screen: the step, then "Check in" = two buttons (✓ Did it / Didn't manage) + one text box "How did it go?". Ratings are optional under "+ More detail". After sending: "Your mentor is reading it…", then mentor's reply, "Work on" (pain points), Level up 🎉, and a "Next step →" button. Chat, your situation, and "skip" are tucked away at the bottom.
- Step 6 ✅ Today screen is now just: 🔥 streak (top right), mentor's message (blue card), and either today's step or one text box "What's going on today?". The skill is picked for you — tap "Skill: …" to change it. Skill lists moved off this screen.
- Step 5 ✅ "Me" tab: your email + 3 closed sections you can open if you want — About me (name, what you do, goals), Extra skills (tap chips), My levels (change only if wrong). Log out button.
- Step 4 ✅ No more forced questions after sign-up. New users go straight to Today. All 12 core skills start automatically at level "Capable" and adjust with performance. Removed the onboarding and level-quiz screens.
- Step 3 ✅ Clean login & sign-up: logo, email, password, one button. No name, no extra questions. Opening the app goes straight to Today (or login) — no website landing page.
- Step 2 ✅ App icon (blue "U") + install settings: can be added to phone home screen, opens full-screen.
- Step 1 ✅ Phone-size layout with bottom tab bar: Today · Mentor · Progress · Me. Bigger buttons and inputs for thumbs.
- **Notes file created** (this file). Starting the mobile app redesign.
- Built the daily mentor (daily message, daily step, streak, weekly review, mentor chat). Tested. Saved to GitHub.
- Added Gemini AI key. AI works but the free tier is very slow / limited.
- Built situation-based practical steps, pain points, next steps, level-ups. Tested. Saved to GitHub.
- Set up project (Next.js, database, AI layer). Switched installer to pnpm because the internet was slow.
