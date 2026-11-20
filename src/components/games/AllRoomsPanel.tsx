"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PixelIcon } from "@/components/game-ui";
import styles from "./AllRoomsPanel.module.scss";
import { fetchApi, pollWhileVisible } from "./gameClient";
import { ONLINE_GAMES, type OnlineGame } from "./gamesRegistry";
import { createLatestRequest } from "./latestRequest";

/** Poll all online games less often than a single game's lobby. */
const REFRESH_MS = 20_000;

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
  const [roomsRequest] = useState(createLatestRequest);

  const load = useCallback(async () => {
    setLoading(true);
    await roomsRequest.run(
      () => Promise.allSettled(ONLINE_GAMES.map((g) => fetchApi<{ rooms: RoomRow[] }>(g.roomsPath))),
      (result) => {
        if (result.status === "fulfilled") {
          const results = result.value;
          setRooms((prev) => {
            const next: Rooms = { ...prev };
            results.forEach((r, i) => {
              // A failing game keeps its last known list instead of flickering empty.
              if (r.status === "fulfilled") next[ONLINE_GAMES[i].id] = Array.isArray(r.value.rooms) ? r.value.rooms : [];
            });
            return next;
          });
          setFailed(results.flatMap((r, i) => (r.status === "rejected" ? [ONLINE_GAMES[i].id] : [])));
        } else {
          setFailed(ONLINE_GAMES.map((g) => g.id));
        }
        setLoading(false);
      },
    );
  }, [roomsRequest]);

  useEffect(() => {
    const stop = pollWhileVisible(() => void load(), REFRESH_MS);
    return () => {
      stop();
      roomsRequest.invalidate();
    };
  }, [load, roomsRequest]);

  const rows = useMemo(() => {
    if (!rooms) return [];
    const list = ONLINE_GAMES.flatMap((g) => (rooms[g.id] ?? []).map((room) => ({ game: g, room })));
    const rank = (x: (typeof list)[number]) => (x.game.id === currentGame ? 0 : 2) + (x.room.status === "waiting" ? 0 : 1);
    return list.filter((x) => filter === "all" || x.game.id === filter).sort((a, b) => rank(a) - rank(b));
  }, [rooms, filter, currentGame]);

  const countOf = (id: GameId) => rooms?.[id]?.length ?? 0;
  const total = ONLINE_GAMES.reduce((n, g) => n + countOf(g.id), 0);

  return (
    <section className={cn(styles.panel, className)} aria-label="Bàn đang mở của mọi game">
      <div className={styles.heading}>
        <h2 className={styles.title}>
          <span className={styles.signal} aria-hidden>
            <span className={styles.signalBack} />
            <span className={styles.signalDot} />
          </span>
          Bàn đang mở
          {total > 0 && <span className={styles.total}>{total}</span>}
        </h2>
        <button
          onClick={() => void load()}
          disabled={loading}
          className={styles.refresh}
          title="Tự cập nhật mỗi 20 giây khi trang đang hiển thị"
        >
          <span className={cn("inline-block", loading && "motion-safe:animate-spin")}>↻</span> Làm mới
        </button>
      </div>

      <div className={styles.filters}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Tất cả
        </FilterChip>
        {ONLINE_GAMES.map((g) => (
          <FilterChip key={g.id} active={filter === g.id} onClick={() => setFilter(g.id)} title={g.title}>
            <PixelIcon name={g.id} className={styles.filterIcon} /> {g.short}
            {countOf(g.id) > 0 && <span className={styles.muted}>{countOf(g.id)}</span>}
          </FilterChip>
        ))}
      </div>

      {rooms === null ? (
        <p className={styles.loading}>Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className={styles.empty}>
          {failed.length === ONLINE_GAMES.length ? "Không kết nối được máy chủ game." : "Chưa có bàn nào đang mở. Tạo bàn mới và mời bạn bè nhé!"}
        </p>
      ) : (
        <ul className={styles.rooms}>
          {rows.map(({ game, room }) => {
            const full = room.players.length >= game.maxPlayers;
            const canJoin = room.status === "waiting" && !full;
            return (
              <li
                key={`${game.id}-${room.code}`}
                className={cn(styles.room, game.id === currentGame && styles.current)}
              >
                <div className={styles.row}>
                  <span className={styles.icon} aria-hidden>
                    <PixelIcon name={game.id} />
                  </span>
                  <div className={styles.info}>
                    <p className={styles.roomHeading}>
                      <span className={styles.gameTitle}>{game.short}</span>
                      <span className={styles.code}>{room.code}</span>
                    </p>
                    <p className={styles.names} title={room.players.map((p) => p.name).join(", ")}>
                      {room.players.map((p) => p.name).join(", ") || "Chưa có ai"}
                    </p>
                  </div>
                  <div className={styles.status}>
                    <span
                      className={cn(
                        styles.badge,
                        room.status === "playing" ? styles.playing : styles.waiting,
                      )}
                    >
                      {room.status === "playing" ? "Đang chơi" : "Đang chờ"}
                    </span>
                    <span className={styles.count}>
                      👥 {room.players.length}/{game.maxPlayers}
                      {!!room.spectators && ` · 👀 ${room.spectators}`}
                    </span>
                  </div>
                </div>
                <div className={styles.actions}>
                  {canJoin && (
                    <Link
                      href={`${game.href}/${room.code}`}
                      className={styles.join}
                    >
                      Vào chơi
                    </Link>
                  )}
                  <Link
                    href={`${game.href}/${room.code}?watch=1`}
                    className={styles.watch}
                  >
                    👀 Xem
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {failed.length > 0 && (
        <p role="status" className={styles.warning}>
          Chưa cập nhật được: {failed.map((id) => ONLINE_GAMES.find((g) => g.id === id)?.short).join(", ")}. Danh sách giữ dữ liệu lần tải gần nhất; thử Làm mới để kết nối lại.
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
        styles.filter,
        active && styles.active,
      )}
    >
      {children}
    </button>
  );
}
