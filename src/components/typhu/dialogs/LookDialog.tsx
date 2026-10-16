"use client";

import { useState } from "react";
import { GameButton } from "@/components/game-ui/GameButton";
import { GameDialog } from "@/components/game-ui/GameDialog";
import { getSavedProfile, saveProfile } from "@/components/games/gameClient";
import { ProfilePicker } from "@/components/games/PlayerAvatar";

/**
 * My icon and colour, edited at the table: it is the same look as on the site (saving it updates both, and the table hears
 * it at once). A colour another player already wears is allowed, but the board then gives me a free one instead.
 */
export function LookDialog({ name, takenColors, onClose }: { name: string; takenColors: readonly string[]; onClose: () => void }) {
  const [look, setLook] = useState(getSavedProfile);
  const taken = takenColors.includes(look.color);
  return (
    <GameDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Biểu tượng & màu"
      description="Dùng chung với hồ sơ của bạn trên web."
      footer={
        <>
          <GameButton size="sm" onClick={onClose}>
            Huỷ
          </GameButton>
          <GameButton
            size="sm"
            variant="primary"
            onClick={() => {
              saveProfile(look);
              onClose();
            }}
          >
            Lưu
          </GameButton>
        </>
      }
    >
      <ProfilePicker name={name} value={look} onChange={setLook} />
      {taken && <p className="mt-3 text-xs text-amber-200">Màu này đã có người ở bàn dùng: trên bàn cờ bạn sẽ được đổi sang một màu khác còn trống.</p>}
    </GameDialog>
  );
}
