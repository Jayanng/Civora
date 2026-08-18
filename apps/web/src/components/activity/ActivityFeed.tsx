"use client";

import { formatEther } from "viem";
import { ASSET_STATE_NAMES, ASSET_TYPE_NAMES } from "@/lib/civora";
import type { AssetDetail } from "@/lib/assets-page";
import type { IndexedAgent } from "@/lib/agents";
import type { IndexedAsset } from "@/lib/assets";
import { LifecycleStepper } from "@/components/LifecycleStepper";
import { TxLink, truncateHash } from "@/components/TxLink";
import { useNow } from "@/components/dashboard/useNow";
import { EventIcon, type EventKind } from "./EventIcon";
import { ReportChip } from "./ReportChip";

export interface TxInfo {
  ts: number | null;
  block: number | null;
}

export interface FeedEvent {
  key: string;
  kind: EventKind;
  label: string;
  detail: string;
  tx: `0x${string}`;
  ts: number | null;
  block: number | null;
}

export type EntityFilter = "all" | "agents" | "assets";
export type KindFilter = "all" | EventKind;

function formatRemaining(ms: number): string {
  if (ms <= 0) return "maturity reached";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function settleDetail(chain: NonNullable<AssetDetail["chain"]>, mon: AssetDetail["monitor"]): string {
  if (!mon) return "Target Met";
  const met = mon.outcome === 1;
  const haircut = met ? 0n : (chain.couponWei * BigInt(mon.penaltyBps)) / 10_000n;
  const live = chain.couponWei - haircut;
  const holderCoupon = live - (live * 600n) / 10_000n;
  return met
    ? `Target Met · holder ${formatEther(chain.principalWei + holderCoupon)} BOT`
    : `Target Missed · ${mon.penaltyBps / 100}% haircut ${formatEther(haircut)} BOT · holder ${formatEther(chain.principalWei + holderCoupon)} BOT`;
}

function withTimes(entries: Omit<FeedEvent, "ts" | "block">[], times: Record<string, TxInfo>): FeedEvent[] {
  return entries.map((e) => ({
    ...e,
    ts: times[e.tx]?.ts ?? null,
    block: times[e.tx]?.block ?? null,
  }));
}

function buildAgentEvents(agents: IndexedAgent[], agentTypes: Map<number, number>, times: Record<string, TxInfo>): FeedEvent[] {
  return agents.map((agent) => {
    const type = agentTypes.get(agent.agentId);
    const label = type === 1 ? "Underwriter" : type === 2 ? "Compliance Monitor" : type === 3 ? "Settlement" : "Agent";
    return {
      key: `agent-${agent.agentId}`,
      kind: "agent" as const,
      label: `${label} agent #${agent.agentId} created`,
      detail: "Identity NFT + wallet bound in one transaction",
      tx: agent.txHash,
      ts: times[agent.txHash]?.ts ?? null,
      block: times[agent.txHash]?.block ?? null,
    };
  });
}

function buildAssetEvents(asset: IndexedAsset, detail: AssetDetail | undefined, times: Record<string, TxInfo>): FeedEvent[] {
  const chain = detail?.chain;
  const typeName = chain ? ASSET_TYPE_NAMES[chain.assetType as 1 | 2] : "Green asset";
  const amount = chain ? `${formatEther(chain.principalWei)} BOT principal · ${formatEther(chain.couponWei)} BOT coupon` : "Asset data loading";
  const uw = detail?.underwrite;
  const mon = detail?.monitor;

  const entries: Omit<FeedEvent, "ts" | "block">[] = [
    { key: "register", kind: "register", tx: asset.registerTx, label: `Asset #${asset.assetId} registered`, detail: `${typeName} · ${amount}` },
    asset.fundTx ? { key: "fund", kind: "fund", tx: asset.fundTx, label: `Asset #${asset.assetId} funded`, detail: "Principal + coupon escrowed in the vault" } : null,
    asset.underwriteTx ? { key: "underwrite", kind: "underwrite", tx: asset.underwriteTx, label: `Asset #${asset.assetId} underwritten`, detail: uw ? (uw.decision === 1 ? "Approved · coupon cap committed" : "Rejected — escrow becomes refundable") : "AI underwrite committed" } : null,
    asset.monitorTx ? { key: "monitor", kind: "monitor", tx: asset.monitorTx, label: `Asset #${asset.assetId} monitored`, detail: mon ? (mon.outcome === 1 ? "Target Met · penalty 0 bps" : `Target Missed · penalty ${mon.penaltyBps / 100}%`) : "AI monitor committed" } : null,
    asset.settleTx ? { key: "settle", kind: "settle", tx: asset.settleTx, label: `Asset #${asset.assetId} settled`, detail: chain ? settleDetail(chain, mon ?? null) : "Settled" } : null,
  ].filter((e): e is Omit<FeedEvent, "ts" | "block"> => e !== null);

  return withTimes(entries, times);
}

function TxMeta({ ev }: { ev: FeedEvent }) {
  return (
    <p className="font-mono text-xs text-text-secondary">
      {ev.detail} · <TxLink hash={ev.tx} />
      {ev.ts ? (
        <span className="text-text-tertiary">
          {" "}· {new Date(ev.ts).toLocaleString()}
          {ev.block ? (
            <>
              {" "}·{" "}
              <a href={`https://scan.botchain.ai/block/${ev.block}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
                block {ev.block}
              </a>
            </>
          ) : null}
        </span>
      ) : null}
    </p>
  );
}

function AgentRow({ ev }: { ev: FeedEvent }) {
  return (
    <li className="flex gap-3">
      <EventIcon kind={ev.kind} />
      <div className="min-w-0 flex-1">
        <p className="font-grotesk text-xs font-medium">{ev.label}</p>
        <TxMeta ev={ev} />
      </div>
    </li>
  );
}

function AssetTimelineCard({
  asset,
  detail,
  times,
  kindFilter,
}: {
  asset: IndexedAsset;
  detail: AssetDetail | undefined;
  times: Record<string, TxInfo>;
  kindFilter: KindFilter;
}) {
  const now = useNow(1000);
  const events = buildAssetEvents(asset, detail, times);
  const visible = kindFilter === "all" ? events : events.filter((e) => e.kind === kindFilter);
  const chain = detail?.chain;
  const state = chain?.state ?? null;
  const stateName = state ? ASSET_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5 | 6] : null;

  if (visible.length === 0) return null;

  return (
    <li className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-grotesk text-sm font-medium">Asset #{asset.assetId} lifecycle</p>
          <p className="font-mono text-xs text-text-secondary">Target: {chain ? truncateHash(chain.targetHash) : "…"}</p>
        </div>
        {chain ? (
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-secondary">
            {stateName ? (
              <span className={`rounded-sm px-1.5 py-0.5 text-[10px] ${state === 5 ? "bg-success-bg text-success" : state === 6 ? "bg-error-bg text-error" : "bg-info-bg text-info"}`}>
                {stateName}
              </span>
            ) : null}
            <span>{formatEther(chain.principalWei + chain.couponWei)} BOT escrow</span>
            <span className="text-text-tertiary">maturity {formatRemaining(Number(chain.maturity) * 1000 - now)}</span>
          </div>
        ) : null}
      </div>
      {chain ? <LifecycleStepper state={Number(chain.state)} /> : null}
      <ul className="flex flex-col gap-3">
        {visible.map((ev, index) => (
          <li key={ev.key} className="flex gap-3">
            <EventIcon kind={ev.kind} current={index === visible.length - 1} />
            <div className="min-w-0 flex-1">
              <p className="font-grotesk text-xs font-medium">{ev.label}</p>
              <TxMeta ev={ev} />
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        {asset.underwriteReportHash ? (
          <span className="font-mono text-[10px] text-text-tertiary">
            underwrite report <ReportChip hash={asset.underwriteReportHash} />
          </span>
        ) : null}
        {asset.monitorReportHash ? (
          <span className="font-mono text-[10px] text-text-tertiary">
            monitor report <ReportChip hash={asset.monitorReportHash} />
          </span>
        ) : null}
      </div>
    </li>
  );
}

function GroupedView({
  agents,
  assets,
  details,
  agentTypes,
  times,
  kindFilter,
}: {
  agents: IndexedAgent[];
  assets: IndexedAsset[];
  details: Map<number, AssetDetail>;
  agentTypes: Map<number, number>;
  times: Record<string, TxInfo>;
  kindFilter: KindFilter;
}) {
  const agentEvents = buildAgentEvents(agents, agentTypes, times);
  const agentVisible = kindFilter === "all" || kindFilter === "agent" ? agentEvents : [];
  const assetVisible = assets.filter((a) => {
    const evs = buildAssetEvents(a, details.get(a.assetId), times);
    return kindFilter === "all" ? true : evs.some((e) => e.kind === kindFilter);
  });

  return (
    <ul className="flex flex-col gap-4">
      {agentVisible.map((ev) => (
        <AgentRow key={ev.key} ev={ev} />
      ))}
      {assetVisible.map((asset) => (
        <AssetTimelineCard key={`asset-${asset.assetId}`} asset={asset} detail={details.get(asset.assetId)} times={times} kindFilter={kindFilter} />
      ))}
    </ul>
  );
}

function TimelineView({
  agents,
  assets,
  details,
  agentTypes,
  times,
  kindFilter,
}: {
  agents: IndexedAgent[];
  assets: IndexedAsset[];
  details: Map<number, AssetDetail>;
  agentTypes: Map<number, number>;
  times: Record<string, TxInfo>;
  kindFilter: KindFilter;
}) {
  const events = [
    ...buildAgentEvents(agents, agentTypes, times),
    ...assets.flatMap((a) => buildAssetEvents(a, details.get(a.assetId), times)),
  ]
    .filter((e) => kindFilter === "all" || e.kind === kindFilter)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));

  if (events.length === 0) {
    return <p className="py-6 text-center font-mono text-sm text-text-tertiary">No matching events.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((ev) => (
        <li key={ev.key} className="flex gap-3 border-t border-border pt-3">
          <EventIcon kind={ev.kind} />
          <div className="min-w-0 flex-1">
            <p className="font-grotesk text-xs font-medium">{ev.label}</p>
            <TxMeta ev={ev} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ActivityFeed({
  agents,
  assets,
  details,
  agentTypes,
  times,
  entity,
  kindFilter,
  view,
}: {
  agents: IndexedAgent[];
  assets: IndexedAsset[];
  details: Map<number, AssetDetail>;
  agentTypes: Map<number, number>;
  times: Record<string, TxInfo>;
  entity: EntityFilter;
  kindFilter: KindFilter;
  view: "grouped" | "timeline";
}) {
  const showAgents = entity === "all" || entity === "agents";
  const showAssets = entity === "all" || entity === "assets";
  const agents_ = showAgents ? agents : [];
  const assets_ = showAssets ? assets : [];

  const hasAny = agents_.length > 0 || assets_.length > 0;
  if (!hasAny) {
    return <p className="py-6 text-center font-mono text-sm text-text-tertiary">Nothing matches these filters.</p>;
  }

  return view === "timeline" ? (
    <TimelineView agents={agents_} assets={assets_} details={details} agentTypes={agentTypes} times={times} kindFilter={kindFilter} />
  ) : (
    <GroupedView agents={agents_} assets={assets_} details={details} agentTypes={agentTypes} times={times} kindFilter={kindFilter} />
  );
}
