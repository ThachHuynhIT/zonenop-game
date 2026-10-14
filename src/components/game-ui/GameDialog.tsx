"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useGameTheme } from "./theme";
import { useIsMobile } from "./useIsMobile";

const SURFACE = "border border-white/10 bg-[oklch(0.2_0.03_290)] text-white game-raised [--game-raise-color:oklch(0_0_0/0.5)]";
// Cream variant for content written for pale backgrounds (Cờ Tỷ Phú's square details).
const SURFACE_LIGHT = "border border-emerald-900/15 bg-[#f4efe1] text-emerald-950 game-raised [--game-raise-color:oklch(0_0_0/0.35)]";

/**
 * Rules, settings and confirmations: a centred dialog from `md` up, a bottom drawer on phones.
 * The popup is portalled out of `.game-shell`, so it carries the page's `data-game` itself.
 */
export function GameDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  light,
  hideTitle,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Cream surface with dark text, for content designed on a pale background. */
  light?: boolean;
  /** Keeps the title for screen readers only. */
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  const mobile = useIsMobile();
  const game = useGameTheme() ?? "hub";
  const surface = light ? SURFACE_LIGHT : SURFACE;
  const rule = light ? "border-emerald-900/15" : "border-white/10";
  const muted = light ? "text-emerald-950/70" : "text-white/70";
  const titleClass = cn("font-heading text-xl font-extrabold tracking-tight", hideTitle && "sr-only");

  if (mobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Drawer.Content
            data-game={game}
            className={cn(surface, "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-game-card pb-[env(safe-area-inset-bottom)] outline-none")}
          >
            <div aria-hidden className={cn("mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full", light ? "bg-emerald-900/25" : "bg-white/25")} />
            <div className="px-5 pt-3">
              <Drawer.Title className={titleClass}>{title}</Drawer.Title>
              {description && <Drawer.Description className={cn("mt-1 text-sm", muted)}>{description}</Drawer.Description>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className={cn("flex flex-wrap justify-end gap-2 border-t px-5 py-3", rule)}>{footer}</div>}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-game={game}
          className={cn(
            surface,
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-game-card outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <div className="px-6 pt-5">
            <Dialog.Title className={titleClass}>{title}</Dialog.Title>
            {description && <Dialog.Description className={cn("mt-1 text-sm", muted)}>{description}</Dialog.Description>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className={cn("flex flex-wrap justify-end gap-2 border-t px-6 py-3", rule)}>{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
