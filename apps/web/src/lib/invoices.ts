import { decodeEventLog } from "viem";
import type { TransactionReceipt } from "viem";
import { ADDRESSES, invoiceRegisteredItem } from "./civora";

const INDEX_KEY = "civora.invoices.v1";

export interface IndexedInvoice {
  invoiceId: number;
  registerTx: `0x${string}`;
  fundTx?: `0x${string}`;
}

function readIndexFromStorage(): IndexedInvoice[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is IndexedInvoice =>
        typeof a === "object" &&
        a !== null &&
        typeof a.invoiceId === "number" &&
        typeof a.registerTx === "string",
    );
  } catch {
    return [];
  }
}

let cachedIndex: IndexedInvoice[] | null = null;

export function loadInvoiceIndex(): IndexedInvoice[] {
  if (typeof window === "undefined") return [];
  if (cachedIndex === null) cachedIndex = readIndexFromStorage();
  return cachedIndex;
}

function invalidateIndex(): void {
  cachedIndex = null;
}

export function persistInvoice(invoice: IndexedInvoice): void {
  if (typeof window === "undefined") return;
  const current = loadInvoiceIndex();
  const next = current.some((a) => a.invoiceId === invoice.invoiceId)
    ? current.map((a) => (a.invoiceId === invoice.invoiceId ? invoice : a))
    : [...current, invoice];
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(next));
  invalidateIndex();
  window.dispatchEvent(new Event("civora:invoices-changed"));
}

export function subscribeInvoiceIndex(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    invalidateIndex();
    onChange();
  };
  window.addEventListener("civora:invoices-changed", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("civora:invoices-changed", handler);
    window.removeEventListener("storage", handler);
  };
}

export interface DecodedInvoiceRegistered {
  invoiceId: number;
  payer: `0x${string}`;
  counterparty: `0x${string}`;
  amount: bigint;
  dueDate: bigint;
  documentHash: `0x${string}`;
  underwriterId: bigint;
  settlementAgentId: bigint;
}

export function decodeInvoiceRegisteredFromReceipt(
  receipt: TransactionReceipt,
): DecodedInvoiceRegistered | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ADDRESSES.invoices.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [invoiceRegisteredItem],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "InvoiceRegistered") continue;
      const args = decoded.args;
      return {
        invoiceId: Number(args.invoiceId),
        payer: args.payer,
        counterparty: args.counterparty,
        amount: args.amount,
        dueDate: args.dueDate,
        documentHash: args.documentHash,
        underwriterId: args.underwriterId,
        settlementAgentId: args.settlementAgentId,
      };
    } catch {
      continue;
    }
  }
  return null;
}