// Timezone-aware day helpers. A "day" for the daily mentor is the user's local day.

export function safeTimeZone(tz: string | null | undefined): string {
  try {
    if (tz) {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    }
  } catch {}
  return "UTC";
}

function parts(tz: string, date: Date) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** "YYYY-MM-DD" of `date` in timezone `tz`. */
export function localDateKey(tz: string, date = new Date()): string {
  const { y, m, d } = parts(tz, date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Minutes the timezone is ahead of UTC at `date`. */
function offsetMinutes(tz: string, date: Date): number {
  const { y, m, d, h, min, s } = parts(tz, date);
  return (Date.UTC(y, m - 1, d, h, min, s) - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/** The instant of the next local midnight (end of the user's day). */
export function endOfLocalDay(tz: string, now = new Date()): Date {
  const { y, m, d } = parts(tz, now);
  const guess = Date.UTC(y, m - 1, d + 1);
  return new Date(guess - offsetMinutes(tz, new Date(guess)) * 60000);
}

/** Shift a "YYYY-MM-DD" key by n days. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Monday of the week containing `key`. */
export function weekStartKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

/** Local hour (0–23) — for "good morning/evening". */
export function localHour(tz: string, now = new Date()): number {
  return parts(tz, now).h;
}

/** Current and best streak of consecutive local days that have activity. */
export function computeStreak(dayKeys: Iterable<string>, todayKey: string) {
  const days = new Set(dayKeys);
  // Today not done yet doesn't break the streak — it's still alive from yesterday.
  let cursor = days.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of [...days].sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best, doneToday: days.has(todayKey) };
}
