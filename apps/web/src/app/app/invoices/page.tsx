"use client";

export default function InvoicesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="mt-1 font-mono text-xs text-text-secondary">
          Register a real invoice, fund it, and let the Underwriter decide.
        </p>
      </header>
      <section className="rounded-md border border-border bg-surface">
        <p className="py-8 text-center font-mono text-sm text-text-tertiary">
          No invoices registered yet.
        </p>
      </section>
    </div>
  );
}