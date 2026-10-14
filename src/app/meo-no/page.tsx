"use client";

import { useState } from "react";
import { GameLobby } from "@/components/games/GameLobby";
import { CardGuide, MeoRules } from "@/components/meono/CardGuide";
import { PACKS, type Expansion } from "@/lib/meono/cards";
import { MEONO_WS_PATH } from "@/lib/meono/protocol";

export default function MeoNoLobbyPage() {
  const [guide, setGuide] = useState(false);
  return (
    <>
      <GameLobby
        title="Mèo Nổ"
        tagline="Rút bài, né bom, chơi xỏ bạn bè — người cuối cùng còn sống thắng."
        icons="😼 💣 🧯 🚫"
        basePath="/meo-no"
        wsPath={MEONO_WS_PATH}
        apiPrefix="/meono"
        maxPlayers={7}
        rules={<MeoRules />}
        extra={
          <button
            onClick={() => setGuide(true)}
            className="w-full rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-2 font-semibold text-amber-200 transition-colors hover:bg-amber-400/20"
          >
            📖 Hướng dẫn từng lá bài
          </button>
        }
        roomBadges={(r) =>
          ((r.expansions as Expansion[] | undefined) ?? []).map((e) => (
            <span key={e} title={PACKS[e].name} className="text-sm">
              {PACKS[e].emoji}
            </span>
          ))
        }
      />
      {guide && <CardGuide onClose={() => setGuide(false)} />}
    </>
  );
}
