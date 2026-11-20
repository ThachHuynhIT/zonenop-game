import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
const h = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, effects: [] as { deps?: unknown[]; cleanup?: () => void }[], effectCursor: 0, scheduled: [] as (() => void)[] }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useId: () => "chat-test",
  useState: (initial: unknown) => {
    const index = h.cursor++;
    if (!(index in h.values)) h.values[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [h.values[index], (value: unknown) => { h.values[index] = typeof value === "function" ? (value as (previous: unknown) => unknown)(h.values[index]) : value; }];
  },
  useRef: (initial: unknown) => { const index = h.cursor++; return h.values[index] ??= { current: initial }; },
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
    const index = h.effectCursor++; const previous = h.effects[index];
    if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) {
      h.scheduled.push(() => { previous?.cleanup?.(); h.effects[index] = { deps, cleanup: effect() || undefined }; });
    }
  },
}));
import { ChatBox } from "./ChatBox";
import type { ChatMessage } from "@/lib/tienlen";
type Element = ReactElement<Record<string, unknown>>;
let tree: Element;
let messages: ChatMessage[];
let send: (text: string) => Promise<boolean>;
let focusCount: number;
let scrollCount: number;
const list = { scrollTop: 0, clientHeight: 200, scrollHeight: 200, scrollTo: () => { scrollCount++; } };
const input = { focus: () => { focusCount++; } };
function all(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(all);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...all(element.props.children)];
}
function find(match: (element: Element) => boolean) { const result = all(tree).find(match); if (!result) throw new Error("Missing rendered element"); return result; }
const label = (name: string) => find(element => element.props["aria-label"] === name);
const click = (element: Element) => (element.props.onClick as () => void)();
function render() {
  h.cursor = 0; h.effectCursor = 0;
  tree = ChatBox({ messages, meId: "me", onSend: text => send(text) }) as Element;
  for (const element of all(tree)) {
    const ref = element.props.ref as { current: unknown } | undefined;
    if (ref) ref.current = element.type === "input" ? input : list;
  }
  h.scheduled.splice(0).forEach(effect => effect());
}
function open() { click(label("Mở chat")); render(); }
function draft(value: string) { (label("Tin nhắn").props.onChange as (event: unknown) => void)({ target: { value } }); render(); }
const submit = () => (find(element => element.type === "form").props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
beforeEach(() => {
  h.values = []; h.effects = []; h.scheduled = []; messages = []; focusCount = 0; scrollCount = 0;
  list.scrollTop = 0; list.scrollHeight = 200; list.clientHeight = 200; send = async () => true; render();
});
afterEach(() => { h.effects.forEach(effect => effect.cleanup?.()); });
it("focuses only on opening, so new messages do not steal focus", () => {
  open(); expect(focusCount).toBe(1);
  messages = [{ id: "1", playerId: "other", name: "Minh", text: "Hi", at: 0 }]; render();
  expect(focusCount).toBe(1);
});
it("preserves scroll position when reading older messages", () => {
  open(); list.scrollHeight = 1000; list.scrollTop = 100;
  const log = find(element => !!element.props.ref && element.type === "div");
  (log.props.onScroll as (() => void) | undefined)?.();
  const before = scrollCount;
  messages = [{ id: "1", playerId: "other", name: "Minh", text: "Hi", at: 0 }]; render();
  expect(scrollCount).toBe(before);
});
it("clears pending and preserves a retryable draft when sending rejects", async () => {
  open(); draft("Hello"); send = async () => { throw new Error("offline"); };
  await expect(submit()).resolves.toBeUndefined(); render();
  expect(label("Tin nhắn").props.value).toBe("Hello");
  expect(find(element => element.type === "button" && element.props.type === "submit").props.disabled).toBe(false);
  expect(find(element => element.props.role === "alert").props.children).toBeTruthy();
});
it("announces unread count in the opener's accessible name and exposes a live message log", () => {
  messages = [{ id: "1", playerId: "other", name: "Minh", text: "Hi", at: 0 }]; render();
  expect(label("Mở chat, 1 tin nhắn chưa đọc").props["aria-expanded"]).toBe(false);
  click(label("Mở chat, 1 tin nhắn chưa đọc")); render();
  expect(find(element => element.props.role === "log").props["aria-live"]).toBe("polite");
});
