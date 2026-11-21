const GAME_KEYS = new Set([
  "arrowleft", "arrowright", "arrowup", "arrowdown",
  "a", "d", "w", "s", " ", "j", "z", "x", "enter", "escape",
]);

/** The focused canvas owns input; losing focus must never leave a held key behind. */
export function bindContraInput(
  target: EventTarget,
  visibility: EventTarget & { hidden: boolean },
  focused: () => boolean,
  onKey: (event: KeyboardEvent, down: boolean) => void,
  clear: () => void,
) {
  const handle = (event: Event, down: boolean) => {
    const keyEvent = event as KeyboardEvent;
    const key = keyEvent.key.toLowerCase();
    if (!GAME_KEYS.has(key)) return;
    if (down && (!focused() || visibility.hidden || keyEvent.ctrlKey || keyEvent.metaKey || keyEvent.altKey)) return;
    if (down && keyEvent.repeat && (key === "enter" || key === "escape")) return;
    if (focused()) keyEvent.preventDefault();
    onKey(keyEvent, down);
  };
  const down = (event: Event) => handle(event, true);
  const up = (event: Event) => handle(event, false);
  const hidden = () => { if (visibility.hidden) clear(); };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("blur", clear);
  visibility.addEventListener("visibilitychange", hidden);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
    target.removeEventListener("blur", clear);
    visibility.removeEventListener("visibilitychange", hidden);
    clear();
  };
}
