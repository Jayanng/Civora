"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { formatEther, isAddress, keccak256, parseEther, toBytes } from "viem";
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
  attestationAbi,
  civoraAbi,
  invoicesAbi,
  identityAbi,
  vaultAbi,
} from "@/lib/civora";
import { loadAgentIndex, subscribeAgentIndex } from "@/lib/agents";
import {
  decodeAttestedFromReceipt,
  decodeInvoiceRegisteredFromReceipt,
  decodeSettledFromReceipt,
  loadInvoiceIndex,
  persistInvoice,
  subscribeInvoiceIndex,
  type IndexedInvoice,
} from "@/lib/invoices";
import { TxLink, truncateHash } from "@/components/TxLink";

interface UnderwriteReport {
  schema: string;
  decision: "approve" | "reject";
  approvedAmountWei: string;
  expiresAt: number;
  riskScore: number;
  conditions: string[];
  reasoning: string;
  model: string;
}

interface UnderwriteRowData {
  invoiceId: number;
  amountWei: string;
  dueDate: number;
  counterparty: `0x${string}`;
  documentHash: `0x${string}`;
  payer: `0x${string}`;
  underwriterId: number;
  settlementAgentId: number;
  reportHash?: `0x${string}`;
}

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

function InvoiceRow({
  invoiceId,
  registerTx,
  fundTx,
  attestTx,
  reportHash,
  settleTx,
  onUnderwrite,
  onSettle,
}: IndexedInvoice & {
  onUnderwrite: (data: UnderwriteRowData) => void;
  onSettle: (invoiceId: number) => void;
}) {
  const inv = useReadContract({
    address: ADDRESSES.invoices,
    abi: invoicesAbi,
    functionName: "invoices",
    args: [BigInt(invoiceId)],
  });
  const att = useReadContract({
    address: ADDRESSES.attestations,
    abi: attestationAbi,
    functionName: "attestations",
    args: [BigInt(invoiceId)],
  });

  const state = inv.data ? (inv.data[5] as number) : null;
  const stateName = state ? INVOICE_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5] : null;
  const hasAttestation = att.data && att.data[1] !== 0n;
  const attestedDecision = hasAttestation ? Number(att.data![3]) : null;

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
      <td className="py-3 pr-4">
        {fundTx ? <TxLink hash={fundTx} /> : <span className="font-mono text-xs text-text-tertiary">—</span>}
      </td>
      <td className="py-3">
        {attestTx ? (
          <TxLink hash={attestTx} />
        ) : state === 2 && inv.data && onUnderwrite ? (
          <button
            type="button"
            onClick={() =>
              onUnderwrite({
                invoiceId,
                amountWei: inv.data![2].toString(),
                dueDate: Number(inv.data![3]),
                counterparty: inv.data![1],
                documentHash: inv.data![4],
                payer: inv.data![0],
                underwriterId: Number(inv.data![6]),
                settlementAgentId: Number(inv.data![7]),
                reportHash,
              })
            }
            className="rounded-sm border border-accent px-2 py-1 font-grotesk text-xs font-medium text-accent hover:bg-accent hover:text-text-on-accent"
          >
            Underwrite
          </button>
        ) : hasAttestation && attestedDecision ? (
          <span
            className={`rounded-sm px-1.5 py-0.5 text-xs ${
              attestedDecision === 1 ? "bg-success-bg text-success" : "bg-error-bg text-error"
            }`}
          >
            {attestedDecision === 1 ? "APPROVED" : "REJECTED"}
          </span>
        ) : (
          <span className="font-mono text-xs text-text-tertiary">—</span>
        )}
      </td>
      <td className="py-3">
        {settleTx ? (
          <TxLink hash={settleTx} />
        ) : state === 3 && onSettle ? (
          <button
            type="button"
            onClick={() => onSettle(invoiceId)}
            className="rounded-sm border border-accent px-2 py-1 font-grotesk text-xs font-medium text-accent hover:bg-accent hover:text-text-on-accent"
          >
            Settle
          </button>
        ) : state === 4 ? (
          <span className="rounded-sm bg-success-bg px-1.5 py-0.5 text-xs text-success">SETTLED</span>
        ) : (
          <span className="font-mono text-xs text-text-tertiary">—</span>
        )}
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
  const [nowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [dueDate, setDueDate] = useState(() => {
    const t = new Date(Date.now() + 24 * 60 * 60 * 1000);
    t.setMinutes(0, 0, 0);
    t.setHours(12);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
  });
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

  const [uwInvoice, setUwInvoice] = useState<UnderwriteRowData | null>(null);
  const [uwReport, setUwReport] = useState<{ reportHash: `0x${string}`; report: UnderwriteReport } | null>(null);
  const [uwStatus, setUwStatus] = useState<"idle" | "running" | "ready" | "committing" | "done">("idle");
  const [uwError, setUwError] = useState<string | null>(null);

  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [settleResult, setSettleResult] = useState<{
    invoiceId: number;
    payeeAmt: bigint;
    protocolAmt: bigint;
    uwAmt: bigint;
    saAmt: bigint;
    refundAmt: bigint;
    txHash: `0x${string}`;
  } | null>(null);
  const [settleError, setSettleError] = useState<string | null>(null);

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

  const dueTs = useMemo(() => {
    if (!dueDate) return 0n;
    const ts = Math.floor(new Date(dueDate).getTime() / 1000);
    return Number.isFinite(ts) && ts > 0 ? BigInt(ts) : 0n;
  }, [dueDate]);

  const detailsValid = useMemo(() => {
    if (!amount || parseEther(amount) <= 0n) return false;
    if (!dueTs || dueTs <= BigInt(nowTs) + 60n) return false;
    if (!counterparty || !isAddress(counterparty)) return false;
    if (!docHash) return false;
    return true;
  }, [amount, dueTs, counterparty, docHash, nowTs]);

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

  const runUnderwrite = async (data: UnderwriteRowData) => {
    setUwError(null);
    setUwStatus("running");
    setUwInvoice(data);
    setUwReport(null);
    try {
      const res = await fetch("/api/underwrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoiceId: String(data.invoiceId),
          amountWei: data.amountWei,
          dueDate: data.dueDate,
          counterparty: data.counterparty,
          documentHash: data.documentHash,
          payer: data.payer,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `underwriter HTTP ${res.status}`);
      }
      const json = (await res.json()) as { reportHash: `0x${string}`; report: UnderwriteReport };
      setUwReport(json);
      setUwStatus("ready");
    } catch (e) {
      setUwError(e instanceof Error ? e.message : "Underwrite failed.");
      setUwStatus("idle");
    }
  };

  const commitUnderwrite = async () => {
    setUwError(null);
    if (!publicClient || !uwInvoice || !uwReport) return;
    setUwStatus("committing");
    try {
      const modelId = keccak256(toBytes(uwReport.report.model));
      const hash = await writeContractAsync({
        address: ADDRESSES.civora,
        abi: civoraAbi,
        functionName: "underwriteCommit",
        args: [
          BigInt(uwInvoice.invoiceId),
          BigInt(uwInvoice.underwriterId),
          uwReport.reportHash,
          uwReport.report.decision === "approve" ? 1 : 2,
          BigInt(uwReport.report.approvedAmountWei),
          BigInt(uwReport.report.expiresAt),
          modelId,
        ],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status === "reverted") {
        setUwError("Transaction reverted on-chain.");
        return;
      }
      const decoded = decodeAttestedFromReceipt(receipt);
      const current = loadInvoiceIndex().find((i) => i.invoiceId === uwInvoice.invoiceId);
      if (current) {
        persistInvoice({
          ...current,
          attestTx: receipt.transactionHash,
          reportHash: decoded?.reportHash ?? uwReport.reportHash,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["counts"] });
      setUwStatus("done");
    } catch (e) {
      setUwError(e instanceof Error ? e.message : "Commit failed.");
      setUwStatus("ready");
    }
  };

  const settle = async (invoiceId: number) => {
    setSettleError(null);
    if (!publicClient) return;
    setSettlingId(invoiceId);
    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.vault,
        abi: vaultAbi,
        functionName: "settle",
        args: [BigInt(invoiceId)],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status === "reverted") {
        setSettleError("Transaction reverted on-chain.");
        return;
      }
      const decoded = decodeSettledFromReceipt(receipt);
      const current = loadInvoiceIndex().find((i) => i.invoiceId === invoiceId);
      if (current) {
        persistInvoice({ ...current, settleTx: receipt.transactionHash });
      }
      if (decoded) {
        setSettleResult({ ...decoded, txHash: receipt.transactionHash });
      }
      queryClient.invalidateQueries({ queryKey: ["counts"] });
    } catch (e) {
      setSettleError(e instanceof Error ? e.message : "Settle failed.");
    } finally {
      setSettlingId(null);
    }
  };

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
                      <span className="text-xs uppercase tracking-widest text-text-secondary">Due date + time</span>
                      <input
                        type="datetime-local"
                        value={dueDate}
                        min={new Date((nowTs + 60) * 1000).toISOString().slice(0, 16)}
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
                      <dd className="text-text-primary">{dueDate} ({dueTs.toString()})</dd>
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
                <th className="py-2 pr-4 font-medium">Fund tx</th>
                <th className="py-2 pr-4 font-medium">Attestation</th>
                <th className="py-2 font-medium">Settlement</th>
              </tr>
            </thead>
            <tbody>
              {invoiceIndex.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-mono text-sm text-text-tertiary">
                    No invoices registered yet.
                  </td>
                </tr>
              ) : (
                invoiceIndex.map((i) => (
                  <InvoiceRow
                    key={i.invoiceId}
                    invoiceId={i.invoiceId}
                    registerTx={i.registerTx}
                    fundTx={i.fundTx}
                    attestTx={i.attestTx}
                    reportHash={i.reportHash}
                    settleTx={i.settleTx}
                    onUnderwrite={(data) => void runUnderwrite(data)}
                    onSettle={(id) => void settle(id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {settleError ? <p className="break-all font-mono text-xs text-error">{settleError}</p> : null}
      {settlingId !== null ? (
        <p className="font-mono text-xs text-text-secondary">Settling invoice #{settlingId}…</p>
      ) : null}
      {settleResult ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <h2 className="font-grotesk text-sm font-medium">Invoice #{settleResult.invoiceId} settled</h2>
          <div className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-4 border-b border-border pb-1">
              <dt className="text-text-secondary">Payee (95%)</dt>
              <dd className="text-text-primary">{formatEther(settleResult.payeeAmt)} BOT</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-1">
              <dt className="text-text-secondary">Protocol (3%)</dt>
              <dd className="text-text-primary">{formatEther(settleResult.protocolAmt)} BOT</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-1">
              <dt className="text-text-secondary">Underwriter (1%)</dt>
              <dd className="text-text-primary">{formatEther(settleResult.uwAmt)} BOT</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-1">
              <dt className="text-text-secondary">Settlement (1%)</dt>
              <dd className="text-text-primary">{formatEther(settleResult.saAmt)} BOT</dd>
            </div>
            {settleResult.refundAmt > 0n ? (
              <div className="flex justify-between gap-4 border-b border-border pb-1">
                <dt className="text-text-secondary">Refund to payer</dt>
                <dd className="text-text-primary">{formatEther(settleResult.refundAmt)} BOT</dd>
              </div>
            ) : null}
          </div>
          <p className="font-mono text-xs">
            Settle tx: <TxLink hash={settleResult.txHash} />
          </p>
          <p className="font-mono text-xs text-text-secondary">
            Agent wallets now hold their 1% cut — check the Agents page. Reputation: underwriter +1, settlement
            agent +2.
          </p>
          <div>
            <button
              type="button"
              onClick={() => setSettleResult(null)}
              className="h-8 rounded-none border border-border-strong px-3 font-grotesk text-xs text-text-secondary hover:bg-bg"
            >
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {uwInvoice ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-grotesk text-sm font-medium">Underwriting · invoice #{uwInvoice.invoiceId}</h2>
              <p className="mt-1 font-mono text-xs text-text-secondary">
                {uwInvoice.amountWei ? `${formatEther(BigInt(uwInvoice.amountWei))} BOT` : ""} · underwriter #
                {uwInvoice.underwriterId} · settlement #{uwInvoice.settlementAgentId}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUwInvoice(null);
                setUwReport(null);
                setUwStatus("idle");
                setUwError(null);
              }}
              className="h-8 rounded-none border border-border-strong px-3 font-grotesk text-xs text-text-secondary hover:bg-bg"
            >
              Close
            </button>
          </header>

          {uwStatus === "running" ? (
            <p className="font-mono text-xs text-text-secondary">Underwriter is reviewing the invoice…</p>
          ) : null}

          {uwError ? <p className="break-all font-mono text-xs text-error">{uwError}</p> : null}

          {uwStatus === "idle" && !uwReport ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void runUnderwrite(uwInvoice)}
                className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover"
              >
                Run AI Underwriter
              </button>
            </div>
          ) : null}

          {uwReport ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-sm px-2 py-1 text-xs font-medium ${
                    uwReport.report.decision === "approve"
                      ? "bg-success-bg text-success"
                      : "bg-error-bg text-error"
                  }`}
                >
                  {uwReport.report.decision === "approve" ? "APPROVE" : "REJECT"}
                </span>
                <span className="font-mono text-xs text-text-secondary">
                  risk {uwReport.report.riskScore}/100 · approved{" "}
                  {formatEther(BigInt(uwReport.report.approvedAmountWei))} BOT · expires{" "}
                  {new Date(uwReport.report.expiresAt * 1000).toLocaleString()} · {uwReport.report.model}
                </span>
              </div>
              <p className="font-plex text-sm text-text-primary">{uwReport.report.reasoning}</p>
              {uwReport.report.conditions.length > 0 ? (
                <ul className="flex list-disc flex-col gap-1 pl-5 font-mono text-xs text-text-secondary">
                  {uwReport.report.conditions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-text-secondary">
                <span>report {truncateHash(uwReport.reportHash, 10, 6)}</span>
                <a
                  href={`/api/reports/${uwReport.reportHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  fetch JSON
                </a>
              </div>
              {uwStatus === "ready" || uwStatus === "committing" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={uwStatus !== "ready"}
                    onClick={() => void commitUnderwrite()}
                    className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
                  >
                    {uwStatus === "committing" ? "Committing…" : "Commit attestation (1 tx)"}
                  </button>
                </div>
              ) : null}
              {uwStatus === "done" ? (
                <p className="font-mono text-xs text-text-secondary">
                  Attestation committed. Invoice is now <span className="text-success">Attested</span>.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
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