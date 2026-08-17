import Link from "next/link";
import { truncateHash } from "./TxLink";

export function AiReportPanel({
  title,
  reportHash,
  report,
}: {
  title: string;
  reportHash: `0x${string}`;
  report: Record<string, unknown>;
}) {
  const verdict = typeof report.decision === "string" ? report.decision : typeof report.outcome === "string" ? report.outcome : "—";
  const reasoning = typeof report.reasoning === "string" ? report.reasoning : "No reasoning returned.";
  const model = typeof report.model === "string" ? report.model : "—";
  return (
    <details className="rounded-md border border-border bg-surface p-4">
      <summary className="cursor-pointer font-grotesk text-sm font-medium">
        {title} · {verdict}
      </summary>
      <div className="mt-3 flex flex-col gap-2 font-mono text-xs">
        <p className="text-text-secondary">Reasoning: <span className="text-text-primary">{reasoning}</span></p>
        <p className="text-text-secondary">Model: <span className="text-text-primary">{model}</span></p>
        <p className="text-text-secondary">
          Report: {" "}
          <Link href={`/api/reports/${reportHash}`} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
            {truncateHash(reportHash)}
          </Link>
        </p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border-t border-border pt-2 text-text-tertiary">
          {JSON.stringify(report, null, 2)}
        </pre>
      </div>
    </details>
  );
}
