"use client";

import { formatEther } from "viem";
import { ADDRESSES, AGENT_TYPE_NAMES, ASSET_STATE_NAMES } from "@/lib/civora";
import type { AgentPageDetail } from "@/lib/agents-page";
import { truncateHash } from "@/components/TxLink";
import { Sparkline } from "./Sparkline";

function Chip({ label, tone }: { label: string; tone: "role" | "state" | "ok" | "warn" | "err" }) {
  const cls =
    tone === "role"
      ? "bg-accent-muted text-accent-strong"
      : tone === "state"
        ? "bg-surface text-text-secondary"
        : tone === "ok"
          ? "bg-success-bg text-success"
          : tone === "warn"
            ? "bg-warning-bg text-warning"
            : "bg-error-bg text-error";
  return <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${cls}`}>{label}</span>;
}

export function AgentDrawer({ detail }: { detail: AgentPageDetail }) {
  const ledgerSum = detail.reputationLedger.reduce((acc, e) => acc + e.delta, 0);
  const matchesChain = ledgerSum === Number(detail.score);
  const sortedAssignments = [...detail.assignments].sort((a, b) => a.assetId - b.assetId);

  return (
    <div className="grid grid-cols-1 gap-6 border-t border-border bg-bg p-4 lg:grid-cols-3">
      {/* Identity */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-widest text-text-secondary">Identity</h3>
        <div className="flex flex-col gap-1 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">owner</span>
            <a href={`https://scan.botchain.ai/address/${detail.owner}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
              {truncateHash(detail.owner)}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">wallet</span>
            <a href={`https://scan.botchain.ai/address/${detail.wallet}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
              {truncateHash(detail.wallet)}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">nft</span>
            <a href={`https://scan.botchain.ai/token/${ADDRESSES.identities}/instance/${detail.agentId}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
              #{detail.agentId} · {AGENT_TYPE_NAMES[detail.agentType as 1 | 2 | 3]}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">balance</span>
            <span className="text-text-primary">{formatEther(detail.balance)} BOT</span>
          </div>
        </div>
      </div>

      {/* Reputation breakdown */}
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-text-secondary">
          Reputation
          <Chip
            label={matchesChain ? "ledger = on-chain" : "ledger ≠ on-chain"}
            tone={matchesChain ? "ok" : "warn"}
          />
        </h3>
        {detail.reputationLedger.length === 0 ? (
          <p className="font-mono text-xs text-text-tertiary">No settled work yet — score starts at 0.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5 font-mono text-xs">
              {detail.reputationLedger.map((entry) => (
                <li key={`${entry.assetId}-${entry.reason}`} className="flex items-center justify-between gap-2">
                  <span className="text-text-primary">
                    {entry.reason} · asset #{entry.assetId}
                  </span>
                  <span className="text-success">+{entry.delta}</span>
                </li>
              ))}
            </ul>
            <p className="font-mono text-[11px] text-text-tertiary">
              sum {ledgerSum} · chain score {detail.score.toString()} — vault bumps UW +1, monitor +2, settlement +1 per settle.
            </p>
          </>
        )}
      </div>

      {/* Assignments + earnings */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-widest text-text-secondary">
          Assignments · {formatEther(detail.earnedWei)} BOT earned
        </h3>
        {sortedAssignments.length === 0 ? (
          <p className="font-mono text-xs text-text-tertiary">Not assigned to any asset yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 font-mono text-xs">
            {sortedAssignments.map((a) => (
              <li key={`${a.assetId}-${a.role}`} className="flex flex-wrap items-center gap-1.5">
                <Chip label={a.role} tone="role" />
                <span className="text-text-primary">asset #{a.assetId}</span>
                <Chip label={ASSET_STATE_NAMES[a.state as keyof typeof ASSET_STATE_NAMES] ?? `state ${a.state}`} tone="state" />
                <span className="text-text-tertiary">{formatEther(a.principalWei + a.couponWei)} BOT escrow</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-widest text-text-secondary">Fee per settlement</span>
          <Sparkline pointsWei={detail.settledFees.map((f) => f.feeWei)} />
        </div>
      </div>
    </div>
  );
}
