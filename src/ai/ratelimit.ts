/**
 * 极简内存限流 —— 保护模型调用不被刷爆（每次调用是要花钱的）。
 * 限制：单实例内存计数，多实例部署时需换成 Redis，这里在注释里写明边界。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 4096;
let nextSweep = 0;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  limit = 12,
  windowMs = 60_000,
  now: number = Date.now(),
): RateLimitResult {
  if (now >= nextSweep || buckets.size >= MAX_BUCKETS) {
    for (const [id, bucket] of buckets) if (now >= bucket.resetAt) buckets.delete(id);
    nextSweep = now + 60_000;
  }
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) return { allowed: false, remaining: 0, retryAfterSec: 60 };
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

/** 测试用：清空计数 */
export function resetRateLimit(): void {
  buckets.clear();
  nextSweep = 0;
}
