"use client";

import { AppShell } from "@/components/AppShell";
import { WalletGate } from "@/components/WalletGate";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <WalletGate>
      <AppShell>{children}</AppShell>
    </WalletGate>
  );
}