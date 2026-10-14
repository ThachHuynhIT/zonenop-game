"use client";

import { GameLobby } from "@/components/games/GameLobby";
import { OAnQuanRules } from "@/components/oanquan/OAnQuanTable";
import { OANQUAN_WS_PATH } from "@/lib/oanquan/protocol";

export default function OAnQuanLobbyPage() {
  return (
    <GameLobby
      title="Ô Ăn Quan"
      tagline="Trò chơi dân gian: bốc sỏi rải từng ô, ăn liên tiếp, giành quan — 2–4 người."
      icons="🪨 🫘 👑 🎋"
      basePath="/o-an-quan"
      wsPath={OANQUAN_WS_PATH}
      apiPrefix="/oanquan"
      maxPlayers={4}
      rules={<OAnQuanRules />}
    />
  );
}
