"use client";

import { formatEther } from "viem";
import type { AssetDetail } from "@/lib/assets-page";

function Stat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-l border-border pl-3">
      <span className="text-[10px] uppercase tracking-widest text-text-tertiary">{label}</span>
      <span className="font-mono text-sm font-medium text-text-primary">{value}</span>
      <span className="font-mono text-[10px] text-text-tertiary">{caption}</span>
    </div>
  );
}

export function EscrowSummary({ details }: { details: AssetDetail[] }) {
  let escrowed = 0n; // currently in flight (states 2-4)
  let escrowCount = 0;
  let settled = 0n; // principal of settled assets
  let settledCount = 0;
  let total = 0n;

  for (const d of details) {
    const c = d.chain;
    total += c.principalWei + c.couponWei;
    if (c.state === 2 || c.state === 3 || c.state === 4) {
      escrowed += c.principalWei + c.couponWei;
      escrowCount++;
    } else if (c.state === 5) {
      settled += c.principalWei;
      settledCount++;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-border bg-surface px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-text-tertiary">Escrow ledger</span>
      <Stat label="Ever escrowed" value={`${formatEther(total)} BOT`} caption={`${details.length} assets`} />
      <Stat label="In flight" value={`${formatEther(escrowed)} BOT`} caption={`${escrowCount} funded`} />
      <Stat label="Settled" value={`${formatEther(settled)} BOT`} caption={`${settledCount} assets`} />
    </div>
  );
}
