"use client";

import { GameTabs } from "@/components/game-ui";

export interface SettingsTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Keep waiting-room settings on the same accessible tabs as the rest of the arcade. */
export function SettingsTabs({ tabs, className, light }: { tabs: SettingsTab[]; className?: string; light?: boolean }) {
  return <GameTabs tabs={tabs} className={className} light={light} />;
}
