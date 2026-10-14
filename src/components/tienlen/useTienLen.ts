"use client";

import { useCallback } from "react";
import { type Card, type LeaderboardEntry, type RoomSummary, type RoomView, type TienLenSettings, WS_PATH } from "@/lib/tienlen";
import { createGameRoom, useGameRoom } from "@/components/games/gameClient";

export { fetchApi, getSavedName, getToken, saveName } from "@/components/games/gameClient";
export type { ConnectionStatus } from "@/components/games/gameClient";
export type { LeaderboardEntry, RoomSummary };

export function inviteLink(code: string): string {
  return new URL(`/tien-len/${code}`, window.location.origin).toString();
}

/** Ask the server for a new Tiến Lên room code. */
export const createRoom = () => createGameRoom(WS_PATH);

/** Shift server-clock deadlines onto the local clock. */
function localizeView(view: RoomView): RoomView {
  if (!view.game?.turnDeadline) return view;
  const skew = Date.now() - view.serverTime;
  return { ...view, game: { ...view.game, turnDeadline: view.game.turnDeadline + skew } };
}

/** `mode` "watch" joins as a spectator (no seat, no hand). */
export function useTienLenRoom(code: string, name: string | null, mode: "play" | "watch" = "play") {
  const { view, status, error, call } = useGameRoom<RoomView>(WS_PATH, code, name, mode, localizeView);

  const play = useCallback((cards: Card[]) => call({ type: "play", cards }), [call]);
  const pass = useCallback(() => call({ type: "pass" }), [call]);
  const start = useCallback(() => call({ type: "start" }), [call]);
  const sendEmoji = useCallback((emoji: string) => call({ type: "emoji", emoji }), [call]);
  const kick = useCallback((playerId: string) => call({ type: "kick", playerId }), [call]);
  const sendChat = useCallback((text: string) => call({ type: "chat", text }), [call]);
  const setSettings = useCallback((s: Partial<TienLenSettings>) => call({ type: "settings", ...s }), [call]);

  return { view, status, error, play, pass, start, sendEmoji, kick, sendChat, setSettings };
}
