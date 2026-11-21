import { afterEach, beforeEach, expect, it, vi } from "vitest";
const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useState: (value: unknown) => [typeof value === "function" ? (value as () => unknown)() : value, () => {}],
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (fn: unknown) => fn,
}));
class Socket extends EventTarget {
  static OPEN = 1;
  static all: Socket[] = [];
  readyState = 0;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: Record<string, unknown>[] = [];
  constructor(readonly url: string) { super(); Socket.all.push(this); }
  open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  receive(data: object) { this.onmessage?.({ data: JSON.stringify(data) }); }
  close() { this.readyState = 3; this.dispatchEvent(new Event("close")); this.onclose?.(); }
  ack(data: object = { ok: true }) { this.receive({ type: "ack", id: this.sent.at(-1)?.id, ...data }); }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let cleanup: (() => void) | void;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); hooks.effects.length = 0; Socket.all = []; cleanup = undefined;
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  vi.stubGlobal("localStorage", storage); vi.stubGlobal("sessionStorage", storage);
});
afterEach(() => { cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function mount() {
  const { useGameRoom } = await import("./gameClient");
  // The Node harness runs the real hook's effect with deterministic React state slots.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useGameRoom("/ws/test", "ABCD", "Lan");
  cleanup = hooks.effects[0]();
  await flush();
}
it("coalesces simultaneous online and visibility wakes while connecting", async () => {
  await mount();
  window.dispatchEvent(new Event("online")); document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  expect(Socket.all).toHaveLength(1);
  const socket = Socket.all[0]; socket.open(); await flush(); socket.ack(); await flush();
  expect(socket.sent.filter(m => m.type === "join")).toHaveLength(1);
});
it("closes an unmounted candidate immediately rather than waiting for the join deadline", async () => {
  await mount();
  const socket = Socket.all[0]; socket.open(); await flush();
  cleanup?.(); cleanup = undefined;
  expect(socket.readyState).toBe(3);
  socket.ack(); await flush();
  expect(Socket.all).toHaveLength(1);
});
it("coalesces planned reconnects and closes the previous channel after one replacement joins", async () => {
  await mount();
  const first = Socket.all[0]; first.open(); await flush(); first.ack(); await flush();
  first.receive({ type: "reconnect" }); first.receive({ type: "reconnect" }); await flush();
  expect(Socket.all).toHaveLength(2);
  const next = Socket.all[1]; next.open(); await flush(); next.ack(); await flush();
  expect(first.readyState).toBe(3); expect(next.readyState).toBe(1);
  first.receive({ type: "reconnect" }); await flush();
  expect(Socket.all).toHaveLength(2);
});
it("cancels a scheduled retry when the pending replacement joins first", async () => {
  await mount();
  const first = Socket.all[0]; first.open(); await flush(); first.ack(); await flush();
  first.receive({ type: "reconnect" }); await flush();
  first.close();
  const next = Socket.all[1]; next.open(); await flush(); next.ack(); await flush();
  await vi.advanceTimersByTimeAsync(500);
  expect(Socket.all).toHaveLength(2);
});
it("discards an old-session candidate when the current channel requests fresh credentials", async () => {
  const session = await import("../auth/session");
  const user = { id: "a", username: "Lan", role: "user" as const, icon: "", color: "#fff" };
  session.saveSession({ session: "old", user });
  await mount();
  const first = Socket.all[0]; first.open(); await flush(); first.ack(); await flush();
  first.receive({ type: "reconnect" }); await flush();
  const stale = Socket.all[1]; stale.open(); await flush();
  session.saveSession({ session: "new", user });
  first.receive({ type: "signedOut", reason: "revoked" }); await flush();
  expect(stale.readyState).toBe(3);
  expect(Socket.all).toHaveLength(3);
  const fresh = Socket.all[2]; fresh.open(); await flush();
  expect(fresh.sent[0].session).toBe("new");
  stale.ack(); await flush();
  fresh.ack(); await flush();
  expect(fresh.readyState).toBe(1); expect(session.getSession()?.session).toBe("new");
});
it("closes both the current and pending sockets when the room revokes the current session", async () => {
  const session = await import("../auth/session");
  session.saveSession({ session: "current", user: { id: "a", username: "Lan", role: "user", icon: "", color: "#fff" } });
  await mount();
  const first = Socket.all[0]; first.open(); await flush(); first.ack(); await flush();
  first.receive({ type: "reconnect" }); await flush();
  Socket.all[1].receive({ type: "signedOut", reason: "revoked" }); await flush();
  expect(first.readyState).toBe(3); expect(Socket.all[1].readyState).toBe(3);
  expect(session.getSession()).toBeNull();
  await vi.advanceTimersByTimeAsync(8000);
  expect(Socket.all).toHaveLength(2);
});
it("does not replay an ambiguously acknowledged room creation on another backend", async () => {
  vi.stubEnv("NEXT_PUBLIC_TIENLEN_FALLBACK_URL", "https://backup.example");
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
  const { createGameRoom } = await import("./gameClient");
  const pending = createGameRoom("/ws/test");
  const check = expect(pending).rejects.toThrow("Máy chủ không phản hồi");
  await flush(); Socket.all[0].open(); await flush();
  await vi.advanceTimersByTimeAsync(10000);
  await check;
  expect(Socket.all).toHaveLength(1); expect(Socket.all[0].readyState).toBe(3);
});

it("tries the backup only when a create socket fails before sending a mutation", async () => {
  vi.stubEnv("NEXT_PUBLIC_TIENLEN_FALLBACK_URL", "https://backup.example");
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
  const { createGameRoom } = await import("./gameClient");
  const pending = createGameRoom("/ws/test");
  await flush(); Socket.all[0].close(); await flush();
  expect(Socket.all).toHaveLength(2);
  Socket.all[1].open(); await flush(); Socket.all[1].ack({ ok: true, code: "NEW1" });
  await expect(pending).resolves.toBe("NEW1");
  expect(Socket.all[0].sent).toEqual([]);
  expect(Socket.all[1].sent[0].type).toBe("create");
});

it("preserves a terminal create rejection without falling through to the backup", async () => {
  vi.stubEnv("NEXT_PUBLIC_TIENLEN_FALLBACK_URL", "https://backup.example");
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 200 }));
  const { createGameRoom } = await import("./gameClient");
  const pending = createGameRoom("/ws/test");
  const check = expect(pending).rejects.toThrow("Thử lại sau");
  await flush(); Socket.all[0].open(); await flush(); Socket.all[0].ack({ ok: false, error: "Thử lại sau" });
  await check;
  expect(Socket.all).toHaveLength(1); expect(Socket.all[0].readyState).toBe(3);
});
