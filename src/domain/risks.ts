import type { Task } from "./schemas/task";
import { DEFAULT_DETECT_CONFIG, detectConflicts } from "./conflicts";
import { addDaysToKey, dayKeyOf } from "./time";

export interface PlanningRisk { id: string; day: string; title: string; detail: string; taskIds: string[]; kind: "conflict" | "preparation"; severity: "high" | "medium" | "low" }
export function planningRisks(tasks: readonly Task[], now: Date, termStartDayKey: string | null): PlanningRisk[] {
  const today = dayKeyOf(now.getTime()), last = addDaysToKey(today, 13);
  const risks: PlanningRisk[] = detectConflicts(tasks, { ...DEFAULT_DETECT_CONFIG, termStartDayKey, repeatWindowStartDayKey: today }, now)
    .filter(c => c.date >= today && c.date <= last).map(c => ({ id:c.conflictId + c.date, day:c.date, title:c.humanMessage, detail:c.involvedTaskIds.map(id=>tasks.find(t=>t.id===id)?.title).filter(Boolean).join(" / "), taskIds:c.involvedTaskIds, kind:"conflict", severity:c.severity }));
  for (const task of tasks) {
    if (task.done || task.start || !task.deadline || task.repeat || task.locked) continue;
    const day = dayKeyOf(Date.parse(task.deadline));
    if (day < today || day > last) continue;
    risks.push({ id:"prepare-"+task.id, day, title:task.title, detail:(task.estateMin ?? task.durationMin) > 0 ? "截止前还没留出准备时间" : "补充准备时长，或仅保留提醒", taskIds:[task.id], kind:"preparation", severity:"medium" });
  }
  // A deadline reminder and preparation action share one row when they refer to the same task.
  return risks.filter(r=>r.kind === "preparation" || !risks.some(p=>p.kind === "preparation" && p.taskIds.length === r.taskIds.length && p.taskIds.every(id=>r.taskIds.includes(id))))
    .sort((a,b)=>a.day.localeCompare(b.day)||Number(b.severity==="high")-Number(a.severity==="high"));
}
