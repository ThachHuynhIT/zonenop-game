"use client";

import { GameLobby } from "@/components/games/GameLobby";
import { TyPhuRules } from "@/components/typhu/TyPhuTable";
import { TYPHU_WS_PATH } from "@/lib/typhu/protocol";

export default function CoTyPhuLobbyPage() {
  return (
    <GameLobby
      title="Cờ Tỷ Phú"
      tagline="Mua đất khắp Việt Nam, xây nhà xây khách sạn, thu tiền thuê — người trụ lại cuối cùng là tỷ phú."
      icons="🎲 🏠 🏨 💰"
      basePath="/co-ty-phu"
      wsPath={TYPHU_WS_PATH}
      apiPrefix="/typhu"
      maxPlayers={6}
      rules={<TyPhuRules />}
    />
  );
}
