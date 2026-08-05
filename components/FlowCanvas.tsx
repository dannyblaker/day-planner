"use client";

import { FlowPos, arrangeByDepth } from "@/lib/flow";
import { statuses } from "@/lib/graph";
import { fmtDur } from "@/lib/format";
import {
  DONE_COLOR,
  FLOW,
  Goal,
  PRIORITY_COLOR,
  STATUS_LABEL,
  Task,
} from "@/lib/types";
import { useRef, useState } from "react";
import CrocShape, { BACK, DONE_AT } from "./CrocShape";
import DoneButton from "./DoneButton";

const { W, H, NODE_W, NODE_H } = FLOW;

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

interface Props {
  tasks: Task[];
  goals: Goal[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  /** a node was dragged: its new position */
  onMove?: (id: string, pos: FlowPos) => void;
  onToggleDependency?: (taskId: string, depId: string) => void;
  /** omitted by the read-only share view, which draws no done button */
  onToggleDone?: (id: string) => void;
  /**
   * A new task: quick-add text, dropped at that spot. `dependsOn` is set when
   * the task was started from a node's port, and is the task it waits on.
   */
  onCreate?: (input: string, pos: FlowPos, dependsOn?: string) => void;
  /** an outside request (the `a` key) to start a task depending on this one */
  createFrom?: { sourceId: string; nonce: number } | null;
  /** hands the canvas element out for PNG/PDF export */
  canvasRef?: (el: HTMLDivElement | null) => void;
}

/**
 * The flowchart itself: tasks as nodes, dependencies as arrows.
 *
 * Purely props-driven, and read-only when the editing callbacks are omitted —
 * which is how the share view reuses it without a store behind it.
 */
export default function FlowCanvas({
  tasks,
  goals,
  selectedId,
  onSelect,
  onEdit,
  onMove,
  onToggleDependency,
  onToggleDone,
  onCreate,
  createFrom,
  canvasRef: exposeCanvas,
}: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const [dragNode, setDragNode] = useState<DragNode | null>(null);
  const [tempEdge, setTempEdge] = useState<TempEdge | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [creating, setCreating] = useState<{
    pos: FlowPos;
    dependsOn?: string;
  } | null>(null);
  const [createText, setCreateText] = useState("");

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const statusOfId = statuses(tasks);
  // only consulted for nodes that have no stored position of their own
  const fallback = arrangeByDepth(tasks);

  const pos = (t: Task): FlowPos => {
    if (dragNode?.id === t.id) return { x: dragNode.x, y: dragNode.y };
    if (t.flowX != null && t.flowY != null) return { x: t.flowX, y: t.flowY };
    return fallback.get(t.id) ?? { x: 0, y: 0 };
  };
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
  const clamp = (p: FlowPos): FlowPos => ({
    x: Math.max(0, Math.min(W - NODE_W, p.x)),
    y: Math.max(0, Math.min(H - NODE_H, p.y)),
  });

  /** first free spot to the right of a node — where its next dependent goes */
  const rightOf = (t: Task): FlowPos => {
    const p = pos(t);
    const x = p.x + NODE_W + 60;
    const column = tasks
      .filter((o) => o.id !== t.id)
      .map(pos)
      .filter((q) => Math.abs(q.x - x) < NODE_W);
    let y = p.y;
    while (column.some((q) => Math.abs(q.y - y) < NODE_H + 12) && y < H - NODE_H)
      y += NODE_H + 28;
    return { x, y };
  };

  /** open the inline input; `dependsOn` wires what it creates to a prerequisite */
  const openCreate = (p: FlowPos, dependsOn?: string) => {
    if (!onCreate) return;
    setCreating({
      pos: {
        x: Math.max(0, Math.min(W - 260, p.x)),
        y: Math.max(0, Math.min(H - 60, p.y)),
      },
      dependsOn,
    });
    setCreateText("");
  };

  // The `a` key, arriving as a prop: the same input, opened beside the task.
  // Adjusted during render rather than in an effect, so the input is there in
  // the pass that answers the keypress. The nonce is what makes it once-only.
  const [servedRequest, setServedRequest] = useState<number | null>(null);
  if (createFrom && createFrom.nonce !== servedRequest) {
    setServedRequest(createFrom.nonce);
    const t = byId.get(createFrom.sourceId);
    if (t) openCreate(rightOf(t), t.id);
  }

  const edgePath = (sx: number, sy: number, tx: number, ty: number) => {
    const c = Math.max(40, Math.abs(tx - sx) / 2);
    return `M ${sx} ${sy} C ${sx + c} ${sy}, ${tx - c} ${ty}, ${tx} ${ty}`;
  };

  // ── node dragging ──────────────────────────────────────────────
  const onNodePointerDown = (e: React.PointerEvent, t: Task) => {
    if (!onMove || e.button !== 0) return;
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
      setDragNode({ id: t.id, ...clamp({ x: c.x - dx, y: c.y - dy }) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      if (!started) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      const c = canvasPoint(ev.clientX, ev.clientY);
      onMove(t.id, clamp({ x: c.x - dx, y: c.y - dy }));
      setDragNode(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  // ── dependency drawing (drag from a node's ○ port) ─────────────
  //
  // Three endings, all of them the same sentence: something waits on this task.
  // Let go over another node and that node waits on it; let go over empty
  // canvas — or just click the port — and you get a new task that does.
  const onPortPointerDown = (e: React.PointerEvent, t: Task) => {
    if (!onToggleDependency || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const a = outAnchor(t);
    const start = canvasPoint(e.clientX, e.clientY);
    let moved = false;
    setTempEdge({ sourceId: t.id, sx: a.x, sy: a.y, tx: a.x, ty: a.y });
    const move = (ev: PointerEvent) => {
      const c = canvasPoint(ev.clientX, ev.clientY);
      if (Math.abs(c.x - start.x) > 4 || Math.abs(c.y - start.y) > 4)
        moved = true;
      setTempEdge((te) => (te ? { ...te, tx: c.x, ty: c.y } : te));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      setTempEdge(null);
      if (!moved) return openCreate(rightOf(t), t.id);

      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const targetId = under
        ?.closest("[data-flow-node]")
        ?.getAttribute("data-flow-node");
      if (targetId) {
        const target = byId.get(targetId);
        // add-only: toggling an existing edge here would silently remove it
        if (targetId !== t.id && target && !target.dependsOn.includes(t.id))
          onToggleDependency(targetId, t.id);
        return;
      }
      // dropped on nothing: the arrow needs a task on the end of it. Only if
      // that nothing is our own canvas — let go over the sidebar and it's a
      // cancel, same as it looks.
      if (!canvasRef.current?.contains(under)) return;
      const c = canvasPoint(ev.clientX, ev.clientY);
      openCreate({ x: c.x, y: c.y - NODE_H / 2 }, t.id);
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
    if (!onCreate || e.target !== e.currentTarget) return;
    openCreate(canvasPoint(e.clientX, e.clientY));
  };

  const commitCreate = () => {
    if (onCreate && creating && createText.trim())
      onCreate(createText, creating.pos, creating.dependsOn);
    setCreating(null);
  };

  // the not-yet-drawn arrow, held while you type the task on the end of it
  const pendingSource = creating?.dependsOn
    ? byId.get(creating.dependsOn)
    : undefined;

  // ── edges ──────────────────────────────────────────────────────
  const edges: { key: string; from: Task; to: Task }[] = [];
  for (const t of tasks)
    for (const depId of t.dependsOn) {
      const dep = byId.get(depId);
      if (dep) edges.push({ key: `${depId}->${t.id}`, from: dep, to: t });
    }

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-800"
    >
      <div
        ref={(el) => {
          canvasRef.current = el;
          exposeCanvas?.(el);
        }}
        onPointerDown={onCanvasPointerDown}
        onDoubleClick={onCanvasDoubleClick}
        className="croc-water relative bg-background cursor-grab"
        style={{ width: W, height: H }}
      >
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
            const involved = selectedId === from.id || selectedId === to.id;
            const stroke =
              hoverEdge === key
                ? "var(--edge-hover)"
                : involved
                  ? "var(--edge-active)"
                  : // a satisfied prerequisite is history — fade the arrow out
                    from.done
                    ? "var(--edge-dim)"
                    : "var(--edge)";
            return (
              <g
                key={key}
                onClick={
                  onToggleDependency
                    ? () => onToggleDependency(to.id, from.id)
                    : undefined
                }
                onMouseEnter={() => setHoverEdge(key)}
                onMouseLeave={() => setHoverEdge(null)}
                className={onToggleDependency ? "cursor-pointer" : undefined}
              >
                <title>
                  {from.title} → {to.title}
                  {onToggleDependency ? " — click to remove" : ""}
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
          const goal = goals.find((g) => g.id === t.goalId);
          const status = statusOfId.get(t.id)!;
          const done = status === "done";
          const dragging = dragNode?.id === t.id;
          return (
            <div
              key={t.id}
              data-flow-node={t.id}
              onPointerDown={(e) => onNodePointerDown(e, t)}
              onClick={
                onSelect
                  ? (e) => {
                      e.stopPropagation();
                      if (!suppressClick.current) onSelect(t.id);
                    }
                  : undefined
              }
              onDoubleClick={
                onEdit
                  ? (e) => {
                      e.stopPropagation();
                      onEdit(t.id);
                    }
                  : undefined
              }
              title={`${t.title} — ${STATUS_LABEL[status]}`}
              className={`group croc-node absolute z-10 select-none status-${status} ${
                onMove ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
              } ${done ? "opacity-60" : ""} ${
                // dashed all round marks the concurrent lane, as it always has
                t.parallel ? "is-parallel" : ""
              } ${selectedId === t.id ? "is-selected" : ""}`}
              style={{
                left: p.x,
                top: p.y,
                width: NODE_W,
                height: NODE_H,
                touchAction: "none",
                zIndex: dragging ? 30 : 10,
                filter: dragging ? "var(--drag-filter)" : undefined,
                ["--croc-tail-fill" as string]: done
                  ? DONE_COLOR
                  : PRIORITY_COLOR[t.priority],
              }}
            >
              <CrocShape status={status} done={done} />

              {/* the label, on the flat of its back */}
              <div
                className="absolute overflow-hidden"
                style={{
                  left: BACK.left,
                  right: BACK.right,
                  top: BACK.top,
                  bottom: BACK.bottom,
                }}
              >
                <div
                  className={`text-label font-medium truncate ${
                    done ? "line-through text-slate-500" : "text-slate-100"
                  }`}
                >
                  {t.title}
                </div>
                {/* one line, goal included: a crocodile's back is only so long,
                    and a third row of small print runs off the end of it */}
                <div className="text-note text-slate-400 flex gap-1.5 items-center mt-0.5">
                  <span className="shrink-0">{fmtDur(t.duration)}</span>
                  {t.parallel && (
                    <span className="shrink-0" title="concurrent">
                      ∥
                    </span>
                  )}
                  {goal && (
                    <span
                      className="px-1 rounded-full truncate min-w-0"
                      style={{
                        backgroundColor: goal.color + "33",
                        color: goal.color,
                      }}
                    >
                      {goal.name}
                    </span>
                  )}
                  {t.blocked && (
                    <span
                      className="text-red-400 truncate min-w-0"
                      title={t.blocked}
                    >
                      ⛔ {t.blocked}
                    </span>
                  )}
                </div>
              </div>
              {onToggleDone && (
                <DoneButton
                  done={done}
                  onToggle={() => onToggleDone(t.id)}
                  style={{ right: DONE_AT.right, bottom: DONE_AT.bottom }}
                />
              )}
              {/* out-port: drag to another node to create a dependency */}
              {onToggleDependency && (
                <div
                  onPointerDown={(e) => onPortPointerDown(e, t)}
                  className="absolute -right-[7px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-slate-400 bg-background hover:border-lagoon-400 hover:bg-lagoon-950 cursor-crosshair"
                  title="drag to another task, or click for a new one: it will depend on this one"
                  style={{ touchAction: "none" }}
                />
              )}
            </div>
          );
        })}

        {/* the arrow being drawn, or the one waiting on a task to be named */}
        {(tempEdge || pendingSource) && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={W}
            height={H}
            style={{ zIndex: 40 }}
          >
            {tempEdge && (
              <path
                d={edgePath(tempEdge.sx, tempEdge.sy, tempEdge.tx, tempEdge.ty)}
                style={{ stroke: "var(--edge-active)" }}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                markerEnd="url(#flow-arrow)"
              />
            )}
            {pendingSource && creating && (
              <path
                d={edgePath(
                  outAnchor(pendingSource).x,
                  outAnchor(pendingSource).y,
                  creating.pos.x,
                  creating.pos.y + 17
                )}
                style={{ stroke: "var(--edge-active)" }}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="none"
                markerEnd="url(#flow-arrow)"
              />
            )}
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
            placeholder={
              pendingSource
                ? `New task after “${pendingSource.title}”…`
                : "New task…  45m !1 #goal"
            }
            className="absolute z-40 w-60 bg-slate-800 border border-lagoon-500 outline-none rounded-md px-2.5 py-1.5 text-label text-slate-200 placeholder:text-slate-600 shadow-xl"
            style={{ left: creating.pos.x, top: creating.pos.y }}
          />
        )}
      </div>
    </div>
  );
}
