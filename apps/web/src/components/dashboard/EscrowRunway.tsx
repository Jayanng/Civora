import { formatEther } from "viem";
import type { DashboardData } from "@/lib/dashboard";

/** Gauge-style: escrow in flight vs total ever escrowed, plus a maturity hint for the nearest asset. */
export function EscrowRunway({ data }: { data: DashboardData }) {
  const totalEscrowed = data.assets.reduce((sum, a) => sum + a.principalWei + a.couponWei, 0n);
  const pct = totalEscrowed > 0n ? Number((data.escrowValueWei * 10000n) / totalEscrowed) / 100 : 0;
  const live = data.assets.filter((a) => a.state === 2 || a.state === 3 || a.state === 4);
  const nearest = live.length > 0 ? live.reduce((min, a) => (a.maturity < min.maturity ? a : min)) : null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-grotesk text-sm font-medium">Escrow runway</h2>
        <span className="rounded-sm bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
          {data.escrowCount} live
        </span>
      </div>
      <div>
        <div className="flex h-3 w-full overflow-hidden rounded-sm border border-border bg-bg">
          <div className="bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="mt-1 font-mono text-[11px] text-text-secondary">
          {formatEther(data.escrowValueWei)} BOT in the vault of {formatEther(totalEscrowed)} BOT ever escrowed
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-sm border border-border bg-bg px-3 py-2">
        <p className="font-mono text-[11px] text-text-secondary">Nearest maturity</p>
        {nearest ? (
          <p className="font-mono text-xs text-text-primary">
            #{nearest.assetId} · {new Date(Number(nearest.maturity) * 1000).toLocaleDateString()}
          </p>
        ) : (
          <p className="font-mono text-xs text-text-tertiary">none live</p>
        )}
      </div>
    </div>
  );
}

/** Connected wallet balance vs vault escrow, side by side. */
export function WalletSummary({ data, walletBalance, address }: { data: DashboardData; walletBalance: bigint | null; address?: string }) {
  const cell = (label: string, value: string, sub: string) => (
    <div className="flex-1 rounded-sm border border-border bg-bg p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">{label}</p>
      <p className="mt-1 font-mono text-lg font-medium text-text-primary">{value}</p>
      <p className="font-mono text-[10px] text-text-tertiary">{sub}</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h2 className="font-grotesk text-sm font-medium">Your wallet vs the vault</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        {cell(
          "Your wallet",
          walletBalance === null ? "…" : `${formatEther(walletBalance)} BOT`,
          address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "controller",
        )}
        {cell("Vault escrow", `${formatEther(data.escrowValueWei)} BOT`, `${data.escrowCount} assets held`)}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-text-tertiary">
        Escrow sits in the vault contract, not in any wallet. Only the settlement agent&apos;s granted permission can move it.
      </p>
    </div>
  );
}
