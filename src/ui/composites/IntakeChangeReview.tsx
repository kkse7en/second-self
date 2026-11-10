"use client";
import type { Task, TaskDraft } from "@/domain/schemas/task";
import { intakeMatches, sameIntake, type IntakeChoice } from "@/domain/intakeChanges";
import { timeRangeLabel } from "./planChanges";
import { minutesFromLocalMidnight, msFromDayKey } from "@/domain/time";

export function IntakeChangeReview({ tasks, drafts, choices, onChange }: {
  tasks: Task[]; drafts: TaskDraft[]; choices: (IntakeChoice | null)[]; onChange: (index: number, choice: IntakeChoice | null) => void;
}) {
  return <div className="intake-changes"><p className="section-kicker">把新通知和原安排对上</p>{drafts.map((draft, index) => {
    const matches = intakeMatches(draft, tasks);
    const choice = choices[index];
    const selected = choice?.kind === "update" ? tasks.find(t => t.id === choice.taskId) : null;
    const originalStart = selected?.repeat && selected.start && choice?.kind === "update" && choice.scope === "single" && choice.originalDay
      ? new Date(msFromDayKey(choice.originalDay,minutesFromLocalMidnight(Date.parse(selected.start)))).toISOString() : selected?.start;
    const originalEnd = originalStart && selected?.start && selected.end
      ? new Date(Date.parse(originalStart)+Date.parse(selected.end)-Date.parse(selected.start)).toISOString() : selected?.end;
    return <article className="change-review-card" key={index}><div className="change-card-heading"><span className="day-badge">{index + 1}</span><div><h3>{draft.title}</h3><p>{timeRangeLabel(draft.start, draft.end)}{!draft.start && draft.deadline ? " · 截止 " + new Date(draft.deadline).toLocaleString("zh-CN", { month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit" }) : ""}</p></div></div>
      <label>处理方式<select aria-label={"第 " + (index + 1) + " 条处理方式"} value={choice?.kind === "update" ? choice.taskId : choice?.kind ?? ""} onChange={event => {
        const value = event.target.value;
        onChange(index, !value ? null : value === "new" || value === "skip" ? {kind:value} : {kind:"update",taskId:value,scope:"single"});
      }}><option value="">请选择</option><option value="new">新增日程</option>{matches.map(task => <option value={task.id} key={task.id}>{sameIntake(draft, task) ? "已存在 · " : "更新 · "}{task.title}</option>)}<optgroup label="关联其他安排">{tasks.filter(task=>!task.done&&!matches.some(m=>m.id===task.id)).map(task=><option value={task.id} key={task.id}>{task.title}</option>)}</optgroup><option value="skip">忽略这条</option></select></label>
      {selected && <><div className="notification-comparison"><div><span>原安排</span><strong>{selected.title}</strong><p>{timeRangeLabel(originalStart ?? null, originalEnd ?? null)}</p><small>{selected.location || "未填地点"}</small></div><span aria-hidden="true">→</span><div><span>通知后</span><strong>{selected.title}</strong><p>{timeRangeLabel(draft.start, draft.end)}</p><small>{draft.location ?? selected.location ?? "未填地点"}</small></div></div>
        {sameIntake(draft, selected) && <p className="notice">这条安排已存在，选择忽略可避免重复。</p>}
        {selected.repeat && choice?.kind === "update" && <div className="change-scope"><label>更新范围<select aria-label={"第 " + (index + 1) + " 条更新范围"} value={choice.scope} onChange={event => onChange(index,{...choice,scope:event.target.value as "single" | "series",originalDay:undefined})}><option value="single">只改一次</option><option value="series">整组每周安排</option></select></label>{choice.scope === "single" && <label>原来的那节课是哪天？<input type="date" aria-label="原课程日期" value={choice.originalDay ?? ""} onChange={event => onChange(index,{...choice,originalDay:event.target.value})}/></label>}{choice.scope === "series" && <p className="notice">整组的每周时间都会更新。</p>}</div>}
        {selected.locked && <small className="change-fixed-note">确认通知后更新，仍保留固定标记。</small>}
      </>}
    </article>;
  })}</div>;
}

export function initialIntakeChoices(drafts: TaskDraft[], tasks: Task[]): (IntakeChoice | null)[] {
  return drafts.map(draft => intakeMatches(draft, tasks).length ? null : {kind:"new"});
}

export function intakeChoiceComplete(choice: IntakeChoice | null, tasks: Task[]) {
  if (!choice) return false;
  return choice.kind !== "update" || choice.scope !== "single" || !tasks.find(t => t.id === choice.taskId)?.repeat || !!choice.originalDay;
}
