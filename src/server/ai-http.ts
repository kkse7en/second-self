import type { NextRequest } from "next/server";
import type { z } from "zod";
import { readAiConfig } from "@/ai/client";
import { checkRateLimit } from "@/ai/ratelimit";
import { AccountError } from "./accounts";
import { accountFailure, privateJson, readAccountJson, requireAccount, sameOrigin } from "./account-http";

/** 三个AI入口共用有界读取、鉴权、私有响应与异常边界。 */
export async function handleAiRequest<T>(request: NextRequest, options: {
  key: string; bodyLimit: number; rateLimit?: number; schema: z.ZodType<T>;
  run: (input: T) => Promise<{ ok: boolean }>;
}) {
  let mode: "live" | "demo" = "demo";
  try {
    let userId: string;
    try { sameOrigin(request); userId = requireAccount(request).user.id; }
    catch (error) { return accountFailure(error); }
    mode = readAiConfig().mode;
    const limit = checkRateLimit(`${options.key}:${userId}`, options.rateLimit);
    if (!limit.allowed) {
      const response = privateJson({ ok: false, mode, error: `请求太频繁，请 ${limit.retryAfterSec} 秒后再试`, issues: [], timings: [] }, 429);
      response.headers.set("Retry-After", String(limit.retryAfterSec));
      return response;
    }
    const parsed = options.schema.safeParse(await readAccountJson(request, options.bodyLimit));
    if (!parsed.success) return privateJson({ ok: false, mode, error: "请求参数不合法", issues: parsed.error.issues.map(i => `${i.path.join(".") || "(根)"}: ${i.message}`), timings: [] }, 400);
    const result = await options.run(parsed.data);
    return privateJson(result, result.ok ? 200 : 422);
  } catch (error) {
    if (error instanceof AccountError) return privateJson({ ok: false, mode, error: error.message, issues: [], timings: [] }, error.status);
    // 不记录原文、图片、模型响应、密钥或异常message。
    console.error(`[ai:${options.key}] unexpected failure`);
    return privateJson({ ok: false, mode, error: "整理服务暂时不可用，请重试。原日程未修改", issues: [], timings: [] }, 500);
  }
}
