<img src="public/logo.svg" alt="Concurrent Crocodiles" width="300" height="104">

**A flowchart for planning work that runs alongside other work. Tasks are nodes, dependencies are arrows, and everything else is derived from those two facts.**

You never set a task to "in progress". You draw the dependencies, and every task whose prerequisites are finished is in progress — all of them at once. That set is the answer to the question the board exists to answer: *what can I start right now, and how much of it at the same time?* Mark one thing done and whatever was waiting on it surfaces on its own.

The same principle decides where things sit. Position isn't stored or dragged: the board lays itself out left to right by dependency depth and top to bottom by priority, and re-reads itself after every edit.

There is no clock in here. A dependency graph is a claim about order, not about when — so there are no working hours, no schedule, and no calendar. Just the graph and what it implies.

---

## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Using it](#using-it)
- [The API](#the-api)
- [Architecture](#architecture)
- [Tests](#tests)

## Features

**The graph decides everything**

- **Three derived statuses.** *In progress* — every prerequisite is done, so it is startable now. *To do* — waiting on a prerequisite, or blocked. *Done* — the one part you assert. Nodes and list rows are coloured to match.
- **A board that arranges itself.** Left to right by dependency depth, top to bottom by priority. There is nothing to place and nothing to tidy, and the layout is a pure function of the graph, so the app, the share view and an export all draw the same board.
- **Inherited urgency.** A prerequisite of urgent work is urgent, whatever its own label says. Raise a task to P1 and the whole chain it waits on rises with it, so the path to what matters reads along the top.
- **Movement you can follow.** When the layout changes, tasks swim to their new places over about a second, arrows included, so you can keep your eye on the one you were looking at. Nothing moves under `prefers-reduced-motion`.
- **Cycle-safe.** The editor greys out any dependency that would close a loop, and every graph operation terminates on a cycle rather than hanging.

**Working the board**

- **Flowchart-first.** Double-click the canvas to create a task in place. Drag from a node's ○ port to another node to draw a dependency; click an arrow to remove it. Drag anywhere else to pan.
- **Grow the graph forwards.** An arrow that ends on nothing is a task you haven't named yet: drag a ○ into empty space and it asks for a title, then draws the arrow to what you type. `a` does the same for the selected task, so chains get built without leaving the keyboard.
- **Quick-add syntax.** `Fix login bug !1 #deep-work >deploy *waiting-on-bob` — priority, goal, dependency and blocker in one line. See [the table](#quick-add-syntax).
- **Priorities P1–P3**, one key each, worn on the crocodile's tail. Also sorts the to-do queue, on `s`.
- **Blockers.** A reason you can't start that the graph can't see. A blocked task is held at *to do* however clear its prerequisites are.
- **Goals.** Map tasks to goals with `#goal`; a panel tracks how many of each goal's tasks are done.
- **Keyboard-driven.** `f`/`g` walks the board the way the work runs — on from a task is whatever waits on it, so a chain is followed to its end before the next one starts. Everything else is one key. Press `?`.

**Keeping it clean**

- **Finished work sweeps itself away.** Mark a task done and a five-second countdown appears on it; let it run out and the task is deleted. Re-open it and the countdown stops — that is the undo, and why it is five seconds rather than one. A task with an arrow at either end waits for the rest of the work it is joined to, so a finished chain leaves together instead of stranding arrows that point at nothing. It only sweeps what it watched you finish, never what it found already finished. Toggle with 🧹.
- **Clear finished work.** `clear` on the Done group drops the finished tasks; `u` or ⌘Z puts them back, dependency links included, without disturbing anything else you changed. This is the tool for a backlog the sweep never saw.

**Sharing and leaving**

- **Live share.** Send a read-only link that polls the plan every five seconds. Read-only means it: no done buttons, no ports, no clickable arrows.
- **Export.** One click to PNG or PDF of the canvas in the theme you're in, or JSON for the whole graph as data.
- **A real API.** Read the plan, write it a task at a time, or fetch the lot and hand it back edited. See [The API](#the-api).

**Appearance**

- **A task is a crocodile** — not a card with a crocodile on it. The node *is* the animal, seen from above: its colour is its status, its tail is its priority, its eyes are open while there's work left in it and shut when it's done, and its jaws show teeth on the ones you can start right now. Press `?` for the legend.
- **The board floats on water** (`w`). The canvas is a pool with a still, lit bottom, so a task waiting its turn is a crocodile lying submerged. Every ten seconds or so a ripple crosses it. It's two fields of Perlin noise shaped by SVG filters — no images and no canvas element. The button switches to a plain grid.
- **Light and dark themes** (`m`). Follows your OS preference until you choose, then remembers per device and applies before first paint.

## Getting started

### Docker

```bash
docker compose up -d --build
```

Open <http://localhost:3000>. This runs the app plus Postgres; your plan lives in the `pgdata` named volume, so it survives restarts, rebuilds and `docker compose down` (only `down -v` deletes it). After pulling changes, rebuild with the same command.

The live-share view works for anyone who can reach your machine — give them `http://<your-ip>:3000/share/<token>`.

### Local development

```bash
npm install
npm run dev
```

Without `DATABASE_URL` set the plan is stored in `data/plan.json`, with a localStorage fallback. Same app, file-backed instead of Postgres.

## Using it

A plan usually starts like this:

1. Press `n` and brain-dump. The input stays focused, one task per Enter.
2. Add tokens as you type: `Write report !1 #deep-work`, `Ship it *waiting-on-legal`.
3. Draw the arrows — drag from a node's ○ port onto whatever it has to finish before, or into empty space to name the task that follows it there.
4. Read the leftmost column. That is what you can start, and how much of it you can start at once.
5. Set priorities with `1`–`3`. What matters rises to the top, and whatever it waits on rises with it.
6. Mark things done and watch the next column light up — then watch the finished chain count itself down and leave.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `n` / `c` / `⌘K` | quick-add task |
| `a` | new task depending on the selected one |
| `f` / `g` | focus previous / next task, downstream along the arrows |
| `Shift+J` / `Shift+K` | move task down / up the to-do queue |
| `Enter` / `e` | edit selected task |
| `d` | toggle done |
| `b` | toggle blocked |
| `1`–`3` | set priority — the board re-sorts itself |
| `s` | sort the queue by priority |
| `x` / `Del` | delete |
| `u` / `⌘Z` | undo the last clear |
| `m` | light / dark theme |
| `w` | water / plain canvas |
| `?` | help |

On the canvas: double-click for a new task · drag ○ → node for a dependency · click ○ or drag it into empty space for a new dependent task · click an arrow to remove it · drag anywhere else to pan.

### Quick-add syntax

```
Fix login bug !1 #deep-work >deploy *waiting-on-bob ^
```

| Token | Meaning |
|---|---|
| `!1`…`!3` | priority |
| `#goal` | goal, created if new |
| `>title` | depends on the task whose title starts with… |
| `*reason` | blocked, with a reason |
| `^` | front of the to-do queue |

## The API

Everything the app can do to a plan, over HTTP. `GET /api` lists the endpoints; `GET /api/export` is the whole plan as one JSON document.

One rule shapes all of it: **status is derived and never stored.** You send `done`, `blocked` and `dependsOn`; you read `status`, `depth` and `dependents` back. Writing a status isn't something the API allows, because the graph already answers that question.

Every reply is `{"ok": true, …}` or `{"ok": false, "error": …, "details": [...]}`, where `details` lists *everything* wrong with the request rather than the first thing. A rejected write changes nothing.

### Export

```bash
curl localhost:3000/api/export                # goals, tasks, dependencies, derived state, totals
curl -OJ localhost:3000/api/export?download=1 # as a file
curl localhost:3000/api/export?format=plan    # the stored document, nothing derived
```

The document carries the graph twice over — `dependsOn`/`dependents` on each task, and a flat `dependencies` edge list beside them — so you can read it whichever way suits. The `JSON` button in the app downloads the same document.

### Tasks

| Endpoint | |
|---|---|
| `GET /api/tasks` | every task with its derived state, plus goals, edges and totals |
| `POST /api/tasks` | create — one task, `{"tasks": [...]}`, or `{"quickAdd": ["Write report !1 #deep-work"]}` |
| `PATCH /api/tasks` | update many: `{"tasks": [{"id": "a1b2", "done": true}]}` |
| `PUT /api/tasks` | replace the whole list |
| `DELETE /api/tasks` | `?ids=a,b` or `?done=true` |
| `GET·PATCH·PUT·DELETE /api/tasks/{id}` | one task (`PUT` also clears what you leave out) |
| `GET·POST·PUT·DELETE /api/tasks/{id}/dependencies` | the edges into and out of one task |

Filters on `GET`, all optional and all ANDed: `?status=in-progress,todo` · `?goal=deep-work` (or `?goal=none`) · `?q=text` · `?done=` · `?blocked=` · `?dependsOn={id}` · `?blocking={id}`. They narrow `tasks`; the goals, edges and totals always describe the whole plan.

```bash
# what can I start right now?
curl 'localhost:3000/api/tasks?status=in-progress' | jq '.tasks[].title'

# add a task that waits for another
curl -X POST localhost:3000/api/tasks -H 'content-type: application/json' \
  -d '{"title": "Ship it", "priority": 1, "goal": "release", "dependsOn": ["a1b2"]}'

# finish something — its dependents become in-progress on their own
curl -X PATCH localhost:3000/api/tasks/a1b2 -H 'content-type: application/json' -d '{"done": true}'
```

A task may name its goal in words (`"goal": "release"`), and it is created if new, exactly as `#release` does in quick-add.

### Batch and round trip

`POST /api/batch` is the whole-plan door, and it is all-or-nothing: the edit is assembled and checked before anything is stored, so if any part is refused, none of it happened.

```jsonc
{
  "goals":    { "create": [...], "update": [...], "delete": ["id"] },
  "create":   [{ "title": "Retro", "dependsOn": ["c3d4"] }],
  "quickAdd": ["Write report !1 #deep-work"],
  "update":   [{ "id": "a1b2", "done": true }],
  "delete":   ["e5f6"]
}
```

Because only the finished plan is judged, a batch may pass through states the graph would refuse on their own — adding an edge and cutting it again, or deleting a prerequisite along with the task that needed it.

The round trip is the other form: fetch everything, edit the array, hand it back.

```bash
curl -s localhost:3000/api/tasks | jq '{tasks}' > plan.json
$EDITOR plan.json
curl -X PUT localhost:3000/api/tasks -H 'content-type: application/json' -d @plan.json
```

`PUT /api/tasks` (or `POST /api/batch` with a `tasks` key) treats the list as complete: ids it knows are updated, ids it doesn't are created, and **anything missing is deleted**. Derived fields are ignored on the way in, as are fields older versions of the app used to write, so a document exported by an earlier build still round-trips.

### Goals and import

`GET·POST·PATCH·DELETE /api/goals` and `GET·PATCH·DELETE /api/goals/{id}`. Each goal reports how many tasks are mapped to it and how many of those are done. Deleting a goal unassigns its tasks — it never deletes work.

`POST /api/import` takes a document back: an export of this app's, or anything with the same `tasks` and `goals` shape. `?mode=merge` upserts by id instead of replacing, and a replace keeps the existing share token so links you've already sent still work.

### Two things to know

**It is unauthenticated**, exactly as open as the app it edits. Fine on a laptop; worth thinking about before exposing the port.

**An open tab will overwrite you.** The browser holds the plan and autosaves all of it, so a change made through the API while a tab is open is lost the next time anything in that tab changes. Reload the tab after driving the API, or drive it with no tab open. Concurrent API calls are safe — writes queue.

## Architecture

Next.js (App Router) · TypeScript · Tailwind CSS · Zustand + Immer · html-to-image + jsPDF. Persistence is a single JSON document behind an API route, in Postgres when `DATABASE_URL` is set and on disk when it isn't.

**The derived core is pure and lives in three files.** `lib/graph.ts` turns tasks and dependencies into statuses, inherited urgency, depths and the runs of finished work the sweep is allowed to take. `lib/flow.ts` turns those into canvas positions and the order the keyboard walks them in. `lib/parse.ts` is the quick-add grammar. None of them touch React, the network or the clock, which is why the same functions answer for the app, the share view and the API.

**Nothing about where a task sits is stored.** The plan document has no coordinates in it. `lib/flow-motion.ts` is the one piece that isn't pure: given a new set of positions it hands back the ones in between, a frame at a time for a second. It tweens in React rather than in CSS because an SVG path can't transition and the arrows have to arrive with the nodes — so every frame is a render, and the edges are drawn from the same in-between positions.

**The API is three modules and a thin layer of routes.** `lib/plan-ops.ts` is every write as a function from one plan to the next, and everything it refuses. `lib/plan-doc.ts` is the derived view handed out — shared with the browser's JSON button, so the download and the endpoint are byte-for-byte the same document. `lib/plan-store.ts` is the read-modify-write, queued so concurrent calls can't overwrite each other.

**One palette, one file.** `app/globals.css` holds both themes as a single set of variables, with the Tailwind ramp re-pointed onto one green hue. A status publishes two colours and no more; the row in the sidebar and the crocodile on the canvas each decide what to do with them. The water lives there too, as `.croc-surface`, with `components/WaterSurface.tsx` dropping the occasional ripple into it.

**How big the app is, is one line.** `html { font-size }` in that same file. Every length is in rem — the four named type sizes, the spacing, the panel widths — so one percentage scales type, padding and panels together. A task node is the one thing sized in pixels (`FLOW` in `lib/types.ts`), and the crocodile is a viewBox stretched to fit it.

**The drawings.** `components/CrocShape.tsx` is a task: one outline, one leg drawn once and mirrored into four corners, and a torso that is the card. It takes its fill and outline by inheritance rather than by CSS rule, because html-to-image deep-clones an `<svg>` without inlining styles onto its children — a rule that renders on screen would export as a black silhouette. The mark is drawn three more times for the places a task node can't go: `components/Logo.tsx` in the app, `app/icon.svg` in the tab, and `public/logo.svg` for the lockup above.

## Tests

```bash
npm test          # unit + component (Vitest, jsdom)
npm run test:e2e  # end-to-end (Playwright, Chromium) — starts its own dev server
npm run test:all  # both
```

Two layers, split by what each can actually prove:

- **`tests/`** — the derived core in isolation: statuses from a graph, urgency travelling back down a chain, the layout and navigation order those produce, the quick-add grammar, every store action, the sweep's timing, and every API route against a temp directory and a stubbed Postgres — what they refuse as much as what they accept, and that a rejected write leaves the stored plan alone.
- **`e2e/`** — the app in a real browser: quick-add through to a coloured node, the frontier advancing as work is finished, the board re-sorting itself when a priority changes and taking a second over it, finished work counting itself down and going, dependency drawing, panning, keyboard-only operation, theming applied before first paint, the JSON download, and the share link's read-only guarantee.

The end-to-end suite stubs `/api/plan` in the browser at context scope, so **no run ever reads or writes your real `data/plan.json`** — the route itself is covered by unit tests instead.
