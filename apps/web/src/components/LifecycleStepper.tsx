import { Fragment } from "react";

interface Step {
  state: number;
  label: string;
  actor: string;
}

const MAIN_STEPS: Step[] = [
  { state: 1, label: "Registered", actor: "Issuer" },
  { state: 2, label: "Funded", actor: "Issuer escrows" },
  { state: 3, label: "Underwritten", actor: "Underwriter AI" },
  { state: 4, label: "Monitored", actor: "Monitor AI" },
  { state: 5, label: "Settled", actor: "Settlement agent" },
];

const REFUND_STEPS: Step[] = [
  { state: 1, label: "Registered", actor: "Issuer" },
  { state: 2, label: "Funded", actor: "Issuer escrows" },
  { state: 6, label: "Refunded", actor: "Escrow returned" },
];

export function LifecycleStepper({ state }: { state: number }) {
  const steps = state === 6 ? REFUND_STEPS : MAIN_STEPS;
  const terminal = state === 6 || state === 5;

  return (
    <div className="flex w-full items-start">
      {steps.map((step, i) => {
        const completed = step.state < state && !(state === 6 && step.state === 6);
        const current = step.state === state;
        const isRefund = step.state === 6;
        return (
          <Fragment key={step.state}>
            <div className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] ${
                  completed
                    ? "border-accent bg-accent text-text-on-accent"
                    : current
                      ? isRefund
                        ? "border-error bg-error text-text-on-accent ring-2 ring-error/20"
                        : "border-accent bg-accent text-text-on-accent ring-2 ring-accent/20"
                      : "border-border-strong bg-bg text-text-tertiary"
                }`}
              >
                {completed ? "✓" : current ? (isRefund ? "×" : step.state) : step.state}
              </span>
              <span className={`font-mono text-[10px] leading-tight ${current ? "font-medium text-text-primary" : completed ? "text-text-secondary" : "text-text-tertiary"}`}>
                {step.label}
              </span>
              <span className="font-mono text-[9px] leading-tight text-text-tertiary">{step.actor}</span>
            </div>
            {i < steps.length - 1 ? (
              <div className={`mt-3 h-px flex-1 ${terminal ? "bg-border" : "bg-border-strong"}`} />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
