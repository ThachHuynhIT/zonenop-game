"use client";

import { KeyRound, Lock, LockOpen, Shield, ShieldOff } from "lucide-react";
import { GameButton } from "@/components/game-ui";
import type { AdminUser } from "./types";
import { getUserActionRules } from "./userActions";
import styles from "./UserActionButtons.module.scss";

export type UserAction = "lock" | "unlock" | "demote" | "promote" | "resetPassword";

/** Renders the account actions allowed for the current user. */
export function UserActionButtons({
  user,
  selfId,
  busy,
  onAction,
}: {
  user: AdminUser;
  selfId: string | null;
  busy: boolean;
  onAction: (user: AdminUser, action: UserAction) => void;
}) {
  const rules = getUserActionRules(user, selfId);
  const admin = user.role === "admin";
  return (
    <div className={styles.actions}>
      {user.isOwner === true && user.id !== selfId && (
        <p className={styles.note}>Tài khoản chủ sở hữu được bảo vệ</p>
      )}
      {rules.canChangeRole && (
        <GameButton
          className={styles.button}
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onAction(user, admin ? "demote" : "promote")}
        >
          {admin ? <ShieldOff aria-hidden /> : <Shield aria-hidden />}
          {admin ? "Bỏ quyền" : "Cấp quyền"}
        </GameButton>
      )}
      {user.disabled ? (
        rules.canUnlock && (
          <GameButton
            className={styles.button}
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onAction(user, "unlock")}
          >
            <LockOpen aria-hidden />
            Mở khoá
          </GameButton>
        )
      ) : (
        rules.canLock && (
          <GameButton
            className={styles.button}
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onAction(user, "lock")}
          >
            <Lock aria-hidden />
            Khoá tài khoản
          </GameButton>
        )
      )}
      {rules.canResetPassword && (
        <GameButton
          className={styles.button}
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onAction(user, "resetPassword")}
        >
          <KeyRound aria-hidden />
          Đặt lại mật khẩu
        </GameButton>
      )}
    </div>
  );
}
