"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { useGameTheme } from "./theme";
import styles from "./PixelPrimitives.module.scss";

/** Compatible adapter for table modals mounted only while open.
 * Base UI owns modality, Escape, focus trapping and scroll locking. */
export function LegacyDialog({ children, onClose, title, label, light, className, bodyClassName, bodyRef, header }: {
  children: ReactNode;
  onClose: () => void;
  title: ReactNode;
  label?: string;
  light?: boolean;
  className?: string;
  bodyClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
  header?: ReactNode;
}) {
  const game = useGameTheme() ?? "hub";
  const [returnFocus] = useState(() => typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.legacyBackdrop} />
        <Dialog.Popup
          data-game={game}
          data-light={light || undefined}
          aria-label={label}
          finalFocus={() => returnFocus?.isConnected ? returnFocus : true}
          className={cn(styles.dialogSurface, styles.legacyPopup, className)}
        >
          <div className={styles.dialogHeader}>
            <Dialog.Title className={cn(styles.dialogTitle, styles.dialogHeading)}>{title}</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Đóng">×</Dialog.Close>
          </div>
          {header}
          <div ref={bodyRef} className={cn(styles.legacyBody, bodyClassName)}>{children}</div>
          <Dialog.Close className={styles.legacyCloseBar}>Đóng</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
