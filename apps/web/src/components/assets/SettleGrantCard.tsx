"use client";

import { formatEther } from "viem";
import type { AssetDetail } from "@/lib/assets-page";
import { useNow } from "@/components/dashboard/useNow";

export function SettleGrantCard({ detail }: { detail: AssetDetail }) {
  const now = useNow(5000);
  const g = detail.grant;

  if (!g) {
    return (
      <div className="flex flex-col gap-1 rounded-sm border border-border bg-bg p-3">
        <p className="text-[10px] uppercase tracking-widest text-text-tertiary">Settle grant</p>
        <p className="font-mono text-[11px] text-text-tertiary">No grant yet — one is created for the settlement agent when the asset is underwritten.</p>
      </div>
    );
  }

  const expired = g.expiresAt <= BigInt(now);
  const status = g.revoked ? "revoked" : expired ? "expired" : "active";
  const tone = g.revoked || expired ? "text-error" : "text-success";

  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-bg p-3">
      <p className="flex items-center justify-between text-[10px] uppercase tracking-widest text-text-tertiary">
        Settle grant #{g.grantId.toString()}
        <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] normal-case ${g.revoked || expired ? "bg-error-bg text-error" : "bg-success-bg text-success"}`}>{status}</span>
      </p>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-text-tertiary">agent</span>
        <span className="text-text-primary">#{g.agentId.toString()} · settlement</span>
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-text-tertiary">selector</span>
        <span className={`font-mono text-[11px] ${tone}`}>settle()</span>
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-text-tertiary">max value</span>
        <span className="text-text-primary">{formatEther(g.maxValue)} BOT</span>
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-text-tertiary">expires</span>
        <span className="text-text-primary">{new Date(Number(g.expiresAt) * 1000).toLocaleString()}</span>
      </div>
    </div>
  );
}
