import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FX, DEFAULT_PREFS, MAX_PREFS_CHARS, PREFS_KEY, accountPrefs, parsePrefs, prefsFrom, prefsPatch, readPrefs } from "./prefs";

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

describe("prefsFrom", () => {
  it("validates an already-parsed value like parsePrefs does", () => {
    expect(prefsFrom({ actions: "bottom", view: "minimal", fx: { turn: false } })).toEqual({ actions: "bottom", view: "minimal", fx: { ...DEFAULT_FX, turn: false } });
    expect(prefsFrom(null)).toEqual(DEFAULT_PREFS);
    expect(prefsFrom("bottom")).toEqual(DEFAULT_PREFS);
    expect(prefsFrom([])).toEqual(DEFAULT_PREFS);
  });
});

describe("accountPrefs", () => {
  it("picks the typhu entry out of every game's prefs and validates it", () => {
    expect(accountPrefs({ ok: true, prefs: { typhu: { actions: "bottom", fx: { money: false, extra: 1 } }, meono: { x: 1 } } })).toEqual({
      actions: "bottom",
      view: "full",
      fx: { ...DEFAULT_FX, money: false },
    });
    expect(accountPrefs({ ok: true, prefs: { typhu: { view: "huge", actions: 3 } } })).toEqual(DEFAULT_PREFS);
  });
  it("is null when the account has no typhu entry yet, or the body is junk", () => {
    expect(accountPrefs({ ok: true, prefs: {} })).toBeNull();
    expect(accountPrefs({ ok: true, prefs: { meono: {} } })).toBeNull();
    expect(accountPrefs({ ok: true, prefs: { typhu: "bottom" } })).toBeNull();
    expect(accountPrefs({ ok: true, prefs: { typhu: [1] } })).toBeNull();
    expect(accountPrefs({ ok: true, prefs: [] })).toBeNull();
    expect(accountPrefs({ ok: true })).toBeNull();
    expect(accountPrefs(null)).toBeNull();
    expect(accountPrefs("x")).toBeNull();
  });
});

describe("prefsPatch", () => {
  it("sends only the known fields for typhu, within the server's size limit", () => {
    const junk = { ...DEFAULT_PREFS, view: "minimal", extra: "x".repeat(5000) } as unknown as typeof DEFAULT_PREFS;
    const body = prefsPatch(junk);
    expect(body).toEqual({ game: "typhu", prefs: { ...DEFAULT_PREFS, view: "minimal" } });
    expect(JSON.stringify(body!.prefs).length).toBeLessThanOrEqual(MAX_PREFS_CHARS);
  });
});
