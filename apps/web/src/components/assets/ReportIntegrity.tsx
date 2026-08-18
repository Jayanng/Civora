"use client";

import { useEffect, useState } from "react";
import { keccak256, toBytes } from "viem";
import type { AssetDetail } from "@/lib/assets-page";
import { truncateHash } from "@/components/TxLink";

type Status = "checking" | "match" | "mismatch" | "missing";

interface Entry {
  label: string;
  hash: `0x${string}`;
}

export function ReportIntegrity({ detail }: { detail: AssetDetail }) {
  const entries: Entry[] = [];
  if (detail.underwrite) entries.push({ label: "underwrite", hash: detail.underwrite.reportHash });
  if (detail.monitor) entries.push({ label: "monitor", hash: detail.monitor.reportHash });

  const [results, setResults] = useState<Record<string, Status>>({});
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (entries.length === 0) return;
    let active = true;
    const run = async () => {
      const next: Record<string, Status> = {};
      await Promise.all(
        entries.map(async ({ hash }) => {
          next[hash] = "checking";
          try {
            const res = await fetch(`/api/reports/${hash}`);
            if (!res.ok) {
              next[hash] = "missing";
              return;
            }
            const raw = await res.text();
            next[hash] = keccak256(toBytes(raw)) === hash ? "match" : "mismatch";
          } catch {
            next[hash] = "missing";
          }
        }),
      );
      if (active) setResults(next);
    };
    void run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => e.hash).join(","), nonce]);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-border bg-bg p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-text-tertiary">Report integrity</p>
        <button type="button" onClick={() => setNonce((n) => n + 1)} className="font-mono text-[10px] text-accent hover:text-accent-hover">
          verify again
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {entries.map((e) => {
          const s = results[e.hash];
          return (
            <li key={`${e.label}-${e.hash}`} className="flex items-center justify-between gap-2 font-mono text-[11px]">
              <span className="text-text-secondary">
                {e.label} <span className="text-text-tertiary">{truncateHash(e.hash, 6, 4)}</span>
              </span>
              {!s ? (
                <span className="text-text-tertiary">…</span>
              ) : s === "checking" ? (
                <span className="animate-pulse text-warning">verifying…</span>
              ) : s === "match" ? (
                <span className="text-success">✓ hash matches</span>
              ) : s === "mismatch" ? (
                <span className="text-error">✗ mismatch</span>
              ) : (
                <span className="text-warning">report unavailable</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-[10px] text-text-tertiary">Re-hashes the stored report locally and compares it to the hash committed in the credential registry.</p>
    </div>
  );
}
