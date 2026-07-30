"use client";

import { addDaysISO, todayISO } from "@/lib/time";
import { ReactNode } from "react";

/**
 * A date field plus the three jumps that cover most moves, with the action
 * button (whatever it does) passed in as children so it sits beside the field.
 */
export default function DayPicker({
  id,
  ariaLabel,
  value,
  from,
  onChange,
  children,
}: {
  id?: string;
  ariaLabel?: string;
  value: string;
  /** the day being moved off — what "next day" and "+1 week" count from */
  from: string;
  onChange: (iso: string) => void;
  children?: ReactNode;
}) {
  const presets = [
    ["today", todayISO()],
    ["next day", addDaysISO(from, 1)],
    ["+1 week", addDaysISO(from, 7)],
  ] as const;

  return (
    <div>
      <div className="flex gap-1.5">
        <input
          id={id}
          aria-label={ariaLabel}
          type="date"
          className="min-w-0 flex-1 bg-slate-800 border border-slate-700 focus:border-indigo-500
            outline-none rounded px-2 py-1.5 text-[13px] text-slate-200"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {children}
      </div>
      <div className="flex gap-2 mt-1.5">
        {presets.map(([name, iso]) => (
          <button
            key={name}
            onClick={() => onChange(iso)}
            className={`text-[10px] ${
              value === iso
                ? "text-indigo-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
