<img src="public/logo.svg" alt="Concurrent Crocodiles" width="234" height="82">

A flowchart for planning work that runs alongside other work: **tasks are nodes, dependencies are arrows, and status follows the graph.**

The crocodiles are the tasks. Most of them lie there submerged, waiting on something upstream; the ones with nothing left to wait for surface all at once, and those are the ones that can bite.

The core idea is that status is *derived state*. You don't set a task to "in progress" — you draw the dependencies, and everything whose prerequisites are finished is in progress, all of it at once. That set is the answer to the only question the board exists to answer: what can I run in parallel right now? Mark one thing done and its dependents move up on their own. There is no save button; every change autosaves.

There is no clock in here. A dependency graph is a claim about order, not about when, so there are no working hours, no schedule, and no calendar — just the graph and what it implies.

## Features

- **Flowchart-first** — the canvas is the app. Double-click to create a task in place (quick-add syntax works), drag from a node's ○ port to another node to draw a dependency, click an arrow to remove it. Auto-arrange lays the graph out by dependency depth.
- **Grow the graph forwards** — an arrow that ends on nothing is a task you haven't named yet, so drag a ○ into empty space and it asks for the title, then draws the arrow to what you type. Clicking the ○ does the same beside the node, and `a` does it for whatever is selected — chains get built without leaving the keyboard.
- **Three statuses, derived** — *In progress* (every prerequisite done — startable now), *To do* (waiting on a prerequisite, or blocked), *Done* (the one part you set). Nodes and list rows are coloured by status: murky green waiting, gold startable, green finished.
- **Cards with teeth** — every card is printed on crocodile hide and ridged with scutes along the top in the colour of its status, and the ones you can start right now are the ones that grow a row of teeth. The gold column is the answer to the question the board exists to answer, so it is the one that bites.
- **Concurrent work** — mark a task `~` (or press `p`) and it runs alongside your focus work (CI runs, laundry, waiting on someone). It stays on the one canvas, drawn with a dashed border and a ∥ mark — position is yours to arrange, not a lane to fall into.
- **Blockers** — mark a task blocked with a reason and it is held at *to do* however clear its prerequisites are: a blocker is a reason you can't start that the graph can't see.
- **Cycle-safe** — the editor greys out any dependency that would close a loop, and the layout terminates on a cycle rather than hanging.
- **Prioritisation** — P1–P4 with one-key assignment, shown as the node's left stripe, plus one-key auto-sort of the to-do queue by priority.
- **Goals** — map tasks to goals (`#goal`); a panel shows work done against work planned per goal.
- **Live share** — send someone a read-only link (`Share live`) that polls the plan every 5 seconds. Read-only means it: no done buttons, no ports, no clickable arrows.
- **Export** — one click to PNG or PDF of the canvas, matching the theme you're in, or `JSON` for the whole graph as data: every task, every dependency, and the derived status.
- **A real API** — read the plan, write it a task at a time, or fetch the lot and hand it back edited. Dependencies are checked on the way in, so nothing you can send closes a loop. See [The API](#the-api).
- **Light / dark theme** (`m`, or the ☀️/🌙 button) — swamp water at night or a bright riverbank; follows your OS preference until you pick one, and the choice is per-device and applied before first paint, so there's no flash on reload.
- **Clear finished work** — `clear` on the Done group drops the finished tasks; an undo bar (or `u` / `⌘Z`) puts them back, dependency links included, without disturbing anything you changed in the meantime.
- **Keyboard-driven** — `j`/`k` walks the board in status order, and everything else is one key. Press `?`.

## Getting started

### Docker (recommended for daily use)

```bash
docker compose up -d --build
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

- **`tests/`** — the derived-state core in isolation: how the graph turns dependencies into statuses, the depth layout, the quick-add grammar, every store action, the theme boot script, the debounced autosave, and every API route against a temp directory and a stubbed Postgres — what they refuse as much as what they accept, and that a rejected write leaves the stored plan alone.
- **`e2e/`** — the app in a real browser: quick-add through to a coloured node, marking work done and watching the frontier advance, clear/undo, flowchart drag and dependency drawing, keyboard-only operation, theming (including that the choice is applied *before first paint*), the JSON download, and the share link's read-only guarantee.

The end-to-end suite stubs `/api/plan` in the browser at context scope, so **no run ever reads or writes your real `data/plan.json`** — the route itself is covered by unit tests instead.

## The planning flow

1. Press `n` and brain-dump tasks — the input stays focused, one task per Enter.
2. Add tokens as you type: `Write report 45m !1 #deep-work`, `CI run 45m ~`.
3. Draw the arrows: drag from one node's ○ port onto whatever it has to finish before — or into empty space, and name the task that follows it there.
4. Press `✨ Auto-arrange`. The leftmost column goes amber — that is what you can start, and how much of it you can start at once.
5. Finish something, mark it done, and watch the next column light up.

## The API

Everything the app can do to a plan, over HTTP. `GET /api` lists the endpoints; `GET /api/export` is the whole thing as one JSON document.

The rule that shapes all of it: **status is derived and never stored.** You send `done`, `blocked` and `dependsOn`; you read `status`, `depth` and `dependents` back. Writing a status is not something the API lets you do, because the graph already answers that question.

Every reply is `{"ok": true, …}` or `{"ok": false, "error": …, "details": [...]}`, and `details` lists *everything* wrong with a request, not just the first thing. A rejected write changes nothing.

### Export

```bash
curl localhost:3000/api/export                # goals, tasks, dependencies, derived state, totals
curl -OJ localhost:3000/api/export?download=1 # as a file
curl localhost:3000/api/export?format=plan    # just the stored document, nothing derived
```

The document carries each task twice over: `dependsOn`/`dependents` on the task, and a flat `dependencies` edge list beside it, so you can read the graph however suits you. The `JSON` button in the top bar downloads the same document, built from what is on screen.

### Tasks

| | |
|---|---|
| `GET /api/tasks` | every task with its derived state, plus the goals, the edge list and the totals |
| `POST /api/tasks` | create — one task, `{"tasks": [...]}`, or `{"quickAdd": ["Write report 45m !1 #deep-work"]}` |
| `PATCH /api/tasks` | update many: `{"tasks": [{"id": "a1b2", "done": true}]}` |
| `PUT /api/tasks` | replace the whole list |
| `DELETE /api/tasks` | `?ids=a,b` or `?done=true` |
| `GET·PATCH·PUT·DELETE /api/tasks/{id}` | one task (`PUT` also clears what you leave out) |
| `GET·POST·PUT·DELETE /api/tasks/{id}/dependencies` | the edges into and out of one task |

Filters on `GET`, all optional and all ANDed: `?status=in-progress,todo` · `?goal=deep-work` (or `?goal=none`) · `?q=text` · `?done=` · `?blocked=` · `?parallel=` · `?dependsOn={id}` · `?blocking={id}`. They narrow `tasks`; the goals, edges and totals always describe the whole plan.

```bash
# what can I start right now?
curl 'localhost:3000/api/tasks?status=in-progress' | jq '.tasks[].title'

# add a task that waits for another
curl -X POST localhost:3000/api/tasks -H 'content-type: application/json' \
  -d '{"title": "Ship it", "duration": 20, "priority": 1, "goal": "release", "dependsOn": ["a1b2"]}'

# finish something — its dependents become in-progress on their own
curl -X PATCH localhost:3000/api/tasks/a1b2 -H 'content-type: application/json' -d '{"done": true}'
```

A task may name its goal by name (`"goal": "release"`) and it is created if new, exactly as `#release` does in quick-add.

### Batch

`POST /api/batch` is the whole-plan door, and it is all-or-nothing: the edit is assembled and checked before anything is stored, so if any part of it is refused, none of it happened.

```jsonc
{
  "goals":    { "create": [...], "update": [...], "delete": ["id"] },
  "create":   [{ "title": "Retro", "dependsOn": ["c3d4"] }],
  "quickAdd": ["Write report 45m !1 #deep-work"],
  "update":   [{ "id": "a1b2", "done": true }],
  "delete":   ["e5f6"]
}
```

Because only the finished plan is judged, a batch may pass through arrangements the graph would refuse on their own — adding an edge and cutting it again, or deleting a prerequisite along with the task that needed it.

The **round trip** is the other form: fetch everything, edit the array, hand it back.

```bash
curl -s localhost:3000/api/tasks | jq '{tasks}' > plan.json
$EDITOR plan.json
curl -X PUT localhost:3000/api/tasks -H 'content-type: application/json' -d @plan.json
```

`PUT /api/tasks` (or `POST /api/batch` with a `tasks` key) treats the list as complete: ids it knows are updated, ids it doesn't are created, and **anything missing is deleted**. Derived fields are ignored on the way in, so what `GET` handed you goes straight back.

### Goals, import

`GET·POST·PATCH·DELETE /api/goals` and `GET·PATCH·DELETE /api/goals/{id}`; each goal reports the work planned and done against it. Deleting a goal unassigns its tasks — it never deletes work.

`POST /api/import` takes a document back — an export of this app's, or anything with the same `tasks` and `goals` shape. `?mode=merge` upserts by id instead of replacing, and a replace keeps the existing share token so links you've sent still work.

### Two things to know

**It is unauthenticated**, exactly as open as the app it edits. That is fine on a laptop and worth thinking about before you expose the port.

**An open tab will overwrite you.** The browser autosaves its whole plan, so a change made through the API while a tab is open is lost the next time anything in that tab changes. Reload the tab after driving the API, or drive it with no tab open. (Concurrent API calls are safe: writes queue.)

## Keyboard shortcuts

| Key | Action |
|---|---|
| `n` / `c` / `⌘K` | quick-add task |
| `a` | new task depending on the selected one |
| `j` / `k` | select next / previous (in status order) |
| `Shift+J` / `Shift+K` | move task down / up the to-do queue |
| `Enter` / `e` | edit selected |
| `d` | toggle done — dependents become in-progress |
| `b` | toggle blocked |
| `1`–`4` | set priority |
| `p` | toggle concurrent / background |
| `+` / `-` | duration ±15m |
| `s` | auto-sort by priority |
| `x` / `Del` | delete |
| `u` / `⌘Z` | undo the last clear |
| `m` | toggle light / dark theme |
| `?` | help |
| canvas | dbl-click: new task · drag ○→node: dependency · click ○ or drag it to empty space: new dependent task · click arrow: remove |

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

The API is three pure modules and a thin layer of routes: `lib/plan-ops.ts` is every write as a function from one plan to the next (and everything it refuses), `lib/plan-doc.ts` is the derived view the API hands out — shared with the browser's JSON button, so the download and the endpoint are the same document — and `lib/plan-store.ts` is the read-modify-write, queued so concurrent calls can't overwrite each other.

The whole look is one file: `app/globals.css` holds both themes as one set of variables (the Tailwind ramp is re-pointed onto a single green hue, so every surface in the app is swamp water) plus the hide, the scutes and the teeth as CSS masks — no images, and nothing a component has to know about. The crocodile itself is drawn three times over: `components/Logo.tsx` for the app, `app/icon.svg` for the tab, and `public/logo.svg` for the lockup at the top of this file.
