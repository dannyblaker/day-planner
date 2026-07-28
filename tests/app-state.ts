import { useApp } from "@/lib/store";
import { DayPlan } from "@/lib/types";
import { makeDay, makePlan } from "./factory";

/** The store is a module singleton, so tests have to put it back as they found it. */
const pristine = useApp.getState();

export const app = () => useApp.getState();

export function resetStore() {
  useApp.setState(pristine, true);
}

/** Reset, then load a known plan and sit on its date. */
export function seedStore(day: DayPlan = makeDay()) {
  resetStore();
  app().load(makePlan([day]));
  app().setDate(day.date);
  return day;
}
