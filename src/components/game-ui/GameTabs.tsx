"use client";

import { Tabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

export interface GameTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** Tabbed box (waiting-room settings…): one group at a time, with an underline sliding to the active tab. */
export function GameTabs({ tabs, className }: { tabs: GameTab[]; className?: string }) {
  return (
    <Tabs.Root defaultValue={tabs[0]?.id} className={cn("overflow-hidden rounded-2xl border border-white/10 bg-white/5", className)}>
      <Tabs.List className="relative flex border-b border-white/10 bg-black/20">
        {tabs.map((t) => (
          <Tabs.Tab
            key={t.id}
            value={t.id}
            className="min-h-11 flex-1 whitespace-nowrap px-2 text-sm font-bold text-white/60 outline-none transition-colors hover:text-white focus-visible:bg-white/10 data-[active]:text-white"
          >
            {t.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute bottom-0 left-[var(--active-tab-left)] h-1 w-[var(--active-tab-width)] rounded-full bg-game-accent transition-[left,width] duration-200 ease-out" />
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Panel key={t.id} value={t.id} className="p-3 text-sm outline-none">
          {t.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
