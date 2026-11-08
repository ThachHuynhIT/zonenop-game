import type { AdminUser } from "./types";

export type UserActionRules = { canChangeRole: boolean; canLock: boolean; canUnlock: boolean; canResetPassword: boolean };

/**
 * Which admin actions to offer on a user row. Mirrors be_game (`adminUpdate`): nobody demotes or locks themselves,
 * and another admin may not change the owner's role, lock the owner or set the owner's password (unlocking is fine).
 * Cosmetic only: the backend refuses these anyway. `isOwner` missing (an older backend) counts as not the owner;
 * ownership is never guessed from the username.
 */
export function getUserActionRules(user: AdminUser, selfId: string | null): UserActionRules {
  const self = selfId !== null && user.id === selfId;
  const othersOwner = user.isOwner === true && !self;
  return {
    canChangeRole: !self && !othersOwner,
    canLock: !self && !othersOwner,
    canUnlock: true,
    canResetPassword: !othersOwner,
  };
}
