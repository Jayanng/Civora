"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { botChain } from "@/lib/wagmi";

const emptySubscribe = () => () => {};

export default function Home() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const onBot = chainId === botChain.id;

  return (
    <main className="mx-auto flex min-h-full max-w-[680px] flex-col justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
        BOT Chain · {botChain.id}
      </p>
      <h1 className="font-grotesk text-4xl font-semibold tracking-tight">
        Autonomous Agents. Real Assets. On-Chain Trust.
      </h1>
      <p className="max-w-xl text-text-secondary">
        Trust and settlement for Real-World Assets on BOT Chain. Invoices first.
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
    </main>
  );
}
