"use client";

const DUTIES = [
  {
    role: "Underwriter",
    read: "Assesses the sustainability target and sets the settlement cap",
    write: "underwriteCommit — approve/reject, max principal & coupon",
  },
  {
    role: "Compliance Monitor",
    read: "Observes the target at maturity and recommends the penalty",
    write: "monitorCommit — target met/missed + penalty bps",
  },
  {
    role: "Settlement",
    read: "Holds the only grant that can release the escrow",
    write: "settle() — capped at principal + coupon, expires at maturity",
  },
] as const;

export function DutiesPanel() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {DUTIES.map((d) => (
        <div key={d.role} className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4">
          <span className="text-xs uppercase tracking-widest text-accent">{d.role}</span>
          <span className="font-plex text-sm text-text-primary">{d.read}</span>
          <span className="font-mono text-[11px] text-text-tertiary">{d.write}</span>
        </div>
      ))}
    </div>
  );
}
