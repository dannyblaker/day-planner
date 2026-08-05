"use client";

import { useEffect, useMemo, useRef } from "react";
import { finishedGroups } from "./graph";
import { useApp } from "./store";
import { currentSweep } from "./theme";

/** How long you have to change your mind. */
export const SWEEP_MS = 5000;

/**
 * The clock the countdown runs on. Monotonic, and not the wall clock: five
 * seconds is an elapsed time, and Date.now() answers a different question — one
 * whose answer moves when the system clock is corrected, a timezone changes, or
 * anything in front of the page freezes it. SweepCountdown reads the same clock,
 * because a deadline is only a number if both ends agree what it is measured on.
 */
export const now = () => performance.now();

/** How often the countdown is checked. Fine enough that nothing overruns by a
 *  visible amount, coarse enough to cost nothing between ticks. */
const TICK_MS = 250;

/**
 * Finished work takes itself off the board.
 *
 * Marking a task done starts a five-second countdown, and at the end of it the
 * task is deleted. Re-open it and the countdown stops — that is the whole of the
 * undo, which is why it is five seconds and not one.
 *
 * A task with an arrow at either end waits for the rest of the work it is joined
 * to; see finishedGroups(). So a chain does not vanish a link at a time — the
 * last task in it finishing is what starts the countdown, and then all of it
 * goes together.
 *
 * **It sweeps what it watched finish, not what it found already finished.** A
 * task only starts counting down if it was on the board unfinished a moment ago
 * and is finished now. Work that was already done when the app opened is left
 * alone — opening the app should not begin a five-second countdown on something
 * you finished last week and haven't looked at since — and so is work that
 * arrives already done, which is what undoing a clear does: putting tasks back
 * is not a reason to take them away again. The Done group's `clear` is still
 * there for a backlog, and it has an undo.
 */
export function useAutoDelete() {
  const tasks = useApp((s) => s.plan.tasks);
  const sweep = useApp((s) => s.sweep);
  const loaded = useApp((s) => s.loaded);

  // the boot script has already put this device's answer on <html>; the store
  // needs its own copy, because this preference is behaviour rather than paint
  useEffect(() => {
    useApp.getState().setSweep(currentSweep());
  }, []);

  const settled = useMemo(() => finishedGroups(tasks), [tasks]);

  /** the board as the last pass left it, which is what "just finished" is measured against */
  const before = useRef<{ ids: Set<string>; settled: Set<string> } | null>(null);

  useEffect(() => {
    const started = now();
    const s = useApp.getState();
    const ids = new Set(tasks.map((t) => t.id));
    const seenBefore = before.current;
    before.current = { ids, settled: new Set(settled) };

    if (!sweep || !loaded) {
      before.current = null;
      return;
    }
    // first pass since the sweep was switched on: nothing has "just" happened
    if (!seenBefore) return;

    const at: Record<string, number> = {};
    for (const id of settled) {
      const counting = s.sweepAt[id];
      if (counting != null) {
        // a re-render is not a reprieve, and a task whose neighbour settled a
        // moment later shouldn't restart the clock on the rest of the chain
        at[id] = counting;
      } else if (!seenBefore.settled.has(id) && seenBefore.ids.has(id)) {
        // it finished while we were watching: that is what the sweep is for
        at[id] = started + SWEEP_MS;
      }
      // anything else was finished before we looked, or arrived that way — an
      // undone clear puts tasks back done, and putting them back is not a
      // reason to take them away again
    }
    // re-opening a task drops its deadline, and its chain's with it
    const same =
      Object.keys(at).length === Object.keys(s.sweepAt).length &&
      Object.keys(at).every((id) => at[id] === s.sweepAt[id]);
    if (!same) s.setSweepAt(at);
    // every edit, not just every change of the settled set: "unfinished a moment
    // ago" is only true of a task the last pass actually saw
  }, [tasks, settled, sweep, loaded]);

  // the clock. One timer for the board, not one per task.
  useEffect(() => {
    if (!sweep) return;
    const tick = setInterval(() => {
      const s = useApp.getState();
      const due = Object.entries(s.sweepAt)
        .filter(([, when]) => when <= now())
        .map(([id]) => id);
      if (!due.length) return;
      for (const id of due) s.deleteTask(id);
      const rest = { ...s.sweepAt };
      for (const id of due) delete rest[id];
      s.setSweepAt(rest);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [sweep]);
}
