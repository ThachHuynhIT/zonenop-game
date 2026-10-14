"use client";

import { use, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { getSavedName } from "@/components/games/gameClient";

const MeoTable = dynamic(() => import("@/components/meono/MeoTable"), {
  ssr: false,
  loading: () => <p className="animate-pulse pt-32 text-center text-orange-100/70">Đang tải bàn chơi…</p>,
});

/** The games layout (GamesShell) only renders this once the player has a name. */
export default function MeoNoRoomPage({ params }: { params: Promise<{ room: string }> }) {
  const code = decodeURIComponent(use(params).room).toUpperCase();
  const watch = useSearchParams().get("watch") === "1";
  // Frozen for this table: renaming in the top bar must not re-join the room mid-game.
  const [name] = useState(getSavedName);

  return <MeoTable code={code} name={name} watch={watch} />;
}
