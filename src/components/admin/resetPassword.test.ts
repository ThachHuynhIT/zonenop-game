import { describe, expect, it } from "vitest";
import { resetPasswordState } from "./resetPassword";

const s = (pw: string, role: "user" | "admin" = "user", promote = false) => resetPasswordState(pw, role, promote);

describe("resetPasswordState", () => {
  it("is not ready when empty, and shows no error before typing", () => {
    expect(s("")).toEqual({ role: "user", problem: null, ready: false });
    expect(s("", "admin")).toEqual({ role: "admin", problem: null, ready: false });
  });

  it("blocks one character for both roles, with the policy message while typing", () => {
    expect(s("1")).toEqual({ role: "user", problem: "Mật khẩu cần ít nhất 8 ký tự", ready: false });
    expect(s("1", "admin")).toEqual({ role: "admin", problem: "Mật khẩu admin cần ít nhất 12 ký tự", ready: false });
  });

  it("user: 7 refused, 8 accepted", () => {
    expect(s("a".repeat(7)).ready).toBe(false);
    expect(s("a".repeat(8))).toEqual({ role: "user", problem: null, ready: true });
  });

  it("admin and promotion: 11 refused, 12 accepted", () => {
    expect(s("a".repeat(11), "admin").ready).toBe(false);
    expect(s("a".repeat(12), "admin").ready).toBe(true);
    expect(s("a".repeat(11), "user", true)).toMatchObject({ role: "admin", ready: false });
    expect(s("a".repeat(12), "user", true)).toEqual({ role: "admin", problem: null, ready: true });
  });

  it("72 accepted, 73 refused", () => {
    expect(s("a".repeat(72)).ready).toBe(true);
    expect(s("a".repeat(73))).toEqual({ role: "user", problem: "Mật khẩu dài tối đa 72 ký tự", ready: false });
  });

  it("counts NFC code points like the server (emoji and decomposed letters are one each)", () => {
    expect(s("😀".repeat(8)).ready).toBe(true);
    expect(s("ậ".repeat(7) + "b").ready).toBe(true);
    expect(s("😀".repeat(7)).ready).toBe(false);
  });
});
