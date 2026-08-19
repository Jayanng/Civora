import { decodeEventLog } from "viem";
import type { TransactionReceipt } from "viem";
import { ADDRESSES, agentCreatedItem } from "./civora";

const LEGACY_INDEX_KEY = "civora.agents.v2";

/** Per-wallet key so switching wallets never shows another account's entities. */
function indexKeyFor(address?: string): string {
  return address ? `${LEGACY_INDEX_KEY}.${address.toLowerCase()}` : LEGACY_INDEX_KEY;
}

export interface IndexedAgent {
  agentId: number;
  txHash: `0x${string}`;
  /** 1 | 2 | 3 — persisted at creation so coverage indicators update instantly. */
  agentType?: number;
}

function readIndexFromStorage(key: string): IndexedAgent[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is IndexedAgent =>
        typeof a === "object" &&
        a !== null &&
        typeof a.agentId === "number" &&
        typeof a.txHash === "string",
    );
  } catch {
    return [];
  }
}

const cache = new Map<string, IndexedAgent[] | null>();

export function loadAgentIndex(address?: string): IndexedAgent[] {
  if (typeof window === "undefined") return [];
  const key = indexKeyFor(address);
  if (!cache.has(key)) cache.set(key, readIndexFromStorage(key));
  return cache.get(key) ?? [];
}

function invalidateIndex(address?: string): void {
  cache.delete(indexKeyFor(address));
}

export function persistAgent(agent: IndexedAgent, address?: string): void {
  if (typeof window === "undefined") return;
  const key = indexKeyFor(address);
  const current = loadAgentIndex(address);
  const next = current.some((a) => a.agentId === agent.agentId)
    ? current.map((a) => (a.agentId === agent.agentId ? agent : a))
    : [...current, agent];
  window.localStorage.setItem(key, JSON.stringify(next));
  invalidateIndex(address);
  window.dispatchEvent(new Event("civora:index-changed"));
}

export function subscribeAgentIndex(onChange: () => void, address?: string): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    invalidateIndex(address);
    onChange();
  };
  window.addEventListener("civora:index-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("civora:index-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

export interface DecodedAgentCreated {
  agentId: number;
  owner: `0x${string}`;
  agentType: number;
  wallet: `0x${string}`;
  name: string;
}

/**
 * Decodes the AgentCreated event from a createAgent tx receipt.
 * The receipt index is the client-side source of "which agents are mine"
 * (official RPC bans eth_getLogs, so there is no on-chain enumeration).
 */
export function decodeAgentCreatedFromReceipt(
  receipt: TransactionReceipt,
): DecodedAgentCreated | null {
  for (const log of receipt.logs) {
    // Compare against the primary factory; the legacy factory was retired with the green cutover.
    if (log.address.toLowerCase() !== ADDRESSES.factory.toLowerCase()) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: [agentCreatedItem],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "AgentCreated") continue;
      const args = decoded.args;
      return {
        agentId: Number(args.agentId),
        owner: args.owner,
        agentType: Number(args.agentType),
        wallet: args.wallet,
        name: args.name,
      };
    } catch {
      continue;
    }
  }
  return null;
}
