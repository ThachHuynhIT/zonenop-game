import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** Cream surface with dark text, for content designed on a pale background. */
  light?: boolean;
  /** Keeps the title for screen readers only. */
  hideTitle?: boolean;
  children: ReactNode;
}

const SURFACE = "border border-white/10 bg-[oklch(0.2_0.03_290)] text-white game-raised [--game-raise-color:oklch(0_0_0/0.5)]";
// Cream variant for content written for pale backgrounds (Cờ Tỷ Phú's square details).
const SURFACE_LIGHT = "border border-emerald-900/15 bg-[#f4efe1] text-emerald-950 game-raised [--game-raise-color:oklch(0_0_0/0.35)]";

/** Classes shared by the drawer and the centred dialog. */
export function dialogClasses(light?: boolean, hideTitle?: boolean) {
  return {
    surface: light ? SURFACE_LIGHT : SURFACE,
    rule: light ? "border-emerald-900/15" : "border-white/10",
    muted: light ? "text-emerald-950/70" : "text-white/70",
    title: cn("font-heading text-xl font-extrabold tracking-tight", hideTitle && "sr-only"),
  };
}
