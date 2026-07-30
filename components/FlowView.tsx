"use client";

import { useApp } from "@/lib/store";
import { useEffect } from "react";
import FlowCanvas from "./FlowCanvas";

/** The editable flowchart: FlowCanvas wired to the store, plus its toolbar. */
export default function FlowView({
  exportRef,
}: {
  exportRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const tasks = useApp((s) => s.plan.tasks);
  const goals = useApp((s) => s.plan.goals);
  const selectedId = useApp((s) => s.selectedId);
  const {
    select,
    setEditorOpen,
    updateTask,
    toggleDependency,
    toggleDone,
    quickAdd,
    ensureFlowPositions,
    autoArrangeFlow,
  } = useApp();

  const missingPos = tasks.filter((t) => t.flowX == null).length;
  useEffect(() => {
    if (missingPos > 0) ensureFlowPositions();
  }, [missingPos, ensureFlowPositions]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-1 pb-2 text-[11px] text-slate-500 flex-wrap">
        <button onClick={autoArrangeFlow} className="btn">
          ✨ Auto-arrange
        </button>
        <span>double-click canvas: new task (quick-add syntax works)</span>
        <span>· drag ○ → node: dependency</span>
        <span>· click arrow: remove</span>
        <span>· drop in ∥ band: concurrent</span>
      </div>

      <FlowCanvas
        tasks={tasks}
        goals={goals}
        selectedId={selectedId}
        onSelect={select}
        onEdit={(id) => {
          select(id);
          setEditorOpen(true);
        }}
        onMove={(id, { x, y }, parallel) =>
          updateTask(id, { flowX: x, flowY: y, parallel })
        }
        onToggleDependency={toggleDependency}
        onToggleDone={toggleDone}
        onCreate={(input, { x, y }, parallel) => {
          const id = quickAdd(input);
          if (id) updateTask(id, { flowX: x, flowY: y, parallel });
        }}
        canvasRef={(el) => {
          if (exportRef) exportRef.current = el;
        }}
      />
    </div>
  );
}
