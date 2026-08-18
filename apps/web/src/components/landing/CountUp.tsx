"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** Counts up from 0 to value once on mount. Renders the final value directly for reduced-motion users. */
export function CountUp({ value, decimals = 0, duration = 1100, suffix = "" }: { value: number; decimals?: number; duration?: number; suffix?: string }) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return <>{reduced ? value.toFixed(decimals) : display.toFixed(decimals)}{suffix}</>;
}
