"use client";

import Editor from "@/components/Editor";
import FlowView from "@/components/FlowView";
import GoalsPanel from "@/components/GoalsPanel";
import HelpOverlay from "@/components/HelpOverlay";
import QuickAdd from "@/components/QuickAdd";
import TaskList from "@/components/TaskList";
import TopBar from "@/components/TopBar";
import UndoBar from "@/components/UndoBar";
import { statuses } from "@/lib/graph";
import { useApp } from "@/lib/store";
import { toggleTheme } from "@/lib/theme";
import { usePlanSync } from "@/lib/sync";
import { STATUS_ORDER, Task } from "@/lib/types";
import { useEffect, useMemo, useRef } from "react";

export default function Home() {
  usePlanSync();
  const tasks = useApp((s) => s.plan.tasks);
  const loaded = useApp((s) => s.loaded);

  const quickAddRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // keyboard-driven navigation order: by status, then queue order — the order
  // the sidebar lists them in, so j/k walks down what you can see
  const navIds = useMemo(() => {
    const statusOfId = statuses(tasks);
    const rank = (t: Task) => STATUS_ORDER.indexOf(statusOfId.get(t.id)!);
    return [...tasks]
      .sort((a, b) => rank(a) - rank(b) || a.order - b.order)
      .map((t) => t.id);
  }, [tasks]);

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
        s.undoClear();
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
      switch (e.key) {
        case "n":
        case "c":
          e.preventDefault();
          quickAddRef.current?.focus();
          break;
        case "a":
          // a new task on the far end of a new arrow — the canvas asks for the
          // title, so chains get built without leaving the keyboard
          if (sel) {
            e.preventDefault();
            s.requestNewTaskFrom(sel);
          }
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
        case "d":
          if (sel) s.toggleDone(sel);
          break;
        case "b":
          if (sel) s.toggleBlocked(sel);
          break;
        case "p":
          if (sel) {
            const t = s.plan.tasks.find((t) => t.id === sel);
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
        case "x":
        case "Delete":
          if (sel) s.deleteTask(sel);
          break;
        case "m":
          toggleTheme();
          break;
        case "u":
          s.undoClear();
          break;
        case "?":
          s.setHelpOpen(true);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navIds]);

  if (!loaded) {
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
