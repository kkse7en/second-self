import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, DEFAULT_PROFILE, normalizeProfile } from "@/domain/profile";
import { AccountProfileSchema } from "@/domain/account";
describe("profile identity", () => {
  it("uses the built-in avatar and trims the name", () => {
    expect(normalizeProfile({name:"  我的日程  "})).toEqual({name:"我的日程",avatar:DEFAULT_AVATAR});
  });
  it("does not display external or embedded image sources", () => {
    for (const avatar of ["https://example.com/tracker.jpg","javascript:alert(1)","data:image/png;base64,aGVsbG8="])
      expect(normalizeProfile({avatar}).avatar).toBe(DEFAULT_AVATAR);
  });
  it("migrates stored local profile sources while rejecting remote URLs", () => {
    expect(AccountProfileSchema.parse({name:"我的日程",avatar:"/old-local-image.webp"}).avatar).toBe(DEFAULT_AVATAR);
    expect(AccountProfileSchema.safeParse({name:"我的日程",avatar:"https://example.com/a.png"}).success).toBe(false);
  });
  it("falls back safely from missing or malformed records", () => {
    for (const value of [null,42,"name",{name:"  ",avatar:false}]) expect(normalizeProfile(value)).toEqual(DEFAULT_PROFILE);
    expect(normalizeProfile({name:"a".repeat(100)}).name.length).toBe(24);
  });
});
