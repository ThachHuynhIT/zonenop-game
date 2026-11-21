/** Coalesces polls/manual refreshes so slow responses can finish and commit. */
export function createLatestRequest() {
  let generation = 0;
  let pending: Promise<void> | null = null;
  return {
    run<T>(request: () => Promise<T>, commit: (result: PromiseSettledResult<T>) => void): Promise<void> {
      if (pending) return pending;
      const started = generation;
      const operation = (async () => {
        let result: PromiseSettledResult<T>;
        try {
          result = { status: "fulfilled", value: await request() };
        } catch (reason) {
          result = { status: "rejected", reason };
        }
        if (started === generation) commit(result);
      })();
      const tracked = operation.finally(() => {
        // A previous effect's completion must not release its successor's slot.
        if (pending === tracked) pending = null;
      });
      pending = tracked;
      return tracked;
    },
    // Effect cleanup cancels commits, including during Strict Mode's setup/cleanup replay.
    invalidate() {
      generation++;
      pending = null;
    },
  };
}
