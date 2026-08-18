"use client";

export type EventKind = "agent" | "register" | "fund" | "underwrite" | "monitor" | "settle";

const GLYPH: Record<EventKind, string> = {
  agent: "A",
  register: "R",
  fund: "F",
  underwrite: "U",
  monitor: "M",
  settle: "S",
};

const TONE: Record<EventKind, string> = {
  agent: "border-border-strong text-text-secondary",
  register: "border-info/50 text-info",
  fund: "border-info/50 text-info",
  underwrite: "border-accent/50 text-accent",
  monitor: "border-accent/50 text-accent",
  settle: "border-success text-success",
};

export function EventIcon({ kind, current }: { kind: EventKind; current?: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
        current ? TONE.settle : TONE[kind]
      }`}
    >
      {GLYPH[kind]}
    </span>
  );
}
