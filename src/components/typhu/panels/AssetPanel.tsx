"use client";

import { GROUP_COLORS, MAX_HOUSES, type Ownable, type Square, houseRefund, mortgageValue, unmortgageCost } from "@/lib/typhu/board";
import { type TPGameView, type TPPlayerView, type TPSettings } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/games/ConfirmButton";
import { boardRef } from "../board-ref";
import { useSecondsLeft } from "../now";
import { ALL_GROUPS, Building, GROUP_NAMES, money, mortgageBlocker, type Act } from "../shared";

/**
 * Everything I own with the ways to raise cash (sell a house, mortgage, sell land) and to buy a mortgage back.
 * Lives in the side column, not over the board; while in debt it also shows what's still missing.
 */
export function AssetPanel({
  g,
  mine,
  settings,
  busy,
  run,
  deadline,
  onClose,
}: {
  g: TPGameView;
  mine: TPPlayerView;
  settings: TPSettings;
  busy: boolean;
  run: Act;
  deadline: number | null;
  /** Absent while in debt: the panel stays until the debt is settled. */
  onClose?: () => void;
}) {
  const seconds = useSecondsLeft()(deadline);
  const debt = g.phase === "debt" ? g.debt : null;
  const short = debt ? Math.max(0, debt.amount - mine.cash) : 0;
  const owned = Object.keys(g.deeds)
    .map(Number)
    .filter((pos) => g.deeds[pos].owner === mine.id)
    .sort((a, b) => a - b);
  // Cities by colour group, then airports / companies.
  const sections: { key: string; title: string; color?: string; cells: number[] }[] = [];
  for (const grp of ALL_GROUPS) {
    const cells = owned.filter((pos) => boardRef.current[pos].kind === "prop" && (boardRef.current[pos] as Extract<Square, { kind: "prop" }>).group === grp);
    if (cells.length) sections.push({ key: grp, title: `Nhóm ${GROUP_NAMES[grp]}`, color: GROUP_COLORS[grp], cells });
  }
  const others = owned.filter((pos) => boardRef.current[pos].kind !== "prop");
  if (others.length) sections.push({ key: "other", title: "Sân bay & công ty", cells: others });
  const sellLandOn = !!settings.sellLand;
  const fee = settings.unmortgageFee ?? 10;
  const btn = "min-h-8 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-30 sm:text-xs";

  return (
    <section
      aria-label="Thế chấp / bán tài sản"
      className={cn("rounded-2xl border p-3 short:p-2", debt ? "border-rose-400/70 bg-[#2a0f12]/90 shadow-[0_0_24px_rgba(244,63,94,0.3)]" : "border-amber-300/30 bg-black/45")}
    >
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-sm font-bold text-amber-300">💰 Thế chấp / Bán</p>
        {onClose && (
          <button onClick={onClose} aria-label="Đóng" className="grid size-9 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white lg:size-7">
            ✕
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-sky-100/75">
        Tiền mặt <b className="text-emerald-300">{money(mine.cash)}</b>
        {debt && (
          <>
            {" "}
            · nợ <b className="text-rose-200">{money(debt.amount)}</b>
            {short > 0 ? (
              <>
                {" "}
                · còn thiếu <b className="text-amber-300">{money(short)}</b>
              </>
            ) : (
              <b className="text-emerald-300"> · đủ tiền trả</b>
            )}
            {seconds !== null && <span className="ml-1 font-mono text-rose-200/80">⏱ {seconds}s</span>}
          </>
        )}
      </p>
      {debt && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          <button onClick={() => void run({ type: "paydebt" })} disabled={busy || short > 0} className={cn(btn, "bg-emerald-500 px-3 text-black enabled:hover:bg-emerald-400")}>
            Trả nợ
          </button>
          <ConfirmButton
            onConfirm={() => void run({ type: "bankrupt" })}
            disabled={busy}
            confirmLabel="Bấm lần nữa để phá sản"
            className={cn(btn, "bg-rose-600 px-3 text-white enabled:hover:bg-rose-500")}
          >
            Phá sản
          </ConfirmButton>
          <span className="w-full text-[11px] text-rose-100/55">Hết giờ thì máy tự bán nhà / thế chấp rồi trả.</span>
        </div>
      )}
      {owned.length === 0 && <p className="text-xs text-sky-100/60">Bạn không còn đất nào.</p>}
      <div className="space-y-2 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto lg:pr-0.5">
        {sections.map((sec) => (
          <div key={sec.key} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <p className="px-2 py-1 text-xs font-bold text-black" style={{ background: sec.color ?? "#cfe8d8" }}>
              {sec.title}
            </p>
            <ul className="divide-y divide-white/5">
              {sec.cells.map((pos) => {
                const sq = boardRef.current[pos] as Ownable;
                const d = g.deeds[pos];
                const m = g.manage?.[pos];
                const sellWhy = m?.sell ?? null;
                const mortWhy = mortgageBlocker(g, mine.id, pos);
                const unmortCost = unmortgageCost(sq, settings);
                return (
                  <li key={pos} className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 text-xs">
                    <span className="min-w-0 flex-1 basis-28">
                      <b className="block truncate text-[13px]">{sq.name}</b>
                      <span className="flex h-4 items-end gap-0.5 text-[11px] text-sky-100/55">
                        {d.mortgaged ? (
                          <span className="font-semibold text-rose-300">Đang thế chấp</span>
                        ) : d.houses === 0 ? (
                          "Đất trống"
                        ) : d.houses === MAX_HOUSES ? (
                          <Building hotel className="h-3.5" />
                        ) : (
                          Array.from({ length: d.houses }, (_, i) => <Building key={i} className="h-3.5" />)
                        )}
                      </span>
                    </span>
                    {sq.kind === "prop" && d.houses > 0 && (
                      <button
                        onClick={() => void run({ type: "sell", pos })}
                        disabled={busy || !!sellWhy}
                        title={sellWhy ?? `Bán ${d.houses === MAX_HOUSES ? "khách sạn" : `nhà ${d.houses}`}, nhận ${money(houseRefund(sq, d.houses, settings))} (nửa giá đã xây)`}
                        className={cn(btn, "border border-white/20 enabled:hover:bg-white/10")}
                      >
                        🏚️ Bán nhà +{money(houseRefund(sq, d.houses, settings))}
                      </button>
                    )}
                    {!d.mortgaged && d.houses === 0 && (
                      <button
                        onClick={() => void run({ type: "mortgage", pos })}
                        disabled={busy || !!mortWhy}
                        title={mortWhy ?? `Thế chấp, nhận ${money(mortgageValue(sq))}`}
                        className={cn(btn, "border border-sky-300/40 text-sky-100 enabled:hover:bg-sky-400/10")}
                      >
                        🏦 Thế chấp +{money(mortgageValue(sq))}
                      </button>
                    )}
                    {d.mortgaged && (
                      <button
                        onClick={() => void run({ type: "unmortgage", pos })}
                        disabled={busy || !!debt || mine.cash < unmortCost}
                        title={debt ? "Đang nợ — chưa chuộc được" : `Chuộc lại: ${money(mortgageValue(sq))} + ${fee}% phí = ${money(unmortCost)}`}
                        className={cn(btn, "border border-emerald-300/40 text-emerald-200 enabled:hover:bg-emerald-400/10")}
                      >
                        Chuộc −{money(unmortCost)} {fee > 0 && <span className="font-normal opacity-70">(+{fee}%)</span>}
                      </button>
                    )}
                    {sellLandOn && m && d.houses === 0 && (
                      <ConfirmButton
                        onConfirm={() => void run({ type: "sellland", pos })}
                        disabled={busy || !!m.sellLand}
                        title={m.sellLand ?? `Bán đất cho ngân hàng, nhận ${money(m.landPrice)} — đất về chợ`}
                        confirmLabel={`Bán lấy ${money(m.landPrice)}?`}
                        className={cn(btn, "border border-amber-300/40 text-amber-200 enabled:hover:bg-amber-400/10")}
                      >
                        🏷️ Bán đất +{money(m.landPrice)}
                      </ConfirmButton>
                    )}
                    {sq.kind === "prop" && d.houses > 0 && sellWhy && <span className="w-full text-right text-[10px] text-sky-100/45">{sellWhy}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-sky-100/45">
        Bán nhà được nửa giá căn đó. Thế chấp nhận 50% giá đất{fee > 0 ? `, chuộc lại phải trả thêm ${fee}%` : ", chuộc lại đúng giá đó"}.
        {sellLandOn ? ` Bán đất được ${settings.landSalePct ?? 70}% giá${(settings.landSalePct ?? 70) > 50 ? " (hơn thế chấp)" : ""} nhưng mất đất — đất về chợ cho người khác mua. Đất đang thế chấp vẫn bán được, chỉ nhận phần chênh.` : ""}
      </p>
    </section>
  );
}
