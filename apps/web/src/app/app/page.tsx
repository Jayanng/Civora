"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ADDRESSES, agentExists, assetExists, fetchSettledStats, findTotal, reputationAbi } from "@/lib/civora";
import { loadAgentIndex, subscribeAgentIndex } from "@/lib/agents";
import { loadAssetIndex, subscribeAssetIndex } from "@/lib/assets";
import { TxLink } from "@/components/TxLink";
import { useSyncExternalStore } from "react";

function MetricCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-widest text-text-secondary">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium text-text-primary">{value}</p>
      <p className="mt-1 font-mono text-xs text-text-tertiary">{caption}</p>
    </div>
  );
}

export default function DashboardPage() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const agents = useSyncExternalStore(subscribeAgentIndex, loadAgentIndex, loadAgentIndex);
  const assets = useSyncExternalStore(subscribeAssetIndex, loadAssetIndex, loadAssetIndex);

  const agentCount = useQuery({
    queryKey: ["counts", "primary-agents"],
    queryFn: () => publicClient ? findTotal(publicClient, (id) => agentExists(publicClient, id)) : 0n,
    enabled: !!publicClient,
    refetchInterval: 15_000,
  });
  const assetCount = useQuery({
    queryKey: ["counts", "assets"],
    queryFn: () => publicClient ? findTotal(publicClient, (id) => assetExists(publicClient, id)) : 0n,
    enabled: !!publicClient,
    refetchInterval: 15_000,
  });
  const settled = useQuery({
    queryKey: ["counts", "green-settled", assetCount.data?.toString()],
    queryFn: () => publicClient ? fetchSettledStats(publicClient, assetCount.data ?? 0n) : { count: 0, valueWei: 0n, capped: false },
    enabled: !!publicClient && assetCount.data !== undefined,
    refetchInterval: 15_000,
  });
  const reputation = useQuery({
    queryKey: ["counts", "green-reputation", address, agents.map((a) => a.agentId).join(",")],
    queryFn: async () => {
      if (!publicClient || agents.length === 0) return 0n;
      const scores = await Promise.all(agents.map((agent) => publicClient.readContract({ address: ADDRESSES.reputation, abi: reputationAbi, functionName: "score", args: [BigInt(agent.agentId)] })));
      return scores.reduce((sum, score) => sum + score, 0n);
    },
    enabled: !!publicClient,
    refetchInterval: 15_000,
  });

  const loading = agentCount.isLoading || assetCount.isLoading || settled.isLoading;
  const activity = [
    ...agents.map((agent) => ({ label: `Agent #${agent.agentId} created`, hash: agent.txHash })),
    ...assets.flatMap((asset) => [
      { label: `Asset #${asset.assetId} registered`, hash: asset.registerTx },
      asset.fundTx ? { label: `Asset #${asset.assetId} funded`, hash: asset.fundTx } : null,
      asset.underwriteTx ? { label: `Asset #${asset.assetId} underwritten`, hash: asset.underwriteTx } : null,
      asset.monitorTx ? { label: `Asset #${asset.assetId} monitored`, hash: asset.monitorTx } : null,
      asset.settleTx ? { label: `Asset #${asset.assetId} settled`, hash: asset.settleTx } : null,
    ].filter((entry): entry is { label: string; hash: `0x${string}` } => entry !== null)),
  ].slice(-4).reverse();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 font-mono text-xs text-text-secondary">Civora sustainability-linked assets, read live from BOT Chain 677.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/agents?new=1" className="inline-flex h-10 items-center rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">Create Agent</Link>
          <Link href="/app/assets?new=1" className="inline-flex h-10 items-center rounded-none border border-border-strong px-4 font-grotesk text-sm font-medium text-text-primary hover:bg-surface">Issue Asset</Link>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Active Agents" value={loading ? "…" : agentCount.data?.toString() ?? "0"} caption="AgentIdentity.exists()" />
        <MetricCard label="Registered Assets" value={loading ? "…" : assetCount.data?.toString() ?? "0"} caption="GreenAssetRegistry.assets()" />
        <MetricCard label="Total Settled" value={loading ? "…" : settled.data?.capped ? "256+ assets" : `${settled.data?.count ?? 0} · ${formatEther(settled.data?.valueWei ?? 0n)} BOT`} caption="settled assets, on-chain" />
        <MetricCard label="Your Agent Reputation" value={reputation.isLoading ? "…" : reputation.data?.toString() ?? "0"} caption="Reputation.score()" />
      </div>
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-widest text-text-secondary">Recent activity</h2>
          <Link href="/app/activity" className="font-mono text-xs text-accent hover:text-accent-hover">View all</Link>
        </div>
        {activity.length === 0 ? <p className="mt-4 font-mono text-sm text-text-tertiary">No indexed activity for this wallet.</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {activity.map((entry) => <li key={`${entry.label}-${entry.hash}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 font-mono text-xs"><span>{entry.label}</span><TxLink hash={entry.hash} /></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
