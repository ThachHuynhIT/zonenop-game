import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FX, DEFAULT_PREFS, PREFS_KEY, parsePrefs, readPrefs } from "./prefs";

describe("parsePrefs", () => {
  it("defaults to actions in the centre and the full view", () => {
    expect(DEFAULT_PREFS).toEqual({ actions: "center", view: "full", fx: DEFAULT_FX });
    expect(DEFAULT_FX).toEqual({ money: true, turn: true, flag: true, end: true });
    expect(PREFS_KEY).toBe("typhu:prefs");
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
  });
  it("reads a saved bottom bar (older saves have no view: full)", () => {
    expect(parsePrefs(JSON.stringify({ actions: "bottom" }))).toEqual({ actions: "bottom", view: "full", fx: DEFAULT_FX });
  });
  it("reads a saved minimal view, each field on its own", () => {
    expect(parsePrefs(JSON.stringify({ view: "minimal" }))).toEqual({ actions: "center", view: "minimal", fx: DEFAULT_FX });
    expect(parsePrefs(JSON.stringify({ actions: "bottom", view: "minimal" }))).toEqual({ actions: "bottom", view: "minimal", fx: DEFAULT_FX });
    expect(parsePrefs(JSON.stringify({ actions: "bottom", view: "tiny" }))).toEqual({ actions: "bottom", view: "full", fx: DEFAULT_FX });
  });
  it("reads the effect switches; older saves without fx keep every effect on", () => {
    expect(parsePrefs(JSON.stringify({ actions: "bottom", fx: { money: false, end: false } }))).toEqual({
      actions: "bottom",
      view: "full",
      fx: { money: false, turn: true, flag: true, end: false },
    });
    expect(parsePrefs(JSON.stringify({ fx: { money: false, turn: false, flag: false, end: false } })).fx).toEqual({ money: false, turn: false, flag: false, end: false });
  });
  it("only an explicit false turns an effect off", () => {
    expect(parsePrefs(JSON.stringify({ fx: { money: 0, turn: "no", flag: null } })).fx).toEqual(DEFAULT_FX);
    expect(parsePrefs(JSON.stringify({ fx: "off" })).fx).toEqual(DEFAULT_FX);
    expect(parsePrefs(JSON.stringify({ fx: [false] })).fx).toEqual(DEFAULT_FX);
  });
  it("ignores broken JSON and unknown values", () => {
    expect(parsePrefs("{oops")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify({ actions: "left" }))).toEqual(DEFAULT_PREFS);
    expect(parsePrefs(JSON.stringify([1, 2]))).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("null")).toEqual(DEFAULT_PREFS);
  });
});

describe("readPrefs", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("reads the saved prefs from localStorage", () => {
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === PREFS_KEY ? JSON.stringify({ actions: "bottom" }) : null) });
    expect(readPrefs()).toEqual({ actions: "bottom", view: "full", fx: DEFAULT_FX });
  });
  it("falls back to the defaults when storage is missing or blocked", () => {
    expect(readPrefs()).toEqual(DEFAULT_PREFS); // node: no localStorage at all
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(readPrefs()).toEqual(DEFAULT_PREFS);
  });
});
