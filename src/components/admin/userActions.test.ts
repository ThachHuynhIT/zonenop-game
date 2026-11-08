import { describe, expect, it } from "vitest";
import { getUserActionRules } from "./userActions";
import type { AdminUser } from "./types";

const user = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: "u1",
  username: "Lan",
  role: "user",
  disabled: false,
  createdAt: "2026-11-01T00:00:00.000Z",
  lastLoginAt: null,
  games: 0,
  ...over,
});

describe("getUserActionRules", () => {
  it("allows everything on an ordinary account", () => {
    expect(getUserActionRules(user(), "me")).toEqual({ canChangeRole: true, canLock: true, canUnlock: true, canResetPassword: true });
  });

  it("hides role, lock and password for another admin's owner account, but keeps unlock", () => {
    const owner = user({ id: "o", role: "admin", isOwner: true });
    expect(getUserActionRules(owner, "me")).toEqual({ canChangeRole: false, canLock: false, canUnlock: true, canResetPassword: false });
  });

  it("keeps the self protection: no role change or lock on yourself, password allowed", () => {
    expect(getUserActionRules(user({ id: "me", role: "admin" }), "me")).toEqual({ canChangeRole: false, canLock: false, canUnlock: true, canResetPassword: true });
  });

  it("lets the owner reset their own password", () => {
    const owner = user({ id: "o", role: "admin", isOwner: true });
    expect(getUserActionRules(owner, "o").canResetPassword).toBe(true);
  });

  it("treats a missing isOwner (older backend) as not the owner", () => {
    const legacy = user({ role: "admin" });
    delete legacy.isOwner;
    expect(getUserActionRules(legacy, "me")).toEqual({ canChangeRole: true, canLock: true, canUnlock: true, canResetPassword: true });
  });

  it("does not guess the owner from the username, and a null self id matches nobody", () => {
    expect(getUserActionRules(user({ username: "Thach", role: "admin" }), "me").canLock).toBe(true);
    expect(getUserActionRules(user({ id: "me" }), null).canLock).toBe(true);
  });
});
