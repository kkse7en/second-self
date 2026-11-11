let activeAccountId: string | null = null;
const volatileCache = new Map<string, string>();
let lastCacheStamp = 0;
export function nextCacheStamp(): number { lastCacheStamp = Math.max(Date.now(), lastCacheStamp + 1); return lastCacheStamp; }
export function setActiveAccountId(id: string | null) { if (id !== activeAccountId) volatileCache.clear(); activeAccountId = id; }
export function accountStorageKey(key: string): string | null { return activeAccountId ? key + ":" + activeAccountId : null; }
export function readAccountCache(key: string): string | null {
  const scoped = accountStorageKey(key);
  if (scoped && volatileCache.has(scoped)) return volatileCache.get(scoped)!;
  try { return scoped && typeof window !== "undefined" ? localStorage.getItem(scoped) : null; } catch { return null; }
}
export function writeAccountCache(key: string, value: string): boolean {
  const scoped = accountStorageKey(key);
  if (!scoped || typeof window === "undefined") return false;
  try { localStorage.setItem(scoped, value); volatileCache.delete(scoped); return true; } catch { volatileCache.set(scoped, value); return false; }
}
export function discardVolatileAccountCache(key: string) { const scoped = accountStorageKey(key); if (scoped) volatileCache.delete(scoped); }
export function removeAccountCache(key: string) {
  const scoped = accountStorageKey(key); if (!scoped) return;
  volatileCache.delete(scoped);
  try { localStorage.removeItem(scoped); } catch { /* Server copy remains authoritative. */ }
}
