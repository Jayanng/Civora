"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, keccak256, toBytes } from "viem";
import { AGENT_TYPE_NAMES, ASSET_STATE_NAMES } from "@/lib/civora";
import type { DashboardData } from "@/lib/dashboard";
import { truncateHash } from "@/components/TxLink";
import type { IndexedAsset } from "@/lib/assets";
import { useNow } from "./useNow";

interface VerifyResult {
  hash: `0x${string}`;
  status: "checking" | "match" | "mismatch" | "missing";
}

/** Re-hashes the stored report and compares it to the on-chain credential hash — live proof of integrity. */
export function CredentialIntegrity({ indexed }: { indexed: IndexedAsset[] }) {
  const entries = useMemo(
    () =>
      indexed.flatMap((a) => {
        const rows: { label: string; hash: `0x${string}`; assetId: number }[] = [];
        if (a.underwriteReportHash) rows.push({ label: "underwrite", hash: a.underwriteReportHash, assetId: a.assetId });
        if (a.monitorReportHash) rows.push({ label: "monitor", hash: a.monitorReportHash, assetId: a.assetId });
        return rows;
      }),
    [indexed],
  );

  const [results, setResults] = useState<Record<string, VerifyResult>>({});
  const hashKey = entries.map((e) => e.hash).join(",");

  useEffect(() => {
    let active = true;
    const run = async () => {
      const next: Record<string, VerifyResult> = {};
      await Promise.all(
        entries.map(async ({ hash }) => {
          next[hash] = { hash, status: "checking" };
          try {
            const res = await fetch(`/api/reports/${hash}`);
            if (!res.ok) {
              next[hash] = { hash, status: "missing" };
              return;
            }
            const raw = await res.text();
            const rehash = keccak256(toBytes(raw));
            next[hash] = { hash, status: rehash === hash ? "match" : "mismatch" };
          } catch {
            next[hash] = { hash, status: "missing" };
          }
        }),
      );
      if (active) setResults(next);
    };
    if (entries.length > 0) void run();
    return () => {
      active = false;
    };
  }, [entries, hashKey]);

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="font-grotesk text-sm font-medium">Credential integrity</p>
        <p className="mt-2 font-mono text-xs text-text-tertiary">Commit an underwrite or monitor report to verify its hash here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-grotesk text-sm font-medium">Credential integrity</h2>
        <span className="rounded-sm bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">{entries.length} reports</span>
      </div>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => {
          const r = results[entry.hash];
          return (
            <li key={`${entry.assetId}-${entry.label}`} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-bg px-3 py-2">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-text-secondary">#{entry.assetId} · {entry.label}</span>
                <span className="text-text-tertiary">{truncateHash(entry.hash, 8, 6)}</span>
              </div>
              {!r ? (
                <span className="font-mono text-[10px] text-text-tertiary">…</span>
              ) : r.status === "checking" ? (
                <span className="animate-pulse font-mono text-[10px] text-warning">verifying…</span>
              ) : r.status === "match" ? (
                <span className="rounded-sm bg-success-bg px-1.5 py-0.5 font-mono text-[10px] text-success">✓ hash matches on-chain</span>
              ) : r.status === "mismatch" ? (
                <span className="rounded-sm bg-error-bg px-1.5 py-0.5 font-mono text-[10px] text-error">✗ mismatch</span>
              ) : (
                <span className="rounded-sm bg-warning-bg px-1.5 py-0.5 font-mono text-[10px] text-warning">report unavailable</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-[10px] text-text-tertiary">Each report is re-hashed locally and compared against the hash committed in the credential registry.</p>
    </div>
  );
}

/** Every active settle grant, read live from the permission engine. */
export function PermissionSnapshot({ data }: { data: DashboardData }) {
  const now = useNow(5000);
  const nowSec = Math.floor(now / 1000);
  if (data.grants.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="font-grotesk text-sm font-medium">Permissions</p>
        <p className="mt-2 font-mono text-xs text-text-tertiary">No settle grants yet — they are created when an asset is underwritten.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <h2 className="font-grotesk text-sm font-medium">Permission snapshot</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
              <th className="py-1.5 pr-3 font-medium">Grant</th>
              <th className="py-1.5 pr-3 font-medium">Asset</th>
              <th className="py-1.5 pr-3 font-medium">Agent</th>
              <th className="py-1.5 pr-3 font-medium">Selector</th>
              <th className="py-1.5 pr-3 font-medium">Max value</th>
              <th className="py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[11px]">
            {data.grants.map((g) => {
              const agent = data.agentDetails.get(Number(g.agentId));
              const expired = g.expiresAt <= BigInt(nowSec);
              return (
                <tr key={g.grantId.toString()} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-text-primary">#{g.grantId.toString()}</td>
                  <td className="py-1.5 pr-3 text-text-secondary">#{g.assetId.toString()}</td>
                  <td className="py-1.5 pr-3 text-text-secondary">
                    {agent ? agent.name : `#${g.agentId.toString()}`}
                    <span className="text-text-tertiary"> ({AGENT_TYPE_NAMES[3]})</span>
                  </td>
                  <td className="py-1.5 pr-3 text-text-tertiary">settle()</td>
                  <td className="py-1.5 pr-3 text-text-primary">{Number(formatEther(g.maxValue)).toFixed(2)} BOT</td>
                  <td className="py-1.5">
                    {g.revoked ? (
                      <span className="rounded-sm bg-error-bg px-1.5 py-0.5 text-[10px] text-error">revoked</span>
                    ) : expired ? (
                      <span className="rounded-sm bg-warning-bg px-1.5 py-0.5 text-[10px] text-warning">expired</span>
                    ) : (
                      <span className="rounded-sm bg-success-bg px-1.5 py-0.5 text-[10px] text-success">active</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] text-text-tertiary">Only settle() is ever granted, only to the Settlement agent, capped at principal + coupon, expiring at maturity. State: {ASSET_STATE_NAMES[4]}.</p>
    </div>
  );
}
