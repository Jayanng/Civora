"use client";

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 font-mono text-xs text-text-secondary">
          Every Civora event, indexed from transaction receipts.
        </p>
      </header>
      <section className="rounded-md border border-border bg-surface">
        <p className="py-8 text-center font-mono text-sm text-text-tertiary">
          No events yet — the receipt indexer follows in a later build step.
        </p>
      </section>
    </div>
  );
}