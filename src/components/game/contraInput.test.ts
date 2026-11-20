import { describe, expect, it } from "vitest";
import { bindContraInput } from "./contraInput";

function setup() {
  const target = new EventTarget();
  const visibility = Object.assign(new EventTarget(), { hidden: false });
  const keys: Record<string, boolean> = {};
  let focused = true;
  const dispose = bindContraInput(target, visibility, () => focused,
    (event, down) => { keys[event.key.toLowerCase()] = down; },
    () => { for (const key of Object.keys(keys)) delete keys[key]; });
  const key = (key: string, extra = {}) => target.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key, ...extra }));
  return { target, visibility, keys, key, dispose, focus: (value: boolean) => { focused = value; } };
}

describe("Contra keyboard ownership", () => {
  it("releases held movement and fire when the window loses focus", () => {
    const input = setup();
    input.key("ArrowRight"); input.key("j");
    expect(input.keys).toEqual({ arrowright: true, j: true });
    input.target.dispatchEvent(new Event("blur"));
    expect(input.keys).toEqual({});
    input.dispose();
  });
  it("releases held input when the document becomes hidden", () => {
    const input = setup(); input.key(" ");
    input.visibility.hidden = true;
    input.visibility.dispatchEvent(new Event("visibilitychange"));
    expect(input.keys).toEqual({}); input.dispose();
  });
  it("leaves Enter on links and forms outside the canvas untouched", () => {
    const input = setup(); input.focus(false);
    expect(input.key("Enter")).toBe(true);
    expect(input.keys).toEqual({}); input.dispose();
  });
  it("ignores browser shortcuts and repeated start/pause keys", () => {
    const input = setup();
    input.key("j", { ctrlKey: true }); input.key("Enter", { repeat: true });
    input.key("Escape", { repeat: true });
    expect(input.keys).toEqual({}); input.dispose();
  });
  it("handles Enter only while the game canvas owns focus", () => {
    const input = setup();
    expect(input.key("Enter")).toBe(false);
    expect(input.keys.enter).toBe(true);
    input.dispose();
  });
  it("still releases a key when keyup arrives after focus moved away", () => {
    const input = setup(); input.key("j"); input.focus(false);
    input.target.dispatchEvent(Object.assign(new Event("keyup"), { key: "j" }));
    expect(input.keys.j).toBe(false); input.dispose();
  });
  it("removes event handlers when unmounted", () => {
    const input = setup(); input.dispose(); input.key("j");
    expect(input.keys).toEqual({});
  });
});
