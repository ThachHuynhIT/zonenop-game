"use client";

import { AIR_RENT, GROUP_COLORS, JAIL_FINE, MAX_HOUSES, type Ownable, type Square, UTIL_MULT, houseCost, houseRefund, isOwnable, landSaleValue, mortgageValue, unmortgageCost } from "@/lib/typhu/board";
import { type TPGameView, type TPSettings } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { GameButton } from "@/components/game-ui/GameButton";
import { boardRef, groupPositions } from "../board-ref";
import { ArtIcon, Building, CBtn, Modal, money, mortgageBlocker, rentDue, squareImg, type Act } from "../shared";

// ─── Square details / management ────────────────────────────────────

export function SquareModal({
  pos,
  g,
  settings,
  meId,
  myTurn,
  nameOf,
  run,
  busy,
  onClose,
}: {
  pos: number;
  g: TPGameView | null;
  settings: TPSettings;
  meId: string;
  myTurn: boolean;
  nameOf: (id: string) => string;
  run: Act;
  busy: boolean;
  onClose: () => void;
}) {
  const sq = boardRef.current[pos];
  const deed = g?.deeds[pos];
  const mineHere = !!deed && deed.owner === meId && myTurn;
  const inDebt = g?.phase === "debt";
  const group = sq.kind === "prop" ? groupPositions(sq.group) : [];
  const ownsSet = sq.kind === "prop" && !!g && group.every((p) => g.deeds[p]?.owner === meId);
  const m = g?.manage?.[pos];
  const due = g ? rentDue(g, pos) : null;
  const buildWhy = inDebt ? "Đang nợ — không xây được" : m ? m.build : ownsSet ? null : "Sở hữu đủ cả nhóm màu mới được xây nhà.";

  return (
    <Modal onClose={onClose}>
      <div className="overflow-hidden rounded-xl bg-[#f4efe1] text-emerald-950">
        <div className="p-3 text-center" style={{ background: sq.kind === "prop" ? GROUP_COLORS[sq.group] : "#cfe8d8" }}>
          <p className="flex justify-center text-2xl">{squareImg(sq) ? <ArtIcon name={squareImg(sq)!} className="size-12" /> : "📍"}</p>
          <p className="text-lg font-black">{sq.name}</p>
          {sq.kind === "prop" && <p className="text-xs">{sq.region}</p>}
        </div>
        <div className="space-y-2 p-4 text-sm">
          {isOwnable(sq) ? <OwnableInfo sq={sq} settings={settings} activeRow={due?.row} /> : <p>{SQUARE_TEXT[sq.kind]?.(sq)}</p>}
          {sq.kind === "parking" && settings.parkingPot && (
            <p className="mt-2 rounded-lg bg-amber-300/90 px-3 py-2 font-semibold text-amber-950">
              💰 Quỹ đang giữ: {money(g?.pot ?? 0)}
              <span className="mt-0.5 block text-xs font-normal">Tiền phạt/thuế dồn vào đây — ai dừng ở Nghỉ chân sẽ lấy hết.</span>
            </p>
          )}
          {due && (
            <p className={cn("rounded-lg px-3 py-2 text-center", due.free ? "bg-emerald-200/70 text-emerald-900" : "bg-rose-100 text-rose-900 ring-1 ring-rose-300")}>
              <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-70">{deed?.owner === meId ? "Người khác dừng ở đây phải trả" : "Dừng ở đây phải trả"}</span>
              <b className="text-xl font-black">{due.text}</b>
            </p>
          )}
          {deed && (
            <p className="rounded bg-white/70 px-2 py-1">
              Chủ: <b>{nameOf(deed.owner)}</b>
              {deed.houses > 0 && <> · {deed.houses === MAX_HOUSES ? "1 khách sạn" : `${deed.houses} nhà`}</>}
              {deed.mortgaged && <b className="text-rose-700"> · đang thế chấp</b>}
            </p>
          )}
          {deed && deed.houses > 0 && (
            <div className="flex h-10 items-end justify-center gap-1 rounded bg-emerald-900/10 p-1">
              {deed.houses === MAX_HOUSES ? (
                <Building hotel className="h-full" />
              ) : (
                Array.from({ length: deed.houses }, (_, i) => <Building key={i} className="h-full" />)
              )}
            </div>
          )}
          {g && g.players.some((p) => p.pos === pos && !p.bankrupt) && (
            <p className="text-xs text-emerald-900/70">Đang đứng ở đây: {g.players.filter((p) => p.pos === pos && !p.bankrupt).map((p) => nameOf(p.id)).join(", ")}</p>
          )}
          {mineHere && isOwnable(sq) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {sq.kind === "prop" && !deed.mortgaged && deed.houses < MAX_HOUSES && (
                <CBtn primary onClick={() => void run({ type: "build", pos })} disabled={busy || !!buildWhy} title={buildWhy ?? undefined}>
                  🏠 Xây {deed.houses === MAX_HOUSES - 1 ? "khách sạn" : `nhà ${deed.houses + 1}`} ({money(houseCost(sq, deed.houses + 1, settings))})
                </CBtn>
              )}
              {sq.kind === "prop" && deed.houses > 0 && (
                <CBtn onClick={() => void run({ type: "sell", pos })} disabled={busy || !!m?.sell} title={m?.sell ?? undefined}>
                  Bán 1 nhà (+{money(houseRefund(sq, deed.houses, settings))})
                </CBtn>
              )}
              {!deed.mortgaged && deed.houses === 0 && g && (
                <CBtn onClick={() => void run({ type: "mortgage", pos })} disabled={busy || !!mortgageBlocker(g, meId, pos)} title={mortgageBlocker(g, meId, pos) ?? undefined}>
                  Thế chấp (+{money(mortgageValue(sq))})
                </CBtn>
              )}
              {m && settings.sellLand && deed.houses === 0 && (
                <GameButton
                  variant="danger"
                  size="sm"
                  confirm="Chắc chắn bán?"
                  onClick={() => void run({ type: "sellland", pos })}
                  disabled={busy || !!m.sellLand}
                  title={m.sellLand ?? "Đất về chợ, ai cũng mua lại được"}
                >
                  🏷️ Bán đất (+{money(m.landPrice)})
                </GameButton>
              )}
              {deed.mortgaged && (
                <CBtn onClick={() => void run({ type: "unmortgage", pos })} disabled={busy || inDebt}>
                  Chuộc lại ({money(unmortgageCost(sq, settings))}{settings.unmortgageFee !== 0 ? `, +${settings.unmortgageFee ?? 10}%` : ""})
                </CBtn>
              )}
            </div>
          )}
          {mineHere && sq.kind === "prop" && buildWhy && deed.houses < MAX_HOUSES && <p className="text-xs text-emerald-900/60">{buildWhy}</p>}
          {deed?.owner === meId && !myTurn && <p className="text-xs text-emerald-900/60">Xây nhà / thế chấp được trong lượt của bạn.</p>}
        </div>
      </div>
    </Modal>
  );
}

function OwnableInfo({ sq, settings, activeRow }: { sq: Ownable; settings: TPSettings; activeRow?: number | null }) {
  if (sq.kind === "prop") {
    const labels = ["Đất trống", "1 nhà", "2 nhà", "3 nhà", "4 nhà", "Khách sạn"];
    return (
      <>
        <p>
          Giá <b>{money(sq.price)}</b> · nhà đầu <b>{money(houseCost(sq, 1, settings))}</b>
          {settings.risingCost === false ? ", căn nào cũng giá đó" : ", mỗi căn sau đắt hơn 25%"}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-emerald-900/50">
              <th className="py-0.5 text-left font-semibold" />
              <th className="py-0.5 text-right font-semibold">Thuê</th>
              <th className="py-0.5 text-right font-semibold">Giá xây</th>
            </tr>
          </thead>
          <tbody>
            {sq.rent.map((r, i) => (
              <tr key={i} className={cn("border-b border-emerald-900/10", activeRow === i && "bg-amber-200/70 font-black")}>
                <td className="py-0.5">{labels[i]}</td>
                <td className="py-0.5 text-right font-mono">{money(r)}</td>
                <td className="py-0.5 text-right font-mono text-emerald-900/70">{i === 0 ? "—" : money(houseCost(sq, i, settings))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-emerald-900/70">
          Có đủ nhóm màu mà chưa xây: tiền thuê đất trống ×2. Thế chấp nhận {money(mortgageValue(sq))} (chuộc {money(unmortgageCost(sq, settings))}).
          {settings.sellLand && <> Bán đất cho ngân hàng: {money(landSaleValue(sq, settings))}.</>}
        </p>
      </>
    );
  }
  if (sq.kind === "air") {
    return (
      <>
        <p>
          Giá <b>{money(sq.price)}</b>
        </p>
        <p className="text-xs">
          Tiền thuê theo số sân bay cùng chủ:{" "}
          {AIR_RENT.map((r, i) => (
            <span key={i} className={cn(activeRow === i && "rounded bg-amber-200/70 px-1 font-black")}>
              {i > 0 && " · "}
              {i + 1} → {money(r)}
            </span>
          ))}
        </p>
      </>
    );
  }
  return (
    <>
      <p>
        Giá <b>{money(sq.price)}</b>
      </p>
      <p className="text-xs">
        Tiền thuê = tổng xúc xắc × {UTIL_MULT[0]} (có 1 công ty) hoặc × {UTIL_MULT[1]} (có cả điện lẫn nước).
      </p>
    </>
  );
}

const SQUARE_TEXT: Partial<Record<Square["kind"], (sq: Square) => string>> = {
  go: () => "Mỗi lần đi qua hoặc dừng ở đây nhận lương (mặc định 200tr, chủ bàn chỉnh được).",
  chance: () => "Rút một thẻ Cơ hội: có thể được tiền, phải di chuyển, hoặc vào tù.",
  chest: () => "Rút một thẻ Khí vận: phần lớn là tiền thưởng, đôi khi phải chi.",
  tax: (sq) => `Nộp ${money((sq as Extract<Square, { kind: "tax" }>).amount)} cho ngân hàng.`,
  jail: () => `Chỉ ghé thăm thì không sao. Ở tù: mỗi lượt tung đôi để ra, hoặc nộp ${money(JAIL_FINE)} / dùng thẻ ra tù. Sau 3 lượt phải nộp phạt.`,
  parking: () => "Nghỉ chân uống ly cà phê.",
  gotojail: () => "Đi thẳng vào tù, không qua Khởi hành.",
};
