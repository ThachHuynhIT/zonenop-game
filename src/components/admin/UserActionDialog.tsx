"use client";

import { useRef, useState } from "react";
import { GameButton, GameDialog } from "@/components/game-ui";
import type { AdminUser } from "./types";
import styles from "./UserActionButtons.module.scss";

export type ConfirmUserAction = "lock" | "unlock" | "demote";
export type UserActionTarget = { user: AdminUser; action: ConfirmUserAction };
const COPY = {
  lock: { title: "Khoá tài khoản?", button: "Khoá tài khoản", description: "Khoá tài khoản" },
  unlock: { title: "Mở khoá tài khoản?", button: "Mở khoá", description: "Mở khoá tài khoản" },
  demote: { title: "Bỏ quyền quản trị?", button: "Bỏ quyền", description: "Bỏ quyền quản trị của" },
};

export function UserActionDialog({ target, onClose, onConfirm }: {
  target: UserActionTarget | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  // Retain the copy while GameDialog animates closed.
  const [shown, setShown] = useState(target);
  const [previous, setPrevious] = useState(target);
  if (target !== previous) {
    setPrevious(target);
    if (target) setShown(target);
  }
  const copy = COPY[shown?.action ?? "lock"];

  function close() {
    if (!submitting.current) onClose();
  }

  async function confirm() {
    if (!target || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <GameDialog
      open={target !== null}
      onOpenChange={(open) => { if (!open) close(); }}
      title={copy.title}
      description={shown
        ? `${copy.description} ${shown.user.username}?${shown.action === "lock" ? " Mọi phiên đăng nhập của tài khoản này sẽ bị đăng xuất." : ""}`
        : undefined}
    >
      <div className={styles.dialogActions}>
        <GameButton autoFocus className={styles.button} disabled={busy} onClick={close}>
          Huỷ
        </GameButton>
        <GameButton
          className={styles.button}
          variant={shown?.action === "unlock" ? "primary" : "danger"}
          loading={busy}
          onClick={() => void confirm()}
        >
          {copy.button}
        </GameButton>
      </div>
    </GameDialog>
  );
}
