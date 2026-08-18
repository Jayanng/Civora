import { toFunctionSelector, type PublicClient } from "viem";
import {
  ADDRESSES,
  assetsAbi,
  credentialsAbi,
  permissionAbi,
} from "./civora";
import { grantKey, type FullAsset, type GrantRow, type MonitorCredential, type UnderwriteCredential } from "./dashboard";

export type ReadClientFull = Pick<PublicClient, "readContract">;

export interface AssetDetail {
  chain: FullAsset;
  hasUnderwrite: boolean;
  underwrite: UnderwriteCredential | null;
  hasMonitor: boolean;
  monitor: MonitorCredential | null;
  grant: GrantRow | null;
}

const SETTLE_SELECTOR = toFunctionSelector("settle(uint256)") as `0x${string}`;

async function fetchAssetDetail(client: ReadClientFull, assetId: number): Promise<AssetDetail | null> {
  try {
    const raw = await client.readContract({
      address: ADDRESSES.assets,
      abi: assetsAbi,
      functionName: "assets",
      args: [BigInt(assetId)],
    });
    if (raw[0] === "0x0000000000000000000000000000000000000000") return null;
    const chain: FullAsset = {
      assetId,
      issuer: raw[0],
      holder: raw[1],
      assetType: Number(raw[2]),
      principalWei: raw[3],
      couponWei: raw[4],
      targetHash: raw[5],
      documentHash: raw[6],
      maturity: raw[7],
      underwriterId: Number(raw[8]),
      monitorId: Number(raw[9]),
      settlementAgentId: Number(raw[10]),
      state: Number(raw[11]),
    };

    const [hasUw, hasMon] = await Promise.all([
      client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "hasUnderwrite", args: [BigInt(assetId)] }),
      client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "hasMonitor", args: [BigInt(assetId)] }),
    ]);

    let underwrite: UnderwriteCredential | null = null;
    if (hasUw) {
      const u = await client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "underwrites", args: [BigInt(assetId)] });
      underwrite = {
        assetId: u[0], agentId: u[1], reportHash: u[2], decision: Number(u[3]),
        approvedPrincipalWei: u[4], approvedCouponWei: u[5], expiresAt: u[6], modelId: u[7], issuedAt: u[8],
      };
    }
    let monitor: MonitorCredential | null = null;
    if (hasMon) {
      const m = await client.readContract({ address: ADDRESSES.credentials, abi: credentialsAbi, functionName: "monitors", args: [BigInt(assetId)] });
      monitor = {
        assetId: m[0], agentId: m[1], reportHash: m[2], outcome: Number(m[3]),
        penaltyBps: Number(m[4]), evidenceHash: m[5], observedAt: m[6], expiresAt: m[7], modelId: m[8], issuedAt: m[9],
      };
    }

    let grant: GrantRow | null = null;
    try {
      const key = grantKey(assetId, chain.settlementAgentId, SETTLE_SELECTOR);
      const grantId = await client.readContract({ address: ADDRESSES.permissions, abi: permissionAbi, functionName: "grantIdOf", args: [key] });
      if (grantId !== 0n) {
        const g = await client.readContract({ address: ADDRESSES.permissions, abi: permissionAbi, functionName: "grants", args: [grantId] });
        grant = {
          grantId, assetId: g[0], agentId: g[1], selector: g[2],
          maxValue: g[3], expiresAt: g[4], revoked: g[5], granter: g[6],
        };
      }
    } catch {
      /* grant read is best-effort */
    }

    return { chain, hasUnderwrite: hasUw, underwrite, hasMonitor: hasMon, monitor, grant };
  } catch {
    return null;
  }
}

export async function fetchAssetDetails(client: ReadClientFull, assetIds: number[]): Promise<Map<number, AssetDetail>> {
  const results = await Promise.all(assetIds.map((id) => fetchAssetDetail(client, id)));
  const map = new Map<number, AssetDetail>();
  for (const r of results) {
    if (r) map.set(r.chain.assetId, r);
  }
  return map;
}
