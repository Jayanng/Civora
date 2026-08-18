import { formatEther } from "viem";
import { ASSET_STATE_NAMES, ASSET_TYPE_NAMES } from "@/lib/civora";
import type { FullAsset } from "@/lib/dashboard";
import { truncateHash } from "@/components/TxLink";

const COLUMNS = [
  { state: 2, label: "Funded" },
  { state: 3, label: "Underwritten" },
  { state: 4, label: "Monitored" },
  { state: 5, label: "Settled" },
  { state: 6, label: "Refunded" },
];

/** Kanban-style board: every asset sits in the column for its current on-chain state. */
export function PipelineBoard({ assets }: { assets: FullAsset[] }) {
  const pending = assets.filter((a) => a.state === 1);
  return (
    <div className="flex flex-col gap-3">
      {pending.length > 0 ? (
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">Registered — awaiting escrow</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.map((a) => <AssetChip key={a.assetId} asset={a} />)}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const inCol = assets.filter((a) => a.state === col.state);
          return (
            <div key={col.state} className="flex min-h-28 flex-col rounded-md border border-border bg-surface p-2">
              <div className="flex items-center justify-between gap-2 px-1 pb-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">{col.label}</p>
                <span className="rounded-sm bg-bg px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">{inCol.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {inCol.length === 0 ? (
                  <p className="px-1 py-2 font-mono text-[10px] text-text-tertiary">—</p>
                ) : (
                  inCol.map((a) => <AssetChip key={a.assetId} asset={a} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssetChip({ asset }: { asset: FullAsset }) {
  return (
    <div className="rounded-sm border border-border bg-bg p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-medium text-text-primary">#{asset.assetId}</p>
        <p className="font-mono text-[10px] text-text-tertiary">{ASSET_TYPE_NAMES[asset.assetType as 1 | 2]}</p>
      </div>
      <p className="mt-1 font-mono text-[11px] text-text-secondary">{formatEther(asset.principalWei + asset.couponWei)} BOT escrow</p>
      <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">target {truncateHash(asset.targetHash, 4, 4)}</p>
    </div>
  );
}

const STATE_COLORS: Record<number, string> = {
  1: "bg-border-strong",
  2: "bg-info",
  3: "bg-secondary",
  4: "bg-warning",
  5: "bg-success",
  6: "bg-error",
};

/** Horizontal stacked bar: the share of assets in each state, with counts. */
export function StateDistribution({ assets }: { assets: FullAsset[] }) {
  const counts = new Map<number, number>();
  for (const a of assets) counts.set(a.state, (counts.get(a.state) ?? 0) + 1);
  const total = assets.length || 1;
  const order = [1, 2, 3, 4, 5, 6];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-sm border border-border bg-bg">
        {order.map((state) => {
          const count = counts.get(state) ?? 0;
          if (count === 0) return null;
          return (
            <div
              key={state}
              className={STATE_COLORS[state]}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${ASSET_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5 | 6]}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-text-secondary">
        {order.map((state) => {
          const count = counts.get(state) ?? 0;
          if (count === 0) return null;
          return (
            <p key={state} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-sm ${STATE_COLORS[state]}`} />
              {ASSET_STATE_NAMES[state as 1 | 2 | 3 | 4 | 5 | 6]} · {count}
            </p>
          );
        })}
      </div>
    </div>
  );
}
