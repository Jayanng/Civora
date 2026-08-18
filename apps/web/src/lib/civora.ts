import { parseAbi, parseAbiItem, zeroAddress, type Address, type PublicClient } from "viem";

export type ReadClient = Pick<PublicClient, "readContract">;

// Primary green deployment (redeployed 2026-08-18 with the credential-expiry guard live)
export const ADDRESSES = {
  identities: "0x0FC05eE7AB442273c531f4ADC094B8A6dBD28322",
  factory: "0x341bdb60A1cfA089A90575957de6cB60f20Da1dC",
  credentials: "0x62466501D07b3c2a66e7766a62CEB8C2C158c7E4",
  permissions: "0x401CA8e374dBf345987A5488F4466537486E411d",
  assets: "0xaE0169D822121821dAA2dfC67A43F63e4f8d703C",
  reputation: "0x64a8c8267f35CA32cC1a5947097ff26AA123682e",
  vault: "0xD1cC42405b1Ce5E17f9C6a57973BD409E2F70608",
  civora: "0x1Ae2623FfB495a0211F44a061C94d44cb8f7fc3E",
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

