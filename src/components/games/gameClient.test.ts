import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApi } from "./gameClient";

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

  it("does not share a failed request", async () => {
    const path = "/api/fail-test/rooms";
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) }).mockResolvedValueOnce(ok({ rooms: [1] }));

    await expect(fetchApi(path)).rejects.toThrow("HTTP 503");
    await expect(fetchApi(path)).resolves.toEqual({ rooms: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
