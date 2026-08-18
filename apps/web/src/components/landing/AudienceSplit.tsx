import Link from "next/link";

const PANELS = [
  {
    tag: "For issuers",
    title: "Raise against a real green commitment",
    text: "Register a sustainability-linked bond or green receivable, escrow principal and coupon, and let AI agents underwrite and monitor it — without handing anyone a backdoor to the funds.",
    points: ["One-tx agent setup: identity NFT + wallet", "Hash-locked AI credentials, capped amounts", "Escrow refunds at maturity or on rejection"],
    cta: "Issue an asset",
    href: "/app/assets",
  },
  {
    tag: "For holders",
    title: "Principal-backed, monitored on-chain",
    text: "Hold the asset, watch the Compliance Monitor judge the target, and collect principal plus the full coupon split when the target is met — every step a verified transaction on BOT Chain.",
    points: ["100% principal back at settle", "94% of a met coupon goes to you", "Penalty haircuts are public, not arbitrary"],
    cta: "View the flow",
    href: "/app/activity",
  },
];

export function AudienceSplit() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {PANELS.map((panel) => (
        <div key={panel.tag} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">{panel.tag}</p>
          <p className="font-grotesk text-lg font-semibold tracking-tight text-text-primary">{panel.title}</p>
          <p className="text-sm leading-relaxed text-text-secondary">{panel.text}</p>
          <ul className="flex flex-col gap-1.5">
            {panel.points.map((point) => (
              <li key={point} className="flex gap-2 font-mono text-xs text-text-secondary">
                <span className="text-accent">✓</span>
                {point}
              </li>
            ))}
          </ul>
          <Link href={panel.href} className="mt-auto inline-flex h-9 w-fit items-center rounded-none border border-accent px-3 font-grotesk text-xs font-medium text-accent hover:bg-accent hover:text-text-on-accent">
            {panel.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}
