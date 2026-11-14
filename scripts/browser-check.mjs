import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:net";

const root = process.cwd();
const output = resolve(process.env.BROWSER_OUTPUT ?? "output/playwright");
mkdirSync(output, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), "second-self-browser-"));
const checks = [], errors = [];
let browser, service, serverLog = "";
const check = (name, ok, detail) => { checks.push({ name, ok, ...(detail === undefined ? {} : { detail }) }); assert.ok(ok, name + (detail ? ": " + JSON.stringify(detail) : "")); };
const screenshot = async (page, name, fullPage = false) => page.screenshot({ path: join(output, name + ".png"), fullPage });
let base = process.env.BROWSER_BASE_URL;
const staticSample = process.env.BROWSER_STATIC_SAMPLE === "1";
async function session(page) { return page.evaluate(async () => (await (await fetch("/api/account/session")).json()).snapshot); }

try {
  if (!base) {
    const port = await new Promise((resolvePort, reject) => { const probe = createServer(); probe.once("error", reject); probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolvePort(port)); }); });
    base = "http://127.0.0.1:" + port;
    const env = { ...process.env, ACCOUNT_DATA_DIR: dataDir, TZ: "Asia/Shanghai" };
    for (const key of Object.keys(env)) if (key.startsWith("LLM_") || key.startsWith("AI_") || key === "ACCOUNT_TRUST_PROXY") delete env[key];
    service = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    service.stdout.on("data", chunk => { serverLog += chunk; }); service.stderr.on("data", chunk => { serverLog += chunk; });
    const deadline = Date.now() + 60000;
    for (;;) {
      if (service.exitCode !== null) throw new Error("Server exited: " + serverLog);
      try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* waiting for startup */ }
      if (Date.now() > deadline) throw new Error("Server did not become ready: " + serverLog);
      await new Promise(done => setTimeout(done, 200));
    }
  }
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const executablePath = process.env.BROWSER_EXECUTABLE_PATH || (existsSync(edge) ? edge : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, timezoneId: "Asia/Shanghai", reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(20000); page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  const origin = new URL(base).origin;
  const unexpectedRequests = [], apiRequests = [];
  page.on("request", request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) unexpectedRequests.push(request.url()); if (new URL(request.url()).pathname.includes("/api/")) apiRequests.push(request.url()); });
  await page.goto(base + (staticSample ? "/" : "/sample"));
  await page.getByRole("button", { name: "看调整", exact: true }).waitFor();
  await page.waitForFunction(() => { const img = document.querySelector(".nav-avatar img"); return img?.complete && img.naturalWidth > 0; });
  check("default-avatar-loaded", await page.locator(".nav-avatar img").evaluate(img => img.complete && img.naturalWidth > 0 && img.getAttribute("src").endsWith("/avatar.svg")));
  check("no-embedded-loading-frame", await page.locator("iframe,canvas").count() === 0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1080 });
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, bottom: document.querySelector(".tabbar").getBoundingClientRect().bottom, height: innerHeight }));
    check("responsive-" + width, !layout.overflow && Math.abs(layout.bottom - layout.height) < 30, layout);
    if (width === 390 || width === 1440) await screenshot(page, "today-" + width);
  }
  await page.getByRole("button", { name: "看调整", exact: true }).click();
  await page.getByRole("button", { name: "生成重排方案", exact: true }).click();
  await page.getByRole("button", { name: "采用这套安排", exact: true }).waitFor();
  await screenshot(page, "replan-desktop");
  const first = await page.locator(".replan-change-list").innerText();
  await page.getByRole("button", { name: "02 优先截止" }).click();
  const second = await page.locator(".replan-change-list").innerText();
  check("objectives-change-actual-times", first !== second);
  await page.getByRole("button", { name: "01 少改动" }).click();
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, "replan-mobile");
  check("mobile-plan-fits", await page.locator("dialog").evaluate(el => el.scrollWidth <= el.clientWidth));
  await page.getByRole("button", { name: "采用这套安排", exact: true }).click();
  check("adopt-returns-to-schedule", await page.locator("dialog").count() === 0);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await page.getByRole("button", { name: "看调整", exact: true }).waitFor(); check("undo-restores-risks", true);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await page.getByRole("button", { name: "试一条调课通知 ↗" }).click();
  await page.getByRole("button", { name: "解析成任务", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  check("intake-needs-explicit-choice", await page.getByRole("button", { name: "确认保存", exact: true }).isDisabled());
  await page.getByLabel("第 1 条处理方式").selectOption("sample-course");
  check("one-off-needs-original-date", await page.getByRole("button", { name: "确认保存", exact: true }).isDisabled());
  await page.getByLabel("原课程日期").fill("2026-11-10"); await screenshot(page, "notification-desktop");
  await page.setViewportSize({ width: 390, height: 844 }); await screenshot(page, "notification-mobile");
  check("mobile-notice-fits", await page.locator("dialog").evaluate(el => el.scrollWidth <= el.clientWidth));
  await page.getByRole("button", { name: "确认保存", exact: true }).click();
  await page.getByRole("heading", { name: "安排已更新", exact: true }).waitFor();
  await page.getByRole("button", { name: "查看日程", exact: true }).click();
  await page.getByRole("button", { name: "编辑 数据结构", exact: true }).waitFor();
  const today = await page.locator(".today-card").innerText(); check("one-off-course-updated", today.includes("17:00") && !today.includes("14:00"));
  await page.getByLabel("查看日期", { exact: true }).fill("2026-11-17");
  const next = await page.locator(".today-card").innerText(); check("next-week-course-preserved", next.includes("14:00") && !next.includes("17:00"));
  await page.getByRole("button", { name: "重置样例", exact: true }).click();
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: "今天", exact: true }).click();
  await page.getByRole("button", { name: "看调整", exact: true }).waitFor();
  check("sample-reset", true);
  check("sample-no-account-cache", await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes("sample")).length === 0));
  if (staticSample) {
    check("static-sample-no-api", apiRequests.length === 0, apiRequests);
  } else {
    await page.setViewportSize({ width: 1440, height: 1080 }); await page.goto(base + "/");
    await page.getByRole("button", { name: "注册", exact: true }).waitFor(); await screenshot(page, "login");
    await page.getByRole("button", { name: "注册", exact: true }).click(); await screenshot(page, "register");
    const username = "browser_" + Date.now(), password = "Check-" + crypto.randomUUID();
    await page.getByLabel("昵称", { exact: true }).fill("测试体验者");
    await page.getByLabel("账号", { exact: true }).fill(username); await page.getByLabel("密码", { exact: true }).fill(password); await page.getByLabel("确认密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "创建我的账号 ↗" }).click(); await page.getByRole("button", { name: "个人设置" }).waitFor();
    check("register-through-ui", (await session(page)).workspace.planner.tasks.length === 0);
    await page.getByRole("button", { name: "个人设置" }).click();
    check("single-default-avatar", await page.locator(".profile-preview").getAttribute("src") === "/avatar.svg" && await page.locator('input[type="file"][accept^="image/"]').count() === 0);
    await page.getByLabel("用户名", { exact: true }).fill("新的昵称"); await page.getByRole("button", { name: "保存设置", exact: true }).click();
    await page.waitForFunction(async () => (await (await fetch("/api/account/session")).json()).snapshot?.workspace.profile.name === "新的昵称");
    check("profile-auto-save", true);
    await page.getByRole("button", { name: "添加", exact: true }).click(); await page.getByRole("button", { name: "＋ 新增", exact: true }).click();
    await page.getByRole("textbox", { name: "任务标题" }).fill("账号持久化检查"); await page.getByRole("button", { name: "加入日程", exact: true }).click();
    await page.waitForFunction(async () => (await (await fetch("/api/account/session")).json()).snapshot?.workspace.planner.tasks.some(task => task.title === "账号持久化检查")); check("task-auto-save", true);
    await page.goto(base + "/sample"); await page.getByRole("button", { name: "看调整", exact: true }).waitFor();
    await page.getByRole("button", { name: "重置样例", exact: true }).click();
    check("sample-isolates-account", (await session(page)).workspace.planner.tasks.length === 1);
    await page.goto(base + "/"); await page.getByRole("button", { name: "个人设置" }).waitFor();
    await page.getByRole("button", { name: "未来", exact: true }).click(); await page.getByRole("searchbox").fill("账号持久化检查");
    check("reload-restores-task", await page.getByRole("button", { name: "编辑 账号持久化检查" }).count() > 0);
    await page.getByRole("button", { name: "个人设置" }).click(); await page.getByRole("button", { name: "退出登录", exact: true }).click();
    await page.getByRole("button", { name: "登录，继续今天 ↗" }).waitFor(); check("logout-completes", true);
    await page.getByLabel("账号", { exact: true }).fill(username); await page.getByLabel("密码", { exact: true }).fill(password); await page.getByRole("button", { name: "登录，继续今天 ↗" }).click();
    await page.getByRole("button", { name: "个人设置" }).waitFor(); check("login-restores-workspace", (await session(page)).workspace.profile.name === "新的昵称");
  }
  check("no-unhandled-page-errors", errors.length === 0, errors);
  check("no-external-page-requests", unexpectedRequests.length === 0, unexpectedRequests);
} catch (error) {
  errors.push(error.stack ?? String(error));
  if (browser) for (const context of browser.contexts()) for (const page of context.pages()) { await screenshot(page, "failure").catch(() => {}); writeFileSync(join(output, "failure.html"), await page.content().catch(() => "")); }
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (service && service.exitCode === null) { const exited = new Promise(done => service.once("exit", done)); service.kill(); await Promise.race([exited, new Promise(done => setTimeout(done, 5000))]); }
  if (resolve(dataDir).startsWith(resolve(tmpdir()) + "/") || resolve(dataDir).startsWith(resolve(tmpdir()) + "\\")) rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  const report = { date: new Date().toISOString(), mode: staticSample ? "static-local-rules" : "production-local-rules", checks, errors };
  writeFileSync(join(output, "browser-check.json"), JSON.stringify(report, null, 2) + "\n");
  if (process.exitCode) writeFileSync(join(output, "server.log"), serverLog);
  console.log(JSON.stringify(report, null, 2));
}
