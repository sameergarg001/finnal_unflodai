// Small in-memory fixed-window rate limiter (per server instance).
// Good enough for a single Node server; use Redis or similar when scaling out.

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the action is allowed, false if `key` exceeded `limit` in `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  b.count++;
  return b.count <= limit;
}
