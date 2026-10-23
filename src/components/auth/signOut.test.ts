import { afterEach, describe, expect, it, vi } from "vitest";
import { setSignOutReason, takeSignOutReason, signOutMessage } from "./session";

afterEach(() => vi.unstubAllGlobals());

describe("sign-out reasons", () => {
  it.each(["replaced", "revoked"] as const)("reads %s once then removes it", (reason) => {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    setSignOutReason(reason);
    expect(values.get("games:signOutReason")).toBe(reason);
    expect(takeSignOutReason()).toBe(reason);
    expect(takeSignOutReason()).toBeNull();
  });

  it("does not throw when storage is blocked", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    });
    expect(() => setSignOutReason("revoked")).not.toThrow();
    expect(takeSignOutReason()).toBeNull();
  });

  it("discards unknown values", () => {
    const removeItem = vi.fn();
    vi.stubGlobal("sessionStorage", { getItem: () => "unknown", removeItem });
    expect(takeSignOutReason()).toBeNull();
    expect(removeItem).toHaveBeenCalledWith("games:signOutReason");
  });

  it("explains whether the seat or session was replaced", () => {
    expect(signOutMessage("replaced")).toBe("Tài khoản của bạn vừa vào bàn từ thiết bị khác.");
    expect(signOutMessage("revoked")).toBe("Tài khoản của bạn vừa đăng nhập ở thiết bị khác, phiên này đã kết thúc.");
  });
});
