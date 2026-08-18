"use client";

import { useEffect } from "react";
import { TxLink } from "@/components/TxLink";

export interface TxSuccessInfo {
  title: string;
  note: string;
  nextStep?: string;
  rows: { label: string; value: string }[];
  txHashes: { label: string; hash: `0x${string}` }[];
}

/** Confirmation modal shown after a transaction lands: what happened, verified hashes, and what's next. */
export function TxSuccessModal({ info, onClose }: { info: TxSuccessInfo; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={info.title}
    >
      <div
        className="w-full max-w-md border border-border-strong bg-bg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-bg font-mono text-sm text-success">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-grotesk text-base font-semibold tracking-tight text-text-primary">{info.title}</h2>
            <p className="mt-1 font-mono text-xs text-text-secondary">{info.note}</p>
          </div>
        </div>

        <dl className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
          {info.rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 font-mono text-xs">
              <dt className="text-text-tertiary">{row.label}</dt>
              <dd className="text-right text-text-primary">{row.value}</dd>
            </div>
          ))}
          {info.txHashes.length > 0 ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
              {info.txHashes.map((tx) => (
                <div key={tx.hash} className="flex items-center justify-between gap-3 font-mono text-xs">
                  <dt className="text-text-tertiary">{tx.label} tx</dt>
                  <dd>
                    <TxLink hash={tx.hash} />
                  </dd>
                </div>
              ))}
            </div>
          ) : null}
        </dl>

        {info.nextStep ? (
          <p className="mt-4 border-l-2 border-accent bg-accent-muted/40 px-3 py-2 font-mono text-xs text-accent-strong">
            {info.nextStep}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
