import { getReport } from "@/lib/report-store";

export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const { hash } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return Response.json({ error: "bad hash" }, { status: 400 });
  }
  const raw = await getReport(hash);
  if (!raw) {
    return Response.json({ error: "report not found" }, { status: 404 });
  }
  return new Response(raw, {
    headers: { "content-type": "application/json" },
  });
}