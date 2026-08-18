"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Slim top bar with a scroll-progress line, appears after the hero has scrolled past. */
export function StickyBar() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 420);
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm transition-transform duration-300 ${
        scrolled ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto flex h-12 max-w-[980px] items-center justify-between gap-4 px-6">
        <Link href="/" className="font-grotesk text-base font-semibold tracking-tight text-text-primary">
          Civora
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden font-mono text-[10px] uppercase tracking-widest text-text-tertiary sm:block">BOT Chain · 677</p>
          {mounted ? <ConnectButton showBalance={false} chainStatus="icon" /> : null}
        </div>
      </div>
      <div className="h-px w-full bg-border">
        <div className="h-px bg-accent transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );
}
