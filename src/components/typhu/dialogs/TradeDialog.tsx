"use client";

import { useState } from "react";
import { GROUP_COLORS, MAX_HOUSES } from "@/lib/typhu/board";
import { type TPGameView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { boardRef } from "../board-ref";
import { Modal, money, type Act } from "../shared";

export function TradeModal({ g, meId, nameOf, run, onClose }: { g: TPGameView; meId: string; nameOf: (id: string) => string; run: Act; onClose: () => void }) {
  const others = g.players.filter((p) => p.id !== meId && !p.bankrupt);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [giveCash, setGiveCash] = useState(0);
  const [getCash, setGetCash] = useState(0);
  const me = g.players.find((p) => p.id === meId);
  const them = g.players.find((p) => p.id === to);

  // Built lots trade too — the houses go with the land.
  const tradable = (owner: string) =>
    Object.entries(g.deeds)
      .filter(([, d]) => d.owner === owner)
      .map(([pos]) => Number(pos))
      .sort((a, b) => a - b);

  const toggle = (list: number[], set: (v: number[]) => void, pos: number) => set(list.includes(pos) ? list.filter((x) => x !== pos) : [...list, pos]);

  const Picker = ({ owner, list, set }: { owner: string; list: number[]; set: (v: number[]) => void }) => {
    const props = tradable(owner);
    if (!props.length) return <p className="text-xs text-white/50">Không có đất để đổi.</p>;
    return (
      <div className="flex flex-wrap gap-1">
        {props.map((pos) => {
          const sq = boardRef.current[pos];
          const on = list.includes(pos);
          return (
            <button
              key={pos}
              onClick={() => toggle(list, set, pos)}
              aria-pressed={on}
              className={cn(
                "min-h-8 rounded-md px-2 py-1 text-xs font-semibold text-black transition-[opacity,box-shadow]",
                on ? "ring-2 ring-white ring-offset-1 ring-offset-[#0c2233]" : "opacity-55 saturate-50 hover:opacity-80",
              )}
              style={{ background: sq.kind === "prop" ? GROUP_COLORS[sq.group] : "#e5e7eb" }}
            >
              {on && "✓ "}
              {sq.name}
              {g.deeds[pos].houses > 0 && ` ${g.deeds[pos].houses === MAX_HOUSES ? "🏨" : `🏠${g.deeds[pos].houses}`}`}
              {g.deeds[pos].mortgaged && " (TC)"}
            </button>
          );
        })}
      </div>
    );
  };

  const send = async () => {
    if (await run({ type: "trade", to, give: { props: give, cash: giveCash }, get: { props: get, cash: getCash } })) onClose();
  };

  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-3 text-lg font-bold text-amber-300">🤝 Đổi đất / mua bán</h2>
      {others.length === 0 ? (
        <p className="text-sm">Không còn ai để đổi.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-white/60">Đổi với</span>
            <select
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setGet([]);
                setGetCash(0);
              }}
              className="mt-1 min-h-10 w-full rounded-lg bg-white/10 px-2 py-1.5"
            >
              {others.map((p) => (
                <option key={p.id} value={p.id} className="text-black">
                  {nameOf(p.id)} ({money(p.cash)})
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="mb-1 text-xs text-white/60">Bạn đưa</p>
            <Picker owner={meId} list={give} set={setGive} />
            <CashInput value={giveCash} max={me?.cash ?? 0} onChange={setGiveCash} />
          </div>
          <div>
            <p className="mb-1 text-xs text-white/60">Bạn nhận từ {nameOf(to)}</p>
            <Picker owner={to} list={get} set={setGet} />
            <CashInput value={getCash} max={them?.cash ?? 0} onChange={setGetCash} />
          </div>
          <p className="text-xs text-white/50">Đất đang thế chấp (TC) chuyển nguyên trạng. Người kia có 30 giây để trả lời.</p>
          <button
            onClick={() => void send()}
            disabled={!to || (!give.length && !get.length)}
            className="w-full rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
          >
            Gửi lời mời
          </button>
        </div>
      )}
    </Modal>
  );
}

function CashInput({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="mt-1 flex items-center gap-2 text-xs">
      <span className="text-white/60">+ tiền</span>
      <input
        type="number"
        min={0}
        max={max}
        step={10}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(max, Math.floor(Number(e.target.value) || 0))))}
        className="min-h-9 w-24 rounded-md bg-white/10 px-2 py-1 font-mono"
      />
      <span className="text-white/40">tr (tối đa {money(max)})</span>
    </label>
  );
}
