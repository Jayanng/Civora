import { parseAbi, parseAbiItem, zeroAddress, type Address, type PublicClient } from "viem";

export type ReadClient = Pick<PublicClient, "readContract">;

export const ADDRESSES = {
  identities: "0x5442B5c06d1D4c3165273465d62f04e2bA093d19",
  factory: "0xcAF2ADA8743b7f9DA0A96EBb6fB98F76F8810cd8",
  attestations: "0x5D68b1275cb7EB3d6b5b9c09A16241276E959F46",
  permissions: "0x88C8FB477A0685c198285bBcAC756B7F67629bc5",
  invoices: "0xB321a3FAAf9e7C5644f0db9a7753Ef4B9F51b03C",
  reputation: "0xE6b144Cb3B14Cb3deA46F9c5c910376C8467B8F9",
  vault: "0xA35ca76D1CB392CED9D08108083CF4e97371967B",
  civora: "0x33E800223ae882dfFA26871d283287E6A06DD7d9",
} as const satisfies Record<string, Address>;

export const AGENT_TYPE = {
  Underwriter: 1,
  Settlement: 2,
} as const;

export const AGENT_TYPE_NAMES = {
  1: "Underwriter",
  2: "Settlement",
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

export const invoicesAbi = parseAbi([
  "function register(address counterparty, uint256 amount, uint64 dueDate, bytes32 documentHash, uint256 underwriterId, uint256 settlementAgentId) external returns (uint256 invoiceId)",
  "function invoices(uint256 invoiceId) external view returns (address payer, address counterparty, uint256 amount, uint64 dueDate, bytes32 documentHash, uint8 state, uint256 underwriterId, uint256 settlementAgentId)",
]);

export const vaultAbi = parseAbi([
  "function fund(uint256 invoiceId) external payable",
  "function settle(uint256 invoiceId) external",
]);

export const civoraAbi = parseAbi([
  "function underwriteCommit(uint256 invoiceId, uint256 underwriterId, bytes32 reportHash, uint8 decision, uint256 approvedAmount, uint64 expiresAt, bytes32 modelId) external",
]);

export const attestationAbi = parseAbi([
  "function attestations(uint256 invoiceId) external view returns (uint256 invoiceId, uint256 agentId, bytes32 reportHash, uint8 decision, uint256 approvedAmount, uint64 expiresAt, bytes32 modelId, uint64 issuedAt)",
]);

export const DECISION = {
  Approve: 1,
  Reject: 2,
} as const;

export const agentCreatedItem = parseAbiItem(
  "event AgentCreated(uint256 indexed agentId, address indexed owner, uint8 agentType, address wallet, string name)",
);

export const invoiceRegisteredItem = parseAbiItem(
  "event InvoiceRegistered(uint256 indexed invoiceId, address indexed payer, address indexed counterparty, uint256 amount, uint64 dueDate, bytes32 documentHash, uint256 underwriterId, uint256 settlementAgentId)",
);

export const attestedItem = parseAbiItem(
  "event Attested(uint256 indexed invoiceId, uint256 indexed agentId, bytes32 reportHash, uint8 decision, uint256 approvedAmount, uint64 expiresAt, bytes32 modelId)",
);

export const settledItem = parseAbiItem(
  "event Settled(uint256 indexed invoiceId, uint256 payeeAmt, uint256 protocolAmt, uint256 uwAmt, uint256 saAmt, uint256 refundAmt)",
);

export const INVOICE_STATE_NAMES = {
  1: "Registered",
  2: "Funded",
  3: "Attested",
  4: "Settled",
  5: "Refunded",
} as const;

export type InvoiceStateValue = keyof typeof INVOICE_STATE_NAMES;

/**
 * Binary search for the first id where `isSet(id)` is false.
 * Assumes ids are sequential from 1 (registry `_nextId` pattern, no deletes).
 */
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

export function invoiceExists(client: ReadClient, invoiceId: bigint) {
  return client.readContract({
    address: ADDRESSES.invoices,
    abi: invoicesAbi,
    functionName: "invoices",
    args: [invoiceId],
  }).then((inv) => inv[0] !== zeroAddress);
}

export interface SettledStats {
  count: number;
  valueWei: bigint;
}

/**
 * Reads every invoice in [1..total] and sums the ones in Settled state.
 * Sequential eth_calls (official RPC bans getLogs; no counter views exist on-chain).
 */
export async function fetchSettledStats(
  client: ReadClient,
  total: bigint,
  maxInvoices = 256n,
): Promise<SettledStats> {
  if (total > maxInvoices) return { count: 0, valueWei: 0n };
  let count = 0;
  let valueWei = 0n;
  for (let id = 1n; id <= total; id++) {
    const inv = await client.readContract({
      address: ADDRESSES.invoices,
      abi: invoicesAbi,
      functionName: "invoices",
      args: [id],
    });
    if (inv[5] === 4) {
      count++;
      valueWei += inv[2];
    }
  }
  return { count, valueWei };
}