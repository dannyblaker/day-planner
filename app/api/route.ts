/**
 * What is here, for whoever finds the port and wonders.
 *
 * Kept as data rather than prose so it can't drift far from the routes without
 * someone noticing; the detail lives in each route file and in the README.
 */

export const dynamic = "force-dynamic";

const ENDPOINTS = [
  { method: "GET", path: "/api/export", note: "the whole plan as JSON — ?download=1, ?pretty=0, ?format=plan" },
  { method: "POST", path: "/api/import", note: "take a document back in — ?mode=replace|merge" },
  { method: "GET", path: "/api/tasks", note: "list tasks with derived status — ?status= ?goal= ?q= ?done= ?blocked= ?parallel= ?dependsOn= ?blocking=" },
  { method: "POST", path: "/api/tasks", note: "create a task, { tasks: [...] }, or { quickAdd: ['Write report 45m !1'] }" },
  { method: "PATCH", path: "/api/tasks", note: "update many: { tasks: [{ id, ...patch }] }" },
  { method: "PUT", path: "/api/tasks", note: "replace the whole list — anything left out is deleted" },
  { method: "DELETE", path: "/api/tasks", note: "?ids=a,b or ?done=true" },
  { method: "GET|PATCH|PUT|DELETE", path: "/api/tasks/{id}", note: "one task" },
  { method: "GET|POST|PUT|DELETE", path: "/api/tasks/{id}/dependencies", note: "the edges into and out of one task" },
  { method: "GET|POST|PATCH|DELETE", path: "/api/goals", note: "goals, with work planned and done against each" },
  { method: "GET|PATCH|DELETE", path: "/api/goals/{id}", note: "one goal" },
  { method: "POST", path: "/api/batch", note: "goals + create/quickAdd/update/delete, or a whole { tasks: [...] } list, all or nothing" },
  { method: "GET|PUT", path: "/api/plan", note: "the stored document, unvalidated — the app's own autosave channel" },
];

export async function GET() {
  return Response.json({
    ok: true,
    app: "ConcurrencyFlow",
    note: "Status is derived from the dependency graph and is never stored: send `done`, `blocked` and `dependsOn`, and read `status` back.",
    endpoints: ENDPOINTS,
  });
}
