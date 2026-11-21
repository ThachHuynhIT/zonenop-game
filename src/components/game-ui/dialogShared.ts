import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./PixelPrimitives.module.scss";

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

const SURFACE = styles.dialogSurface;
// Cream variant for content written for pale backgrounds (Cờ Tỷ Phú's square details).
const SURFACE_LIGHT = styles.dialogSurface;

/** Classes shared by the drawer and the centred dialog. */
export function dialogClasses(light?: boolean, hideTitle?: boolean) {
  return {
    surface: light ? SURFACE_LIGHT : SURFACE,
    rule: light ? "border-emerald-900/15" : "border-white/10",
    muted: light ? "text-emerald-950/70" : "text-white/70",
    title: cn(styles.dialogTitle, hideTitle && "sr-only"),
  };
}
