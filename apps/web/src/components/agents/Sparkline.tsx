"use client";

import { formatEther } from "viem";

/** Tiny inline SVG line chart of per-settlement fees for one agent. */
export function Sparkline({
  pointsWei,
  height = 28,
}: {
  pointsWei: bigint[];
  height?: number;
}) {
  if (pointsWei.length < 2) {
    return (
      <span className="font-mono text-[11px] text-text-tertiary">
        {pointsWei.length === 1 ? "1 settlement" : "no settlements"}
      </span>
    );
  }
  const width = 96;
  const max = pointsWei.reduce((a, b) => (b > a ? b : a), 1n);
  const step = width / (pointsWei.length - 1);
  const pts = pointsWei.map((v, i) => {
    const x = i * step;
    const y = height - (Number((v * 10_000n) / max) / 10_000) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pointsWei[pointsWei.length - 1];
  return (
    <span className="flex items-center gap-2" title={`Last: ${formatEther(last)} BOT`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-accent"
        />
        <circle
          cx={width}
          cy={Number(pts[pts.length - 1].split(",")[1])}
          r="2"
          className="fill-accent"
        />
      </svg>
      <span className="font-mono text-[11px] text-text-secondary">{formatEther(last)} BOT</span>
    </span>
  );
}
