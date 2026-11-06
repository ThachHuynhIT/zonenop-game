import { describe, expect, it } from "vitest";
import { backendOrigins, contentSecurityPolicy, securityHeaders } from "./security-headers";

const PROD = {
  NODE_ENV: "production",
  NEXT_PUBLIC_TIENLEN_SERVER_URL: "https://play-api.fudio101.com",
  NEXT_PUBLIC_TIENLEN_FALLBACK_URL: "https://be-game-omega.vercel.app/",
};
const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(name + " "));

describe("backendOrigins", () => {
  it("lists primary then fallback, each with its socket origin", () => {
    expect(backendOrigins(PROD)).toEqual([
      "https://play-api.fudio101.com",
      "wss://play-api.fudio101.com",
      "https://be-game-omega.vercel.app",
      "wss://be-game-omega.vercel.app",
    ]);
  });

  it("matches gameClient: local default, no duplicate fallback, http becomes ws", () => {
    expect(backendOrigins({})).toEqual(["http://localhost:4000", "ws://localhost:4000"]);
    expect(backendOrigins({ NEXT_PUBLIC_TIENLEN_SERVER_URL: "https://a.example", NEXT_PUBLIC_TIENLEN_FALLBACK_URL: "https://a.example/" })).toEqual([
      "https://a.example",
      "wss://a.example",
    ]);
  });

  it("keeps only the origin and drops values that are not http(s) URLs", () => {
    expect(backendOrigins({ NEXT_PUBLIC_TIENLEN_SERVER_URL: "https://a.example:8443/api/" })).toEqual(["https://a.example:8443", "wss://a.example:8443"]);
    expect(backendOrigins({ NEXT_PUBLIC_TIENLEN_SERVER_URL: "not a url; script-src *" })).toEqual([]);
    expect(backendOrigins({ NEXT_PUBLIC_TIENLEN_SERVER_URL: "javascript:alert(1)" })).toEqual([]);
  });
});

describe("contentSecurityPolicy", () => {
  const csp = contentSecurityPolicy(PROD);

  it("allows connections only to this origin and the two backends", () => {
    expect(directive(csp, "connect-src")).toBe(
      "connect-src 'self' https://play-api.fudio101.com wss://play-api.fudio101.com https://be-game-omega.vercel.app wss://be-game-omega.vercel.app",
    );
  });

  it("locks down plugins, base URL, forms and framing", () => {
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
  });

  it("has no wildcard, no eval and no localhost in production", () => {
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)|https?:\/\/\*|unsafe-eval|localhost/);
    expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
  });

  it("adds eval only in development", () => {
    expect(directive(contentSecurityPolicy({ NODE_ENV: "development" }), "script-src")).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("is well-formed: one value per directive, no duplicates, no stray characters", () => {
    const names = csp.split("; ").map((d) => d.split(" ")[0]);
    expect(new Set(names).size).toBe(names.length);
    expect(csp).not.toMatch(/[\n,]/);
  });
});

describe("securityHeaders", () => {
  it("sends the CSP as Report-Only, plus nosniff and a referrer policy", () => {
    expect(securityHeaders(PROD).map((h) => h.key)).toEqual(["Content-Security-Policy-Report-Only", "X-Content-Type-Options", "Referrer-Policy"]);
    expect(securityHeaders(PROD).find((h) => h.key === "X-Content-Type-Options")!.value).toBe("nosniff");
    expect(securityHeaders(PROD).find((h) => h.key === "Referrer-Policy")!.value).toBe("strict-origin-when-cross-origin");
  });
});
