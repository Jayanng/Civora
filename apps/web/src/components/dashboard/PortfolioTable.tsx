"use client";

import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { ASSET_STATE_NAMES, ASSET_TYPE, ASSET_TYPE_NAMES } from "@/lib/civora";
import type { DashboardData } from "@/lib/dashboard";
import type { IndexedAsset } from "@/lib/assets";
import { TxLink } from "@/components/TxLink";

type SortKey = "id" | "escrow" | "maturity";
type SortDir = "asc" | "desc";

/** Your assets as a filterable, sortable table — the upgraded activity list. */
export function PortfolioTable({ data, indexed }: { data: DashboardData; indexed: IndexedAsset[] }) {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo(() => {
    const byId = new Map(data.assets.map((a) => [a.assetId, a]));
    const out = indexed
      .map((i) => byId.get(i.assetId))
      .filter((a): a is NonNullable<typeof a> => a !== undefined)
      .filter((a) => (stateFilter === "all" ? true : a.state === Number(stateFilter)))
      .filter((a) => (typeFilter === "all" ? true : a.assetType === Number(typeFilter)));
    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      if (sortKey === "escrow") return (Number(a.principalWei + a.couponWei) - Number(b.principalWei + b.couponWei)) * dir;
      if (sortKey === "maturity") return (Number(a.maturity) - Number(b.maturity)) * dir;
      return (a.assetId - b.assetId) * dir;
    });
  }, [data.assets, indexed, stateFilter, typeFilter, sortKey, sortDir]);

  const header = (key: SortKey, label: string) => (
    <th className="py-2 pr-4 font-medium">
      <button
        type="button"
        onClick={() => {
          if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setSortDir("asc");
          }
        }}
        className={`hover:text-text-primary ${sortKey === key ? "text-accent" : ""}`}
      >
        {label} {sortKey === key ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </button>
    </th>
  );

  if (indexed.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-grotesk text-sm font-medium">Your portfolio</h2>
        <div className="flex flex-wrap gap-2">
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="h-8 border border-border-strong bg-bg px-2 font-mono text-xs text-text-primary">
            <option value="all">All states</option>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <option key={s} value={s}>{ASSET_STATE_NAMES[s as 1 | 2 | 3 | 4 | 5 | 6]}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 border border-border-strong bg-bg px-2 font-mono text-xs text-text-primary">
            <option value="all">All types</option>
            <option value={ASSET_TYPE.SustainabilityLinkedBond}>{ASSET_TYPE_NAMES[1]}</option>
            <option value={ASSET_TYPE.GreenReceivable}>{ASSET_TYPE_NAMES[2]}</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
              {header("id", "ID")}
              <th className="py-2 pr-4 font-medium">Type</th>
              {header("escrow", "Escrow")}
              <th className="py-2 pr-4 font-medium">State</th>
              {header("maturity", "Maturity")}
              <th className="py-2 pr-4 font-medium">Target</th>
              <th className="py-2 font-medium">Latest tx</th>
            </tr>
          </thead>
          <tbody className="font-mono text-[11px]">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-text-tertiary">No assets match these filters.</td></tr>
            ) : (
              rows.map((a) => {
                const i = indexed.find((x) => x.assetId === a.assetId);
                const latest = i?.settleTx ?? i?.monitorTx ?? i?.underwriteTx ?? i?.fundTx ?? i?.registerTx;
                return (
                  <tr key={a.assetId} className="border-t border-border">
                    <td className="py-2 pr-4 text-text-primary">#{a.assetId}</td>
                    <td className="py-2 pr-4 text-text-secondary">{ASSET_TYPE_NAMES[a.assetType as 1 | 2]}</td>
                    <td className="py-2 pr-4 text-text-primary">{formatEther(a.principalWei + a.couponWei)} BOT</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-sm px-1.5 py-0.5 text-[10px] ${a.state === 5 ? "bg-success-bg text-success" : a.state === 6 ? "bg-error-bg text-error" : "bg-info-bg text-info"}`}>
                        {ASSET_STATE_NAMES[a.state as 1 | 2 | 3 | 4 | 5 | 6]}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{new Date(Number(a.maturity) * 1000).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 text-text-tertiary">{a.targetHash.slice(0, 8)}…</td>
                    <td className="py-2">{latest ? <TxLink hash={latest} /> : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
