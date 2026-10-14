"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface SettingsTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** A compact tabbed box for the waiting-room settings, so only one group of options shows at a time. */
export function SettingsTabs({ tabs, className, light }: { tabs: SettingsTab[]; className?: string; /** For pale backgrounds. */ light?: boolean }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className={cn("overflow-hidden rounded-xl border", light ? "border-emerald-900/15 bg-emerald-900/5" : "border-white/10 bg-white/5", className)}>
      <div role="tablist" className={cn("flex border-b", light ? "border-emerald-900/15 bg-emerald-900/10" : "border-white/10 bg-black/20")}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current?.id}
            onClick={() => setActive(t.id)}
            className={cn(
              "min-h-9 flex-1 whitespace-nowrap px-2 py-2 text-xs font-semibold transition-colors max-sm:min-h-10",
              light
                ? t.id === current?.id
                  ? "border-b-2 border-emerald-700 bg-white/70 text-emerald-900"
                  : "text-emerald-900/60 hover:text-emerald-900"
                : t.id === current?.id
                  ? "border-b-2 border-amber-400 bg-white/5 text-amber-200"
                  : "text-white/60 hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-2 text-xs">
        {current?.content}
      </div>
    </div>
  );
}
