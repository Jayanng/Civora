"use client";

import { AGENT_TYPE, AGENT_TYPE_NAMES } from "@/lib/civora";

const ROLES = [
  { type: AGENT_TYPE.Underwriter, duty: "Caps how much may settle" },
  { type: AGENT_TYPE.ComplianceMonitor, duty: "Recommends the penalty" },
  { type: AGENT_TYPE.Settlement, duty: "Releases the escrow" },
] as const;

export function RolePicker({
  value,
  onChange,
  existingTypes,
}: {
  value: 1 | 2 | 3;
  onChange: (t: 1 | 2 | 3) => void;
  existingTypes: number[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((role) => {
        const selected = value === role.type;
        const exists = existingTypes.includes(role.type);
        return (
          <button
            key={role.type}
            type="button"
            onClick={() => onChange(role.type)}
            aria-pressed={selected}
            className={`flex flex-col gap-0.5 border px-3 py-2 text-left transition-colors ${
              selected
                ? "border-accent bg-accent-muted"
                : "border-border-strong bg-bg hover:border-accent"
            }`}
          >
            <span className="flex items-center gap-2 font-grotesk text-sm font-medium text-text-primary">
              {AGENT_TYPE_NAMES[role.type]}
              {exists ? (
                <span className="rounded-sm bg-success-bg px-1 py-0.5 font-mono text-[10px] text-success">
                  created
                </span>
              ) : (
                <span className="rounded-sm bg-warning-bg px-1 py-0.5 font-mono text-[10px] text-warning">
                  needed
                </span>
              )}
            </span>
            <span className="font-mono text-[11px] text-text-secondary">{role.duty}</span>
          </button>
        );
      })}
    </div>
  );
}
