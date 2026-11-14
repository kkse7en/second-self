"use client";
import { useEffect, useState } from "react";
import { DEFAULT_PROFILE, normalizeProfile, type Profile } from "@/domain/profile";
import { accountStorageKey, discardVolatileAccountCache, readAccountCache, writeAccountCache } from "./account-cache";

const KEY = "second-self/profile";
export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  useEffect(() => {
    function read() {
      try { setProfile(normalizeProfile(JSON.parse(readAccountCache(KEY) ?? "null"))); }
      catch { setProfile(DEFAULT_PROFILE); }
    }
    queueMicrotask(read);
    const sync = (event: StorageEvent) => { if (event.key === accountStorageKey(KEY) || event.key === null) read(); };
    window.addEventListener("storage", sync);
    window.addEventListener("second-self:profile", read);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("second-self:profile", read); };
  }, []);
  function save(next: Profile): boolean {
    const normalized = normalizeProfile(next);
    try {
      if (!writeAccountCache(KEY, JSON.stringify(normalized))) { discardVolatileAccountCache(KEY); return false; }
      setProfile(normalized); window.dispatchEvent(new Event("second-self:profile")); return true;
    }
    catch { return false; }
  }
  return { profile, save };
}
