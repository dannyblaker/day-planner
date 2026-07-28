"use client";

import CurrentTask from "@/components/CurrentTask";
import Editor from "@/components/Editor";
import FlowView from "@/components/FlowView";
import GoalsPanel from "@/components/GoalsPanel";
import HelpOverlay from "@/components/HelpOverlay";
import QuickAdd from "@/components/QuickAdd";
import TaskList from "@/components/TaskList";
import Timeline from "@/components/Timeline";
import TopBar from "@/components/TopBar";
import { notify } from "@/lib/notify";
import { scheduleDay } from "@/lib/scheduler";
import { useApp } from "@/lib/store";
import { toggleTheme } from "@/lib/theme";
import { usePlanSync } from "@/lib/sync";
import { fmtDateHuman, fmtTime, nowMinutes, todayISO } from "@/lib/time";
import { Task } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

export default function Home() {
  usePlanSync();
  const day = useApp((s) => s.plan.days[s.date]);
  const goals = useApp((s) => s.plan.goals);
  const date = useApp((s) => s.date);
  const selectedId = useApp((s) => s.selectedId);
  const loaded = useApp((s) => s.loaded);
  const view = useApp((s) => s.view);

  const [tick, setTick] = useState(0);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const notified = useRef<Set<string>>(new Set());

  // reschedule every 20s so the plan reflows live as time passes
  useEffect(() => {
    const iv = setInterval(() => setTick((x) => x + 1), 20000);
    const onVis = () => setTick((x) => x + 1);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const isToday = date === todayISO();
  const now = nowMinutes();
  const slots = useMemo(
    () => (day ? scheduleDay(day, isToday ? now : day.dayStart) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day, isToday, tick]
  );

  // notify shortly before fixed-time tasks start
  useEffect(() => {
    if (!isToday) return;
    for (const s of slots) {
      if (!s.fixed || s.task.status !== "todo") continue;
      const key = `${date}:${s.task.id}`;
      if (s.start - now <= 2 && s.start - now > -1 && !notified.current.has(key)) {
        notified.current.add(key);
        notify(`📌 ${fmtTime(s.start)} — ${s.task.title}`, "Starting now.");
      }
    }
  }, [slots, isToday, now, date]);

  // keyboard-driven navigation order: queue (by scheduled start), blocked, done
  const navIds = useMemo(() => {
    if (!day) return [] as string[];
    const slotOf = new Map(slots.map((s) => [s.task.id, s]));
    const startOf = (t: Task) => slotOf.get(t.id)?.start ?? 9999;
    return [
      ...day.tasks
        .filter((t) => (t.status === "todo" || t.status === "active") && !t.blocked)
        .sort((a, b) => startOf(a) - startOf(b)),
      ...day.tasks.filter((t) => t.blocked && t.status !== "done"),
      ...day.tasks.filter((t) => t.status === "done"),
    ].map((t) => t.id);
  }, [day, slots]);

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
          if (sel) {
            const t = day?.tasks.find((t) => t.id === sel);
            if (t?.status === "done") s.reopenTask(sel);
            else s.completeTask(sel);
          }
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
        case "v":
          s.setView(s.view === "timeline" ? "flow" : "timeline");
          break;
        case "m":
          toggleTheme();
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
          <CurrentTask slots={slots} />
          <QuickAdd ref={quickAddRef} />
          <div className="flex-1">
            <TaskList slots={slots} />
          </div>
          <GoalsPanel />
        </aside>

        <main
          className={`flex-1 p-4 ${
            view === "flow" ? "min-h-0 flex flex-col" : "overflow-y-auto"
          }`}
        >
          {view === "timeline" ? (
            <div ref={exportRef} className="bg-background p-2">
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="text-sm font-medium text-slate-300">
                  {fmtDateHuman(date)}
                </h2>
                <span className="text-[10px] text-slate-600">
                  DayFlow · {date}
                </span>
              </div>
              <Timeline
                day={day}
                slots={slots}
                now={now}
                goals={goals}
                selectedId={selectedId}
                onSelect={(id) => useApp.getState().select(id)}
                isToday={isToday}
                onReorder={(id, beforeId) =>
                  useApp.getState().placeBefore(id, beforeId)
                }
                onSetFixedStart={(id, start) =>
                  useApp.getState().updateTask(id, { fixedStart: start })
                }
              />
            </div>
          ) : (
            <FlowView slots={slots} exportRef={exportRef} />
          )}
        </main>

        <Editor />
      </div>
      <HelpOverlay />
    </div>
  );
}
