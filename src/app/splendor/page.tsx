"use client";

import { GameLobby } from "@/components/games/GameLobby";
import { SplendorRules } from "@/components/splendor/SplendorTable";
import { SPLENDOR_WS_PATH } from "@/lib/splendor/protocol";

export default function SplendorLobbyPage() {
  return (
    <GameLobby
      title="Đá Quý"
      tagline="Lấy đá, mua mỏ, mở tuyến buôn và mời quý tộc — theo lối chơi Splendor, 2–4 người."
      icons="💎 🪙 👑 🃏"
      basePath="/splendor"
      wsPath={SPLENDOR_WS_PATH}
      apiPrefix="/splendor"
      maxPlayers={4}
      rules={<SplendorRules />}
    />
  );
}
