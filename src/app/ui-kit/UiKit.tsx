"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Celebration, Countdown, GameBadge, GameButton, GameDialog, GamePanel, GameTabs, GameThemeScope, SeatChip, gameToast, type GameId } from "@/components/game-ui";
import { contrastRatio } from "@/components/game-ui/logic";
import { ONLINE_GAMES } from "@/components/games/gamesRegistry";
import { PROFILE_COLORS } from "@/components/games/gameClient";

const GAMES: (GameId | null)[] = [null, ...ONLINE_GAMES.map((g) => g.id)];

/** Resolve any CSS colour (oklch, color-mix…) to sRGB by painting one canvas pixel. */
function toRgb(color: string): [number, number, number] {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function ContrastTable() {
  const [rows, setRows] = useState<{ game: string; ratio: number }[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const probe = document.createElement("div");
      document.body.appendChild(probe);
      const next = GAMES.map((g) => {
        probe.setAttribute("data-game", g ?? "hub");
        probe.style.color = "var(--game-accent)";
        const accent = getComputedStyle(probe).color;
        probe.style.color = "var(--game-accent-fg)";
        const fg = getComputedStyle(probe).color;
        return { game: g ?? "hub", ratio: contrastRatio(toRgb(accent), toRgb(fg)) };
      });
      probe.remove();
      setRows(next);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((r) => (
        <li key={r.game} data-game={r.game} className="rounded-xl bg-game-accent px-3 py-2 text-game-accent-fg">
          <span className="font-bold">{r.game}</span>{" "}
          <span data-testid={`contrast-${r.game}`} className={r.ratio < 4.5 ? "font-extrabold underline" : ""}>
            {r.ratio.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function UiKit() {
  const [game, setGame] = useState<GameId | null>("tienlen");
  const [dialog, setDialog] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [points, setPoints] = useState(12);
  const [celebrate, setCelebrate] = useState({ playing: true, show: false });
  // Set after mount: a Date.now() during render would differ between server and client.
  useEffect(() => {
    const t = setTimeout(() => setDeadline(Date.now() + 20_000), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="game-shell min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#1e1633_0%,#0a0810_70%)] text-white">
      <GameThemeScope game={game} className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div data-testid="kit-root" className="flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <GameButton key={g ?? "hub"} size="sm" variant={g === game ? "primary" : "secondary"} onClick={() => setGame(g)}>
              {g ?? "hub"}
            </GameButton>
          ))}
        </div>

        <GamePanel title="Tương phản màu nhấn / chữ (≥ 4.5)" icon="🎨">
          <ContrastTable />
        </GamePanel>

        <GamePanel title="Nút" icon="🔘">
          {(["sm", "md", "lg"] as const).map((size) => (
            <div key={size} className="mb-3 flex flex-wrap items-center gap-3">
              <GameButton size={size} variant="primary" shine>
                Chơi ngay
              </GameButton>
              <GameButton size={size}>Mời bạn</GameButton>
              <GameButton size={size} variant="danger" confirm="Chắc chắn?" onClick={() => gameToast.error("Đã rời bàn")}>
                Rời bàn
              </GameButton>
              <GameButton size={size} variant="ghost">
                Luật chơi
              </GameButton>
              <GameButton size={size} variant="primary" loading>
                Đang tạo
              </GameButton>
              <GameButton size={size} disabled>
                Khoá
              </GameButton>
            </div>
          ))}
        </GamePanel>

        <GamePanel title="Huy hiệu và ghế" icon="🪑" tone="accent">
          <div className="mb-3 flex flex-wrap gap-2">
            <GameBadge tone="accent">Lượt của bạn</GameBadge>
            <GameBadge tone="success">Online</GameBadge>
            <GameBadge tone="warning" pulse>
              Sắp hết giờ
            </GameBadge>
            <GameBadge tone="danger">Phá sản</GameBadge>
            <GameBadge>3/4 người</GameBadge>
          </div>
          <div className="flex flex-wrap gap-3">
            <SeatChip name="Thạch" profile={{ icon: "😼", color: PROFILE_COLORS[0] }} points={points} isTurn isHost isYou />
            <SeatChip name="Lan" profile={{ icon: "", color: PROFILE_COLORS[4] }} points={-3} />
            <SeatChip name="Một cái tên rất dài để thử tràn" profile={{ icon: "🐼", color: PROFILE_COLORS[6] }} points={0} online={false} />
            <SeatChip name="Minh" profile={{ icon: "🦊", color: PROFILE_COLORS[2] }} size="sm" out />
          </div>
          <GameButton className="mt-3" size="sm" onClick={() => setPoints((p) => p + 5)}>
            +5 điểm
          </GameButton>
        </GamePanel>

        <GamePanel title="Đếm ngược, tab, hộp thoại" icon="⏱">
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <Countdown deadline={deadline} total={30_000} />
            <Countdown deadline={deadline} total={30_000} size={64} />
            <GameButton size="sm" onClick={() => setDeadline(Date.now() + 30_000)}>
              Đặt lại 30 s
            </GameButton>
            <GameButton size="sm" onClick={() => setDeadline(Date.now() + 6_000)}>
              Còn 6 s
            </GameButton>
          </div>
          <GameTabs
            className="mb-4"
            tabs={[
              { id: "rules", label: "Luật", content: <p>Đánh bài theo vòng, chặt heo…</p> },
              { id: "points", label: "Điểm", content: <p>Nhất +3, Nhì +1…</p> },
              { id: "other", label: "Khác", content: <p>Tự bỏ lượt khi không đánh được.</p> },
            ]}
          />
          <GameButton data-testid="open-dialog" variant="primary" onClick={() => setDialog(true)}>
            Mở hộp thoại
          </GameButton>
          <GameDialog
            open={dialog}
            onOpenChange={setDialog}
            title="Luật chơi"
            description="Trên điện thoại đây là bảng kéo từ dưới lên."
            footer={
              <GameButton variant="primary" onClick={() => setDialog(false)}>
                Đã hiểu
              </GameButton>
            }
          >
            <div data-testid="game-dialog-body" className="space-y-2">
              {Array.from({ length: 12 }, (_, i) => (
                <p key={i}>Dòng luật số {i + 1}.</p>
              ))}
            </div>
          </GameDialog>
        </GamePanel>

        <GamePanel title="Ăn mừng, thông báo" icon="🏆">
          <div className="flex flex-wrap gap-3">
            <GameButton
              variant="primary"
              onClick={() => {
                setCelebrate({ playing: true, show: false });
                setTimeout(() => setCelebrate({ playing: false, show: true }), 50);
              }}
            >
              Thắng
            </GameButton>
            <GameButton onClick={() => gameToast.success("Đã sao chép link mời")}>Toast</GameButton>
          </div>
          <Celebration playing={celebrate.playing} show={celebrate.show} won title="Ván đã kết thúc" />
        </GamePanel>
      </GameThemeScope>
      {/* /ui-kit is outside GamesShell, which normally mounts the toaster. */}
      <Toaster theme="dark" position="top-center" richColors visibleToasts={3} />
    </div>
  );
}
