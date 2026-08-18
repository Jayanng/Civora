"use client";

import { useMemo } from "react";
import { formatEther, parseEther } from "viem";
import { useNow } from "@/components/dashboard/useNow";

const BPS = 10_000n;
const PROTOCOL = 300n;
const ROLE = 100n;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "maturity reached";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function SplitRow({ label, valueWei, totalWei, accent }: { label: string; valueWei: bigint; totalWei: bigint; accent?: boolean }) {
  const pct = totalWei > 0n ? Number((valueWei * 10_000n) / totalWei) / 100 : 0;
  return (
    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
      <span className={`flex-1 ${accent ? "text-accent" : "text-text-secondary"}`}>
        {label}
        <span className="ml-1.5 text-text-tertiary">{pct.toFixed(1)}%</span>
      </span>
      <span className="text-text-primary">{formatEther(valueWei)} BOT</span>
    </div>
  );
}

/** Mirrors SettlementAndPenaltyVault._payout: fees are taken only from the live coupon. */
export function IssuancePreview({
  principal,
  coupon,
  maturityTs,
  penaltyBps = 1000,
}: {
  principal: string;
  coupon: string;
  maturityTs: number;
  penaltyBps?: number;
}) {
  const now = useNow(1000);
  const model = useMemo(() => {
    let principalWei = 0n;
    let couponWei = 0n;
    try {
      principalWei = parseEther(principal || "0");
      couponWei = parseEther(coupon || "0");
    } catch {
      /* invalid input */
    }
    const haircut = (couponWei * BigInt(penaltyBps)) / BPS;
    const live = couponWei - haircut;
    const met = {
      protocol: (couponWei * PROTOCOL) / BPS,
      role: (couponWei * ROLE) / BPS,
      holder: couponWei - (couponWei * (PROTOCOL + 3n * ROLE)) / BPS,
    };
    const missed = {
      protocol: (live * PROTOCOL) / BPS,
      role: (live * ROLE) / BPS,
      holder: live - (live * (PROTOCOL + 3n * ROLE)) / BPS,
    };
    return { principalWei, couponWei, haircut, met, missed };
  }, [principal, coupon, penaltyBps]);

  const total = model.principalWei + model.couponWei;
  if (total === 0n) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
        <p className="text-[10px] uppercase tracking-widest text-text-tertiary">Settlement preview</p>
        <p className="font-mono text-[11px] text-text-tertiary">Enter principal and coupon to preview the payout split.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-bg p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-text-tertiary">Settlement preview</p>
        <span className="font-mono text-[11px] text-text-secondary">
          escrow {formatEther(total)} BOT · {formatCountdown(maturityTs * 1000 - now)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 border border-success/30 bg-success-bg/30 p-2.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-success">Target met</p>
          <SplitRow label="Holder" valueWei={model.principalWei + model.met.holder} totalWei={total} accent />
          <SplitRow label="Protocol" valueWei={model.met.protocol} totalWei={total} />
          <SplitRow label="Underwriter / Monitor / Settler" valueWei={model.met.role * 3n} totalWei={total} />
        </div>
        <div className="flex flex-col gap-1.5 border border-warning/30 bg-warning-bg/30 p-2.5">
          <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-warning">
            Target missed · {penaltyBps / 100}%
            <span className="text-text-tertiary">haircut {formatEther(model.haircut)} BOT</span>
          </p>
          <SplitRow label="Holder" valueWei={model.principalWei + model.missed.holder} totalWei={total} />
          <SplitRow label="Protocol" valueWei={model.missed.protocol + model.haircut} totalWei={total} />
          <SplitRow label="Underwriter / Monitor / Settler" valueWei={model.missed.role * 3n} totalWei={total} />
        </div>
      </div>
      <p className="font-mono text-[10px] text-text-tertiary">Fees come only from the live coupon — principal always returns 100% to the holder.</p>
    </div>
  );
}
