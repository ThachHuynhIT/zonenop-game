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
