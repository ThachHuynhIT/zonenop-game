"use client";

// `m` (not `motion`): the root LazyMotion is strict, which throws on the full `motion` component.
import { m as motion } from "motion/react";
import { LOAN_TURNS, type TPGameView, type TradeSide } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { boardRef } from "../board-ref";
import { useSecondsLeft } from "../now";
import { money } from "../shared";

// ─── Loans ──────────────────────────────────────────────────────────

export function LoanCard({ loan, nameOf, incoming, outgoing, onAnswer }: { loan: NonNullable<TPGameView["loan"]>; nameOf: (id: string) => string; incoming: boolean; outgoing: boolean; onAnswer: (accept: boolean) => void }) {
  const seconds = useSecondsLeft()(loan.deadline) ?? 0;
  const owed = loan.amount + Math.ceil((loan.amount * loan.rate) / 100);
  return (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn("rounded-2xl p-3 text-sm text-white shadow-lg", incoming ? "bg-amber-950/95 ring-2 ring-amber-300" : "bg-emerald-950/90")}>
      <p className="mb-1 font-semibold">
        🏦 {nameOf(loan.from)} xin vay {nameOf(loan.to)} <span className="font-mono text-xs text-white/60">({seconds}s)</span>
      </p>
      <p className="text-xs">
        Vay <b>{money(loan.amount)}</b>, lãi {loan.rate}% — trả <b className="text-amber-200">{money(owed)}</b> sau {LOAN_TURNS} lượt của người vay.
      </p>
      {incoming && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onAnswer(true)} className="flex-1 rounded-lg bg-emerald-500 px-3 py-1 font-semibold text-black hover:bg-emerald-400 max-sm:min-h-10">
            Cho vay
          </button>
          <button onClick={() => onAnswer(false)} className="flex-1 rounded-lg border border-white/30 px-3 py-1 hover:bg-white/10 max-sm:min-h-10">
            Từ chối
          </button>
        </div>
      )}
      {outgoing && (
        <button onClick={() => onAnswer(false)} className="mt-2 w-full rounded-lg border border-white/30 px-3 py-1 text-xs hover:bg-white/10 max-sm:min-h-9">
          Rút lời xin vay
        </button>
      )}
    </motion.div>
  );
}

// ─── Trading ────────────────────────────────────────────────────────

export function TradeCard({
  trade,
  nameOf,
  incoming,
  outgoing,
  deadline,
  onAnswer,
}: {
  trade: NonNullable<TPGameView["trade"]>;
  nameOf: (id: string) => string;
  incoming: boolean;
  outgoing: boolean;
  deadline: number;
  onAnswer: (accept: boolean) => void;
}) {
  const seconds = useSecondsLeft()(deadline) ?? 0;
  const side = (s: TradeSide) =>
    [...s.props.map((p) => boardRef.current[p].name), s.cash ? money(s.cash) : null].filter(Boolean).join(", ") || "không gì";
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("rounded-2xl p-3 text-sm text-white shadow-lg", incoming ? "bg-amber-950/95 ring-2 ring-amber-300" : "bg-emerald-950/90")}
    >
      <p className="mb-1 font-semibold">
        🤝 {nameOf(trade.from)} → {nameOf(trade.to)} <span className="font-mono text-xs text-white/60">({seconds}s)</span>
      </p>
      <p className="text-xs">
        <span className="text-white/60">Đưa:</span> {side(trade.give)}
      </p>
      <p className="text-xs">
        <span className="text-white/60">Đổi lấy:</span> {side(trade.get)}
      </p>
      {incoming && (
        <div className="mt-2 flex gap-2">
          <button onClick={() => onAnswer(true)} className="flex-1 rounded-lg bg-emerald-500 px-3 py-1 font-semibold max-sm:min-h-10 text-black hover:bg-emerald-400">
            Đồng ý
          </button>
          <button onClick={() => onAnswer(false)} className="flex-1 rounded-lg border border-white/30 px-3 py-1 hover:bg-white/10 max-sm:min-h-10">
            Từ chối
          </button>
        </div>
      )}
      {outgoing && (
        <button onClick={() => onAnswer(false)} className="mt-2 w-full rounded-lg border border-white/30 px-3 py-1 text-xs hover:bg-white/10">
          Rút lời mời
        </button>
      )}
    </motion.div>
  );
}
