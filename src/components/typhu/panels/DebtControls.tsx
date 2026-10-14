"use client";

import { type TPGameView } from "@/lib/typhu/protocol";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { CBtn, money, type Act } from "../shared";

/** Debt line + Trả nợ / Phá sản in the board centre: small, so the board around it stays visible. */
export function DebtControls({
  debt,
  cash,
  busy,
  run,
  onOpenAssets,
}: {
  debt: NonNullable<TPGameView["debt"]>;
  cash: number;
  busy: boolean;
  run: Act;
  /** Scrolls to the assets panel (below the board on phones); absent when there's nothing to sell. */
  onOpenAssets?: () => void;
}) {
  const short = Math.max(0, debt.amount - cash);
  return (
    <div role="alert" className="flex w-full flex-col items-center gap-1.5">
      <p className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-900">
        💸 Nợ {money(debt.amount)} ({debt.reason}){short > 0 ? <> · thiếu <b>{money(short)}</b></> : " · đủ tiền trả"}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        <CBtn primary onClick={() => void run({ type: "paydebt" })} disabled={busy || short > 0}>
          Trả nợ
        </CBtn>
        {onOpenAssets && (
          <span className="lg:hidden short:hidden">
            <CBtn build onClick={onOpenAssets} disabled={busy}>
              💰 Bán / thế chấp ↓
            </CBtn>
          </span>
        )}
        <ConfirmButton
          onConfirm={() => void run({ type: "bankrupt" })}
          disabled={busy}
          confirmLabel="Bấm lần nữa để phá sản"
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow enabled:hover:bg-rose-500 disabled:opacity-40 sm:text-sm"
        >
          Phá sản
        </ConfirmButton>
      </div>
    </div>
  );
}
