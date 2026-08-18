"use client";

import { ASSET_STATE_NAMES } from "@/lib/civora";
import type { AssetDetail } from "@/lib/assets-page";

const TABS: { value: number; label: string }[] = [
  { value: 0, label: "All" },
  ...[1, 2, 3, 4, 5, 6].map((s) => ({
    value: s,
    label: ASSET_STATE_NAMES[s as 1 | 2 | 3 | 4 | 5 | 6] ?? `state ${s}`,
  })),
];

export function StateFilterTabs({
  details,
  value,
  onChange,
}: {
  details: AssetDetail[];
  value: number;
  onChange: (v: number) => void;
}) {
  const counts = new Map<number, number>();
  for (const d of details) counts.set(d.chain.state, (counts.get(d.chain.state) ?? 0) + 1);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {TABS.map((tab) => {
        const active = value === tab.value;
        const count = tab.value === 0 ? details.length : counts.get(tab.value) ?? 0;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              active
                ? "border-accent bg-accent-muted text-accent-strong"
                : "border-border bg-bg text-text-secondary hover:border-accent"
            }`}
          >
            {tab.label}
            <span className={active ? "text-accent" : "text-text-tertiary"}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
