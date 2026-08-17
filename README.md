# Civora
**Autonomous Agents. Real Assets. On-Chain Trust.**

Civora is an agent-operated sustainability-linked RWA protocol on BOT Chain Mainnet. Specialized Underwriter, Compliance Monitor, and Settlement agents register, evaluate, monitor, and settle green assets under explicit on-chain permissions.

## Primary Green Deployment

- Network: BOT Chain Mainnet, chain ID `677`
- RPC: `https://rpc.botchain.ai`
- Explorer: `https://scan.botchain.ai`
- Treasury: `0x25df058A6BF583542E69DB26cA0646C7F30B1567`

| Contract | Address |
|---|---|
| AgentIdentity | `0x9D59Ad33e1BF4F85695245B7ab14F1E613Ff36D2` |
| AgentFactory | `0xcd447F7eB818c4c9C88c89D4Ea73B6B3Ee207b30` |
| CredentialRegistry | `0x077C7700c8FAaa6B9b79edac356D52Ea42356Cd0` |
| GreenPermissionEngine | `0xbE063c28DC9ae7Aa3512c7Be4De24003d6B74b10` |
| GreenAssetRegistry | `0x2b282A37C33903aa7846804f2eaEB0F6dE08FCe8` |
| Reputation | `0xD0b54BC0492af7c5D1A2C53120981B2c53647CBe` |
| SettlementAndPenaltyVault | `0xCd6B48E2E31970397d382ac1B9D148a3b3f87DF4` |
| Civora facade | `0x9Db3420Ce7AF793a0759B3b2DEd1C08D2CADE7a4` |

## Product Loop

1. **Issue** a Sustainability-Linked Bond or Green Receivable with principal, coupon, maturity, target hash, document hash, and assigned agents.
2. **Fund** the asset with principal plus coupon in native BOT.
3. **Underwrite** with a real GMI DeepSeek-V4-Flash decision. The approved principal/coupon becomes a scoped settlement permission.
4. **Monitor** with a second real GMI agent. It commits `TargetMet` or `TargetMissed` plus evidence hash and penalty basis points.
5. **Settle** principal 100% to the holder. Fees apply only to the live coupon: Holder 94%, Protocol 3%, Underwriter 1%, Monitor 1%, Settlement 1%.
6. **Apply a coupon haircut** when the sustainability target is missed. The haircut goes 100% to the protocol treasury; principal is never slashed.
7. **Reputate agents** only after successful permissioned settlement: Underwriter +1, Monitor +2, Settlement +1.
8. **Block unauthorized actions** with a real `PermissionDenied()` transaction.

## AI Is the Policy

Civora does not use AI for copywriting. The AI output becomes the on-chain control surface:

```text
GMI report -> CredentialRegistry -> PermissionEngine maxValue/selector/expiry -> Vault settlement
```

Underwrite reports use `civora.underwrite.v1`. Monitor reports use `civora.monitor.v1`. Canonical sorted-key JSON is stored by report hash, and the same hash is committed on-chain.

## Agents

- **Underwriter:** approves principal and caps eligible coupon.
- **Compliance Monitor:** evaluates target evidence and sets `TargetMet` or `TargetMissed` with `penaltyBps`.
- **Settlement:** executes the permissioned payout through the vault.

Each agent has an ERC-721-style identity and dedicated AgentWallet. The implementation follows patterns BOT Chain has publicly referenced, including the identity, credential, permission, and reputation direction in Research Series #06.

## Frontend

The primary app sections are:

- `/` — Civora sustainability-linked RWA landing page
- `/demo` — wallet-free live proof view for primary asset #1
- `/app` — live dashboard
- `/app/agents` — three agent roles and wallets
- `/app/assets` — issue, fund, underwrite, monitor, settle
- `/app/activity` — receipt-indexed lifecycle timeline

The RPC does not support `eth_getLogs`, so the frontend indexes transaction receipts in local storage and links every known transaction directly to the BOT Explorer.

## Local Development

Prerequisites: Node 24+, pnpm, Foundry, a BOT Chain 677 wallet, and a GMI API key.

```bash
pnpm install
pnpm --filter @civora/web dev
```

Required environment values are listed in `.env.example`:

```text
GMI_API_KEY=
GMI_MODEL=deepseek-ai/DeepSeek-V4-Flash
GMI_BASE_URL=https://api.gmi-serving.com/v1
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_CHAIN_ID=677
BLOB_READ_WRITE_TOKEN=
```

`BLOB_READ_WRITE_TOKEN` is required for persistent production reports. Local development falls back to `apps/web/data/reports`.

Contracts:

```bash
cd contracts
forge test
```

## Legacy Invoice Proof

The original invoice-first Civora deployment remains on BOT Chain as historical proof. It is preserved in `deployments/677.json.legacy` and remains verifiable:

- Legacy register: `0x1d5c011be88c62e30634fa08e69c844bde450570ce202ff4b5c7af706ec1feff`
- Legacy fund: `0xfc4aab33c69d8c550e80f0b5764dcb854aa859f749e7258a5aa32a142011ea8e`
- Legacy underwrite/attest: `0x1f798bacec3c1b8f78e34725c8fd81e0243100ee643f6934a7925e8b15c12124`
- Legacy settle: `0xc972763d2a6fd3e5bab68f43e3106c0b9cb7aec13444dd53bd4a962e6cc11a8c`
- Legacy unauthorized drain: `0x5f76df884b4b04a4a8c28f50c5cac967dcfe15ff76645ce1e2b74a93509209b7`

The green deployment is Civora's primary product. The invoice deployment is not deleted and is not the primary app path.

## Compliance Boundary

Civora proves controlled issuance, hash-locked agent decisions, permissioned settlement, transparent coupon economics, and auditable target outcomes. A document hash is not a legal opinion, proof of ownership, KYC/KYB, sanctions clearance, or verified emissions measurement.

Production deployment requires legal asset documentation, regulated custody, investor eligibility, independent sustainability evidence, sanctions screening, and oracle/data-provider governance.

## Roadmap

- Multi-agent mesh attestation
- DePIN compute and other asset adapters
- Trade finance and letters of credit
- Governance and dispute resolution
- SDK for third-party RWA builders

## BOT Chain Positioning

Civora is designed for seamless future integration with BOT Chain's AI Agent infrastructure. It uses native BOT for escrow and settlement, verified contracts on chain 677, BOT Explorer proof, and reusable identity/credential/permission primitives for the ecosystem's RWA direction.

## References

- [BOT Chain Research Series #06](https://medium.com/@BOTChain_ai/ai-agent-identity-on-blockchain-dids-credentials-and-permission-boundaries-3c35106154d3)
- [BOT Chain Developer Docs](https://dev-docs.botchain.ai/docs/Developers/quick-guide/)
- [BOT Chain Mainnet Explorer](https://scan.botchain.ai)

## License

MIT
