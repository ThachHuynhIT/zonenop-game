import { describe, expect, it } from "vitest";
import { passwordLength, passwordProblem } from "./password";

describe("passwordLength", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(passwordLength("😼😼")).toBe(2);
    expect(passwordLength("mậtkhẩu")).toBe(7);
  });
});

describe("passwordProblem", () => {
  it("accepts 1–72 characters", () => {
    expect(passwordProblem("a")).toBeNull();
    expect(passwordProblem("😼".repeat(72))).toBeNull(); // 144 UTF-16 units
  });
  it("rejects empty and too long", () => {
    expect(passwordProblem("")).toBe("Mật khẩu không được để trống");
    expect(passwordProblem("a".repeat(73))).toBe("Mật khẩu dài tối đa 72 ký tự");
  });
});
