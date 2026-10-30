"use client";

import { MAP_LABEL, MAP_SIZES, type MapSize, START_CASH_OPTIONS, TIME_LIMIT_OPTIONS, GO_SALARY, GO_SALARY_OPTIONS, LAND_SALE_OPTIONS, UNMORTGAGE_FEE_OPTIONS } from "@/lib/typhu/board";
import { GameTabs } from "@/components/game-ui/GameTabs";
import { RankPointsPicker } from "@/components/games/RankPointsPicker";
import { STEP_SECONDS_OPTIONS, type TPRoomView } from "@/lib/typhu/protocol";
import { cn } from "@/lib/utils";
import { buildRuleText, money, type Act } from "../shared";

/** The table rules (host edits, everyone else reads). */
/** One-tap rule sets: what the group usually plays with 2 players / with more. */
const RULE_PRESETS = {
  two: { label: "⚡ Luật 2 người", hint: "Dừng Khởi hành ×2 · đến khi còn 1 người · 45 giây/bước", rules: { doubleGo: true, timeLimit: 0, stepSeconds: 45 } },
  many: {
    label: "⚡ Luật 3+ người",
    hint: "Như 2 người + ván 45 phút · xây theo chuỗi · không cần đủ nhóm (tối đa 3 nhà)",
    rules: { doubleGo: true, timeLimit: 45, stepSeconds: 45, buildRule: "chain" as const, needGroup: false },
  },
};

export function TableSettings({ view, isHost, act, className }: { view: TPRoomView; isHost: boolean; act: Act; className?: string }) {
  const count = view.seats.filter(Boolean).length;
  const suggested = count > 2 ? "many" : "two";
  return (
    <div className={className}>
      <div className="mb-2 rounded-lg bg-white/50 p-2 text-emerald-950">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-900/60">Luật nhanh</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(RULE_PRESETS) as (keyof typeof RULE_PRESETS)[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={!isHost}
              title={RULE_PRESETS[k].hint}
              onClick={() => void act({ type: "settings", ...RULE_PRESETS[k].rules })}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-9",
                k === suggested ? "border-emerald-700 bg-emerald-700 text-white enabled:hover:bg-emerald-800" : "border-emerald-900/25 bg-white enabled:hover:bg-emerald-50",
              )}
            >
              {RULE_PRESETS[k].label}
              {k === suggested && <span className="ml-1 font-normal opacity-80">(hợp với {count} người)</span>}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-emerald-900/60">{RULE_PRESETS[suggested].hint}</p>
      </div>
        <GameTabs
          light
          className="text-emerald-950"
          tabs={[
            {
              id: "money",
              label: "💰 Tiền",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Tiền khởi đầu</span>
                    <select
                      value={view.settings.startCash}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", startCash: Number(e.target.value) })}
                      className={SELECT}
                    >
                      {START_CASH_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {money(v)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SettingSelect
                    label="Qua Khởi hành nhận"
                    value={view.settings.goSalary ?? GO_SALARY}
                    options={GO_SALARY_OPTIONS.map((v) => [v, money(v)])}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", goSalary: v })}
                  />
                  <Toggle
                    label={`Dừng đúng Khởi hành nhận gấp đôi (${money((view.settings.goSalary ?? GO_SALARY) * 2)})`}
                    checked={!!view.settings.doubleGo}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", doubleGo: v })}
                  />
                  <Toggle
                    label="Quỹ Nghỉ chân ☕: thuế & tiền phạt dồn vào, ai dừng đó hốt hết"
                    checked={!!view.settings.parkingPot}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", parkingPot: v })}
                  />
                  <SettingSelect
                    label="Phí chuộc thế chấp"
                    value={view.settings.unmortgageFee ?? 10}
                    options={UNMORTGAGE_FEE_OPTIONS.map((v) => [v, v ? `+${v}%` : "Không phí"])}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", unmortgageFee: v })}
                  />
                  <SettingSelect
                    label="Bán đất cho ngân hàng được"
                    value={view.settings.landSalePct ?? 70}
                    options={LAND_SALE_OPTIONS.map((v) => [v, `${v}% giá đất`])}
                    disabled={!isHost || !view.settings.sellLand}
                    onChange={(v) => void act({ type: "settings", landSalePct: v })}
                  />
                </div>
              ),
            },
            {
              id: "map",
              label: "🗺️ Bản đồ",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Kích thước bản đồ</span>
                    <select
                      value={view.settings.map ?? "std"}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", map: e.target.value as MapSize })}
                      className={SELECT}
                    >
                      {MAP_SIZES.map((m) => (
                        <option key={m} value={m}>
                          {MAP_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] leading-snug text-emerald-900/60">
                    Bản đồ lớn thêm ô giữa các cạnh: thêm đất cho các nhóm màu (Sóc Trăng, Pleiku, Mộc Châu, Cát Bà… ), thêm ô Cơ hội / Khí vận và thuế. Đổi trước khi bắt đầu ván.
                  </p>
                </div>
              ),
            },
            {
              id: "time",
              label: "⏱️ Lượt",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Giới hạn ván</span>
                    <select
                      value={view.settings.timeLimit}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", timeLimit: Number(e.target.value) })}
                      className={SELECT}
                    >
                      {TIME_LIMIT_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v ? `${v} phút` : "Đến khi còn 1 người"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span>Thời gian mỗi bước</span>
                    <select
                      value={view.settings.stepSeconds ?? 30}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", stepSeconds: Number(e.target.value) })}
                      className={SELECT}
                    >
                      {STEP_SECONDS_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v} giây
                        </option>
                      ))}
                    </select>
                  </label>
                  <Toggle
                    label="Tung đôi được tung tiếp (đôi 3 lần liền vào tù)"
                    checked={view.settings.doubleRoll !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", doubleRoll: v })}
                  />
                  <Toggle
                    label="Đang ở tù vẫn thu tiền thuê"
                    checked={view.settings.jailRent !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", jailRent: v })}
                  />
                </div>
              ),
            },
            {
              id: "house",
              label: "🏠 Luật nhà",
              content: (
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span>Luật xây nhà</span>
                    <select
                      value={view.settings.buildRule ?? "even"}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", buildRule: e.target.value as "even" | "chain" })}
                      className={SELECT}
                    >
                      <option value="even">Xây đều</option>
                      <option value="chain">Xây theo chuỗi</option>
                    </select>
                  </label>
                  <p className="text-[11px] leading-snug text-emerald-900/60">{buildRuleText(view.settings)}</p>
                  <Toggle
                    label="Phải đủ cả nhóm màu mới được xây"
                    checked={view.settings.needGroup !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", needGroup: v })}
                  />
                  <Toggle
                    label="Giá nhà tăng dần (căn sau +25%, khách sạn ×2)"
                    checked={view.settings.risingCost !== false}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", risingCost: v })}
                  />
                  <Toggle
                    label={`Cho bán đất cho ngân hàng (${view.settings.landSalePct ?? 70}% giá, đất về chợ)`}
                    checked={!!view.settings.sellLand}
                    disabled={!isHost}
                    onChange={(v) => void act({ type: "settings", sellLand: v })}
                  />
                  {/* A server from before auctions sends no `auction` setting: it would ack the switch and ignore it. */}
                  <Toggle
                    label="Đấu giá 🔨: ô không ai mua đem ra đấu giá, ai cũng trả giá được (khởi điểm 50% giá đất, 15 giây, tiền mặt)"
                    checked={view.settings.auction === true}
                    disabled={!isHost || view.settings.auction === undefined}
                    onChange={(v) => void act({ type: "settings", auction: v })}
                  />
                  {view.settings.auction === undefined && <p className="text-[11px] leading-snug text-emerald-900/60">Máy chủ chưa hỗ trợ đấu giá.</p>}
                  <label className="flex items-center justify-between gap-2">
                    <span>Đất của người phá sản</span>
                    <select
                      value={view.settings.bankruptTo ?? "bank"}
                      disabled={!isHost}
                      onChange={(e) => void act({ type: "settings", bankruptTo: e.target.value as "bank" | "creditor" })}
                      className={SELECT}
                    >
                      <option value="bank">Về ngân hàng — mua lại được</option>
                      <option value="creditor">Về tay chủ nợ</option>
                    </select>
                  </label>
                </div>
              ),
            },
            {
              id: "points",
              label: "🏆 Điểm",
              content: (
                <RankPointsPicker
                  first={view.settings.first ?? 2}
                  second={view.settings.second ?? 1}
                  players={count}
                  editable={isHost}
                  onChange={(v) => void act({ type: "settings", ...v })}
                  className="[&_select]:bg-white [&_select]:text-emerald-950"
                />
              ),
            },
          ]}
        />
      {!isHost && <p className="mt-1 text-xs text-emerald-900/50">Chỉ chủ bàn đổi được luật.</p>}
    </div>
  );
}

const SELECT = "rounded-md border border-emerald-900/20 bg-white px-2 py-0.5 disabled:opacity-60 max-sm:min-h-9 short:min-h-8";

function SettingSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  options: [number, string][];
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SELECT}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-center justify-between gap-2", !disabled && "cursor-pointer")}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0 accent-emerald-700" />
    </label>
  );
}
