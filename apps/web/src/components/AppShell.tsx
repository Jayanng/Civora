"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/invoices", label: "Invoices" },
  { href: "/app/activity", label: "Activity" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-full max-w-[1180px] flex-col px-4 py-5 md:flex-row md:gap-8">
      <aside className="flex shrink-0 items-center justify-between gap-6 border-b border-border pb-4 md:w-48 md:flex-col md:items-stretch md:border-b-0 md:pb-0">
        <Link
          href="/app"
          className="font-grotesk text-lg font-semibold tracking-tight text-text-primary"
        >
          Civora
        </Link>
        <nav className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/app"
                ? pathname === "/app"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-1 py-1 text-sm ${
                  active
                    ? "font-medium text-accent"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block">
          <ConnectButton showBalance={false} />
        </div>
      </aside>
      <main className="min-w-0 flex-1 pt-5 md:pt-0">{children}</main>
    </div>
  );
}