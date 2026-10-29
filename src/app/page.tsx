import type { Metadata } from "next";
import Link from "next/link";
import { GamesShell } from "@/components/games/GamesShell";
import { ResumeBanner } from "@/components/games/ResumeBanner";

export const metadata: Metadata = {
  // Absolute: the root layout's "%s | Games" template would print "Games | Games".
  title: { absolute: "Games — chơi online cùng bạn bè" },
  description: "Các game mình tự làm: Tiến Lên Miền Nam, Mèo Nổ, Cờ Tỷ Phú, Đá Quý, Đấu Súng, Cờ Cá Ngựa, Ô Ăn Quan và Nối Chữ chơi online cùng bạn bè, cùng Contra phiên bản trình duyệt.",
};

interface GameCard {
  href: string;
  title: string;
  emoji: string;
  tagline: string;
  tags: string[];
  gradient: string;
}

const GAMES: GameCard[] = [
  {
    href: "/tien-len",
    title: "Tiến Lên Miền Nam",
    emoji: "🃏",
    tagline: "Đánh bài online 2–4 người: chặt heo, tới trắng, bảng xếp hạng, khán giả và emoji.",
    tags: ["Online", "2–4 người", "Realtime"],
    gradient: "from-emerald-500/30 via-emerald-700/20 to-transparent",
  },
  {
    href: "/meo-no",
    title: "Mèo Nổ",
    emoji: "😼",
    tagline: "Rút bài né bom, “Không!” chặn nhau, 6 gói mở rộng (16 combo dựng sẵn hoặc tự chọn) và hướng dẫn từng lá. Chơi 2–7 người.",
    tags: ["Online", "2–7 người", "6 gói mở rộng"],
    gradient: "from-orange-500/30 via-rose-700/20 to-transparent",
  },
  {
    href: "/co-ty-phu",
    title: "Cờ Tỷ Phú",
    emoji: "🎩",
    tagline: "Mua đất các tỉnh thành từ Quảng Ninh, Quảng Nam đến Kiên Giang… xây nhà, thu tiền thuê, đổi đất với bạn bè. Chơi 2–6 người.",
    tags: ["Online", "2–6 người", "Địa danh Việt Nam"],
    gradient: "from-lime-500/30 via-teal-700/20 to-transparent",
  },
  {
    href: "/splendor",
    title: "Đá Quý (Splendor)",
    emoji: "💎",
    tagline: "Lấy đá, mua thẻ, thu hút quý tộc — ai đạt điểm uy tín trước thì thắng. Chơi 2–4 người.",
    tags: ["Online", "2–4 người", "Chiến thuật"],
    gradient: "from-fuchsia-500/30 via-violet-700/20 to-transparent",
  },
  {
    href: "/bang",
    title: "Đấu Súng (Bang!)",
    emoji: "🤠",
    tagline: "Cảnh sát trưởng, Phó, Kẻ cướp, Kẻ phản bội — vai trò bí mật, 63 nhân vật và 7 bản mở rộng. Chơi 3–8 người.",
    tags: ["Online", "3–8 người", "Vai trò bí mật"],
    gradient: "from-amber-500/30 via-orange-800/20 to-transparent",
  },
  {
    href: "/co-ca-ngua",
    title: "Cờ Cá Ngựa",
    emoji: "🐴",
    tagline: "Gieo xúc xắc, xuất quân, đá ngựa đối thủ về chuồng và leo đủ 6 bậc — luật Việt Nam, chơi 2–4 người.",
    tags: ["Online", "2–4 người", "Xúc xắc"],
    gradient: "from-red-500/30 via-yellow-600/20 to-transparent",
  },
  {
    href: "/o-an-quan",
    title: "Ô Ăn Quan",
    emoji: "🪨",
    tagline: "Trò chơi dân gian: bốc sỏi rải từng ô, ăn liên tiếp, giành quan — chọn quan non, giá quan 5 hay 10 dân. Chơi 2–4 người.",
    tags: ["Online", "2–4 người", "Dân gian"],
    gradient: "from-yellow-600/30 via-amber-800/20 to-transparent",
  },
  {
    href: "/noi-chu",
    title: "Nối Chữ",
    emoji: "🔤",
    tagline: "Nối từ ghép 2 tiếng: tiếng đầu phải trùng tiếng cuối của từ trước, hết giờ là bị loại — người cuối cùng thắng. Chơi 2–8 người.",
    tags: ["Online", "2–8 người", "Từ ngữ"],
    gradient: "from-teal-500/30 via-cyan-800/20 to-transparent",
  },
  {
    href: "/contra",
    title: "Contra",
    emoji: "🔫",
    tagline: "Game bắn súng màn hình ngang kiểu 8-bit, chơi ngay trên trình duyệt.",
    tags: ["1 người", "Arcade", "Canvas"],
    gradient: "from-sky-500/30 via-indigo-700/20 to-transparent",
  },
];

/** Hub at `/`: the games layout (dark backdrop + GamesShell) is inlined here because it can't be a root layout. */
export default function GamesHubPage() {
  return (
    <div className="game-shell relative z-10 min-h-[100dvh] bg-[radial-gradient(ellipse_at_top,#1e1633_0%,#0a0810_70%)] text-white">
      <GamesShell>
    <main className="relative px-4 pb-10 pt-6 text-white sm:pt-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 text-center sm:mb-8">
          <p className="mb-2 text-3xl sm:mb-3 sm:text-4xl" aria-hidden>
            🎮
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            <span className="gradient-text">Games</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-white/70">
            Những game mình tự viết — chơi online với bạn bè hoặc giải trí một mình, ngay trên trình duyệt.
          </p>
        </header>

        <ResumeBanner />
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {GAMES.map((g) => (
            <li key={g.href}>
              <Link
                href={g.href}
                className="group relative flex h-full items-start gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07] sm:flex-col sm:gap-0 sm:p-6"
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${g.gradient} opacity-70 transition-opacity group-hover:opacity-100`} />
                <span className="relative text-4xl transition-transform group-hover:scale-110 sm:text-5xl" aria-hidden>
                  {g.emoji}
                </span>
                {/* Phones: emoji beside the text so all six games fit in a couple of screens. */}
                <div className="relative flex min-w-0 flex-1 flex-col self-stretch">
                  <h2 className="text-lg font-bold sm:mt-4 sm:text-xl">{g.title}</h2>
                  <p className="mt-1 flex-1 text-sm text-white/70 sm:mt-2">{g.tagline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4">
                    {g.tags.map((t) => (
                      <span key={t} className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-xs text-white/80">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="mt-5 hidden text-sm font-semibold text-amber-300 sm:block">Chơi ngay →</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
      </GamesShell>
    </div>
  );
}
