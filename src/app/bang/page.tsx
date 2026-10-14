"use client";

import { useState } from "react";
import { GameLobby } from "@/components/games/GameLobby";
import { BangGuide, BangRules } from "@/components/bang/Pieces";
import { EXPANSIONS, MAX_PLAYERS, PACKS, type Pack } from "@/lib/bang/cards";
import { BANG_WS_PATH } from "@/lib/bang/protocol";

export default function BangLobbyPage() {
  const [guide, setGuide] = useState(false);
  return (
    <>
      <GameLobby
        title="Đấu Súng (Bang!)"
        tagline="Cảnh sát trưởng, Phó, Kẻ cướp và Kẻ phản bội đấu súng giữa miền Tây — ai sống sót thì thắng."
        icons="🤠 💥 🐎 ⭐"
        basePath="/bang"
        wsPath={BANG_WS_PATH}
        apiPrefix="/bang"
        maxPlayers={MAX_PLAYERS}
        rules={<BangRules />}
        extra={
          <button
            onClick={() => setGuide(true)}
            className="w-full rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-2 font-semibold text-amber-200 transition-colors hover:bg-amber-400/20"
          >
            📖 Lá bài, nhân vật & sự kiện
          </button>
        }
        roomBadges={(r) =>
          ((r.packs as Pack[] | undefined) ?? []).map((p) => (
            <span key={p} title={PACKS[p].name} className="text-sm">
              {PACKS[p].emoji}
            </span>
          ))
        }
      />
      {guide && <BangGuide packs={EXPANSIONS} onClose={() => setGuide(false)} />}
    </>
  );
}
