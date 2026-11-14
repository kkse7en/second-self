import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 与服务端一致；日期型截止按北京时间23:59解释。
process.env.TZ = "Asia/Shanghai";

/**
 * 单测覆盖领域规则、数据恢复、AI契约与账号接口。
 * React 组件不在此配置内做快照测试，避免与 Next 构建链耦合。
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    testTimeout: 15_000,
    maxWorkers: 4,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/shared/**", "src/ai/**"],
    },
  },
});
