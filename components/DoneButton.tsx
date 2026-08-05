"use client";

/**
 * Mark done / reopen, overlaid on a task wherever it's drawn (timeline slot,
 * flowchart node). Revealed on hover of the enclosing `.group`, and it swallows
 * pointer events so it never starts a drag or selects the task underneath.
 */
export default function DoneButton({
  done,
  onToggle,
  className = "",
  style,
}: {
  done: boolean;
  onToggle: () => void;
  className?: string;
  /** where to sit, for callers whose geometry is computed rather than a class */
  style?: React.CSSProperties;
}) {
  return (
    <button
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={done ? "Reopen task" : "Mark task done"}
      title={done ? "reopen (d)" : "mark done (d)"}
      className={`absolute z-20 w-[18px] h-[18px] rounded-full border flex items-center
        justify-center text-note leading-none transition-opacity
        opacity-0 group-hover:opacity-100 focus-visible:opacity-100
        border-slate-500 bg-slate-900/90 text-slate-300
        hover:border-emerald-400 hover:text-emerald-300 ${className}`}
    >
      {done ? "↺" : "✓"}
    </button>
  );
}
