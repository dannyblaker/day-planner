"use client";

import CurrentTask from "@/components/CurrentTask";
import Editor from "@/components/Editor";
import FlowView from "@/components/FlowView";
import GoalsPanel from "@/components/GoalsPanel";
import HelpOverlay from "@/components/HelpOverlay";
import QuickAdd from "@/components/QuickAdd";
import TaskList from "@/components/TaskList";
import TopBar from "@/components/TopBar";
import UndoBar from "@/components/UndoBar";
import { useApp } from "@/lib/store";
import { toggleTheme } from "@/lib/theme";
import { usePlanSync } from "@/lib/sync";
import { todayISO } from "@/lib/time";
import { useEffect, useMemo, useRef } from "react";

export default function Home() {
  usePlanSync();
  const day = useApp((s) => s.plan.days[s.date]);
  const loaded = useApp((s) => s.loaded);

  const quickAddRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // keyboard-driven navigation order: queue, blocked, done — as the list shows it
  const navIds = useMemo(() => {
    if (!day) return [] as string[];
    return [
      ...day.tasks
        .filter((t) => (t.status === "todo" || t.status === "active") && !t.blocked)
        .sort((a, b) => a.order - b.order),
      ...day.tasks.filter((t) => t.blocked && t.status !== "done"),
      ...day.tasks.filter((t) => t.status === "done"),
    ].map((t) => t.id);
  }, [day]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useApp.getState();
      const el = e.target as HTMLElement;
      const inField =
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        quickAddRef.current?.focus();
        return;
      }
      if (!inField && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        s.undoLast();
        return;
      }
      if (e.key === "Escape") {
        if (s.helpOpen) s.setHelpOpen(false);
        else if (s.editorOpen) s.setEditorOpen(false);
        else s.select(null);
        return;
      }
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;

      const sel = s.selectedId;
      const cur = sel ? navIds.indexOf(sel) : -1;
      const selectAt = (i: number) => {
        const id = navIds[Math.max(0, Math.min(navIds.length - 1, i))];
        if (id) {
          s.select(id);
          document
            .querySelector(`[data-task-row="${id}"]`)
            ?.scrollIntoView({ block: "nearest" });
        }
      };
      const activeTask = day?.tasks.find((t) => t.status === "active");

      switch (e.key) {
        case "n":
        case "c":
          e.preventDefault();
          quickAddRef.current?.focus();
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          selectAt(cur + 1);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          selectAt(cur <= 0 ? 0 : cur - 1);
          break;
        case "J":
          if (sel) s.moveTask(sel, 1);
          break;
        case "K":
          if (sel) s.moveTask(sel, -1);
          break;
        case "e":
        case "Enter":
          if (sel) {
            e.preventDefault();
            s.setEditorOpen(true);
          }
          break;
        case " ": {
          e.preventDefault();
          const target = sel
            ? day?.tasks.find((t) => t.id === sel)
            : activeTask;
          if (!target) break;
          if (target.status === "active") s.pauseTask(target.id);
          else if (target.status !== "done") s.startTask(target.id);
          break;
        }
        case "d":
          if (sel) s.toggleDone(sel);
          break;
        case "b":
          if (sel) s.toggleBlocked(sel);
          break;
        case "p":
          if (sel) {
            const t = day?.tasks.find((t) => t.id === sel);
            if (t) s.updateTask(sel, { parallel: !t.parallel });
          }
          break;
        case "1":
        case "2":
        case "3":
        case "4":
          if (sel) s.setPriority(sel, parseInt(e.key) as 1 | 2 | 3 | 4);
          break;
        case "+":
        case "=":
          if (sel) s.adjustDuration(sel, 15);
          break;
        case "-":
        case "_":
          if (sel) s.adjustDuration(sel, -15);
          break;
        case "s":
          s.autoSort();
          break;
        case "o":
          if (sel) s.deferToNextDay(sel);
          break;
        case "O":
          if (sel) s.moveTaskToDate(sel, todayISO());
          break;
        case "x":
        case "Delete":
          if (sel) s.deleteTask(sel);
          break;
        case "[":
          s.shiftDate(-1);
          break;
        case "]":
          s.shiftDate(1);
          break;
        case "t":
          s.setDate(todayISO());
          break;
        case "m":
          toggleTheme();
          break;
        case "u":
          s.undoLast();
          break;
        case "?":
          s.setHelpOpen(true);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navIds, day]);

  if (!loaded || !day) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-600 text-sm">
        Loading your plan…
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-slate-300">
      <TopBar exportRef={exportRef} />
      <div className="flex flex-1 min-h-0">
        <aside className="w-80 shrink-0 border-r border-slate-800 flex flex-col gap-3 p-3 overflow-y-auto">
          <CurrentTask />
          <QuickAdd ref={quickAddRef} />
          <div className="flex-1">
            <TaskList />
          </div>
          <GoalsPanel />
        </aside>

        {/* min-w-0: the flow canvas is fixed-width, and without this `main`
            refuses to shrink below it and shoves the editor off-screen */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col p-4">
          <FlowView exportRef={exportRef} />
        </main>

        <Editor />
      </div>
      <HelpOverlay />
      <UndoBar />
    </div>
  );
}
