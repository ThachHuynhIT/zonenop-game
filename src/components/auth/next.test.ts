import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps internal paths", () => {
    expect(safeNext("/tien-len")).toBe("/tien-len");
    expect(safeNext("/tien-len/ABCD?x=1")).toBe("/tien-len/ABCD?x=1");
  });
  it("falls back to the hub for anything else", () => {
    const bad = ["//evil.com", "https://x", "", null, undefined, "/\\evil.com", "tien-len", "/\t/evil.com", "/\n/evil.com", "/\r//evil", "/dang-nhap", "/dang-nhap?next=/x"];
    for (const b of bad) expect(safeNext(b)).toBe("/");
  });
  it("never returns a protocol-relative result", () => {
    expect(safeNext("/%09/evil.com").startsWith("//")).toBe(false);
  });
});
