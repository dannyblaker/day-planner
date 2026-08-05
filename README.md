<img src="public/logo.svg" alt="Concurrent Crocodiles" width="234" height="82">

A flowchart for planning work that runs alongside other work: **tasks are nodes, dependencies are arrows, and status follows the graph.**

The crocodiles are the tasks. Most of them lie there submerged, waiting on something upstream; the ones with nothing left to wait for surface all at once, and those are the ones that can bite.

The core idea is that status is *derived state*. You don't set a task to "in progress" — you draw the dependencies, and everything whose prerequisites are finished is in progress, all of it at once. That set is the answer to the only question the board exists to answer: what can I run in parallel right now? Mark one thing done and its dependents move up on their own. There is no save button; every change autosaves.

There is no clock in here. A dependency graph is a claim about order, not about when, so there are no working hours, no schedule, and no calendar — just the graph and what it implies.

## Features

- **Flowchart-first** — the canvas is the app. Double-click to create a task in place (quick-add syntax works), drag from a node's ○ port to another node to draw a dependency, click an arrow to remove it. Drag anywhere else — the water or a crocodile — to move the view.
- **The board arranges itself** — there is nothing to place and nothing to tidy. Position is derived, like status: left to right by dependency depth, top to bottom by priority, and every edit re-reads it. A crocodile that has somewhere new to be swims there over about a second, arrows and all, so you can follow the one you were looking at instead of re-finding it on a board that changed while you blinked. Nothing moves at all under `prefers-reduced-motion`.
- **Urgency is inherited** — a P1 five prerequisites deep drags the whole chain up with it, because a prerequisite of urgent work is urgent whatever its own label says. Raise a task's priority and you watch the work it is waiting on rise with it.
- **Grow the graph forwards** — an arrow that ends on nothing is a task you haven't named yet, so drag a ○ into empty space and it asks for the title, then draws the arrow to what you type. Clicking the ○ does the same beside the node, and `a` does it for whatever is selected — chains get built without leaving the keyboard.
- **Three statuses, derived** — *In progress* (every prerequisite done — startable now), *To do* (waiting on a prerequisite, or blocked), *Done* (the one part you set). Nodes and list rows are coloured by status: murky green waiting, gold startable, green finished.
- **A task is a crocodile** — not a card with a crocodile on it: the node *is* the animal, seen from above and built out of right angles, and every part of it says something. Its colour is its status, its tail is its priority, its eyes are open while there is anything left in it and shut when it's done, and its jaws show teeth on the ones you can start right now. Its back is the card, and it is card-sized: as many tasks on screen as the plain rectangles it replaced. Press `?` for the legend.
- **Blockers** — mark a task blocked with a reason and it is held at *to do* however clear its prerequisites are: a blocker is a reason you can't start that the graph can't see.
- **Cycle-safe** — the editor greys out any dependency that would close a loop, and the layout terminates on a cycle rather than hanging.
- **Prioritisation** — P1, P2, P3, one key each, worn on the crocodile's tail. There were four levels once; P4 was where work went to be forgotten politely, and on a board that sorts itself by priority a level meaning "never" is just a longer canvas. Priority also sorts the to-do queue, on `s`.
- **Goals** — map tasks to goals (`#goal`); a panel shows how many of each goal's tasks are done against how many are mapped to it.
- **Live share** — send someone a read-only link (`Share live`) that polls the plan every 5 seconds. Read-only means it: no done buttons, no ports, no clickable arrows.
- **Export** — one click to PNG or PDF of the canvas, matching the theme you're in, or `JSON` for the whole graph as data: every task, every dependency, and the derived status.
- **A real API** — read the plan, write it a task at a time, or fetch the lot and hand it back edited. Dependencies are checked on the way in, so nothing you can send closes a loop. See [The API](#the-api).
- **The board floats on water** (`w`, or the 🌊 button) — the canvas is a pool: a still, lit bottom with caustics on it, so a task waiting its turn is a crocodile lying submerged and the ones you can start are the ones at the surface. Still, and then every ten seconds or so a ripple crosses it and is gone. It is two fields of Perlin noise shaped by SVG filters — no images, no canvas element, and nothing animating in between. Prefer a quiet grid? The button switches to one, and the choice is remembered per device.
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

- **`tests/`** — the derived-state core in isolation: how the graph turns dependencies into statuses, how urgency travels back down a chain, the layout those two produce, the quick-add grammar, every store action, the theme boot script, the debounced autosave, and every API route against a temp directory and a stubbed Postgres — what they refuse as much as what they accept, and that a rejected write leaves the stored plan alone.
- **`e2e/`** — the app in a real browser: quick-add through to a coloured node, marking work done and watching the frontier advance, clear/undo, dependency drawing, the board re-sorting itself when a priority changes (and taking a second over it), panning, keyboard-only operation, theming (including that the choice is applied *before first paint*), the JSON download, and the share link's read-only guarantee.

The end-to-end suite stubs `/api/plan` in the browser at context scope, so **no run ever reads or writes your real `data/plan.json`** — the route itself is covered by unit tests instead.

## The planning flow

1. Press `n` and brain-dump tasks — the input stays focused, one task per Enter.
2. Add tokens as you type: `Write report !1 #deep-work`, `Ship it *waiting-on-legal`.
3. Draw the arrows: drag from one node's ○ port onto whatever it has to finish before — or into empty space, and name the task that follows it there.
4. Watch it lay itself out. The leftmost column goes amber — that is what you can start, and how much of it you can start at once.
5. Set priorities with `1`–`3`. What matters rises to the top of the board, and whatever it is waiting on rises with it.
6. Finish something, mark it done, and watch the next column light up.

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

A task may name its goal by name (`"goal": "release"`) and it is created if new, exactly as `#release` does in quick-add.

### Batch

`POST /api/batch` is the whole-plan door, and it is all-or-nothing: the edit is assembled and checked before anything is stored, so if any part of it is refused, none of it happened.

```jsonc
{
  "goals":    { "create": [...], "update": [...], "delete": ["id"] },
  "create":   [{ "title": "Retro", "dependsOn": ["c3d4"] }],
  "quickAdd": ["Write report !1 #deep-work"],
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

`PUT /api/tasks` (or `POST /api/batch` with a `tasks` key) treats the list as complete: ids it knows are updated, ids it doesn't are created, and **anything missing is deleted**. Derived fields are ignored on the way in, so what `GET` handed you goes straight back — and so are fields the plan has since retired (`duration`, `parallel`, and the `flowX`/`flowY` from when the board had to be arranged by hand), so a document exported by an older build still round-trips. A `priority` of 4 is likewise taken and stored as a 3, since P4 was a level this app itself used to write.

### Goals, import

`GET·POST·PATCH·DELETE /api/goals` and `GET·PATCH·DELETE /api/goals/{id}`; each goal reports how many tasks are mapped to it and how many of those are done. Deleting a goal unassigns its tasks — it never deletes work.

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
| `1`–`3` | set priority — the board re-sorts itself |
| `s` | auto-sort by priority |
| `x` / `Del` | delete |
| `u` / `⌘Z` | undo the last clear |
| `m` | toggle light / dark theme |
| `w` | toggle the animated water canvas |
| `?` | help |
| canvas | dbl-click: new task · drag ○→node: dependency · click ○ or drag it to empty space: new dependent task · click arrow: remove · drag anywhere else: pan |

## Quick-add syntax

```
Fix login bug !1 #deep-work >deploy ~ *waiting-on-bob ^
```

| Token | Meaning |
|---|---|
| `!1`…`!3` | priority |
| `#goal` | goal (created if new) |
| `>title` | depends on task whose title starts with… |
| `*reason` | blocked |
| `^` | front of the to-do queue |

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Zustand + Immer · html-to-image + jsPDF. Plan persistence is a single JSON document behind an API route; `lib/graph.ts` is a pure function from tasks + dependencies → statuses and inherited urgency, and `lib/flow.ts` from those → canvas positions. Nothing about where a task sits is stored: the plan document has no coordinates in it, and the same graph draws the same board in the app, in the share view and in an export.

**Moving is the only part that isn't pure.** `lib/flow-motion.ts` is a hook between the layout and the canvas: given a new set of positions it hands back the ones in between, a frame at a time for a second. It tweens in React rather than in CSS because an SVG path can't transition, and the arrows have to arrive with the nodes — so every frame is a render, and the edges are drawn from the same in-between positions. New positions are taken up during the render that brings them rather than in the effect after it; do it in the effect and the first frame paints the destination, which is a jump cut with a slide after it.

The API is three pure modules and a thin layer of routes: `lib/plan-ops.ts` is every write as a function from one plan to the next (and everything it refuses), `lib/plan-doc.ts` is the derived view the API hands out — shared with the browser's JSON button, so the download and the endpoint are the same document — and `lib/plan-store.ts` is the read-modify-write, queued so concurrent calls can't overwrite each other.

The whole palette is one file: `app/globals.css` holds both themes as one set of variables, with the Tailwind ramp re-pointed onto a single green hue so every surface in the app is swamp water. A status publishes two colours and no more; the rectangle in the sidebar and the crocodile on the canvas each decide what to do with them.

**The water is in there too.** `.croc-surface` in the same file is the pool, with the depth and the blending set per theme like everything else; `components/WaterSurface.tsx` drops the occasional ripple into it. Three things about it were learned the hard way and are worth not re-learning: `feDiffuseLighting` cannot tile (a normal needs neighbours the tile hasn't got, so every seam shows), `stitchTiles` stitches over the *filter region* rather than the tile unless you pin the region to it, and a blended layer the size of the whole board costs enough to notice — the surface is sticky and sized to the scroll port. The caustics used to drift, which looked lovely for a minute and was tiring after that; a still pool with a rationed ripple costs nothing between ripples and is easier to work over. No ripples at all for `prefers-reduced-motion`.

**How big the app is, is one line.** `html { font-size }` in that same file sets it: every length in the app is in rem — the four named type sizes (`note` / `label` / `body` / `title`), Tailwind's spacing, the panel widths — so one percentage scales type, padding and panels together. Nudge it if the app is too small or too large for your screen. A task node is the one thing sized in pixels (`FLOW` in `lib/types.ts`, because the layout works in them), and the crocodile is a viewBox stretched to fit whatever that says.

`components/CrocShape.tsx` is the animal: one outline, one leg drawn once and mirrored into four corners, and a torso that is the card. It is blocky for a reason that is entirely about density — curves need length to read, so the same crocodile drawn organically wanted 350×116 and put less than half as many tasks on screen, while a stepped tail says "tapering" in three rectangles at 240×82. It takes its fill and outline from the status by inheritance rather than by rule, which is also not a stylistic choice: html-to-image deep-clones an `<svg>` without inlining styles onto its children, so a CSS rule for a path renders on screen and exports as a black silhouette.

The crocodile is drawn three more times, by hand, for the places a task node can't go: `components/Logo.tsx` in the app, `app/icon.svg` in the tab, and `public/logo.svg` for the lockup at the top of this file.
