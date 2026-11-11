import { beforeEach, describe, expect, it } from "vitest";
import { getClient, readAiConfig } from "@/ai/client";
import { checkRateLimit, resetRateLimit } from "@/ai/ratelimit";
beforeEach(resetRateLimit);
describe("配置和限流", () => {
  it("接受0次重试，拒绝负值及无效值", () => {
    expect(readAiConfig({ NODE_ENV: "test", AI_MAX_RETRIES: "0" }).maxRetries).toBe(0);
    expect(readAiConfig({ NODE_ENV: "test", AI_MAX_RETRIES: "-1" }).maxRetries).toBe(1);
    expect(readAiConfig({ NODE_ENV: "test", AI_MAX_RETRIES: "2broken" }).maxRetries).toBe(1);
    expect(readAiConfig({ NODE_ENV: "test", AI_MAX_RETRIES: "9" }).maxRetries).toBe(3);
  });
  it("密钥同前缀轮换仍重新创建客户端", () => {
    const a = readAiConfig({ NODE_ENV: "test", LLM_API_KEY: "same-prefix-first" });
    expect(getClient(a)).toBe(getClient(a));
    expect(getClient(a)).not.toBe(getClient({ ...a, apiKey: "same-prefix-second" }));
  });
  it("限流到期可恢复，并清理过期调用方记录", () => {
    expect(checkRateLimit("a", 1, 100, 0).allowed).toBe(true);
    expect(checkRateLimit("a", 1, 100, 1).retryAfterSec).toBe(1);
    expect(checkRateLimit("a", 1, 100, 100).allowed).toBe(true);
    for (let i=0;i<4096;i++) checkRateLimit("caller-"+i, 1, 100, 100);
    expect(checkRateLimit("new", 1, 100, 101).allowed).toBe(false);
    expect(checkRateLimit("new", 1, 100, 300).allowed).toBe(true);
  });
});
