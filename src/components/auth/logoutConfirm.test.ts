import { describe, expect, it } from "vitest";
import { canConfirmLogout } from "./logoutConfirm";

describe("canConfirmLogout", () => {
  it("allows confirming only for the same session that opened the confirmation", () => {
    expect(canConfirmLogout({ session: "tok-a" }, "tok-a", false)).toBe(true);
  });

  it("refuses when nothing is pending (cancelled or never opened)", () => {
    expect(canConfirmLogout(null, "tok-a", false)).toBe(false);
  });

  it("refuses a second run while signing out", () => {
    expect(canConfirmLogout({ session: "tok-a" }, "tok-a", true)).toBe(false);
  });

  it("refuses a stale confirmation after the session was revoked or replaced", () => {
    expect(canConfirmLogout({ session: "tok-a" }, null, false)).toBe(false);
    expect(canConfirmLogout({ session: "tok-a" }, "tok-b", false)).toBe(false);
  });
});
