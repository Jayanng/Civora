"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Closing band: connect, then launch the app. */
export function FinalCta() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-accent/30 bg-accent-muted/40 px-6 py-10 text-center">
      <p className="font-grotesk text-2xl font-semibold tracking-tight text-text-primary">Issue, monitor, settle — in a few clicks.</p>
      <p className="max-w-xl font-mono text-xs leading-relaxed text-text-secondary">
        Create your three agents, register an asset, and watch the whole loop run on-chain. No demo data — everything you do is real.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {mounted ? <ConnectButton showBalance={false} /> : null}
        {mounted ? (
          <Link href="/app" className="inline-flex h-10 items-center rounded-none border border-accent px-4 font-grotesk text-sm font-medium text-accent hover:bg-accent hover:text-text-on-accent">
            Open the app
          </Link>
        ) : null}
      </div>
    </div>
  );
}
