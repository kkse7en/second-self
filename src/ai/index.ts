/** 服务端 AI 模式入口；具体调用、修复与降级见 orchestrator 和 API 路由。 */
export const AI_LAYER_READY = true;

/** 未配置密钥时使用本地文字规则与确定性重排；不模拟图片识别。 */
export function resolveAiMode(apiKey: string | undefined): "live" | "demo" {
  return apiKey && apiKey.trim().length > 0 ? "live" : "demo";
}
