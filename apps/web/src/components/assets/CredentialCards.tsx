"use client";

import { formatEther } from "viem";
import { DECISION, MONITOR_OUTCOME } from "@/lib/civora";
import type { AssetDetail } from "@/lib/assets-page";
import { truncateHash } from "@/components/TxLink";
import { useNow } from "@/components/dashboard/useNow";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-right text-text-primary">{value}</span>
    </div>
  );
}

function Card({ title, tone, children }: { title: string; tone: "uw" | "mon"; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 rounded-sm border p-3 ${tone === "uw" ? "border-accent/30 bg-accent-muted/20" : "border-border bg-bg"}`}>
      <p className={`text-[10px] uppercase tracking-widest ${tone === "uw" ? "text-accent" : "text-text-secondary"}`}>{title}</p>
      {children}
    </div>
  );
}

export function CredentialCards({ detail }: { detail: AssetDetail }) {
  const now = useNow(5000);
  const { underwrite, monitor } = detail;

  if (!underwrite && !monitor) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {underwrite ? (
        <Card title={`Underwrite credential · agent #${underwrite.agentId}`} tone="uw">
          <Row label="decision" value={underwrite.decision === DECISION.Approve ? "Approve" : "Reject"} />
          <Row label="approved" value={`${formatEther(underwrite.approvedPrincipalWei)} + ${formatEther(underwrite.approvedCouponWei)} BOT`} />
          <Row label="expires" value={`${new Date(Number(underwrite.expiresAt) * 1000).toLocaleString()}${underwrite.expiresAt <= BigInt(now) ? " · expired" : ""}`} />
          <Row label="model" value={truncateHash(underwrite.modelId, 6, 4)} />
          <Row label="report" value={<a href={`/api/reports/${underwrite.reportHash}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">{truncateHash(underwrite.reportHash, 8, 6)}</a>} />
        </Card>
      ) : null}
      {monitor ? (
        <Card title={`Monitor credential · agent #${monitor.agentId}`} tone="mon">
          <Row label="outcome" value={monitor.outcome === MONITOR_OUTCOME.TargetMet ? "Target met" : "Target missed"} />
          <Row label="penalty" value={`${monitor.penaltyBps / 100}%${monitor.penaltyBps > 0 ? ` · ${formatEther((detail.chain.couponWei * BigInt(monitor.penaltyBps)) / 10_000n)} BOT haircut` : ""}`} />
          <Row label="observed" value={new Date(Number(monitor.observedAt) * 1000).toLocaleString()} />
          <Row label="expires" value={`${new Date(Number(monitor.expiresAt) * 1000).toLocaleString()}${monitor.expiresAt <= BigInt(now) ? " · expired" : ""}`} />
          <Row label="evidence" value={truncateHash(monitor.evidenceHash, 8, 6)} />
          <Row label="report" value={<a href={`/api/reports/${monitor.reportHash}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">{truncateHash(monitor.reportHash, 8, 6)}</a>} />
        </Card>
      ) : null}
    </div>
  );
}
