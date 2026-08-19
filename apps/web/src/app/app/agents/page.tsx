"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useSyncExternalStore } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { AGENT_TYPE, AGENT_TYPE_NAMES, ADDRESSES, ASSET_STATE_NAMES, factoryAbi } from "@/lib/civora";
import {
  decodeAgentCreatedFromReceipt,
  loadAgentIndex,
  persistAgent,
  subscribeAgentIndex,
  type IndexedAgent,
} from "@/lib/agents";
import { fetchAgentsPageData, type AgentPageDetail } from "@/lib/agents-page";
import { truncateHash } from "@/components/TxLink";
import { TxSuccessModal, type TxSuccessInfo } from "@/components/TxSuccessModal";
import { RoleCoverageMeter } from "@/components/agents/RoleCoverageMeter";
import { DutiesPanel } from "@/components/agents/DutiesPanel";
import { RolePicker } from "@/components/agents/RolePicker";
import { AgentProfileModal } from "@/components/agents/AgentProfileModal";

function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={`https://scan.botchain.ai/address/${address}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-accent hover:text-accent-hover"
    >
      {truncateHash(address)}
    </a>
  );
}

function StatusPill({ status }: { status: AgentPageDetail["status"] }) {
  const tone =
    status === "Active"
      ? "bg-success-bg text-success"
      : status === "Veteran"
        ? "bg-warning-bg text-warning"
        : "bg-surface text-text-secondary";
  return <span className={`rounded-sm px-1.5 py-0.5 text-xs ${tone}`}>{status}</span>;
}

function AgentRow({
  agent,
  detail,
  onOpenProfile,
}: {
  agent: IndexedAgent;
  detail: AgentPageDetail | undefined;
  onOpenProfile: () => void;
}) {
  const loading = !detail;
  const last = detail?.lastActivity;

  return (
    <>
      <tr className="border-t border-border hover:bg-surface/50">
        <td className="py-3 pr-2">
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="Open agent profile"
            className="flex h-6 w-6 items-center justify-center font-mono text-xs text-text-tertiary hover:text-accent"
          >
            ▸
          </button>
        </td>
        <td className="py-3 pr-4">
          <button
            type="button"
            onClick={onOpenProfile}
            className="text-left text-sm font-medium text-text-primary hover:text-accent"
          >
            {loading ? "…" : detail.name}
          </button>
        </td>
        <td className="py-3 pr-4 text-sm text-text-secondary">
          {loading ? "…" : AGENT_TYPE_NAMES[detail.agentType as 1 | 2 | 3] ?? "—"}
        </td>
        <td className="py-3 pr-4">
          <a
            href={`https://scan.botchain.ai/token/${ADDRESSES.identities}/instance/${agent.agentId}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-accent hover:text-accent-hover"
          >
            #{agent.agentId}
          </a>
        </td>
        <td className="py-3 pr-4">{detail?.wallet ? <AddressLink address={detail.wallet} /> : "…"}</td>
        <td className="py-3 pr-4 text-right font-mono text-xs text-text-primary">
          {loading ? "…" : `${formatEther(detail.balance)} BOT`}
        </td>
        <td className="py-3 pr-4 text-right font-mono text-xs text-text-primary">
          {loading ? "…" : detail.score.toString()}
        </td>
        <td className="py-3 pr-4 text-right font-mono text-xs text-text-primary">
          {loading ? "…" : `${formatEther(detail.earnedWei)} BOT`}
        </td>
        <td className="py-3 pr-4 text-right font-mono text-xs">
          {loading ? (
            "…"
          ) : detail.liveCount === 0 ? (
            <span className="text-text-tertiary">—</span>
          ) : detail.liveCount > 1 ? (
            <span className="text-warning" title="Assigned to multiple live assets">
              {detail.liveCount} live
            </span>
          ) : (
            <span className="text-text-secondary">1 live</span>
          )}
        </td>
        <td className="py-3 pr-4">{detail ? <StatusPill status={detail.status} /> : "…"}</td>
        <td className="py-3 pr-4 font-mono text-xs text-text-tertiary">
          {loading || !last ? (
            "—"
          ) : (
            <>
              #{last.assetId} · {ASSET_STATE_NAMES[last.state as keyof typeof ASSET_STATE_NAMES] ?? `state ${last.state}`}
            </>
          )}
        </td>
        <td className="py-3 text-right">
          <a
            href={`https://scan.botchain.ai/tx/${agent.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-accent hover:text-accent-hover"
          >
            {truncateHash(agent.txHash)}
          </a>
        </td>
      </tr>
    </>
  );
}

export default function AgentsPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const index = useSyncExternalStore((cb) => subscribeAgentIndex(cb, address), () => loadAgentIndex(address), () => loadAgentIndex(address));
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState<1 | 2 | 3>(AGENT_TYPE.Underwriter);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [txDone, setTxDone] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [successInfo, setSuccessInfo] = useState<TxSuccessInfo | null>(null);

  const { writeContractAsync } = useWriteContract();

  const agentIds = index.map((a) => a.agentId).join(",");
  const data = useQuery({
    queryKey: ["agents-page", "green", agentIds],
    queryFn: () => (publicClient ? fetchAgentsPageData(publicClient, index.map((a) => a.agentId)) : null),
    enabled: !!publicClient,
    refetchInterval: 15_000,
  });

  // Local index (instant at creation) unioned with query data (agents from other sessions) —
  // so coverage tags flip the moment a create tx lands, without waiting for the refetch.
  const existingTypes = useMemo(() => {
    const set = new Set<number>();
    for (const a of index) if (a.agentType) set.add(a.agentType);
    if (data.data) for (const d of data.data.details.values()) set.add(d.agentType);
    return [...set];
  }, [index, data.data]);

  const validName = useMemo(() => {
    const len = name.length;
    return len >= 3 && len <= 32;
  }, [name]);

  const create = async () => {
    setFormError(null);
    setTxDone(false);
    if (!validName) {
      setFormError("Name must be 3–32 characters.");
      return;
    }
    if (!publicClient) {
      setFormError("Public client not ready.");
      return;
    }
    setCreating(true);
    setTxHash(null);
    try {
      const hash = await writeContractAsync({
        address: ADDRESSES.factory,
        abi: factoryAbi,
        functionName: "createAgent",
        args: [agentType, name],
      });
      setTxHash(hash);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60_000,
      });
      if (receipt.status === "reverted") {
        setFormError("Transaction reverted on-chain.");
        return;
      }
      const decoded = decodeAgentCreatedFromReceipt(receipt);
      if (decoded) {
        persistAgent({ agentId: decoded.agentId, txHash: receipt.transactionHash, agentType: decoded.agentType }, address);
        queryClient.invalidateQueries({ queryKey: ["counts"] });
        queryClient.invalidateQueries({ queryKey: ["agents-page"] });
        setTxDone(true);
        setSuccessInfo({
          title: `${decoded.name} created`,
          note: "Minted the identity NFT, deployed its wallet, and bound them in one transaction — confirmed on-chain.",
          nextStep: "Next: create the remaining roles, then issue an asset and pick all three when registering.",
          rows: [
            { label: "Agent", value: `#${decoded.agentId}` },
            { label: "Name", value: decoded.name },
            { label: "Type", value: AGENT_TYPE_NAMES[decoded.agentType as 1 | 2 | 3] },
            { label: "Wallet", value: truncateHash(decoded.wallet) },
            { label: "Owner", value: truncateHash(decoded.owner) },
          ],
          txHashes: [{ label: "Create", hash: receipt.transactionHash }],
        });
      } else {
        setFormError("Confirmed but the AgentCreated event was not found.");
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Transaction failed.");
    } finally {
      setCreating(false);
    }
  };

  const statusText = txDone
    ? "Confirmed — agent registered."
    : creating && !txHash
      ? "Waiting for wallet approval…"
      : creating
        ? "Confirming on-chain…"
        : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="mt-1 font-mono text-xs text-text-secondary">
            Mint an identity NFT, deploy its wallet, and bind them in one transaction. Three roles run the loop.
          </p>
        </div>
        <div className="w-full max-w-md">
          <RoleCoverageMeter agentTypes={existingTypes} />
        </div>
      </header>

      <form
        className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-text-secondary">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder="Underwriter-01"
              className="h-10 w-56 rounded-none border border-border-strong bg-bg px-3 font-plex text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create Agent"}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-widest text-text-secondary">Type</span>
          <RolePicker value={agentType} onChange={setAgentType} existingTypes={existingTypes} />
        </div>
        <div className="flex flex-col gap-1">
          {formError ? <p className="break-all font-mono text-xs text-error">{formError}</p> : null}
          {statusText ? (
            <p className="font-mono text-xs text-text-secondary">
              {statusText} {txHash ? `${truncateHash(txHash)}` : ""}
            </p>
          ) : null}
        </div>
      </form>

      <DutiesPanel />

      <section className="rounded-md border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-text-secondary">
                <th className="w-8 py-2 pr-2" />
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Identity</th>
                <th className="py-2 pr-4 font-medium">Wallet</th>
                <th className="py-2 pr-4 text-right font-medium">Balance</th>
                <th className="py-2 pr-4 text-right font-medium">Reputation</th>
                <th className="py-2 pr-4 text-right font-medium">Earnings</th>
                <th className="py-2 pr-4 text-right font-medium">Load</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Last activity</th>
                <th className="py-2 text-right font-medium">Create tx</th>
              </tr>
            </thead>
            <tbody>
              {index.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center font-mono text-sm text-text-tertiary">
                    No agents yet. Create an Underwriter, a Compliance Monitor, and a Settlement agent — you&apos;ll pick them when issuing an asset.
                  </td>
                </tr>
              ) : (
                index.map((a) => (
                  <AgentRow
                    key={a.agentId}
                    agent={a}
                    detail={data.data?.details.get(a.agentId)}
                    onOpenProfile={() => setProfileId(a.agentId)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {index.length > 0 ? (
        <p className="font-mono text-xs text-text-tertiary">
          Controller wallet: {address}. Rows read live from AgentIdentity, Reputation, GreenAssetRegistry, and on-chain wallet balances — expand a row for its full ledger.
        </p>
      ) : null}

      {successInfo ? <TxSuccessModal info={successInfo} onClose={() => setSuccessInfo(null)} /> : null}

      {profileId !== null ? (() => {
        const agent = index.find((a) => a.agentId === profileId);
        const detail = data.data?.details.get(profileId);
        if (!agent || !detail) return null;
        return (
          <AgentProfileModal
            detail={detail}
            createTx={agent.txHash}
            onClose={() => setProfileId(null)}
          />
        );
      })() : null}
    </div>
  );
}
