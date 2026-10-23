"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authRequest, getSession, useSession } from "@/components/auth/session";
import type { GameId } from "./gamesRegistry";
import { resumeRooms } from "./resumeRooms";
import styles from "./ResumeBanner.module.scss";

type PlayingRoom = { game: GameId; code: string };

/** The account's unfinished games, refreshed on entry and when this tab returns. */
export function ResumeBanner({ game }: { game?: GameId }) {
  const token = useSession()?.session;
  const [result, setResult] = useState<{ token: string; rooms: PlayingRoom[] } | null>(null);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let request = 0;
    const load = async () => {
      const current = ++request;
      try {
        const res = await authRequest<{ rooms: PlayingRoom[] }>("GET", "/api/auth/rooms");
        if (!disposed && current === request && getSession()?.session === token) {
          setResult({ token, rooms: res.ok ? res.data.rooms : [] });
        }
      } catch {
        if (!disposed && current === request) setResult({ token, rooms: [] });
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  const rooms = token && result?.token === token ? resumeRooms(result.rooms, game) : [];
  if (!rooms.length) return null;

  return (
    <section aria-label="Ván đang dở" className={styles.banner}>
      {rooms.map((room) => (
        <div className={styles.room} key={room.href}>
          <p>
            <span aria-hidden>{room.game.emoji}</span>{" "}
            Bạn đang có ván <strong>{room.game.title}</strong> dở · phòng <strong>{room.code}</strong>
          </p>
          <Link href={room.href} className={styles.resume}>Vào lại</Link>
        </div>
      ))}
    </section>
  );
}
