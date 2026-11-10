"use client";
import type { Task } from "@/domain/schemas/task";
import type { PlanningRisk } from "@/domain/risks";
import { dayKeyOf } from "@/domain/time";

export function RiskOverview({ risks, tasks, now, onOpen, onPrepare }: { risks: PlanningRisk[]; tasks: Task[]; now: Date; onOpen:(day:string)=>void; onPrepare:(task:Task)=>void }) {
  if (!risks.length) return <section className="risk-overview is-calm"><div><span className="risk-symbol" aria-hidden="true">✓</span><h2>接下来，从容一点。</h2></div><p>未来两周暂未发现需要处理的安排。</p></section>;
  return <section className="risk-overview" aria-label="接下来要处理的安排"><div className="risk-heading"><span className="section-kicker">提前看一步</span><span>{risks.length} 处待处理</span></div><h2>变化来了，安排跟上。</h2><ul>{risks.slice(0,4).map(risk=>{
    const task = tasks.find(t=>t.id===risk.taskIds[0]);
    const unknown = risk.kind === "preparation" && task && (task.estateMin ?? task.durationMin) <= 0;
    const canAdjust = risk.taskIds.some(id=>tasks.some(t=>t.id===id&&!t.done&&!t.locked&&!t.repeat&&t.start&&t.durationMin>0));
    return <li key={risk.id}><span className={"risk-date is-"+risk.severity}>{risk.day.slice(5).replace("-","/")}</span><div><h3>{risk.title}</h3><p>{risk.detail}</p></div><button className="risk-action" onClick={()=>unknown ? onPrepare(task) : onOpen(risk.kind === "preparation" ? dayKeyOf(now.getTime()) : risk.day)}>{unknown ? "补时长" : risk.kind === "preparation" ? "排准备" : canAdjust ? "看调整" : "查看"}<span aria-hidden="true"> ↗</span></button></li>;
  })}</ul></section>;
}
