import { formatEther } from "viem";
import { AGENT_TYPE_NAMES } from "@/lib/civora";
import type { DashboardData } from "@/lib/dashboard";

/** Per-agent economics: role, wallet, reputation, and the balance their wallet has earned from payouts. */
export function AgentLedger({ data }: { data: DashboardData }) {
  const details = [...data.agentDetails.values()].sort((a, b) => a.agentId - b.agentId);
  if (details.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="font-grotesk text-sm font-medium">Agent payouts</p>
        <p className="mt-2 font-mono text-xs text-text-tertiary">No indexed agents for this wallet yet.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h2 className="font-grotesk text-sm font-medium">Agent payouts</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {details.map((agent) => (
          <div key={agent.agentId} className="flex flex-col gap-1 rounded-sm border border-border bg-bg p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-grotesk text-xs font-medium text-text-primary">{agent.name}</p>
              <span className="rounded-sm bg-accent-muted/60 px-1.5 py-0.5 font-mono text-[9px] text-accent">
                {AGENT_TYPE_NAMES[agent.agentType as 1 | 2 | 3]}
              </span>
            </div>
            <p className="font-mono text-[10px] text-text-tertiary">#{agent.agentId} · wallet {agent.wallet.slice(0, 6)}…{agent.wallet.slice(-4)}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">Earned (wallet)</p>
                <p className="font-mono text-sm font-medium text-text-primary">{formatEther(agent.balance)} BOT</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">Reputation</p>
                <p className="font-mono text-sm font-medium text-text-primary">{agent.score.toString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] text-text-tertiary">Agent fees are paid to the agent&apos;s own wallet at settle — 1% each of the live coupon for underwriter, monitor, and settlement.</p>
    </div>
  );
}

/** Tiny line chart of protocol fee earned per settled asset (3% of the live coupon, computed on-chain). */
export function FeeSparkline({ data }: { data: DashboardData }) {
  const points: { x: number; y: number }[] = [];
  for (const asset of data.assets) {
    if (asset.state !== 5) continue;
    const mon = data.monitors.get(asset.assetId);
    const haircut = mon && mon.outcome === 2 ? (asset.couponWei * BigInt(mon.penaltyBps)) / 10_000n : 0n;
    const liveCoupon = asset.couponWei - haircut;
    points.push({ x: asset.assetId, y: Number((liveCoupon * 300n) / 10_000n) / 1e18 });
  }
  if (points.length < 2) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
        <h2 className="font-grotesk text-sm font-medium">Protocol fee trend</h2>
        <p className="font-mono text-xs text-text-tertiary">{points.length === 1 ? "One settlement so far — settle more to see a trend." : "No settled assets yet."}</p>
      </div>
    );
  }
  const max = Math.max(...points.map((p) => p.y), 0.0001);
  const w = 240;
  const h = 48;
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? 0 : (i / (points.length - 1)) * w;
    const y = h - (p.y / max) * (h - 6) - 3;
    return `${x},${y}`;
  });
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-grotesk text-sm font-medium">Protocol fee trend</h2>
        <span className="font-mono text-[10px] text-text-tertiary">3% of live coupon, per settlement</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full max-w-[280px]" aria-hidden="true">
        <polyline points={coords.join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
        {coords.map((c, i) => {
          const [x, y] = c.split(",").map(Number);
          return <circle key={i} cx={x} cy={y} r="2" fill="var(--color-accent)" />;
        })}
      </svg>
      <p className="font-mono text-[10px] text-text-tertiary">
        {points.map((p) => `#${p.x} ${p.y.toFixed(4)} BOT`).join(" · ")}
      </p>
    </div>
  );
}

/** Total haircut to treasury across missed targets, with per-asset detail. */
export function HaircutTracker({ data }: { data: DashboardData }) {
  const missed = data.assets
    .filter((a) => a.state === 5 && data.monitors.get(a.assetId)?.outcome === 2)
    .map((a) => ({ asset: a, mon: data.monitors.get(a.assetId)! }));
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-grotesk text-sm font-medium">Haircut tracker</h2>
        <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${data.missedCount > 0 ? "bg-warning-bg text-warning" : "bg-success-bg text-success"}`}>
          {data.missedCount} missed
        </span>
      </div>
      <p className="font-mono text-2xl font-medium text-text-primary">{formatEther(data.haircutValueWei)} BOT</p>
      <p className="font-mono text-[10px] text-text-tertiary">haircut to treasury so far — penalties only ever touch the coupon, never principal.</p>
      {missed.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          {missed.map(({ asset, mon }) => (
            <p key={asset.assetId} className="font-mono text-[10px] text-text-secondary">
              #{asset.assetId} · {mon.penaltyBps} bps · {formatEther((asset.couponWei * BigInt(mon.penaltyBps)) / 10_000n)} BOT
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
