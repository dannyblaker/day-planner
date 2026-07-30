"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { exportPDF, exportPNG } from "@/lib/export";
import { useApp } from "@/lib/store";
import { fmtDateHuman, todayISO } from "@/lib/time";
import { useState } from "react";

export default function TopBar({ exportRef }: { exportRef: React.RefObject<HTMLElement | null> }) {
  const { date, shiftDate, setDate, setHelpOpen, saving } = useApp();
  const day = useApp((s) => s.plan.days[s.date]);
  const shareToken = useApp((s) => s.plan.shareToken);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!day) return null;

  const isToday = date === todayISO();

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
