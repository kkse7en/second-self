import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const stage = join(root, ".demo-build");
const output = join(root, "out-demo");
const basePath = process.env.DEMO_BASE_PATH ?? "/second-self";
if (basePath && !/^\/[A-Za-z0-9_-]+$/.test(basePath)) throw new Error("DEMO_BASE_PATH must be empty or one URL path segment");
for (const directory of [stage, output]) {
  if (resolve(directory).startsWith(resolve(root) + "/") || resolve(directory).startsWith(resolve(root) + "\\")) rmSync(directory, { recursive: true, force: true });
  else throw new Error("Invalid staging path");
}
mkdirSync(stage);
for (const name of ["src", "public", "package.json", "postcss.config.mjs", "tsconfig.json", "next-env.d.ts"]) cpSync(join(root, name), join(stage, name), { recursive: true });
symlinkSync(join(root, "node_modules"), join(stage, "node_modules"), process.platform === "win32" ? "junction" : "dir");
rmSync(join(stage, "src/app/api"), { recursive: true });
rmSync(join(stage, "src/app/planner"), { recursive: true, force: true });
writeFileSync(join(stage, "src/app/page.tsx"), 'import { SampleApp } from "@/ui/SampleApp";\nexport default function Page(){ return <SampleApp/>; }\n');
writeFileSync(join(stage, "next.config.mjs"), 'export default ' + JSON.stringify({ output: "export", basePath, trailingSlash: true, devIndicators: false, turbopack: { root } }) + ';\n');
const tsconfig = JSON.parse(readFileSync(join(stage, "tsconfig.json"), "utf8"));
tsconfig.include = ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"];
writeFileSync(join(stage, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
const result = spawnSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build"], { cwd: stage, stdio: "inherit", env: { ...process.env, TZ: "Asia/Shanghai", NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_DEMO_ONLY: "1", LLM_API_KEY: "" } });
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync(join(stage, "out/index.html"))) throw new Error("Sample export missing");
cpSync(join(stage, "out"), output, { recursive: true });
writeFileSync(join(output, ".nojekyll"), "");
console.log("Static rule-based sample exported to", output);
