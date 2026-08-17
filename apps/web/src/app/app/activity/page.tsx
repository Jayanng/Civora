"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatEther } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { ADDRESSES, attestationAbi, identityAbi, invoicesAbi } from "@/lib/civora";
import { loadAgentIndex, subscribeAgentIndex } from "@/lib/agents";
import {
  loadInvoiceIndex,
  subscribeInvoiceIndex,
  type IndexedInvoice,
} from "@/lib/invoices";
import { TxLink, truncateHash } from "@/components/TxLink";

interface TxTimes {
  [hash: string]: { ts: number | null; block: number | null };
}

function useTxTimes(hashes: `0x${string}`[]): TxTimes {
  const publicClient = usePublicClient();
  const [times, setTimes] = useState<TxTimes>({});
  const key = hashes.join(",");
  useEffect(() => {
    let active = true;
    const unique = Array.from(new Set(hashes));
    if (unique.length === 0 || !publicClient) return;
    Promise.all(
      unique.map(async (hash) => {
        try {
          const tx = await publicClient.getTransaction({ hash });
          if (!tx.blockNumber) return { hash, info: { ts: null, block: null } };
          const block = await publicClient.getBlock({ blockNumber: tx.blockNumber });
          return {
            hash,
            info: { ts: Number(block.timestamp) * 1000, block: Number(tx.blockNumber) },
          };
        } catch {
          return { hash, info: { ts: null, block: null } };
        }
      }),
    ).then((res) => {
      if (!active) return;
      setTimes(Object.fromEntries(res.map((r) => [r.hash, r.info])));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, publicClient]);
  return times;
}

function StepDot({ index }: { index: number }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
        index === 3 ? "border-success text-success" : "border-border-strong text-text-secondary"
      }`}
    >
      {index + 1}
    </span>
  );
}

function AgentCreatedEntry({ agentId, txHash }: { agentId: number; txHash: `0x${string}` }) {
  const type = useReadContract({
    address: ADDRESSES.identities,
    abi: identityAbi,
    functionName: "agentTypeOf",
    args: [BigInt(agentId)],
  });
  const times = useTxTimes([txHash]);
  const info = times[txHash];
  const kind = type.data === 1 ? "Underwriter" : type.data === 2 ? "Settlement" : "Agent";
  return (
    <li className="relative flex gap-3">
      <StepDot index={0} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
        <p className="font-grotesk text-xs font-medium">
          {kind} agent #{agentId} created
        </p>
        <p className="font-mono text-xs text-text-secondary">
          <TxLink hash={txHash} />
          {info?.ts ? (
            <span className="text-text-tertiary">
              {" "}
              · {new Date(info.ts).toLocaleString()} · block {info.block}
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}

function InvoiceTimeline({ invoice }: { invoice: IndexedInvoice }) {
  const inv = useReadContract({
    address: ADDRESSES.invoices,
    abi: invoicesAbi,
    functionName: "invoices",
    args: [BigInt(invoice.invoiceId)],
  });
  const att = useReadContract({
    address: ADDRESSES.attestations,
    abi: attestationAbi,
    functionName: "attestations",
    args: [BigInt(invoice.invoiceId)],
  });
  const hashes = useMemo<`0x${string}`[]>(
    () =>
      [invoice.registerTx, invoice.fundTx, invoice.attestTx, invoice.settleTx].filter(
        (h): h is `0x${string}` => Boolean(h),
      ),
    [invoice.registerTx, invoice.fundTx, invoice.attestTx, invoice.settleTx],
  );
  const times = useTxTimes(hashes);

  const amount = inv.data?.[2] ? formatEther(inv.data[2]) : null;
  const counterparty = inv.data?.[1] ?? null;
  const decision = att.data?.[3] !== undefined ? Number(att.data[3]) : null;
  const approved = att.data?.[4] !== undefined ? formatEther(att.data[4]) : null;

  const entries = [
    {
      key: "register",
      step: 0,
      tx: invoice.registerTx,
      label: `Invoice #${invoice.invoiceId} registered`,
      detail: amount
        ? `${amount} BOT · counterparty ${truncateHash(counterparty ?? "")}`
        : null,
    },
    invoice.fundTx
      ? {
          key: "fund",
          step: 1,
          tx: invoice.fundTx,
          label: `Invoice #${invoice.invoiceId} funded`,
          detail: amount ? `${amount} BOT escrowed in the SettlementVault` : null,
        }
      : null,
    invoice.attestTx
      ? {
          key: "attest",
          step: 2,
          tx: invoice.attestTx,
          label: `Invoice #${invoice.invoiceId} attested`,
          detail:
            decision === 1
              ? `Underwriter approved ${approved ?? "—"} BOT${invoice.reportHash ? ` · report ${truncateHash(invoice.reportHash)}` : ""}`
              : decision === 2
                ? "Underwriter rejected"
                : null,
        }
      : null,
    invoice.settleTx
      ? {
          key: "settle",
          step: 3,
          tx: invoice.settleTx,
          label: `Invoice #${invoice.invoiceId} settled`,
          detail: "95% payee · 3% protocol · 1% underwriter · 1% settlement agent",
        }
      : null,
  ].filter((e): e is NonNullable<typeof e> => Boolean(e));

  const sorted = [...entries].sort((a, b) => {
    const ta = times[a.tx]?.ts;
    const tb = times[b.tx]?.ts;
    if (ta === null || ta === undefined || tb === null || tb === undefined) return 0;
    return ta - tb;
  });

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((e) => {
        const info = times[e.tx];
        return (
          <li key={e.key} className="relative flex gap-3">
            <StepDot index={e.step} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-1">
              <p className="font-grotesk text-xs font-medium">{e.label}</p>
              {e.detail ? <p className="font-mono text-xs text-text-secondary">{e.detail}</p> : null}
              <p className="font-mono text-xs text-text-secondary">
                <TxLink hash={e.tx} />
                {info?.ts ? (
                  <span className="text-text-tertiary">
                    {" "}
                    · {new Date(info.ts).toLocaleString()} · block {info.block}
                  </span>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
      {invoice.reportHash ? (
        <li className="relative flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-[10px] text-accent">
            AI
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-1">
            <p className="font-grotesk text-xs font-medium">Underwrite report stored</p>
            <p className="font-mono text-xs text-text-secondary">
              <Link
                href={`/api/reports/${invoice.reportHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:text-accent-hover"
              >
                {truncateHash(invoice.reportHash)}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M1 9 9 1M3.5 1H9v5.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                </svg>
              </Link>
            </p>
          </div>
        </li>
      ) : null}
    </div>
  );
}

export default function ActivityPage() {
  const invoices = useSyncExternalStore(subscribeInvoiceIndex, loadInvoiceIndex, loadInvoiceIndex);
  const agents = useSyncExternalStore(subscribeAgentIndex, loadAgentIndex, loadAgentIndex);

  const hasAny = invoices.length > 0 || agents.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 font-mono text-xs text-text-secondary">
          Every Civora event, indexed from transaction receipts on BOT Chain 677.
        </p>
      </header>
      {!hasAny ? (
        <section className="rounded-md border border-border bg-surface">
          <p className="py-8 text-center font-mono text-sm text-text-tertiary">
            No events yet — register an invoice to start the timeline.
          </p>
        </section>
      ) : (
        <section className="rounded-md border border-border bg-surface p-4">
          <ul className="flex flex-col gap-4">
            {[...agents]
              .sort((a, b) => a.agentId - b.agentId)
              .map((a) => (
                <AgentCreatedEntry key={`agent-${a.agentId}`} agentId={a.agentId} txHash={a.txHash} />
              ))}
            {[...invoices]
              .sort((a, b) => a.invoiceId - b.invoiceId)
              .map((i) => (
                <InvoiceTimeline key={`invoice-${i.invoiceId}`} invoice={i} />
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}