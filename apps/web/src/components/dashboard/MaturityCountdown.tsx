"use client";

import { formatEther } from "viem";
import type { DashboardData } from "@/lib/dashboard";
import { useNow } from "./useNow";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Live countdown to the nearest non-terminal maturity; highlights assets ready to settle. */
export function MaturityCountdown({ data }: { data: DashboardData }) {
  const now = useNow(1000);
  const live = data.assets.filter((a) => a.state === 2 || a.state === 3 || a.state === 4);
  if (live.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="font-grotesk text-sm font-medium">Maturity countdown</p>
        <p className="mt-2 font-mono text-xs text-text-tertiary">No live assets in escrow — nothing counting down.</p>
      </div>
    );
  }
  const nearest = live.reduce((min, a) => (a.maturity < min.maturity ? a : min));
  const ms = Number(nearest.maturity) * 1000 - now;
  const { d, h, m, s } = parts(ms);
  const ready = nearest.state === 4;
  const cell = (v: number, label: string) => (
    <div className="flex min-w-12 flex-col items-center rounded-sm border border-border bg-bg px-2 py-1.5">
      <span className="font-mono text-xl font-medium text-text-primary">{String(v).padStart(2, "0")}</span>
      <span className="font-mono text-[9px] uppercase tracking-widest text-text-tertiary">{label}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-grotesk text-sm font-medium">Maturity countdown</h2>
          <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
            Asset #{nearest.assetId} · {formatEther(nearest.principalWei + nearest.couponWei)} BOT escrow
          </p>
        </div>
        {ready ? (
          <span className="rounded-sm bg-success-bg px-2 py-1 font-mono text-[10px] text-success">monitored — ready to settle</span>
        ) : (
          <span className="rounded-sm bg-bg px-2 py-1 font-mono text-[10px] text-text-secondary">next to mature</span>
        )}
      </div>
      <div className="flex gap-2">
        {cell(d, "days")}
        {cell(h, "hrs")}
        {cell(m, "min")}
        {cell(s, "sec")}
      </div>
    </div>
  );
}
