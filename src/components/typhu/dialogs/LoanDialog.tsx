"use client";

import { useState } from "react";
import { LOAN_RATES, LOAN_TURNS, type TPGameView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { Modal, money, type Act } from "../shared";

export function LoanModal({ g, meId, nameOf, run, onClose }: { g: TPGameView; meId: string; nameOf: (id: string) => string; run: Act; onClose: () => void }) {
  const others = g.players.filter((p) => p.id !== meId && !p.bankrupt);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [amount, setAmount] = useState(100);
  const [rate, setRate] = useState(LOAN_RATES[0]);
  const lender = g.players.find((p) => p.id === to);
  const open = (g.loans ?? []).filter((l) => l.borrower === meId).length;
  const owed = amount + Math.ceil((amount * rate) / 100);
  const bad = !to ? "Chọn người cho vay" : amount < 10 ? "Vay tối thiểu 10tr" : amount > (lender?.cash ?? 0) ? `${nameOf(to)} chỉ có ${money(lender?.cash ?? 0)}` : open >= 2 ? "Bạn đã vay tối đa 2 khoản" : null;
  const send = async () => {
    if (await run({ type: "loan", to, amount, rate })) onClose();
  };
  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-3 text-lg font-bold text-amber-300">🏦 Vay tiền người chơi</h2>
      {others.length === 0 ? (
        <p className="text-sm">Không còn ai để vay.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/60">Vay của</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1.5">
              {others.map((p) => (
                <option key={p.id} value={p.id} className="text-black">
                  {nameOf(p.id)} ({money(p.cash)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-white/60">Số tiền vay</span>
            <input
              type="number"
              min={10}
              max={lender?.cash ?? 0}
              step={10}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="min-h-9 w-24 rounded-md bg-white/10 px-2 py-1 font-mono text-sm"
            />
            <span className="text-white/40">tr</span>
          </label>
          <div role="radiogroup" aria-label="Lãi suất" className="flex items-center gap-2 text-xs">
            <span className="text-white/60">Lãi</span>
            {LOAN_RATES.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={rate === r}
                onClick={() => setRate(r)}
                className={cn("min-h-9 rounded-lg border px-3 font-semibold", rate === r ? "border-amber-300 bg-amber-400/20 text-amber-200" : "border-white/20 hover:bg-white/10")}
              >
                {r}%
              </button>
            ))}
          </div>
          <p className="rounded-lg bg-white/5 px-3 py-2 text-xs">
            Sau <b>{LOAN_TURNS} lượt</b> của bạn phải trả <b className="text-base text-amber-300">{money(owed)}</b> (gốc {money(amount)} + lãi {money(owed - amount)}). Không đủ tiền thì phải bán / thế chấp hoặc phá sản.
          </p>
          {bad && <p className="text-xs text-rose-300">{bad}</p>}
          <button onClick={() => void send()} disabled={!!bad} className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-40">
            Gửi lời xin vay
          </button>
        </div>
      )}
    </Modal>
  );
}
