import { formatEther } from "viem";

export function SettlementBreakdown({
  principal,
  holderCoupon,
  protocol,
  underwriter,
  monitor,
  settlement,
  haircut,
  targetMet,
}: {
  principal: bigint;
  holderCoupon: bigint;
  protocol: bigint;
  underwriter: bigint;
  monitor: bigint;
  settlement: bigint;
  haircut: bigint;
  targetMet: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-grotesk text-sm font-medium">Settlement breakdown</h2>
        <span
          className={`rounded-sm px-2 py-1 font-mono text-xs ${
            targetMet ? "bg-success-bg text-success" : "bg-warning-bg text-warning"
          }`}
        >
          {targetMet ? "Settled · Target Met" : "Settled · Coupon Haircut"}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-2">
        <div className="flex justify-between gap-4 border-b border-border pb-1">
          <dt className="text-text-secondary">Principal → Holder (100%)</dt>
          <dd>{formatEther(principal)} BOT</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border pb-1">
          <dt className="text-text-secondary">Coupon → Holder (94%)</dt>
          <dd>{formatEther(holderCoupon)} BOT</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border pb-1">
          <dt className="text-text-secondary">Coupon → Protocol (3%)</dt>
          <dd>{formatEther(protocol)} BOT</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border pb-1">
          <dt className="text-text-secondary">Coupon → Underwriter (1%)</dt>
          <dd>{formatEther(underwriter)} BOT</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border pb-1">
          <dt className="text-text-secondary">Coupon → Monitor (1%)</dt>
          <dd>{formatEther(monitor)} BOT</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-border pb-1">
          <dt className="text-text-secondary">Coupon → Settlement (1%)</dt>
          <dd>{formatEther(settlement)} BOT</dd>
        </div>
        {haircut > 0n ? (
          <div className="flex justify-between gap-4 border-b border-border pb-1 text-warning">
            <dt>Haircut → Treasury</dt>
            <dd>{formatEther(haircut)} BOT</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
