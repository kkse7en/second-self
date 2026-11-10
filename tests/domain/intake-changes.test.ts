import { describe, expect, it } from "vitest";
import { applyIntakeChanges, intakeMatches, sameIntake } from "@/domain/intakeChanges";
import { TaskDraftSchema } from "@/domain/schemas/task";
import { expandOccurrences, msFromDayKey, repeatDeadlineOnDay } from "@/domain/time";
import { sampleTasks, SAMPLE_DAY } from "@/domain/sample";
import { usePlannerStore } from "@/data/store";

const course=sampleTasks()[0]!;
const at=(day:string,h:number)=>new Date(msFromDayKey(day,h*60)).toISOString();
const draft=TaskDraftSchema.parse({...course,title:"数据结构调课",start:at(SAMPLE_DAY,17),end:at(SAMPLE_DAY,19),repeat:null});
describe("确认通知关联与周期变更",()=>{
  it("匹配只提供建议，不直接改用户数据",()=>{expect(intakeMatches(draft,[course])[0]?.id).toBe(course.id);expect(course.start).toBe(at(SAMPLE_DAY,14));expect(sameIntake(draft,course)).toBe(false);});
  it("单次调课仅排除原发生日，下周仍保留，固定标记不丢",()=>{
    const result=applyIntakeChanges([course], [draft], [{kind:"update",taskId:course.id,scope:"single",originalDay:SAMPLE_DAY}],()=>"one-off");
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.tasks).toHaveLength(2);expect(result.tasks.every(t=>t.locked)).toBe(true);
    const original=result.tasks[0]!;
    expect(expandOccurrences(original,new Date(msFromDayKey(SAMPLE_DAY,0)),new Date(msFromDayKey("2026-11-11",0)))).toHaveLength(0);
    expect(expandOccurrences(original,new Date(msFromDayKey("2026-11-17",0)),new Date(msFromDayKey("2026-11-18",0)))).toHaveLength(1);
    expect(result.tasks[1]!.repeat).toBeNull();expect(result.tasks[1]!.occurrenceOf).toBe(course.id);
    expect(repeatDeadlineOnDay({...original,deadline:at(SAMPLE_DAY,20)},SAMPLE_DAY)).toBeNull();
  });
  it("原课日期错误、未核对、重复修改同一条时整批不写入",()=>{
    expect(applyIntakeChanges([course],[draft],[{kind:"update",taskId:course.id,scope:"single",originalDay:"2026-11-11"}],()=>"bad").ok).toBe(false);
    expect(applyIntakeChanges([course],[{...draft,needsReview:true}],[{kind:"new"}],()=>"bad").ok).toBe(false);
    expect(applyIntakeChanges([course],[draft,draft],[{kind:"update",taskId:course.id,scope:"series"},{kind:"update",taskId:course.id,scope:"series"}],()=>"bad").ok).toBe(false);
  });
  it("整组更新保留其他课程，不用截图缺席推断删除",()=>{
    const tasks=sampleTasks();const result=applyIntakeChanges(tasks,[draft],[{kind:"update",taskId:course.id,scope:"series"}],()=>"unused");
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.tasks).toHaveLength(tasks.length);expect(result.tasks[0]!.start).toBe(draft.start);expect(result.tasks[0]!.repeat?.byDay).toEqual([2]);expect(result.tasks[1]).toEqual(tasks[1]);
  });
  it("已有安排可忽略，原样保留",()=>{const result=applyIntakeChanges([course],[draft],[{kind:"skip"}],()=>"unused");expect(result.ok&&result.tasks).toEqual([course]);});
  it("批量确认只有一次撤销，陈旧关联不可覆盖新数据",()=>{
    const before=sampleTasks();usePlannerStore.setState({tasks:before,snapshot:null,termStartDayKey:null});
    expect(usePlannerStore.getState().confirmIntake([draft],[{kind:"update",taskId:course.id,scope:"single",originalDay:SAMPLE_DAY}],"old").ok).toBe(false);
    expect(usePlannerStore.getState().confirmIntake([draft],[{kind:"update",taskId:course.id,scope:"single",originalDay:SAMPLE_DAY}],JSON.stringify(before)).ok).toBe(true);
    usePlannerStore.getState().undo();expect(usePlannerStore.getState().tasks).toEqual(before);
  });
});
