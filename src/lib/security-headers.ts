/**
 * Response security headers for every route (`next.config.ts` → `headers()`), hardening plan T09.
 *
 * The CSP is sent as `Content-Security-Policy-Report-Only` for now: browsers report violations in DevTools but block
 * nothing. Enforcing it is a separate, reviewed change after a quiet observation period.
 *
 * Inline scripts: Next.js inlines its bootstrap/flight scripts and next-themes injects one for the theme, so
 * `script-src` keeps `'unsafe-inline'` (Next's documented "without nonces" setup). A nonce would force dynamic
 * rendering of every page; that was considered and not chosen (pages stay static and cached).
 *
 * `connect-src` lists only this origin and the two be_game backends, built exactly like `gameClient.ts` builds
 * them (NEXT_PUBLIC_TIENLEN_SERVER_URL / NEXT_PUBLIC_TIENLEN_FALLBACK_URL, inlined at build time), with their
 * ws:/wss: forms for the game sockets.
 */

type Env = Record<string, string | undefined>;

const cleanBase = (url: string | undefined) => (url ?? "").trim().replace(/\/$/, "");

/** Origins of the backends the client talks to, in gameClient's order (primary, then a distinct fallback). */
export function backendOrigins(env: Env): string[] {
  const primary = cleanBase(env.NEXT_PUBLIC_TIENLEN_SERVER_URL) || "http://localhost:4000";
  const fallback = cleanBase(env.NEXT_PUBLIC_TIENLEN_FALLBACK_URL);
  const bases = fallback && fallback !== primary ? [primary, fallback] : [primary];
  const origins: string[] = [];
  for (const base of bases) {
    let url: URL;
    try {
      url = new URL(base);
    } catch {
      continue; // a malformed value cannot be connected to anyway; never put it in the header
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    const ws = url.protocol === "https:" ? "wss:" : "ws:";
    origins.push(url.origin, `${ws}//${url.host}`);
  }
  return [...new Set(origins)];
}

/** The CSP as one header value. `dev` adds what `next dev` needs (eval for fast refresh). */
export function contentSecurityPolicy(env: Env, dev = env.NODE_ENV === "development"): string {
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])]],
    // Inline style attributes are everywhere (motion, computed positions, theme colours).
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'", ...backendOrigins(env)]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    // Report-Only cannot block framing; the self-hosted proxy already sends X-Frame-Options: SAMEORIGIN.
    ["frame-ancestors", ["'none'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

/** Headers for every route. */
export function securityHeaders(env: Env): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
}
