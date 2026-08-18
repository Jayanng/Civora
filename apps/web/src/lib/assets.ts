import { decodeEventLog } from "viem";
import type { TransactionReceipt } from "viem";
import { ADDRESSES, assetRegisteredItem, fundedItem, settledItem } from "./civora";

const INDEX_KEY = "civora.assets.v1";

const DEFAULT_ASSETS: IndexedAsset[] = [
  {
    assetId: 1,
    registerTx: "0xcafb3cd31e762f31e9ce7c6a42cd972f317bedd4634327c3e5b1d71d8a8f16fb",
    fundTx: "0xe5670cca0a6ee303b5cd9b138648c0da24add1bf9d0930edfe6727c58175e882",
    underwriteTx: "0xf24c19a294de89f272c43385084967c4f6e4f2c9f8cdf5f5728888a81c274a63",
    underwriteReportHash: "0x93a239c2ff979de6781c5286881118e7762f59f06e4079e1be20e793e40a931c",
    monitorTx: "0x0df4ada6a389ef31c6c8b313016b6e3af314693e12c1f2b076448c23ca88a6f8",
    monitorReportHash: "0x9513fa7bc0110a841ec90b199d08d9e67ff3fcbf26f66634b59807cf9d3730be",
    settleTx: "0xca0fd3b11ea39fa939a99ebd5f1bc3537aca57b8ffa96dfac341fe4c81adaab9",
  },
  {
    assetId: 3,
    registerTx: "0xb24a1473c4ee5f8c7edbf88b755262454890f106a02e19e9b800b07ad11ac235",
    fundTx: "0xb53128299a41f46bbb10394416b126d835f9a5e7728274d7e0e462279efd9c39",
    underwriteTx: "0x12a9e71ca4d6abda26e93d3318919d4b5b73ce40f0a87bc7e9796b09aa3343d4",
    underwriteReportHash: "0xd9e44251fae5c2f0abca8c702d1c5229e542dd2a36a7a38841f62c0404996b61",
    monitorTx: "0xd471c547261a501105ef28929c84954df4fbaa875e2785f7f73a37ebcda53ebf",
    monitorReportHash: "0xa1f3b8259e4ac608f19e91862794b300f4adaccd1fcabae5c0b8fa386c4d9157",
    settleTx: "0x887547b7fed1406d0a9fb9ccc956997415eaecf17876c4fad46d163575bb93d8",
  },
];

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
    if (!raw) return DEFAULT_ASSETS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const indexed = parsed.filter(
      (a): a is IndexedAsset =>
        typeof a === "object" && a !== null && typeof a.assetId === "number" && typeof a.registerTx === "string",
    );
    return [...DEFAULT_ASSETS.filter((demo) => !indexed.some((asset) => asset.assetId === demo.assetId)), ...indexed];
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
