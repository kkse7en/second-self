"use client";

import { useEffect, useRef, useState } from "react";
import { usePlannerStore } from "@/data/store";
import { Button } from "@/ui/primitives";

import { RequestStatus } from "./RequestStatus";
import { useRequestScope } from "./useRequestScope";

/** 导出当前日程与设置；导入建立导入前快照，支持撤销。 */
export function DataPortability() {
  const requestScope = useRequestScope();
  const [busy, setBusy] = useState(false);
  const exportJson = usePlannerStore((s) => s.exportJson);
  const importJson = usePlannerStore((s) => s.importJson);
  const taskCount = usePlannerStore((s) => s.tasks.length);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!msg) return; const timer = setTimeout(() => setMsg(null), 5000); return () => clearTimeout(timer); }, [msg]);

  function handleExport() {
    const result = exportJson();
    if (!result.ok || !result.text) {
      setMsg({ tone: "err", text: result.error ?? "导出失败" });
      return;
    }
    const blob = new Blob([result.text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename ?? "vibe-planner.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMsg({ tone: "ok", text: `已导出 ${taskCount} 条任务（.json）` });
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    let current: (() => boolean) | null = null;
    try {
      if (file.size > 5_000_000) throw new Error("文件超过 5 MB");
      if (!window.confirm("导入会替换当前全部任务，可撤销。是否继续？")) return;
      setBusy(true); current = requestScope.start();
      const text = await file.text();
      if (!current()) return;
      const result = importJson(text);
      setMsg(
        result.ok
          ? {
              tone: "ok",
              text: result.demo
                ? `已导入 ${result.imported} 条任务（演示数据）`
                : `已导入 ${result.imported} 条任务`,
            }
          : { tone: "err", text: result.error ?? "导入失败" },
      );
    } catch {
      if (current && !current()) return;
      setMsg({ tone: "err", text: "读取文件失败" });
    } finally {
      setBusy(false);
      // 允许重复选择同一个文件
      event.target.value = "";
    }
  }

  return (
    <div className="data-buttons">
      <Button
        variant="secondary"
        className="h-8 px-3 text-micro"
        onClick={handleExport}
        disabled={busy || taskCount === 0}
        title="导出为本机 JSON 文件"
      >
        导出 JSON
      </Button>
      <Button variant="secondary" className="h-8 px-3 text-micro" disabled={busy} onClick={() => fileRef.current?.click()}>
        导入 JSON
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void handleFile(e)}
        aria-label="选择要导入的 JSON 文件"
      />
      {busy && <RequestStatus label="正在导入日程" />}
      {msg ? (
        <span
          role="status"
          className={msg.tone === "ok" ? "text-micro text-ok-400" : "text-micro text-danger-400"}
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
