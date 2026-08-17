"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatEther } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { ADDRESSES, ASSET_TYPE_NAMES, assetsAbi, credentialsAbi, identityAbi } from "@/lib/civora";
import { loadAgentIndex, subscribeAgentIndex, type IndexedAgent } from "@/lib/agents";
import { loadAssetIndex, subscribeAssetIndex, type IndexedAsset } from "@/lib/assets";
import { TxLink, truncateHash } from "@/components/TxLink";

type TxInfo = { ts: number | null; block: number | null };

function useTxTimes(hashes: `0x${string}`[]): Record<string, TxInfo> {
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
  }, [key, publicClient, hashes]);
  return times;
}

function AgentEntry({ agent }: { agent: IndexedAgent }) {
  const type = useReadContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "agentTypeOf", args: [BigInt(agent.agentId)] });
  const times = useTxTimes([agent.txHash]);
  const info = times[agent.txHash];
  const label = type.data === 1 ? "Underwriter" : type.data === 2 ? "Compliance Monitor" : type.data === 3 ? "Settlement" : "Agent";
  return <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-[10px]">A</span><div className="min-w-0 flex-1"><p className="font-grotesk text-xs font-medium">{label} agent #{agent.agentId} created</p><p className="font-mono text-xs text-text-secondary"><TxLink hash={agent.txHash} />{info?.ts ? <span className="text-text-tertiary"> · {new Date(info.ts).toLocaleString()} · block {info.block}</span> : null}</p></div></li>;
}

function AssetTimeline({ asset }: { asset: IndexedAsset }) {
  const chainAsset = useReadContract({ address: ADDRESSES.assets, abi: assetsAbi, functionName: "assets", args: [BigInt(asset.assetId)] });
  const underwrite = useReadContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "underwrites", args: [BigInt(asset.assetId)] });
  const monitor = useReadContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "monitors", args: [BigInt(asset.assetId)] });
  const hashes = useMemo(() => [asset.registerTx, asset.fundTx, asset.underwriteTx, asset.monitorTx, asset.settleTx].filter((hash): hash is `0x${string}` => Boolean(hash)), [asset.registerTx, asset.fundTx, asset.underwriteTx, asset.monitorTx, asset.settleTx]);
  const times = useTxTimes(hashes);
  const amount = chainAsset.data ? `${formatEther(chainAsset.data[3])} BOT principal · ${formatEther(chainAsset.data[4])} BOT coupon` : "Asset data loading";
  const typeName = chainAsset.data ? ASSET_TYPE_NAMES[Number(chainAsset.data[2]) as 1 | 2] : "Green asset";
  const entries = [
    { key: "register", tx: asset.registerTx, label: `Asset #${asset.assetId} registered`, detail: `${typeName} · ${amount}` },
    asset.fundTx ? { key: "fund", tx: asset.fundTx, label: `Asset #${asset.assetId} funded`, detail: "Principal + coupon escrowed" } : null,
    asset.underwriteTx ? { key: "underwrite", tx: asset.underwriteTx, label: `Asset #${asset.assetId} underwritten`, detail: underwrite.data?.[3] === 1 ? `Approved · coupon cap ${underwrite.data[5].toString()}` : "Rejected" } : null,
    asset.monitorTx ? { key: "monitor", tx: asset.monitorTx, label: `Asset #${asset.assetId} monitored`, detail: monitor.data?.[3] === 1 ? "Target Met · penalty 0 bps" : monitor.data?.[3] === 2 ? `Target Missed · haircut ${monitor.data[4].toString()} bps` : "Monitor outcome committed" } : null,
    asset.settleTx ? { key: "settle", tx: asset.settleTx, label: `Asset #${asset.assetId} settled`, detail: monitor.data?.[3] === 2 ? "Coupon Haircut" : "Target Met" } : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const sorted = [...entries].sort((a, b) => (times[b.tx]?.ts ?? 0) - (times[a.tx]?.ts ?? 0));
  return <li className="flex flex-col gap-3 border-t border-border pt-4"><div><p className="font-grotesk text-sm font-medium">Asset #{asset.assetId} lifecycle</p><p className="font-mono text-xs text-text-secondary">Target: {chainAsset.data ? truncateHash(chainAsset.data[5]) : "…"}</p></div><ul className="flex flex-col gap-3">{sorted.map((entry, index) => { const info = times[entry.tx]; return <li key={entry.key} className="flex gap-3"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${index === sorted.length - 1 ? "border-success text-success" : "border-border-strong text-text-secondary"}`}>{index + 1}</span><div className="min-w-0 flex-1"><p className="font-grotesk text-xs font-medium">{entry.label}</p><p className="font-mono text-xs text-text-secondary">{entry.detail} · <TxLink hash={entry.tx} />{info?.ts ? <span className="text-text-tertiary"> · {new Date(info.ts).toLocaleString()} · block {info.block}</span> : null}</p></div></li>; })}</ul>{asset.underwriteReportHash ? <p className="font-mono text-xs text-text-secondary">Underwrite report: <Link href={`/api/reports/${asset.underwriteReportHash}`} target="_blank" rel="noreferrer" className="text-accent">{truncateHash(asset.underwriteReportHash)}</Link></p> : null}{asset.monitorReportHash ? <p className="font-mono text-xs text-text-secondary">Monitor report: <Link href={`/api/reports/${asset.monitorReportHash}`} target="_blank" rel="noreferrer" className="text-accent">{truncateHash(asset.monitorReportHash)}</Link></p> : null}</li>;
}

export default function ActivityPage() {
  const agents = useSyncExternalStore(subscribeAgentIndex, loadAgentIndex, loadAgentIndex);
  const assets = useSyncExternalStore(subscribeAssetIndex, loadAssetIndex, loadAssetIndex);
  return <div className="flex flex-col gap-6"><header><h1 className="font-grotesk text-2xl font-semibold tracking-tight">Activity</h1><p className="mt-1 font-mono text-xs text-text-secondary">Every Civora agent and green-asset event, indexed from receipts on BOT Chain 677.</p></header>{agents.length === 0 && assets.length === 0 ? <section className="rounded-md border border-border bg-surface"><p className="py-8 text-center font-mono text-sm text-text-tertiary">No indexed activity yet. Create an agent or issue an asset to begin.</p></section> : <section className="rounded-md border border-border bg-surface p-4"><ul className="flex flex-col gap-4">{[...agents].sort((a, b) => a.agentId - b.agentId).map((agent) => <AgentEntry key={`agent-${agent.agentId}`} agent={agent} />)}{[...assets].sort((a, b) => a.assetId - b.assetId).map((asset) => <AssetTimeline key={`asset-${asset.assetId}`} asset={asset} />)}</ul></section>}</div>;
}
