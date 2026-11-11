import { type NextRequest } from "next/server";
import { CredentialsSchema } from "@/domain/account";
import { AccountError, accountRepository } from "@/server/accounts";
import { accountFailure, authSource, privateJson, readAccountJson, sameOrigin, withSession } from "@/server/account-http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const parsed = CredentialsSchema.safeParse(await readAccountJson(request, 4096));
    if (!parsed.success) throw new AccountError(400, parsed.error.issues[0]?.message ?? "请检查账号和密码");
    const repo = accountRepository();
    const source = authSource(request), sourceKey = "login-source:" + source;
    const userKey = JSON.stringify(["login-user", source, parsed.data.username]);
    const retry = Math.max(repo.retryAfter(sourceKey, 100), repo.retryAfter(userKey, 15));
    if (retry) throw new AccountError(429, `登录尝试太频繁，请${retry}秒后重试`, retry);
    let snapshot;
    try { snapshot = await repo.login(parsed.data.username, parsed.data.password); }
    catch (error) {
      if (error instanceof AccountError && error.status === 401) { repo.allowAttempt(sourceKey, 100); repo.allowAttempt(userKey, 15); }
      throw error;
    }
    repo.clearAttempts(userKey);
    return withSession(privateJson({ ok: true, snapshot }), request, repo.createSession(snapshot.user.id));
  } catch (error) { return accountFailure(error); }
}
