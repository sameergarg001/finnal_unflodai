import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, computeStreak, endOfLocalDay, localDateKey, safeTimeZone, weekStartKey } from "./time";

test("localDateKey respects timezone", () => {
  const t = new Date("2026-11-01T20:00:00Z");
  assert.equal(localDateKey("UTC", t), "2026-11-01");
  assert.equal(localDateKey("Asia/Kolkata", t), "2026-11-02"); // UTC+5:30 → 01:30 next day
  assert.equal(localDateKey("America/Los_Angeles", t), "2026-11-01");
});

test("endOfLocalDay is the next local midnight", () => {
  const t = new Date("2026-11-01T10:00:00Z");
  assert.equal(endOfLocalDay("UTC", t).toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(endOfLocalDay("Asia/Kolkata", t).toISOString(), "2026-11-01T18:30:00.000Z");
});

test("weekStartKey returns Monday", () => {
  assert.equal(weekStartKey("2026-11-01"), "2026-10-26"); // Sunday → previous Monday
  assert.equal(weekStartKey("2026-11-02"), "2026-11-02"); // Monday
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("streak: today pending keeps yesterday's streak alive; gaps reset", () => {
  const today = "2026-11-10";
  assert.deepEqual(computeStreak(["2026-11-09", "2026-11-08", "2026-11-07"], today), { current: 3, best: 3, doneToday: false });
  assert.equal(computeStreak(["2026-11-10", "2026-11-09"], today).current, 2);
  assert.equal(computeStreak(["2026-11-08"], today).current, 0); // missed yesterday
  assert.equal(computeStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-09"], today).best, 3);
  assert.equal(computeStreak([], today).current, 0);
});

test("invalid timezone falls back to UTC", () => {
  assert.equal(safeTimeZone("Not/AZone"), "UTC");
  assert.equal(safeTimeZone(undefined), "UTC");
});
