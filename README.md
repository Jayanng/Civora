# Civora
**Autonomous Agent-Attested Settlement for Real-World Assets on BOT Chain**

Tagline: Autonomous Agents. Real Assets. On-Chain Trust.

---

## 1. Positioning (Infrastructure, Not an App)

Civora is the **trust and settlement layer for Real-World Assets on BOT Chain**.

It gives every RWA project a production-ready stack for AI agent identity, verifiable attestation, scoped permissions, and autonomous settlement. Invoices are the first demonstration, but the Trust Layer is designed to support **any asset class**: DePIN compute nodes, trade finance, real estate, carbon credits, and more.

---

## 2. Core Problem & Solution

**Problem:** AI agents on BOT Chain currently lack a clean, production-ready way to prove identity, hold limited permissions, issue verifiable claims about assets, and settle real value under those constraints.

**Solution:** Civora provides:
1. An on-chain Agent Identity + Attestation + Permission system
2. A complete, working RWA settlement flow (Invoice-focused) where agents perform the core work and receive revenue

The result is a single, tight, demoable business loop that judges can complete in under 90–120 seconds.

---

## 3. Narrowed Feature Set (Must-Have Only)

### Agent Trust Layer
- Create specialized agents (Underwriter Agent and Settlement Agent)
- Each agent receives an on-chain identity (ERC-721 based, aligned with ERC-8004 patterns that BOT Chain has referenced)
- Dedicated Agent Wallet (smart-contract wallet pattern)
- Issue and store Verifiable Credentials / Attestations about an asset
- Scoped on-chain permissions (value limits, allowed actions, time bounds)
- Permission enforcement (invalid actions are blocked)
- Basic on-chain reputation that updates after successful settlement

### RWA Settlement Loop (Invoice focus)
- Register an Invoice as a Real-World Asset (amount, due date, counterparty, document hash)
- Agent issues an attestation / underwriting credential
- Permissions are applied
- Settlement executes
- A clear portion of fees/revenue is sent to the Agent Wallet
- Full activity log with direct links to https://scan.botchain.ai

### Infrastructure
- Live on BOT Chain Mainnet (Chain ID 677, RPC https://rpc.botchain.ai)
- Wallet connection with network enforcement
- Verified contracts
- Clean public website + interactive demo
- GitHub repository with clear README

Everything else (complex multi-agent AI reasoning, multiple asset types, advanced monitoring, fancy chat interfaces, etc.) is deliberately removed to protect Product Completion score.

---

## 4. Demo Flow (90–120 seconds)

1. Land on public website → Connect wallet (auto-switches to BOT Mainnet 677)
2. Create two agents (Underwriter + Settlement) → Identity + Agent Wallet created on-chain
3. Register a new Invoice (simple form: amount, due date, counterparty, document hash)
4. Click “Let Agent Attest / Underwrite”
5. Watch the Underwriter Agent issue an on-chain attestation + set scoped permissions
6. Trigger Settlement → Payment executes → Portion of value is sent to the Settlement Agent’s wallet
7. Attempt an unauthorized action → Permission is blocked on-chain
8. View reputation update + full transaction history on the BOT Explorer

---

## 5. Pages & Layout (Simplified & Focused)

### Landing Page
- Strong headline + short explanation
- Clear “Launch App” button
- “Built for BOT Chain’s AI Agent infrastructure” messaging (no false Launchpad claims)
- Live counters (Agents created, Invoices settled, Value processed)
- Links to GitHub, Explorer, and the real Research Series #06 article

### Dashboard (after connect)
- Summary cards: Active Agents | Registered Invoices | Total Settled | Agent Reputation
- Two primary actions only: “Create Agent” and “Register Invoice”

### Agents Page
- List of agents with identity address, wallet balance, reputation, and permission status
- Create Agent form
- Simple detail view (credentials, permissions, activity)

### Assets / Invoices Page
- List of registered invoices
- Register Invoice form
- Detail view showing attestation, assigned agents, settlement history, and current permissions

### Activity Page
- Chronological feed of all on-chain events with Explorer links

---

## 6. Technical Architecture

- Network: BOT Chain Mainnet only (Chain ID 677, RPC https://rpc.botchain.ai, Explorer https://scan.botchain.ai)
- Frontend: Next.js + TypeScript + Tailwind + wagmi/viem
- Contracts (Solidity) — 7 core + Reputation:
  - AgentIdentity (ERC-721 + URIStorage, aligned with ERC-8004 Identity)
  - AgentWallet (smart-contract wallet, ERC-1271)
  - AgentFactory (one tx: identity + wallet)
  - AttestationRegistry (underwriting commitments)
  - PermissionEngine (value / selector / time bounds)
  - InvoiceRegistry
  - SettlementVault (native BOT escrow + 95/3/1/1 split)
  - Reputation (8th — score updates after successful settlement)
- All contracts deployed and verified on mainnet
- Events for every critical step so the Activity feed and Explorer links work cleanly

---

## 7. Build Plan

Execution source of truth: `BUILD_PLAN.md` (10 gated phases). Do not start the next phase until the current gate is green.

| Phase | Work |
|-------|------|
| 0 | Scaffold Next.js + Foundry, tokens, wagmi 677 |
| 1 | Contracts + Foundry tests (7 core + Reputation) |
| 2 | Deploy + verify on mainnet 677 |
| 3 | Wallet, create agents, dashboard reads |
| 4 | Register + fund invoice (document **hash only**, no IPFS) |
| 5 | Real GMI underwriter + on-chain attest |
| 6 | Settle, 95/3/1/1 fees, reputation |
| 7 | Unauthorized drain revert |
| 8 | Activity feed, landing, polish |
| 9 | README, 90s demo video, submission |

**Rule:** Do not move forward until the previous phase is fully working. User-facing demo must be on BOT Chain Mainnet (677).

---

## 8. Why This Wins

- **RWA Track — Highest Priority:** BOT Chain has explicitly positioned RWA as its primary ecosystem direction. Civora is the most complete RWA settlement protocol on the chain.
- **AI as Core Capability:** Agents aren’t chatbots or wrappers. They are the economic actors performing underwriting, attestation, and settlement. The AI–on-chain mechanism is deep and functional.
- **Complete Business Loop:** This is not a prototype or a dashboard. It’s a working loop: Register → Attest → Enforce → Settle → Reputate.
- **Reusable Infrastructure:** The Trust Layer is designed so other RWA projects can adopt it without rebuilding identity, permissions, or settlement. Like DevStation, this helps the entire ecosystem.
- **Fully Mainnet:** Live on BOT Chain Mainnet. Verified contracts. Public frontend. Real transactions.

---

## 9. Beyond Invoices: One Trust Layer, Every Asset Class

The Civora Trust Layer is asset-type agnostic. Invoices are the first integration because they are:
- Universally understood
- Structured (amount, term, counterparty)
- Repeatable (every invoice = identical workflow)

**DePIN Compute Nodes:**
- Agent underwrites node capacity, issues credential: “Node X has 99.9% uptime + 100Mbps verified speed”
- Permission scope: agent can suspend underperforming nodes, release payments on SLA proof
- Settlement: requesters pay per compute-second, agent takes protocol fee

**Trade Finance / Letters of Credit:**
- Agent validates shipment documents, issues credential: “Shipment Y matches LC terms”
- Permission scope: agent can release payment upon validation, flag discrepancies
- Settlement: automated payment split between exporter, agent, protocol

**Real Estate / Property Tokens:**
- Agent validates occupancy, rental income, maintenance records
- Permission scope: agent can trigger rent distribution, flag lease violations
- Settlement: automated yield distribution to token holders

**Carbon Credits:**
- Agent verifies emissions data, issues credential: “Project Z sequestered X tons”
- Permission scope: agent can mint credits, enforce retirement rules
- Settlement: credit sales split between project, verifier, protocol

**What every asset type shares:**
- Agent needs identity + wallet
- Asset needs registration + metadata
- Agent issues attestation/credential
- Permissions are enforced on-chain
- Settlement is automatic
- Revenue flows to agent + protocol

**The pitch to judges:** “We didn’t build an invoice app. We built the Rails for RWA on BOT Chain. Invoices are just the first route on the network.”

---

## 10. References

- [BOT Chain Research Series #06: AI Agent Identity on Blockchain](https://medium.com/@BOTChain_ai/ai-agent-identity-on-blockchain-dids-credentials-and-permission-boundaries-3c35106154d3) — The official BOT Chain article that inspired the Trust Layer design.
- [BOT Chain Developer Docs](https://dev-docs.botchain.ai/docs/Developers/quick-guide/)
- [BOT Chain Mainnet Explorer](https://scan.botchain.ai)

---

## 11. Roadmap

**Post-Hackathon:**
- DePIN Compute Node integration
- Trade Finance / Letter of Credit flow
- Multi-agent collaboration (mesh attestation)
- Governance for Trust Layer standards
- SDK for third-party RWA builders

---

## License

MIT