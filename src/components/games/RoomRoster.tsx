"use client";

import { SeatAvatar } from "@/components/games/PlayerAvatar";
import { signed } from "@/components/tienlen/Scoreboard";
import { cn } from "@/lib/utils";
import styles from "./RoomRoster.module.scss";

/** The fields every game's seat view shares (the protocols mirror be_game's seat shape). */
export type RosterSeat = { id: string; name: string; isHost: boolean; connected: boolean; games: number; points: number };

/**
 * Who is in the room, as a row of chips: icon + colour, crown for the host, "(bạn)", offline mark and the
 * running score. Shared by every lobby so a player always sees who else has joined.
 * `minPlayers` adds a "waiting for more" chip while the room is short of it.
 */
export function RoomRoster({ seats, meId, minPlayers = 2, className }: { seats: (RosterSeat | null)[]; meId: string; minPlayers?: number; className?: string }) {
  const seated = seats.filter((s): s is RosterSeat => !!s);
  return (
    <ul aria-label="Người trong phòng" className={cn(styles.roster, className)}>
      {seated.map((seat) => (
        <li key={seat.id} className={cn(styles.seat, seat.id === meId && styles.me, !seat.connected && styles.offline)} title={seat.connected ? undefined : "Mất kết nối"}>
          <SeatAvatar name={seat.name} className={styles.avatar} fallbackClassName={styles.avatarFallback} />
          {seat.isHost && <span title="Chủ bàn">👑</span>}
          <span className={styles.name}>{seat.name}</span>
          {seat.id === meId && <span className={styles.you}>(bạn)</span>}
          {!seat.connected && <span aria-label="Mất kết nối">📴</span>}
          {seat.games > 0 && <span className={cn(styles.points, seat.points > 0 && styles.up, seat.points < 0 && styles.down)}>{signed(seat.points)}đ</span>}
        </li>
      ))}
      {seated.length < minPlayers && <li className={styles.empty}>Đang chờ thêm người…</li>}
    </ul>
  );
}
