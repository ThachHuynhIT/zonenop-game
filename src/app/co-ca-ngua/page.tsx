"use client";

import { GameLobby } from "@/components/games/GameLobby";
import { CaNguaRules } from "@/components/cangua/CaNguaTable";
import { CANGUA_WS_PATH } from "@/lib/cangua/protocol";

export default function CaNguaLobbyPage() {
  return (
    <GameLobby
      title="Cờ Cá Ngựa"
      tagline="Gieo xúc xắc, xuất quân, đá ngựa đối thủ về chuồng và leo đủ 6 bậc — luật Việt Nam, 2–4 người."
      icons="🐴 🎲 💥 🏠"
      basePath="/co-ca-ngua"
      wsPath={CANGUA_WS_PATH}
      apiPrefix="/cangua"
      maxPlayers={4}
      rules={<CaNguaRules />}
    />
  );
}
