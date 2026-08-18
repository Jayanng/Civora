"use client";

import { useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import {
  ADDRESSES,
  AGENT_TYPE_NAMES,
  ASSET_STATE_NAMES,
  assetsAbi,
  identityAbi,
} from "@/lib/civora";

interface FeedLine {
  id: number;
  ts: string;
  text: string;
  kind: "event" | "transition" | "tick";
}

interface Snapshot {
  agents: Map<number, number>; // agentId -> type
  assets: Map<number, number>; // assetId -> state
}

const MAX_LINES = 40;
const CAP = 40; // scan cap for the demo registry

function ts(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

/** Live on-chain activity: polls BOT Chain and prints real registered/funded/underwritten/settled events. */
export function TerminalFeed() {
  const publicClient = usePublicClient();
  const [lines, setLines] = useState<FeedLine[]>([]);
  const prevRef = useRef<Snapshot>({ agents: new Map(), assets: new Map() });
  const idRef = useRef(0);
  const firstRef = useRef(true);

  useEffect(() => {
    if (!publicClient) return;
    let alive = true;

    const push = (text: string, kind: FeedLine["kind"]) => {
      if (!alive) return;
      setLines((prev) => [{ id: idRef.current++, ts: ts(), text, kind }, ...prev].slice(0, MAX_LINES));
    };

    const poll = async () => {
      try {
        const agents = new Map<number, number>();
        const assets = new Map<number, number>();
        const block = await publicClient.getBlockNumber();

        // scan the registries (capped)
        let n = 1;
        for (;;) {
          const exists = await publicClient.readContract({
            address: ADDRESSES.identities,
            abi: identityAbi,
            functionName: "exists",
            args: [BigInt(n)],
          });
          if (!exists) break;
          const type = await publicClient.readContract({
            address: ADDRESSES.identities,
            abi: identityAbi,
            functionName: "agentTypeOf",
            args: [BigInt(n)],
          });
          agents.set(n, Number(type));
          if (++n > CAP) break;
        }
        n = 1;
        for (;;) {
          const asset = await publicClient.readContract({
            address: ADDRESSES.assets,
            abi: assetsAbi,
            functionName: "assets",
            args: [BigInt(n)],
          });
          if (asset[0] === "0x0000000000000000000000000000000000000000") break;
          assets.set(n, Number(asset[11]));
          if (++n > CAP) break;
        }

        const prev = prevRef.current;

        if (firstRef.current) {
          // Seed: current state as a readable log
          push(`connected — BOT Chain 677 · block ${block.toString()}`, "tick");
          for (const [id, type] of agents) {
            push(`agent #${id} created · ${AGENT_TYPE_NAMES[type as 1 | 2 | 3] ?? "Agent"}`, "event");
          }
          for (const [id, state] of assets) {
            push(`asset #${id} → ${ASSET_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5 | 6] ?? "Unknown"}`, "event");
          }
          firstRef.current = false;
        } else {
          // Diff: emit transitions since last poll
          for (const [id, type] of agents) {
            if (!prev.agents.has(id)) {
              push(`agent #${id} created · ${AGENT_TYPE_NAMES[type as 1 | 2 | 3] ?? "Agent"}`, "event");
            }
          }
          for (const [id, state] of assets) {
            const old = prev.assets.get(id);
            if (old === undefined) {
              push(`asset #${id} registered → ${ASSET_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5 | 6] ?? "Unknown"}`, "event");
            } else if (old !== state) {
              push(
                `asset #${id} ${ASSET_STATE_NAMES[old as 1 | 2 | 3 | 4 | 5 | 6] ?? "?"} → ${ASSET_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5 | 6] ?? "?"}`,
                "transition",
              );
            }
          }
        }

        prevRef.current = { agents, assets };
      } catch {
        /* transient RPC failure — skip this tick */
      }
    };

    void poll();
    const t = setInterval(poll, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [publicClient]);

  return (
    <div className="overflow-hidden rounded-md border border-dark-border bg-dark-panel">
      <div className="flex items-center justify-between gap-3 border-b border-dark-border px-4 py-2">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-dark-text-secondary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live chain feed
        </p>
        <p className="font-mono text-[10px] text-dark-text-secondary">BOT Chain 677 · polls every 8s</p>
      </div>
      <div className="max-h-56 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-dark-text-secondary">Scanning the registry…</p>
        ) : (
          lines.map((line) => (
            <p key={line.id} className="flex gap-2">
              <span className="shrink-0 text-dark-text-secondary">[{line.ts}]</span>
              <span className={line.kind === "transition" ? "text-success" : line.kind === "tick" ? "text-accent" : "text-dark-text"}>
                {line.text}
              </span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}
