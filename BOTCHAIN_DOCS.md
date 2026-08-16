# Civora — BOT Chain Official Documentation
**Source:** https://dev-docs.botchain.ai/ (extracted live on 2026-08-17)

---

## Introduction

**BOT Chain is an EVM-compatible Layer 1 for DePIN and AI applications.**

This documentation covers network configuration, RPC, test tokens, contract deployment, verification, and ecosystem protocols.

---

## Key Features & Advantages

### 1. Full Ethereum Virtual Machine (EVM) Compatibility

BOT Chain is 100% EVM-compatible, allowing developers to migrate Ethereum-based DApps and DeFi projects with almost zero code changes.

**Compatible tools:**
- MetaMask
- Trust Wallet
- Truffle
- Remix

### 2. Ultra-Low Fees & Lightning-Fast Confirmations

- Average transaction fees: **~$0.06** (as of early 2025)
- Block times: **≈0.75 seconds**
- Near-instant, cost-effective transactions

### 3. Role of the BOT Token

BOT is the native utility and governance token of the BOT Chain ecosystem:

| Function | Description |
|----------|-------------|
| **Paying Transaction Fees** | Economical fuel for all on-chain activity |
| **Staking** | Delegate BOT to validators, earn rewards, help secure the network |
| **Governance** | BOT holders vote on protocol upgrades and future direction |

### 4. Future Prospects

BOT Chain is emerging as a leading force in blockchain, especially in DeFi and decentralized applications. By combining blazing speed, minimal costs, and deep interoperability, it directly tackles today's most critical scalability and usability challenges.

---

## Ecosystem Protocols & Tools

### DEX (BDEX)
- **V2:** Uniswap V2-style automated market maker
- **V3:** Concentrated liquidity (Uniswap V3-style)
- URL: https://dex.botchain.ai/

### Bridge
- **Assets:** USDT only (Lock & Release mechanism)
- **Chains:** Ethereum, BNB Chain, Tron
- URL: https://bridge.botchain.ai/

### Liquidity Locker
- ERC20 LP position locks
- ERC721 position locks

### Staking
- Validator staking with slashing conditions
- BOT token staking for rewards

### EOA Paymaster
- Gasless transactions for EOA wallets
- Paymaster covers gas fees for users

### Blob API
- EIP-4844 blob data support
- TheGraph integration
- Covalent integration

### Node Deployment
- Full node deployment
- Archive node deployment
- Fast node deployment

### Wallets
- BO Wallet (native)
- MetaMask (EVM-compatible)

### Faucet
- Testnet faucet: https://faucet.botchain.ai/basic/

---

## Network Configuration

### Mainnet
- **Chain ID:** 677 (0x2a5)
- **RPC:** https://rpc.botchain.ai
- **Explorer:** https://scan.botchain.ai

### Testnet
- **Faucet:** https://faucet.botchain.ai/basic/

---

## Developer Quick Guide

- Wallet connection with network switching
- Contract deployment to BOT Chain
- Contract verification process
- Using MetaMask with BOT Chain
- Test token acquisition

---

## Verified Contracts on Mainnet (as of Aug 16, 2026)

| Contract | Address | Type | Status |
|----------|---------|------|--------|
| CaryPact (CA) | `0x546307af427902a75771434df831d88219784e19` | ERC-20 | Verified |
| BOTValidatorSet | Active in nearly every block | Staking | Live |
| Bridge/DEX | `0x143b0cf8a34b7bfd794d64e0e565155f0904902b` | Infrastructure | 18KB |

**Contract verification count:** 628 out of 1345 total contracts verified

---

## Known Gaps (No Official Documentation Found)

The following are explicitly NOT documented in official sources:

1. No smart contract templates beyond DEX/Bridge
2. No AI agent SDK or API documentation
3. No RWA asset registry or compliance framework
4. No oracle documentation (beyond bridge's one-way USDT flow)
5. No account abstraction (ERC-4337) documentation
6. No attestation/proof primitives documentation
7. No ticketing/subscription/recurring payment standards
8. No NFT standards beyond inherited ERC-721

**Note:** BOT Chain markets itself as "AI-native L1 for DePIN and AI" but has not published AI infrastructure documentation.

---

## Official URLs

| Resource | URL |
|----------|-----|
| Main Website | https://www.botchain.ai/ |
| Developer Docs | https://dev-docs.botchain.ai/ |
| Block Explorer | https://scan.botchain.ai/ |
| Bridge | https://bridge.botchain.ai/ |
| DEX | https://dex.botchain.ai/ |
| Wallet | https://wallet.botchain.ai/ |
| Testnet Faucet | https://faucet.botchain.ai/basic/ |
| Ecosystem Support | https://www.botchain.ai/ecosystem-support |
| Integration Guide | https://docs.google.com/document/d/1xYzdfJlD08UOV9CKE3nV7NTSQg6lPz9B17aIW2NF5Wg/edit |

---

*Extracted from official BOT Chain developer documentation on 2026-08-17.*