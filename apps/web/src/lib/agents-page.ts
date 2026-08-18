import type { Address, PublicClient } from "viem";
import {
  ADDRESSES,
  agentExists,
  assetExists,
  credentialsAbi,
  findTotal,
  identityAbi,
  reputationAbi,
  type ReadClient,
} from "./civora";
import { fetchAllAssets, type FullAsset } from "./dashboard";

export type ReadClientFull = Pick<PublicClient, "readContract" | "getBalance">;

export type AgentRole = "UW" | "MON" | "SA";

export const ROLE_BPS = 100n; // 1% of the live coupon per agent role

export interface AgentAssignment {
  assetId: number;
  role: AgentRole;
  state: number;
  maturity: bigint;
  principalWei: bigint;
  couponWei: bigint;
}

export interface SettledFeeEntry {
  assetId: number;
  feeWei: bigint;
  penaltyBps: number;
}

export interface ReputationEntry {
  assetId: number;
  reason: "SETTLE_UW" | "SETTLE_MON" | "SETTLE_SA";
  delta: number;
}

export type AgentStatus = "Unused" | "Active" | "Veteran";

export interface AgentPageDetail {
  agentId: number;
  name: string;
  agentType: number;
  wallet: Address;
  owner: Address;
  score: bigint;
  balance: bigint;
  assignments: AgentAssignment[];
  liveCount: number;
  settledFees: SettledFeeEntry[];
  earnedWei: bigint;
  reputationLedger: ReputationEntry[];
  status: AgentStatus;
  lastActivity: { assetId: number; role: AgentRole; state: number } | null;
}

export async function fetchAgentTypes(client: ReadClient, agentIds: number[]): Promise<Map<number, number>> {
  const results = await Promise.all(
    agentIds.map((id) =>
      client
        .readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "agentTypeOf", args: [BigInt(id)] })
        .catch(() => 0),
    ),
  );
  const map = new Map<number, number>();
  agentIds.forEach((id, i) => {
    if (results[i] !== 0) map.set(id, Number(results[i]));
  });
  return map;
}

export interface AgentsPageData {
  agentCount: bigint;
  assetCount: bigint;
  assets: FullAsset[];
  details: Map<number, AgentPageDetail>;
}

/** Live coupon after a target-missed haircut, mirroring SettlementAndPenaltyVault._payout. */
function liveCouponWei(couponWei: bigint, penaltyBps: number): bigint {
  if (penaltyBps <= 0) return couponWei;
  return couponWei - (couponWei * BigInt(penaltyBps)) / 10_000n;
}

function roleFor(asset: FullAsset, agentId: number): AgentRole | null {
  if (asset.underwriterId === agentId) return "UW";
  if (asset.monitorId === agentId) return "MON";
  if (asset.settlementAgentId === agentId) return "SA";
  return null;
}

async function fetchSettledPenalties(client: ReadClient, assets: FullAsset[]): Promise<Map<number, number>> {
  const settled = assets.filter((a) => a.state === 5);
  const entries = await Promise.all(
    settled.map(async (asset) => {
      try {
        const hasMon = await client.readContract({
          address: ADDRESSES.credentials,
          abi: credentialsAbi,
          functionName: "hasMonitor",
          args: [BigInt(asset.assetId)],
        });
        if (!hasMon) return [asset.assetId, 0] as const;
        const m = await client.readContract({
          address: ADDRESSES.credentials,
          abi: credentialsAbi,
          functionName: "monitors",
          args: [BigInt(asset.assetId)],
        });
        return [asset.assetId, Number(m[4])] as const; // penaltyBps
      } catch {
        return [asset.assetId, 0] as const;
      }
    }),
  );
  return new Map(entries);
}

async function fetchDetailFor(
  client: ReadClientFull,
  agentId: number,
  assets: FullAsset[],
  penalties: Map<number, number>,
): Promise<AgentPageDetail | null> {
  try {
    const [name, agentType, wallet, owner, score] = await Promise.all([
      client.readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "nameOf", args: [BigInt(agentId)] }),
      client.readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "agentTypeOf", args: [BigInt(agentId)] }),
      client.readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "walletOf", args: [BigInt(agentId)] }),
      client.readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "ownerOf", args: [BigInt(agentId)] }),
      client.readContract({ address: ADDRESSES.reputation, abi: reputationAbi, functionName: "score", args: [BigInt(agentId)] }),
    ]);
    const balance = await client.getBalance({ address: wallet });

    const assignments: AgentAssignment[] = [];
    const settledFees: SettledFeeEntry[] = [];
    const reputationLedger: ReputationEntry[] = [];

    for (const asset of assets) {
      const role = roleFor(asset, agentId);
      if (!role) continue;
      assignments.push({
        assetId: asset.assetId,
        role,
        state: asset.state,
        maturity: asset.maturity,
        principalWei: asset.principalWei,
        couponWei: asset.couponWei,
      });
      if (asset.state === 5) {
        const penaltyBps = penalties.get(asset.assetId) ?? 0;
        const feeWei = (liveCouponWei(asset.couponWei, penaltyBps) * ROLE_BPS) / 10_000n;
        settledFees.push({ assetId: asset.assetId, feeWei, penaltyBps });
        reputationLedger.push({
          assetId: asset.assetId,
          reason: role === "UW" ? "SETTLE_UW" : role === "MON" ? "SETTLE_MON" : "SETTLE_SA",
          delta: role === "MON" ? 2 : 1,
        });
      }
    }

    const liveCount = assignments.filter((a) => a.state === 2 || a.state === 3 || a.state === 4).length;
    const earnedWei = settledFees.reduce((acc, f) => acc + f.feeWei, 0n);
    const status: AgentStatus =
      assignments.length === 0 ? "Unused" : liveCount > 0 ? "Active" : "Veteran";
    const last =
      assignments.length === 0
        ? null
        : assignments.reduce((max, a) => (a.assetId > max.assetId ? a : max));

    return {
      agentId,
      name,
      agentType: Number(agentType),
      wallet,
      owner,
      score,
      balance,
      assignments,
      liveCount,
      settledFees,
      earnedWei,
      reputationLedger,
      status,
      lastActivity: last ? { assetId: last.assetId, role: last.role, state: last.state } : null,
    };
  } catch {
    return null;
  }
}

export async function fetchAgentsPageData(
  client: ReadClientFull,
  agentIds: number[],
): Promise<AgentsPageData> {
  const [countAgents, countAssets] = await Promise.all([
    findTotal(client, (id) => agentExists(client, id)),
    findTotal(client, (id) => assetExists(client, id)),
  ]);

  const assets = await fetchAllAssets(client, countAssets).catch(() => []);
  const penalties = await fetchSettledPenalties(client, assets);

  const details = new Map<number, AgentPageDetail>();
  const results = await Promise.all(
    agentIds.map((agentId) => fetchDetailFor(client, agentId, assets, penalties)),
  );
  for (const detail of results) {
    if (detail) details.set(detail.agentId, detail);
  }

  return { agentCount: countAgents, assetCount: countAssets, assets, details };
}
