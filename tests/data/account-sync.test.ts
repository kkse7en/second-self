import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSync } from "@/data/account-sync";
import { setActiveAccountId } from "@/data/account-cache";
import { usePlannerStore } from "@/data/store";
import { emptyAccountWorkspace, type AccountSnapshot } from "@/domain/account";
import { makeTask } from "../helpers/fixtures";

let data: Map<string, string>;
let failKeys: Set<string>;
let controllers: AccountSync[];
const user = { id: "test-account", username: "tester" };
const snapshot = (): AccountSnapshot => ({ user, workspace: emptyAccountWorkspace("自己的昵称"), revision: 0, updatedAt: "2026-11-11T00:00:00Z" });
const key = (name: string) => name + ":" + user.id;
const plannerKey = key("vibe-coding-2026/planner"), metaKey = key("second-self/sync");
async function activate(value = snapshot()) { const sync = new AccountSync(value); controllers.push(sync); await sync.activate(value); return sync; }
beforeEach(() => {
  data = new Map(); failKeys = new Set(); controllers = [];
  vi.useFakeTimers(); setActiveAccountId(null);
  const localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { if (failKeys.has(k) || failKeys.has("*")) throw new Error("quota"); data.set(k, v); }, removeItem: (k: string) => data.delete(k) };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false, visibilityState: "visible" }));
  vi.stubGlobal("fetch", vi.fn());
  usePlannerStore.setState({ ...snapshot().workspace.planner, lastError: null });
});
afterEach(() => { for (const sync of controllers) sync.stop(); setActiveAccountId(null); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("账号同步故障与竞态", () => {
  it("断网但成功缓存时才提示本机保留，重试成功后自动保存", async () => {
    const sync = await activate();
    usePlannerStore.setState({ tasks: [makeTask({ id: "new" })] });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await sync.flush();
    expect(sync.status).toBe("offline");
    expect(JSON.parse(data.get(metaKey)!).pending).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ revision: 1 }));
    await sync.flush();
    expect(sync.status).toBe("saved");
    expect(JSON.parse(data.get(metaKey)!).pending).toBe(false);
  });
  it("断网且缓存写入失败不得声称已保存，资料仍留在当前页面", async () => {
    failKeys.add("*");
    const sync = await activate();
    usePlannerStore.setState({ tasks: [makeTask({ id: "new" })] });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await sync.flush();
    expect(sync.status).toBe("unsaved");
    expect(sync.error).toContain("均未保存");
    expect(sync.error).not.toContain("已留在本机");
    expect(usePlannerStore.getState().tasks[0]?.id).toBe("new");
    failKeys.clear();
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ revision: 1 }));
    await sync.flush();
    const sent = JSON.parse(vi.mocked(fetch).mock.calls[1]![1]!.body as string);
    expect(sent.workspace.profile.name).toBe("自己的昵称");
    expect(sync.status).toBe("saved");
  });
  it("元数据写入失败后重新载入，恢复日程并先确认版本", async () => {
    const first = await activate();
    failKeys.add(metaKey);
    usePlannerStore.setState({ tasks: [makeTask({ id: "recover-me" })] });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    await first.flush(); first.stop();
    expect(JSON.parse(data.get(metaKey)!).pending).toBe(false);
    setActiveAccountId(null); // 模拟刷新后内存缓存丢失
    failKeys.clear();
    const second = await activate();
    expect(second.status).toBe("conflict");
    expect(usePlannerStore.getState().tasks[0]?.id).toBe("recover-me");
    expect(data.has(plannerKey)).toBe(true);
  });
  it.each([true, false])("处理冲突等待期间有新编辑时，不覆盖新内容（keepLocal=%s）", async keepLocal => {
    const sync = await activate();
    usePlannerStore.setState({ tasks: [makeTask({ id: "first" })] });
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }));
    const resolving = sync.resolveConflict(keepLocal);
    usePlannerStore.setState({ tasks: [makeTask({ id: "newer" })] });
    resolve(Response.json({ snapshot: { ...snapshot(), revision: 1 } }));
    await expect(resolving).rejects.toThrow("又有修改");
    expect(usePlannerStore.getState().tasks[0]?.id).toBe("newer");
    expect(sync.status).toBe("conflict");
  });
  it("没有新编辑时仍能明确选择远端版本", async () => {
    const sync = await activate();
    usePlannerStore.setState({ tasks: [makeTask({ id: "local" })] });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ snapshot: { ...snapshot(), revision: 2 } }));
    await sync.resolveConflict(false);
    expect(sync.status).toBe("saved");
    expect(usePlannerStore.getState().tasks).toEqual([]);
  });
  it("已有未同步元数据后继续编辑，元数据写入失败时不回退到上一次编辑", async () => {
    const first = await activate();
    usePlannerStore.setState({ tasks: [makeTask({ id: "earlier" })] });
    failKeys.add(metaKey);
    usePlannerStore.setState({ tasks: [makeTask({ id: "latest" })] });
    first.stop(); setActiveAccountId(null); failKeys.clear();
    const recovered = await activate();
    expect(recovered.status).toBe("conflict");
    expect(usePlannerStore.getState().tasks[0]?.id).toBe("latest");
  });
  it("日程缓存写入失败而元数据成功时，保留较新的元数据", async () => {
    const first = await activate();
    failKeys.add(plannerKey);
    usePlannerStore.setState({ tasks: [makeTask({ id: "in-meta" })] });
    first.stop(); setActiveAccountId(null); failKeys.clear();
    const recovered = await activate();
    expect(recovered.status).toBe("saving");
    expect(usePlannerStore.getState().tasks[0]?.id).toBe("in-meta");
  });
});
