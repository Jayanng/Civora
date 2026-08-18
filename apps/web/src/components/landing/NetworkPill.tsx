"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

/** Live network status: latest block height + how far behind the RPC clock is. */
export function NetworkPill() {
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<{ block: bigint; behindSec: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (!publicClient) return;
      try {
        const block = await publicClient.getBlockNumber();
        const head = await publicClient.getBlock({ blockNumber: block });
        const behindSec = Math.max(0, Math.round(Date.now() / 1000 - Number(head.timestamp)));
        if (alive) setStatus({ block, behindSec });
      } catch {
        /* keep last known status */
      }
    };
    void poll();
    const t = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [publicClient]);

  const synced = status !== null && status.behindSec < 30;

  return (
    <p className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-[10px] text-text-secondary">
      <span className={`h-1.5 w-1.5 rounded-full ${status === null ? "animate-pulse bg-warning" : synced ? "bg-success" : "bg-error"}`} />
      {status === null ? "Contacting BOT Chain…" : <>BOT Chain 677 · block {status.block.toString()} · {status.behindSec}s</>}
    </p>
  );
}
