"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { exportPDF, exportPNG } from "@/lib/export";
import { plannedFocusMinutes } from "@/lib/scheduler";
import { useApp } from "@/lib/store";
import { fmtDateHuman, fmtDur, fmtTime, nowMinutes, todayISO } from "@/lib/time";
import { useState } from "react";

function TimeInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="time"
      value={fmtTime(value)}
      onChange={(e) => {
        const [h, m] = e.target.value.split(":").map(Number);
        if (!isNaN(h)) onChange(h * 60 + (m || 0));
      }}
      className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-slate-300 w-[68px]"
    />
  );
}

export default function TopBar({ exportRef }: { exportRef: React.RefObject<HTMLElement | null> }) {
  const { date, shiftDate, setDate, setDayBounds, setHelpOpen, saving, view, setView } =
    useApp();
  const day = useApp((s) => s.plan.days[s.date]);
  const shareToken = useApp((s) => s.plan.shareToken);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!day) return null;

  const isToday = date === todayISO();
  const planned = plannedFocusMinutes(day);
  const free = Math.max(
    day.dayEnd - Math.max(isToday ? nowMinutes() : day.dayStart, day.dayStart),
    0
  );
  const slack = free - planned;

  const copyShare = async () => {
    const url = `${location.origin}/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt("Copy this link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const doExport = async (kind: "png" | "pdf") => {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    try {
      if (kind === "png") await exportPNG(exportRef.current, `plan-${date}`);
      else await exportPDF(exportRef.current, `plan-${date}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/40 flex-wrap">
      <h1 className="text-sm font-semibold text-indigo-300 tracking-tight">
        DayFlow
      </h1>

      <div className="flex items-center gap-1">
        <button onClick={() => shiftDate(-1)} className="btn" title="previous day ( [ )">
          ‹
        </button>
        <button
          onClick={() => setDate(todayISO())}
          className={`text-xs px-2 py-1 rounded ${
            isToday ? "text-slate-200 font-medium" : "text-slate-400 hover:text-slate-200"
          }`}
          title="jump to today (t)"
        >
          {fmtDateHuman(date)}
          {isToday && <span className="text-indigo-400"> · today</span>}
        </button>
        <button onClick={() => shiftDate(1)} className="btn" title="next day ( ] )">
          ›
        </button>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-slate-500">
        <TimeInput value={day.dayStart} onChange={(v) => setDayBounds(v, day.dayEnd)} />
        –
        <TimeInput value={day.dayEnd} onChange={(v) => setDayBounds(day.dayStart, v)} />
      </div>

      <div
        className="flex rounded-md border border-slate-700 overflow-hidden"
        title="toggle view (v)"
      >
        {(["timeline", "flow"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-[11px] px-2.5 py-1 ${
              view === v
                ? "bg-indigo-600/40 text-indigo-200"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200"
            }`}
          >
            {v === "timeline" ? "🗓 Timeline" : "◇ Flow"}
          </button>
        ))}
      </div>

      <div
        className={`text-[11px] px-2 py-1 rounded-md border ${
          slack < 0
            ? "border-red-500/50 bg-red-950/40 text-red-300"
            : "border-slate-700 bg-slate-800/60 text-slate-400"
        }`}
        title="focus-lane work remaining vs. time left in the day"
      >
        {fmtDur(planned)} planned · {fmtDur(free)} available ·{" "}
        {slack < 0 ? `over by ${fmtDur(-slack)}` : `${fmtDur(slack)} slack`}
      </div>

      <div className="flex-1" />

      <span
        className={`text-[10px] transition-opacity ${
          saving ? "text-amber-400" : "text-slate-600"
        }`}
      >
        {saving ? "saving…" : "saved"}
      </span>

      <button onClick={copyShare} className="btn" title="copy live share link">
        {copied ? "✓ copied" : "🔗 Share live"}
      </button>
      <button onClick={() => doExport("png")} className="btn" disabled={exporting}>
        PNG
      </button>
      <button onClick={() => doExport("pdf")} className="btn" disabled={exporting}>
        PDF
      </button>
      <ThemeToggle />
      <button onClick={() => setHelpOpen(true)} className="btn" title="shortcuts (?)">
        ?
      </button>
    </header>
  );
}
