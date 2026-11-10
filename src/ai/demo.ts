import type { Task } from "@/domain/schemas/task";
import { buildSchedulingPlans } from "@/domain/scheduling";
import type { ReplanPlan } from "@/domain/reflow";
import { msFromDayKey } from "@/domain/time";
import { TERM_START_DAY_KEY } from "@/shared/constants";
export { parseLocalTasks as demoParseTasks } from "@/domain/textParser";

export function demoReplanPlans(tasks: readonly Task[], dayKey: string, actualNow?: Date, termStartDayKey: string | null = TERM_START_DAY_KEY): ReplanPlan[] {
  return buildSchedulingPlans(tasks, { dayKey, now: (actualNow ?? new Date(msFromDayKey(dayKey, 9 * 60))).toISOString(), termStartDayKey });
}
