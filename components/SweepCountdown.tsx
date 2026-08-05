"use client";

import { now } from "@/lib/auto-delete";
import { useEffect, useState } from "react";

/** on the sweeper's clock, not the wall clock — see now() */
const left = (at: number) => Math.max(0, Math.ceil((at - now()) / 1000));

/**
 * The seconds a finished task has left before it goes.
 *
 * It keeps its own timer so that only the task that is leaving re-renders, and
 * it is mounted keyed on the deadline, so a new countdown is a new component
 * rather than one that has to be told to start again.
 */
export default function SweepCountdown({
  at,
  className = "",
}: {
  at: number;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(() => left(at));

  useEffect(() => {
    const tick = setInterval(() => setSeconds(left(at)), 200);
    return () => clearInterval(tick);
  }, [at]);

  return (
    <span
      className={`shrink-0 tabular-nums text-slate-400 ${className}`}
      title="deleting — re-open the task to keep it"
    >
      🧹 {seconds}
    </span>
  );
}
