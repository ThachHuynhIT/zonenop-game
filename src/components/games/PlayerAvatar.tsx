"use client";

import { cn } from "@/lib/utils";
import styles from "./PlayerAvatar.module.scss";
import { PROFILE_COLORS, PROFILE_ICONS, useLookOf, type PlayerProfile } from "./gameClient";

/** Pixel badge: the player's icon on their colour, or the name's first letter when no icon is chosen. */
export function PlayerAvatar({ name, profile, className }: { name: string; profile: PlayerProfile; className?: string }) {
  return (
    <span className={cn(styles.avatar, className)} style={{ backgroundColor: profile.color }} aria-hidden>
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
    <span className={cn(className, styles.seatAvatar)} style={{ backgroundColor: look.color }}>
      {look.icon || name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Icon + colour pickers used by the name gate and the rename dialog. */
export function ProfilePicker({ name, value, onChange }: { name: string; value: PlayerProfile; onChange: (p: PlayerProfile) => void }) {
  return (
    <div className={styles.picker}>
      <div className={styles.preview}>
        <PlayerAvatar name={name || "?"} profile={value} className={styles.large} />
        <span className={styles.hint}>Biểu tượng &amp; màu của bạn</span>
      </div>
      <div className={styles.icons} role="group" aria-label="Biểu tượng">
        <button
          type="button"
          aria-pressed={value.icon === ""}
          onClick={() => onChange({ ...value, icon: "" })}
          className={cn(styles.icon, value.icon === "" && styles.selected)}
          title="Chữ cái đầu"
        >
          Aa
        </button>
        {PROFILE_ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
              aria-pressed={value.icon === icon}
            onClick={() => onChange({ ...value, icon })}
            className={cn(styles.icon, value.icon === icon && styles.selected)}
          >
            {icon}
          </button>
        ))}
      </div>
      <div className={styles.colors} role="group" aria-label="Màu">
        {PROFILE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
              aria-pressed={value.color === color}
            aria-label={`Màu ${color}`}
            onClick={() => onChange({ ...value, color })}
            className={cn(styles.color, value.color === color && styles.selectedColor)}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}
