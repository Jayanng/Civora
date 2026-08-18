"use client";

import { formatEther } from "viem";
import { MONITOR_OUTCOME } from "@/lib/civora";
import type { AssetDetail } from "@/lib/assets-page";

export function VerdictStrip({ detail }: { detail: AssetDetail }) {
  if (detail.chain.state !== 5) return null;
  const c = detail.chain;
  const mon = detail.monitor;
  const targetMet = !mon || mon.outcome === MONITOR_OUTCOME.TargetMet;
  const haircut = mon && !targetMet ? (c.couponWei * BigInt(mon.penaltyBps)) / 10_000n : 0n;
  const liveCoupon = c.couponWei - haircut;

  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-bg p-3">
      <p className="text-[10px] uppercase tracking-widest text-text-tertiary">Verdict</p>
      <div className="flex items-center justify-between gap-2 font-mono text-xs">
        <span className="text-text-secondary">target</span>
        <span className={targetMet ? "text-success" : "text-error"}>
          {targetMet ? "met — full coupon to holder path" : `missed — ${(mon?.penaltyBps ?? 0) / 100}% penalty`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="text-text-tertiary">haircut to treasury</span>
        <span className={haircut > 0n ? "text-warning" : "text-text-primary"}>{formatEther(haircut)} BOT</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px]">
        <span className="text-text-tertiary">holder principal</span>
        <span className="text-right text-text-primary">{formatEther(c.principalWei)} BOT</span>
        <span className="text-text-tertiary">holder coupon</span>
        <span className="text-right text-text-primary">{formatEther(liveCoupon - (liveCoupon * 600n) / 10_000n)} BOT</span>
        <span className="text-text-tertiary">protocol + agents (6%)</span>
        <span className="text-right text-text-primary">{formatEther((liveCoupon * 600n) / 10_000n)} BOT</span>
      </div>
    </div>
  );
}
