"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { loadAgentIndex, subscribeAgentIndex, type IndexedAgent } from "@/lib/agents";
import { loadAssetIndex, subscribeAssetIndex, type IndexedAsset } from "@/lib/assets";
import { fetchAssetDetails } from "@/lib/assets-page";
import { fetchAgentTypes } from "@/lib/agents-page";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { ActivityFeed, type EntityFilter, type KindFilter, type TxInfo } from "@/components/activity/ActivityFeed";

function useTxTimes(hashes: `0x${string}`[], nonce: number): Record<string, TxInfo> {
  const publicClient = usePublicClient();
  const [times, setTimes] = useState<Record<string, TxInfo>>({});
  const key = hashes.join(",");
  useEffect(() => {
    let active = true;
    if (!publicClient || hashes.length === 0) return;
    Promise.all(hashes.map(async (hash) => {
      try {
        const tx = await publicClient.getTransaction({ hash });
        if (!tx.blockNumber) return [hash, { ts: null, block: null }] as const;
        const block = await publicClient.getBlock({ blockNumber: tx.blockNumber });
        return [hash, { ts: Number(block.timestamp) * 1000, block: Number(tx.blockNumber) }] as const;
      } catch {
        return [hash, { ts: null, block: null }] as const;
      }
    })).then((entries) => { if (active) setTimes(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [key, publicClient, hashes, nonce]);
  return times;
}

export default function ActivityPage() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const agents = useSyncExternalStore((cb) => subscribeAgentIndex(cb, address), () => loadAgentIndex(address), () => loadAgentIndex(address));
  const assets = useSyncExternalStore((cb) => subscribeAssetIndex(cb, address), () => loadAssetIndex(address), () => loadAssetIndex(address));
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState<EntityFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [view, setView] = useState<"grouped" | "timeline">("grouped");
  const [nonce, setNonce] = useState(0);

  const KIND_LABELS: Record<KindFilter, string> = {
    all: "All events",
    agent: "Created",
    register: "Registered",
    fund: "Funded",
    underwrite: "Underwritten",
    monitor: "Monitored",
    settle: "Settled",
  };

  const assetIds = assets.map((a) => a.assetId).join(",");
  const agentIds = agents.map((a) => a.agentId).join(",");

  const detailsQuery = useQuery({
    queryKey: ["activity", "details", assetIds],
    queryFn: () => (publicClient ? fetchAssetDetails(publicClient, assets.map((a) => a.assetId)) : null),
    enabled: !!publicClient && assets.length > 0,
    refetchInterval: 15_000,
  });
  const typesQuery = useQuery({
    queryKey: ["activity", "types", agentIds],
    queryFn: () => (publicClient ? fetchAgentTypes(publicClient, agents.map((a) => a.agentId)) : null),
    enabled: !!publicClient && agents.length > 0,
    refetchInterval: 15_000,
  });

  const allHashes = useMemo<`0x${string}`[]>(
    () => [
      ...agents.map((a) => a.txHash),
      ...assets.flatMap((a) => [a.registerTx, a.fundTx, a.underwriteTx, a.monitorTx, a.settleTx].filter((h): h is `0x${string}` => Boolean(h))),
    ],
    [agents, assets],
  );
  const times = useTxTimes(allHashes, nonce);

  const details = useMemo(() => detailsQuery.data ?? new Map(), [detailsQuery.data]);
  const agentTypes = useMemo(() => typesQuery.data ?? new Map(), [typesQuery.data]);

  const q = query.trim().toLowerCase();
  const filteredAgents = useMemo<IndexedAgent[]>(() => (q ? agents.filter((a) => String(a.agentId).includes(q)) : agents), [agents, q]);
  const filteredAssets = useMemo<IndexedAsset[]>(() => (q ? assets.filter((a) => String(a.assetId).includes(q)) : assets), [assets, q]);

  const noAgents = agents.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-1 font-mono text-xs text-text-secondary">Every Civora agent and green-asset event, indexed from receipts on BOT Chain 677.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            live · polls every 15s
          </span>
          <button type="button" onClick={() => setNonce((n) => n + 1)} className="h-8 border border-border-strong px-3 font-grotesk text-xs text-text-primary hover:bg-surface">
            Refresh
          </button>
        </div>
      </header>

      {noAgents ? (
        <OnboardingChecklist />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to #id…"
              className="h-9 w-44 rounded-none border border-border-strong bg-bg px-3 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
            <div className="flex items-center gap-1">
              {(["all", "agents", "assets"] as const).map((e) => (
                <button key={e} type="button" onClick={() => setEntity(e)} className={`border px-2.5 py-1 font-mono text-[11px] capitalize ${entity === e ? "border-accent bg-accent-muted text-accent-strong" : "border-border bg-bg text-text-secondary hover:border-accent"}`}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {(["all", "agent", "register", "fund", "underwrite", "monitor", "settle"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKindFilter(k)} className={`border px-2.5 py-1 font-mono text-[11px] ${kindFilter === k ? "border-accent bg-accent-muted text-accent-strong" : "border-border bg-bg text-text-secondary hover:border-accent"}`}>
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              {(["grouped", "timeline"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`border px-2.5 py-1 font-mono text-[11px] capitalize ${view === v ? "border-accent bg-accent-muted text-accent-strong" : "border-border bg-bg text-text-secondary hover:border-accent"}`}>
                  {v === "grouped" ? "By entity" : "Chronological"}
                </button>
              ))}
            </div>
          </div>

          <section className="rounded-md border border-border bg-surface p-4">
            <ActivityFeed
              agents={filteredAgents}
              assets={filteredAssets}
              details={details}
              agentTypes={agentTypes}
              times={times}
              entity={entity}
              kindFilter={kindFilter}
              view={view}
            />
          </section>
        </>
      )}
    </div>
  );
}
