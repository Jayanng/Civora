import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { keccak256, toBytes } from "viem";

const SYSTEM_PROMPT = [
  "You are the Civora Underwriter Agent on BOT Chain.",
  "Return only JSON matching the schema.",
  "You do not move funds. You decide whether this invoice may settle, and the maximum BOT that may move.",
  "`approvedAmountWei` must be <= `amountWei`.",
  "Reject if counterparty is zero address, amount is 0, due date is in the past, or documentHash is zero.",
  "Be conservative. If data is thin, approve a lower cap or reject.",
  "`reasoning` is short, factual, no marketing.",
  "",
  "Response schema:",
  JSON.stringify({
    schema: "civora.underwrite.v1",
    decision: '"approve" | "reject"',
    approvedAmountWei: 'string wei, "0" if reject, > 0 if approve',
    expiresAt: "unix seconds, > now+10min and <= invoice dueDate",
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
  const { key, model, baseUrl } = loadGmiConfig();
  if (!key) {
    return Response.json({ error: "underwriter unavailable" }, { status: 503 });
  }

  let body: {
    invoiceId?: string;
    amountWei?: string;
    dueDate?: number;
    counterparty?: string;
    documentHash?: string;
    payer?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const { invoiceId, amountWei, dueDate, counterparty, documentHash, payer } = body;
  if (!invoiceId || !amountWei || typeof dueDate !== "number" || !counterparty || !documentHash || !payer) {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const userContent = JSON.stringify({
    invoiceId,
    amountWei,
    dueDate,
    counterparty,
    documentHash,
    payer,
    model,
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
    approvedAmountWei?: unknown;
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
  if (typeof report.approvedAmountWei !== "string" || !/^\d+$/.test(report.approvedAmountWei)) {
    return invalid("bad approvedAmountWei");
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

  const amount = BigInt(amountWei);
  const approved = BigInt(report.approvedAmountWei);
  if (approved > amount) return invalid("approvedAmountWei > amountWei");
  if (report.decision === "reject" && approved !== 0n) return invalid("reject must have zero approval");
  if (report.decision === "approve" && approved === 0n) return invalid("approve must have positive approval");
  if (report.expiresAt <= now + 600) return invalid("expiresAt too soon");
  if (report.expiresAt > dueDate) return invalid("expiresAt after dueDate");

  const canonicalReport = JSON.stringify(
    Object.fromEntries(
      Object.entries({
        schema: report.schema,
        decision: report.decision,
        approvedAmountWei: report.approvedAmountWei,
        expiresAt: report.expiresAt,
        riskScore: report.riskScore,
        conditions: report.conditions,
        reasoning: report.reasoning,
        model: report.model,
      }).sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
  );
  const reportHash = keccak256(toBytes(canonicalReport));

  const dir = path.join(process.cwd(), "data", "reports");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${reportHash}.json`), canonicalReport, "utf8");

  return Response.json({ reportHash, report: JSON.parse(canonicalReport) });
}