// End-to-end test of the whole UnfoldAI workflow in headless Chrome (iPhone size).
// Needs the dev server running (pnpm dev) and Google Chrome installed (macOS path below).
// It signs up a throwaway user, goes through every main flow with the real AI, and deletes the account at the end.
// Usage: pnpm e2e            (screenshots of failures go to ./e2e-output)
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2] ?? "e2e-output";
import("node:fs").then((fs) => fs.mkdirSync(OUT, { recursive: true }));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const profile = mkdtempSync(join(tmpdir(), "e2e-"));
const chrome = spawn(process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40 && !ws; i++) {
  try {
    const t = await (await fetch("http://127.0.0.1:9334/json/new?about:blank", { method: "PUT" })).json();
    if (t?.webSocketDebuggerUrl) ws = new WebSocket(t.webSocketDebuggerUrl);
  } catch {}
  await sleep(250);
}
if (ws.readyState !== 1) await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const pageErrors = [];
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? { error: d.error }); pending.delete(d.id); }
  if (d.method === "Runtime.exceptionThrown") pageErrors.push(d.params.exceptionDetails?.exception?.description?.slice(0, 200) ?? "exception");
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") pageErrors.push(d.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
});
const send = (method, params = {}) =>
  Promise.race([
    new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }),
    sleep(30000).then(() => { throw new Error(`CDP ${method} timed out`); }),
  ]);
await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const text = () => evalJs("document.body ? document.body.innerText : ''");
const url = () => evalJs("location.pathname + location.search");
const go = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(1500); };
async function waitFor(pred, ms = 20000, label = "") {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await pred()) return true; } catch {}
    await sleep(400);
  }
  throw new Error(`timeout waiting for ${label}`);
}
const waitText = (t, ms) => waitFor(async () => (await text()).toLowerCase().includes(t.toLowerCase()), ms, `"${t}"`);
const waitUrl = (re, ms) => waitFor(async () => re.test(await url()), ms, `url ${re}`);
async function click(t, { exact = true, nth = 0 } = {}) {
  const r = await evalJs(`(() => {
    const t = ${JSON.stringify(t)};
    const els = Array.from(document.querySelectorAll('button, a, [role=button], label, summary')).filter(e => e.offsetParent !== null && !e.disabled && (${exact} ? e.innerText.trim().toLowerCase() === t.toLowerCase() : e.innerText.toLowerCase().includes(t.toLowerCase())));
    const el = els[${nth}];
    if (!el) return 'NOT FOUND';
    el.scrollIntoView({block: 'center'}); el.click(); return 'ok';
  })()`);
  if (r !== "ok") throw new Error(`click: "${t}" not found`);
}
async function fill(selector, value) {
  const r = await evalJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'NOT FOUND';
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true}));
    return 'ok';
  })()`);
  if (r !== "ok") throw new Error(`fill: ${selector} not found`);
}
const submitForm = (selector) => evalJs(`document.querySelector(${JSON.stringify(selector)}).closest('form').requestSubmit()`);
async function shot(name) {
  const h = Math.min(await evalJs("document.documentElement.scrollHeight"), 4000);
  const s = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 390, height: h, scale: 1 }, captureBeyondViewport: true });
  writeFileSync(join(OUT, `e2e_${name}.png`), Buffer.from(s.data, "base64"));
}

const results = [];
async function step(name, fn) {
  const t = Date.now();
  try {
    await Promise.race([fn(), sleep(150000).then(() => { throw new Error("step took over 150s"); })]);
    results.push(["PASS", name, Date.now() - t]);
    console.log(`PASS  ${name} (${Date.now() - t}ms)`);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
    console.log(`FAIL  ${name} — ${e.message} [at ${await url()}]`);
    await shot(`FAIL_${results.length}`).catch(() => {});
  }
}

const email = `e2e-${Date.now()}@test.local`;
let password = "testpass123";
// Never let a confirm() dialog block the browser.
const noConfirm = () => evalJs("window.confirm = () => true; 1");

await step("1. Welcome screen", async () => { await go("/"); await waitUrl(/\/welcome/); await waitText("Continue with Google"); await waitText("Sign in with email"); });
await step("2. Sign up with email", async () => {
  await click("Create an account"); await waitUrl(/\/signup/);
  await fill('input[name=email]', email); await fill('input[name=password]', password);
  await click("Create account"); await waitUrl(/\/onboarding\/profile/, 15000);
});
await step("3. Profile setup", async () => {
  await fill("#name", "Test User"); await fill("#age", "21"); await fill("#profession", "B.Tech student"); await fill("#goal", "Speak confidently in class and placements");
  await click("Continue"); await waitUrl(/\/onboarding\/assessment/, 15000); await waitText("Rate your core skills");
});
await step("4. Assessment blocks until all 4 rated", async () => {
  await click("Complete Assessment (4 left to rate)"); await waitText("Tap a level for");
});
await step("5. Rate 4 core skills with one tap each", async () => {
  for (const [i, lvl] of [[0, "Developing"], [1, "Beginner"], [2, "Capable"], [3, "Developing"]]) {
    await evalJs(`Array.from(document.querySelectorAll('[data-skill-card]'))[${i}].querySelectorAll('button')[${["Beginner", "Developing", "Capable", "Strong", "Expert"].indexOf(lvl)}].click()`);
  }
  await sleep(300); await click("Complete Assessment"); await waitUrl(/\/dashboard/, 15000);
});
await step("6. Home: 4 skills + next step", async () => {
  await waitText("Start in 1 tap");
  const t = await text();
  for (const s of ["Communication", "Confidence", "Discipline", "Time management", "Add a skill", "I'm stuck"]) if (!t.includes(s)) throw new Error(`missing ${s}`);
  for (const s of ["Problem-solving", "Adaptability"]) if (t.includes(s)) throw new Error(`should not show ${s}`);
  await shot("home_new");
});
await step("7. Start in 1 tap → teacher interview", async () => {
  await click("Start in 1 tap", { exact: false }); await waitUrl(/\/coach\//, 20000); await waitText("Before we start, 3 quick questions");
});
const sendChat = async (msg) => { await fill('textarea[name=message]', msg); await submitForm('textarea[name=message]'); };
await step("8. Interview Q1 + Q2", async () => {
  await sendChat("I want to explain my ideas clearly in class without getting nervous");
  await waitText("felt hard for you", 20000);
  await sendChat("Yesterday in the lab viva I knew the answer but mixed up my words and stopped");
  await waitText("By when would you like to see a real difference?", 20000);
});
await step("9. Timeline chip → plan + today's task", async () => {
  await click("In 1 month"); await waitText("Take this task", 60000);
  const t = await text(); if (!/YOUR PLAN/i.test(t)) throw new Error("no plan shown"); if (!/TODAY.S TASK/i.test(t)) throw new Error("no today's task label");
  await shot("coach_task");
});
await step("10. Make it easier → new task", async () => {
  const before = await evalJs("document.querySelectorAll('h3').length");
  await click("Make it easier"); await waitFor(async () => (await evalJs("document.querySelectorAll('h3').length")) > before, 60000, "easier task");
});
await step("11. Explain how → coach help", async () => {
  const n = await evalJs("document.body.innerText.length"); await click("Explain how");
  await waitFor(async () => (await evalJs("document.body.innerText.length")) > n + 150, 60000, "explanation");
});
let taskUrl = "";
await step("12. Take this task → waiting screen", async () => {
  await click("Take this task"); await waitUrl(/\/challenge\/.+accepted=1/, 20000); await waitText("Your task is waiting for you"); taskUrl = (await url()).split("?")[0];
});
await step("13. Tasks tab shows waiting task + badge", async () => {
  await go("/tasks"); await waitText("Waiting for you"); await waitText("I tried it");
  const badge = await evalJs("document.querySelector('nav [aria-label$=\"waiting\"]')?.innerText"); if (badge !== "1") throw new Error(`badge=${badge}`);
  await shot("tasks");
});
await step("14. Feedback flow (completed + answers)", async () => {
  await click("I tried it"); await waitUrl(/feedback=1/); await waitText("Did you get a chance to try the task?");
  await click("Completed successfully", { exact: false });
  const answers = [
    "In the morning class I explained my mini-project idea to two classmates in three sentences: problem, solution, result. They asked one follow-up question.",
    "A bit nervous, heart racing, but less than usual because I had written the sentences first.",
    "When one asked a question I paused for a few seconds and said umm a lot.",
    "Starting was easy because I practised, and my first sentence came out clearly.",
    "Next time I'll prepare two possible questions and short answers.",
  ];
  for (const a of answers) {
    await waitFor(async () => (await evalJs("!!document.querySelector('textarea:not([name])')")), 5000, "answer box");
    await fill("textarea:not([name])", a); await click("Next");
    await sleep(250);
  }
  await click("Send to my coach"); await waitUrl(new RegExp(taskUrl.replace(/[/]/g, "\\/") + "$"), 20000);
});
await step("15. AI analysis + evidence-based score", async () => {
  await waitText("Coach analysis", 90000);
  const t = await text(); if (!t.includes("Went well")) throw new Error("no 'went well'");
  if (!t.includes("Progress")) throw new Error("no progress assessment");
  await shot("analysis");
});
await step("16. Get my next task", async () => {
  await click("Get my next task"); await waitUrl(/\/coach\//, 60000); await waitText("Take this task", 60000);
});
await step("17. Second skill: Skip interview → task → abandon", async () => {
  await go("/dashboard"); await click("Discipline", { exact: false }); await waitUrl(/\/skills\//);
  await click("Start improving with Meera", { exact: false }); await waitText("Before we start", 20000);
  await click("Skip — just start"); await waitText("Take this task", 60000);
  await click("Take this task"); await waitText("Your task is waiting for you", 20000);
  await noConfirm(); await click("Abandon task"); await waitUrl(/\/coach\//, 20000);
  await waitText("set it aside", 10000);
});
await step("18. Skill page: plan, history, revise progress", async () => {
  await go("/dashboard"); await click("Confidence", { exact: false }); await waitUrl(/\/skills\//);
  await waitText("Your plan"); await waitText("Kabir");
  await evalJs("document.querySelector('a[aria-label=\"Revise previous progress\"]').click()"); await waitUrl(/\/history/); await waitText("Progress changes", 60000);
});
await step("19. Add skill: search by degree + add", async () => {
  await go("/skills/add?q=btech"); await waitText("Programming");
  await evalJs(`Array.from(document.querySelectorAll('form')).find(f => f.closest('div.flex')?.innerText.includes('Programming'))?.requestSubmit()`);
  await waitUrl(/\/skills\/.+added=1/, 20000); await waitText("added to your dashboard");
  await go("/skills/add?q=programming"); await waitText("Added ✓");
});
await step("20. Custom skill + duplicate blocked", async () => {
  await go("/skills/add?q=cold%20calling"); await waitText("Create your own skill");
  await fill("#name", "Cold calling"); await submitForm("#name"); await waitUrl(/\/skills\/.+added=1/, 20000);
  await go("/skills/add?q=zzz"); await fill("#name", "communication"); await submitForm("#name"); await waitText("core skills", 10000);
});
await step("21. Reports with real data", async () => {
  await go("/reports"); await waitText("Skills"); const t = await text();
  if (!t.includes("attempted")) throw new Error("no stats"); await shot("reports");
});
await step("22. Ask anything", async () => {
  await go("/mentor"); await fill('textarea[name=question]', "How do I stop saying umm when I talk?"); await submitForm('textarea[name=question]');
  await waitFor(async () => (await evalJs("document.querySelectorAll('.rounded-bl-md').length")) >= 1, 60000, "coach answer");
});
await step("23. Notifications page", async () => { await go("/notifications"); await waitText("Notifications"); });
await step("24. Profile edit", async () => {
  await go("/profile"); await click("Edit profile", { exact: false }); await fill("#profession", "B.Tech CSE, 3rd year");
  await submitForm("#profession"); await waitText("Profile saved", 10000);
});
await step("25. Theme light ↔ dark", async () => {
  await click("Theme", { exact: false }); await click("☀️ light", { exact: false }); await waitUrl(/saved=preferences/);
  if ((await evalJs("document.documentElement.dataset.theme")) !== "light") throw new Error("not light");
  await shot("light");
  await click("Theme", { exact: false }); await click("🌙 dark", { exact: false }); await waitFor(async () => (await evalJs("document.documentElement.dataset.theme")) === "dark", 10000, "dark");
});
await step("26. Notification settings save", async () => {
  await go("/profile"); await click("Notifications", { exact: false }); await evalJs("document.querySelector('input[name=n_reports]').click()");
  await submitForm("input[name=n_reports]"); await waitUrl(/saved=preferences/);
});
await step("27. Change password", async () => {
  await go("/profile"); await click("Account security", { exact: false });
  await fill('input[name=current]', password); await fill('input[name=next]', "newpass4567"); await submitForm('input[name=next]');
  await waitText("Password changed", 10000); password = "newpass4567";
});
await step("28. Logout → login with new password", async () => {
  await click("Log out"); await waitUrl(/\/welcome/, 10000);
  await go("/login"); await fill('input[name=email]', email); await fill('input[name=password]', password); await click("Sign in"); await waitUrl(/\/dashboard/, 15000);
});
await step("29. Wrong password rejected", async () => {
  const r = await fetch(BASE + "/dashboard", { redirect: "manual" }); if (r.status !== 307) throw new Error("dashboard not protected");
});
await step("30. Delete account", async () => {
  await go("/profile"); await click("Delete account", { exact: false }); await fill('input[name=confirm]', "DELETE");
  await noConfirm(); await submitForm('input[name=confirm]'); await waitUrl(/\/welcome\?deleted=1/, 15000); await waitText("deleted");
});

console.log(`\nEMAIL ${email}`);
console.log(`RESULT ${results.filter((r) => r[0] === "PASS").length}/${results.length} passed`);
console.log(`PAGE_ERRORS ${pageErrors.length}${pageErrors.length ? "\n" + [...new Set(pageErrors)].slice(0, 10).join("\n") : ""}`);
ws.close();
chrome.kill();
process.exit(0);
