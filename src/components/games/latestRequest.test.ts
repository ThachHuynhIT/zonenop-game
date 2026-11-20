import { describe, expect, it } from "vitest";
import { createLatestRequest } from "./latestRequest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("coalesced room-list refresh", () => {
  it("commits a slow response despite repeated poll/manual triggers and makes only one request", async () => {
    const requests = createLatestRequest();
    const slow = deferred<string[]>();
    const subsequent = deferred<string[]>();
    let calls = 0;
    let rooms: string[] = [];
    let commits = 0;
    const request = () => (++calls === 1 ? slow.promise : subsequent.promise);
    const commit = (result: PromiseSettledResult<string[]>) => {
      commits++;
      if (result.status === "fulfilled") rooms = result.value;
    };
    const initial = requests.run(request, commit);
    // The network response remains pending across multiple polling intervals.
    const poll = requests.run(request, commit);
    const manual = requests.run(request, commit);
    const nextPoll = requests.run(request, commit);

    slow.resolve(["FIRST"]);
    await initial;

    expect(rooms).toEqual(["FIRST"]);
    expect(calls).toBe(1);
    expect(poll).toBe(initial);
    expect(manual).toBe(initial);
    expect(nextPoll).toBe(initial);
    expect(commits).toBe(1);
  });

  it("releases a rejected request so retry can clear the warning and update rooms", async () => {
    const requests = createLatestRequest();
    const failed = deferred<string[]>();
    let rooms = ["SAVED"];
    let warning = false;
    let loading = true;
    const commit = (result: PromiseSettledResult<string[]>) => {
      if (result.status === "fulfilled") rooms = result.value;
      warning = result.status === "rejected";
      loading = false;
    };
    const first = requests.run(() => failed.promise, commit);
    failed.reject(new Error("network failure"));
    await first;
    expect(rooms).toEqual(["SAVED"]);
    expect(warning).toBe(true);
    expect(loading).toBe(false);

    loading = true;
    await requests.run(async () => ["RETRY"], commit);
    expect(rooms).toEqual(["RETRY"]);
    expect(warning).toBe(false);
    expect(loading).toBe(false);
  });

  it("old cleanup cannot release a newer setup's pending request", async () => {
    const requests = createLatestRequest();
    const older = deferred<string[]>();
    const newer = deferred<string[]>();
    const extra = deferred<string[]>();
    const committed: string[][] = [];
    const commit = (result: PromiseSettledResult<string[]>) => {
      if (result.status === "fulfilled") committed.push(result.value);
    };
    let calls = 0;
    const request = () => [older.promise, newer.promise, extra.promise][calls++];
    const oldSetup = requests.run(request, commit);
    requests.invalidate();
    const newSetup = requests.run(request, commit);

    older.resolve(["OLD"]);
    await oldSetup;
    expect(committed).toEqual([]);

    const poll = requests.run(request, commit);
    expect(poll).toBe(newSetup);
    expect(calls).toBe(2);
    newer.resolve(["NEW"]);
    await newSetup;
    expect(committed).toEqual([["NEW"]]);
  });

  it.each(["success", "failure"])("ignores an invalidated old %s after the newer setup commits", async (outcome) => {
    const requests = createLatestRequest();
    const older = deferred<string[]>();
    let rooms: string[] = [];
    let warning = false;
    const commit = (result: PromiseSettledResult<string[]>) => {
      if (result.status === "fulfilled") rooms = result.value;
      warning = result.status === "rejected";
    };
    const oldSetup = requests.run(() => older.promise, commit);
    requests.invalidate();
    await requests.run(async () => ["NEW"], commit);

    if (outcome === "success") older.resolve(["OLD"]);
    else older.reject(new Error("old network failure"));
    await oldSetup;
    expect(rooms).toEqual(["NEW"]);
    expect(warning).toBe(false);
  });
});
