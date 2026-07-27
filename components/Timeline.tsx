"use client";

import { fmtDur, fmtTime } from "@/lib/time";
import { DayPlan, Goal, Slot } from "@/lib/types";

const PX_PER_MIN = 1.7;

export const PRIORITY_COLOR: Record<number, string> = {
  1: "#f87171",
  2: "#fbbf24",
  3: "#38bdf8",
  4: "#64748b",
};

interface Props {
  day: DayPlan;
  slots: Slot[];
  now: number;
  goals: Goal[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  isToday: boolean;
}

/** Assign overlapping slots to columns within their lane. */
function layoutColumns(slots: Slot[]): Map<Slot, { col: number; cols: number }> {
  const res = new Map<Slot, { col: number; cols: number }>();
  const sorted = [...slots].sort((a, b) => a.start - b.start || a.end - b.end);
  let cluster: Slot[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const lanes: number[] = [];
    const assign = new Map<Slot, number>();
    for (const s of cluster) {
      let li = lanes.findIndex((end) => end <= s.start + 0.001);
      if (li < 0) {
        li = lanes.length;
        lanes.push(0);
      }
      lanes[li] = s.end;
      assign.set(s, li);
    }
    for (const s of cluster)
      res.set(s, { col: assign.get(s)!, cols: lanes.length });
    cluster = [];
  };

  for (const s of sorted) {
    if (cluster.length && s.start >= clusterEnd - 0.001) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(s);
    clusterEnd = Math.max(clusterEnd, s.end);
  }
  flush();
  return res;
}

export default function Timeline({
  day,
  slots,
  now,
  goals,
  selectedId,
  onSelect,
  isToday,
}: Props) {
  const starts = slots.map((s) => s.start);
  const ends = slots.map((s) => s.end);
  const rangeStart =
    Math.floor(Math.min(day.dayStart, ...(starts.length ? starts : [day.dayStart])) / 60) * 60;
  const rangeEnd =
    Math.ceil(
      (Math.max(day.dayEnd, ...(ends.length ? ends : [day.dayEnd])) + 15) / 60
    ) * 60;
  const y = (min: number) => (min - rangeStart) * PX_PER_MIN;
  const height = y(rangeEnd);

  const focus = slots.filter((s) => s.lane === "focus");
  const background = slots.filter((s) => s.lane === "background");
  const focusCols = layoutColumns(focus);
  const bgCols = layoutColumns(background);
  const hasBg = background.length > 0;

  const hours: number[] = [];
  for (let h = rangeStart; h <= rangeEnd; h += 60) hours.push(h);

  const renderSlot = (
    s: Slot,
    colInfo: { col: number; cols: number },
    zone: "focus" | "bg"
  ) => {
    const t = s.task;
    const done = t.status === "done";
    const active = t.status === "active";
    const goal = goals.find((g) => g.id === t.goalId);
    const h = Math.max((s.end - s.start) * PX_PER_MIN, 20);
    const widthPct = 100 / colInfo.cols;
    const compact = h < 34;
    return (
      <div
        key={t.id}
        onClick={onSelect ? () => onSelect(t.id) : undefined}
        className={`absolute rounded-md border px-2 py-0.5 overflow-hidden text-left transition-colors ${
          onSelect ? "cursor-pointer" : ""
        } ${
          done
            ? "opacity-40 border-slate-700 bg-slate-900"
            : active
              ? "border-emerald-400/70 bg-emerald-950/60"
              : s.overflow
                ? "border-red-500/60 bg-red-950/30"
                : zone === "bg"
                  ? "border-dashed border-slate-600 bg-slate-800/50"
                  : "bg-slate-800/80 border-slate-700"
        } ${selectedId === t.id ? "ring-2 ring-indigo-400" : ""}`}
        style={{
          top: y(s.start),
          height: h,
          left: `calc(${colInfo.col * widthPct}% + 2px)`,
          width: `calc(${widthPct}% - 4px)`,
          borderLeftWidth: 3,
          borderLeftColor: done ? "#475569" : PRIORITY_COLOR[t.priority],
          borderLeftStyle: "solid",
        }}
        title={`${t.title} · ${fmtTime(s.start)}–${fmtTime(s.end)}`}
      >
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className={`text-[11px] font-medium truncate ${
              done ? "line-through text-slate-500" : "text-slate-100"
            }`}
          >
            {s.fixed && <span title="fixed time">📌 </span>}
            {active && <span className="text-emerald-400">▶ </span>}
            {t.title}
          </span>
          {!compact && goal && (
            <span
              className="text-[9px] px-1 rounded-full shrink-0"
              style={{ backgroundColor: goal.color + "33", color: goal.color }}
            >
              {goal.name}
            </span>
          )}
        </div>
        {!compact && (
          <div className="text-[9px] text-slate-400 flex gap-1.5">
            <span>
              {fmtTime(s.start)}–{fmtTime(s.end)}
            </span>
            <span>{fmtDur(s.end - s.start)}</span>
            {s.overflow && (
              <span className="text-red-400 font-medium">past day end</span>
            )}
            {s.waitingOn.length > 0 && (
              <span className="text-amber-400">⚠ waiting on blocked dep</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative select-none" style={{ height: height + 24 }}>
      {/* hour grid */}
      {hours.map((h) => (
        <div key={h} className="absolute left-0 right-0" style={{ top: y(h) }}>
          <div className="border-t border-slate-800/80" />
          <span className="absolute -top-2 left-0 text-[10px] text-slate-500 bg-[#0a0e16] pr-1">
            {fmtTime(h)}
          </span>
        </div>
      ))}

      {/* working-day bounds */}
      <div
        className="absolute left-12 right-0 border-t border-slate-600"
        style={{ top: y(day.dayStart) }}
      />
      <div
        className="absolute left-12 right-0 border-t border-dashed border-slate-500"
        style={{ top: y(day.dayEnd) }}
      >
        <span className="absolute right-0 -top-4 text-[10px] text-slate-500">
          day ends {fmtTime(day.dayEnd)}
        </span>
      </div>

      {/* lanes */}
      <div className="absolute left-12 right-1 top-0 bottom-0 flex gap-1">
        <div className="relative flex-1">
          {focus.map((s) => renderSlot(s, focusCols.get(s)!, "focus"))}
        </div>
        {hasBg && (
          <div className="relative w-[26%] border-l border-slate-800/60 pl-1">
            <span className="absolute -top-0.5 right-0 text-[9px] uppercase tracking-wider text-slate-600">
              parallel
            </span>
            {background.map((s) => renderSlot(s, bgCols.get(s)!, "bg"))}
          </div>
        )}
      </div>

      {/* now line */}
      {isToday && now >= rangeStart && now <= rangeEnd && (
        <div
          className="absolute left-8 right-0 z-10 pointer-events-none"
          style={{ top: y(now) }}
        >
          <div className="border-t-2 border-red-400/90 relative">
            <div className="absolute -left-0 -top-[5px] w-2 h-2 rounded-full bg-red-400" />
            <span className="absolute right-0 -top-4 text-[10px] text-red-400 font-medium">
              {fmtTime(now)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
