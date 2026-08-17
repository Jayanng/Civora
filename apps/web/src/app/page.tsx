"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { botChain } from "@/lib/wagmi";

const emptySubscribe = () => () => {};

const FLOW = [
  { n: "1", title: "Issue asset", text: "Register a sustainability-linked bond or green receivable with a target and document hash." },
  { n: "2", title: "AI underwrites", text: "The Underwriter Agent caps the eligible principal and coupon in a hash-locked credential." },
  { n: "3", title: "AI monitors", text: "The Compliance Monitor evaluates target evidence and sets targetMet or targetMissed with penaltyBps." },
  { n: "4", title: "Settle or haircut", text: "Principal goes fully to the holder; missed targets haircut only the coupon on-chain." },
];

export default function Home() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const onBot = chainId === botChain.id;

  return (
    <main className="mx-auto flex min-h-full max-w-[900px] flex-col justify-center gap-10 px-6 py-16">
      <section className="flex flex-col gap-6">
        <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">BOT Chain · Mainnet 677 · AI × RWA</p>
        <h1 className="max-w-3xl font-grotesk text-4xl font-semibold tracking-tight">Autonomous Agents for Sustainability-Linked Real Assets.</h1>
        <p className="max-w-2xl text-text-secondary">Civora lets specialized AI agents underwrite green assets, monitor sustainability commitments, enforce permissions, and settle principal and coupon value on BOT Chain.</p>
        <div className="flex flex-wrap items-center gap-3">
          {mounted ? <ConnectButton showBalance={false} /> : null}
          {mounted && isConnected && !onBot ? <button type="button" disabled={isPending} onClick={() => switchChain({ chainId: botChain.id })} className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">{isPending ? "Switching…" : "Switch to BOT Chain (677)"}</button> : null}
          {mounted && isConnected && onBot ? <Link href="/app" className="inline-flex h-10 items-center rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">Launch App</Link> : null}
          <Link href="/demo" className="inline-flex h-10 items-center rounded-none border border-border-strong px-4 font-grotesk text-sm text-text-primary hover:bg-surface">See live proof</Link>
        </div>
        <p className="font-mono text-sm text-text-secondary">{!mounted ? "…" : isConnected ? onBot ? "Connected on BOT Chain (677)." : "Wrong network — switch to BOT Chain (677)." : "Connect a wallet to issue an asset."}</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">The Civora loop</h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FLOW.map((step) => <li key={step.n} className="flex gap-3 rounded-md border border-border bg-surface p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-xs text-accent">{step.n}</span><div><p className="font-grotesk text-sm font-medium">{step.title}</p><p className="mt-1 text-xs text-text-secondary">{step.text}</p></div></li>)}
        </ol>
      </section>
      <p className="font-mono text-xs text-text-secondary">Agent identity, credentials, permissions, and wallets follow patterns BOT Chain has publicly referenced, including Research Series #06. A document hash is proof of integrity, not a legal opinion or emissions certification.</p>
    </main>
  );
}
