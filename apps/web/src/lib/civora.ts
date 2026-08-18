import { parseAbi, parseAbiItem, zeroAddress, type Address, type PublicClient } from "viem";

export type ReadClient = Pick<PublicClient, "readContract">;

export const ADDRESSES = {
  identities: "0x9D59Ad33e1BF4F85695245B7ab14F1E613Ff36D2",
  factory: "0xcd447F7eB818c4c9C88c89D4Ea73B6B3Ee207b30",
  credentials: "0x077C7700c8FAaa6B9b79edac356D52Ea42356Cd0",
  permissions: "0xbE063c28DC9ae7Aa3512c7Be4De24003d6B74b10",
  assets: "0x2b282A37C33903aa7846804f2eaEB0F6dE08FCe8",
  reputation: "0xD0b54BC0492af7c5D1A2C53120981B2c53647CBe",
  vault: "0xCd6B48E2E31970397d382ac1B9D148a3b3f87DF4",
  civora: "0x9Db3420Ce7AF793a0759B3b2DEd1C08D2CADE7a4",
} as const satisfies Record<string, Address>;

export const AGENT_TYPE = {
  Underwriter: 1,
  ComplianceMonitor: 2,
  Settlement: 3,
} as const;

export const AGENT_TYPE_NAMES = {
  1: "Underwriter",
  2: "Compliance Monitor",
  3: "Settlement",
} as const;

export const ASSET_TYPE = {
  SustainabilityLinkedBond: 1,
  GreenReceivable: 2,
} as const;

export const ASSET_TYPE_NAMES = {
  1: "Sustainability-Linked Bond",
  2: "Green Receivable",
} as const;

export const ASSET_STATE_NAMES = {
  1: "Registered",
  2: "Funded",
  3: "Underwritten",
  4: "Monitored",
  5: "Settled",
  6: "Refunded",
} as const;

export const DECISION = {
  Approve: 1,
  Reject: 2,
} as const;

export const MONITOR_OUTCOME = {
  TargetMet: 1,
  TargetMissed: 2,
} as const;

export const identityAbi = parseAbi([
  "function nameOf(uint256 agentId) external view returns (string)",
  "function agentTypeOf(uint256 agentId) external view returns (uint8)",
  "function walletOf(uint256 agentId) external view returns (address)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function exists(uint256 agentId) external view returns (bool)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
]);

export const factoryAbi = parseAbi([
  "function createAgent(uint8 agentType, string calldata name) external returns (uint256 agentId, address wallet)",
]);

export const reputationAbi = parseAbi([
  "function score(uint256 agentId) external view returns (uint256)",
]);

export const assetsAbi = parseAbi([
  "function register(address holder, uint8 assetType, uint256 principalWei, uint256 couponWei, bytes32 targetHash, bytes32 documentHash, uint64 maturity, uint256 underwriterId, uint256 monitorId, uint256 settlementAgentId) external returns (uint256 assetId)",
  "function assets(uint256 assetId) external view returns (address issuer, address holder, uint8 assetType, uint256 principalWei, uint256 couponWei, bytes32 targetHash, bytes32 documentHash, uint64 maturity, uint256 underwriterId, uint256 monitorId, uint256 settlementAgentId, uint8 state)",
]);

export const credentialsAbi = parseAbi([
  "function underwrites(uint256 assetId) external view returns (uint256 assetId, uint256 agentId, bytes32 reportHash, uint8 decision, uint256 approvedPrincipalWei, uint256 approvedCouponWei, uint64 expiresAt, bytes32 modelId, uint64 issuedAt)",
  "function monitors(uint256 assetId) external view returns (uint256 assetId, uint256 agentId, bytes32 reportHash, uint8 outcome, uint16 penaltyBps, bytes32 evidenceHash, uint64 observedAt, uint64 expiresAt, bytes32 modelId, uint64 issuedAt)",
  "function hasUnderwrite(uint256 assetId) external view returns (bool)",
  "function hasMonitor(uint256 assetId) external view returns (bool)",
]);

export const permissionAbi = parseAbi([
  "function grantIdOf(uint256 assetId, uint256 agentId, bytes4 selector) external view returns (uint256)",
  "function grants(uint256 grantId) external view returns (uint256 assetId, uint256 agentId, bytes4 selector, uint256 maxValue, uint64 expiresAt, bool revoked, address granter)",
]);

export const vaultAbi = parseAbi([
  "function fund(uint256 assetId) external payable",
  "function settle(uint256 assetId) external",
  "function refund(uint256 assetId) external",
  "function emergencyDrain(uint256 assetId) external",
  "error PermissionDenied()",
]);

export const civoraAbi = parseAbi([
  "function underwriteCommit(uint256 assetId, uint256 underwriterId, bytes32 reportHash, uint8 decision, uint256 approvedPrincipalWei, uint256 approvedCouponWei, uint64 expiresAt, bytes32 modelId) external",
  "function monitorCommit(uint256 assetId, uint256 monitorId, bytes32 reportHash, uint8 outcome, uint16 penaltyBps, bytes32 evidenceHash, uint64 observedAt, uint64 expiresAt, bytes32 modelId) external",
]);

export const assetRegisteredItem = parseAbiItem(
  "event AssetRegistered(uint256 indexed assetId, address indexed issuer, address indexed holder, uint8 assetType, uint256 principalWei, uint256 couponWei, bytes32 targetHash, bytes32 documentHash, uint64 maturity, uint256 underwriterId, uint256 monitorId, uint256 settlementAgentId)",
);

export const fundedItem = parseAbiItem(
  "event Funded(uint256 indexed assetId, address indexed issuer, uint256 amount)",
);

export const underwriteCredentialedItem = parseAbiItem(
  "event UnderwriteCredentialed(uint256 indexed assetId, uint256 indexed agentId, bytes32 reportHash, uint8 decision, uint256 approvedPrincipalWei, uint256 approvedCouponWei, uint64 expiresAt, bytes32 modelId)",
);

export const monitorCredentialedItem = parseAbiItem(
  "event MonitorCredentialed(uint256 indexed assetId, uint256 indexed agentId, bytes32 reportHash, uint8 outcome, uint16 penaltyBps, bytes32 evidenceHash, uint64 expiresAt, bytes32 modelId)",
);

export const settledItem = parseAbiItem(
  "event Settled(uint256 indexed assetId, uint256 holderPrincipal, uint256 holderCoupon, uint256 protocolAmt, uint256 uwAmt, uint256 monAmt, uint256 saAmt, uint256 haircutAmt, bool targetMet)",
);

export async function findTotal(
  client: ReadClient,
  isSet: (id: bigint) => Promise<boolean>,
  max = 1024n,
): Promise<bigint> {
  let lo = 0n;
  let hi = max + 1n;
  while (lo + 1n < hi) {
    const mid = (lo + hi) / 2n;
    const set = await isSet(mid);
    if (set) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function agentExists(client: ReadClient, agentId: bigint) {
  return client.readContract({
    address: ADDRESSES.identities,
    abi: identityAbi,
    functionName: "exists",
    args: [agentId],
  });
}

export function assetExists(client: ReadClient, assetId: bigint) {
  return client.readContract({
    address: ADDRESSES.assets,
    abi: assetsAbi,
    functionName: "assets",
    args: [assetId],
  }).then((a) => a[0] !== zeroAddress);
}

export interface SettledStats {
  count: number;
  valueWei: bigint;
  /** True when the registry exceeded the scan cap and the count is not exhaustive. */
  capped: boolean;
}

export async function fetchSettledStats(
  client: ReadClient,
  total: bigint,
  maxAssets = 256n,
): Promise<SettledStats> {
  if (total > maxAssets) return { count: 0, valueWei: 0n, capped: true };
  let count = 0;
  let valueWei = 0n;
  for (let id = 1n; id <= total; id++) {
    const asset = await client.readContract({
      address: ADDRESSES.assets,
      abi: assetsAbi,
      functionName: "assets",
      args: [id],
    });
    if (asset[11] === 5) {
      count++;
      valueWei += asset[3];
    }
  }
  return { count, valueWei, capped: false };
}

export const agentCreatedItem = parseAbiItem(
  "event AgentCreated(uint256 indexed agentId, address indexed owner, uint8 agentType, address wallet, string name)",
);

