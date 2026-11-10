import type { Task, TaskDraft } from "./schemas/task";
import { dayKeyOf } from "./time";

/** Only explicit workload in the source is extracted; unknown workload remains unknown. */
export function withExplicitWorkload(draft: TaskDraft): TaskDraft {
  if (!draft.deadline || draft.start || draft.estateMin) return draft;
  const source = draft.rawTextOrigin ?? "";
  const match = /(?:预计|需要|耗时|用时|花费|大约)\s*(半|两|\d+(?:\.\d+)?)\s*(小时|分钟|h\b|min\b)/i.exec(source);
  if (!match) return draft;
  const amount = match[1] === "半" ? .5 : match[1] === "两" ? 2 : Number(match[1]);
  const minutes = Math.round(amount * (/小时|^h$/i.test(match[2]!) ? 60 : 1));
  return minutes > 0 && minutes <= 1440 ? { ...draft, estateMin: minutes } : draft;
}

export function needsPreparation(task: Task, dayKey: string) {
  return !task.done && !task.locked && !task.repeat && !task.start && !!task.deadline
    && dayKeyOf(Date.parse(task.deadline)) >= dayKey && (task.estateMin ?? task.durationMin) > 0;
}
