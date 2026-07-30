# ConcurrencyFlow

A flowchart for planning work that runs alongside other work: **tasks are nodes, dependencies are arrows, and status follows the graph.**

The core idea is that status is *derived state*. You don't set a task to "in progress" — you draw the dependencies, and everything whose prerequisites are finished is in progress, all of it at once. That set is the answer to the only question the board exists to answer: what can I run in parallel right now? Mark one thing done and its dependents move up on their own. There is no save button; every change autosaves.

There is no clock in here. A dependency graph is a claim about order, not about when, so there are no working hours, no schedule, and no calendar — just the graph and what it implies.

## Features

- **Flowchart-first** — the canvas is the app. Double-click to create a task in place (quick-add syntax works), drag from a node's ○ port to another node to draw a dependency, click an arrow to remove it. Auto-arrange lays the graph out by dependency depth.
- **Three statuses, derived** — *In progress* (every prerequisite done — startable now), *To do* (waiting on a prerequisite, or blocked), *Done* (the one part you set). Nodes and list rows are coloured by status: grey waiting, amber startable, green finished.
- **Concurrency band** — drop a node below the ∥ divider and it runs concurrently with focus work (CI runs, laundry, waiting on someone). The divider sits inside the first screenful, because seeing what overlaps what is the point.
- **Blockers** — mark a task blocked with a reason and it is held at *to do* however clear its prerequisites are: a blocker is a reason you can't start that the graph can't see.
- **Cycle-safe** — the editor greys out any dependency that would close a loop, and the layout terminates on a cycle rather than hanging.
- **Prioritisation** — P1–P4 with one-key assignment, shown as the node's left stripe, plus one-key auto-sort of the to-do queue by priority.
- **Goals** — map tasks to goals (`#goal`); a panel shows work done against work planned per goal.
- **Live share** — send someone a read-only link (`Share live`) that polls the plan every 5 seconds. Read-only means it: no done buttons, no ports, no clickable arrows.
- **Export** — one click to PNG or PDF of the canvas, matching the theme you're in.
- **Light / dark theme** (`m`, or the ☀️/🌙 button) — follows your OS preference until you pick one; the choice is per-device and applied before first paint, so there's no flash on reload.
- **Clear finished work** — `clear` on the Done group drops the finished tasks; an undo bar (or `u` / `⌘Z`) puts them back, dependency links included, without disturbing anything you changed in the meantime.
- **Keyboard-driven** — `j`/`k` walks the board in status order, and everything else is one key. Press `?`.

## Getting started

### Docker (recommended for daily use)

```bash
docker compose up -d
```

Open http://localhost:3000. This runs the app plus a Postgres database; your plan lives in the `pgdata` named volume, so it survives restarts, rebuilds, and `docker compose down`. (`docker compose down -v` is the only thing that deletes it.) After pulling changes, rebuild with `docker compose up -d --build`.

The live-share view works for anyone who can reach your machine — give them your LAN address (`http://<your-ip>:3000/share/<token>`).

### Dev mode (no database needed)

```bash
npm install
npm run dev
```

Without `DATABASE_URL` set, the plan is stored in `data/plan.json` (with a localStorage fallback) — same app, file-backed instead of Postgres.

## Tests

```bash
npm test          # unit + component (Vitest, jsdom) — ~3s
npm run test:e2e  # end-to-end (Playwright, Chromium) — starts its own dev server
npm run test:all  # both
npm run test:watch
```

Two layers, split by what they can actually prove:

- **`tests/`** — the derived-state core in isolation: how the graph turns dependencies into statuses, the depth layout, the quick-add grammar, every store action, the theme boot script, the debounced autosave, and the plan route against a temp directory and a stubbed Postgres.
- **`e2e/`** — the app in a real browser: quick-add through to a coloured node, marking work done and watching the frontier advance, clear/undo, flowchart drag and dependency drawing, keyboard-only operation, theming (including that the choice is applied *before first paint*), and the share link's read-only guarantee.

The end-to-end suite stubs `/api/plan` in the browser at context scope, so **no run ever reads or writes your real `data/plan.json`** — the route itself is covered by unit tests instead.

## The planning flow

1. Press `n` and brain-dump tasks — the input stays focused, one task per Enter.
2. Add tokens as you type: `Write report 45m !1 #deep-work`, `CI run 45m ~`.
3. Draw the arrows: drag from one node's ○ port onto whatever it has to finish before.
4. Press `✨ Auto-arrange`. The leftmost column goes amber — that is what you can start, and how much of it you can start at once.
5. Finish something, mark it done, and watch the next column light up.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `n` / `c` / `⌘K` | quick-add task |
| `j` / `k` | select next / previous (in status order) |
| `Shift+J` / `Shift+K` | move task down / up the to-do queue |
| `Enter` / `e` | edit selected |
| `d` | toggle done — dependents become in-progress |
| `b` | toggle blocked |
| `1`–`4` | set priority |
| `p` | toggle the concurrency band |
| `+` / `-` | duration ±15m |
| `s` | auto-sort by priority |
| `x` / `Del` | delete |
| `u` / `⌘Z` | undo the last clear |
| `m` | toggle light / dark theme |
| `?` | help |
| canvas | dbl-click: new task · drag ○→node: dependency · click arrow: remove · drop in ∥ band: concurrent |

## Quick-add syntax

```
Fix login bug 1h !1 #deep-work >deploy ~ *waiting-on-bob ^
```

| Token | Meaning |
|---|---|
| `45m` `1h` `1h30` | duration (a label — nothing schedules it) |
| `!1`…`!4` | priority |
| `#goal` | goal (created if new) |
| `>title` | depends on task whose title starts with… |
| `~` | concurrent / background |
| `*reason` | blocked |
| `^` | front of the to-do queue |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Zustand + Immer · html-to-image + jsPDF. Plan persistence is a single JSON document behind an API route; `lib/graph.ts` is a pure function from tasks + dependencies → statuses, and `lib/flow.ts` from the same graph → canvas positions.
