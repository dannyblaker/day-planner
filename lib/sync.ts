"use client";

import { useEffect, useRef } from "react";
import { useApp } from "./store";
import { Plan } from "./types";

const LS_KEY = "concurrencyflow-plan";

/** Load the plan on mount; autosave (debounced) on every change. No save button, ever. */
export function usePlanSync() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    const save = (plan: Plan) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        useApp.getState().setSaving(true);
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(plan));
        } catch {}
        try {
          await fetch("/api/plan", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(plan),
          });
        } catch {}
        useApp.getState().setSaving(false);
      }, 600);
    };

    (async () => {
      let plan: Plan | null = null;
      try {
        const res = await fetch("/api/plan", { cache: "no-store" });
        plan = await res.json();
      } catch {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) plan = JSON.parse(raw);
        } catch {}
      }
      if (cancelled) return;
      useApp.getState().load(plan);

      // Watch for changes only now: loading is itself a change to `plan`, and
      // subscribing any earlier would echo the plan we just read back to the
      // server as a redundant write.
      if (cancelled) return;
      unsub = useApp.subscribe((state, prev) => {
        if (state.loaded && state.plan !== prev.plan) save(state.plan);
      });

      if (!plan) {
        // first run: publish the seeded plan so the share link works right away
        try {
          await fetch("/api/plan", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(useApp.getState().plan),
          });
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
