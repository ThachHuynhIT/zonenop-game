"use client";

import { Tabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";
import styles from "./PixelPrimitives.module.scss";

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
      className={cn(styles.tabs, light && styles.light, className)}
    >
      <Tabs.List className={styles.tabList}>
        {tabs.map((t) => (
          <Tabs.Tab
            key={t.id}
            value={t.id}
            className={styles.tab}
          >
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map((t) => (
        <Tabs.Panel key={t.id} value={t.id} className={styles.tabPanel}>
          {t.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
