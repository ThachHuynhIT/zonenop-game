"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GameTabs, PixelIcon } from "@/components/game-ui";
import { DeltaBadge } from "@/components/tienlen/Scoreboard";
import { cn } from "@/lib/utils";
import { createGameRoom, fetchApi, pollWhileVisible, usePlayerName } from "./gameClient";
import { useGamesShell } from "./GamesShell";
import { gameOfPath } from "./gamesRegistry";
import { toLeaderRows, type LeaderRow } from "./leaderboard";
import { createLatestRequest } from "./latestRequest";
import { PlayerAvatar } from "./PlayerAvatar";
import { ResumeBanner } from "./ResumeBanner";
import styles from "./GameLobby.module.scss";

const ROOMS_REFRESH_MS = 10_000;

interface LobbyRoom {
  code: string;
  status: "waiting" | "playing";
  players: { name: string; connected: boolean; points: number }[];
  spectators: number;
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
  const game = gameOfPath(basePath);
  // The games layout gates on a name, so it is set here; renaming goes through the top bar.
  const name = usePlayerName();
  const { openAccount } = useGamesShell();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<LobbyRoom[] | null>(null);
  const [roomsError, setRoomsError] = useState(false);
  const [roomsRequest] = useState(createLatestRequest);
  const [board, setBoard] = useState<LeaderRow[] | null>(null);
  const [oldBoard, setOldBoard] = useState<LeaderRow[] | null>(null);

  const loadRooms = useCallback(() => roomsRequest.run(
    () => fetchApi<{ rooms: LobbyRoom[] }>(`/api${apiPrefix}/rooms`),
    (result) => {
      if (result.status === "fulfilled") {
        setRooms(result.value.rooms);
        setRoomsError(false);
      } else {
        setRoomsError(true);
      }
    },
  ), [apiPrefix, roomsRequest]);

  useEffect(() => {
    const stop = pollWhileVisible(() => void loadRooms(), ROOMS_REFRESH_MS);
    fetchApi<unknown>(`/api${apiPrefix}/leaderboard?limit=20`)
      .then((r) => setBoard(toLeaderRows(r)))
      .catch(() => setBoard([]));
    fetchApi<unknown>(`/api${apiPrefix}/leaderboard?season=old&limit=20`)
      .then((r) => setOldBoard(toLeaderRows(r)))
      .catch(() => setOldBoard([]));
    return () => {
      stop();
      roomsRequest.invalidate();
    };
  }, [loadRooms, apiPrefix, roomsRequest]);

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
    <main className={styles.main}>
      <header className={styles.hero}>
        <div className={styles.mark}>{game ? <PixelIcon name={game.id} /> : <span aria-hidden>{icons}</span>}</div>
        <div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.tagline}>{tagline}</p>
        </div>
      </header>

      <div className={styles.columns}>
        <section className={styles.createPanel}>
          <div className={styles.createActions}>
            <p className={styles.identity}>
              Bạn chơi với tên
              <b className={styles.name}>{name || "…"}</b>
              <button type="button" onClick={openAccount} className={styles.accountLink}>
                Tài khoản
              </button>
            </p>
            <button
              onClick={() => void onCreate()}
              disabled={busy || !name}
              className={styles.primaryButton}
            >
              {busy ? "Đang tạo bàn…" : "Tạo bàn mới"}
            </button>
          </div>

          <div className={styles.divider}>
            <span className={styles.line} /> hoặc nhập mã bàn <span className={styles.line} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code) router.push(`${basePath}/${code}`);
            }}
            className={styles.actions}
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={5}
              placeholder="Mã bàn"
              aria-label="Mã bàn"
              className={styles.codeInput}
            />
            <button
              type="submit"
              disabled={!code}
              className={styles.button}
            >
              Vào
            </button>
          </form>

          {error && <p role="alert" className={styles.error}>{error}</p>}
          {extra && <div className={styles.extra}>{extra}</div>}

          <details className={styles.rules}>
            <summary className={styles.summary}>Luật chơi & cách tính điểm</summary>
            <div className={styles.ruleContent}>{rules}</div>
          </details>
        </section>

        <div className={styles.stack}>
          <ResumeBanner game={gameOfPath(basePath)?.id} />
          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <h2 className={styles.sectionTitle}>Bàn đang mở</h2>
              <button onClick={() => void loadRooms()} className={styles.refresh} title="Tự cập nhật mỗi 10 giây khi trang đang hiển thị">
                ↻ Làm mới
              </button>
            </div>
            {roomsError && <p role="status" className={styles.warning}>{rooms === null ? "Chưa tải được danh sách bàn. Thử làm mới để kết nối lại." : "Chưa cập nhật được danh sách. Các bàn bên dưới là dữ liệu lần tải gần nhất."}</p>}
            {rooms === null ? (
              <p className={styles.loading}>{roomsError ? "Có thể thử lại bằng nút Làm mới." : "Đang tải…"}</p>
            ) : rooms.length === 0 ? (
              <p className={styles.muted}>Chưa có bàn nào. Tạo bàn mới và mời bạn bè nhé!</p>
            ) : (
              <ul className={styles.rooms}>
                {rooms.map((r) => {
                  const full = r.players.length >= maxPlayers;
                  return (
                    <li key={r.code} className={styles.room}>
                      <span className={styles.code}>{r.code}</span>
                      <span
                        className={cn(
                          styles.badge,
                          r.status === "playing" ? styles.playing : styles.waiting,
                        )}
                      >
                        {r.status === "playing" ? "Đang chơi" : "Đang chờ"}
                      </span>
                      {roomBadges?.(r as LobbyRoom & Record<string, unknown>)}
                      {/* Phones: names get their own line under the code / buttons instead of being truncated to "Th…". */}
                      <span className={styles.players}>
                        {r.players.map((p) => p.name).join(", ") || "—"}
                      </span>
                      <span className={styles.count}>
                        {r.players.length}/{maxPlayers}
                        {r.spectators > 0 && ` · 👀 ${r.spectators}`}
                      </span>
                      <span className={styles.actions}>
                        {!full && r.status !== "playing" && (
                          <Link href={`${basePath}/${r.code}`} className={styles.primaryButton}>
                            Vào chơi
                          </Link>
                        )}
                        <Link href={`${basePath}/${r.code}?watch=1`} className={styles.button}>
                          Xem
                        </Link>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            <h2 className={styles.boardTitle}>🏆 Bảng xếp hạng</h2>
            <GameTabs
              tabs={[
                { id: "current", label: "Mùa này", content: <Board rows={board} me={name ?? ""} empty="Chưa có ai ghi điểm mùa này." note="Điểm tính theo tài khoản, bắt đầu từ mùa này." /> },
                { id: "old", label: "Mùa trước (theo tên)", content: <Board rows={oldBoard} me={name ?? ""} empty="Không có dữ liệu mùa trước." note="Bảng cũ tính theo tên người chơi." /> },
              ]}
              className={styles.tabs}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

function Board({ rows, me, empty, note }: { rows: LeaderRow[] | null; me: string; empty: string; note: string }) {
  if (rows === null) return <p className={styles.loading}>Đang tải…</p>;
  if (rows.length === 0) return <p className={styles.muted}>{empty}</p>;
  return (
    <>
    <table className={styles.board}>
      <thead className={styles.tableHead}>
        <tr>
          <th className={styles.th}>#</th>
          <th className={styles.th}>Người chơi</th>
          <th className={styles.thNumber}>Ván</th>
          <th className={styles.thNumber}>Nhất</th>
          <th className={styles.thNumber}>Điểm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => (
          <tr key={p.name + i} className={cn(styles.tableRow, me && p.name.toLowerCase() === me.toLowerCase() && styles.me)}>
            <td className={styles.rank}>{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
            <td className={styles.playerCell}>
              <span className={styles.playerIdentity}>
                <PlayerAvatar name={p.name} profile={{ icon: p.icon, color: p.color || "#fbbf24" }} className={styles.avatar} />
                <span className={styles.truncate}>{p.name}</span>
              </span>
            </td>
            <td className={styles.number}>{p.games}</td>
            <td className={styles.number}>{p.wins}</td>
            <td className={styles.number}>
              <DeltaBadge delta={p.points} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className={styles.note}>{note}</p>
    </>
  );
}
