import { checkRateLimit } from "./rate-limit";

const SECRET_HEADER = "x-civora-secret";

/**
 * Gates the public AI endpoints (underwrite / monitor) that burn the paid
 * model key. Two layers:
 * 1. Optional shared-secret header — set AI_ROUTE_SECRET to require
 *    `X-Civora-Secret` on every call (recommended for production).
 * 2. Per-IP rate limit so a single caller cannot exhaust the budget.
 * Returns a Response when the request must be rejected, otherwise null.
 */
export function guardAiRequest(req: Request): Response | null {
  const secret = process.env.AI_ROUTE_SECRET;
  if (secret) {
    const provided = req.headers.get(SECRET_HEADER) ?? "";
    if (!timingSafeEqual(provided, secret)) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }
  const limited = checkRateLimit(req);
  if (!limited.allowed) {
    return Response.json(
      { error: "rate limit exceeded — retry shortly" },
      { status: 429, headers: { "retry-after": String(limited.retryAfterSec) } },
    );
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
