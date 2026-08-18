"use client";

import { useEffect, useState } from "react";
import { keccak256, toBytes } from "viem";
import { truncateHash } from "@/components/TxLink";

type Status = "checking" | "match" | "mismatch" | "missing";

/** Fetches the stored report, re-hashes it locally, and compares to the committed hash. */
export function ReportChip({ hash }: { hash: `0x${string}` }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;
    const run = async () => {
      setStatus("checking");
      try {
        const res = await fetch(`/api/reports/${hash}`);
        if (!res.ok) {
          if (active) setStatus("missing");
          return;
        }
        const raw = await res.text();
        if (active) setStatus(keccak256(toBytes(raw)) === hash ? "match" : "mismatch");
      } catch {
        if (active) setStatus("missing");
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [hash]);

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] ${
        status === "match"
          ? "text-success"
          : status === "mismatch"
            ? "text-error"
            : status === "missing"
              ? "text-warning"
              : "animate-pulse text-text-tertiary"
      }`}
    >
      <a href={`/api/reports/${hash}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
        {truncateHash(hash)}
      </a>
      {status === "match" ? "✓" : status === "mismatch" ? "✗" : status === "missing" ? "—" : "…"}
    </span>
  );
}
