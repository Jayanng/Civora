"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { botChain } from "@/lib/wagmi";

const emptySubscribe = () => () => {};

const FLOW = [
  { n: "1", t: "Register & fund", d: "An invoice is created and its value escrowed in the SettlementVault." },
  { n: "2", t: "AI underwrites", d: "A DeepSeek agent reads the document hash and issues a structured verdict." },
  { n: "3", t: "Attest on-chain", d: "The verdict is committed as an attestation — hash-locked to the report." },
  { n: "4", t: "Settle & split", d: "Payout 95/3/1/1, fees to treasury and agents, reputation grows." },
];

export default function Home() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const onBot = chainId === botChain.id;

  return (
    <main className="mx-auto flex min-h-full max-w-[860px] flex-col justify-center gap-10 px-6 py-16">
      <section className="flex flex-col gap-6">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
          BOT Chain · {botChain.id}
        </p>
        <h1 className="font-grotesk text-4xl font-semibold tracking-tight">
          Autonomous Agents. Real Assets. On-Chain Trust.
        </h1>
        <p className="max-w-xl text-text-secondary">
          Trust and settlement for Real-World Assets on BOT Chain. An AI agent underwrites every invoice, an
          on-chain permission engine guards every payout, and a vault settles the split — no human in the loop.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {mounted ? <ConnectButton showBalance={false} /> : null}
          {mounted && isConnected && !onBot ? (
            <button
              type="button"
              className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover"
              disabled={isPending}
              onClick={() => switchChain({ chainId: botChain.id })}
            >
              {isPending ? "Switching…" : "Switch to BOT Chain (677)"}
            </button>
          ) : null}
          {mounted && isConnected && onBot ? (
            <Link
              href="/app"
              className="inline-flex h-10 items-center rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover"
            >
              Launch App
            </Link>
          ) : null}
        </div>
        <p className="font-mono text-sm text-text-secondary">
          {!mounted
            ? "…"
            : isConnected
              ? onBot
                ? "Connected on BOT Chain (677)."
                : "Wrong network — switch to BOT Chain (677)."
              : "Connect a wallet to continue."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">
          The demo flow
        </h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FLOW.map((s) => (
            <li key={s.n} className="flex gap-3 rounded-md border border-border bg-surface p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-xs text-accent">
                {s.n}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-grotesk text-sm font-medium">{s.t}</p>
                <p className="text-xs text-text-secondary">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="font-mono text-xs text-text-secondary">
        {mounted && isConnected && onBot ? (
          <>
            Jump in: <Link className="text-accent hover:text-accent-hover" href="/app/invoices">invoices</Link>
            {" · "}
            <Link className="text-accent hover:text-accent-hover" href="/app/activity">activity log</Link>
            {" · "}
            <Link className="text-accent hover:text-accent-hover" href="/app/agents">agents</Link>
          </>
        ) : (
          "Connect above to open the app — you can try the drain attack yourself, it always reverts."
        )}
      </p>
    </main>
  );
}