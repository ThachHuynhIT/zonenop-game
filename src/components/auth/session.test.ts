import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY, authRequest, clearSession, getSession, refreshMe, saveSession, setSignOutReason, takeSignOutReason, type PublicUser } from "./session";
import { getDeviceId } from "./device";

const user: PublicUser = { id: "u1", username: "lan", role: "user", icon: "🐱", color: "#fbbf24" };

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}
const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("session storage", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = stubStorage();
    clearSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("saves, reads and clears", () => {
    expect(getSession()).toBeNull();
    saveSession({ session: "tok", user });
    expect(JSON.parse(store.get(SESSION_KEY)!)).toEqual({ session: "tok", user });
    expect(getSession()).toEqual({ session: "tok", user });
    expect(getSession()).toBe(getSession()); // stable reference for useSyncExternalStore
    clearSession();
    expect(getSession()).toBeNull();
    expect(store.has(SESSION_KEY)).toBe(false);
  });

  it("treats broken JSON as signed out", () => {
    store.set(SESSION_KEY, "{oops");
    expect(getSession()).toBeNull();
    store.set(SESSION_KEY, JSON.stringify({ session: "x" }));
    expect(getSession()).toBeNull();
  });
});

describe("authRequest", () => {
  beforeEach(() => {
    stubStorage();
    clearSession();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the Bearer header and parses the data", async () => {
    saveSession({ session: "tok", user });
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { ok: true, user }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await authRequest<{ user: PublicUser }>("GET", "/api/auth/me");
    expect(res).toEqual({ ok: true, data: { ok: true, user } });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(init.method).toBe("GET");
  });

  it("sends a JSON body without a session for login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(401, { ok: false, error: "Sai tên đăng nhập hoặc mật khẩu" }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await authRequest("POST", "/api/auth/login", { username: "a", password: "b" });
    expect(res).toEqual({ ok: false, status: 401, error: "Sai tên đăng nhập hoặc mật khẩu" });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ username: "a", password: "b" }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("clears the session on 401 and remembers why", async () => {
    const reasons = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => reasons.get(k) ?? null, setItem: (k: string, v: string) => reasons.set(k, v), removeItem: (k: string) => reasons.delete(k) });
    setSignOutReason("replaced");
    saveSession({ session: "tok", user });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(401, { ok: false, error: "Cần đăng nhập" })));
    const res = await authRequest("GET", "/api/auth/me");
    expect(res.ok).toBe(false);
    expect(getSession()).toBeNull();
    expect(takeSignOutReason()).toBe("revoked");
  });

  it("reports a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await authRequest("GET", "/api/auth/me");
    expect(res).toMatchObject({ ok: false, status: 0 });
  });

  it("refreshMe updates the user, and signs out on 401", async () => {
    saveSession({ session: "tok", user });
    const admin = { ...user, role: "admin" as const };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(200, { ok: true, user: admin })));
    await refreshMe();
    expect(getSession()).toEqual({ session: "tok", user: admin });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(401, { ok: false, error: "Cần đăng nhập" })));
    await refreshMe();
    expect(getSession()).toBeNull();
  });
});

describe("getDeviceId", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("is 24 url-safe chars and stable", () => {
    const store = stubStorage();
    const a = getDeviceId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(getDeviceId()).toBe(a);
    expect(store.get("games:device")).toBe(a);
  });
});
