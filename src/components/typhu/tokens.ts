import { PROFILE_COLORS, type PlayerProfile } from "@/components/games/gameClient";

export interface Token {
  emoji: string;
  color: string;
}

/** Small stable hash, so every viewer derives the same replacement colour for a seat. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Each seat's token on the board: the look the player picked on the site (their icon on their colour, or the name's first
 * letter without an icon); a seat without a look keeps `fallback` (its in-game piece). Seats are taken in order, so when two
 * players wear the same colour the later seat gets a free colour instead, chosen from its id: the same on every screen.
 */
export function seatTokens(
  seats: readonly { id: string; name: string }[],
  looks: Record<string, PlayerProfile>,
  fallback: (id: string) => Token,
): Map<string, Token> {
  const out = new Map<string, Token>();
  const used = new Set<string>();
  for (const seat of seats) {
    const look = looks[seat.name];
    const base = look ? { emoji: look.icon || seat.name.charAt(0).toUpperCase(), color: look.color } : fallback(seat.id);
    let color = base.color;
    if (used.has(color)) {
      const free = PROFILE_COLORS.filter((c) => !used.has(c));
      if (free.length) color = free[hash(seat.id) % free.length];
    }
    used.add(color);
    out.set(seat.id, { emoji: base.emoji, color });
  }
  return out;
}

/** How much of the player's colour the turn banner keeps when it darkens it with black (`color-mix`, see `TurnBanner`). */
export const BANNER_SHADE = 0.75;

/**
 * Text colour that reads best on a player's colour darkened to `shade` (white or near-black, by WCAG contrast). An
 * approximation of the `color-mix(in oklab, …, black)` the band uses, close enough to pick a side. Not a #rrggbb: white.
 */
export function inkOn(color: string, shade = BANNER_SHADE): "#ffffff" | "#0f172a" {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = ((c / 255) * shade);
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const dark = 0.0137; // #0f172a
  return 1.05 / (l + 0.05) >= (l + 0.05) / (dark + 0.05) ? "#ffffff" : "#0f172a";
}
