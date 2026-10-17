import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { basesToTry, failedJoinOutcome, fetchApi, resolveJoin, type JoinOutcome } from "./gameClient";

describe("fetchApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

  it("shares one request between identical GETs within 4 s, then fetches again", async () => {
    fetchMock.mockResolvedValue(ok({ rooms: [] }));
    const path = "/api/share-test/rooms";

    await Promise.all([fetchApi(path), fetchApi(path)]);
    vi.advanceTimersByTime(3_999);
    await fetchApi(path);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await fetchApi(path);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends no Authorization header", async () => {
    fetchMock.mockResolvedValue(ok({ rooms: [] }));
    await fetchApi("/api/noauth-test/rooms");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toBeUndefined();
  });

  it("does not share a failed request", async () => {
    const path = "/api/fail-test/rooms";
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) }).mockResolvedValueOnce(ok({ rooms: [1] }));

    await expect(fetchApi(path)).rejects.toThrow("HTTP 503");
    await expect(fetchApi(path)).resolves.toEqual({ rooms: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("basesToTry", () => {
  const A = "https://play-api.example";
  const B = "https://backup.example";
  it("tries every candidate in order when the room's backend is unknown", () => {
    expect(basesToTry(null, [A, B])).toEqual([A, B]);
  });
  it("tries the pinned backend first, then the others (so a dead backend falls through)", () => {
    expect(basesToTry(B, [A, B])).toEqual([B, A]);
    expect(basesToTry(A, [A, B])).toEqual([A, B]);
  });
  it("keeps a pinned backend that is no longer configured out of the list", () => {
    expect(basesToTry("https://old.example", [A, B])).toEqual([A, B]);
  });
});

describe("failedJoinOutcome", () => {
  it("maps not found, and a request timeout counts as unreachable", () => {
    expect(failedJoinOutcome("Không tìm thấy phòng")).toEqual({ kind: "not-found" });
    expect(failedJoinOutcome("Máy chủ không phản hồi")).toEqual({ kind: "unreachable" });
    expect(failedJoinOutcome("Mất kết nối máy chủ")).toEqual({ kind: "unreachable" });
  });
  it("keeps every other server error terminal", () => {
    expect(failedJoinOutcome("Phòng đã đủ người")).toEqual({ kind: "error", error: "Phòng đã đủ người" });
  });
});

describe("resolveJoin", () => {
  const A = "https://play-api.example";
  const B = "https://backup.example";
  const CH = "channel";
  const NOT_FOUND = { kind: "error", error: "Không tìm thấy phòng" };

  /** Runs resolveJoin with a canned outcome per backend; reports which backends were tried. */
  async function run(roomBase: string | null, outcomes: Record<string, JoinOutcome<string>>, hasChannel = false) {
    const tried: string[] = [];
    const bases = basesToTry(roomBase, [A, B]);
    const step = await resolveJoin(bases, roomBase, () => hasChannel, async (base) => {
      tried.push(base);
      return outcomes[base];
    });
    return { step, tried };
  }
  const joined: JoinOutcome<string> = { kind: "joined", channel: CH };
  const unreachable: JoinOutcome<string> = { kind: "unreachable" };
  const notFound: JoinOutcome<string> = { kind: "not-found" };

  it("pinned backend unreachable: the other backend is tried and joined", async () => {
    const { step, tried } = await run(A, { [A]: unreachable, [B]: joined });
    expect(step).toEqual({ kind: "join", base: B, channel: CH });
    expect(tried).toEqual([A, B]);
  });

  it("pinned backend unreachable, other says not found: retry without an error", async () => {
    const { step, tried } = await run(A, { [A]: unreachable, [B]: notFound });
    expect(step).toEqual({ kind: "retry" });
    expect(tried).toEqual([A, B]);
  });

  it("pinned backend joins: the others are not tried", async () => {
    const { step, tried } = await run(B, { [A]: unreachable, [B]: joined });
    expect(step).toEqual({ kind: "join", base: B, channel: CH });
    expect(tried).toEqual([B]);
  });

  it("pinned backend says not found: final error, the others are not tried", async () => {
    const { step, tried } = await run(A, { [A]: notFound, [B]: unreachable });
    expect(step).toEqual(NOT_FOUND);
    expect(tried).toEqual([A]);
  });

  it("unknown room, every backend says not found: room not found", async () => {
    const { step, tried } = await run(null, { [A]: notFound, [B]: notFound });
    expect(step).toEqual(NOT_FOUND);
    expect(tried).toEqual([A, B]);
  });

  it("unknown room, one backend says not found and one is unreachable: retry", async () => {
    expect((await run(null, { [A]: notFound, [B]: unreachable })).step).toEqual({ kind: "retry" });
    expect((await run(null, { [A]: unreachable, [B]: notFound })).step).toEqual({ kind: "retry" });
  });

  it("unknown room, first backend says not found and the second has it: joins the second", async () => {
    const { step } = await run(null, { [A]: notFound, [B]: joined });
    expect(step).toEqual({ kind: "join", base: B, channel: CH });
  });

  it("planned hand-over with nothing joinable keeps the old channel (no retry)", async () => {
    const { step } = await run(A, { [A]: unreachable, [B]: unreachable }, true);
    expect(step).toEqual({ kind: "keep" });
  });

  it("a join that times out fails over like an unreachable backend", async () => {
    const { step, tried } = await run(A, { [A]: failedJoinOutcome("Máy chủ không phản hồi"), [B]: joined });
    expect(step).toEqual({ kind: "join", base: B, channel: CH });
    expect(tried).toEqual([A, B]);
  });

  it("another server error is terminal: shown at once, the others are not tried", async () => {
    const { step, tried } = await run(A, { [A]: failedJoinOutcome("Phòng đã đủ người"), [B]: joined });
    expect(step).toEqual({ kind: "error", error: "Phòng đã đủ người" });
    expect(tried).toEqual([A]);
  });

  it("stops at once when the hook was disposed mid-attempt", async () => {
    const { step, tried } = await run(null, { [A]: { kind: "cancelled" }, [B]: joined });
    expect(step).toEqual({ kind: "cancelled" });
    expect(tried).toEqual([A]);
  });
});
