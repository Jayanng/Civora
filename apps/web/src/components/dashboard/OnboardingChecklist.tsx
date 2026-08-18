import Link from "next/link";

const STEPS = [
  { n: "1", title: "Create your three agents", text: "Underwriter, Compliance Monitor, and Settlement — one transaction each.", href: "/app/agents?new=1" },
  { n: "2", title: "Issue an asset", text: "Set holder, principal, coupon, target, and assign your agents.", href: "/app/assets?new=1" },
  { n: "3", title: "Watch the loop", text: "Fund it, AI-underwrite, AI-monitor, then settle — every step lands in Activity.", href: "/app/activity" },
];

/** Empty state: a short guided checklist instead of a bare message. */
export function OnboardingChecklist() {
  return (
    <section className="rounded-md border border-accent/30 bg-accent-muted/30 p-5">
      <p className="font-grotesk text-sm font-medium text-accent-strong">Your dashboard is empty — here is the shortest path to a live asset.</p>
      <ol className="mt-4 flex flex-col gap-3">
        {STEPS.map((step) => (
          <li key={step.n} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent font-mono text-[10px] text-accent">{step.n}</span>
            <div className="min-w-0 flex-1">
              <p className="font-grotesk text-xs font-medium text-text-primary">{step.title}</p>
              <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{step.text}</p>
            </div>
            <Link href={step.href} className="mt-0.5 shrink-0 font-mono text-[11px] text-accent hover:text-accent-hover">
              Go →
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
