import { describe, expect, it } from "vitest";
import { safeNext } from "./next";

describe("safeNext", () => {
  it("keeps internal paths", () => {
    expect(safeNext("/tien-len")).toBe("/tien-len");
    expect(safeNext("/tien-len/ABCD?x=1")).toBe("/tien-len/ABCD?x=1");
  });
  it("falls back to the hub for anything else", () => {
    for (const bad of ["//evil.com", "https://x", "", null, undefined, "/\\evil.com", "tien-len"]) expect(safeNext(bad)).toBe("/");
  });
});
