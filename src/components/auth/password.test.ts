import { describe, expect, it } from "vitest";
import { ADMIN_PASSWORD_MIN, PASSWORD_MAX, PASSWORD_MIN, passwordHint, passwordLength, passwordMin, passwordProblem } from "./password";

const pw = (n: number) => "a".repeat(n);

describe("passwordLength", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(passwordLength("😼😼")).toBe(2);
    expect(passwordLength("mậtkhẩu")).toBe(7);
  });
  it("counts after NFC, like the server: a decomposed letter is one character", () => {
    expect("ậ".normalize("NFD").length).toBe(3);
    expect(passwordLength("ậ".repeat(PASSWORD_MIN).normalize("NFD"))).toBe(PASSWORD_MIN);
  });
});

describe("passwordProblem (be_game D1-b: user 8–72, admin 12–72)", () => {
  it("uses the same numbers as the server", () => {
    expect([PASSWORD_MIN, ADMIN_PASSWORD_MIN, PASSWORD_MAX]).toEqual([8, 12, 72]);
  });

  it.each([
    ["user", PASSWORD_MIN],
    ["admin", ADMIN_PASSWORD_MIN],
  ] as const)("%s: empty and min-1 refused; min and max accepted; max+1 refused", (role, min) => {
    expect(passwordProblem("", role)).toBe("Mật khẩu không được để trống");
    expect(passwordProblem(pw(min - 1), role)).not.toBeNull();
    expect(passwordProblem(pw(min), role)).toBeNull();
    expect(passwordProblem(pw(PASSWORD_MAX), role)).toBeNull();
    expect(passwordProblem(pw(PASSWORD_MAX + 1), role)).toBe("Mật khẩu dài tối đa 72 ký tự");
  });

  it("explains which minimum applies", () => {
    expect(passwordProblem("1234567")).toBe("Mật khẩu cần ít nhất 8 ký tự");
    expect(passwordProblem(pw(11), "admin")).toBe("Mật khẩu admin cần ít nhất 12 ký tự");
  });

  it("defaults to the ordinary account rule", () => {
    expect(passwordProblem(pw(8))).toBeNull();
    expect(passwordMin()).toBe(8);
  });

  it("counts emoji and NFD input the way the server does", () => {
    expect(passwordProblem("😼".repeat(PASSWORD_MIN))).toBeNull();
    expect(passwordProblem("😼".repeat(PASSWORD_MIN - 1))).not.toBeNull();
    expect(passwordProblem("😼".repeat(PASSWORD_MAX))).toBeNull(); // 144 UTF-16 units
    expect(passwordProblem("ậ".repeat(PASSWORD_MIN - 1).normalize("NFD"))).not.toBeNull(); // 21 NFD code points, 7 characters
  });

  it("hints the range for the role", () => {
    expect(passwordHint()).toBe("8–72 ký tự.");
    expect(passwordHint("admin")).toBe("12–72 ký tự.");
  });
});
