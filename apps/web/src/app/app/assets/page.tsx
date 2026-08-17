"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { formatEther, isAddress, keccak256, parseEther, toBytes } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import {
  ADDRESSES,
  ASSET_STATE_NAMES,
  ASSET_TYPE,
  ASSET_TYPE_NAMES,
  assetsAbi,
  civoraAbi,
  identityAbi,
  vaultAbi,
} from "@/lib/civora";
import {
  decodeAssetRegisteredFromReceipt,
  decodeSettledFromReceipt,
  loadAssetIndex,
  persistAsset,
  subscribeAssetIndex,
  type IndexedAsset,
} from "@/lib/assets";
import { loadAgentIndex, subscribeAgentIndex } from "@/lib/agents";
import { AiReportPanel } from "@/components/AiReportPanel";
import { SettlementBreakdown } from "@/components/SettlementBreakdown";
import { TxLink, truncateHash } from "@/components/TxLink";

interface UnderwriteReport {
  schema: string;
  decision: "approve" | "reject";
  approvedPrincipalWei: string;
  approvedCouponWei: string;
  expiresAt: number;
  riskScore: number;
  conditions: string[];
  reasoning: string;
  model: string;
}

interface MonitorReport {
  schema: string;
  outcome: "targetMet" | "targetMissed";
  penaltyBps: number;
  evidenceHash: `0x${string}`;
  observedAt: number;
  expiresAt: number;
  riskScore: number;
  findings: string[];
  reasoning: string;
  model: string;
}

interface AssetActionData {
  assetId: number;
  principalWei: string;
  couponWei: string;
  maturity: number;
  holder: `0x${string}`;
  issuer: `0x${string}`;
  targetHash: `0x${string}`;
  documentHash: `0x${string}`;
  underwriterId: number;
  monitorId: number;
  settlementAgentId: number;
}

function AgentOption({ agentId, requiredType }: { agentId: number; requiredType: 1 | 2 | 3 }) {
  const type = useReadContract({
    address: ADDRESSES.identities,
    abi: identityAbi,
    functionName: "agentTypeOf",
    args: [BigInt(agentId)],
  });
  if (type.data !== requiredType) return null;
  return <option value={agentId}>#{agentId}</option>;
}

function AssetRow({
  asset,
  onUnderwrite,
  onMonitor,
  onSettle,
}: {
  asset: IndexedAsset;
  onUnderwrite: (data: AssetActionData) => void;
  onMonitor: (data: AssetActionData) => void;
  onSettle: (assetId: number) => void;
}) {
  const chainAsset = useReadContract({
    address: ADDRESSES.assets,
    abi: assetsAbi,
    functionName: "assets",
    args: [BigInt(asset.assetId)],
  });
  const state = chainAsset.data ? Number(chainAsset.data[11]) : null;
  const stateName = state ? ASSET_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5 | 6] : null;
  const actionData = chainAsset.data
    ? {
        assetId: asset.assetId,
        principalWei: chainAsset.data[3].toString(),
        couponWei: chainAsset.data[4].toString(),
        maturity: Number(chainAsset.data[7]),
        holder: chainAsset.data[1],
        issuer: chainAsset.data[0],
        targetHash: chainAsset.data[5],
        documentHash: chainAsset.data[6],
        underwriterId: Number(chainAsset.data[8]),
        monitorId: Number(chainAsset.data[9]),
        settlementAgentId: Number(chainAsset.data[10]),
      }
    : null;

  return (
    <tr className="border-t border-border align-top">
      <td className="py-3 pr-4 font-mono text-xs">#{asset.assetId}</td>
      <td className="py-3 pr-4 text-xs">
        {chainAsset.data ? ASSET_TYPE_NAMES[Number(chainAsset.data[2]) as 1 | 2] : "…"}
      </td>
      <td className="py-3 pr-4 font-mono text-xs">
        {chainAsset.data ? `${formatEther(chainAsset.data[3] + chainAsset.data[4])} BOT` : "…"}
      </td>
      <td className="py-3 pr-4">
        {stateName ? (
          <span
            className={`rounded-sm px-1.5 py-0.5 font-mono text-xs ${
              state === 5 ? "bg-success-bg text-success" : state === 6 ? "bg-error-bg text-error" : "bg-info-bg text-info"
            }`}
          >
            {stateName}
          </span>
        ) : "…"}
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-text-secondary">
        {chainAsset.data ? truncateHash(chainAsset.data[5]) : "…"}
      </td>
      <td className="py-3 pr-4"><TxLink hash={asset.registerTx} /></td>
      <td className="py-3 pr-4">{asset.fundTx ? <TxLink hash={asset.fundTx} /> : "—"}</td>
      <td className="py-3 pr-4">
        {asset.underwriteTx ? <TxLink hash={asset.underwriteTx} /> : state === 2 && actionData ? (
          <button type="button" onClick={() => onUnderwrite(actionData)} className="border border-accent px-2 py-1 font-grotesk text-xs text-accent hover:bg-accent hover:text-text-on-accent">Underwrite</button>
        ) : "—"}
      </td>
      <td className="py-3 pr-4">
        {asset.monitorTx ? <TxLink hash={asset.monitorTx} /> : state === 3 && actionData ? (
          <button type="button" onClick={() => onMonitor(actionData)} className="border border-accent px-2 py-1 font-grotesk text-xs text-accent hover:bg-accent hover:text-text-on-accent">Monitor</button>
        ) : "—"}
      </td>
      <td className="py-3">
        {asset.settleTx ? <TxLink hash={asset.settleTx} /> : state === 4 ? (
          <button type="button" onClick={() => onSettle(asset.assetId)} className="border border-accent px-2 py-1 font-grotesk text-xs text-accent hover:bg-accent hover:text-text-on-accent">Settle</button>
        ) : state === 5 ? <span className="font-mono text-xs text-success">Settled</span> : "—"}
      </td>
    </tr>
  );
}

function AssetsPageContent() {
  const searchParams = useSearchParams();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const assetIndex = useSyncExternalStore(subscribeAssetIndex, loadAssetIndex, loadAssetIndex);
  const agentIndex = useSyncExternalStore(subscribeAgentIndex, loadAgentIndex, loadAgentIndex);
  const [nowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [formOpen, setFormOpen] = useState(() => searchParams.get("new") === "1");
  const [assetType, setAssetType] = useState<1 | 2>(ASSET_TYPE.SustainabilityLinkedBond);
  const [holder, setHolder] = useState("");
  const [principal, setPrincipal] = useState("0.04");
  const [coupon, setCoupon] = useState("0.01");
  const [maturity, setMaturity] = useState(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    date.setHours(12, 0, 0, 0);
    return date.toISOString().slice(0, 16);
  });
  const [targetText, setTargetText] = useState("Deliver the verified sustainability target before maturity.");
  const [documentHash, setDocumentHash] = useState<`0x${string}` | null>(null);
  const [underwriterId, setUnderwriterId] = useState("");
  const [monitorId, setMonitorId] = useState("");
  const [settlementAgentId, setSettlementAgentId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssetActionData | null>(null);
  const [underwriteReport, setUnderwriteReport] = useState<{ hash: `0x${string}`; report: UnderwriteReport } | null>(null);
  const [monitorReport, setMonitorReport] = useState<{ hash: `0x${string}`; report: MonitorReport } | null>(null);
  const [evidenceText, setEvidenceText] = useState("Telemetry evidence confirms the sustainability target status.");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<{
    assetId: number;
    holderPrincipal: bigint;
    holderCoupon: bigint;
    protocolAmt: bigint;
    uwAmt: bigint;
    monAmt: bigint;
    saAmt: bigint;
    haircutAmt: bigint;
    targetMet: boolean;
    txHash: `0x${string}`;
  } | null>(null);
  const [drainId, setDrainId] = useState(1);
  const [drainStatus, setDrainStatus] = useState<string | null>(null);
  const [drainHash, setDrainHash] = useState<`0x${string}` | null>(null);

  const minMaturity = new Date((nowTs + 60) * 1000).toISOString().slice(0, 16);

  const underwriters = useMemo(() => agentIndex, [agentIndex]);

  const registerAndFund = async () => {
    setFormError(null);
    setFormStatus(null);
    if (!publicClient || !address) return;
    if (!isAddress(holder)) return setFormError("Enter a valid holder address.");
    if (!documentHash) return setFormError("Select a document so its hash can be committed.");
    if (!targetText.trim()) return setFormError("Enter the sustainability target.");
    if (!underwriterId || !monitorId || !settlementAgentId) return setFormError("Select all three agents.");
    try {
      const principalWei = parseEther(principal);
      const couponWei = parseEther(coupon);
      const maturityTs = Math.floor(new Date(maturity).getTime() / 1000);
      if (principalWei <= 0n || couponWei <= 0n) return setFormError("Principal and coupon must be positive.");
      if (maturityTs <= nowTs) return setFormError("Maturity must be in the future.");
      setFormStatus("Waiting for registration approval…");
      const registerHash = await writeContractAsync({
        address: ADDRESSES.assets,
        abi: assetsAbi,
        functionName: "register",
        args: [holder, assetType, principalWei, couponWei, keccak256(toBytes(targetText.trim())), documentHash, BigInt(maturityTs), BigInt(underwriterId), BigInt(monitorId), BigInt(settlementAgentId)],
      });
      const registerReceipt = await publicClient.waitForTransactionReceipt({ hash: registerHash, timeout: 60_000 });
      const registered = decodeAssetRegisteredFromReceipt(registerReceipt);
      if (!registered) throw new Error("Registration confirmed without AssetRegistered event.");
      persistAsset({ assetId: registered.assetId, registerTx: registerReceipt.transactionHash });
      setFormStatus("Registration confirmed. Waiting for funding approval…");
      const fundHash = await writeContractAsync({
        address: ADDRESSES.vault,
        abi: vaultAbi,
        functionName: "fund",
        args: [BigInt(registered.assetId)],
        value: principalWei + couponWei,
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash, timeout: 60_000 });
      const current = loadAssetIndex().find((a) => a.assetId === registered.assetId);
      if (current) persistAsset({ ...current, fundTx: fundHash });
      queryClient.invalidateQueries({ queryKey: ["counts"] });
      setFormStatus(`Asset #${registered.assetId} funded with ${formatEther(principalWei + couponWei)} BOT.`);
      setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Asset registration failed.");
    }
  };

  const runUnderwrite = async (data: AssetActionData) => {
    setSelected(data);
    setUnderwriteReport(null);
    setMonitorReport(null);
    setActionError(null);
    setActionStatus("AI Underwriter is evaluating the asset…");
    try {
      const res = await fetch("/api/underwrite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        assetId: String(data.assetId), principalWei: data.principalWei, couponWei: data.couponWei, maturity: data.maturity,
        holder: data.holder, issuer: data.issuer, targetHash: data.targetHash, documentHash: data.documentHash, assetType,
      }) });
      const payload = (await res.json()) as { error?: string; reportHash?: `0x${string}`; report?: UnderwriteReport };
      if (!res.ok || !payload.reportHash || !payload.report) throw new Error(payload.error ?? "Underwrite failed.");
      setUnderwriteReport({ hash: payload.reportHash, report: payload.report });
      setActionStatus("Underwrite report ready. Review it, then commit the credential.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Underwrite failed.");
      setActionStatus(null);
    }
  };

  const commitUnderwrite = async () => {
    if (!publicClient || !selected || !underwriteReport) return;
    setActionError(null);
    setActionStatus("Waiting for underwrite commitment approval…");
    try {
      const modelId = keccak256(toBytes(underwriteReport.report.model));
      const hash = await writeContractAsync({
        address: ADDRESSES.civora,
        abi: civoraAbi,
        functionName: "underwriteCommit",
        args: [BigInt(selected.assetId), BigInt(selected.underwriterId), underwriteReport.hash, underwriteReport.report.decision === "approve" ? 1 : 2, BigInt(underwriteReport.report.approvedPrincipalWei), BigInt(underwriteReport.report.approvedCouponWei), BigInt(underwriteReport.report.expiresAt), modelId],
      });
      await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      const current = loadAssetIndex().find((a) => a.assetId === selected.assetId);
      if (current) persistAsset({ ...current, underwriteTx: hash, underwriteReportHash: underwriteReport.hash });
      setActionStatus("Underwrite committed on-chain. The asset can now be monitored.");
      queryClient.invalidateQueries({ queryKey: ["counts"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Underwrite commit failed.");
    }
  };

  const runMonitor = async (data: AssetActionData) => {
    setSelected(data);
    setMonitorReport(null);
    setActionError(null);
    setActionStatus("AI Compliance Monitor is evaluating the target…");
    try {
      const evidenceHash = keccak256(toBytes(evidenceText.trim()));
      const res = await fetch("/api/monitor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        assetId: String(data.assetId), principalWei: data.principalWei, couponWei: data.couponWei, targetHash: data.targetHash,
        documentHash: data.documentHash, evidenceHash, maturity: data.maturity,
      }) });
      const payload = (await res.json()) as { error?: string; reportHash?: `0x${string}`; report?: MonitorReport };
      if (!res.ok || !payload.reportHash || !payload.report) throw new Error(payload.error ?? "Monitor failed.");
      setMonitorReport({ hash: payload.reportHash, report: payload.report });
      setActionStatus("Monitor report ready. Review it, then commit the outcome.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Monitor failed.");
      setActionStatus(null);
    }
  };

  const commitMonitor = async () => {
    if (!publicClient || !selected || !monitorReport) return;
    setActionError(null);
    setActionStatus("Waiting for monitor commitment approval…");
    try {
      const modelId = keccak256(toBytes(monitorReport.report.model));
      const hash = await writeContractAsync({
        address: ADDRESSES.civora,
        abi: civoraAbi,
        functionName: "monitorCommit",
        args: [BigInt(selected.assetId), BigInt(selected.monitorId), monitorReport.hash, monitorReport.report.outcome === "targetMet" ? 1 : 2, monitorReport.report.penaltyBps, monitorReport.report.evidenceHash, BigInt(monitorReport.report.observedAt), BigInt(monitorReport.report.expiresAt), modelId],
      });
      await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      const current = loadAssetIndex().find((a) => a.assetId === selected.assetId);
      if (current) persistAsset({ ...current, monitorTx: hash, monitorReportHash: monitorReport.hash });
      setActionStatus("Monitor outcome committed on-chain. The asset can now settle.");
      queryClient.invalidateQueries({ queryKey: ["counts"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Monitor commit failed.");
    }
  };

  const settle = async (assetId: number) => {
    if (!publicClient) return;
    setActionError(null);
    setActionStatus("Waiting for settlement approval…");
    try {
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: vaultAbi, functionName: "settle", args: [BigInt(assetId)] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      const decoded = decodeSettledFromReceipt(receipt);
      const current = loadAssetIndex().find((a) => a.assetId === assetId);
      if (current) persistAsset({ ...current, settleTx: hash });
      if (!decoded) throw new Error("Settlement confirmed without Settled event.");
      setSettlement({ ...decoded, txHash: hash });
      setActionStatus("Settlement confirmed. Principal and coupon breakdown is below.");
      queryClient.invalidateQueries({ queryKey: ["counts"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Settlement failed.");
    }
  };

  const drain = async () => {
    setDrainStatus("Waiting for drain attempt approval…");
    setDrainHash(null);
    try {
      const hash = await writeContractAsync({ address: ADDRESSES.vault, abi: vaultAbi, functionName: "emergencyDrain", args: [BigInt(drainId)] });
      setDrainHash(hash);
      try { await publicClient?.waitForTransactionReceipt({ hash, timeout: 60_000 }); } catch { /* expected */ }
      setDrainStatus("Failed on-chain: PermissionDenied(). No funds moved.");
    } catch (error) {
      setDrainStatus(error instanceof Error ? error.message : "Drain attempt failed.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="mt-1 font-mono text-xs text-text-secondary">Sustainability-linked assets issued, monitored, and settled by Civora agents.</p>
        </div>
        <button type="button" onClick={() => setFormOpen((open) => !open)} className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">
          {formOpen ? "Close form" : "Issue Asset"}
        </button>
      </header>

      {formOpen ? (
        <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4">
          <h2 className="font-grotesk text-sm font-medium">Issue sustainability-linked asset</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Asset type
              <select value={assetType} onChange={(e) => setAssetType(Number(e.target.value) as 1 | 2)} className="h-10 border border-border-strong bg-bg px-3 text-sm text-text-primary">
                <option value={ASSET_TYPE.SustainabilityLinkedBond}>Sustainability-Linked Bond</option>
                <option value={ASSET_TYPE.GreenReceivable}>Green Receivable</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Holder address
              <input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="0x..." className="h-10 border border-border-strong bg-bg px-3 font-mono text-xs text-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Principal (BOT)
              <input value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" className="h-10 border border-border-strong bg-bg px-3 font-mono text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Coupon (BOT)
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} inputMode="decimal" className="h-10 border border-border-strong bg-bg px-3 font-mono text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Maturity
              <input type="datetime-local" value={maturity} min={minMaturity} onChange={(e) => setMaturity(e.target.value)} className="h-10 border border-border-strong bg-bg px-3 font-mono text-xs text-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Document hash input
              <input type="file" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setDocumentHash(keccak256(new Uint8Array(await file.arrayBuffer()))); }} className="h-10 border border-border-strong bg-bg px-3 py-2 text-xs text-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary md:col-span-2">Sustainability target
              <textarea value={targetText} onChange={(e) => setTargetText(e.target.value)} rows={2} className="border border-border-strong bg-bg px-3 py-2 text-sm text-text-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Underwriter
              <select value={underwriterId} onChange={(e) => setUnderwriterId(e.target.value)} className="h-10 border border-border-strong bg-bg px-3 text-sm text-text-primary"><option value="">Select agent</option>{underwriters.map((a) => <AgentOption key={`uw-${a.agentId}`} agentId={a.agentId} requiredType={1} />)}</select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Compliance Monitor
              <select value={monitorId} onChange={(e) => setMonitorId(e.target.value)} className="h-10 border border-border-strong bg-bg px-3 text-sm text-text-primary"><option value="">Select agent</option>{underwriters.map((a) => <AgentOption key={`mon-${a.agentId}`} agentId={a.agentId} requiredType={2} />)}</select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">Settlement
              <select value={settlementAgentId} onChange={(e) => setSettlementAgentId(e.target.value)} className="h-10 border border-border-strong bg-bg px-3 text-sm text-text-primary"><option value="">Select agent</option>{underwriters.map((a) => <AgentOption key={`sa-${a.agentId}`} agentId={a.agentId} requiredType={3} />)}</select>
            </label>
          </div>
          {formError ? <p className="break-all font-mono text-xs text-error">{formError}</p> : null}
          {formStatus ? <p className="font-mono text-xs text-text-secondary">{formStatus}</p> : null}
          <button type="button" onClick={() => void registerAndFund()} className="h-10 self-start bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">Register + fund asset</button>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="min-w-[1100px] w-full border-collapse text-left">
          <thead><tr className="text-xs text-text-secondary"><th className="px-4 py-3 font-medium">ID</th><th className="py-3 pr-4 font-medium">Type</th><th className="py-3 pr-4 font-medium">Escrow</th><th className="py-3 pr-4 font-medium">State</th><th className="py-3 pr-4 font-medium">Target</th><th className="py-3 pr-4 font-medium">Register</th><th className="py-3 pr-4 font-medium">Fund</th><th className="py-3 pr-4 font-medium">Underwrite</th><th className="py-3 pr-4 font-medium">Monitor</th><th className="py-3 font-medium">Settle</th></tr></thead>
          <tbody>
            {assetIndex.length === 0 ? <tr><td colSpan={10} className="py-10 text-center font-mono text-sm text-text-tertiary">No assets issued yet. Issue the first sustainability-linked asset above.</td></tr> : assetIndex.map((asset) => <AssetRow key={asset.assetId} asset={asset} onUnderwrite={(data) => void runUnderwrite(data)} onMonitor={(data) => void runMonitor(data)} onSettle={(id) => void settle(id)} />)}
          </tbody>
        </table>
      </section>

      {selected && underwriteReport ? <section className="flex flex-col gap-3"><AiReportPanel title={`Underwrite · asset #${selected.assetId}`} reportHash={underwriteReport.hash} report={underwriteReport.report as unknown as Record<string, unknown>} /><button type="button" onClick={() => void commitUnderwrite()} className="h-9 self-start bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">Commit underwrite</button></section> : null}
      {selected && !underwriteReport && selected ? <label className="flex flex-col gap-1 text-xs text-text-secondary">Monitor evidence note
        <textarea value={evidenceText} onChange={(e) => setEvidenceText(e.target.value)} rows={2} className="border border-border-strong bg-bg px-3 py-2 text-sm text-text-primary" />
      </label> : null}
      {selected && monitorReport ? <section className="flex flex-col gap-3"><AiReportPanel title={`Compliance monitor · asset #${selected.assetId}`} reportHash={monitorReport.hash} report={monitorReport.report as unknown as Record<string, unknown>} /><button type="button" onClick={() => void commitMonitor()} className="h-9 self-start bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">Commit monitor outcome</button></section> : null}
      {actionError ? <p className="break-all font-mono text-xs text-error">{actionError}</p> : null}
      {actionStatus ? <p className="font-mono text-xs text-text-secondary">{actionStatus}</p> : null}

      {settlement ? <><SettlementBreakdown principal={settlement.holderPrincipal} holderCoupon={settlement.holderCoupon} protocol={settlement.protocolAmt} underwriter={settlement.uwAmt} monitor={settlement.monAmt} settlement={settlement.saAmt} haircut={settlement.haircutAmt} targetMet={settlement.targetMet} /><p className="font-mono text-xs">Settlement tx: <TxLink hash={settlement.txHash} /></p></> : null}

      <section className="flex flex-col gap-3 rounded-md border border-error/40 bg-surface p-4">
        <div><h2 className="font-grotesk text-sm font-medium text-error">Security demo — drain attempt</h2><p className="mt-1 font-mono text-xs text-text-secondary">The settlement vault has no drain permission. The real transaction must fail with PermissionDenied().</p></div>
        <div className="flex flex-wrap items-center gap-3"><label htmlFor="drain-asset" className="font-mono text-xs text-text-secondary">Asset #</label><input id="drain-asset" type="number" min={1} value={drainId} onChange={(e) => setDrainId(Number(e.target.value))} className="h-8 w-20 border border-border bg-bg px-2 font-mono text-xs" /><button type="button" onClick={() => void drain()} className="h-8 border border-error px-3 font-grotesk text-xs text-error hover:bg-error hover:text-text-on-accent">Attempt drain</button></div>
        {drainStatus ? <p className="font-mono text-xs text-error">{drainStatus}</p> : null}
        {drainHash ? <p className="font-mono text-xs">Failed tx: <TxLink hash={drainHash} status="failed" /></p> : null}
      </section>
    </div>
  );
}

export default function AssetsPage() {
  return <Suspense fallback={<div className="py-10 text-center font-mono text-sm text-text-tertiary">…</div>}><AssetsPageContent /></Suspense>;
}
