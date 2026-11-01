# UnfoldAI — Progress Notes

> This file is updated after every step. Newest updates are at the top of "Log".
> Open the app: http://localhost:3000 (computer) · http://10.17.44.231:3000 (phone, same Wi-Fi)

---

## 👉 Right now

**Working on:** Full UnfoldAI spec (Google login, 5 core skills, AI coach, challenges, feedback, evidence scores, reports, profile).

**Status:** ✅ Built and tested. ⏳ Waiting for 2 free keys: **Groq** (AI) and **Google login**.

---

## Current task: full UnfoldAI spec (everything free)

Decisions: keep the current Next.js app (not Expo/MongoDB), follow the new onboarding (Google login + profile + rate 5 skills), use only free services.

| # | Phase | Status |
|---|------|--------|
| 1 | Foundation: dark premium design, Google login (real OAuth), profile, Groq/Gemini/Claude AI providers, security | ✅ |
| 2 | Onboarding (profile + rate 5 core skills 0–100), dashboard, skill cards, add/search/custom skills | ✅ |
| 3 | AI coach chat per skill: knows your history, asks one question at a time | ✅ |
| 4 | Challenges: take it / another / easier / explain / tell more; one active per skill; waits for you | ✅ |
| 5 | Feedback (4 outcomes + questions one by one + voice), AI analysis, next challenge | ✅ |
| 6 | Two scores (self vs UnfoldAI evidence), scoring rules, history, reports with charts | ✅ |
| 7 | Profile (edit, skills, notifications, theme, password, delete account), notifications | ✅ |
| 8 | Tests (17 pass), full-flow test, screenshots, saved to GitHub | ✅ |
| 9 | Add free keys: Groq + Google login | ⏳ needs you |

---

## Known problems / what's left

- **Gemini free limit is used up for today** (only 20 requests/day). Until a Groq key is added, the coach uses built-in questions and challenges, and the analysis is basic (clearly labelled).
- **Google login button** shows "not set up yet" until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are added. Note: Google only allows `localhost` (or a real https domain) as the return address, so Google login works on the computer, not via the phone's 10.x address.
- Phone push notifications / email reminders are not built. Notifications appear inside the app (🔔).
- Native Android/iOS app (Expo) not built. The web app installs to the home screen instead.

---

## Log

### 2026-11-02
- Built the full UnfoldAI spec (see table above). Tested every flow with a script: onboarding, add skill (duplicate blocked), custom skill, coach questions, challenge, "easier", accept, second active challenge blocked, feedback, analysis, score +0.4 with reason, "could not attempt" = no change, abandon, reports, review, notifications. All 15 signed-in screens open without errors. Took iPhone-size screenshots and fixed 4 small layout/text issues.


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
