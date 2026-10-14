"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fetchApi } from "./gameClient";
import { ONLINE_GAMES, type OnlineGame } from "./gamesRegistry";

const REFRESH_MS = 10_000;

interface RoomRow {
  code: string;
  status: "waiting" | "playing";
  players: { name: string; connected?: boolean }[];
  spectators?: number;
}

type GameId = OnlineGame["id"];
type Rooms = Partial<Record<GameId, RoomRow[]>>;

/** Open tables of every online game, polled from each game's rooms endpoint. */
export function AllRoomsPanel({ currentGame, className }: { currentGame?: GameId | null; className?: string }) {
  const [rooms, setRooms] = useState<Rooms | null>(null);
  const [failed, setFailed] = useState<GameId[]>([]);
  const [filter, setFilter] = useState<GameId | "all">("all");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(ONLINE_GAMES.map((g) => fetchApi<{ rooms: RoomRow[] }>(g.roomsPath)));
    setRooms((prev) => {
      const next: Rooms = { ...prev };
      results.forEach((r, i) => {
        // A failing game keeps its last known list instead of flickering empty.
        if (r.status === "fulfilled") next[ONLINE_GAMES[i].id] = Array.isArray(r.value.rooms) ? r.value.rooms : [];
      });
      return next;
    });
    setFailed(results.flatMap((r, i) => (r.status === "rejected" ? [ONLINE_GAMES[i].id] : [])));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const rows = useMemo(() => {
    if (!rooms) return [];
    const list = ONLINE_GAMES.flatMap((g) => (rooms[g.id] ?? []).map((room) => ({ game: g, room })));
    const rank = (x: (typeof list)[number]) => (x.game.id === currentGame ? 0 : 2) + (x.room.status === "waiting" ? 0 : 1);
    return list.filter((x) => filter === "all" || x.game.id === filter).sort((a, b) => rank(a) - rank(b));
  }, [rooms, filter, currentGame]);

  const countOf = (id: GameId) => rooms?.[id]?.length ?? 0;
  const total = ONLINE_GAMES.reduce((n, g) => n + countOf(g.id), 0);

  return (
    <section className={cn("rounded-2xl border border-white/10 bg-black/35 p-4 text-white backdrop-blur", className)} aria-label="Bàn đang mở của mọi game">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-amber-300">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Bàn đang mở
          {total > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">{total}</span>}
        </h2>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md px-2 py-1 text-xs text-white/60 transition-colors max-sm:min-h-8 hover:bg-white/10 hover:text-white disabled:opacity-50"
          title="Làm mới (tự cập nhật mỗi 10 giây)"
        >
          <span className={cn("inline-block", loading && "motion-safe:animate-spin")}>↻</span> Làm mới
        </button>
      </div>

      <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Tất cả
        </FilterChip>
        {ONLINE_GAMES.map((g) => (
          <FilterChip key={g.id} active={filter === g.id} onClick={() => setFilter(g.id)} title={g.title}>
            <span aria-hidden>{g.emoji}</span> {g.short}
            {countOf(g.id) > 0 && <span className="text-white/50">{countOf(g.id)}</span>}
          </FilterChip>
        ))}
      </div>

      {rooms === null ? (
        <p className="text-sm text-white/60 motion-safe:animate-pulse">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-black/25 p-4 text-center text-sm text-white/60">
          {failed.length === ONLINE_GAMES.length ? "Không kết nối được máy chủ game." : "Chưa có bàn nào đang mở. Tạo bàn mới và mời bạn bè nhé!"}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ game, room }) => {
            const full = room.players.length >= game.maxPlayers;
            const canJoin = room.status === "waiting" && !full;
            return (
              <li
                key={`${game.id}-${room.code}`}
                className={cn("rounded-xl border border-white/5 bg-black/25 p-2.5", game.id === currentGame && "border-amber-300/20")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none" aria-hidden>
                    {game.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm">
                      <span className="truncate font-semibold text-white/90">{game.short}</span>
                      <span className="font-mono text-xs font-bold tracking-[0.15em] text-amber-300">{room.code}</span>
                    </p>
                    <p className="truncate text-xs text-white/55" title={room.players.map((p) => p.name).join(", ")}>
                      {room.players.map((p) => p.name).join(", ") || "Chưa có ai"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        room.status === "playing" ? "bg-rose-500/25 text-rose-200" : "bg-emerald-500/25 text-emerald-200",
                      )}
                    >
                      {room.status === "playing" ? "Đang chơi" : "Đang chờ"}
                    </span>
                    <span className="text-[11px] text-white/55">
                      👥 {room.players.length}/{game.maxPlayers}
                      {!!room.spectators && ` · 👀 ${room.spectators}`}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-1.5">
                  {canJoin && (
                    <Link
                      href={`${game.href}/${room.code}`}
                      className="inline-flex items-center rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold max-sm:min-h-9 max-sm:px-4 text-black transition-colors hover:bg-amber-300"
                    >
                      Vào chơi
                    </Link>
                  )}
                  <Link
                    href={`${game.href}/${room.code}?watch=1`}
                    className="inline-flex items-center rounded-md border border-white/20 px-3 py-1 text-xs text-white/90 max-sm:min-h-9 max-sm:px-4 transition-colors hover:bg-white/10"
                  >
                    👀 Xem
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {failed.length > 0 && failed.length < ONLINE_GAMES.length && (
        <p className="mt-3 text-[11px] text-white/40">
          Chưa tải được: {failed.map((id) => ONLINE_GAMES.find((g) => g.id === id)?.short).join(", ")}
        </p>
      )}
    </section>
  );
}

function FilterChip({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors max-sm:min-h-8",
        active ? "border-amber-300/60 bg-amber-400/15 text-amber-100" : "border-white/10 text-white/70 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}
