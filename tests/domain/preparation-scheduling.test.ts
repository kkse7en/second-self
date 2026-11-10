import { describe, expect, it } from "vitest";
import { buildSchedulingPlans } from "@/domain/scheduling";
import { guardPlan } from "@/domain/planGuard";
import { applyPlan } from "@/domain/reflow";
import { withExplicitWorkload } from "@/domain/preparation";
import { sampleTasks, SAMPLE_DAY, SAMPLE_NOW } from "@/domain/sample";
import { nextQuestion, resolveAnswer } from "@/ui/composites/clarifyQueue";
import { TaskDraftSchema } from "@/domain/schemas/task";
import { msFromDayKey } from "@/domain/time";
const context={dayKey:SAMPLE_DAY,now:SAMPLE_NOW,termStartDayKey:null};
describe("截止任务准备排程",()=>{
  it("显式工作量抽取，不猜测未知工作量",()=>{
    const draft=TaskDraftSchema.parse(sampleTasks()[2]);
    expect(withExplicitWorkload({...draft,estateMin:undefined,rawTextOrigin:"周五交报告，预计两小时"}).estateMin).toBe(120);
    expect(withExplicitWorkload({...draft,estateMin:undefined,rawTextOrigin:"周五交报告"}).estateMin).toBeUndefined();
  });
  it("未知时询问准备时长，可选只提醒且不伪造占用",()=>{
    const draft=TaskDraftSchema.parse({...sampleTasks()[2],estateMin:undefined});const question=nextQuestion([draft],SAMPLE_DAY,[])!;
    expect(question.question.id).toBe("workload");
    const result=resolveAnswer(question,{source:"option",optionId:"m120"},SAMPLE_DAY);
    expect(result.ok&&result.patch).toEqual({estateMin:120,needsReview:false});
    const reminder=resolveAnswer(question,{source:"option",optionId:"reminder"},SAMPLE_DAY);
    expect(reminder.ok&&reminder.patch.estateMin).toBe(0);
  });
  it("联合安排多个待办，在截止前留足工作时间，固定课不动",()=>{
    const tasks=sampleTasks();tasks.push({...tasks[2]!,id:"essay",title:"读书报告",estateMin:60});
    const plans=buildSchedulingPlans(tasks,context);expect(plans.length).toBeGreaterThan(0);
    for(const plan of plans){expect(guardPlan(plan,tasks,context).ok).toBe(true);const after=applyPlan(tasks,plan);expect(after[0]).toEqual(tasks[0]);for(const id of ["sample-report","essay"]){const t=after.find(t=>t.id===id)!;expect(t.start).not.toBeNull();expect(Date.parse(t.end!)).toBeLessThanOrEqual(Date.parse(t.deadline!));expect(t.durationMin).toBe(t.estateMin);}}
  });
  it("不同目标得到不同排序；相同排布去重",()=>{
    const tasks=sampleTasks();const plans=buildSchedulingPlans(tasks,context);
    expect(new Set(plans.map(p=>JSON.stringify(p.blocks))).size).toBe(plans.length);
    expect(plans.length).toBe(2);expect(plans.map(p=>p.title)).toEqual(["少改动","优先截止"]);
  });
  it("超截止、压缩准备时长、移固定课、超七天都拒绝",()=>{
    const tasks=sampleTasks();const end=new Date(msFromDayKey(SAMPLE_DAY,10*60)).toISOString();
    const plan={id:"bad",title:"bad",rationale:"bad",blocks:[{taskId:"sample-report",start:SAMPLE_NOW,end}]};
    expect(guardPlan(plan,tasks,context).ok).toBe(false);
    expect(guardPlan({...plan,blocks:[{taskId:"sample-course",start:SAMPLE_NOW,end}]},tasks,context).ok).toBe(false);
    expect(guardPlan({...plan,blocks:[{taskId:"sample-report",start:"2026-11-20T09:00:00+08:00",end:"2026-11-20T11:00:00+08:00"}]},tasks,context).ok).toBe(false);
  });
  it("没有足够空档时不假称安排成功",()=>{
    const t={...sampleTasks()[2]!,estateMin:1440};expect(buildSchedulingPlans([t],context)).toEqual([]);
  });
});
