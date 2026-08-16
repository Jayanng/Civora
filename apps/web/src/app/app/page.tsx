"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ADDRESSES, findTotal, fetchSettledStats, agentExists, invoiceExists, reputationAbi } from "@/lib/civora";
import { loadAgentIndex } from "@/lib/agents";

function MetricCard({
  label,
  value,
  caption,
  mono = true,
}: {
  label: string;
  value: string;
  caption: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-widest text-text-secondary">{label}</p>
      <p className={`mt-2 ${mono ? "font-mono" : "font-grotesk"} text-2xl font-medium text-text-primary`}>
        {value}
      </p>
      <p className="mt-1 font-mono text-xs text-text-tertiary">{caption}</p>
    </div>
  );
}

export default function DashboardPage() {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const agents = useQuery({
    queryKey: ["counts", "agents"],
    queryFn: async () => {
      if (!publicClient) return 0n;
      return findTotal(publicClient, (id) => agentExists(publicClient, id));
    },
    enabled: !!publicClient,
    refetchInterval: 15_000,
  });

  const invoices = useQuery({
    queryKey: ["counts", "invoices"],
    queryFn: async () => {
      if (!publicClient) return 0n;
      return findTotal(publicClient, (id) => invoiceExists(publicClient, id));
    },
    enabled: !!publicClient,
    refetchInterval: 15_000,
  });

  const settled = useQuery({
    queryKey: ["counts", "settled", invoices.data?.toString()],
    queryFn: async () => {
      if (!publicClient) return { count: 0, valueWei: 0n };
      return fetchSettledStats(publicClient, invoices.data ?? 0n);
    },
    enabled: !!publicClient && invoices.data !== undefined,
    refetchInterval: 15_000,
  });

  const myReputation = useQuery({
    queryKey: ["counts", "reputation", address],
    queryFn: async () => {
      if (!publicClient) return 0n;
      const ids = loadAgentIndex().map((a) => BigInt(a.agentId));
      if (ids.length === 0) return 0n;
      const scores = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: ADDRESSES.reputation,
            abi: reputationAbi,
            functionName: "score",
            args: [id],
          }),
        ),
      );
      return scores.reduce((acc, s) => acc + s, 0n);
    },
    enabled: !!publicClient,
    refetchInterval: 15_000,
  });

  const loading = agents.isLoading || invoices.isLoading || settled.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 font-mono text-xs text-text-secondary">
            Every number below is read live from contracts on BOT Chain (677).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/agents?new=1"
            className="inline-flex h-10 items-center rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover"
          >
            Create Agent
          </Link>
          <Link
            href="/app/invoices?new=1"
            className="inline-flex h-10 items-center rounded-none border border-border-strong px-4 font-grotesk text-sm font-medium text-text-primary hover:bg-surface"
          >
            Register Invoice
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Agents"
          value={loading ? "…" : agents.data?.toString() ?? "0"}
          caption="AgentIdentity.exists()"
        />
        <MetricCard
          label="Registered Invoices"
          value={loading ? "…" : invoices.data?.toString() ?? "0"}
          caption="InvoiceRegistry.invoices()"
        />
        <MetricCard
          label="Total Settled"
          value={
            loading
              ? "…"
              : `${settled.data?.count ?? 0} · ${formatEther(settled.data?.valueWei ?? 0n)} BOT`
          }
          caption="settled invoices, summed on-chain"
        />
        <MetricCard
          label="Your Agent Reputation"
          value={myReputation.isLoading ? "…" : myReputation.data?.toString() ?? "0"}
          caption="Reputation.score()"
        />
      </div>

      <section className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-xs uppercase tracking-widest text-text-secondary">Recent activity</h2>
        <p className="mt-2 font-mono text-sm text-text-tertiary">
          No events yet — the activity indexer follows in a later build step.
        </p>
      </section>
    </div>
  );
}