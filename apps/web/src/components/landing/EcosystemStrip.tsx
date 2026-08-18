const ITEMS = [
  "Built on BOT Chain · Mainnet 677",
  "Patterns from BOT Research Series #06",
  "ERC-721 agent identity",
  "EIP-1271 agent wallets",
  "Verified on BOT Scan",
];

/** Quiet trust row of ecosystem references. */
export function EcosystemStrip() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
      {ITEMS.map((item) => (
        <p key={item} className="font-mono text-[10px] uppercase tracking-widest text-text-tertiary">
          {item}
        </p>
      ))}
    </div>
  );
}
