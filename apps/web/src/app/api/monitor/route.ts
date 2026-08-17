import { readFileSync } from "node:fs";
import { keccak256, toBytes } from "viem";
import { putReport } from "@/lib/report-store";

const SYSTEM_PROMPT = [
  "You are the Civora Compliance Monitor Agent for sustainability-linked assets on BOT Chain.",
  "Return only JSON matching the schema.",
  "You evaluate whether the sustainability target was met or missed based on the evidence provided.",
  "`targetMet` means penaltyBps must be 0.",
  "`targetMissed` means penaltyBps must be between 1 and 10000.",
  "`evidenceHash` identifies the evidence payload; it must be non-zero.",
  "`reasoning` is short, factual, no marketing.",
  "",
  "Response schema:",
  JSON.stringify({
    schema: "civora.monitor.v1",
    outcome: '"targetMet" | "targetMissed"',
    penaltyBps: "0 if targetMet, 1-10000 if targetMissed",
    evidenceHash: "0x-prefixed hex string, non-zero",
    observedAt: "unix seconds of the observation",
    expiresAt: "unix seconds, > now+10min and <= asset maturity",
    riskScore: "integer 0-100",
    findings: "string[], max 5",
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
    const raw = readFileSync(new URL("../../../../.env", import.meta.url), "utf8");
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
  const { key, model, baseUrl } = loadGmiConfig();
  if (!key) {
    return Response.json({ error: "monitor unavailable" }, { status: 503 });
  }

  let body: {
    assetId?: string;
    principalWei?: string;
    couponWei?: string;
    targetHash?: string;
    documentHash?: string;
    evidenceHash?: string;
    maturity?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const { assetId, principalWei, couponWei, targetHash, documentHash, evidenceHash, maturity } = body;
  if (!assetId || !principalWei || !couponWei || !targetHash || !documentHash || !evidenceHash || typeof maturity !== "number") {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const userContent = JSON.stringify({
    assetId, principalWei, couponWei, targetHash, documentHash, evidenceHash, maturity, model,
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
    outcome?: unknown;
    penaltyBps?: unknown;
    evidenceHash?: unknown;
    observedAt?: unknown;
    expiresAt?: unknown;
    riskScore?: unknown;
    findings?: unknown;
    reasoning?: unknown;
    model?: unknown;
  };

  const invalid = (reason: string) => Response.json({ error: reason }, { status: 422 });

  if (report.schema !== "civora.monitor.v1") return invalid("schema mismatch");
  if (report.model !== model) return invalid("model mismatch");
  if (report.outcome !== "targetMet" && report.outcome !== "targetMissed") return invalid("bad outcome");
  if (typeof report.penaltyBps !== "number" || !Number.isInteger(report.penaltyBps)) return invalid("bad penaltyBps");
  if (report.outcome === "targetMet" && report.penaltyBps !== 0) return invalid("targetMet must have zero penalty");
  if (report.outcome === "targetMissed" && (report.penaltyBps < 1 || report.penaltyBps > 10000)) return invalid("targetMissed penalty must be 1-10000");
  if (typeof report.evidenceHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(report.evidenceHash)) return invalid("bad evidenceHash");
  if (typeof report.observedAt !== "number" || !Number.isInteger(report.observedAt)) return invalid("bad observedAt");
  if (report.observedAt > now) return invalid("observedAt in the future");
  if (typeof report.expiresAt !== "number" || !Number.isInteger(report.expiresAt)) return invalid("bad expiresAt");
  if (report.expiresAt <= now + 600) return invalid("expiresAt too soon");
  if (report.expiresAt > maturity) return invalid("expiresAt after maturity");
  if (typeof report.riskScore !== "number" || !Number.isInteger(report.riskScore) || report.riskScore < 0 || report.riskScore > 100) {
    return invalid("bad riskScore");
  }
  if (!Array.isArray(report.findings) || report.findings.length > 5 || report.findings.some((f) => typeof f !== "string")) {
    return invalid("bad findings");
  }
  if (typeof report.reasoning !== "string" || report.reasoning.length > 500) return invalid("bad reasoning");

  const canonicalReport = JSON.stringify(
    Object.fromEntries(
      Object.entries({
        schema: report.schema,
        outcome: report.outcome,
        penaltyBps: report.penaltyBps,
        evidenceHash: report.evidenceHash,
        observedAt: report.observedAt,
        expiresAt: report.expiresAt,
        riskScore: report.riskScore,
        findings: report.findings,
        reasoning: report.reasoning,
        model: report.model,
      }).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  );
  const reportHash = keccak256(toBytes(canonicalReport));

  await putReport(reportHash, canonicalReport);

  return Response.json({ reportHash, report: JSON.parse(canonicalReport) });
}