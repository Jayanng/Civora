# Civora Green RWA Overwrite Design

**Status:** Approved
**Date:** 2026-08-17
**Product name:** Civora
**Primary track:** RWA Applications
**Secondary alignment:** AI Native Applications

## Decision

Civora will overwrite its invoice-first product surface with a sustainability-linked RWA lifecycle while preserving the existing deployed invoice contracts and transaction history as legacy mainnet proof.

The product remains Civora. VerdeAgent is not a separate brand. The primary product is an agent-operated sustainability-linked bond / green receivable protocol on BOT Chain Mainnet 677.

The full scope is retained:

- Specialized Underwriter, Compliance Monitor, and Settlement agents
- ERC-721-style agent identity and dedicated AgentWallet contracts
- Hash-locked AI underwriting and monitoring credentials
- Scoped selector, value, and time permissions
- Sustainability target monitoring
- Coupon haircut when a target is missed
- Native BOT escrow and conditional settlement
- Agent wallet revenue and reputation updates
- Full receipt-indexed activity with Explorer links
- Public website, wallet connection, verified Mainnet contracts, and complete demo loop

## Product Positioning

**Tagline:** Autonomous Agents. Real Assets. On-Chain Trust.

**One-sentence pitch:** Civora is an agent-operated sustainability-linked RWA protocol where AI agents underwrite assets, monitor sustainability commitments, enforce permissions, and settle principal and coupon value on BOT Chain.

The asset types are deliberately narrow for the primary release:

- `SustainabilityLinkedBond`
- `GreenReceivable`

Both use the same lifecycle and vault. The asset type is metadata and UI context, not a second settlement implementation.

## Compatibility and Cutover

The existing v1 contracts are immutable and invoice-coupled. They cannot be safely modified in place because their storage contains the completed invoice flow and their APIs require invoice-specific state.

The cutover therefore uses a new primary deployment on the same BOT Chain Mainnet:

- New Civora contracts become the only primary product path in the frontend.
- Existing invoice v1 contracts remain deployed and verifiable.
- Existing invoice #1, settlement, fee, reputation, and failed drain transactions remain historical proof.
- The v1 contracts are not linked as the primary navigation or write path.
- README may retain a clearly labelled legacy invoice proof appendix.

The deployment manifest must make the distinction explicit:

```json
{
  "chainId": 677,
  "network": "BOT Chain Mainnet",
  "rpc": "https://rpc.botchain.ai",
  "explorer": "https://scan.botchain.ai",
  "primary": {
    "Civora": "primary deployment address",
    "AgentIdentity": "primary deployment address",
    "AgentFactory": "primary deployment address",
    "CredentialRegistry": "primary deployment address",
    "PermissionEngine": "primary deployment address",
    "GreenAssetRegistry": "primary deployment address",
    "Reputation": "primary deployment address",
    "SettlementAndPenaltyVault": "primary deployment address"
  },
  "legacy": {
    "Civora": "0x33E800223ae882dfFA26871d283287E6A06DD7d9",
    "AgentIdentity": "0x5442B5c06d1D4c3165273465d62f04e2ba093d19",
    "AgentFactory": "0xcAF2ADA8743b7f9DA0A96EBb6fB98F76F8810cd8",
    "AttestationRegistry": "0x5D68b1275cb7EB3d6b5b9c09A16241276E959F46",
    "PermissionEngine": "0x88C8FB477A0685c198285bBcAC756B7F67629bc5",
    "InvoiceRegistry": "0xB321a3FAAf9e7C5644f0db9a7753Ef4B9F51b03C",
    "Reputation": "0xE6b144Cb3B14Cb3deA46F9c5c910376C8467B8F9",
    "SettlementVault": "0xA35ca76D1CB392CED9D08108083CF4e97371967B"
  }
}
```

The addresses in `primary` are populated only after deployment and Explorer verification. The existing legacy values are retained exactly.

## Contract Architecture

### AgentIdentity, AgentFactory, and AgentWallet

The primary deployment retains the existing identity and wallet pattern while extending `AgentType`:

```solidity
enum AgentType {
    None,
    Underwriter,
    ComplianceMonitor,
    Settlement
}
```

Each agent receives:

- An ERC-721 identity
- A name and token URI
- A dedicated smart-contract wallet
- ERC-1271 signature validation
- A controller determined by current identity ownership

The three agent roles are distinct in the product and in contract validation. A Settlement agent cannot submit underwriting or monitoring credentials.

### CredentialRegistry

`CredentialRegistry` replaces the invoice-coupled v1 attestation registry. It is keyed by `assetId` and supports one immutable credential of each required kind per asset.

Required kinds:

```solidity
    None,
    Underwrite,
    Monitor
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
```

Underwrite credential fields:

- `assetId`
- `agentId`
- `reportHash`
- `decision`
- `approvedPrincipalWei`
- `approvedCouponWei`
- `expiresAt`
- `modelId`
- `issuedAt`

Monitor credential fields:

- `assetId`
- `agentId`
- `reportHash`
- `outcome`
- `penaltyBps`
- `evidenceHash`
- `observedAt`
- `expiresAt`
- `modelId`
- `issuedAt`

The registry validates agent type, controller authorization, one-time write semantics, report hash nonzero, and time bounds. It does not call `InvoiceRegistry` or depend on invoice states.

### PermissionEngine

The primary `PermissionEngine` is generalized around `assetId`:

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

The grant key is `(assetId, agentId, selector)`. `grant` is callable by Civora or the controller of the Underwriter that approved the asset. `check` enforces revocation, expiry, selector identity, and value cap.

The settlement selector receives a grant after an approved underwriting credential. Its `maxValue` is the full funded escrow (`principalWei + couponWei`) so settlement can pay the holder, fees, haircut, and any unapproved coupon refund. The `emergencyDrain` selector is never granted and always demonstrates `PermissionDenied`.

### GreenAssetRegistry

The asset record is:

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

The state enum is:

```solidity
    None,
    Registered,
    Funded,
    Underwritten,
    Monitored,
    Settled,
    Refunded
}
```

The normal path is:

```text
Registered -> Funded -> Underwritten -> Monitored -> Settled
```

Reject, expiry, or an eligible pre-settlement exit leads to `Refunded`. A missed sustainability target does not create a separate final state; it is still `Settled` with `couponHaircutApplied = true` in the settlement result/event.

Registration validates nonzero holder, amount, target, document hash, future maturity, valid agent IDs, correct agent types, and issuer/holder separation.

### SettlementAndPenaltyVault

The vault is the only primary contract that moves native BOT.

Funding requires:

```text
msg.value == principalWei + couponWei
```

Settlement requires:

- State `Monitored`
- Underwrite credential with `Approve`
- Monitor credential present and unexpired
- Settlement permission grant valid
- Settlement caller is issuer, settlement agent wallet, or settlement agent controller

The primary Civora facade is the frontend’s write path for `underwriteCommit` and `monitorCommit`. The frontend calls the vault directly only for fund, settle, and refund operations.

## AI Schemas and Facade Flow

### Underwrite API

`POST /api/underwrite` receives the asset fields from the frontend, reads or validates the canonical values, and calls GMI with the locked underwriter prompt.

The response schema is:

```json
{
  "schema": "civora.underwrite.v1",
  "decision": "approve",
  "approvedPrincipalWei": "40000000000000000",
  "approvedCouponWei": "10000000000000000",
  "expiresAt": 0,
  "riskScore": 0,
  "conditions": [],
  "reasoning": "",
  "model": "deepseek-ai/DeepSeek-V4-Flash"
}
```

Rules:

- Reject requires both approved amounts to be `0`.
- Approve requires `approvedPrincipalWei == principalWei` for the primary path.
- Approve permits `approvedCouponWei <= couponWei` and requires it to be positive.
- `expiresAt` must be more than ten minutes ahead and no later than maturity.
- Canonical sorted-key JSON is hashed with keccak256 and stored by report hash.

The frontend calls the primary facade:

```solidity
function underwriteCommit(
    uint256 assetId,
    uint256 underwriterId,
    bytes32 reportHash,
    UnderwriteDecision decision,
    uint256 approvedPrincipalWei,
    uint256 approvedCouponWei,
    uint64 expiresAt,
    bytes32 modelId
) external;
```

This one transaction writes the credential, moves the registry to `Underwritten` on approval, and creates the Settlement agent’s scoped settle grant.

### Monitor API

`POST /api/monitor` runs the real GMI Compliance Monitor prompt.

The response schema is:

```json
{
  "schema": "civora.monitor.v1",
  "outcome": "targetMet",
  "penaltyBps": 0,
  "evidenceHash": "0x1111111111111111111111111111111111111111111111111111111111111111",
  "observedAt": 0,
  "expiresAt": 0,
  "riskScore": 0,
  "findings": [],
  "reasoning": "",
  "model": "deepseek-ai/DeepSeek-V4-Flash"
}
```

Rules:

- `targetMet` requires `penaltyBps == 0`.
- `targetMissed` requires `penaltyBps` from `1` through `10000`.
- `evidenceHash` is nonzero and represents a canonical status note or evidence payload.
- `observedAt` cannot be in the future.
- `expiresAt` must be more than ten minutes ahead and no later than maturity.
- Canonical sorted-key JSON is hashed and stored by report hash.

The frontend calls the primary facade:

```solidity
function monitorCommit(
    uint256 assetId,
    uint256 monitorId,
    bytes32 reportHash,
    MonitorOutcome outcome,
    uint16 penaltyBps,
    bytes32 evidenceHash,
    uint64 observedAt,
    uint64 expiresAt,
    bytes32 modelId
) external;
```

This one transaction writes the monitor credential and moves the registry to `Monitored`.

### Report storage

Production uses Blob or an equivalent persistent object store. Local development uses the filesystem adapter. The report route always returns the canonical JSON and must remain addressable by the hash committed on-chain after redeploys and cold starts.

Missing GMI configuration returns `503 underwriter unavailable` or `503 monitor unavailable`. There is no mock AI path.

## Fee and Haircut Math

Principal is never charged a protocol or agent fee:

```text
holderPrincipal = principalWei
```

The approved coupon is the coupon base. Any coupon not approved by the Underwriter is refunded to the issuer at settlement.

For target met:

```text
couponBase = approvedCouponWei
haircut = 0
liveCoupon = couponBase
protocolAmt = liveCoupon * 300 / 10000
underwriterAmt = liveCoupon * 100 / 10000
monitorAmt = liveCoupon * 100 / 10000
settlementAmt = liveCoupon * 100 / 10000
holderCoupon = liveCoupon - protocolAmt - underwriterAmt - monitorAmt - settlementAmt
```

The coupon distribution is therefore:

| Recipient | Share of live coupon |
|---|---:|
| Holder | 94% |
| Protocol treasury | 3% |
| Underwriter wallet | 1% |
| Compliance Monitor wallet | 1% |
| Settlement wallet | 1% |

For target missed:

```text
haircut = couponBase * penaltyBps / 10000
liveCoupon = couponBase - haircut
```

The same 3/1/1/1 fee percentages apply to `liveCoupon`. The entire haircut goes to the protocol treasury. This prevents the monitor from financially benefiting from declaring a missed target; the monitor still receives its 1% fee from the live coupon when settlement succeeds.

Principal, live coupon, haircut, and any unapproved coupon refund are emitted in the settlement event. Rounding dust from coupon operations goes to the holder coupon.

### Reputation

Reputation is updated only after a successful permissioned settlement:

- Underwriter: `+1`
- Compliance Monitor: `+2`
- Settlement: `+1`

No score changes occur for rejection, refund, failed monitor, failed settlement, or blocked drain attempts.

## Frontend Product Surface

### Landing `/`

The landing page is overwritten with Civora’s green RWA positioning:

- Sustainability-linked asset headline
- AI Underwrite -> AI Monitor -> Conditional Settle flow
- BOT Chain 677 and native BOT proof
- Wallet connect and Launch App
- Public live proof link
- Language aligned with BOT Research Series #06; no Launchpad V1 availability claim

### Dashboard `/app`

Live cards show:

- Active Agents
- Registered Assets
- Total Settled and value
- Your Agent Reputation

Primary actions are `Create Agent` and `Issue Asset`. Recent activity is receipt-indexed and never displays an empty-state message when local indexes contain events.

### Agents `/app/agents`

The create form supports Underwriter, Compliance Monitor, and Settlement. The table and detail view show identity, wallet, balance, role, credentials, permissions, and reputation.

### Assets `/app/assets`

`/app/invoices` is no longer the primary route. It redirects to `/app/assets`.

The asset form collects:

- Asset type
- Holder
- Principal and coupon
- Coupon BPS display value
- Maturity
- Sustainability target text
- Document file hash
- Underwriter, Compliance Monitor, and Settlement agent IDs

The target text is never treated as a legal claim. Its canonical hash is stored on-chain.

Asset rows expose the current state and direct transaction links. State actions are:

- Funded: `Underwrite`
- Underwritten: `Run monitor`
- Monitored: `Settle`

### Required settlement polish

After settlement, show a Settlement Breakdown card:

```text
Principal -> Holder (100%)
Coupon -> Holder (94%)
Coupon -> Protocol (3%)
Coupon -> Underwriter (1%)
Coupon -> Monitor (1%)
Coupon -> Settlement (1%)
```

When a haircut applies, show:

```text
Haircut -> Treasury
```

State badges are visually distinct:

- `Settled · Target Met` in green
- `Settled · Coupon Haircut` in amber/orange

Underwrite and Monitor panels expose the complete AI report in an expandable section:

- Decision or outcome
- Reasoning
- Model
- Risk score
- Conditions or findings
- Report hash
- Direct report endpoint and Explorer commit link

### Activity `/app/activity`

The receipt index records AgentCreated, AssetRegistered, Funded, Underwritten, Monitored, Settled, Refunded, and failed drain transactions. No historical `eth_getLogs` call is used. Each item includes a block timestamp and direct Explorer link.

## Demo Flow

### Target met path

1. Connect wallet and switch to BOT Chain 677.
2. Use pre-created Underwriter, Compliance Monitor, and Settlement agents.
3. Issue a 0.04 BOT principal plus 0.01 BOT coupon asset to a holder address distinct from the treasury.
4. Fund exactly 0.05 BOT.
5. Run real GMI underwriting and commit through `Civora.underwriteCommit`.
6. Run real GMI monitoring with `targetMet` and commit through `Civora.monitorCommit`.
7. Settle: principal goes fully to the holder; coupon pays holder and the three agent/protocol recipients.
8. Show reputation updates, settlement breakdown, and Explorer links.
9. Attempt `emergencyDrain`; show failed transaction with `PermissionDenied()`.

### Target missed path

The same setup uses a monitor result with `targetMissed` and `penaltyBps = 2000`:

- Principal still goes 100% to the holder.
- 20% of the approved coupon goes to the protocol treasury as haircut.
- Fees apply only to the remaining live coupon.
- UI shows `Settled · Coupon Haircut` and the full breakdown.

The demo setup is prepared before recording so the judge sees the complete business loop within 90-120 seconds rather than waiting for agent creation and environment setup.

## Deployment and Verification

Primary deployment order:

1. AgentIdentity
2. AgentFactory
3. CredentialRegistry
4. PermissionEngine
5. GreenAssetRegistry
6. Reputation
7. SettlementAndPenaltyVault
8. Civora facade
9. Wire registry, permission, attestor, vault, and facade addresses
10. Verify every primary contract on `scan.botchain.ai`
11. Write the primary and legacy blocks to `deployments/677.json`
12. Point `apps/web/src/lib/civora.ts` to primary addresses only

Required hosted environment:

```text
GMI_API_KEY
GMI_MODEL=deepseek-ai/DeepSeek-V4-Flash
GMI_BASE_URL=https://api.gmi-serving.com/v1
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_CHAIN_ID=677
BLOB_READ_WRITE_TOKEN
PRIVATE_KEY (deployment machine only)
CIVORA_TREASURY
```

The public frontend is deployed with `apps/web` as the application root. Report persistence uses Blob in production and filesystem storage only in local development.

## Testing and Acceptance

### Foundry tests

Tests must cover:

- Agent type validation for all three roles
- Asset registration and exact principal-plus-coupon funding
- Underwrite approve and reject paths
- Full-principal approval and coupon cap validation
- Monitor target met with zero penalty
- Monitor target missed with penalty bounds
- Settlement blocked before monitoring
- Settlement blocked without valid permission
- Principal paid 100% to holder
- Coupon fees calculated only from live coupon
- Haircut paid fully to treasury
- Unapproved coupon refunded to issuer
- Reputation updates only after successful settlement
- Refund paths and state transitions
- Failed emergency drain with `PermissionDenied`
- Reentrancy and transfer failure paths

### Frontend verification

The release gate requires:

- `pnpm build`
- `pnpm lint`
- Public landing page without a wallet
- Wallet and chain 677 enforcement
- Underwrite and monitor report hash equality with stored JSON
- Assets page complete lifecycle on mainnet
- Settlement breakdown and badges for both target outcomes
- Expandable full AI reports
- Activity timeline with Explorer links
- Mobile layout pass
- Fresh-wallet runbook and public URL

## Compliance Boundary and Language

Civora proves controlled issuance, credentialed agent decisions, permissioned settlement, and transparent coupon economics. A document hash is not a legal opinion, proof of ownership, KYC/KYB, sanctions clearance, or verified emissions measurement.

Production roadmap language must name the required additions:

- KYB/KYC and sanctions screening
- Legal receivables or bond documentation
- Independent verification of sustainability evidence
- Regulated custody and investor eligibility
- Oracle/data-provider governance

The product must use:

> Designed for seamless future integration with BOT Chain’s AI Agent infrastructure.

It must not claim live integration with an unavailable BOT Launchpad product.
