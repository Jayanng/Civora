"use client";

import { formatEther } from "viem";
import { DECISION } from "@/lib/civora";
import type { AssetDetail } from "@/lib/assets-page";
import { useNow } from "@/components/dashboard/useNow";

export function RefundCard({
  detail,
  refunding,
  onRefund,
}: {
  detail: AssetDetail;
  refunding: boolean;
  onRefund: () => void;
}) {
  const now = useNow(5000);
  const c = detail.chain;
  const nowSec = BigInt(Math.floor(now / 1000));
  const total = c.principalWei + c.couponWei;

  let allowed = false;
  let reason: string;
  let wait: string | null = null;

  if (c.state === 2) {
    if (detail.underwrite) {
      if (detail.underwrite.decision === DECISION.Reject) {
        allowed = true;
        reason = "Underwriter rejected the asset — escrow can be returned.";
      } else if (nowSec >= detail.underwrite.expiresAt) {
        allowed = true;
        reason = "Underwrite credential has expired — escrow can be returned.";
      } else {
        allowed = false;
        reason = "Underwrite approved and still valid — settlement path is open.";
        wait = `${Math.ceil(Number(detail.underwrite.expiresAt - nowSec) / 60)} min until the credential expires`;
      }
    } else if (nowSec > c.maturity) {
      allowed = true;
      reason = "Maturity passed without an underwrite — escrow can be returned.";
    } else {
      allowed = false;
      reason = "Awaiting the AI underwrite — refund opens if it rejects or expires.";
    }
  } else if (c.state === 3) {
    if (detail.underwrite && nowSec >= detail.underwrite.expiresAt) {
      allowed = true;
      reason = "Underwrite credential has expired — escrow can be returned.";
    } else {
      allowed = false;
      reason = "Underwritten and the credential is still valid — monitor next.";
      if (detail.underwrite) wait = `${Math.ceil(Number(detail.underwrite.expiresAt - nowSec) / 60)} min until the credential expires`;
    }
  } else if (c.state === 4) {
    allowed = false;
    reason = "Monitored — the only path out of the vault is settlement.";
  } else {
    allowed = false;
    reason = c.state === 5 ? "Already settled — nothing to refund." : "Not escrowed.";
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-bg p-3">
      <p className="text-[10px] uppercase tracking-widest text-text-tertiary">Refund path</p>
      <p className="font-mono text-[11px] text-text-secondary">{reason}</p>
      {wait ? <p className="font-mono text-[10px] text-text-tertiary">{wait}</p> : null}
      {allowed ? (
        <button
          type="button"
          onClick={onRefund}
          disabled={refunding}
          className="h-8 self-start border border-warning px-3 font-grotesk text-xs text-warning hover:bg-warning hover:text-text-on-accent disabled:opacity-60"
        >
          {refunding ? "Returning escrow…" : `Refund ${formatEther(total)} BOT`}
        </button>
      ) : (
        <span className="self-start rounded-sm bg-surface px-2 py-1 font-mono text-[10px] text-text-tertiary">
          {formatEther(total)} BOT escrowed
        </span>
      )}
    </div>
  );
}
