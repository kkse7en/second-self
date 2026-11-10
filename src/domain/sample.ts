import { TaskSchema, type Task } from "./schemas/task";
import { addDaysToKey, isoWeekdayOf, msFromDayKey } from "./time";

export const SAMPLE_DAY = "2026-11-10";
export const SAMPLE_NOW = new Date(msFromDayKey(SAMPLE_DAY, 9 * 60)).toISOString();
export function sampleTasks(): Task[] {
  const at = (day:string, hour:number) => new Date(msFromDayKey(day,hour*60)).toISOString();
  const task = (id:string,title:string,start:string|null,end:string|null,extra:Partial<Task>={}) => TaskSchema.parse({id,title,start,end,durationMin:start&&end?(Date.parse(end)-Date.parse(start))/60000:0,deadline:null,priority:2,source:"manual",done:false,rawTextOrigin:null,locked:false,repeat:null,needsReview:false,...extra});
  return [
    task("sample-course","数据结构",at(SAMPLE_DAY,14),at(SAMPLE_DAY,16),{locked:true,location:"一教201",repeat:{kind:"weekly",byDay:[isoWeekdayOf(msFromDayKey(SAMPLE_DAY,0))]}}),
    task("sample-discuss","项目讨论",at(SAMPLE_DAY,15),at(SAMPLE_DAY,16),{location:"一教201"}),
    task("sample-report","实验报告",null,null,{deadline:at(addDaysToKey(SAMPLE_DAY,3),18),estateMin:120,priority:1}),
  ];
}
