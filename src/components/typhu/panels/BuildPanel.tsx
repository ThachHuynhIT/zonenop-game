"use client";

import { GROUP_COLORS, MAX_HOUSES, type Square, houseCost } from "@/lib/typhu/board";
import { type TPGameView, type TPPlayerView, type TPSettings } from "@/lib/typhu/protocol";
import { boardRef, groupPositions } from "../board-ref";
import { ALL_GROUPS, Building, GROUP_NAMES, Modal, buildRuleText, buildableGroups, money, type Act } from "../shared";

/** Build on every group you can build in, without hunting for the squares on the board. Selling / mortgaging lives in AssetPanel. */
export function BuildPanel({
  g,
  mine,
  settings,
  busy,
  run,
  onClose,
  onOpenAssets,
}: {
  g: TPGameView;
  mine: TPPlayerView;
  settings: TPSettings;
  busy: boolean;
  run: Act;
  onClose: () => void;
  onOpenAssets: () => void;
}) {
  const needGroup = settings.needGroup !== false;
  const groups = buildableGroups(g, mine.id, needGroup);
  const partial = needGroup ? ALL_GROUPS.filter((grp) => !groups.includes(grp) && groupPositions(grp).some((p) => g.deeds[p]?.owner === mine.id)) : [];
  return (
    <Modal onClose={onClose} dark>
      <h2 className="mb-1 text-lg font-bold text-amber-300">🏠 Xây nhà</h2>
      <p className="mb-3 text-xs text-sky-100/70">
        Tiền mặt: <b className="text-emerald-300">{money(mine.cash)}</b> · {buildRuleText(settings)}
      </p>
      {groups.length === 0 && <p className="text-sm text-sky-100/70">{needGroup ? "Bạn chưa sở hữu đủ nhóm màu nào." : "Bạn chưa có đất thành phố nào."}</p>}
      <div className="space-y-3">
        {groups.map((grp) => {
          const cells = groupPositions(grp);
          const anyMortgaged = cells.some((p) => g.deeds[p]?.owner === mine.id && g.deeds[p].mortgaged);
          return (
            <div key={grp} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between px-3 py-1.5 text-sm font-bold text-black" style={{ background: GROUP_COLORS[grp] }}>
                <span>Nhóm {GROUP_NAMES[grp]}</span>
                {anyMortgaged && <span className="rounded bg-black/30 px-1.5 text-[11px] text-white">có ô đang thế chấp</span>}
              </div>
              <ul className="divide-y divide-white/5">
                {cells.map((pos) => {
                  const sq = boardRef.current[pos] as Extract<Square, { kind: "prop" }>;
                  const d = g.deeds[pos];
                  if (!d || d.owner !== mine.id) {
                    return (
                      <li key={pos} className="flex items-center gap-2 px-3 py-2 text-sm text-sky-100/45">
                        <span className="min-w-0 flex-1 truncate">{sq.name}</span>
                        <span className="shrink-0 text-[11px]">{d ? "của người khác" : "chưa có chủ"}</span>
                      </li>
                    );
                  }
                  const buildWhy = g.manage?.[pos]?.build ?? null;
                  const full = d.houses >= MAX_HOUSES;
                  return (
                    <li key={pos} className="px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <b className="block truncate">{sq.name}</b>
                          <span className="flex h-5 items-end gap-0.5">
                            {d.mortgaged ? (
                              <span className="text-[11px] font-semibold text-rose-300">Đang thế chấp</span>
                            ) : d.houses === 0 ? (
                              <span className="text-[11px] text-sky-100/50">Đất trống · thuê {money(sq.rent[0])}</span>
                            ) : d.houses === MAX_HOUSES ? (
                              <Building hotel className="h-4" />
                            ) : (
                              Array.from({ length: d.houses }, (_, i) => <Building key={i} className="h-4" />)
                            )}
                            {d.houses > 0 && <span className="ml-1 text-[11px] text-sky-100/60">thuê {money(sq.rent[d.houses])}</span>}
                          </span>
                        </span>
                        {full ? (
                          <span className="shrink-0 text-[11px] font-semibold text-amber-200">🏨 Tối đa</span>
                        ) : (
                          <button
                            onClick={() => void run({ type: "build", pos })}
                            disabled={busy || !!buildWhy}
                            title={buildWhy ?? undefined}
                            className="min-h-9 shrink-0 whitespace-nowrap rounded-lg bg-emerald-500 px-3 py-1 text-xs font-bold text-black enabled:hover:bg-emerald-400 disabled:opacity-30"
                          >
                            + {d.houses === MAX_HOUSES - 1 ? "Khách sạn" : `Nhà ${d.houses + 1}`} · {money(houseCost(sq, d.houses + 1, settings))}
                          </button>
                        )}
                      </div>
                      {buildWhy && !full && <p className="mt-0.5 text-right text-[11px] text-sky-100/45">{buildWhy}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {partial.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-100/50">Còn thiếu để xây</p>
          <ul className="space-y-1 text-xs text-sky-100/70">
            {partial.map((grp) => (
              <li key={grp} className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: GROUP_COLORS[grp] }} />
                Nhóm {GROUP_NAMES[grp]}: còn thiếu{" "}
                {groupPositions(grp)
                  .filter((p) => g.deeds[p]?.owner !== mine.id)
                  .map((p) => boardRef.current[p].name)
                  .join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        onClick={() => {
          onClose();
          onOpenAssets();
        }}
        className="mt-4 w-full rounded-lg border border-amber-300/40 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"
      >
        💰 Bán nhà / thế chấp / bán đất →
      </button>
    </Modal>
  );
}
