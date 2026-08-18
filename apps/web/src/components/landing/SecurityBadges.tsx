import { ADDRESSES } from "@/lib/civora";

const BADGES = [
  { label: "Permission-engine guarded", href: `https://scan.botchain.ai/address/${ADDRESSES.permissions}` },
  { label: "Hash-locked credentials", href: `https://scan.botchain.ai/address/${ADDRESSES.credentials}` },
  { label: "Escrow on BOT Chain", href: `https://scan.botchain.ai/address/${ADDRESSES.vault}` },
  { label: "Agent identity NFTs", href: `https://scan.botchain.ai/address/${ADDRESSES.identities}` },
  { label: "One-tx agent factory", href: `https://scan.botchain.ai/address/${ADDRESSES.factory}` },
];

/** Row of verification chips, each linking to the live contract on BOT Scan. */
export function SecurityBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      {BADGES.map((badge) => (
        <a
          key={badge.label}
          href={badge.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-text-secondary hover:border-accent hover:text-accent"
        >
          <span className="h-1 w-1 rounded-full bg-success" />
          {badge.label}
        </a>
      ))}
    </div>
  );
}
