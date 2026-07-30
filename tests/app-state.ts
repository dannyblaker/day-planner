import { useApp } from "@/lib/store";
import { todayISO } from "@/lib/time";
import { DayPlan, Plan } from "@/lib/types";
import { makeDay, makePlan } from "./factory";

/** The store is a module singleton, so tests have to put it back as they found it. */
const pristine = useApp.getState();

export const app = () => useApp.getState();

/** The store seeded itself from the real clock at import time, before the suite
 *  faked it — re-date the seed onto the day the suite pinned, so `date`, the
 *  seeded day and the fixtures all agree. */
function pristinePlan(date: string): Plan {
  const [seeded] = Object.values(pristine.plan.days);
  return { ...pristine.plan, days: { [date]: { ...seeded, date } } };
}

export function resetStore() {
  const date = todayISO();
  useApp.setState({ ...pristine, date, plan: pristinePlan(date) }, true);
}

/** Reset, then load a known plan and sit on its date. */
export function seedStore(day: DayPlan = makeDay()) {
  resetStore();
  app().load(makePlan([day]));
  app().setDate(day.date);
  return day;
}
