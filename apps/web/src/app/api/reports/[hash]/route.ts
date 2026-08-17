import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const { hash } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return Response.json({ error: "bad hash" }, { status: 400 });
  }
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "reports", `${hash}.json`), "utf8");
    return new Response(raw, {
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "report not found" }, { status: 404 });
  }
}