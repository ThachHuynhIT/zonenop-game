"use client";

import { createContext, useContext } from "react";
import type { OnlineGame } from "@/components/games/gamesRegistry";

export type GameId = OnlineGame["id"];

const GameThemeContext = createContext<GameId | null>(null);

/** The game whose accent colours the current subtree (null = the games hub). */
export const useGameTheme = () => useContext(GameThemeContext);

/**
 * Sets `data-game` (which picks the accent in globals.css) and tells portalled children such as GameDialog which
 * game they belong to.
 */
export function GameThemeScope({ game, className, children }: { game: GameId | null; className?: string; children: React.ReactNode }) {
  return (
    <GameThemeContext.Provider value={game}>
      <div data-game={game ?? "hub"} className={className}>
        {children}
      </div>
    </GameThemeContext.Provider>
  );
}

/** Confetti palettes (canvas-confetti needs hex, not oklch): the game's accent first, then gold and white. */
export const CONFETTI_COLORS: Record<GameId | "hub", string[]> = {
  hub: ["#b57bff", "#8b5cf6", "#fbbf24", "#ffffff"],
  tienlen: ["#34d399", "#10b981", "#fbbf24", "#ffffff"],
  meono: ["#fb923c", "#f97316", "#fde68a", "#ffffff"],
  typhu: ["#facc15", "#eab308", "#fef3c7", "#ffffff"],
  splendor: ["#a78bfa", "#7c3aed", "#f0abfc", "#ffffff"],
  bang: ["#f87171", "#c2410c", "#fbbf24", "#ffffff"],
  oanquan: ["#d6a75c", "#a16207", "#fde68a", "#ffffff"],
  cangua: ["#60a5fa", "#2563eb", "#fbbf24", "#ffffff"],
};
