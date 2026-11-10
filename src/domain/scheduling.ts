import { DEFAULT_DETECT_CONFIG, detectConflicts, parseDeadlineMs } from "./conflicts";
import { guardPlan, type PlanContext } from "./planGuard";
import { applyPlan, type ReplanPlan } from "./reflow";
import type { Task } from "./schemas/task";
import { addDaysToKey, dayKeyOf, expandOccurrences, msFromDayKey, MS_MINUTE } from "./time";
import { needsPreparation } from "./preparation";

/** Bounded deterministic scheduling: 7 days, <= 30 jobs, 15-minute slots. */
export function buildSchedulingPlans(tasks: readonly Task[], context: PlanContext): ReplanPlan[] {
  if (tasks.length > 300) return [];
  const now = new Date(context.now ?? new Date(msFromDayKey(context.dayKey, 0)).toISOString());
  const config = { ...DEFAULT_DETECT_CONFIG, termStartDayKey: context.termStartDayKey ?? null, repeatWindowStartDayKey: context.dayKey };
  const conflicts = detectConflicts(tasks, config, now);
  const troubled = new Set(conflicts.filter(c => c.date === context.dayKey).flatMap(c => c.involvedTaskIds));
  const eligible = tasks.filter(task => !task.done && !task.locked && !task.repeat &&
    ((task.start && dayKeyOf(Date.parse(task.start)) === context.dayKey && troubled.has(task.id) && task.durationMin > 0) || needsPreparation(task, context.dayKey)));
  if (eligible.length > 30) return [];
  const plans: ReplanPlan[] = [];
  for (const objective of ["少改动", "优先截止"] as const) {
    const jobs = [...eligible].sort((a, b) => objective === "优先截止"
      ? (Date.parse(a.deadline ?? "9999-12-31") - Date.parse(b.deadline ?? "9999-12-31") || a.priority - b.priority || a.id.localeCompare(b.id))
      : (Number(!a.start) - Number(!b.start) || a.id.localeCompare(b.id)));
    const pending = new Set(jobs.map(t => t.id));
    let working = tasks.filter(t => !pending.has(t.id));
    const blocks: ReplanPlan["blocks"] = [];
    for (const task of jobs) {
      const duration = task.start ? task.durationMin : task.estateMin ?? task.durationMin;
      const slots: Array<{ start: number; end: number }> = [];
      for (let offset = 0; offset < 7; offset++) {
        const day = addDaysToKey(context.dayKey, offset);
        const occupied = working.flatMap(t => expandOccurrences(t, new Date(msFromDayKey(day, 0)), new Date(msFromDayKey(addDaysToKey(day, 1), 0)), context.termStartDayKey));
        for (let minute = 420; minute + duration <= 1380; minute += 15) {
          const start = msFromDayKey(day, minute), end = start + duration * MS_MINUTE;
          if (start < now.getTime() || (task.deadline && end > parseDeadlineMs(task.deadline)!)) continue;
          // Conservative travel gap; the shared guard makes the final decision.
          if (occupied.some(o => start < Date.parse(o.end) + 30 * MS_MINUTE && end + 30 * MS_MINUTE > Date.parse(o.start))) continue;
          slots.push({ start, end });
        }
      }
      if (objective === "少改动" && task.start) slots.sort((a, b) => Math.abs(a.start - Date.parse(task.start!)) - Math.abs(b.start - Date.parse(task.start!)) || a.start - b.start);
      let placed = false;
      for (const slot of slots) {
        const block = { taskId: task.id, start: new Date(slot.start).toISOString(), end: new Date(slot.end).toISOString() };
        const after = applyPlan([...working, task], { id: "slot", title: "slot", rationale: "slot", blocks: [block] });
        const candidateIssues = detectConflicts(after, { ...config, repeatWindowStartDayKey: dayKeyOf(slot.start) }, now);
        if (candidateIssues.some(c => c.conflictType !== "deadline" && c.involvedTaskIds.includes(task.id))) continue;
        blocks.push(block); working = after; placed = true; break;
      }
      // A failed job stays as a constraint. Never drop it to manufacture free time.
      if (!placed) working = [...working, task];
    }
    const changed = blocks.filter(b => { const t = tasks.find(t => t.id === b.taskId)!; return !t.start || Date.parse(t.start) !== Date.parse(b.start) || Date.parse(t.end!) !== Date.parse(b.end); });
    const plan: ReplanPlan = { id: "local-" + objective, title: objective, rationale: objective === "少改动" ? "先保留已有安排，再把准备任务放入空档；需移动时优先靠近原时间。" : "先安排截止更近的任务，尽早留出准备时间，再安放其余待调整事项。", blocks: changed };
    if (guardPlan(plan, tasks, context).ok && !plans.some(p => JSON.stringify(p.blocks.slice().sort((a,b) => a.taskId.localeCompare(b.taskId))) === JSON.stringify(changed.slice().sort((a,b) => a.taskId.localeCompare(b.taskId))))) plans.push(plan);
  }
  return plans;
}
