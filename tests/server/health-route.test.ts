import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { HealthReportSchema } from "@/domain/schemas/system";
const health = vi.hoisted(() => vi.fn());
vi.mock("@/server/accounts", async original => ({ ...await original<typeof import("@/server/accounts")>(), accountRepository: () => ({ health }) }));
afterEach(() => { health.mockReset(); vi.unstubAllEnvs(); });
describe("自检响应", () => {
  it("不返回具体运行版本或模型配置，不把配置当连通性", async () => {
    vi.stubEnv("LLM_API_KEY", "test-only-key"); vi.stubEnv("LLM_MODEL", "private-model-name");
    const response = await GET(), body = await response.json();
    expect(response.status).toBe(200);
    expect(HealthReportSchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toContain("private-model-name");
    expect(body.app.node).toBe("Node.js");
    expect(JSON.stringify(body)).toContain("未探测模型连通性");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("数据库异常时返回503且不泄露本地路径", async () => {
    health.mockImplementationOnce(() => { throw new Error("private-path"); });
    const response = await GET(), body = await response.json();
    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(JSON.stringify(body)).not.toContain("private-path");
  });
});
