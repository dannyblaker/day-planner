"use client";

import { useApp } from "@/lib/store";
import { fmtDur, fmtTime } from "@/lib/time";
import { FLOW, Slot, Task } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { DONE_COLOR, PRIORITY_COLOR } from "./Timeline";

const { W, H, PAR_Y, NODE_W, NODE_H } = FLOW;

interface DragNode {
  id: string;
  x: number;
  y: number;
}
interface TempEdge {
  sourceId: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export default function FlowView({
  slots,
  exportRef,
}: {
  slots: Slot[];
  exportRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const day = useApp((s) => s.plan.days[s.date]);
  const goals = useApp((s) => s.plan.goals);
  const selectedId = useApp((s) => s.selectedId);
  const {
    select,
    setEditorOpen,
    updateTask,
    toggleDependency,
    quickAdd,
    ensureFlowPositions,
    autoArrangeFlow,
  } = useApp();

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const [dragNode, setDragNode] = useState<DragNode | null>(null);
  const [tempEdge, setTempEdge] = useState<TempEdge | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ x: number; y: number } | null>(null);
  const [createText, setCreateText] = useState("");

  const missingPos = day?.tasks.filter((t) => t.flowX == null).length ?? 0;
  useEffect(() => {
    if (missingPos > 0) ensureFlowPositions();
  }, [missingPos, ensureFlowPositions]);

  if (!day) return null;

  const tasks = day.tasks;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const slotOf = new Map(slots.map((s) => [s.task.id, s]));
  const pos = (t: Task) =>
    dragNode?.id === t.id
      ? { x: dragNode.x, y: dragNode.y }
      : { x: t.flowX ?? 0, y: t.flowY ?? 0 };
  const outAnchor = (t: Task) => {
    const p = pos(t);
    return { x: p.x + NODE_W, y: p.y + NODE_H / 2 };
  };
  const inAnchor = (t: Task) => {
    const p = pos(t);
    return { x: p.x, y: p.y + NODE_H / 2 };
  };
  const canvasPoint = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const edgePath = (sx: number, sy: number, tx: number, ty: number) => {
    const c = Math.max(40, Math.abs(tx - sx) / 2);
    return `M ${sx} ${sy} C ${sx + c} ${sy}, ${tx - c} ${ty}, ${tx} ${ty}`;
  };

  // ── node dragging ──────────────────────────────────────────────
  const onNodePointerDown = (e: React.PointerEvent, t: Task) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const start = canvasPoint(e.clientX, e.clientY);
    const p0 = pos(t);
    const dx = start.x - p0.x;
    const dy = start.y - p0.y;
    let started = false;
    const move = (ev: PointerEvent) => {
      const c = canvasPoint(ev.clientX, ev.clientY);
      if (
        !started &&
        Math.abs(c.x - start.x) < 4 &&
        Math.abs(c.y - start.y) < 4
      )
        return;
      started = true;
      setDragNode({
        id: t.id,
        x: Math.max(0, Math.min(W - NODE_W, c.x - dx)),
        y: Math.max(0, Math.min(H - NODE_H, c.y - dy)),
      });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      if (!started) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      const c = canvasPoint(ev.clientX, ev.clientY);
      const x = Math.max(0, Math.min(W - NODE_W, c.x - dx));
      const y = Math.max(0, Math.min(H - NODE_H, c.y - dy));
      // crossing into/out of the ∥ band toggles concurrency
      updateTask(t.id, {
        flowX: x,
        flowY: y,
        parallel: y + NODE_H / 2 >= PAR_Y,
      });
      setDragNode(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  // ── dependency drawing (drag from a node's ○ port) ─────────────
  const onPortPointerDown = (e: React.PointerEvent, t: Task) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const a = outAnchor(t);
    setTempEdge({ sourceId: t.id, sx: a.x, sy: a.y, tx: a.x, ty: a.y });
    const move = (ev: PointerEvent) => {
      const c = canvasPoint(ev.clientX, ev.clientY);
      setTempEdge((te) => (te ? { ...te, tx: c.x, ty: c.y } : te));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      setTempEdge(null);
      const el = document
        .elementFromPoint(ev.clientX, ev.clientY)
        ?.closest("[data-flow-node]");
      const targetId = el?.getAttribute("data-flow-node");
      if (targetId && targetId !== t.id) {
        const target = byId.get(targetId);
        // add-only: toggling an existing edge here would silently remove it
        if (target && !target.dependsOn.includes(t.id))
          toggleDependency(targetId, t.id);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  // ── canvas panning + double-click create ───────────────────────
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    const sc = scrollRef.current;
    if (!sc) return;
    const sx = e.clientX,
      sy = e.clientY,
      sl = sc.scrollLeft,
      st = sc.scrollTop;
    const move = (ev: PointerEvent) => {
      sc.scrollLeft = sl - (ev.clientX - sx);
      sc.scrollTop = st - (ev.clientY - sy);
    };
    const up = () => window.removeEventListener("pointermove", move);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const onCanvasDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const c = canvasPoint(e.clientX, e.clientY);
    setCreating({
      x: Math.min(c.x, W - 260),
      y: Math.min(c.y, H - 60),
    });
    setCreateText("");
  };

  const commitCreate = () => {
    if (creating && createText.trim()) {
      const id = quickAdd(createText);
      if (id)
        updateTask(id, {
          flowX: creating.x,
          flowY: creating.y,
          parallel: creating.y + NODE_H / 2 >= PAR_Y,
        });
    }
    setCreating(null);
  };

  // ── edges ──────────────────────────────────────────────────────
  const edges: { key: string; from: Task; to: Task }[] = [];
  for (const t of tasks)
    for (const depId of t.dependsOn) {
      const dep = byId.get(depId);
      if (dep) edges.push({ key: `${depId}->${t.id}`, from: dep, to: t });
    }

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

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto rounded-lg border border-slate-800"
      >
        <div
          ref={(el) => {
            canvasRef.current = el;
            if (exportRef) exportRef.current = el;
          }}
          onPointerDown={onCanvasPointerDown}
          onDoubleClick={onCanvasDoubleClick}
          className="relative bg-background cursor-grab"
          style={{
            width: W,
            height: H,
            backgroundImage:
              "radial-gradient(circle, var(--flow-dot) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        >
          {/* parallel swimlane */}
          <div
            className="absolute left-0 right-0 bottom-0 pointer-events-none border-t-2 border-dashed border-slate-700 bg-slate-900/40"
            style={{ top: PAR_Y }}
          >
            <span className="absolute top-2 left-4 text-[11px] uppercase tracking-widest text-slate-600">
              ∥ parallel / background — tasks here run concurrently
            </span>
          </div>
          <span className="absolute top-2 left-4 text-[11px] uppercase tracking-widest text-slate-600 pointer-events-none">
            focus — one at a time, in dependency order
          </span>

          {/* dependency edges */}
          <svg
            className="absolute inset-0"
            width={W}
            height={H}
            style={{ pointerEvents: "none" }}
          >
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {edges.map(({ key, from, to }) => {
              const s = outAnchor(from);
              const e2 = inAnchor(to);
              const d = edgePath(s.x, s.y, e2.x, e2.y);
              const involved =
                selectedId === from.id || selectedId === to.id;
              const stroke =
                hoverEdge === key
                  ? "var(--edge-hover)"
                  : involved
                    ? "var(--edge-active)"
                    : from.status === "done"
                      ? "var(--edge-dim)"
                      : "var(--edge)";
              return (
                <g
                  key={key}
                  onClick={() => toggleDependency(to.id, from.id)}
                  onMouseEnter={() => setHoverEdge(key)}
                  onMouseLeave={() => setHoverEdge(null)}
                  className="cursor-pointer"
                >
                  <title>
                    {from.title} → {to.title} — click to remove
                  </title>
                  <path
                    d={d}
                    stroke="transparent"
                    strokeWidth={14}
                    fill="none"
                    style={{ pointerEvents: "stroke" }}
                  />
                  {/* stroke goes through `style`: a var() in the SVG
                      presentation attribute wouldn't resolve */}
                  <path
                    d={d}
                    style={{ stroke }}
                    strokeWidth={1.5}
                    fill="none"
                    markerEnd="url(#flow-arrow)"
                  />
                </g>
              );
            })}
          </svg>

          {/* nodes */}
          {tasks.map((t) => {
            const p = pos(t);
            const slot = slotOf.get(t.id);
            const goal = goals.find((g) => g.id === t.goalId);
            const done = t.status === "done";
            const active = t.status === "active";
            const dragging = dragNode?.id === t.id;
            return (
              <div
                key={t.id}
                data-flow-node={t.id}
                onPointerDown={(e) => onNodePointerDown(e, t)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!suppressClick.current) select(t.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  select(t.id);
                  setEditorOpen(true);
                }}
                className={`absolute z-10 rounded-lg border px-2.5 py-1.5 select-none ${
                  dragging ? "cursor-grabbing" : "cursor-grab"
                } ${
                  done
                    ? "opacity-40 border-slate-700 bg-slate-900"
                    : active
                      ? "border-emerald-400/70 bg-emerald-950/70"
                      : t.blocked
                        ? "border-red-500/60 bg-red-950/40"
                        : t.parallel
                          ? "border-dashed border-slate-500 bg-slate-800/90"
                          : "border-slate-600 bg-slate-800/95"
                } ${selectedId === t.id ? "ring-2 ring-indigo-400" : ""}`}
                style={{
                  left: p.x,
                  top: p.y,
                  width: NODE_W,
                  height: NODE_H,
                  borderLeftWidth: 3,
                  borderLeftColor: done ? DONE_COLOR : PRIORITY_COLOR[t.priority],
                  borderLeftStyle: "solid",
                  touchAction: "none",
                  zIndex: dragging ? 30 : 10,
                  boxShadow: dragging ? "var(--drag-shadow)" : undefined,
                }}
              >
                <div
                  className={`text-[11px] font-medium truncate ${
                    done ? "line-through text-slate-500" : "text-slate-100"
                  }`}
                >
                  {t.fixedStart != null && <span>📌 </span>}
                  {active && <span className="text-emerald-400">▶ </span>}
                  {t.title}
                </div>
                <div className="text-[9px] text-slate-400 flex gap-1.5 items-center mt-0.5 flex-wrap">
                  <span>{fmtDur(t.duration)}</span>
                  {slot && !done && (
                    <span className="text-slate-500">{fmtTime(slot.start)}</span>
                  )}
                  {t.parallel && <span title="concurrent">∥</span>}
                  {t.blocked && (
                    <span className="text-red-400 truncate" title={t.blocked}>
                      ⛔ {t.blocked}
                    </span>
                  )}
                  {slot?.overflow && (
                    <span className="text-red-400">won&apos;t fit</span>
                  )}
                </div>
                {goal && (
                  <div
                    className="text-[9px] px-1 rounded-full inline-block mt-0.5 truncate max-w-full"
                    style={{
                      backgroundColor: goal.color + "33",
                      color: goal.color,
                    }}
                  >
                    {goal.name}
                  </div>
                )}
                {/* out-port: drag to another node to create a dependency */}
                <div
                  onPointerDown={(e) => onPortPointerDown(e, t)}
                  className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-400 bg-background hover:border-indigo-400 hover:bg-indigo-950 cursor-crosshair"
                  title="drag to another task: it will depend on this one"
                  style={{ touchAction: "none" }}
                />
              </div>
            );
          })}

          {/* temp edge while drawing a dependency */}
          {tempEdge && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width={W}
              height={H}
              style={{ zIndex: 40 }}
            >
              <path
                d={edgePath(tempEdge.sx, tempEdge.sy, tempEdge.tx, tempEdge.ty)}
                style={{ stroke: "var(--edge-active)" }}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                markerEnd="url(#flow-arrow)"
              />
            </svg>
          )}

          {/* inline create input */}
          {creating && (
            <input
              autoFocus
              value={createText}
              onChange={(e) => setCreateText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") setCreating(null);
              }}
              onBlur={() => setCreating(null)}
              placeholder="New task…  45m !1 #goal"
              className="absolute z-40 w-60 bg-slate-800 border border-indigo-500 outline-none rounded-md px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 shadow-xl"
              style={{ left: creating.x, top: creating.y }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
