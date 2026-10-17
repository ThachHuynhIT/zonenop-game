export const MAX_PATH = 200;

/** Path sent with a page-view beacon: no query or hash, at most 200 chars. */
export function trackPayload(pathname: string): string {
  const path = String(pathname ?? "").split(/[?#]/, 1)[0];
  return (path || "/").slice(0, MAX_PATH);
}
