# Civora — BOT Chain Builder Challenge #2 Submission Brief

## Project

**Civora — Autonomous Agents for Sustainability-Linked Real Assets**

## Track

- Primary: RWA Applications
- Secondary: AI Native Applications

## Problem

Sustainability-linked assets require more than issuance. A buyer needs a credible underwriting decision, an observable target outcome, a clear penalty rule, and settlement logic that cannot be changed by a single operator after funds are escrowed. Existing workflows separate these responsibilities across people, reports, and payment systems.

## Solution

Civora makes specialized AI agents the operators of the lifecycle:

- Underwriter Agent approves principal eligibility and caps coupon exposure.
- Compliance Monitor Agent evaluates target evidence and commits `TargetMet` or `TargetMissed` with a penalty basis-point value.
- Settlement Agent executes only the permission-scoped settlement action.

Credentials are hash-locked on-chain. The PermissionEngine binds the AI decision to a selector, value cap, and expiry. The SettlementAndPenaltyVault pays principal 100% to the holder, charges fees only from the live coupon, and sends a target-missed haircut to treasury.

## Complete Business Loop

```text
Issue -> Fund -> AI Underwrite -> AI Monitor -> Settle or Coupon Haircut -> Reputation
```

All critical writes occur on BOT Chain Mainnet 677 and link to the verified Explorer records. The public proof route reads the primary asset state without requiring a wallet.

## AI-Native Mechanism

GMI DeepSeek-V4-Flash produces schema-validated underwriting and monitoring reports. The AI response is not displayed as decorative text:

- Underwrite approvedPrincipal/approvedCoupon become the settlement eligibility and permission inputs.
- Monitor targetMet/targetMissed and penaltyBps become the on-chain coupon distribution.
- Report hashes are committed in CredentialRegistry.
- Settlement is blocked without both credentials and a valid permission grant.

## RWA Value

The protocol supports two asset forms:

- Sustainability-Linked Bond
- Green Receivable

Each records holder, principal, coupon, maturity, sustainability target hash, document hash, and assigned agents. Native BOT is escrowed and distributed on settlement.

## Economics

Principal is never charged a protocol or agent fee.

| Recipient | Share of live coupon |
|---|---:|
| Holder | 94% |
| Protocol treasury | 3% |
| Underwriter | 1% |
| Compliance Monitor | 1% |
| Settlement Agent | 1% |

When a target is missed, the haircut is 100% of the configured coupon penalty and goes to treasury. The monitor does not profit from declaring failure; its revenue remains 1% of live coupon on successful settlement.

## Why BOT Chain

Civora uses native BOT for RWA escrow and settlement, deploys verified contracts on Mainnet 677, enforces wallet network selection, and exposes every lifecycle transaction through the BOT Explorer. The identity, credential, permission, and reputation primitives are designed for seamless future integration with BOT Chain's AI Agent infrastructure and align with the direction described in Research Series #06.

## Technical Quality

- Solidity 0.8.24 with Foundry tests
- Separate primary green deployment and preserved legacy invoice deployment
- Reentrancy protection in the settlement vault
- Explicit role and controller validation
- Selector/value/time permissions
- Receipt-based activity index because the official RPC does not support `eth_getLogs`
- Persistent report storage in production via Blob or equivalent
- No mock AI path

## Compliance Feasibility

The prototype proves controlled settlement and auditability, not legal compliance. A production deployment requires KYB/KYC, sanctions screening, regulated custody, legal asset assignment, investor eligibility controls, and independent sustainability evidence/oracle governance.

## Long-Term Roadmap

1. Multi-agent mesh attestation.
2. DePIN compute and additional asset adapters.
3. Trade finance and letters of credit.
4. Governance and dispute resolution.
5. SDK for third-party RWA builders.

## Public Proof

The hosted deployment URL and fresh mainnet proof transaction links are recorded in the final README after the primary green lifecycle is completed.
