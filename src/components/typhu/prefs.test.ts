import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs } from "./prefs";

describe("parsePrefs", () => {
  it("defaults to actions in the centre", () => {
    expect(DEFAULT_PREFS).toEqual({ actions: "center" });
    expect(PREFS_KEY).toBe("typhu:prefs");
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
  });
  it("reads a saved bottom bar", () => {
    expect(parsePrefs(JSON.stringify({ actions: "bottom" }))).toEqual({ actions: "bottom" });
  });
  it("ignores broken JSON and unknown values", () => {
    expect(parsePrefs("{oops")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify({ actions: "left" }))).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify([1, 2]))).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("null")).toEqual(DEFAULT_PREFS);
  });
});
