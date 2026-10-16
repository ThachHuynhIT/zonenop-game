"use client";

import { Tabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export interface GameTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/**
 * Tabbed box (waiting-room settings…): one group at a time, with an underline sliding to the active tab.
 * `light` is for pale backgrounds (Cờ Tỷ Phú's settings), same as SettingsTabs.
 */
export function GameTabs({ tabs, className, light }: { tabs: GameTab[]; className?: string; light?: boolean }) {
  return (
    <Tabs.Root
      defaultValue={tabs[0]?.id}
      className={cn("overflow-hidden rounded-2xl border", light ? "border-emerald-900/15 bg-emerald-900/5" : "border-white/10 bg-white/5", className)}
    >
      <Tabs.List className={cn("relative flex border-b", light ? "border-emerald-900/15 bg-emerald-900/10" : "border-white/10 bg-black/20")}>
        {tabs.map((t) => (
          <Tabs.Tab
            key={t.id}
            value={t.id}
            className={cn(
              "min-h-11 flex-1 whitespace-nowrap px-2 text-sm font-bold outline-none transition-colors",
              light
                ? "text-emerald-900/60 hover:text-emerald-950 focus-visible:bg-emerald-900/10 data-[active]:text-emerald-950"
                : "text-white/60 hover:text-white focus-visible:bg-white/10 data-[active]:text-white",
            )}
          >
            {t.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator
          className={cn(
            "absolute bottom-0 left-[var(--active-tab-left)] h-1 w-[var(--active-tab-width)] rounded-full transition-[left,width] duration-200 ease-out",
            light ? "bg-emerald-700" : "bg-game-accent",
          )}
        />
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Panel key={t.id} value={t.id} className="p-3 text-sm outline-none">
          {t.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
