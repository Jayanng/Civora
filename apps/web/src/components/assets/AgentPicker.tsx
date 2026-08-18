"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { ADDRESSES, identityAbi } from "@/lib/civora";
import type { IndexedAgent } from "@/lib/agents";

function AgentCard({ agentId, selected, onSelect }: { agentId: number; selected: boolean; onSelect: () => void }) {
  const name = useReadContract({ address: ADDRESSES.identities, abi: identityAbi, functionName: "nameOf", args: [BigInt(agentId)] });
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col gap-0.5 border px-2.5 py-1.5 text-left transition-colors ${
        selected ? "border-accent bg-accent-muted" : "border-border bg-bg hover:border-accent"
      }`}
    >
      <span className="font-plex text-xs text-text-primary">{name.data ?? `#${agentId}`}</span>
      <span className="font-mono text-[10px] text-text-tertiary">#{agentId} · created</span>
    </button>
  );
}

export function AgentPicker({
  roleLabel,
  agents,
  types,
  roleType,
  value,
  onChange,
}: {
  roleLabel: string;
  agents: IndexedAgent[];
  types: Map<number, number>;
  roleType: 1 | 2 | 3;
  value: string;
  onChange: (v: string) => void;
}) {
  const matches = agents.filter((a) => types.get(a.agentId) === roleType);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs text-text-secondary">
        {roleLabel}
        {matches.length === 0 ? (
          <Link href="/app/agents" className="font-mono text-[11px] text-accent hover:text-accent-hover">
            create one →
          </Link>
        ) : null}
      </span>
      {matches.length === 0 ? (
        <p className="border border-dashed border-border bg-bg px-3 py-2 font-mono text-[11px] text-text-tertiary">
          No {roleLabel.toLowerCase()} created yet — head to Agents.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((a) => (
            <AgentCard
              key={`${roleType}-${a.agentId}`}
              agentId={a.agentId}
              selected={value === String(a.agentId)}
              onSelect={() => onChange(String(a.agentId))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
