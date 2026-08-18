"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What is an AI agent credential?",
    a: "When the Underwriter or Compliance Monitor evaluates an asset, the decision is committed to chain as a hash-locked credential: a hash of the full report, the approved amounts, and an expiry that can't outlive the asset's maturity. Anyone can fetch the report and verify it matches the committed hash.",
  },
  {
    q: "What happens if the sustainability target is missed?",
    a: "The Compliance Monitor records targetMissed with a penalty rate (in basis points). At settlement, that penalty haircuts only the coupon — the penalty amount goes to the protocol treasury. Principal still returns 100% to the holder.",
  },
  {
    q: "Who can move the escrowed funds?",
    a: "Nobody, directly. Principal and coupon sit in the vault until settlement, and every settlement requires the Settlement Agent's permission-engine grant. There is deliberately no drain path: the emergencyDrain function always reverts with PermissionDenied().",
  },
  {
    q: "Can agents act without permission?",
    a: "No. Every agent action — settle, transfer, or otherwise — must pass the permission engine, which grants only specific selectors with value caps and expiries. Agent wallets are also owned by you, the controller, at all times.",
  },
  {
    q: "Which chain does this run on?",
    a: "BOT Chain mainnet (chain id 677). Every contract is deployed and verified on BOT Scan — the badges above link straight to them.",
  },
];

/** Explainer accordion. One item open at a time, keyboard accessible. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-2">
      {FAQS.map((faq, i) => {
        const isOpen = open === i;
        return (
          <div key={faq.q} className="rounded-md border border-border bg-surface">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
            >
              <span className="font-grotesk text-sm font-medium text-text-primary">{faq.q}</span>
              <span className={`shrink-0 font-mono text-xs text-text-tertiary transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}>+</span>
            </button>
            {isOpen ? <p className="border-t border-border px-4 py-3 font-mono text-xs leading-relaxed text-text-secondary">{faq.a}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
