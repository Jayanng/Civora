"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSyncExternalStore, type ReactNode } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { botChain } from "@/lib/wagmi";

const emptySubscribe = () => () => {};

export function WalletGate({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-sm text-text-tertiary">…</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="max-w-md text-center font-mono text-sm text-text-secondary">
          Connect a wallet to use Civora. Everything happens on BOT Chain (677).
        </p>
        <ConnectButton showBalance={false} />
      </div>
    );
  }

  if (chainId !== botChain.id) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="font-mono text-sm text-text-secondary">
          Wrong network — switch to BOT Chain (677).
        </p>
        <button
          type="button"
          className="h-10 rounded-none bg-accent px-4 font-grotesk text-sm font-medium text-text-on-accent hover:bg-accent-hover"
          disabled={isPending}
          onClick={() => switchChain({ chainId: botChain.id })}
        >
          {isPending ? "Switching…" : "Switch to BOT Chain (677)"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}