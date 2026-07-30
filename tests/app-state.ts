import { useApp } from "@/lib/store";
import { Task } from "@/lib/types";
import { makePlan } from "./factory";

/** The store is a module singleton, so tests have to put it back as they found it. */
const pristine = useApp.getState();

export const app = () => useApp.getState();

export function resetStore() {
  useApp.setState({ ...pristine }, true);
}

/** Reset, then load a known plan. */
export function seedStore(tasks: Task[] = []) {
  resetStore();
  app().load(makePlan(tasks));
  return tasks;
}
