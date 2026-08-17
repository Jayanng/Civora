"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useSyncExternalStore } from "react";
import { formatEther } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { AGENT_TYPE, AGENT_TYPE_NAMES, ADDRESSES, factoryAbi, identityAbi, reputationAbi } from "@/lib/civora";
import {
  decodeAgentCreatedFromReceipt,
  loadAgentIndex,
  persistAgent,
  subscribeAgentIndex,
  type IndexedAgent,
} from "@/lib/agents";
import { truncateHash } from "@/components/TxLink";

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

function AgentRow({ agentId, txHash }: IndexedAgent) {
  const name = useReadContract({
    address: ADDRESSES.identities,
    abi: identityAbi,
    functionName: "nameOf",
    args: [BigInt(agentId)],
  });
  const agentType = useReadContract({
    address: ADDRESSES.identities,
    abi: identityAbi,
    functionName: "agentTypeOf",
    args: [BigInt(agentId)],
  });
  const wallet = useReadContract({
    address: ADDRESSES.identities,
    abi: identityAbi,
    functionName: "walletOf",
    args: [BigInt(agentId)],
  });
  const score = useReadContract({
    address: ADDRESSES.reputation,
    abi: reputationAbi,
    functionName: "score",
    args: [BigInt(agentId)],
  });
  const balance = useBalance({ address: wallet.data, query: { enabled: !!wallet.data } });

  const loading = name.isLoading || agentType.isLoading || wallet.isLoading || score.isLoading;

  return (
    <tr className="border-t border-border">
      <td className="py-3 pr-4 text-sm font-medium text-text-primary">
        {loading ? "…" : name.data ?? "—"}
      </td>
      <td className="py-3 pr-4 text-sm text-text-secondary">
        {agentType.data ? AGENT_TYPE_NAMES[agentType.data as 1 | 2 | 3] ?? "—" : "…"}
      </td>
      <td className="py-3 pr-4">
        <a
          href={`https://scan.botchain.ai/token/${ADDRESSES.identities}/instance/${agentId}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-accent hover:text-accent-hover"
        >
          #{agentId}
        </a>
      </td>
      <td className="py-3 pr-4">{wallet.data ? <AddressLink address={wallet.data} /> : "…"}</td>
      <td className="py-3 pr-4 font-mono text-xs text-text-primary">
        {balance.isLoading ? "…" : balance.data ? `${formatEther(balance.data.value)} BOT` : "—"}
      </td>
      <td className="py-3 pr-4 font-mono text-xs text-text-primary">
        {score.isLoading ? "…" : (score.data ?? 0n).toString()}
      </td>
      <td className="py-3">
        <span className="rounded-sm bg-success-bg px-1.5 py-0.5 text-xs text-success">Active</span>
      </td>
      <td className="py-3 text-right">
        <a
          href={`https://scan.botchain.ai/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-accent hover:text-accent-hover"
        >
          {truncateHash(txHash)}
        </a>
      </td>
    </tr>
  );
}

export default function AgentsPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const index = useSyncExternalStore(subscribeAgentIndex, loadAgentIndex, loadAgentIndex);
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState<1 | 2 | 3>(AGENT_TYPE.Underwriter);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [txDone, setTxDone] = useState(false);

  const { writeContractAsync } = useWriteContract();

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
        persistAgent({ agentId: decoded.agentId, txHash: receipt.transactionHash });
        queryClient.invalidateQueries({ queryKey: ["counts"] });
        setTxDone(true);
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
      <header>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="mt-1 font-mono text-xs text-text-secondary">
          One transaction mints the identity NFT, deploys the agent wallet, and binds them.
        </p>
      </header>

      <form
        className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
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
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-widest text-text-secondary">Type</span>
            <select
              value={agentType}
              onChange={(e) => setAgentType(Number(e.target.value) as 1 | 2 | 3)}
              className="h-10 rounded-none border border-border-strong bg-bg px-3 font-plex text-sm text-text-primary focus:border-accent focus:outline-none"
            >
              <option value={AGENT_TYPE.Underwriter}>Underwriter</option>
              <option value={AGENT_TYPE.ComplianceMonitor}>Compliance Monitor</option>
              <option value={AGENT_TYPE.Settlement}>Settlement</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={creating}
            className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create Agent"}
          </button>
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

      <section className="rounded-md border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-text-secondary">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Identity</th>
                <th className="py-2 pr-4 font-medium">Wallet</th>
                <th className="py-2 pr-4 font-medium">Balance</th>
                <th className="py-2 pr-4 font-medium">Reputation</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Create tx</th>
              </tr>
            </thead>
            <tbody>
              {index.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center font-mono text-sm text-text-tertiary">
                    No agents yet — create an Underwriter and a Settlement agent to start.
                  </td>
                </tr>
              ) : (
                index.map((a) => <AgentRow key={a.agentId} agentId={a.agentId} txHash={a.txHash} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      {index.length > 0 ? (
        <p className="font-mono text-xs text-text-tertiary">
          Controller wallet: {address}. Rows read live from AgentIdentity, Reputation, and wallet
          balances.
        </p>
      ) : null}
    </div>
  );
}
