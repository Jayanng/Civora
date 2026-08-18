import { readFileSync } from "node:fs";
import path from "node:path";
import { keccak256, toBytes } from "viem";
import { putReport } from "@/lib/report-store";
import { checkRateLimit } from "@/lib/rate-limit";

const SYSTEM_PROMPT = [
  "You are the Civora Underwriter Agent for sustainability-linked assets on BOT Chain.",
  "Return only JSON matching the schema.",
  "You decide whether this asset's principal and coupon may settle, and the maximum BOT that may move.",
  "`approvedPrincipalWei` must be exactly the asset's `principalWei` (no partial principal).",
  "`approvedCouponWei` must be <= `couponWei` and > 0.",
  "Reject if holder is zero address, principal or coupon is 0, target hash or document hash is zero, or maturity is in the past.",
  "Be conservative. If data is thin, approve a lower coupon cap or reject.",
  "`reasoning` is short, factual, no marketing.",
  "",
  "Response schema:",
  JSON.stringify({
    schema: "civora.underwrite.v1",
    decision: '"approve" | "reject"',
    approvedPrincipalWei: '"0" if reject, the full principalWei if approve',
    approvedCouponWei: '"0" if reject, > 0 if approve, <= couponWei',
    expiresAt: "unix seconds, > now+10min and <= maturity",
    riskScore: "integer 0-100",
    conditions: "string[], max 5",
    reasoning: "string, max 500 chars",
    model: "the model id you are running as",
  }),
].join("\n");

function loadGmiConfig(): { key: string; model: string; baseUrl: string } {
  const key = process.env.GMI_API_KEY;
  if (key) {
    return {
      key,
      model: process.env.GMI_MODEL || "deepseek-ai/DeepSeek-V4-Flash",
      baseUrl: process.env.GMI_BASE_URL || "https://api.gmi-serving.com/v1",
    };
  }
  try {
    const raw = readFileSync(path.resolve(process.cwd(), "../../.env"), "utf8");
    const get = (name: string) => {
      const m = raw.match(new RegExp(`^${name}=(.+)$`, "m"));
      return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
    };
    const key2 = get("GMI_API_KEY");
    if (!key2) return { key: "", model: "", baseUrl: "" };
    return {
      key: key2,
      model: get("GMI_MODEL") || "deepseek-ai/DeepSeek-V4-Flash",
      baseUrl: get("GMI_BASE_URL") || "https://api.gmi-serving.com/v1",
    };
  } catch {
    return { key: "", model: "", baseUrl: "" };
  }
}

function parseModelJson(content: string): Record<string, unknown> | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const limited = checkRateLimit(req);
  if (!limited.allowed) {
    return Response.json(
      { error: "rate limit exceeded — retry shortly" },
      { status: 429, headers: { "retry-after": String(limited.retryAfterSec) } },
    );
  }
  const { key, model, baseUrl } = loadGmiConfig();
  if (!key) {
    return Response.json({ error: "underwriter unavailable" }, { status: 503 });
  }

  let body: {
    assetId?: string;
    principalWei?: string;
    couponWei?: string;
    maturity?: number;
    holder?: string;
    issuer?: string;
    targetHash?: string;
    documentHash?: string;
    assetType?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const { assetId, principalWei, couponWei, maturity, holder, issuer, targetHash, documentHash, assetType } = body;
  if (!assetId || !principalWei || !couponWei || typeof maturity !== "number" || !holder || !issuer || !targetHash || !documentHash || typeof assetType !== "number") {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const userContent = JSON.stringify({
    assetId, principalWei, couponWei, maturity, holder, issuer, targetHash, documentHash, assetType, model,
  });

  let completion: { choices?: Array<{ message?: { content?: string } }> };
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return Response.json({ error: `model call failed: ${res.status}` }, { status: 502 });
    }
    completion = (await res.json()) as typeof completion;
  } catch {
    return Response.json({ error: "model call failed" }, { status: 502 });
  }

  const content = completion.choices?.[0]?.message?.content;
  if (!content) return Response.json({ error: "empty model output" }, { status: 502 });
  const parsed = parseModelJson(content);
  if (!parsed) return Response.json({ error: "model did not return valid JSON" }, { status: 422 });

  const report = parsed as {
    schema?: unknown;
    decision?: unknown;
    approvedPrincipalWei?: unknown;
    approvedCouponWei?: unknown;
    expiresAt?: unknown;
    riskScore?: unknown;
    conditions?: unknown;
    reasoning?: unknown;
    model?: unknown;
  };

  const invalid = (reason: string) => Response.json({ error: reason }, { status: 422 });

  if (report.schema !== "civora.underwrite.v1") return invalid("schema mismatch");
  if (report.model !== model) return invalid("model mismatch");
  if (report.decision !== "approve" && report.decision !== "reject") return invalid("bad decision");
  if (typeof report.approvedPrincipalWei !== "string" || !/^\d+$/.test(report.approvedPrincipalWei)) {
    return invalid("bad approvedPrincipalWei");
  }
  if (typeof report.approvedCouponWei !== "string" || !/^\d+$/.test(report.approvedCouponWei)) {
    return invalid("bad approvedCouponWei");
  }
  if (typeof report.expiresAt !== "number" || !Number.isInteger(report.expiresAt)) {
    return invalid("bad expiresAt");
  }
  if (typeof report.riskScore !== "number" || !Number.isInteger(report.riskScore) || report.riskScore < 0 || report.riskScore > 100) {
    return invalid("bad riskScore");
  }
  if (!Array.isArray(report.conditions) || report.conditions.length > 5 || report.conditions.some((c) => typeof c !== "string")) {
    return invalid("bad conditions");
  }
  if (typeof report.reasoning !== "string" || report.reasoning.length > 500) return invalid("bad reasoning");

  const principal = BigInt(principalWei);
  const coupon = BigInt(couponWei);
  const approvedPrincipal = BigInt(report.approvedPrincipalWei);
  const approvedCoupon = BigInt(report.approvedCouponWei);

  if (approvedPrincipal > principal) return invalid("approvedPrincipalWei > principalWei");
  if (approvedCoupon > coupon) return invalid("approvedCouponWei > couponWei");
  if (report.decision === "reject" && (approvedPrincipal !== 0n || approvedCoupon !== 0n)) return invalid("reject must have zero approvals");
  if (report.decision === "approve" && (approvedPrincipal === 0n || approvedCoupon === 0n)) return invalid("approve must have positive approvals");
  if (report.expiresAt <= now + 600) return invalid("expiresAt too soon");
  if (report.expiresAt > maturity) return invalid("expiresAt after maturity");

  const canonicalReport = JSON.stringify(
    Object.fromEntries(
      Object.entries({
        schema: report.schema,
        decision: report.decision,
        approvedPrincipalWei: report.approvedPrincipalWei,
        approvedCouponWei: report.approvedCouponWei,
        expiresAt: report.expiresAt,
        riskScore: report.riskScore,
        conditions: report.conditions,
        reasoning: report.reasoning,
        model: report.model,
      }).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  );
  const reportHash = keccak256(toBytes(canonicalReport));

  await putReport(reportHash, canonicalReport);

  return Response.json({ reportHash, report: JSON.parse(canonicalReport) });
}