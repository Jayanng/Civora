export function truncateHash(hash: string, head = 6, tail = 4): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function TxLink({
  hash,
  label,
  status,
  className = "",
}: {
  hash: string;
  label?: string;
  status?: "pending" | "confirmed" | "failed";
  className?: string;
}) {
  const text = label ?? truncateHash(hash);
  return (
    <a
      href={`https://scan.botchain.ai/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 font-mono text-xs text-accent hover:text-accent-hover ${className}`}
    >
      {status === "pending" ? (
        <span className="rounded-sm bg-warning-bg px-1 py-0.5 text-warning">pending</span>
      ) : status === "failed" ? (
        <span className="rounded-sm bg-error-bg px-1 py-0.5 text-error">failed</span>
      ) : null}
      {text}
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M1 9 9 1M3.5 1H9v5.5"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
    </a>
  );
}