"use client";
import { useEffect, useState } from "react";
import { useAccount } from "./AccountContext";
import { RequestStatus } from "./composites/RequestStatus";
import { useRequestScope } from "./composites/useRequestScope";
export function AccountControls() {
  const { snapshot, sync, status, error, logout } = useAccount();
  const [message, setMessage] = useState(""); const [hasLegacy, setHasLegacy] = useState(false);
  const [busy, setBusy] = useState(false); const requestScope = useRequestScope();
  useEffect(() => { queueMicrotask(() => { try { const value = JSON.parse(localStorage.getItem("vibe-coding-2026/planner") ?? "null"); setHasLegacy(!!(value?.state?.tasks?.length || value?.tasks?.length)); } catch { setHasLegacy(false); } }); }, []);
  async function resolve(keepLocal: boolean) {
    if (!window.confirm(keepLocal ? "用当前本机内容替换账号中的另一版本？" : "载入账号最新版本？当前本机未同步修改会被替换，可先导出备份。")) return;
    const current = requestScope.start(); setBusy(true); setMessage("");
    try { await sync.resolveConflict(keepLocal); }
    catch (cause) { if (current()) setMessage(cause instanceof Error ? cause.message : "处理失败"); }
    finally { if (current()) setBusy(false); }
  }
  return <section className="settings-section account-settings"><div className="account-heading"><h3>我的账号</h3><span>@{snapshot.user.username}</span></div>
    <p className={"account-sync-status is-" + status} role="status">{status === "saved" ? "✓ 已自动保存" : status === "saving" ? "正在保存…" : status === "offline" ? "连接中断 · 修改已留在本机" : status === "unsaved" ? "尚未保存 · 请重试或导出备份" : status === "conflict" ? "请确认要保留的版本" : "请重新登录"}</p>
    {error && status !== "saved" && <p className="form-error" role="alert">{error}</p>}
    {busy && <RequestStatus label="正在同步日程" />}
    {status === "conflict" && <div className="settings-actions"><button className="btn" disabled={busy} onClick={() => void resolve(false)}>载入账号版本</button><button className="btn btn-green" disabled={busy} onClick={() => void resolve(true)}>保留本机版本</button></div>}
    {(status === "offline" || status === "unsaved") && <button className="btn btn-green" onClick={() => void sync.flush()}>重试保存</button>}
    {status === "expired" && <button className="btn btn-green" onClick={() => location.reload()}>重新登录</button>}
    {hasLegacy && <button className="btn" onClick={() => { if (!confirm("把这台浏览器原有的本机日程加入当前账号？")) return; try { setMessage("已加入 " + sync.importLegacy() + " 条日程"); setHasLegacy(false); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "导入失败"); } }}>导入原本机日程</button>}
    {message && <p role="status">{message}</p>}<button className="btn account-logout" disabled={busy} onClick={logout}>退出登录</button>
  </section>;
}
