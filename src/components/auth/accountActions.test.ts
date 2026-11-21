import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PublicUser } from "./session";
const user: PublicUser = { id: "a", username: "Lan", role: "user", icon: "", color: "#fff" };
const other = { ...user, id: "b", username: "Minh" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  vi.resetModules();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function deferredResponse() {
  let resolve!: (value: Response) => void;
  const pending = new Promise<Response>(r => { resolve = r; });
  const fetcher = vi.fn(() => pending);
  vi.stubGlobal("fetch", fetcher);
  return { resolve, sent: () => vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce()) };
}
it("binds the request to the initiating token before asynchronous backend selection", async () => {
  const s = await import("./session");
  s.saveSession({ session: "a", user });
  const fetcher = vi.fn().mockResolvedValue(response({ ok: true }));
  vi.stubGlobal("fetch", fetcher);
  const pending = s.authRequest("PATCH", "/api/auth/me", { password: "new" });
  s.saveSession({ session: "b", user: other });
  await pending;
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer a");
});
it.each(["new-session", "signed-out"])("late logout does not alter %s", async state => {
  const s = await import("./session");
  expect(s.logoutAccount).toBeTypeOf("function");
  s.saveSession({ session: "a", user });
  const reply = deferredResponse();
  const pending = s.logoutAccount();
  await reply.sent();
  if (state === "new-session") s.saveSession({ session: "b", user: other }); else s.clearSession();
  reply.resolve(response({ ok: true }));
  expect((await pending).applied).toBe(false);
  expect(s.getSession()).toEqual(state === "new-session" ? { session: "b", user: other } : null);
});
it.each(["new-session", "signed-out"])("late password rotation does not resurrect or overwrite %s", async state => {
  const s = await import("./session");
  expect(s.changePassword).toBeTypeOf("function");
  s.saveSession({ session: "a", user });
  const reply = deferredResponse();
  const pending = s.changePassword({ oldPassword: "old", password: "new" });
  await reply.sent();
  if (state === "new-session") s.saveSession({ session: "b", user: other }); else s.clearSession();
  reply.resolve(response({ ok: true, session: "rotated", user }));
  expect((await pending).applied).toBe(false);
  expect(s.getSession()).toEqual(state === "new-session" ? { session: "b", user: other } : null);
});
it("keeps the fresh token from a successful password change on the current account", async () => {
  const s = await import("./session");
  expect(s.changePassword).toBeTypeOf("function");
  s.saveSession({ session: "a", user });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true, session: "rotated", user })));
  expect((await s.changePassword({ oldPassword: "old", password: "new" })).applied).toBe(true);
  expect(s.getSession()?.session).toBe("rotated");
});
it("aborts a stalled auth mutation and lets logout finish locally", async () => {
  const s = await import("./session");
  expect(s.logoutAccount).toBeTypeOf("function");
  vi.useFakeTimers();
  s.saveSession({ session: "a", user });
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const pending = s.logoutAccount();
  await vi.advanceTimersByTimeAsync(15000);
  expect(await pending).toMatchObject({ ok: false, applied: true });
  expect(s.getSession()).toBeNull();
});
it.each([
  ["sign-in falls over when asked", "POST", { failover: true }, ["https://a/api/auth/login", "https://b/api/auth/login"]],
  ["mutations stay on the first backend by default", "POST", undefined, ["https://a/api/auth/login"]],
  ["reads fall over by default", "GET", undefined, ["https://a/api/auth/login", "https://b/api/auth/login"]],
] as const)("%s", async (_name, method, opts, expected) => {
  vi.doMock("../games/gameClient", () => ({ SERVER_BASES: ["https://a", "https://b"], activeServerBase: async () => "https://a" }));
  const s = await import("./session");
  const fetcher = vi.fn((url: string) => url.startsWith("https://a") ? Promise.reject(new TypeError("offline")) : Promise.resolve(response({ ok: true, session: "s", user })));
  vi.stubGlobal("fetch", fetcher);
  await s.authRequest(method, "/api/auth/login", {}, opts);
  expect(fetcher.mock.calls.map(c => c[0])).toEqual(expected);
  vi.doUnmock("../games/gameClient");
});
