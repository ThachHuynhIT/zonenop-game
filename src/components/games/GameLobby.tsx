"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeltaBadge } from "@/components/tienlen/Scoreboard";
import { cn } from "@/lib/utils";
import { createGameRoom, fetchApi, usePlayerName } from "./gameClient";
import { useGamesShell } from "./GamesShell";

const ROOMS_REFRESH_MS = 5000;

interface LobbyRoom {
  code: string;
  status: "waiting" | "playing";
  players: { name: string; connected: boolean; points: number }[];
  spectators: number;
}

interface LeaderRow {
  name: string;
  points: number;
  games: number;
  wins: number;
}

export interface GameLobbyProps {
  title: string;
  tagline: string;
  icons: string;
  /** Route of the game, e.g. "/tien-len"; rooms live at `${basePath}/${code}`. */
  basePath: string;
  wsPath: string;
  /** Backend API prefix: "" for Tiến Lên, "/meono" for Mèo Nổ. */
  apiPrefix: string;
  maxPlayers: number;
  /** Rules shown in the collapsible section. */
  rules: React.ReactNode;
  /** Extra controls under the create form (e.g. a card guide button). */
  extra?: React.ReactNode;
  /** Extra badges on a room row. */
  roomBadges?: (room: LobbyRoom & Record<string, unknown>) => React.ReactNode;
}

/** Shared lobby: create / join by code, live table list with play/watch, leaderboard. */
export function GameLobby({ title, tagline, icons, basePath, wsPath, apiPrefix, maxPlayers, rules, extra, roomBadges }: GameLobbyProps) {
  const router = useRouter();
  // The games layout gates on a name, so it is set here; renaming goes through the top bar.
  const name = usePlayerName();
  const { openRename } = useGamesShell();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<LobbyRoom[] | null>(null);
  const [roomsError, setRoomsError] = useState(false);
  const [board, setBoard] = useState<LeaderRow[] | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetchApi<{ rooms: LobbyRoom[] }>(`/api${apiPrefix}/rooms`);
      setRooms(res.rooms);
      setRoomsError(false);
    } catch {
      setRoomsError(true);
    }
  }, [apiPrefix]);

  useEffect(() => {
    void loadRooms();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void loadRooms();
    }, ROOMS_REFRESH_MS);
    fetchApi<{ players: LeaderRow[] }>(`/api${apiPrefix}/leaderboard?limit=20`)
      .then((r) => setBoard(r.players))
      .catch(() => setBoard([]));
    return () => clearInterval(id);
  }, [loadRooms, apiPrefix]);

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await createGameRoom(wsPath);
      router.push(`${basePath}/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được phòng");
      setBusy(false);
    }
  };

  const code = joinCode.trim().toUpperCase();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 short:pb-6 short:pt-2">
      <header className="mb-6 mt-2 text-center short:mb-3 short:mt-0">
        <p className="mb-2 text-4xl short:mb-1 short:text-2xl" aria-hidden>
          {icons}
        </p>
        <h1 className="text-3xl font-black tracking-tight text-amber-300 sm:text-4xl short:text-2xl">{title}</h1>
        <p className="mt-2 text-white/70">{tagline}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] short:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] short:gap-3">
        <section className="h-fit rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur sm:p-5">
          <div className="flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
              Bạn chơi với tên
              <b className="max-w-[12rem] truncate text-base text-amber-200">{name || "…"}</b>
              <button type="button" onClick={openRename} className="-my-1 rounded px-1 py-1 text-xs text-white/50 underline-offset-2 hover:text-white hover:underline max-sm:min-h-9 max-sm:px-2">
                ✎ Đổi tên
              </button>
            </p>
            <button
              onClick={() => void onCreate()}
              disabled={busy || !name}
              className="rounded-lg bg-amber-400 px-4 py-2.5 font-semibold text-black transition-colors hover:bg-amber-300 disabled:opacity-40"
            >
              {busy ? "Đang tạo bàn…" : "Tạo bàn mới"}
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-white/40">
            <span className="h-px flex-1 bg-white/10" /> hoặc nhập mã bàn <span className="h-px flex-1 bg-white/10" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code) router.push(`${basePath}/${code}`);
            }}
            className="flex gap-2"
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={5}
              placeholder="Mã bàn"
              aria-label="Mã bàn"
              className="min-w-0 flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 font-mono uppercase tracking-[0.2em] text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30 focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!code}
              className="rounded-lg border border-white/25 px-4 py-2 font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              Vào
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
          {extra && <div className="mt-5">{extra}</div>}

          <details className="mt-6 text-sm text-white/70">
            <summary className="cursor-pointer py-1 text-white/90 max-sm:py-2">Luật chơi & cách tính điểm</summary>
            <div className="mt-2">{rules}</div>
          </details>
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-amber-300">Bàn đang mở</h2>
              <button onClick={() => void loadRooms()} className="-my-1 rounded px-2 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white max-sm:min-h-9">
                ↻ Làm mới
              </button>
            </div>
            {rooms === null ? (
              <p className="animate-pulse text-sm text-white/60">{roomsError ? "Không tải được danh sách bàn." : "Đang tải…"}</p>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-white/60">Chưa có bàn nào. Tạo bàn mới và mời bạn bè nhé!</p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((r) => {
                  const full = r.players.length >= maxPlayers;
                  return (
                    <li key={r.code} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-black/25 p-3">
                      <span className="font-mono font-bold tracking-[0.15em] text-amber-300">{r.code}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                          r.status === "playing" ? "bg-rose-500/25 text-rose-200" : "bg-emerald-500/25 text-emerald-200",
                        )}
                      >
                        {r.status === "playing" ? "Đang chơi" : "Đang chờ"}
                      </span>
                      {roomBadges?.(r as LobbyRoom & Record<string, unknown>)}
                      {/* Phones: names get their own line under the code / buttons instead of being truncated to "Th…". */}
                      <span className="order-last w-full truncate text-sm text-white/90 sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
                        {r.players.map((p) => p.name).join(", ") || "—"}
                      </span>
                      <span className="ml-auto text-xs text-white/60 sm:ml-0">
                        {r.players.length}/{maxPlayers}
                        {r.spectators > 0 && ` · 👀 ${r.spectators}`}
                      </span>
                      <span className="flex gap-2">
                        {!full && r.status !== "playing" && (
                          <Link href={`${basePath}/${r.code}`} className="rounded-md bg-amber-400 px-3 py-1 text-sm font-semibold text-black hover:bg-amber-300 max-sm:px-4 max-sm:py-2">
                            Vào chơi
                          </Link>
                        )}
                        <Link href={`${basePath}/${r.code}?watch=1`} className="rounded-md border border-white/25 px-3 py-1 text-sm text-white hover:bg-white/10 max-sm:px-4 max-sm:py-2">
                          Xem
                        </Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur">
            <h2 className="mb-3 text-lg font-bold text-amber-300">🏆 Bảng xếp hạng</h2>
            {board === null ? (
              <p className="animate-pulse text-sm text-white/60">Đang tải…</p>
            ) : board.length === 0 ? (
              <p className="text-sm text-white/60">Chưa có ván nào được ghi điểm.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-white/50">
                  <tr>
                    <th className="pb-1">#</th>
                    <th className="pb-1">Người chơi</th>
                    <th className="pb-1 text-right">Ván</th>
                    <th className="pb-1 text-right">Nhất</th>
                    <th className="pb-1 text-right">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((p, i) => (
                    <tr key={p.name + i} className={cn("border-t border-white/5", name && p.name.toLowerCase() === name.toLowerCase() && "text-amber-200")}>
                      <td className="py-1.5 text-white/50">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                      <td className="max-w-[10rem] truncate py-1.5">{p.name}</td>
                      <td className="py-1.5 text-right">{p.games}</td>
                      <td className="py-1.5 text-right">{p.wins}</td>
                      <td className="py-1.5 text-right">
                        <DeltaBadge delta={p.points} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-white/40">Điểm được cộng dồn theo tên người chơi qua mọi bàn.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
