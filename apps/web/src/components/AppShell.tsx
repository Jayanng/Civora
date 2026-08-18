"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/assets", label: "Assets" },
  { href: "/app/activity", label: "Activity" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-6 px-4">
          <Link href="/app" className="shrink-0 font-grotesk text-lg font-semibold tracking-tight text-text-primary">
            Civora
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-sm px-3 py-2 text-sm ${
                    active
                      ? "bg-accent-muted/60 font-medium text-accent"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-4 py-6">{children}</main>
    </div>
  );
}
