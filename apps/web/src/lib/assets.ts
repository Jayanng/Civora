import { decodeEventLog } from "viem";
import type { TransactionReceipt } from "viem";
import { ADDRESSES, assetRegisteredItem, fundedItem, settledItem } from "./civora";

const INDEX_KEY = "civora.assets.v1";

export interface IndexedAsset {
  assetId: number;
  registerTx: `0x${string}`;
  fundTx?: `0x${string}`;
  underwriteTx?: `0x${string}`;
  underwriteReportHash?: `0x${string}`;
  monitorTx?: `0x${string}`;
  monitorReportHash?: `0x${string}`;
  settleTx?: `0x${string}`;
  /** The plain-text sustainability target entered at issue time (its hash is on-chain). */
  targetText?: string;
}

function readIndexFromStorage(): IndexedAsset[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is IndexedAsset =>
        typeof a === "object" && a !== null && typeof a.assetId === "number" && typeof a.registerTx === "string",
    );
  } catch {
    return [];
  }
}

let cachedIndex: IndexedAsset[] | null = null;

export function loadAssetIndex(): IndexedAsset[] {
  if (typeof window === "undefined") return [];
  if (cachedIndex === null) cachedIndex = readIndexFromStorage();
  return cachedIndex;
}

function invalidateIndex(): void {
  cachedIndex = null;
}

export function persistAsset(asset: IndexedAsset): void {
  if (typeof window === "undefined") return;
  const current = loadAssetIndex();
  const next = current.some((a) => a.assetId === asset.assetId)
    ? current.map((a) => (a.assetId === asset.assetId ? asset : a))
    : [...current, asset];
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(next));
  invalidateIndex();
  window.dispatchEvent(new Event("civora:assets-changed"));
}

export function subscribeAssetIndex(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    invalidateIndex();
    onChange();
  };
  window.addEventListener("civora:assets-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("civora:assets-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

export interface DecodedAssetRegistered {
  assetId: number;
  issuer: `0x${string}`;
  holder: `0x${string}`;
  assetType: number;
  principalWei: bigint;
  couponWei: bigint;
  targetHash: `0x${string}`;
  documentHash: `0x${string}`;
  maturity: bigint;
  underwriterId: bigint;
  monitorId: bigint;
  settlementAgentId: bigint;
}

export function decodeAssetRegisteredFromReceipt(receipt: TransactionReceipt): DecodedAssetRegistered | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ADDRESSES.assets.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [assetRegisteredItem],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "AssetRegistered") continue;
      const args = decoded.args;
      return {
        assetId: Number(args.assetId),
        issuer: args.issuer,
        holder: args.holder,
        assetType: Number(args.assetType),
        principalWei: args.principalWei,
        couponWei: args.couponWei,
        targetHash: args.targetHash,
        documentHash: args.documentHash,
        maturity: args.maturity,
        underwriterId: args.underwriterId,
        monitorId: args.monitorId,
        settlementAgentId: args.settlementAgentId,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export interface DecodedFunded {
  assetId: number;
  issuer: `0x${string}`;
  amount: bigint;
}

export function decodeFundedFromReceipt(receipt: TransactionReceipt): DecodedFunded | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ADDRESSES.vault.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [fundedItem],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Funded") continue;
      const args = decoded.args;
      return {
        assetId: Number(args.assetId),
        issuer: args.issuer,
        amount: args.amount,
      };
    } catch {
      continue;
    }
  }
  return null;
}

export interface DecodedSettled {
  assetId: number;
  holderPrincipal: bigint;
  holderCoupon: bigint;
  protocolAmt: bigint;
  uwAmt: bigint;
  monAmt: bigint;
  saAmt: bigint;
  haircutAmt: bigint;
  targetMet: boolean;
}

export function decodeSettledFromReceipt(receipt: TransactionReceipt): DecodedSettled | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ADDRESSES.vault.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [settledItem],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Settled") continue;
      const args = decoded.args;
      return {
        assetId: Number(args.assetId),
        holderPrincipal: args.holderPrincipal,
        holderCoupon: args.holderCoupon,
        protocolAmt: args.protocolAmt,
        uwAmt: args.uwAmt,
        monAmt: args.monAmt,
        saAmt: args.saAmt,
        haircutAmt: args.haircutAmt,
        targetMet: args.targetMet,
      };
    } catch {
      continue;
    }
  }
  return null;
}
