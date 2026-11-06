// Session lifecycle with the token in localStorage and sent as Bearer (decision D3-a): blocked storage, reload,
// several tabs, signing in again while requests are in flight, password change, sign-out and revocation.
// The 30-day expiry is checked by the server (be_game `readSession`); here it shows up as a 401.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "./session";
import type { PublicUser } from "./session";

const lan: PublicUser = { id: "u1", username: "lan", role: "user", icon: "🐱", color: "#fbbf24" };
const minh: PublicUser = { id: "u2", username: "minh", role: "user", icon: "🐶", color: "#38bdf8" };
const KEY = "games:session";
const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

type Store = Map<string, string>;
function storage(store: Store, broken: { get?: boolean; set?: boolean; remove?: boolean } = {}) {
  const fail = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  return {
    getItem: (k: string) => (broken.get ? fail() : (store.get(k) ?? null)),
    setItem: (k: string, v: string) => (broken.set ? fail() : void store.set(k, v)),
    removeItem: (k: string) => (broken.remove ? fail() : void store.delete(k)),
  };
}

/** A fresh copy of session.ts, as after a page load (module state starts empty). */
async function load(): Promise<typeof SessionModule> {
  vi.resetModules();
  return import("./session");
}

let shared: Store;
beforeEach(() => {
  shared = new Map();
  vi.stubGlobal("localStorage", storage(shared));
  vi.stubGlobal("sessionStorage", storage(new Map()));
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("blocked storage", () => {
  it("keeps the session in memory for this page when localStorage throws on every call", async () => {
    vi.stubGlobal("localStorage", storage(shared, { get: true, set: true, remove: true }));
    const s = await load();
    expect(() => s.saveSession({ session: "tok", user: lan })).not.toThrow();
    expect(s.getSession()).toEqual({ session: "tok", user: lan });
    s.clearSession();
    expect(s.getSession()).toBeNull();
  });

  it("keeps the session when only writing fails (quota exceeded, some private modes)", async () => {
    vi.stubGlobal("localStorage", storage(shared, { set: true }));
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    expect(s.getSession()).toEqual({ session: "tok", user: lan });
    s.clearSession();
    expect(s.getSession()).toBeNull();
  });

  it("does not resurrect a session it could not remove from storage", async () => {
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    vi.stubGlobal("localStorage", storage(shared, { remove: true }));
    s.clearSession();
    expect(s.getSession()).toBeNull();
  });

  it("a read that fails once does not sign out for good: the next read finds the stored session", async () => {
    shared.set(KEY, JSON.stringify({ session: "tok", user: lan }));
    let failNext = true;
    vi.stubGlobal("localStorage", {
      ...storage(shared),
      getItem: (k: string) => {
        if (failNext) {
          failNext = false;
          throw new DOMException("blocked", "SecurityError");
        }
        return shared.get(k) ?? null;
      },
    });
    const s = await load();
    expect(s.getSession()).toBeNull();
    expect(s.getSession()).toEqual({ session: "tok", user: lan });
  });

  it("a failed write also removes the previous account from storage, so a reload does not bring it back", async () => {
    shared.set(KEY, JSON.stringify({ session: "old", user: minh }));
    vi.stubGlobal("localStorage", storage(shared, { set: true }));
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    expect(s.getSession()).toEqual({ session: "tok", user: lan });
    expect(shared.has(KEY)).toBe(false);
    vi.stubGlobal("localStorage", storage(shared));
    expect((await load()).getSession()).toBeNull();
  });

  it("sends no Authorization header once signed out, even with storage blocked", async () => {
    vi.stubGlobal("localStorage", storage(shared, { get: true, set: true, remove: true }));
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    s.clearSession();
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await s.authRequest("GET", "/api/auth/rooms");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty("Authorization");
  });
});

describe("reload", () => {
  it("restores the saved session on a fresh page", async () => {
    (await load()).saveSession({ session: "tok", user: lan });
    const after = await load();
    expect(after.getSession()).toEqual({ session: "tok", user: lan });
  });

  it("a session kept only in memory (blocked storage) ends with the page", async () => {
    vi.stubGlobal("localStorage", storage(shared, { get: true, set: true, remove: true }));
    (await load()).saveSession({ session: "tok", user: lan });
    expect((await load()).getSession()).toBeNull();
  });
});

describe("several tabs (one localStorage, a storage event per change)", () => {
  /** What the browser does in the other tabs when one tab writes. */
  const storageEvent = (key: string | null) => window.dispatchEvent(Object.assign(new Event("storage"), { key }));

  it("another tab signing in, switching account or signing out is seen here", async () => {
    const s = await load();
    const seen: (string | null)[] = [];
    const off = s.subscribeSession(() => seen.push(s.getSession()?.user.username ?? null));

    shared.set(KEY, JSON.stringify({ session: "a", user: lan }));
    storageEvent(KEY);
    shared.set(KEY, JSON.stringify({ session: "b", user: minh }));
    storageEvent(KEY);
    shared.delete(KEY);
    storageEvent(KEY);
    shared.set(KEY, JSON.stringify({ session: "c", user: lan }));
    storageEvent(null); // localStorage.clear() in another tab
    expect(seen).toEqual(["lan", "minh", null, "lan"]);

    off();
    storageEvent(KEY);
    expect(seen).toHaveLength(4);
  });

  it("ignores other keys", async () => {
    const s = await load();
    const listener = vi.fn();
    s.subscribeSession(listener);
    storageEvent("games:playerName");
    expect(listener).not.toHaveBeenCalled();
  });

  it("this tab's requests use the account the other tab switched to", async () => {
    const s = await load();
    s.saveSession({ session: "a", user: lan });
    shared.set(KEY, JSON.stringify({ session: "b", user: minh }));
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await s.authRequest("GET", "/api/auth/rooms");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer b" });
  });
});

describe("signing in again while a request is in flight", () => {
  /** fetch that hangs until `resolve`; `sent()` waits until the request has really gone out. */
  function deferred() {
    let resolve!: (r: Response) => void;
    const promise = new Promise<Response>((r) => (resolve = r));
    const fetchMock = vi.fn().mockReturnValue(promise);
    vi.stubGlobal("fetch", fetchMock);
    const sent = () => vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    return { resolve, sent, fetchMock };
  }

  it("a late 401 for the old token does not sign out the new session or leave a notice", async () => {
    const s = await load();
    s.saveSession({ session: "old", user: lan });
    const late = deferred();
    const pending = s.authRequest("GET", "/api/auth/me");
    await late.sent();
    s.saveSession({ session: "new", user: minh }); // signed in again (here or in another tab)
    expect((late.fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer old" });
    late.resolve(jsonRes(401, { ok: false, error: "Cần đăng nhập" }));
    await pending;
    expect(s.getSession()).toEqual({ session: "new", user: minh });
    expect(s.takeSignOutReason()).toBeNull();
  });

  it("a late refreshMe answer does not overwrite the account signed in meanwhile", async () => {
    const s = await load();
    s.saveSession({ session: "old", user: lan });
    const late = deferred();
    const pending = s.refreshMe();
    await late.sent();
    s.saveSession({ session: "new", user: minh });
    late.resolve(jsonRes(200, { ok: true, user: { ...lan, role: "admin" } }));
    await pending;
    expect(s.getSession()).toEqual({ session: "new", user: minh });
  });

  it("a late profile update does not overwrite the account signed in meanwhile", async () => {
    const s = await load();
    s.saveSession({ session: "old", user: lan });
    const late = deferred();
    const pending = s.updateProfile({ icon: "🦊" });
    await late.sent();
    s.saveSession({ session: "new", user: minh });
    late.resolve(jsonRes(200, { ok: true, user: { ...lan, icon: "🦊" } }));
    await pending;
    expect(s.getSession()).toEqual({ session: "new", user: minh });
  });

  it("a late answer after signing out does not sign back in", async () => {
    const s = await load();
    s.saveSession({ session: "old", user: lan });
    const late = deferred();
    const pending = s.refreshMe();
    await late.sent();
    s.clearSession();
    late.resolve(jsonRes(200, { ok: true, user: lan }));
    await pending;
    expect(s.getSession()).toBeNull();
  });
});

describe("password change, expiry and revocation", () => {
  it("after a password change the fresh session is used and the old token's 401 is ignored", async () => {
    const s = await load();
    s.saveSession({ session: "old", user: lan });
    // AccountMenu: PATCH /api/auth/me answers with a new session, saved in place of the old one.
    s.saveSession({ session: "new", user: lan });
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { ok: true, user: lan }));
    vi.stubGlobal("fetch", fetchMock);
    await s.refreshMe();
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer new" });
    expect(s.getSession()?.session).toBe("new");
  });

  it("a 401 on the current token (expired after 30 days, password changed or signed out elsewhere) signs out with a notice", async () => {
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(401, { ok: false, error: "Cần đăng nhập" })));
    await s.refreshMe();
    expect(s.getSession()).toBeNull();
    expect(s.takeSignOutReason()).toBe("revoked");
  });

  it.each([403, 429, 500, 503])("a %i keeps the session (not an authentication failure)", async (status) => {
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(status, { ok: false, error: "x" })));
    await s.refreshMe();
    expect(s.getSession()?.session).toBe("tok");
  });

  it("a network failure on every backend keeps the session", async () => {
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await s.refreshMe();
    expect(s.getSession()?.session).toBe("tok");
  });

  it("signing out removes the token from storage", async () => {
    const s = await load();
    s.saveSession({ session: "tok", user: lan });
    s.clearSession();
    expect(shared.has(KEY)).toBe(false);
    expect((await load()).getSession()).toBeNull();
  });
});
