import { TaskDraftSchema, TaskListSchema, type Task, type TaskDraft } from "./schemas/task";
import { addDaysToKey, dayKeyOf, expandOccurrences, isoWeekdayOf, msFromDayKey } from "./time";

export type IntakeChoice =
  | { kind: "new" }
  | { kind: "skip" }
  | { kind: "update"; taskId: string; scope: "single" | "series"; originalDay?: string };

function name(value: string) { return value.toLowerCase().replace(/[\s\p{P}\p{S}\d]/gu, ""); }
export function intakeMatches(draft: TaskDraft, tasks: readonly Task[]) {
  const title = name(draft.title);
  return tasks.filter(task => {
    const other = name(task.title);
    return !task.done && title.length >= 2 && other.length >= 2 && (title.includes(other) || other.includes(title));
  }).sort((a, b) => Number(name(b.title) === title) - Number(name(a.title) === title)).slice(0, 8);
}

export function sameIntake(draft: TaskDraft, task: Task) {
  const sameTime = (a: string | null, b: string | null) => a === b || (!!a && !!b && Date.parse(a) === Date.parse(b));
  return name(draft.title) === name(task.title) && sameTime(draft.start, task.start) && sameTime(draft.end, task.end)
    && sameTime(draft.deadline, task.deadline) && (draft.location ?? null) === (task.location ?? null)
    && JSON.stringify(draft.repeat) === JSON.stringify(task.repeat);
}

/** Explicit, atomic intake decisions. Missing courses are never interpreted as deletions. */
export function applyIntakeChanges(tasks: readonly Task[], drafts: readonly TaskDraft[], choices: readonly IntakeChoice[],
  newId: () => string, termStartDayKey: string | null = null) {
  try {
    if (choices.length !== drafts.length) throw new Error("请逐条选择如何处理通知");
    let next = [...tasks];
    let added = 0, updated = 0, skipped = 0;
    const touched = new Set<string>();
    drafts.forEach((input, index) => {
      const choice = choices[index]!;
      if (choice.kind === "skip") { skipped++; return; }
      const draft = TaskDraftSchema.parse(input);
      if (draft.needsReview) throw new Error("请先完成日程核对");
      if (choice.kind === "new") {
        next.push({ ...draft, id: newId(), done: false, source: "text", locked: draft.locked ?? false }); added++; return;
      }
      const current = next.find(task => task.id === choice.taskId);
      if (!current) throw new Error("关联日程已变化，请重新核对");
      const key = current.id + (choice.scope === "single" ? "@" + choice.originalDay : "@series");
      if (touched.has(key) || touched.has(current.id + "@series") || (choice.scope === "series" && [...touched].some(k => k.startsWith(current.id + "@")))) throw new Error("同一安排有多条变更，请分次确认");
      touched.add(key);
      if (current.repeat && choice.scope === "single") {
        const day = choice.originalDay;
        if (!day || !expandOccurrences(current, new Date(msFromDayKey(day, 0)), new Date(msFromDayKey(addDaysToKey(day, 1), 0)), termStartDayKey).some(o => dayKeyOf(Date.parse(o.start)) === day)) throw new Error("原日期没有这节课，请选择要替换的那一次");
        if (!draft.start || !draft.end) throw new Error("单次调课需要完整的新时段");
        next = next.map(task => task.id === current.id ? { ...task, repeat: { ...current.repeat!, excludedDates: [...new Set([...(current.repeat!.excludedDates ?? []), day])] } } : task);
        next.push({ ...current, ...draft, location: draft.location ?? current.location, id: newId(), title: current.title, done: current.done || (current.completedOn ?? []).includes(day), completedOn: [], repeat: null, locked: current.locked, occurrenceOf: current.id });
      } else {
        const repeat = current.repeat ? { ...current.repeat, byDay: draft.repeat?.byDay ?? (draft.start ? [isoWeekdayOf(Date.parse(draft.start))] : current.repeat.byDay) } : draft.repeat;
        next = next.map(task => task.id === current.id ? { ...current, ...draft, location: draft.location ?? current.location, deadline: draft.deadline ?? current.deadline, title: current.title, repeat, locked: current.locked } : task);
      }
      updated++;
    });
    return { ok: true as const, tasks: TaskListSchema.parse(next), added, updated, skipped };
  } catch (cause) { return { ok: false as const, error: cause instanceof Error ? cause.message : "通知未能保存" }; }
}
