# Civora Green RWA Demo Runbook

## Demo Setup

- Network: BOT Chain Mainnet 677
- RPC: `https://rpc.botchain.ai`
- Explorer: `https://scan.botchain.ai`
- Primary app: `/app/assets`
- Demo escrow: `0.04 BOT principal + 0.01 BOT coupon = 0.05 BOT`
- Holder: dedicated demo holder address, distinct from treasury
- Agent roles: Underwriter, Compliance Monitor, Settlement

## Recorded Mainnet Proof

Target-met asset #1:

- Register: `0xcafb3cd31e762f31e9ce7c6a42cd972f317bedd4634327c3e5b1d71d8a8f16fb`
- Fund: `0xe5670cca0a6ee303b5cd9b138648c0da24add1bf9d0930edfe6727c58175e882`
- Underwrite: `0xf24c19a294de89f272c43385084967c4f6e4f2c9f8cdf5f5728888a81c274a63`
- Monitor: `0x0df4ada6a389ef31c6c8b313016b6e3af314693e12c1f2b076448c23ca88a6f8`
- Settle: `0xca0fd3b11ea39fa939a99ebd5f1bc3537aca57b8ffa96dfac341fe4c81adaab9`
- Drain failed: `0xab6ea040ddb9c294e01d45ae29953dcacacf8ae05e43c441d3c0d860e5fa6e41`

Target-missed asset #3:

- Register: `0xb24a1473c4ee5f8c7edbf88b755262454890f106a02e19e9b800b07ad11ac235`
- Fund: `0xb53128299a41f46bbb10394416b126d835f9a5e7728274d7e0e462279efd9c39`
- Underwrite: `0x12a9e71ca4d6abda26e93d3318919d4b5b73ce40f0a87bc7e9796b09aa3343d4`
- Monitor: `0xd471c547261a501105ef28929c84954df4fbaa875e2785f7f73a37ebcda53ebf`
- Settle: `0x887547b7fed1406d0a9fb9ccc956997415eaecf17876c4fad46d163575bb93d8`

Create the three agents before recording. The connected issuer must own all three selected agent identities because asset registration validates role ownership.

## Target Met Path

1. Connect wallet and switch to BOT Chain 677.
2. Open Assets and select `Issue Asset`.
3. Choose `Sustainability-Linked Bond`.
4. Enter the holder address, `0.04` principal, and `0.01` coupon.
5. Enter the sustainability target and select a document file.
6. Select Underwriter, Compliance Monitor, and Settlement agents.
7. Approve registration, then approve the exact `0.05 BOT` funding transaction.
8. Click `Underwrite`, inspect the real GMI report, and commit through `Civora.underwriteCommit`.
9. Add evidence text, click `Monitor`, inspect the real GMI outcome, and commit through `Civora.monitorCommit`.
10. Click `Settle`.
11. Show the breakdown: principal 100% to holder; coupon 94/3/1/1/1.
12. Open Activity and Explorer links.

## Target Missed Path

Use the same asset setup but provide evidence that causes the monitor to return `targetMissed`.

1. Commit the monitor result returned by the real model. Recorded asset #3 returned `penaltyBps = 10000`.
2. Settle the asset.
3. Show `Settled · Coupon Haircut`.
4. Show the model-selected coupon haircut sent to treasury. Recorded asset #3 applied a 100% coupon haircut.
5. Show fees calculated only from the remaining live coupon.
6. Confirm principal remains 100% to the holder.

## Security Moment

1. Enter the asset ID in the red Security Demo card.
2. Click `Attempt drain`.
3. Approve the transaction.
4. Open the failed Explorer transaction and show decoded `PermissionDenied()`.
5. Confirm no asset balance or reputation changed.

## Judge Explanation

> Civora's AI is not a chatbot. The Underwriter's approved amount becomes a PermissionEngine cap. The Compliance Monitor's target outcome becomes settlement math. The vault moves principal and coupon only when both credentials and the scoped permission are valid.

## Honest Boundary

The document and target values are hash-committed demo inputs. The prototype does not claim legal ownership, KYC/KYB, sanctions clearance, or certified emissions data. Production requires regulated custody, legal documentation, independent verification, and compliance providers.
