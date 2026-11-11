import { type NextRequest } from "next/server";
import { RegisterSchema } from "@/domain/account";
import { AccountError, accountRepository } from "@/server/accounts";
import { accountFailure, authSource, privateJson, readAccountJson, sameOrigin, withSession } from "@/server/account-http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const repo = accountRepository();
    const parsed = RegisterSchema.safeParse(await readAccountJson(request, 4096));
    if (!parsed.success) throw new AccountError(400, parsed.error.issues[0]?.message ?? "请检查注册信息");
    const key = "register:" + authSource(request);
    const retry = repo.retryAfter(key, 40);
    if (retry) throw new AccountError(429, `注册太频繁，请${retry}秒后重试`, retry);
    repo.allowAttempt(key, 40);
    const snapshot = await repo.register(parsed.data.username, parsed.data.password, parsed.data.name);
    return withSession(privateJson({ ok: true, snapshot }, 201), request, repo.createSession(snapshot.user.id));
  } catch (error) { return accountFailure(error); }
}
