"use client";

import { AGENT_TYPE, AGENT_TYPE_NAMES } from "@/lib/civora";

const ROLES = [
  { type: AGENT_TYPE.Underwriter, duty: "Caps how much may settle" },
  { type: AGENT_TYPE.ComplianceMonitor, duty: "Recommends the penalty" },
  { type: AGENT_TYPE.Settlement, duty: "Releases the escrow" },
] as const;

export function RoleCoverageMeter({ agentTypes }: { agentTypes: number[] }) {
  const present = new Set(agentTypes);
  const complete = ROLES.every((r) => present.has(r.type));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch gap-1">
        {ROLES.map((role) => {
          const has = present.has(role.type);
          return (
            <div
              key={role.type}
              className={`flex flex-1 flex-col gap-0.5 border px-3 py-2 ${
                has ? "border-accent bg-accent-muted" : "border-border-strong bg-bg"
              }`}
            >
              <span
                className={`font-mono text-[11px] uppercase tracking-widest ${
                  has ? "text-accent-strong" : "text-text-tertiary"
                }`}
              >
                {has ? "✓ " : "○ "}
                {AGENT_TYPE_NAMES[role.type]}
              </span>
              <span className="font-mono text-[11px] text-text-secondary">{role.duty}</span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-[11px] text-text-tertiary">
        {complete
          ? "Roster complete — you can pick all three roles when issuing an asset."
          : "Create each role once; you will pick them when registering an asset."}
      </p>
    </div>
  );
}
