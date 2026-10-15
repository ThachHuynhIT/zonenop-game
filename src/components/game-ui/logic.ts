/** Pure helpers behind the game-ui components (tested in node, no DOM). */

/** A confirm button disarms itself after this long without the second press. */
export const CONFIRM_RESET_MS = 3500;

/** Two-press confirm: the first press arms, the second fires (and disarms). */
export function confirmStep(armed: boolean): { fire: boolean; armed: boolean } {
  return armed ? { fire: true, armed: false } : { fire: false, armed: true };
}

/** A countdown turns urgent once this share of the turn is left. */
export const URGENT_FRACTION = 0.25;

/** Time left on a turn. Bad input (past or NaN deadline, total ≤ 0) reads as an expired, urgent timer. */
export function countdownState(deadline: number, total: number, now: number) {
  const remainingMs = Number.isFinite(deadline) && Number.isFinite(now) ? Math.max(0, deadline - now) : 0;
  const fraction = total > 0 ? Math.min(1, remainingMs / total) : 0;
  return { remainingMs, fraction, urgent: fraction <= URGENT_FRACTION };
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG 2.x contrast ratio between two sRGB colours (0–255 channels), 1…21. */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
