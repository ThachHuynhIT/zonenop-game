import { cn } from "@/lib/utils";
import type { PlayerProfile } from "@/components/games/gameClient";

/** Round avatar: the player's icon on their colour, or the name's first letter when no icon is chosen. */
export function GameAvatar({ name, profile, className }: { name: string; profile: PlayerProfile; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-bold text-black ring-2 ring-black/30", className)}
      style={{ backgroundColor: profile.color }}
    >
      {profile.icon || name.charAt(0).toUpperCase()}
    </span>
  );
}
