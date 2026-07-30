"use client";

import { ensureNotifyPermission } from "@/lib/notify";
import { useApp } from "@/lib/store";
import { forwardRef, useState } from "react";

const QuickAdd = forwardRef<HTMLInputElement>(function QuickAdd(_props, ref) {
  const quickAdd = useApp((s) => s.quickAdd);
  const [value, setValue] = useState("");

  return (
    <div className="px-1">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            ensureNotifyPermission();
            quickAdd(value);
            setValue("");
            // stays focused: brain-dump several tasks in a row
          }
          if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          e.stopPropagation();
        }}
        placeholder="Add task…  e.g. Write report 45m !1 #deep-work ~ ^"
        className="w-full bg-slate-800/80 border border-slate-700 focus:border-indigo-500 outline-none rounded-md px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600"
      />
    </div>
  );
});

export default QuickAdd;
