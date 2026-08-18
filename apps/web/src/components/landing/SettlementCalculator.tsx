"use client";

import { useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";

const BPS_DENOM = 10_000n;

function tryParseEther(s: string): bigint {
  try {
    return parseEther(s || "0");
  } catch {
    return 0n;
  }
}

/** Interactive: pick principal/coupon, choose target met vs missed, see the exact on-chain split. */
export function SettlementCalculator() {
  const [principal, setPrincipal] = useState("0.04");
  const [coupon, setCoupon] = useState("0.01");
  const [met, setMet] = useState(true);
  const [penaltyBps, setPenaltyBps] = useState(1000);

  const split = useMemo(() => {
    const principalWei = tryParseEther(principal);
    const couponWei = tryParseEther(coupon);
    const haircut = met ? 0n : (couponWei * BigInt(penaltyBps)) / BPS_DENOM;
    const liveCoupon = couponWei - haircut;
    const protocol = (liveCoupon * 300n) / BPS_DENOM;
    const uw = (liveCoupon * 100n) / BPS_DENOM;
    const mon = (liveCoupon * 100n) / BPS_DENOM;
    const sa = (liveCoupon * 100n) / BPS_DENOM;
    const holder = liveCoupon - protocol - uw - mon - sa;
    return { principalWei, couponWei, haircut, protocol, uw, mon, sa, holder };
  }, [principal, coupon, met, penaltyBps]);

  const bar = [
    { label: "Holder", pct: 94, color: "bg-accent", value: split.holder },
    { label: "Protocol", pct: 3, color: "bg-accent-strong", value: split.protocol },
    { label: "Underwriter", pct: 1, color: "bg-secondary", value: split.uw },
    { label: "Monitor", pct: 1, color: "bg-secondary-muted", value: split.mon },
    { label: "Settlement", pct: 1, color: "bg-accent-muted", value: split.sa },
  ];

  const rows = [...bar, ...(split.haircut > 0n ? [{ label: "Haircut → Treasury", pct: 0, color: "bg-error", value: split.haircut }] : [])];

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
      <div>
        <p className="font-grotesk text-sm font-medium">Settlement calculator</p>
        <p className="mt-1 font-mono text-[11px] text-text-tertiary">Set the terms, pick the outcome — the split is computed exactly as the vault does.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Principal (BOT)
          <input value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" className="h-9 border border-border-strong bg-bg px-3 font-mono text-sm text-text-primary" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Coupon (BOT)
          <input value={coupon} onChange={(e) => setCoupon(e.target.value)} inputMode="decimal" className="h-9 border border-border-strong bg-bg px-3 font-mono text-sm text-text-primary" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Outcome
          <select value={met ? "met" : "missed"} onChange={(e) => setMet(e.target.value === "met")} className="h-9 border border-border-strong bg-bg px-3 font-mono text-sm text-text-primary">
            <option value="met">Target met</option>
            <option value="missed">Target missed</option>
          </select>
        </label>
      </div>

      {!met ? (
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Penalty ({penaltyBps} bps = {penaltyBps / 100}% of coupon)
          <input type="range" min={100} max={10000} step={100} value={penaltyBps} onChange={(e) => setPenaltyBps(Number(e.target.value))} className="accent-accent" />
        </label>
      ) : null}

      <div>
        <div className="flex h-4 w-full overflow-hidden rounded-sm border border-border bg-bg">
          {bar.map((seg) => (
            <div key={seg.label} className={`h-full ${seg.color}`} style={{ width: `${seg.pct}%` }} title={`${seg.label} ${seg.pct}%`} />
          ))}
        </div>
        <p className="mt-1 font-mono text-[10px] text-text-tertiary">
          {met ? "Coupon split on target met (94 / 3 / 1 / 1 / 1)" : `Coupon after ${penaltyBps} bps haircut to treasury`}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-4 border-b border-border pb-1">
          <dt className="text-text-secondary">Principal → Holder (100%)</dt>
          <dd className="text-text-primary">{formatEther(split.principalWei)} BOT</dd>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 border-b border-border pb-1">
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="text-text-primary">{formatEther(row.value)} BOT</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
