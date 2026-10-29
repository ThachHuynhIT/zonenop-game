"use client";

import { GameLobby } from "@/components/games/GameLobby";
import { NoiChuRules } from "@/components/noichu/NoiChuTable";
import { MAX_PLAYERS } from "@/lib/noichu/board";
import { NOICHU_WS_PATH } from "@/lib/noichu/protocol";

export default function NoiChuLobbyPage() {
  return (
    <GameLobby
      title="Nối Chữ"
      tagline="Nối từ ghép 2 tiếng: tiếng đầu trùng tiếng cuối của từ trước, hết giờ là bị loại — 2–8 người."
      icons="🔤 ✍️ ⏱️ 🏆"
      basePath="/noi-chu"
      wsPath={NOICHU_WS_PATH}
      apiPrefix="/noichu"
      maxPlayers={MAX_PLAYERS}
      rules={<NoiChuRules />}
    />
  );
}
