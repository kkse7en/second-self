/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination -- Full navigation isolates sample state from account state. */
"use client";
import { useEffect, useState } from "react";
import { setActiveAccountId } from "@/data/account-cache";
import { usePlannerStore } from "@/data/store";
import { sampleTasks, SAMPLE_NOW } from "@/domain/sample";
import { AccountContext } from "./AccountContext";
import { emptyAccountWorkspace } from "@/domain/account";
import { FinalPlanner } from "./FinalPlanner";

export function SampleApp() {
  const hosted = process.env.NEXT_PUBLIC_DEMO_ONLY === "1";
  const [ready,setReady]=useState(false);
  function reset() {
    // Full-page navigation into /sample creates a separate JS context. No account ID means no cache writes.
    setActiveAccountId(null);
    usePlannerStore.setState({tasks:sampleTasks(),snapshot:null,snapshotClock:null,snapshotTermStart:null,termStartDayKey:null,lastError:null,demoClock:{iso:SAMPLE_NOW,source:"seed"}});
  }
  useEffect(()=>{let active=true;setActiveAccountId(null);void Promise.resolve(usePlannerStore.persist.rehydrate()).then(()=>{if(active){reset();setReady(true);}});return()=>{active=false;};},[]);
  if(!ready)return null;
  return <AccountContext value={{sample:true,snapshot:{user:{id:"sample",username:"sample"},workspace:emptyAccountWorkspace("体验者"),revision:0,updatedAt:SAMPLE_NOW},sync:{flush:async()=>{},resolveConflict:async()=>{},importLegacy:()=>0},status:"saved",error:"",logout:()=>{location.href="/";}}}>
    <div className="sample-banner"><span><b>样例体验</b> · 本地规则 · 不保存到账号</span><div><button onClick={reset}>重置样例</button>{hosted ? <a href="https://github.com/kkse7en/second-self" target="_blank" rel="noreferrer">查看源码 ↗</a> : <a href="/">进入我的账号 ↗</a>}</div></div><FinalPlanner/>
  </AccountContext>;
}
