import { describe, expect, it } from "vitest";
import { passwordLength, passwordProblem } from "./password";

describe("passwordLength", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(passwordLength("😼😼")).toBe(2);
    expect(passwordLength("mậtkhẩu")).toBe(7);
  });
});

describe("passwordProblem", () => {
  it("accepts 8–72 characters", () => {
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("😼".repeat(72))).toBeNull(); // 144 UTF-16 units
  });
  it("rejects too short and too long", () => {
    expect(passwordProblem("😼".repeat(7))).toBe("Mật khẩu cần ít nhất 8 ký tự");
    expect(passwordProblem("a".repeat(73))).toBe("Mật khẩu dài tối đa 72 ký tự");
  });
});
