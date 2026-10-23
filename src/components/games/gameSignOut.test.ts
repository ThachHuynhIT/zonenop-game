import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSession, getSession, saveSession, takeSignOutReason, type PublicUser } from "../auth/session";
import { hasNewerSession, signOutGameSession } from "./gameClient";

const user: PublicUser = { id: "u1", username: "lan", role: "user", icon: "🐱", color: "#fbbf24" };
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}
afterEach(() => { clearSession(); vi.unstubAllGlobals(); });

describe("signedOut from a room socket", () => {
  it.each(["replaced", "revoked"] as const)("clears its own session with reason %s", (reason) => {
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("sessionStorage", storage());
    saveSession({ session: "old", user });
    expect(signOutGameSession("old", reason)).toBe(true);
    expect(getSession()).toBeNull();
    expect(takeSignOutReason()).toBe(reason);
  });
  it("does not clear a newer session or leave a stale sign-out notice", () => {
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("sessionStorage", storage());
    saveSession({ session: "new", user });
    expect(signOutGameSession("old", "revoked")).toBe(false);
    expect(getSession()?.session).toBe("new");
    expect(takeSignOutReason()).toBeNull();
  });
  it("re-joins instead of stopping when this browser signed in again (e.g. a password change at the table)", () => {
    vi.stubGlobal("localStorage", storage());
    saveSession({ session: "new", user });
    expect(hasNewerSession("old")).toBe(true);
    expect(hasNewerSession("new")).toBe(false);
    expect(hasNewerSession(undefined)).toBe(true);
  });
  it("stops when there is no session left to re-join with", () => {
    vi.stubGlobal("localStorage", storage());
    expect(hasNewerSession("old")).toBe(false);
  });
});
