"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { formatEther } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain } from "wagmi";
import { agentExists, assetExists, fetchEscrowStats, fetchSettledStats, findTotal } from "@/lib/civora";
import { botChain } from "@/lib/wagmi";
import { AmbientBackground } from "@/components/landing/AmbientBackground";
import { AudienceSplit } from "@/components/landing/AudienceSplit";
import { CountUp } from "@/components/landing/CountUp";
import { EcosystemStrip } from "@/components/landing/EcosystemStrip";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { NetworkPill } from "@/components/landing/NetworkPill";
import { Reveal } from "@/components/landing/Reveal";
import { SecurityBadges } from "@/components/landing/SecurityBadges";
import { SettlementCalculator } from "@/components/landing/SettlementCalculator";
import { StickyBar } from "@/components/landing/StickyBar";
import { TerminalFeed } from "@/components/landing/TerminalFeed";

const emptySubscribe = () => () => {};

const FLOW = [
  { n: "1", title: "Issue asset", text: "Register a sustainability-linked bond or green receivable with a target and document hash." },
  { n: "2", title: "AI underwrites", text: "The Underwriter Agent caps the eligible principal and coupon in a hash-locked credential." },
  { n: "3", title: "AI monitors", text: "The Compliance Monitor evaluates target evidence and sets targetMet or targetMissed with penaltyBps." },
  { n: "4", title: "Settle or haircut", text: "Principal goes fully to the holder; missed targets haircut only the coupon on-chain." },
];

const ROSTER = [
  { role: "Underwriter", duty: "Caps how much may settle", text: "Reads the issuance, approves principal and a coupon ceiling, and locks the decision in a credential that expires at maturity." },
  { role: "Compliance Monitor", duty: "Judges the target", text: "Checks evidence against the sustainability target and records targetMet or targetMissed with a penalty rate." },
  { role: "Settlement Agent", duty: "Executes payout", text: "The only role with settle permission — pays principal to the holder and splits the live coupon by protocol rules." },
];

function StripCell({ label, value, caption }: { label: string; value: ReactNode; caption: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">{label}</p>
      <p className="font-mono text-xl font-medium text-text-primary">{value}</p>
      <p className="font-mono text-[10px] text-text-tertiary">{caption}</p>
    </div>
  );
}

function LiveStrip() {
  const publicClient = usePublicClient();
  const agentCount = useQuery({
    queryKey: ["strip", "agents"],
    queryFn: () => (publicClient ? findTotal(publicClient, (id) => agentExists(publicClient, id)) : 0n),
    enabled: !!publicClient,
    refetchInterval: 20_000,
  });
  const assetCount = useQuery({
    queryKey: ["strip", "assets"],
    queryFn: () => (publicClient ? findTotal(publicClient, (id) => assetExists(publicClient, id)) : 0n),
    enabled: !!publicClient,
    refetchInterval: 20_000,
  });
  const settled = useQuery({
    queryKey: ["strip", "settled", assetCount.data?.toString()],
    queryFn: () => (publicClient && assetCount.data !== undefined ? fetchSettledStats(publicClient, assetCount.data) : { count: 0, valueWei: 0n, capped: false }),
    enabled: !!publicClient && assetCount.data !== undefined,
    refetchInterval: 20_000,
  });
  const escrow = useQuery({
    queryKey: ["strip", "escrow", assetCount.data?.toString()],
    queryFn: () => (publicClient && assetCount.data !== undefined ? fetchEscrowStats(publicClient, assetCount.data) : { count: 0, valueWei: 0n, capped: false }),
    enabled: !!publicClient && assetCount.data !== undefined,
    refetchInterval: 20_000,
  });

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StripCell label="Agents on-chain" value={agentCount.isLoading ? "…" : <CountUp value={Number(agentCount.data ?? 0n)} />} caption="identity NFTs, wallet-bound" />
      <StripCell label="Assets registered" value={assetCount.isLoading ? "…" : <CountUp value={Number(assetCount.data ?? 0n)} />} caption="green issuances live" />
      <StripCell label="Settled value" value={settled.isLoading ? "…" : <CountUp value={Number(formatEther(settled.data?.valueWei ?? 0n))} decimals={4} suffix=" BOT" />} caption={`${settled.data?.capped ? "256+ assets" : `${settled.data?.count ?? 0} settled`}`} />
      <StripCell label="In escrow" value={escrow.isLoading ? "…" : <CountUp value={Number(formatEther(escrow.data?.valueWei ?? 0n))} decimals={4} suffix=" BOT" />} caption={`${escrow.data?.capped ? "256+ assets" : `${escrow.data?.count ?? 0} funded`}`} />
    </div>
  );
}

export default function Home() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const onBot = chainId === botChain.id;

  return (
    <>
      <AmbientBackground />
      <StickyBar />
      <main className="mx-auto flex min-h-full max-w-[980px] flex-col gap-14 px-6 pb-20 pt-24">
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">BOT Chain · Mainnet 677 · AI × RWA</p>
            <NetworkPill />
          </div>
          <Reveal>
            <h1 className="max-w-3xl font-grotesk text-4xl font-semibold tracking-tight sm:text-5xl">Autonomous Agents for Sustainability-Linked Real Assets.</h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="max-w-2xl text-text-secondary">Civora lets specialized AI agents underwrite green assets, monitor sustainability commitments, enforce permissions, and settle principal and coupon value on BOT Chain — every step a verifiable on-chain credential.</p>
          </Reveal>
          <Reveal delay={150}>
            <div className="flex flex-wrap items-center gap-3">
              {mounted ? <ConnectButton showBalance={false} /> : null}
              {mounted && isConnected && !onBot ? <button type="button" disabled={isPending} onClick={() => switchChain({ chainId: botChain.id })} className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">{isPending ? "Switching…" : "Switch to BOT Chain (677)"}</button> : null}
              {mounted && isConnected && onBot ? <Link href="/app" className="inline-flex h-10 items-center rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover">Launch App</Link> : null}
            </div>
          </Reveal>
          <p className="font-mono text-sm text-text-secondary">{!mounted ? "…" : isConnected ? onBot ? "Connected on BOT Chain (677)." : "Wrong network — switch to BOT Chain (677)." : "Connect a wallet to issue an asset."}</p>
        </section>

        <Reveal><LiveStrip /></Reveal>

        <Reveal>
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">Live on-chain</h2>
            </div>
            <TerminalFeed />
          </section>
        </Reveal>

        <Reveal>
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">Who it is for</h2>
            </div>
            <AudienceSplit />
          </section>
        </Reveal>

        <Reveal>
          <section className="flex flex-col gap-4">
            <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">The cast</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {ROSTER.map((agent) => (
                <div key={agent.role} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
                  <p className="font-grotesk text-sm font-medium">{agent.role}</p>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-accent">{agent.duty}</p>
                  <p className="text-xs leading-relaxed text-text-secondary">{agent.text}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal><SettlementCalculator /></Reveal>

        <Reveal>
          <section className="flex flex-col gap-4">
            <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">The Civora loop</h2>
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FLOW.map((step) => <li key={step.n} className="flex gap-3 rounded-md border border-border bg-surface p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-xs text-accent">{step.n}</span><div><p className="font-grotesk text-sm font-medium">{step.title}</p><p className="mt-1 text-xs text-text-secondary">{step.text}</p></div></li>)}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section className="flex flex-col gap-4">
            <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">Built to be provable</h2>
            <SecurityBadges />
          </section>
        </Reveal>

        <Reveal>
          <section className="flex flex-col gap-4">
            <h2 className="font-grotesk text-sm font-medium uppercase tracking-widest text-text-secondary">Questions</h2>
            <Faq />
          </section>
        </Reveal>

        <Reveal><FinalCta /></Reveal>

        <EcosystemStrip />

        <p className="max-w-2xl self-center text-center font-mono text-xs leading-relaxed text-text-tertiary">Agent identity, credentials, permissions, and wallets follow patterns BOT Chain has publicly referenced, including Research Series #06. A document hash is proof of integrity, not a legal opinion or emissions certification. Principal and coupon figures above are read live from the deployed contracts.</p>
      </main>
    </>
  );
}
