const BASE = "http://x";
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

/** Where to go after signing in: only same-site paths; anything else (absolute URLs, "//host", tab/newline tricks, the sign-in page itself) is the hub. */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/") || CONTROL_OR_BACKSLASH.test(next)) return "/";
  let u: URL;
  try {
    u = new URL(next, BASE);
  } catch {
    return "/";
  }
  if (u.origin !== BASE || u.pathname.startsWith("//") || u.pathname.startsWith("/dang-nhap")) return "/";
  return u.pathname + u.search + u.hash;
}
