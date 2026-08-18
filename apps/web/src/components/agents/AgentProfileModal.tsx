"use client";

import { useEffect } from "react";
import { formatEther } from "viem";
import { ADDRESSES, AGENT_TYPE_NAMES } from "@/lib/civora";
import type { AgentPageDetail } from "@/lib/agents-page";
import { TxLink } from "@/components/TxLink";
import { AgentDrawer } from "./AgentDrawer";

/** Click-to-open agent profile: identity, reputation ledger, assignments, and earnings. */
export function AgentProfileModal({
  detail,
  createTx,
  onClose,
}: {
  detail: AgentPageDetail;
  createTx: `0x${string}`;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${detail.name} profile`}
    >
      <div
        className="my-4 w-full max-w-3xl border border-border-strong bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="font-grotesk text-lg font-semibold tracking-tight text-text-primary">{detail.name}</h2>
            <p className="mt-0.5 font-mono text-xs text-text-secondary">
              {AGENT_TYPE_NAMES[detail.agentType as 1 | 2 | 3]} · #{detail.agentId} · {formatEther(detail.balance)} BOT in wallet
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-border-strong font-mono text-sm text-text-secondary hover:border-accent hover:text-accent"
          >
            ×
          </button>
        </div>

        <AgentDrawer detail={detail} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 font-mono text-[11px] text-text-tertiary">
          <span>
            Create tx: <TxLink hash={createTx} />
          </span>
          <a
            href={`https://scan.botchain.ai/token/${ADDRESSES.identities}/instance/${detail.agentId}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-accent-hover"
          >
            Identity #{detail.agentId} on BOT Scan →
          </a>
        </div>
      </div>
    </div>
  );
}
