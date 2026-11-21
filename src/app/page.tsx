import type { Metadata } from "next";
import Link from "next/link";
import { GamesShell } from "@/components/games/GamesShell";
import { ResumeBanner } from "@/components/games/ResumeBanner";
import { PixelIcon } from "@/components/game-ui";
import type { GameId } from "@/components/games/gamesRegistry";
import styles from "./page.module.scss";

export const metadata: Metadata = {
  // Absolute: the root layout's "%s | Games" template would print "Games | Games".
  title: { absolute: "Games — chơi online cùng bạn bè" },
  description: "Các game mình tự làm: Tiến Lên Miền Nam, Mèo Nổ, Cờ Tỷ Phú, Đá Quý, Đấu Súng, Cờ Cá Ngựa, Ô Ăn Quan và Nối Chữ chơi online cùng bạn bè, cùng Contra phiên bản trình duyệt.",
};

interface GameCard {
  href: string;
  title: string;
  icon: GameId | "contra";
  tagline: string;
  tags: string[];
}

const GAMES: GameCard[] = [
  {
    href: "/tien-len",
    title: "Tiến Lên Miền Nam",
    icon: "tienlen",
    tagline: "Đánh bài online 2–4 người: chặt heo, tới trắng, bảng xếp hạng, khán giả và emoji.",
    tags: ["Online", "2–4 người", "Realtime"],
  },
  {
    href: "/meo-no",
    title: "Mèo Nổ",
    icon: "meono",
    tagline: "Rút bài né bom, “Không!” chặn nhau, 6 gói mở rộng (16 combo dựng sẵn hoặc tự chọn) và hướng dẫn từng lá. Chơi 2–7 người.",
    tags: ["Online", "2–7 người", "6 gói mở rộng"],
  },
  {
    href: "/co-ty-phu",
    title: "Cờ Tỷ Phú",
    icon: "typhu",
    tagline: "Mua đất các tỉnh thành từ Quảng Ninh, Quảng Nam đến Kiên Giang… xây nhà, thu tiền thuê, đổi đất với bạn bè. Chơi 2–6 người.",
    tags: ["Online", "2–6 người", "Địa danh Việt Nam"],
  },
  {
    href: "/splendor",
    title: "Đá Quý (Splendor)",
    icon: "splendor",
    tagline: "Lấy đá, mua thẻ, thu hút quý tộc — ai đạt điểm uy tín trước thì thắng. Chơi 2–4 người.",
    tags: ["Online", "2–4 người", "Chiến thuật"],
  },
  {
    href: "/bang",
    title: "Đấu Súng (Bang!)",
    icon: "bang",
    tagline: "Cảnh sát trưởng, Phó, Kẻ cướp, Kẻ phản bội — vai trò bí mật, 63 nhân vật và 7 bản mở rộng. Chơi 3–8 người.",
    tags: ["Online", "3–8 người", "Vai trò bí mật"],
  },
  {
    href: "/co-ca-ngua",
    title: "Cờ Cá Ngựa",
    icon: "cangua",
    tagline: "Gieo xúc xắc, xuất quân, đá ngựa đối thủ về chuồng và leo đủ 6 bậc — luật Việt Nam, chơi 2–4 người.",
    tags: ["Online", "2–4 người", "Xúc xắc"],
  },
  {
    href: "/o-an-quan",
    title: "Ô Ăn Quan",
    icon: "oanquan",
    tagline: "Trò chơi dân gian: bốc sỏi rải từng ô, ăn liên tiếp, giành quan — chọn quan non, giá quan 5 hay 10 dân. Chơi 2–4 người.",
    tags: ["Online", "2–4 người", "Dân gian"],
  },
  {
    href: "/noi-chu",
    title: "Nối Chữ",
    icon: "noichu",
    tagline: "Nối từ ghép 2 tiếng: tiếng đầu phải trùng tiếng cuối của từ trước, hết giờ là bị loại — người cuối cùng thắng. Chơi 2–8 người.",
    tags: ["Online", "2–8 người", "Từ ngữ"],
  },
  {
    href: "/contra",
    title: "Contra",
    icon: "contra",
    tagline: "Game bắn súng màn hình ngang kiểu 8-bit, chơi ngay trên trình duyệt.",
    tags: ["1 người", "Arcade", "Canvas"],
  },
];

/** Arcade library: one clear entry point per game, with compact cartridges on phones. */
export default function GamesHubPage() {
  return (
    <div className={`game-shell ${styles.page}`}>
      <GamesShell>
        <main className={styles.main}>
          <header className={styles.hero}>
            <div className={styles.heroMark}><PixelIcon name="controller" /></div>
            <div>
              <h1>Chọn game. Rủ bạn. Chơi thôi!</h1>
              <p>Một thư viện nhỏ cho những ván vui cùng nhau. Chơi online với bạn bè hoặc thử tài một mình.</p>
            </div>
          </header>
          <ResumeBanner />
          <div className={styles.libraryHeading}>
            <h2>Thư viện game</h2><span>8 online / 1 arcade</span>
          </div>
          <ul className={styles.library}>
            {GAMES.map((g) => (
              <li key={g.href}>
                <Link href={g.href} className={styles.cartridge}>
                  <div className={styles.art}><PixelIcon name={g.icon} /></div>
                  <div className={styles.info}>
                    <h3>{g.title}</h3>
                    <p>{g.tagline}</p>
                    <div className={styles.tags}>{g.tags.filter(t => t !== "Realtime" && t !== "Canvas").map(t => <span key={t}>{t}</span>)}</div>
                    <span className={styles.play}>Chơi ngay <span aria-hidden>▶</span></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </GamesShell>
    </div>
  );
}
