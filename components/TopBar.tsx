"use client";

import CanvasToggle from "@/components/CanvasToggle";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { exportJSON, exportPDF, exportPNG } from "@/lib/export";
import { statuses } from "@/lib/graph";
import { useApp } from "@/lib/store";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "@/lib/types";
import { useState } from "react";

export default function TopBar({ exportRef }: { exportRef: React.RefObject<HTMLElement | null> }) {
  const { setHelpOpen, saving } = useApp();
  const plan = useApp((s) => s.plan);
  const tasks = plan.tasks;
  const shareToken = plan.shareToken;
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const statusOfId = statuses(tasks);
  const counts = STATUS_ORDER.map((s) => ({
    status: s,
    n: tasks.filter((t) => statusOfId.get(t.id) === s).length,
  }));

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
      if (kind === "png") await exportPNG(exportRef.current, "plan");
      else await exportPDF(exportRef.current, "plan");
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 bg-slate-900/40 flex-wrap">
      <h1 className="flex items-center gap-2 text-title font-semibold text-slate-100 tracking-tight">
        <Logo className="w-6 h-6 shrink-0" />
        Concurrent Crocodiles
      </h1>

      {/* what the board adds up to — the one number that used to be capacity */}
      <div
        className="flex items-center gap-2.5 text-label px-2 py-1 rounded-md border border-slate-700 bg-slate-800/60"
        title="every status is derived from the dependency graph"
      >
        {counts.map(({ status, n }) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[status] }}
            />
            <span className="text-slate-400">
              {n} {STATUS_LABEL[status].toLowerCase()}
            </span>
          </span>
        ))}
      </div>

      <div className="flex-1" />

      <span
        className={`text-note transition-opacity ${
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
      <button
        onClick={() => exportJSON(plan, "crocodiles")}
        className="btn"
        title="every task, dependency and derived status as JSON — the same document GET /api/export serves"
      >
        JSON
      </button>
      <CanvasToggle />
      <ThemeToggle />
      <button onClick={() => setHelpOpen(true)} className="btn" title="shortcuts (?)">
        ?
      </button>
    </header>
  );
}
