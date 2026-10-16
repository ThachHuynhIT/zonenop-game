export interface LeaderRow {
  name: string;
  points: number;
  games: number;
  wins: number;
  icon: string;
  color: string;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Normalise a leaderboard payload: `{season, rows}` (current season), `{players}` or a bare array (old format). */
export function toLeaderRows(payload: unknown): LeaderRow[] {
  const p = payload as { rows?: unknown; players?: unknown } | null;
  const list = Array.isArray(payload) ? payload : Array.isArray(p?.rows) ? p.rows : Array.isArray(p?.players) ? p.players : [];
  const out: LeaderRow[] = [];
  for (const r of list as Record<string, unknown>[]) {
    if (!r || typeof r.name !== "string") continue;
    out.push({ name: r.name, points: num(r.points), games: num(r.games), wins: num(r.wins), icon: str(r.icon), color: str(r.color) });
  }
  return out;
}
