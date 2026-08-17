# Civora Green RWA Overwrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overwrite Civora's primary product from invoice settlement to a full sustainability-linked RWA lifecycle (Underwrite → AI Monitor → coupon haircut settle) on BOT Chain 677, while keeping v1 invoice contracts as legacy proof only.

**Architecture:** Redeploy a primary green protocol (3 agent types, CredentialRegistry, GreenAssetRegistry, SettlementAndPenaltyVault, Civora facade). Frontend points only at primary addresses. Legacy v1 stays on-chain and in `deployments/677.json` under `legacy`. Real GMI for underwrite and monitor; no mock path. Fees only on live coupon; principal 100% to holder; haircut 100% to treasury.

**Tech Stack:** Solidity 0.8.24 + Foundry, Next.js 16.3.1, React 19, TypeScript, Tailwind 4, wagmi 2, viem 2, RainbowKit, GMI OpenAI-compatible API, Vercel Blob for hosted reports.

## Global Constraints

- BOT Chain Mainnet only: chain ID `677`, RPC `https://rpc.botchain.ai`, explorer `https://scan.botchain.ai`.
- Do not call `eth_getLogs`; use receipt indexes only.
- Do not mock AI; missing `GMI_API_KEY` returns 503.
- Canonical sorted-key JSON report hash must equal on-chain `reportHash`.
- Fees only on coupon; principal always 100% to holder.
- Haircut on target miss goes 100% to protocol treasury.
- Reputation bumps only after successful settle: UW +1, Monitor +2, SA +1.
- Product brand remains **Civora** (not VerdeAgent).
- No Launchpad V1 live-integration claims; Research #06 language only.
- Never commit secrets (`PRIVATE_KEY`, `GMI_API_KEY`, `BLOB_READ_WRITE_TOKEN`).
- ASCII in new source and docs unless an existing file requires otherwise.
- Keep full scope: three agents, underwrite, monitor, haircut settle, drain demo, five pages, public site.
- `AgentType.None` must remain ordinal `0`; `Underwriter=1`, `ComplianceMonitor=2`, `Settlement=3`. Any existing code that casts `AgentType` to `uint8` must not break.
- Underwrite rejected principal+coupon must be zero; underwrite rejected means the full escrow is refundable by the issuer.
- Monitor `TargetMissed` requires `penaltyBps` in `1..10000`; `TargetMet` requires `penaltyBps == 0`.

---

## File Structure

### Contracts (primary rewrite / new)

| Path | Responsibility |
|---|---|
| `contracts/src/Types.sol` | AgentType (+ComplianceMonitor), AssetType, AssetState, UnderwriteDecision, MonitorOutcome, CredentialKind |
| `contracts/src/Errors.sol` | Shared custom errors for green path |
| `contracts/src/AgentIdentity.sol` | Accept ComplianceMonitor type |
| `contracts/src/AgentFactory.sol` | Create three agent types |
| `contracts/src/AgentWallet.sol` | Unchanged pattern (reuse) |
| `contracts/src/CredentialRegistry.sol` | **New** underwrite + monitor credentials by assetId |
| `contracts/src/PermissionEngine.sol` | Generalized assetId grants |
| `contracts/src/GreenAssetRegistry.sol` | **New** asset registration + state machine |
| `contracts/src/Reputation.sol` | Same vault-only bump pattern |
| `contracts/src/SettlementAndPenaltyVault.sol` | **New** fund P+C, settle with haircut, drain demo |
| `contracts/src/Civora.sol` | Facade: underwriteCommit + monitorCommit |
| `contracts/script/Deploy.s.sol` | Primary green deploy order |
| `contracts/test/CivoraGreen.t.sol` | **New** full green lifecycle tests |

Keep v1 source files (`InvoiceRegistry.sol`, `AttestationRegistry.sol`, `SettlementVault.sol`) in repo for legacy reference; they are not the primary deploy path. Optionally leave `contracts/test/Civora.t.sol` as legacy suite or gate it behind a separate profile later — primary CI gate is `CivoraGreen.t.sol`.

### Frontend

| Path | Responsibility |
|---|---|
| `apps/web/src/lib/civora.ts` | Primary ADDRESSES + ABIs + counters |
| `apps/web/src/lib/agents.ts` | Agent index (v2 key if needed) |
| `apps/web/src/lib/assets.ts` | **New** asset receipt index + decoders |
| `apps/web/src/lib/report-store.ts` | Local fs + Blob report persistence |
| `apps/web/src/app/api/underwrite/route.ts` | Green underwrite GMI |
| `apps/web/src/app/api/monitor/route.ts` | **New** monitor GMI |
| `apps/web/src/app/api/reports/[hash]/route.ts` | GET by hash |
| `apps/web/src/app/page.tsx` | Landing overwrite |
| `apps/web/src/app/app/page.tsx` | Dashboard assets metrics |
| `apps/web/src/app/app/agents/page.tsx` | Three agent types |
| `apps/web/src/app/app/assets/page.tsx` | **New** primary asset UI |
| `apps/web/src/app/app/invoices/page.tsx` | Redirect to `/app/assets` |
| `apps/web/src/app/app/activity/page.tsx` | Asset lifecycle timeline |
| `apps/web/src/components/AppShell.tsx` | Nav: Assets not Invoices |
| `apps/web/src/components/SettlementBreakdown.tsx` | **New** post-settle card |
| `apps/web/src/components/AiReportPanel.tsx` | **New** expandable AI report |

### Config / docs

| Path | Responsibility |
|---|---|
| `deployments/677.json` | `primary` + `legacy` blocks |
| `.env.example` | GMI, WC, Blob, treasury |
| `README.md` | Civora green product |
| `LOCKED_SCOPE.md` | Overwrite freeze to green scope |
| `DEMO_RUNBOOK.md` | Met + missed paths |
| `SUBMISSION.md` | Challenge submission brief |

---

### Task 1: Types, Errors, Agent Identity Factory

**Files:**
- Modify: `contracts/src/Types.sol`
- Modify: `contracts/src/Errors.sol`
- Modify: `contracts/src/AgentIdentity.sol`
- Modify: `contracts/src/AgentFactory.sol`
- Create: `contracts/test/CivoraGreen.t.sol` (scaffold + agent type tests)

**Interfaces:**
- Produces:
  - `enum AgentType { None, Underwriter, ComplianceMonitor, Settlement }`
  - `enum AssetType { None, SustainabilityLinkedBond, GreenReceivable }`
  - `enum AssetState { None, Registered, Funded, Underwritten, Monitored, Settled, Refunded }`
  - `enum UnderwriteDecision { None, Approve, Reject }`
  - `enum MonitorOutcome { None, TargetMet, TargetMissed }`
  - `enum CredentialKind { None, Underwrite, Monitor }`
- AgentIdentity.mint accepts `ComplianceMonitor`.
- AgentFactory.createAgent accepts all three non-None types.

- [ ] **Step 1: Write failing agent-type tests**

In `contracts/test/CivoraGreen.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentIdentity} from "../src/AgentIdentity.sol";
import {AgentFactory} from "../src/AgentFactory.sol";
import {AgentType} from "../src/Types.sol";
import {InvalidAgentType} from "../src/Errors.sol";

contract CivoraGreenTest is Test {
    AgentIdentity internal identity;
    AgentFactory internal factory;
    address internal alice = makeAddr("alice");

    function setUp() public {
        identity = new AgentIdentity();
        factory = new AgentFactory(identity);
        identity.setFactory(address(factory));
    }

    function test_createThreeAgentTypes() public {
        vm.startPrank(alice);
        (uint256 uw,) = factory.createAgent(AgentType.Underwriter, "UW-01");
        (uint256 mon,) = factory.createAgent(AgentType.ComplianceMonitor, "MON-01");
        (uint256 sa,) = factory.createAgent(AgentType.Settlement, "SA-01");
        vm.stopPrank();
        assertEq(uint8(identity.agentTypeOf(uw)), uint8(AgentType.Underwriter));
        assertEq(uint8(identity.agentTypeOf(mon)), uint8(AgentType.ComplianceMonitor));
        assertEq(uint8(identity.agentTypeOf(sa)), uint8(AgentType.Settlement));
    }

function test_rejectNoneAgentType() public {
        vm.prank(alice);
        vm.expectRevert(InvalidAgentType.selector);
        factory.createAgent(AgentType.None, "bad");
    }

    function test_agentTypeOrdinalsPreserveNoneFirst() public pure {
        assertEq(uint8(AgentType.None), 0);
        assertEq(uint8(AgentType.Underwriter), 1);
        assertEq(uint8(AgentType.ComplianceMonitor), 2);
        assertEq(uint8(AgentType.Settlement), 3);
    }
}
```

- [ ] **Step 2: Run test — expect fail**

```powershell
cd contracts
forge test --match-contract CivoraGreenTest -vv
```

Expected: compile fail or type fail until Types/Factory updated.

- [ ] **Step 3: Implement Types, Errors, Identity, Factory**

`Types.sol` full content:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum AgentType {
    None,
    Underwriter,
    ComplianceMonitor,
    Settlement
}

enum AssetType {
    None,
    SustainabilityLinkedBond,
    GreenReceivable
}

enum AssetState {
    None,
    Registered,
    Funded,
    Underwritten,
    Monitored,
    Settled,
    Refunded
}

enum UnderwriteDecision {
    None,
    Approve,
    Reject
}

enum MonitorOutcome {
    None,
    TargetMet,
    TargetMissed
}

enum CredentialKind {
    None,
    Underwrite,
    Monitor
}
```

Update `AgentIdentity.mint` and `AgentFactory.createAgent` to allow `Underwriter`, `ComplianceMonitor`, and `Settlement` only.

Add any missing errors used later (keep existing errors):

```solidity
error InvalidHolder();
error InvalidTargetHash();
error InvalidMaturity();
error InvalidPenalty();
error InvalidMonitorOutcome();
error AlreadyCredentialed();
error NotMonitor();
error InvalidCoupon();
error NotMonitored();
```

- [ ] **Step 4: Run tests — expect pass**

```powershell
forge test --match-contract CivoraGreenTest -vv
```

- [ ] **Step 5: Commit**

```powershell
git add contracts/src/Types.sol contracts/src/Errors.sol contracts/src/AgentIdentity.sol contracts/src/AgentFactory.sol contracts/test/CivoraGreen.t.sol
git commit -m "feat(contracts): three agent types and green enums for Civora overwrite"
```

---

### Task 2: CredentialRegistry

**Files:**
- Create: `contracts/src/CredentialRegistry.sol`
- Modify: `contracts/test/CivoraGreen.t.sol`

**Interfaces:**
- Produces:
  - `submitUnderwrite(assetId, agentId, reportHash, decision, approvedPrincipalWei, approvedCouponWei, expiresAt, modelId)`
  - `submitMonitor(assetId, agentId, reportHash, outcome, penaltyBps, evidenceHash, observedAt, expiresAt, modelId)`
  - Views: `underwrites(assetId)`, `monitors(assetId)`, `hasUnderwrite(assetId)`, `hasMonitor(assetId)`
- Only Civora or agent controller may submit; type-checked; one of each kind per asset.

- [ ] **Step 1: Write failing credential tests**

```solidity
function test_underwriteRejectRequiresZeroApprovals() public {
    // setup identity+factory+registry+civora stub
    // expect revert InvalidApprovedAmount when Reject with nonzero coupon
}

function test_monitorMissRequiresPositivePenalty() public {
    // TargetMissed with penaltyBps=0 reverts InvalidPenalty
}

function test_monitorMetRequiresZeroPenalty() public {
    // TargetMet with penaltyBps>0 reverts InvalidPenalty
}

function test_doubleUnderwriteReverts() public {
    // second submitUnderwrite reverts AlreadyCredentialed
}
```

- [ ] **Step 2: Run — expect fail**

```powershell
forge test --match-test test_underwriteRejectRequiresZeroApprovals -vv
```

- [ ] **Step 3: Implement CredentialRegistry**

Core rules from spec:

- Underwrite: Approve ⇒ `approvedPrincipalWei > 0`, `approvedCouponWei > 0`; Reject ⇒ both 0.
- Principal equality vs asset principal is enforced by Civora/vault against GreenAssetRegistry, not necessarily inside CredentialRegistry alone — still store the approved amounts.
- Monitor: TargetMet ⇒ penaltyBps==0; TargetMissed ⇒ 1..10000.
- `expiresAt > block.timestamp + 10 minutes` enforced at submit time relative to `block.timestamp`.
- `reportHash != 0`, `evidenceHash != 0` for monitor.
- `setCivora` once by admin.
- Events: `UnderwriteCredentialed(...)`, `MonitorCredentialed(...)`.

- [ ] **Step 4: Run credential tests — pass**

```powershell
forge test --match-contract CivoraGreenTest -vv
```

- [ ] **Step 5: Commit**

```powershell
git add contracts/src/CredentialRegistry.sol contracts/test/CivoraGreen.t.sol
git commit -m "feat(contracts): CredentialRegistry for underwrite and monitor attestations"
```

---

### Task 3: PermissionEngine (assetId)

**Files:**
- Modify: `contracts/src/PermissionEngine.sol` (or replace body for primary path)
- Modify: `contracts/test/CivoraGreen.t.sol`

**Interfaces:**
- Produces:
  - `grant(uint256 assetId, uint256 agentId, bytes4 selector, uint256 maxValue, uint64 expiresAt) returns (uint256 grantId)`
  - `check(uint256 assetId, uint256 agentId, bytes4 selector, uint256 value)`
  - `revoke(uint256 grantId)`
  - `grants(grantId)`, `grantIdOf(assetId, agentId, selector)`
- Granter authorization: `msg.sender == civora` OR controller of the Underwriter that submitted underwrite for `assetId` (read CredentialRegistry).

- [ ] **Step 1: Write failing grant tests**

```solidity
function test_grantSettleSelectorAfterApprove() public { /* ... */ }
function test_checkWithoutGrantRevertsPermissionDenied() public { /* ... */ }
function test_nonSettlementAgentCannotReceiveGrant() public { /* ... */ }
function test_civoraCanCreateGrant() public { /* facade caller is accepted */ }
function test_underwriterControllerCanCreateGrant() public { /* attesting underwriter controller is accepted */ }
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement assetId PermissionEngine**

```solidity
struct Grant {
    uint256 assetId;
    uint256 agentId;
    bytes4 selector;
    uint256 maxValue;
    uint64 expiresAt;
    bool revoked;
    address granter;
}
```

- Settlement agent type required on grant.
- `setCredentialRegistry` + `setCivora` once each.
- Key: `keccak256(abi.encode(assetId, agentId, selector))`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```powershell
git add contracts/src/PermissionEngine.sol contracts/test/CivoraGreen.t.sol
git commit -m "feat(contracts): asset-scoped PermissionEngine for green settle grants"
```

---

### Task 4: GreenAssetRegistry

**Files:**
- Create: `contracts/src/GreenAssetRegistry.sol`
- Modify: `contracts/test/CivoraGreen.t.sol`

**Interfaces:**
- Produces:
  - `register(holder, assetType, principalWei, couponWei, couponBps, targetHash, documentHash, maturity, underwriterId, monitorId, settlementAgentId) returns (assetId)`
  - `assets(assetId)` view
  - `markFunded` / `markUnderwritten` / `markMonitored` / `markSettled` / `markRefunded` (role-gated)
- State machine: Registered → Funded → Underwritten → Monitored → Settled; or Refunded from eligible pre-settle states.

- [ ] **Step 1: Write failing registry tests**

```solidity
function test_registerGreenAsset() public {
    // issuer=alice, holder=bob, P=0.04e18, C=0.01e18, three agent ids
    // state Registered
}

function test_registerRejectsIssuerAsHolder() public { /* InvalidHolder */ }
function test_registerRequiresThreeDistinctRoles() public {
    // wrong types revert InvalidAgentType
}
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement GreenAssetRegistry**

```solidity
struct GreenAsset {
    address issuer;
    address holder;
    AssetType assetType;
    uint256 principalWei;
    uint256 couponWei;
    uint16 couponBps;
    bytes32 targetHash;
    bytes32 documentHash;
    uint64 maturity;
    uint256 underwriterId;
    uint256 monitorId;
    uint256 settlementAgentId;
    AssetState state;
}
```

Validations:
- holder != 0 && holder != msg.sender
- principalWei > 0, couponWei > 0
- targetHash != 0, documentHash != 0
- maturity > block.timestamp
- underwriter type Underwriter, monitor ComplianceMonitor, settlement Settlement
- issuer owns all three agent NFTs (controller == msg.sender) — matches v1 pattern for demo control

`setVault` / `setAttestor` once (attestor = Civora facade).

Events: `AssetRegistered`, `AssetStateChanged`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```powershell
git add contracts/src/GreenAssetRegistry.sol contracts/test/CivoraGreen.t.sol
git commit -m "feat(contracts): GreenAssetRegistry state machine"
```

---

### Task 5: SettlementAndPenaltyVault + Reputation wiring

**Files:**
- Create: `contracts/src/SettlementAndPenaltyVault.sol`
- Modify: `contracts/src/Reputation.sol` only if needed (prefer keep vault-only bump)
- Modify: `contracts/test/CivoraGreen.t.sol`

**Interfaces:**
- Produces:
  - `fund(uint256 assetId) payable`
  - `settle(uint256 assetId)`
  - `refund(uint256 assetId)`
  - `emergencyDrain(uint256 assetId)` always ends PermissionDenied after check
- Constants: `PROTOCOL_BPS=300`, `UNDERWRITER_BPS=100`, `MONITOR_BPS=100`, `SETTLEMENT_BPS=100`, `BPS_DENOM=10000`
- Event `Settled(assetId, holderPrincipal, holderCoupon, protocolAmt, uwAmt, monAmt, saAmt, haircutAmt, couponRefundAmt, targetMet)`

**Math (locked):**

```text
P = principalWei
couponBase = approvedCouponWei
haircut = targetMissed ? couponBase * penaltyBps / 10000 : 0
liveCoupon = couponBase - haircut
protocol = liveCoupon * 300 / 10000
uw = liveCoupon * 100 / 10000
mon = liveCoupon * 100 / 10000
sa = liveCoupon * 100 / 10000
holderCoupon = liveCoupon - protocol - uw - mon - sa
holderPrincipal = P
couponRefund = couponWei - couponBase   // unapproved coupon to issuer
// haircut -> treasury (in addition to protocol fee)
// reputation: uw+1, mon+2, sa+1
```

- [ ] **Step 1: Write failing vault tests**

```solidity
function test_fundRequiresPrincipalPlusCoupon() public { /* wrong amount reverts */ }

function test_settleTargetMetSplitsCouponOnly() public {
    // P=1e18, C=0.1e18; holder gets P + 94% of C; fees on C only
}

function test_settleTargetMissedHaircutToTreasury() public {
    // penaltyBps=2000; haircut = 20% of approved coupon to treasury
    // fees on liveCoupon only
}

function test_settleBeforeMonitorReverts() public { /* NotMonitored or InvalidState */ }

function test_emergencyDrainPermissionDenied() public { /* status fail path */ }

function test_reputationOnlyOnSettle() public {
    // scores 0 before; after settle uw=1 mon=2 sa=1
}

function test_rejectUnderwriteRefundsFullEscrow() public { /* issuer receives principal + coupon */ }
function test_expiredFundedAssetRefundsIssuer() public { /* issuer refund after maturity */ }
function test_expiredUnderwrittenAssetWithoutMonitorRefundsIssuer() public { /* issuer refund after underwrite expiry */ }
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement vault**

Caller auth for settle: issuer OR settlement agent wallet OR settlement agent owner.

Require:
- state Monitored
- underwrite Approve, unexpired
- monitor present, unexpired
- `permissions.check(assetId, settlementAgentId, this.settle.selector, principalWei + couponWei)`
- approvedPrincipalWei == principalWei (primary path)

`fund`: msg.value == principal + coupon; markFunded.

`refund`: issuer only; allowed if Funded+reject underwrite, or Funded past maturity without full path, or Underwritten past underwrite expiry without monitor — match design Section 2.

`emergencyDrain`: `permissions.check(... emergencyDrain ...)` then `revert PermissionDenied()`.

- [ ] **Step 4: Tests pass**

```powershell
forge test --match-contract CivoraGreenTest -vv
```

- [ ] **Step 5: Commit**

```powershell
git add contracts/src/SettlementAndPenaltyVault.sol contracts/src/Reputation.sol contracts/test/CivoraGreen.t.sol
git commit -m "feat(contracts): SettlementAndPenaltyVault with coupon haircut economics"
```

---

### Task 6: Civora facade (underwriteCommit + monitorCommit)

**Files:**
- Modify: `contracts/src/Civora.sol`
- Modify: `contracts/test/CivoraGreen.t.sol`

**Interfaces:**
- Produces:
  - `underwriteCommit(assetId, underwriterId, reportHash, decision, approvedPrincipalWei, approvedCouponWei, expiresAt, modelId)`
  - `monitorCommit(assetId, monitorId, reportHash, outcome, penaltyBps, evidenceHash, observedAt, expiresAt, modelId)`
- Frontend uses these as the **only** multi-step credential writes (one signature each).

- [ ] **Step 1: Write failing facade integration tests**

```solidity
function test_underwriteCommitApproveGrantsSettle() public {
    // Funded asset -> underwriteCommit Approve -> Underwritten + grant exists
}

function test_monitorCommitThenSettle() public {
    // full happy path one-liners through facade
}

function test_fullMissedTargetPath() public {
    // monitor TargetMissed 2000 bps -> settle haircut
}
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement Civora.sol**

```solidity
function underwriteCommit(...) external {
    require(identities.ownerOf(underwriterId) == msg.sender, NotController);
    // load asset; state Funded; underwriterId match
    // approvedPrincipalWei == principal on Approve
    // approvedCouponWei <= couponWei
    credentials.submitUnderwrite(...);
    if (decision == Approve) {
        permissions.grant(
            assetId,
            settlementAgentId,
            vault.settle.selector,
            principalWei + couponWei,
            expiresAt
        );
        assets.markUnderwritten(assetId);
    } else {
        // leave Funded for refund path; still store reject credential
        // optional: mark still Funded
    }
}

function monitorCommit(...) external {
    require(identities.ownerOf(monitorId) == msg.sender, NotController);
    // state Underwritten; monitorId match
    // underwrite exists Approve unexpired
    credentials.submitMonitor(...);
    assets.markMonitored(assetId);
}
```

Wire constructor: identity, factory, assets, credentials, permissions, vault, reputation.

- [ ] **Step 4: Full green suite green**

```powershell
forge test -vv
```

If legacy `Civora.t.sol` breaks due to type changes, either update it to compile against shared Types or exclude it:

```powershell
forge test --match-contract CivoraGreenTest -vv
```

Prefer keeping green suite as the gate; fix legacy suite only if cheap.

- [ ] **Step 5: Commit**

```powershell
git add contracts/src/Civora.sol contracts/test/CivoraGreen.t.sol
git commit -m "feat(contracts): Civora facade underwriteCommit and monitorCommit"
```

---

### Task 7: Deploy script + primary deployment on 677

**Files:**
- Modify: `contracts/script/Deploy.s.sol`
- Modify: `deployments/677.json`
- Modify: `.env.example` if needed

**Interfaces:**
- Deploy order from spec Section Deployment.
- Console logs all primary addresses.
- `deployments/677.json` has `primary` and `legacy` blocks.

- [ ] **Step 1: Rewrite Deploy.s.sol**

```solidity
// Deploy:
// identity -> factory -> setFactory
// credentials(identity)
// permissions(identity)
// assets(identity)
// reputation
// vault(identity, assets, credentials, permissions, reputation, treasury)
// civora(identity, factory, assets, credentials, permissions, vault, reputation)
// assets.setVault(vault); assets.setAttestor(civora)
// reputation.setVault(vault)
// credentials.setCivora(civora)
// permissions.setCredentialRegistry(credentials); permissions.setCivora(civora)
```

- [ ] **Step 2: Dry-run locally**

```powershell
cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url bot -vvvv
```

Expected: simulation succeeds with env `PRIVATE_KEY` + `CIVORA_TREASURY`.

- [ ] **Step 3: Broadcast mainnet deploy**

```powershell
forge script script/Deploy.s.sol:Deploy --rpc-url bot --broadcast --verify
```

If auto-verify unavailable, verify each address manually on scan.botchain.ai.

- [ ] **Step 4: Write deployments/677.json**

```json
{
  "chainId": 677,
  "network": "BOT Chain Mainnet",
  "rpc": "https://rpc.botchain.ai",
  "explorer": "https://scan.botchain.ai",
  "deployer": "<deployer>",
  "treasury": "<treasury>",
  "deployedAt": "2026-08-17",
  "primary": {
    "AgentIdentity": "0x...",
    "AgentFactory": "0x...",
    "CredentialRegistry": "0x...",
    "PermissionEngine": "0x...",
    "GreenAssetRegistry": "0x...",
    "Reputation": "0x...",
    "SettlementAndPenaltyVault": "0x...",
    "Civora": "0x..."
  },
  "legacy": {
    "AgentIdentity": "0x5442B5c06d1D4c3165273465d62f04e2bA093d19",
    "AgentFactory": "0xcAF2ADA8743b7f9DA0A96EBb6fB98F76F8810cd8",
    "AttestationRegistry": "0x5D68b1275cb7EB3d6b5b9c09A16241276E959F46",
    "PermissionEngine": "0x88C8FB477A0685c198285bBcAC756B7F67629bc5",
    "InvoiceRegistry": "0xB321a3FAAf9e7C5644f0db9a7753Ef4B9F51b03C",
    "Reputation": "0xE6b144Cb3B14Cb3deA46F9c5c910376C8467B8F9",
    "SettlementVault": "0xA35ca76D1CB392CED9D08108083CF4e97371967B",
    "Civora": "0x33E800223ae882dfFA26871d283287E6A06DD7d9"
  }
}
```

Replace primary `0x...` with real verified addresses from broadcast.

- [ ] **Step 5: Commit**

```powershell
git add contracts/script/Deploy.s.sol deployments/677.json .env.example
git commit -m "feat: deploy primary Civora green protocol on BOT Chain 677"
```

---

### Task 8: Report store + underwrite/monitor APIs

**Files:**
- Create: `apps/web/src/lib/report-store.ts`
- Create: `apps/web/src/lib/report-store.test.ts` (optional if vitest added; else manual route test)
- Modify: `apps/web/src/app/api/underwrite/route.ts`
- Create: `apps/web/src/app/api/monitor/route.ts`
- Modify: `apps/web/src/app/api/reports/[hash]/route.ts`
- Modify: `apps/web/package.json` if adding `@vercel/blob` + vitest
- Modify: `.env.example`

**Interfaces:**
- `putReport(hash: string, raw: string): Promise<void>`
- `getReport(hash: string): Promise<string | null>`
- Underwrite schema `civora.underwrite.v1` fields per spec
- Monitor schema `civora.monitor.v1` fields per spec

- [ ] **Step 1: Implement report-store**

```ts
// Local: REPORT_STORE_DIR or process.cwd()/data/reports
// Blob when BLOB_READ_WRITE_TOKEN set:
// put(`reports/${hash}.json`, raw, { access: "public", addRandomSuffix: false, contentType: "application/json" })
```

- [ ] **Step 2: Rewrite underwrite route for green fields**

Body:

```ts
{
  assetId: string;
  principalWei: string;
  couponWei: string;
  maturity: number;
  holder: string;
  issuer: string;
  targetHash: string;
  documentHash: string;
  assetType: number;
}
```

System prompt: Civora Underwriter for sustainability-linked assets; return only JSON schema; approve principal must equal principalWei; coupon may be capped; reject both zero.

Validate schema, amounts, expiresAt window, canonical hash, `putReport`.

- [ ] **Step 3: Implement monitor route**

Body includes asset context + `evidenceHash`.

System prompt: Compliance Monitor; outcome targetMet|targetMissed; penalty rules; evidence required.

Validate and `putReport`.

- [ ] **Step 4: Wire GET reports to getReport**

- [ ] **Step 5: Manual smoke**

```powershell
cd apps/web
pnpm build
# pnpm dev; POST underwrite and monitor with sample bodies; GET report by hash
```

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/lib/report-store.ts apps/web/src/app/api apps/web/package.json pnpm-lock.yaml .env.example
git commit -m "feat(api): green underwrite and monitor routes with persistent reports"
```

---

### Task 9: Frontend lib — addresses, ABIs, assets index

**Files:**
- Modify: `apps/web/src/lib/civora.ts`
- Create: `apps/web/src/lib/assets.ts`
- Modify: `apps/web/src/lib/agents.ts` (index key bump if needed; decode still works)

**Interfaces:**
- `ADDRESSES` from `deployments/677.json` **primary** only
- `AGENT_TYPE = { Underwriter: 1, ComplianceMonitor: 2, Settlement: 3 }`
- `ASSET_STATE_NAMES`, `ASSET_TYPE_NAMES`
- ABIs: factory, identity, assets register/assets, vault fund/settle/refund/emergencyDrain, civora underwriteCommit/monitorCommit, credentials views, permissions views, reputation
- `IndexedAsset { assetId, registerTx, fundTx?, underwriteTx?, monitorTx?, settleTx?, underwriteReportHash?, monitorReportHash? }`
- Decoders from receipts for AssetRegistered, Funded, Settled, credential events

- [ ] **Step 1: Point ADDRESSES at primary deployment**

- [ ] **Step 2: Implement assets.ts** mirroring invoices.ts patterns (`civora.assets.v1` localStorage)

- [ ] **Step 3: Update agent type names map to three types**

- [ ] **Step 4: `pnpm build` typecheck**

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/civora.ts apps/web/src/lib/assets.ts apps/web/src/lib/agents.ts
git commit -m "feat(web): primary green addresses, ABIs, and asset index"
```

---

### Task 10: Agents page + AppShell nav overwrite

**Files:**
- Modify: `apps/web/src/app/app/agents/page.tsx`
- Modify: `apps/web/src/components/AppShell.tsx`

- [ ] **Step 1: AppShell NAV**

```ts
const NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/agents", label: "Agents" },
  { href: "/app/assets", label: "Assets" },
  { href: "/app/activity", label: "Activity" },
];
```

- [ ] **Step 2: Agents create form**

Select type: Underwriter | Compliance Monitor | Settlement (values 1|2|3).

Table type column uses `AGENT_TYPE_NAMES[1|2|3]`.

- [ ] **Step 3: Build + lint**

```powershell
cd apps/web
pnpm build
pnpm lint
```

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/components/AppShell.tsx apps/web/src/app/app/agents/page.tsx
git commit -m "feat(web): three agent roles and Assets nav"
```

---

### Task 11: Assets page (primary product UI)

**Files:**
- Create: `apps/web/src/app/app/assets/page.tsx`
- Create: `apps/web/src/components/SettlementBreakdown.tsx`
- Create: `apps/web/src/components/AiReportPanel.tsx`
- Modify: `apps/web/src/app/app/invoices/page.tsx` → redirect only

**Interfaces:**
- Multi-step issue form → register tx → fund tx (`principal+coupon`)
- Row actions: Underwrite / Run monitor / Settle by state
- Facade writes for underwriteCommit and monitorCommit
- SettlementBreakdown props: principal, holderCoupon, protocol, uw, mon, sa, haircut, targetMet
- AiReportPanel: full report JSON expandable

- [ ] **Step 1: invoices redirect**

```tsx
// apps/web/src/app/app/invoices/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function InvoicesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/app/assets"); }, [router]);
  return null;
}
```

- [ ] **Step 2: Implement SettlementBreakdown + AiReportPanel**

Badges:
- `Settled · Target Met` → success styles
- `Settled · Coupon Haircut` → warning/amber styles

Breakdown lines exactly:

```text
Principal → Holder (100%)
Coupon → Holder (94%)
Coupon → Protocol (3%)
Coupon → Underwriter (1%)
Coupon → Monitor (1%)
Coupon → Settlement (1%)
Haircut → Treasury   // only if haircut > 0
```

- [ ] **Step 3: Implement assets page**

Form fields:
- assetType select
- holder address
- principal BOT, coupon BOT
- couponBps number (display; stored on-chain)
- maturity datetime-local
- target text → `keccak256(toBytes(targetText))`
- document file → keccak256 file bytes
- underwriterId, monitorId, settlementAgentId from agent index filtered by type

Flows:
1. `writeContractAsync` assets.register
2. wait receipt, decode assetId, persist index, then fund with value principal+coupon
3. Underwrite: POST `/api/underwrite` → show AiReportPanel → underwriteCommit
4. Monitor: user provides evidence text → evidenceHash; POST `/api/monitor` → monitorCommit
5. Settle: vault.settle → decode Settled → SettlementBreakdown
6. Drain card: emergencyDrain → show PermissionDenied failed tx

Capture `nowTs` with useState initializer for lint purity (no Date.now in render).

- [ ] **Step 4: Build + lint**

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/app/assets apps/web/src/app/app/invoices/page.tsx apps/web/src/components/SettlementBreakdown.tsx apps/web/src/components/AiReportPanel.tsx
git commit -m "feat(web): Assets page with underwrite, monitor, haircut settle UI"
```

---

### Task 12: Dashboard, Activity, Landing overwrite

**Files:**
- Modify: `apps/web/src/app/app/page.tsx`
- Modify: `apps/web/src/app/app/activity/page.tsx`
- Modify: `apps/web/src/app/page.tsx`

- [ ] **Step 1: Dashboard metrics**

Replace invoice counters with asset counters (`assetExists` via assets(assetId).issuer != 0).  
CTA: Issue Asset → `/app/assets?new=1`.  
Recent activity from agent + asset indexes (never stale placeholder if index non-empty).

- [ ] **Step 2: Activity timeline**

Decode green lifecycle events; labels for Underwritten, Monitored, Settled (met vs haircut if event flag available).

- [ ] **Step 3: Landing**

Overwrite pitch to sustainability-linked RWA + AI agents.  
Flow steps: Issue → AI underwrite → AI monitor → Settle or haircut.  
CTAs: Connect, Launch App, optional See live proof.  
Research #06 safe language only.

- [ ] **Step 4: Build + lint**

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/app/page.tsx apps/web/src/app/app/page.tsx apps/web/src/app/app/activity/page.tsx
git commit -m "feat(web): dashboard, activity, landing for green Civora product"
```

---

### Task 13: Docs cutover (LOCKED_SCOPE, README, runbook, submission)

**Files:**
- Modify: `LOCKED_SCOPE.md`
- Modify: `README.md`
- Create: `DEMO_RUNBOOK.md`
- Create: `SUBMISSION.md`
- Modify: `BUILD_PLAN.md` status note if useful

- [ ] **Step 1: LOCKED_SCOPE overwrite** to green must-haves (3 agents, assets, monitor, haircut, pages)

- [ ] **Step 2: README** primary green addresses, loops (met + missed), legacy appendix for invoice #1 txs

- [ ] **Step 3: DEMO_RUNBOOK** pre-demo agent setup, 0.04+0.01 amounts, holder ≠ treasury, both paths, drain

- [ ] **Step 4: SUBMISSION** track alignment, AI-core argument, RWA loop, BOT why, economics, compliance boundary, roadmap (mesh/DePIN deferred)

- [ ] **Step 5: Commit**

```powershell
git add LOCKED_SCOPE.md README.md DEMO_RUNBOOK.md SUBMISSION.md BUILD_PLAN.md
git commit -m "docs: freeze Civora green RWA scope and submission materials"
```

---

### Task 14: Mainnet E2E + public host + final gate

**Files:** none required beyond fixes discovered in QA

- [ ] **Step 1: Fresh agents on primary factory** (UW, Monitor, SA)

- [ ] **Step 2: Target-met path on mainnet** — record all txs

- [ ] **Step 3: Target-missed path on mainnet** — penaltyBps 2000, verify haircut to treasury, fees on live coupon only

- [ ] **Step 4: Drain attempt** — Failed + PermissionDenied on explorer

- [ ] **Step 5: Host apps/web** with env vars; Blob token set; cold-start report GET works

- [ ] **Step 6: Final verification**

```powershell
cd contracts
forge test --match-contract CivoraGreenTest -vv
cd ../apps/web
pnpm build
pnpm lint
cd ..
git status --short
```

- [ ] **Step 7: Update README/DEMO_RUNBOOK with public URL + new proof txs; commit; push when user asks**

```powershell
git add README.md DEMO_RUNBOOK.md SUBMISSION.md deployments/677.json
git commit -m "docs: mainnet green demo proofs and public URL"
```

---

## Final Acceptance Gate

- [ ] Three agent types creatable and typed on-chain
- [ ] Green asset register + fund (P+C) on 677
- [ ] Real GMI underwrite → facade commit → Underwritten + settle grant
- [ ] Real GMI monitor met and missed → Monitored
- [ ] Settle: principal 100% holder; coupon 94/3/1/1/1; haircut 100% treasury on miss
- [ ] Reputation +1/+2/+1 only on settle
- [ ] emergencyDrain fails PermissionDenied
- [ ] `/app/assets` primary; invoices redirects
- [ ] Settlement breakdown + dual badges + expandable AI reports
- [ ] Activity timeline with explorer links
- [ ] Public site live; reports survive cold start
- [ ] Legacy v1 preserved in deployments + explorer history
- [ ] README/LOCKED_SCOPE/submission match product

## Spec Coverage Map

| Spec section | Tasks |
|---|---|
| 3 agent types | 1, 10 |
| CredentialRegistry | 2, 6 |
| PermissionEngine asset grants | 3, 6 |
| GreenAssetRegistry | 4 |
| SettlementAndPenaltyVault economics | 5 |
| Facade commits | 6, 11 |
| Deploy primary+legacy | 7 |
| Underwrite/monitor APIs + Blob | 8 |
| Frontend assets UX + polish | 9–12 |
| Docs/submission | 13 |
| Mainnet E2E + public host | 14 |

## Notes for implementers

- Cast path on this machine: `& "$env:USERPROFILE\.foundry\bin\cast.exe"`.
- `waitForTransactionReceipt` via `publicClient.waitForTransactionReceipt`, not viem root export.
- React 19 purity: no `Date.now()` during render.
- Do not delete v1 contract source or legacy explorer history.
- If time pressure hits, **do not** cut monitor or haircut; cut only optional public proof page extras after the core loop is live.
