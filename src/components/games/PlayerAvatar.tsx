"use client";

import { cn } from "@/lib/utils";
import { PROFILE_COLORS, PROFILE_ICONS, useLookOf, type PlayerProfile } from "./gameClient";

/** Round badge: the player's icon on their colour, or the name's first letter when no icon is chosen. */
export function PlayerAvatar({ name, profile, className }: { name: string; profile: PlayerProfile; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold text-black", className)} style={{ backgroundColor: profile.color }} aria-hidden>
      {profile.icon || name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * A seat's avatar chip: the player's chosen icon on their colour. Without a look (or when `out`) it keeps the
 * caller's own gradient (`fallbackClassName`), so each game's existing chip stays as it was.
 */
export function SeatAvatar({ name, className, fallbackClassName, out }: { name: string; className?: string; fallbackClassName?: string; out?: boolean }) {
  const look = useLookOf(name);
  if (!look || out) return <span className={cn(className, fallbackClassName)}>{out ? "💀" : name.charAt(0).toUpperCase()}</span>;
  return (
    <span className={cn(className, "font-bold text-black")} style={{ backgroundColor: look.color }}>
      {look.icon || name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Icon + colour pickers used by the name gate and the rename dialog. */
export function ProfilePicker({ name, value, onChange }: { name: string; value: PlayerProfile; onChange: (p: PlayerProfile) => void }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-3">
        <PlayerAvatar name={name || "?"} profile={value} className="size-10 text-xl" />
        <span className="text-sm text-white/60">Biểu tượng &amp; màu của bạn</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Biểu tượng">
        <button
          type="button"
          role="radio"
          aria-checked={value.icon === ""}
          onClick={() => onChange({ ...value, icon: "" })}
          className={cn("grid size-9 place-items-center rounded-lg border text-sm font-bold", value.icon === "" ? "border-amber-300 bg-amber-400/20" : "border-white/15 hover:bg-white/10")}
          title="Chữ cái đầu"
        >
          Aa
        </button>
        {PROFILE_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            role="radio"
            aria-checked={value.icon === icon}
            onClick={() => onChange({ ...value, icon })}
            className={cn("grid size-9 place-items-center rounded-lg border text-lg", value.icon === icon ? "border-amber-300 bg-amber-400/20" : "border-white/15 hover:bg-white/10")}
          >
            {icon}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Màu">
        {PROFILE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value.color === color}
            aria-label={color}
            onClick={() => onChange({ ...value, color })}
            className={cn("size-7 rounded-full border-2", value.color === color ? "border-white" : "border-transparent")}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
