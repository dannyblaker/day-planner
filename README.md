# DayFlow

A keyboard-driven day planner built for one thing: **plan your day in 15 minutes, then let the schedule take care of itself.**

The core idea is that the timeline is *derived state*. You maintain a simple ordered queue of tasks; DayFlow continuously computes the schedule from the queue, the current time, your meetings, and your dependencies. Add a spontaneous task, run late, get blocked — everything downstream reflows automatically. There is no save button; every change autosaves.

## Features

- **Auto-reflowing schedule** — flexible tasks pack around fixed-time meetings, from *now* onward. If you fall behind, the plan shifts with you.
- **Spontaneous tasks** — add a task with `^` and it jumps to the front of the queue; the rest of the day shifts to make room.
- **Dependencies** — task B can require task A to finish first (`>taskname` in quick-add, or checkboxes in the editor). Cycles are prevented.
- **Concurrency** — mark a task parallel (`~`) and it moves to a background lane that overlaps focus work (CI runs, laundry, waiting on someone).
- **Blockers** — mark a task blocked with a reason; it leaves the timeline and parks in a Blocked list. Dependents get flagged.
- **Timers** — start/pause a per-task timer; actual time is tracked against planned, with an overrun alarm. The tab title shows the countdown.
- **Notifications** — desktop notifications when fixed-time tasks start and when a timer overruns.
- **Prioritisation** — P1–P4 with one-key assignment, plus one-key auto-sort of the queue by priority.
- **Goals** — map tasks to goals (`#goal`); a panel shows how today's time is allocated per goal, planned vs. done.
- **Capacity meter** — planned vs. available time with slack/overrun, always visible. Tasks that won't fit before day end are flagged red.
- **Live share** — send your manager a read-only link (`Share live`) that polls the plan every 5 seconds.
- **Export** — one click to PNG or PDF of the timeline, matching the theme you're in.
- **Light / dark theme** (`m`, or the ☀️/🌙 button) — follows your OS preference until you pick one; the choice is per-device and applied before first paint, so there's no flash on reload.
- **Multi-day** — navigate days with `[` / `]`, defer a task to tomorrow with `o`.
- **Clear finished work** — `clear` on the Done list drops the day's completed tasks; an undo bar (or `u` / `⌘Z`) puts them back, dependency links included, without disturbing anything you changed in the meantime.
- **Drag & drop** — drag tasks on the timeline (or rows in the list) to reorder the queue; drag a 📌 pinned task to move its time (Shift = 5-min snap); Alt+drag any task to pin it at a specific time.
- **Flowchart view** (`v`) — plan visually on a canvas: tasks are nodes, dependencies are arrows you draw by dragging from a node's ○ port. Double-click the canvas to create a task in place (quick-add syntax works), click an arrow to remove it, and drop a node into the ∥ swimlane to make it concurrent. Auto-arrange lays the graph out by dependency depth. Both views edit the same plan, so the timeline reflows as you sketch.

## Getting started

### Docker (recommended for daily use)

```bash
docker compose up -d
```

Open http://localhost:3000. This runs the app plus a Postgres database; your plan lives in the `pgdata` named volume, so it survives restarts, rebuilds, and `docker compose down`. (`docker compose down -v` is the only thing that deletes it.) After pulling changes, rebuild with `docker compose up -d --build`.

The live-share view works for anyone who can reach your machine — for manager sharing, give them your LAN address (`http://<your-ip>:3000/share/<token>`).

### Dev mode (no database needed)

```bash
npm install
npm run dev
```

Without `DATABASE_URL` set, the plan is stored in `data/plan.json` (with a localStorage fallback) — same app, file-backed instead of Postgres.

## The 15-minute morning flow

1. Press `n` and brain-dump tasks — the input stays focused, one task per Enter.
2. Add tokens as you type: `Write report 45m !1 #deep-work`, `Standup 15m @10am`, `CI run 45m ~`.
3. Press `s` to sort by priority, then `Shift+J/K` to fine-tune order.
4. Check the capacity meter — over capacity? Defer something with `o`.
5. Press `Space` on the first task and go.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `n` / `c` / `⌘K` | quick-add task |
| `j` / `k` | select next / previous |
| `Shift+J` / `Shift+K` | move task down / up the queue |
| `Enter` / `e` | edit selected |
| `Space` | start / pause timer |
| `d` | toggle done |
| `b` | toggle blocked |
| `1`–`4` | set priority |
| `p` | toggle parallel lane |
| `+` / `-` | duration ±15m |
| `s` | auto-sort by priority |
| `o` | defer to tomorrow |
| `x` / `Del` | delete |
| `u` / `⌘Z` | undo the last clear |
| `[` / `]` | previous / next day |
| `t` | today |
| `v` | toggle timeline / flowchart view |
| `m` | toggle light / dark theme |
| `?` | help |
| drag on timeline | reorder · move pinned task · Alt+drag to pin |
| flow view | dbl-click: new task · drag ○→node: dependency · click arrow: remove · drop in ∥ band: concurrent |

## Quick-add syntax

```
Fix login bug 1h !1 #deep-work >deploy @2pm ~ *waiting-on-bob ^
```

| Token | Meaning |
|---|---|
| `45m` `1h` `1h30` | duration |
| `!1`…`!4` | priority |
| `#goal` | goal (created if new) |
| `@2pm` `@14:30` | fixed start time (meeting) |
| `>title` | depends on task whose title starts with… |
| `~` | parallel / background |
| `*reason` | blocked |
| `^` | do next — everything else shifts |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Zustand + Immer · html-to-image + jsPDF. Plan persistence is a single JSON file behind an API route; the scheduler (`lib/scheduler.ts`) is a pure function from queue + time → timeline.
