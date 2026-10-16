import { GamePanel } from "@/components/game-ui";
import { formatNumber, gameEmoji, gameName, share } from "./format";
import type { AdminStats } from "./types";

const TH = "whitespace-nowrap px-2 py-2 text-left text-xs font-bold text-white/55 first:pl-0 last:pr-0";
const TD = "px-2 py-2 align-middle first:pl-0 last:pr-0";
const NUM = "text-right tabular-nums";

/** A cell whose value also draws a thin bar under the label, scaled to the biggest row. */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-white/8">
      <span className="block h-full rounded-full bg-game-accent" style={{ width: `${share(value, max)}%` }} />
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-white/50">{children}</p>;
}

function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}

export function ByGameTable({ rows }: { rows: AdminStats["byGame"] }) {
  const sorted = [...rows].sort((a, b) => b.games - a.games);
  const max = sorted[0]?.games ?? 0;
  return (
    <GamePanel title="Theo game">
      {sorted.length === 0 ? (
        <Empty>Chưa có ván nào trong kỳ này.</Empty>
      ) : (
        <Scroll>
          <table className="w-full min-w-72 text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className={TH}>Game</th>
                <th className={`${TH} ${NUM}`}>Số ván</th>
                <th className={`${TH} ${NUM}`}>Người chơi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sorted.map((r) => (
                <tr key={r.game}>
                  <td className={`${TD} w-full`}>
                    <span className="flex items-center gap-2 font-bold">
                      <span aria-hidden>{gameEmoji(r.game)}</span>
                      {gameName(r.game)}
                    </span>
                    <Bar value={r.games} max={max} />
                  </td>
                  <td className={`${TD} ${NUM} font-bold`}>{formatNumber(r.games)}</td>
                  <td className={`${TD} ${NUM} text-white/75`}>{formatNumber(r.players)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
    </GamePanel>
  );
}

export function TopPagesTable({ rows }: { rows: AdminStats["topPages"] }) {
  const max = rows[0]?.views ?? 0;
  return (
    <GamePanel title="Trang xem nhiều">
      {rows.length === 0 ? (
        <Empty>Chưa có lượt xem nào trong kỳ này.</Empty>
      ) : (
        <Scroll>
          <table className="w-full min-w-72 text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className={TH}>Đường dẫn</th>
                <th className={`${TH} ${NUM}`}>Lượt xem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.path}>
                  <td className={`${TD} w-full max-w-0`}>
                    <span className="block truncate font-mono text-[0.8125rem] text-white/90" title={r.path}>
                      {r.path}
                    </span>
                    <Bar value={r.views} max={max} />
                  </td>
                  <td className={`${TD} ${NUM} font-bold`}>{formatNumber(r.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
    </GamePanel>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopPlayersTable({ rows }: { rows: AdminStats["topPlayers"] }) {
  return (
    <GamePanel title="Người chơi nhiều nhất">
      {rows.length === 0 ? (
        <Empty>Chưa ai chơi trong kỳ này.</Empty>
      ) : (
        <Scroll>
          <table className="w-full min-w-72 text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className={`${TH} w-8`}>
                  <span className="sr-only">Hạng</span>
                </th>
                <th className={TH}>Tên</th>
                <th className={`${TH} ${NUM}`}>Số ván</th>
                <th className={`${TH} ${NUM}`}>Điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r, i) => (
                <tr key={r.name}>
                  <td className={`${TD} text-center tabular-nums text-white/55`}>{MEDALS[i] ?? i + 1}</td>
                  <td className={`${TD} w-full max-w-0`}>
                    <span className="block truncate font-bold">{r.name}</span>
                  </td>
                  <td className={`${TD} ${NUM} text-white/75`}>{formatNumber(r.games)}</td>
                  <td className={`${TD} ${NUM} font-bold ${r.points < 0 ? "text-rose-300" : "text-game-accent"}`}>{formatNumber(r.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
    </GamePanel>
  );
}
