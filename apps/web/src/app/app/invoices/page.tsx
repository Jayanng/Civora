"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { formatEther, isAddress, keccak256, parseEther } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  AGENT_TYPE,
  INVOICE_STATE_NAMES,
  ADDRESSES,
  invoicesAbi,
  identityAbi,
  vaultAbi,
} from "@/lib/civora";
import { loadAgentIndex, subscribeAgentIndex } from "@/lib/agents";
import {
  decodeInvoiceRegisteredFromReceipt,
  loadInvoiceIndex,
  persistInvoice,
  subscribeInvoiceIndex,
  type IndexedInvoice,
} from "@/lib/invoices";
import { TxLink, truncateHash } from "@/components/TxLink";

function AgentOption({ agentId, requiredType }: { agentId: number; requiredType: 1 | 2 }) {
  const type = useReadContract({
    address: ADDRESSES.identities,
    abi: identityAbi,
    functionName: "agentTypeOf",
    args: [BigInt(agentId)],
  });
  if (type.data === undefined || type.data !== requiredType) return null;
  return <option value={agentId}>#{agentId}</option>;
}

function InvoiceRow({ invoiceId, registerTx, fundTx }: IndexedInvoice) {
  const inv = useReadContract({
    address: ADDRESSES.invoices,
    abi: invoicesAbi,
    functionName: "invoices",
    args: [BigInt(invoiceId)],
  });

  const state = inv.data ? (inv.data[5] as number) : null;
  const stateName = state ? INVOICE_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5] : null;

  return (
    <tr className="border-t border-border">
      <td className="py-3 pr-4 font-mono text-xs text-text-primary">#{invoiceId}</td>
      <td className="py-3 pr-4 font-mono text-xs text-text-primary">
        {inv.data ? `${formatEther(inv.data[2])} BOT` : "…"}
      </td>
      <td className="py-3 pr-4">
        {stateName ? (
          <span
            className={`rounded-sm px-1.5 py-0.5 text-xs ${
              state === 4
                ? "bg-success-bg text-success"
                : state === 1
                  ? "bg-warning-bg text-warning"
                  : "bg-info-bg text-info"
            }`}
          >
            {stateName}
          </span>
        ) : (
          "…"
        )}
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-text-primary">
        {inv.data ? truncateHash(inv.data[4]) : "…"}
      </td>
      <td className="py-3 pr-4">
        <TxLink hash={registerTx} />
      </td>
      <td className="py-3">
        {fundTx ? <TxLink hash={fundTx} /> : <span className="font-mono text-xs text-text-tertiary">—</span>}
      </td>
    </tr>
  );
}

function InvoicesContent() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const params = useSearchParams();

  const invoiceIndex = useSyncExternalStore(subscribeInvoiceIndex, loadInvoiceIndex, loadInvoiceIndex);
  const agentIndex = useSyncExternalStore(subscribeAgentIndex, loadAgentIndex, loadAgentIndex);

  const [showForm, setShowForm] = useState(() => params.get("new") === "1");
  const [step, setStep] = useState<"details" | "agents" | "review" | "registered" | "funded">("details");

  const [amount, setAmount] = useState("0.05");
  const [dueDate, setDueDate] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [docHash, setDocHash] = useState<`0x${string}` | "">("");
  const [docName, setDocName] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [underwriterId, setUnderwriterId] = useState<number | null>(null);
  const [settlementAgentId, setSettlementAgentId] = useState<number | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [working, setWorking] = useState<"register" | "fund" | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<{
    invoiceId: number;
    amountWei: bigint;
  } | null>(null);

  const { writeContractAsync } = useWriteContract();
  const vaultBalance = useBalance({ address: ADDRESSES.vault });

  const underwriters = useMemo(
    () => agentIndex.filter((a) => a.agentId !== settlementAgentId),
    [agentIndex, settlementAgentId],
  );
  const settlers = useMemo(
    () => agentIndex.filter((a) => a.agentId !== underwriterId),
    [agentIndex, underwriterId],
  );

  const detailsValid = useMemo(() => {
    if (!amount || parseEther(amount) <= 0n) return false;
    if (!dueDate) return false;
    if (!counterparty || !isAddress(counterparty)) return false;
    if (!docHash) return false;
    return true;
  }, [amount, dueDate, counterparty, docHash]);

  const dueTs = useMemo(() => {
    if (!dueDate) return 0n;
    const [y, m, d] = dueDate.split("-").map(Number);
    return BigInt(Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000));
  }, [dueDate]);

  const onFile = async (file: File | null) => {
    setDocError(null);
    if (!file) {
      setDocHash("");
      setDocName(null);
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const hash = keccak256(new Uint8Array(buf));
      setDocHash(hash);
      setDocName(file.name);
    } catch {
      setDocError("Could not hash the file.");
      setDocHash("");
      setDocName(null);
    }
  };

  const register = async () => {
    setFormError(null);
    if (!publicClient) return;
    if (!detailsValid || !underwriterId || !settlementAgentId || !docHash) return;
    if (!address || counterparty.toLowerCase() === address.toLowerCase()) {
      setFormError("Counterparty must be a different address than your wallet.");
      return;
    }
    const amountWei = parseEther(amount);
    setWorking("register");
    setTxHash(null);
    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.invoices,
        abi: invoicesAbi,
        functionName: "register",
        args: [counterparty as `0x${string}`, amountWei, dueTs, docHash, BigInt(underwriterId), BigInt(settlementAgentId)],
      });
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status === "reverted") {
        setFormError("Transaction reverted on-chain.");
        return;
      }
      const decoded = decodeInvoiceRegisteredFromReceipt(receipt);
      if (!decoded) {
        setFormError("Confirmed but the InvoiceRegistered event was not found.");
        return;
      }
      persistInvoice({ invoiceId: decoded.invoiceId, registerTx: receipt.transactionHash });
      queryClient.invalidateQueries({ queryKey: ["counts"] });
      setActiveInvoice({ invoiceId: decoded.invoiceId, amountWei });
      setStep("registered");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Register failed.");
    } finally {
      setWorking(null);
    }
  };

  const fund = async () => {
    setFormError(null);
    if (!publicClient || !activeInvoice) return;
    setWorking("fund");
    setTxHash(null);
    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.vault,
        abi: vaultAbi,
        functionName: "fund",
        args: [BigInt(activeInvoice.invoiceId)],
        value: activeInvoice.amountWei,
      });
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status === "reverted") {
        setFormError("Transaction reverted on-chain.");
        return;
      }
      const current = loadInvoiceIndex().find((i) => i.invoiceId === activeInvoice.invoiceId);
      if (current) {
        persistInvoice({ ...current, fundTx: receipt.transactionHash });
      }
      setStep("funded");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Fund failed.");
    } finally {
      setWorking(null);
    }
  };

  const workingText = working
    ? working === "register"
      ? "Registering invoice…"
      : "Funding invoice…"
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 font-mono text-xs text-text-secondary">
            Register a real invoice, fund it with exact BOT, and let the Underwriter decide.
          </p>
        </div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover"
          >
            Register Invoice
          </button>
        ) : null}
      </header>

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          {step === "details" || step === "agents" || step === "review" ? (
            <>
              {step === "details" ? (
                <div className="flex flex-col gap-3">
                  <h2 className="font-grotesk text-sm font-medium">1 · Invoice details</h2>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-text-secondary">Amount (BOT)</span>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.05"
                        className="h-10 w-32 rounded-none border border-border-strong bg-bg px-3 font-plex text-sm text-text-primary focus:border-accent focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-text-secondary">Due date</span>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-10 rounded-none border border-border-strong bg-bg px-3 font-plex text-sm text-text-primary focus:border-accent focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-text-secondary">Counterparty (payee)</span>
                      <input
                        value={counterparty}
                        onChange={(e) => setCounterparty(e.target.value)}
                        placeholder="0x…"
                        className="h-10 w-72 rounded-none border border-border-strong bg-bg px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-widest text-text-secondary">Document (keccak256 hash)</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex h-10 cursor-pointer items-center rounded-none border border-border-strong bg-bg px-3 font-plex text-sm text-text-secondary hover:bg-surface">
                        {docName ?? "Choose file"}
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <span className="font-mono text-xs text-text-tertiary">or</span>
                      <input
                        value={docHash}
                        onChange={(e) => {
                          setDocHash(e.target.value as `0x${string}`);
                          setDocName(null);
                        }}
                        placeholder="0x… (64 hex chars)"
                        className="h-10 w-96 rounded-none border border-border-strong bg-bg px-3 font-mono text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                      />
                    </div>
                    {docError ? <p className="font-mono text-xs text-error">{docError}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!detailsValid}
                      onClick={() => setStep("agents")}
                      className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="h-10 rounded-none border border-border-strong px-4 font-grotesk text-sm text-text-secondary hover:bg-bg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {step === "agents" ? (
                <div className="flex flex-col gap-3">
                  <h2 className="font-grotesk text-sm font-medium">2 · Pick your agents</h2>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-text-secondary">Underwriter</span>
                      <select
                        value={underwriterId ?? ""}
                        onChange={(e) => setUnderwriterId(e.target.value ? Number(e.target.value) : null)}
                        className="h-10 rounded-none border border-border-strong bg-bg px-3 font-plex text-sm text-text-primary focus:border-accent focus:outline-none"
                      >
                        <option value="">Select…</option>
                        {underwriters.map((a) => (
                          <AgentOption key={a.agentId} agentId={a.agentId} requiredType={AGENT_TYPE.Underwriter} />
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-text-secondary">Settlement</span>
                      <select
                        value={settlementAgentId ?? ""}
                        onChange={(e) => setSettlementAgentId(e.target.value ? Number(e.target.value) : null)}
                        className="h-10 rounded-none border border-border-strong bg-bg px-3 font-plex text-sm text-text-primary focus:border-accent focus:outline-none"
                      >
                        <option value="">Select…</option>
                        {settlers.map((a) => (
                          <AgentOption key={a.agentId} agentId={a.agentId} requiredType={AGENT_TYPE.Settlement} />
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!underwriterId || !settlementAgentId}
                      onClick={() => setStep("review")}
                      className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("details")}
                      className="h-10 rounded-none border border-border-strong px-4 font-grotesk text-sm text-text-secondary hover:bg-bg"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : null}

              {step === "review" ? (
                <div className="flex flex-col gap-3">
                  <h2 className="font-grotesk text-sm font-medium">3 · Review + register</h2>
                  <dl className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-2">
                    <div className="flex justify-between gap-4 border-b border-border pb-1">
                      <dt className="text-text-secondary">Amount</dt>
                      <dd className="text-text-primary">{amount} BOT</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-1">
                      <dt className="text-text-secondary">Due</dt>
                      <dd className="text-text-primary">{dueDate}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-1">
                      <dt className="text-text-secondary">Counterparty</dt>
                      <dd className="text-text-primary">{truncateHash(counterparty)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-1">
                      <dt className="text-text-secondary">Document hash</dt>
                      <dd className="text-text-primary">{truncateHash(docHash, 10, 6)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-1">
                      <dt className="text-text-secondary">Underwriter</dt>
                      <dd className="text-text-primary">#{underwriterId}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-1">
                      <dt className="text-text-secondary">Settlement</dt>
                      <dd className="text-text-primary">#{settlementAgentId}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={working !== null}
                      onClick={() => void register()}
                      className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
                    >
                      {working === "register" ? "Registering…" : "Register Invoice"}
                    </button>
                    <button
                      type="button"
                      disabled={working !== null}
                      onClick={() => setStep("agents")}
                      className="h-10 rounded-none border border-border-strong px-4 font-grotesk text-sm text-text-secondary hover:bg-bg"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {step === "registered" && activeInvoice ? (
            <div className="flex flex-col gap-3">
              <h2 className="font-grotesk text-sm font-medium">4 · Invoice #{activeInvoice.invoiceId} registered</h2>
              <p className="font-mono text-xs text-text-secondary">
                Now fund it with exactly {formatEther(activeInvoice.amountWei)} BOT. The vault only
                accepts the exact amount.
              </p>
              {txHash ? (
                <p className="font-mono text-xs">
                  Register tx: <TxLink hash={txHash} />
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={working !== null}
                  onClick={() => void fund()}
                  className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
                >
                  {working === "fund" ? "Funding…" : `Fund ${formatEther(activeInvoice.amountWei)} BOT`}
                </button>
              </div>
            </div>
          ) : null}

          {step === "funded" && activeInvoice ? (
            <div className="flex flex-col gap-3">
              <h2 className="font-grotesk text-sm font-medium">Invoice #{activeInvoice.invoiceId} is funded</h2>
              <p className="font-mono text-xs text-text-secondary">
                The vault now holds {formatEther(activeInvoice.amountWei)} BOT locked to this invoice.
                The Underwriter decides next.
              </p>
              <div className="flex flex-col gap-1 font-mono text-xs">
                {txHash ? (
                  <p>
                    Fund tx: <TxLink hash={txHash} />
                  </p>
                ) : null}
                <p>
                  Vault balance:{" "}
                  {vaultBalance.isLoading ? "…" : `${formatEther(vaultBalance.data?.value ?? 0n)} BOT`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setStep("details");
                    setActiveInvoice(null);
                    setTxHash(null);
                  }}
                  className="h-10 rounded-none border border-border-strong px-4 font-grotesk text-sm text-text-secondary hover:bg-bg"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}

          {formError ? <p className="break-all font-mono text-xs text-error">{formError}</p> : null}
          {workingText ? <p className="font-mono text-xs text-text-secondary">{workingText}</p> : null}
        </div>
      ) : null}

      <section className="rounded-md border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-text-secondary">
                <th className="py-2 pr-4 font-medium">Invoice</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 pr-4 font-medium">Document</th>
                <th className="py-2 pr-4 font-medium">Register tx</th>
                <th className="py-2 font-medium">Fund tx</th>
              </tr>
            </thead>
            <tbody>
              {invoiceIndex.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-mono text-sm text-text-tertiary">
                    No invoices registered yet.
                  </td>
                </tr>
              ) : (
                invoiceIndex.map((i) => <InvoiceRow key={i.invoiceId} invoiceId={i.invoiceId} registerTx={i.registerTx} fundTx={i.fundTx} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={null}>
      <InvoicesContent />
    </Suspense>
  );
}