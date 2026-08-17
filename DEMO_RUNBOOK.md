# Civora Green RWA Demo Runbook

## Demo Setup

- Network: BOT Chain Mainnet 677
- RPC: `https://rpc.botchain.ai`
- Explorer: `https://scan.botchain.ai`
- Primary app: `/app/assets`
- Public proof: `/demo`
- Demo escrow: `0.04 BOT principal + 0.01 BOT coupon = 0.05 BOT`
- Holder: dedicated demo holder address, distinct from treasury
- Agent roles: Underwriter, Compliance Monitor, Settlement

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

1. Commit the monitor result with `penaltyBps = 2000`.
2. Settle the asset.
3. Show `Settled · Coupon Haircut`.
4. Show 20% of the approved coupon sent to treasury as haircut.
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
