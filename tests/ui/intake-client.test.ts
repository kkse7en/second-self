import { afterEach, describe, expect, it, vi } from "vitest";
import { requestParseText } from "@/ui/composites/intakeClient";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("录入请求生命周期", () => {
  it("请求使用有界等待，超时提供可重试错误", async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(signal);
    const fetch = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    vi.stubGlobal("fetch", fetch);
    const outcome = await requestParseText({ text: "  明天14:00项目讨论  ", dayKey: "2026-11-10" });
    expect(timeout).toHaveBeenCalledWith(120000);
    expect(fetch).toHaveBeenCalledWith("/api/ai/parse-tasks", expect.objectContaining({ signal, body: JSON.stringify({ text: "明天14:00项目讨论", dayKey: "2026-11-10" }) }));
    expect(outcome).toMatchObject({ kind: "fail", message: "整理超时，请检查连接后重试" });
  });
  it("断网与服务端非JSON均为失败，不进入核对成功态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce({ status: 502, json: async () => { throw new SyntaxError("not json"); } }));
    expect(await requestParseText({ text: "明天14:00项目讨论", dayKey: "2026-11-10" })).toMatchObject({ kind: "fail", message: expect.stringContaining("检查网络") });
    expect(await requestParseText({ text: "明天14:00项目讨论", dayKey: "2026-11-10" })).toMatchObject({ kind: "fail", message: expect.stringContaining("HTTP 502") });
  });
});
