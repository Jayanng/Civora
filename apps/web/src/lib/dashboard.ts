import { encodeAbiParameters, keccak256, toFunctionSelector, type Address, type PublicClient } from "viem";
import {
  ADDRESSES,
  agentExists,
  assetExists,
  assetsAbi,
  credentialsAbi,
  findTotal,
  identityAbi,
  permissionAbi,
  reputationAbi,
  type ReadClient,
} from "./civora";

export type ReadClientFull = Pick<PublicClient, "readContract" | "getBalance" | "getBlockNumber">;

export interface FullAsset {
  assetId: number;
  issuer: Address;
  holder: Address;
  assetType: number;
  principalWei: bigint;
  couponWei: bigint;
  targetHash: `0x${string}`;
  documentHash: `0x${string}`;
  maturity: bigint;
  underwriterId: number;
  monitorId: number;
  settlementAgentId: number;
  state: number;
}

export interface GrantRow {
  grantId: bigint;
  assetId: bigint;
  agentId: bigint;
  selector: `0x${string}`;
  maxValue: bigint;
  expiresAt: bigint;
  revoked: boolean;
  granter: Address;
}

export interface UnderwriteCredential {
  assetId: bigint;
  agentId: bigint;
  reportHash: `0x${string}`;
  decision: number;
  approvedPrincipalWei: bigint;
  approvedCouponWei: bigint;
  expiresAt: bigint;
  modelId: `0x${string}`;
  issuedAt: bigint;
}

export interface MonitorCredential {
  assetId: bigint;
  agentId: bigint;
  reportHash: `0x${string}`;
  outcome: number;
  penaltyBps: number;
  evidenceHash: `0x${string}`;
  observedAt: bigint;
  expiresAt: bigint;
  modelId: `0x${string}`;
  issuedAt: bigint;
}

export interface AgentDetail {
  agentId: number;
  name: string;
  agentType: number;
  wallet: Address;
  score: bigint;
  balance: bigint;
}

export interface DashboardData {
  agentCount: bigint;
  assetCount: bigint;
  assets: FullAsset[];
  grants: GrantRow[];
  underwrites: Map<number, UnderwriteCredential>;
  monitors: Map<number, MonitorCredential>;
  agentDetails: Map<number, AgentDetail>;
  settledCount: number;
  settledValueWei: bigint;
  escrowValueWei: bigint;
  escrowCount: number;
  haircutValueWei: bigint;
  missedCount: number;
  /** True when the registry exceeded the read cap and assets is not exhaustive. */
  assetsCapped: boolean;
}

const SETTLE_SELECTOR = toFunctionSelector("settle(uint256)") as `0x${string}`;

export async function fetchAllAssets(
  client: ReadClient,
  total: bigint,
  maxAssets = 256n,
): Promise<{ assets: FullAsset[]; capped: boolean }> {
  const capped = total > maxAssets;
  const toRead = capped ? maxAssets : total;
  const results = await Promise.all(
    Array.from({ length: Number(toRead) }, (_, i) =>
      client
        .readContract({
          address: ADDRESSES.assets,
          abi: assetsAbi,
          functionName: "assets",
          args: [BigInt(i + 1)],
        })
        .catch(() => null),
    ),
  );
  const out: FullAsset[] = [];
  for (let i = 0; i < results.length; i++) {
    const a = results[i];
    if (!a || a[0] === "0x0000000000000000000000000000000000000000") continue;
    const id = BigInt(i + 1);
    out.push({
      assetId: Number(id),
      issuer: a[0],
      holder: a[1],
      assetType: Number(a[2]),
      principalWei: a[3],
      couponWei: a[4],
      targetHash: a[5],
      documentHash: a[6],
      maturity: a[7],
      underwriterId: Number(a[8]),
      monitorId: Number(a[9]),
      settlementAgentId: Number(a[10]),
      state: Number(a[11]),
    });
  }
  return { assets: out, capped };
}

export function grantKey(assetId: number, agentId: number, selector: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "bytes4" }],
      [BigInt(assetId), BigInt(agentId), selector],
    ),
  );
}

async function fetchGrantsFor(client: ReadClient, assets: FullAsset[]): Promise<GrantRow[]> {
  const results = await Promise.all(
    assets.map(async (asset) => {
      try {
        const key = grantKey(asset.assetId, asset.settlementAgentId, SETTLE_SELECTOR);
        const grantId = await client.readContract({
          address: ADDRESSES.permissions,
          abi: permissionAbi,
          functionName: "grantIdOf",
          args: [key],
        });
        if (grantId === 0n) return null;
        const g = await client.readContract({
          address: ADDRESSES.permissions,
          abi: permissionAbi,
          functionName: "grants",
          args: [grantId],
        });
        return {
          grantId,
          assetId: g[0],
          agentId: g[1],
          selector: g[2],
          maxValue: g[3],
          expiresAt: g[4],
          revoked: g[5],
          granter: g[6],
        } as GrantRow;
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is GrantRow => r !== null);
}

async function fetchCredentialsFor(client: ReadClient, assets: FullAsset[]) {
  const underwrites = new Map<number, UnderwriteCredential>();
  const monitors = new Map<number, MonitorCredential>();
  const results = await Promise.all(
    assets.map(async (asset) => {
      try {
        const [hasUw, hasMon] = await Promise.all([
          client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "hasUnderwrite", args: [BigInt(asset.assetId)] }),
          client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "hasMonitor", args: [BigInt(asset.assetId)] }),
        ]);
        let uw: UnderwriteCredential | null = null;
        let mon: MonitorCredential | null = null;
        if (hasUw) {
          const u = await client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "underwrites", args: [BigInt(asset.assetId)] });
          uw = {
            assetId: u[0], agentId: u[1], reportHash: u[2], decision: Number(u[3]),
            approvedPrincipalWei: u[4], approvedCouponWei: u[5], expiresAt: u[6], modelId: u[7], issuedAt: u[8],
          };
        }
        if (hasMon) {
          const m = await client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "monitors", args: [BigInt(asset.assetId)] });
          mon = {
            assetId: m[0], agentId: m[1], reportHash: m[2], outcome: Number(m[3]),
            penaltyBps: Number(m[4]), evidenceHash: m[5], observedAt: m[6], expiresAt: m[7], modelId: m[8], issuedAt: m[9],
          };
        }
        return { assetId: asset.assetId, uw, mon };
      } catch {
        return null;
      }
    }),
  );
  for (const r of results) {
    if (!r) continue;
    if (r.uw) underwrites.set(r.assetId, r.uw);
    if (r.mon) monitors.set(r.assetId, r.mon);
  }
  return { underwrites, monitors };
}

async function fetchAgentDetails(client: ReadClientFull, agentIds: number[]): Promise<Map<number, AgentDetail>> {
  const map = new Map<number, AgentDetail>();
  for (const agentId of agentIds) {
    try {
      const [name, agentType, wallet, score] = await Promise.all([
        client.readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "nameOf", args: [BigInt(agentId)] }),
        client.readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "agentTypeOf", args: [BigInt(agentId)] }),
        client.readContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "walletOf", args: [BigInt(agentId)] }),
        client.readContract({ address: ADDRESSES.reputation, abi: reputationAbi, functionName: "score", args: [BigInt(agentId)] }),
      ]);
      const balance = await client.getBalance({ address: wallet });
      map.set(agentId, { agentId, name, agentType: Number(agentType), wallet, score, balance });
    } catch {
      /* skip agents that fail a read */
    }
  }
  return map;
}

export async function fetchDashboardData(client: ReadClientFull, agentIds: number[]): Promise<DashboardData> {
  const [countAgents, countAssets] = await Promise.all([
    findTotal(client, (id) => agentExists(client, id)),
    findTotal(client, (id) => assetExists(client, id)),
  ]);

  const { assets, capped } = await fetchAllAssets(client, countAssets).catch(() => ({ assets: [], capped: false }));
  const [grants, { underwrites, monitors }, agentDetails] = await Promise.all([
    fetchGrantsFor(client, assets),
    fetchCredentialsFor(client, assets),
    fetchAgentDetails(client, agentIds),
  ]);

  let settledCount = 0;
  let settledValueWei = 0n;
  let escrowValueWei = 0n;
  let escrowCount = 0;
  let haircutValueWei = 0n;
  let missedCount = 0;

  for (const asset of assets) {
    const total = asset.principalWei + asset.couponWei;
    if (asset.state === 5) {
      settledCount++;
      settledValueWei += asset.principalWei;
      const mon = monitors.get(asset.assetId);
      if (mon && mon.outcome === 2) {
        missedCount++;
        haircutValueWei += (asset.couponWei * BigInt(mon.penaltyBps)) / 10_000n;
      }
    } else if (asset.state === 2 || asset.state === 3 || asset.state === 4) {
      escrowCount++;
      escrowValueWei += total;
    }
  }


  return {
    agentCount: countAgents,
    assetCount: countAssets,
    assets,
    grants,
    underwrites,
    monitors,
    agentDetails,
    settledCount,
    settledValueWei,
    escrowValueWei,
    escrowCount,
    haircutValueWei,
    missedCount,
    assetsCapped: capped,
  };
}
