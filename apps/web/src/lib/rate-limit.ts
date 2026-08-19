/**
 * Minimal in-memory sliding-window rate limiter for the public AI endpoints.
 *
 * The GMI model calls on /api/underwrite and /api/monitor burn a paid API key,
 * so cap how often a single IP can hit them. The window is process-local: on a
 * single Node server (or `next dev`) it is exact; on serverless deployments it
 * is approximate per cold instance. That is an accepted trade-off for a demo —
 * it still stops casual spam and accidental runaway loops.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? 15);

const hits = new Map<string, number[]>();

export function checkRateLimit(req: Request): { allowed: boolean; retryAfterSec: number } {
  if (hits.size > 10_000) {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [k, v] of hits) {
      if (v.length === 0 || v[v.length - 1] < cutoff) hits.delete(k);
    }
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const window = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (window.length >= MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((window[0] + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  window.push(now);
  hits.set(ip, window);
  return { allowed: true, retryAfterSec: 0 };
}
