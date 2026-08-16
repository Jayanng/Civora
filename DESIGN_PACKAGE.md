# Civora — Complete Design Package for Build Tooling
**Prepared for:** Grok CLI / OpenCode / any code-generation agent
**Version:** 1.0
**Date:** 2026-08-17
**Status:** Final — ready to build from

---

## 0. How to Use This File

1. Read `DESIGN_SYSTEM.md` for all tokens.
2. Read `LAYOUT_PAGES.md` for page structure.
3. Read `COMPONENTS.md` for every component spec.
4. Read `BOTCHAIN_DOCS.md` for network/chain details.
5. Read `JUDGES_CRITERIA.md` for submission strategy.
6. Read `LOCKED_SCOPE.md` before cutting any feature.
7. Read `README.md` for positioning and demo script.

This file explains how to install tooling, use icons, and wire everything together.

---

## 1. Tech Stack (install exactly in this order)

### 1.1 Node.js / pnpm
```bash
# Install Node.js 18+ (use nvm if available)
nvm install 20
nvm use 20

# Enable corepack and pnpm
corepack enable
corepack prepare pnpm@latest --activate
```

### 1.2 Next.js + TypeScript
```bash
pnpm create next-app@latest civora-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd civora-app
```

### 1.3 Design system dependencies
```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D @types/node @types/react @types/react-dom typescript
```

### 1.4 shadcn/ui
```bash
pnpm dlx shadcn@latest init
# When prompted:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
# - React Server Components: Yes
# - Tailwind config location: tailwind.config.ts
# - Import alias: @/*
```

### 1.5 Required shadcn components
```bash
pnpm dlx shadcn@latest add button input card table badge dialog dropdown-menu tabs toast form label select
```

### 1.6 Wallet / chain tooling
```bash
pnpm add wagmi viem @tanstack/react-query @rainbow-me/rainbowkit
```

### 1.7 Motion
```bash
pnpm add motion
```

### 1.8 Optional: Radix primitives
```bash
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-toast
```

### 1.9 Install and verify
```bash
pnpm install
pnpm run dev
# Visit http://localhost:3000
```

---

## 2. Tailwind Config (exact tokens)

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        surface: '#F1F2F4',
        'surface-raised': '#FFFFFF',
        border: '#E3E5E8',
        'border-strong': '#C7CBD1',
        'text-primary': '#17191C',
        'text-secondary': '#737F8C',
        'text-tertiary': '#ABB2BA',
        'text-on-accent': '#FFFFFF',
        accent: '#427FBD',
        'accent-hover': '#356897',
        'accent-muted': '#D9E6F2',
        'accent-strong': '#284C71',
        secondary: '#0073FF',
        'secondary-hover': '#005CCC',
        'secondary-muted': '#CCE3FF',
        success: '#427FBD',
        'success-bg': '#ECF2F8',
        error: '#17191C',
        'error-bg': '#FDECEC',
        warning: '#737F8C',
        'warning-bg': '#FFF8E6',
        info: '#0073FF',
        'info-bg': '#E5F1FF',
        'dark-panel': '#101214',
        'dark-surface': '#17191C',
        'dark-border': '#2E3238',
        'dark-text': '#F1F2F3',
        'dark-text-secondary': '#9098A2',
      },
      fontFamily: {
        grotesk: ['Space Grotesk', 'sans-serif'],
        plex: ['IBM Plex Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        sm: '4px',
        md: '6px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --bg: #FFFFFF;
    --surface: #F1F2F4;
    --surface-raised: #FFFFFF;
    --border: #E3E5E8;
    --border-strong: #C7CBD1;
    --text-primary: #17191C;
    --text-secondary: #737F8C;
    --text-tertiary: #ABB2BA;
    --text-on-accent: #FFFFFF;
    --accent: #427FBD;
    --accent-hover: #356897;
    --accent-muted: #D9E6F2;
    --accent-strong: #284C71;
    --secondary: #0073FF;
    --secondary-hover: #005CCC;
    --secondary-muted: #CCE3FF;
    --success: #427FBD;
    --success-bg: #ECF2F8;
    --error: #17191C;
    --error-bg: #FDECEC;
    --warning: #737F8C;
    --warning-bg: #FFF8E6;
    --info: #0073FF;
    --info-bg: #E5F1FF';
    --dark-panel: #101214';
    --dark-surface: #17191C';
    --dark-border: #2E3238';
    --dark-text: #F1F2F3';
    --dark-text-secondary: '#9098A2';
    --radius-none: 0px;
    --radius-sm: 4px;
    --radius-md: 6px;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-bg text-text-primary font-plex;
  }
}
```

---

## 3. Font Loading (Next.js)

Add to `src/app/layout.tsx` in `<head>`:
```tsx
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
```

---

## 4. shadcn Overrides Required

Create `src/components/ui/button.tsx` and enforce zero radius + palette.

Create `src/components/ui/input.tsx` and enforce zero radius + focus ring = `border-accent`.

Create `src/components/ui/badge.tsx` and replace default palette with semantic map from DESIGN_SYSTEM.md.

Create `src/components/ui/card.tsx` and remove shadow, override border to `border-border`.

---

## 5. Wagmi Config (BOT Chain Mainnet)

```ts
// src/lib/wagmi.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { mainnet } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Civora",
  projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
  chains: [
    {
      id: 677,
      name: "BOT Chain",
      nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
      rpcUrls: {
        default: { http: ["https://rpc.botchain.ai"] },
        public: { http: ["https://rpc.botchain.ai"] },
      },
      blockExplorers: {
        default: { name: "BOT Scan", url: "https://scan.botchain.ai" },
      },
    },
  ],
  transports: {
    [677.id]: http("https://rpc.botchain.ai"),
  },
});
```

Add `providers.tsx` client wrapper:
```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

---

## 6. Icons — Usage

All icons live in `/home/ubuntu/hackathon-win-engine/civora/icons/`.

Copy `icons/` into `public/icons/` in the Next.js project.

Use as:
```tsx
import SearchIcon from '@/icons/search-icon.svg';
// or
<img src="/icons/search-icon.svg" alt="Search" width="24" height="24" />
```

Available icons:
- `agent-icon.svg`
- `home-icon.svg`
- `invoice-icon.svg`
- `activity-icon.svg`
- `search-icon.svg`
- `wallet-icon.svg`
- `dashboard-icon.svg`
- `users-icon.svg`
- `chart-icon.svg`
- `shield-check-icon.svg`
- `clock-icon.svg`
- `user-plus-icon.svg`
- `upload-icon.svg`

---

## 7. Motion Usage

```tsx
import { motion, AnimatePresence } from "motion/react";

// Fade-up (landing)
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} />

// Stagger list (agents)
{agents.map((agent, i) => (
  <motion.div
    key={agent.id}
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.05, duration: 0.3 }}
  />
))}

// Slide-in panel (detail)
<AnimatePresence>
  {selected && (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
    />
  )}
</AnimatePresence>

// Pulse (status change)
<motion.div
  animate={{ boxShadow: ["0 0 0 0 rgba(66, 127, 189, 0.4)", "0 0 0 8px rgba(66, 127, 189, 0)"] }}
  transition={{ repeat: 2, duration: 0.6 }}
/>

// Counter tick (dashboard)
<motion.span
  key={value}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>
  {value}
</motion.span>
```

---

## 8. shadcn Component Overrides (exact)

```tsx
// src/components/ui/button.tsx (excerpt)
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-none font-grotesk text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-hover",
        secondary: "bg-transparent text-secondary border border-secondary hover:bg-secondary-muted",
        destructive: "bg-[#17191C] text-white hover:bg-[#2E3238]",
        outline: "border border-border-strong hover:bg-surface",
      },
      size: { default: "h-10 px-4 py-2", sm: "h-9 px-3", lg: "h-11 px-8" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

```tsx
// src/components/ui/badge.tsx (excerpt)
const badgeVariants = cva(
  "inline-flex items-center rounded-sm border-0 px-2.5 py-0.5 text-xs font-grotesk font-medium uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface text-text-secondary",
        primary: "bg-accent-muted text-accent",
        secondary: "bg-secondary-muted text-secondary",
        success: "bg-success-bg text-accent",
        error: "bg-error-bg text-error border border-error",
        warning: "bg-warning-bg text-warning",
        info: "bg-info-bg text-info",
      },
    },
    defaultVariants: { variant: "default" },
  }
);
```

---

## 9. Dark Panel Components

Use for tables and code blocks only.

```tsx
<div className="bg-dark-panel border border-dark-border rounded-md p-4">
  <code className="font-mono text-sm text-dark-text">0x1234...abcd</code>
</div>
```

---

## 10. Build Sequence (Grok should follow this order)

1. Project scaffold (`pnpm create next-app`)
2. Install dependencies (exact order in section 1)
3. Copy `icons/` to `public/icons/`
4. Configure Tailwind (`tailwind.config.ts`)
5. Configure global CSS (`src/app/globals.css`)
6. Configure fonts (`src/app/layout.tsx`)
7. Configure Wagmi + RainbowKit (`src/lib/wagmi.ts`, `src/app/providers.tsx`)
8. Create shadcn overrides (Button, Input, Card, Badge)
9. Build Landing page
10. Build Dashboard page
11. Build Agents page
12. Build Assets/Invoices page
13. Build Activity page
14. Connect wallet + Chain ID 677 enforcement
15. Deploy contracts to mainnet
16. Connect frontend to mainnet contracts
17. Polish + demo recording

---

## 11. File Inventory

| File | Purpose |
|------|---------|
| `README.md` | Project positioning, demo flow, asset roadmap |
| `LOCKED_SCOPE.md` | Immutable feature list — read before cutting anything |
| `DESIGN_SYSTEM.md` | Color, typography, motion, spacing, shapes, tokens |
| `LAYOUT_PAGES.md` | Page structure and section anatomy |
| `COMPONENTS.md` | Every component with variants, tokens, motion, proof rules |
| `BOTCHAIN_DOCS.md` | Official BOT Chain docs for implementation reference |
| `JUDGES_CRITERIA.md` | Judging weights, track focus, implicit filters |
| `icons/*.svg` | All icons — copy to `public/icons/` |
| `DESIGN_PACKAGE.md` | This file: installation, tooling, build sequence |

---

## 12. Pre-Flight Verification Checklist

Before starting build, verify:

- [ ] All files exist in `/home/ubuntu/hackathon-win-engine/civora/`
- [ ] Icons folder has at least 8 SVGs
- [ ] DESIGN_SYSTEM.md has color/typography/motion
- [ ] LAYOUT_PAGES.md has 5 pages
- [ ] COMPONENTS.md has component variants
- [ ] BOTCHAIN_DOCS.md has Chain ID 677 and RPC
- [ ] JUDGES_CRITERIA.md has 5 weighted dimensions
- [ ] No references to agentpact, FIDEL, or old names anywhere
- [ ] White background confirmed for all pages
- [ ] Evergreen palette confirmed (no blue)

---

*End of design package. Ready for Grok CLI ingestion.*