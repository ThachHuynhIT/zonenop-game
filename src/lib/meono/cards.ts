/**
 * Mèo Nổ card catalogue for the UI: names, looks, rules text (in our own words)
 * and which pack a card comes from. Types mirror be_game src/meono/cards.ts.
 */
export type CardType =
  | "exploding"
  | "defuse"
  | "attack"
  | "skip"
  | "favor"
  | "shuffle"
  | "future"
  | "nope"
  | "taco"
  | "melon"
  | "potato"
  | "beard"
  | "rainbow"
  | "imploding"
  | "reverse"
  | "bottom"
  | "feral"
  | "alter"
  | "targeted"
  | "superskip"
  | "swap"
  | "catomic"
  | "streaking"
  | "future5"
  | "garbage"
  | "mark"
  | "curse"
  | "barking"
  | "potluck"
  | "ilt"
  | "alternow"
  | "bury"
  | "personal"
  | "share"
  | "zombie"
  | "feed"
  | "dig"
  | "clone"
  | "grave"
  | "deadattack"
  | "clairvoyance"
  | "slap"
  | "annoy"
  | "steal"
  | "rollcall"
  | "corn";

export type Expansion = "imploding" | "streaking" | "barking" | "attacking" | "defending" | "zombie";
/** Every card group (for the guide). */
export const EXPANSIONS: Expansion[] = ["imploding", "streaking", "barking", "attacking", "defending", "zombie"];
/** Packs the host can tick in the "custom" preset. */
export const SELECTABLE_PACKS: Expansion[] = ["imploding", "streaking", "barking", "attacking", "defending", "zombie"];

export interface MCard {
  id: number;
  type: CardType;
  faceUp?: boolean;
  /** Đánh dấu: shown to everyone. */
  marked?: boolean;
  /** Nổi cáu: unusable until the end of your next turn. */
  annoyed?: boolean;
}

export const CAT_TYPES: CardType[] = ["taco", "melon", "potato", "beard", "rainbow"];
export const WILD_CAT: CardType = "feral";
export const ACTION_TYPES: CardType[] = [
  "attack",
  "skip",
  "favor",
  "shuffle",
  "future",
  "reverse",
  "bottom",
  "alter",
  "targeted",
  "superskip",
  "swap",
  "catomic",
  "future5",
  "garbage",
  "mark",
  "curse",
  "barking",
  "potluck",
  "ilt",
  "alternow",
  "bury",
  "personal",
  "share",
  "zombie",
  "feed",
  "dig",
  "clone",
  "grave",
  "deadattack",
  "slap",
  "annoy",
  "steal",
  "rollcall",
  "corn",
];
/** Cards that need a target player when played alone (Mèo Xác Sống targets an exploded player). */
export const TARGETED_TYPES: CardType[] = ["favor", "targeted", "mark", "curse", "ilt", "zombie", "annoy", "steal"];
/** “Now” cards: playable at any time, even on someone else's turn. */
export const NOW_TYPES: CardType[] = ["alternow"];

export type Pack = "base" | Expansion;

export interface CardInfo {
  name: string;
  emoji: string;
  /** Tailwind gradient classes for the card face. */
  color: string;
  pack: Pack;
  count: number;
  /** When / how you play it. */
  how: string;
  /** What it does. */
  effect: string;
}

export const PACKS: Record<Pack, { name: string; emoji: string; blurb: string }> = {
  base: { name: "Bộ cơ bản", emoji: "🐱", blurb: "56 lá, 2–5 người." },
  imploding: {
    name: "Gói Mèo Tự Huỷ",
    emoji: "🌀",
    blurb: "Thêm Mèo Tự Huỷ không thể gỡ, đảo chiều, rút từ đáy, mèo hoang… Chơi tới 6 người.",
  },
  streaking: {
    name: "Gói Mèo Chạy Rông",
    emoji: "🏃",
    blurb: "Phỏng theo Streaking Kittens: giữ Mèo Nổ trong tay, đánh dấu, lời nguyền, dọn rác, bom nguyên tử… Thêm 1 Mèo Nổ.",
  },
  zombie: {
    name: "Gói Mèo Xác Sống",
    emoji: "🧟",
    blurb: "Phỏng theo Zombie Kittens: hồi sinh người đã nổ, đào sâu, nhân bản, đào mộ, thấu thị chỗ giấu bom… Chơi riêng ở chế độ Zombie Apocalypse.",
  },
  attacking: {
    name: "Gói Mèo Tấn Công",
    emoji: "⚔️",
    blurb: "Phỏng theo Attacking Kittens: Tát, Cướp bài, Nổi cáu, thêm Sửa tương lai, Gỡ bom và 2 Mèo Nổ. Chơi tới 7 người.",
  },
  defending: {
    name: "Gói Mèo Phòng Thủ",
    emoji: "🛡️",
    blurb: "Phỏng theo Defending Kittens: nhiều lá xem / sửa tương lai, đảo chiều, xáo bài, Điểm danh mèo và Lời nguyền ngô pha lê.",
  },
  barking: {
    name: "Gói Mèo Sủa",
    emoji: "🐶",
    blurb: "Phỏng theo Barking Kittens: Mèo Sủa đôi, góp nồi, “để đó cho tui”, chôn bài, tự tấn công, chia sẻ tương lai.",
  },
};

export const CARDS: Record<CardType, CardInfo> = {
  exploding: {
    name: "Mèo Nổ",
    emoji: "💣",
    color: "from-zinc-900 to-rose-900",
    pack: "base",
    count: 4,
    how: "Không đánh được — chỉ xuất hiện khi bạn rút phải.",
    effect: "Rút phải là nổ tung và bị loại, trừ khi bạn đánh ngay một lá Gỡ bom.",
  },
  defuse: {
    name: "Gỡ bom",
    emoji: "🧯",
    color: "from-lime-400 to-emerald-600",
    pack: "base",
    count: 6,
    how: "Tự động dùng khi bạn rút phải Mèo Nổ.",
    effect: "Cứu bạn khỏi Mèo Nổ. Sau đó bạn bí mật nhét quả bom lại vào chồng bài — ở đâu cũng được, trừ 10% lá trên cùng và dưới cùng.",
  },
  attack: {
    name: "Tấn công",
    emoji: "⚔️",
    color: "from-orange-400 to-red-600",
    pack: "base",
    count: 4,
    how: "Đánh trong lượt của bạn.",
    effect:
      "Kết thúc lượt mà không rút bài. Người kế tiếp phải chơi 2 lượt. Nếu người bị tấn công đánh Tấn công tiếp, số lượt dồn lại (còn lại + 2) cho người sau.",
  },
  skip: {
    name: "Bỏ lượt",
    emoji: "⏭️",
    color: "from-sky-400 to-blue-600",
    pack: "base",
    count: 4,
    how: "Đánh trong lượt của bạn.",
    effect: "Kết thúc một lượt mà không phải rút bài. Nếu đang bị tấn công, chỉ bỏ được 1 trong số các lượt.",
  },
  favor: {
    name: "Xin xỏ",
    emoji: "🙏",
    color: "from-zinc-600 to-zinc-800",
    pack: "base",
    count: 4,
    how: "Đánh trong lượt của bạn, chọn một người.",
    effect: "Người đó phải tự chọn 1 lá trên tay và đưa cho bạn.",
  },
  shuffle: {
    name: "Xáo bài",
    emoji: "🔀",
    color: "from-amber-600 to-yellow-800",
    pack: "base",
    count: 4,
    how: "Đánh trong lượt của bạn.",
    effect: "Xáo ngẫu nhiên chồng bài rút — hữu ích khi biết Mèo Nổ đang nằm trên đầu.",
  },
  future: {
    name: "Xem tương lai",
    emoji: "🔮",
    color: "from-fuchsia-500 to-pink-700",
    pack: "base",
    count: 5,
    how: "Đánh trong lượt của bạn.",
    effect: "Bí mật xem 3 lá trên cùng của chồng bài (không đổi thứ tự).",
  },
  nope: {
    name: "Không!",
    emoji: "🚫",
    color: "from-red-600 to-rose-800",
    pack: "base",
    count: 5,
    how: "Đánh bất cứ lúc nào có người vừa đánh lá hành động — kể cả không phải lượt bạn.",
    effect:
      "Huỷ lá hành động đó (trừ Mèo Nổ và Gỡ bom). Có thể “Không!” lại một lá “Không!” để khôi phục hành động. Mỗi lá hành động có vài giây để mọi người phản ứng.",
  },
  taco: {
    name: "Mèo Taco",
    emoji: "🌮",
    color: "from-yellow-300 to-orange-400",
    pack: "base",
    count: 4,
    how: "Không có tác dụng khi đứng một mình — đánh theo đôi hoặc bộ ba.",
    effect: "Đôi: rút ngẫu nhiên 1 lá của người khác. Bộ ba: gọi tên 1 lá, nếu người đó có thì phải đưa cho bạn.",
  },
  melon: {
    name: "Mèo Dưa Hấu",
    emoji: "🍉",
    color: "from-green-400 to-rose-400",
    pack: "base",
    count: 4,
    how: "Đánh theo đôi hoặc bộ ba (giống mọi lá mèo).",
    effect: "Đôi: rút ngẫu nhiên 1 lá. Bộ ba: gọi tên 1 lá để lấy.",
  },
  potato: {
    name: "Mèo Khoai Tây",
    emoji: "🥔",
    color: "from-amber-300 to-amber-600",
    pack: "base",
    count: 4,
    how: "Đánh theo đôi hoặc bộ ba.",
    effect: "Đôi: rút ngẫu nhiên 1 lá. Bộ ba: gọi tên 1 lá để lấy.",
  },
  beard: {
    name: "Mèo Râu",
    emoji: "🧔",
    color: "from-stone-300 to-stone-500",
    pack: "base",
    count: 4,
    how: "Đánh theo đôi hoặc bộ ba.",
    effect: "Đôi: rút ngẫu nhiên 1 lá. Bộ ba: gọi tên 1 lá để lấy.",
  },
  rainbow: {
    name: "Mèo Cầu Vồng",
    emoji: "🌈",
    color: "from-violet-400 via-sky-400 to-emerald-400",
    pack: "base",
    count: 4,
    how: "Đánh theo đôi hoặc bộ ba.",
    effect: "Đôi: rút ngẫu nhiên 1 lá. Bộ ba: gọi tên 1 lá để lấy.",
  },
  imploding: {
    name: "Mèo Tự Huỷ",
    emoji: "🌀",
    color: "from-indigo-900 to-violet-700",
    pack: "imploding",
    count: 1,
    how: "Không đánh được — chỉ xuất hiện khi rút phải.",
    effect:
      "Lần rút đầu: lật ngửa lá và nhét lại vào chồng bài (ai cũng thấy vị trí của nó). Lần rút thứ hai: bị loại ngay, Gỡ bom không cứu được.",
  },
  reverse: {
    name: "Đảo chiều",
    emoji: "🔁",
    color: "from-teal-400 to-cyan-700",
    pack: "imploding",
    count: 4,
    how: "Đánh trong lượt của bạn.",
    effect: "Đổi chiều vòng chơi và kết thúc lượt mà không rút bài (chơi 2 người thì giống Bỏ lượt).",
  },
  bottom: {
    name: "Rút từ đáy",
    emoji: "⤵️",
    color: "from-slate-400 to-slate-700",
    pack: "imploding",
    count: 4,
    how: "Đánh trong lượt của bạn.",
    effect: "Kết thúc lượt bằng cách rút lá dưới cùng thay vì lá trên cùng.",
  },
  feral: {
    name: "Mèo Hoang",
    emoji: "🐾",
    color: "from-neutral-700 to-neutral-900",
    pack: "imploding",
    count: 4,
    how: "Ghép cùng bất kỳ lá mèo nào để thành đôi hoặc bộ ba.",
    effect: "Lá mèo “joker” — thay thế cho mọi loại mèo khi ghép bộ.",
  },
  alter: {
    name: "Sửa tương lai",
    emoji: "🪄",
    color: "from-purple-500 to-indigo-700",
    pack: "imploding",
    count: 4,
    how: "Đánh trong lượt của bạn.",
    effect: "Xem 3 lá trên cùng rồi tự sắp xếp lại thứ tự của chúng theo ý bạn.",
  },
  targeted: {
    name: "Tấn công chỉ định",
    emoji: "🎯",
    color: "from-red-500 to-orange-700",
    pack: "imploding",
    count: 3,
    how: "Đánh trong lượt của bạn, chọn một người.",
    effect: "Giống Tấn công, nhưng bạn chọn ai phải chơi 2 lượt. Vòng chơi tiếp tục từ người đó.",
  },
  superskip: {
    name: "Siêu bỏ lượt",
    emoji: "⏩",
    color: "from-blue-500 to-indigo-800",
    pack: "streaking",
    count: 1,
    how: "Đánh trong lượt của bạn.",
    effect: "Kết thúc TẤT CẢ các lượt bạn đang phải chơi (kể cả khi bị tấn công nhiều lượt).",
  },
  swap: {
    name: "Đổi đầu đuôi",
    emoji: "🔃",
    color: "from-emerald-500 to-teal-800",
    pack: "streaking",
    count: 3,
    how: "Đánh trong lượt của bạn.",
    effect: "Đổi chỗ lá trên cùng và lá dưới cùng của chồng bài.",
  },
  catomic: {
    name: "Bom Mèo Nguyên Tử",
    emoji: "☢️",
    color: "from-yellow-400 to-lime-700",
    pack: "streaking",
    count: 1,
    how: "Đánh trong lượt của bạn.",
    effect: "Gom mọi Mèo Nổ trong chồng bài đặt lên trên cùng, xáo phần còn lại, rồi kết thúc lượt của bạn. Người kế tiếp coi chừng!",
  },
  streaking: {
    name: "Mèo Chạy Rông",
    emoji: "🏃",
    color: "from-pink-400 to-fuchsia-700",
    pack: "streaking",
    count: 1,
    how: "Không đánh ra — chỉ cần giữ trong tay.",
    effect:
      "Khi đang giữ lá này mà rút phải Mèo Nổ, bạn được lặng lẽ giữ Mèo Nổ trong tay (mỗi Mèo Chạy Rông che được 1 quả). Nếu mất lá này (bị trộm, phải đưa…), bạn phải Gỡ bom ngay, không có thì nổ. Ai cướp được Mèo Nổ từ tay bạn cũng phải xử lý nó như vậy.",
  },
  future5: {
    name: "Xem tương lai ×5",
    emoji: "🔭",
    color: "from-violet-400 to-purple-800",
    pack: "streaking",
    count: 1,
    how: "Đánh trong lượt của bạn.",
    effect: "Bí mật xem 5 lá trên cùng của chồng bài.",
  },
  garbage: {
    name: "Dọn rác",
    emoji: "🗑️",
    color: "from-stone-400 to-stone-700",
    pack: "streaking",
    count: 1,
    how: "Đánh trong lượt của bạn.",
    effect: "Lần lượt từ bạn, mỗi người chọn 1 lá trên tay bỏ vào chồng bài, sau đó chồng bài được xáo lại.",
  },
  mark: {
    name: "Đánh dấu",
    emoji: "🔖",
    color: "from-amber-300 to-orange-600",
    pack: "streaking",
    count: 3,
    how: "Đánh trong lượt của bạn, chọn một người.",
    effect: "Lật ngửa ngẫu nhiên 1 lá trên tay người đó — cả bàn nhìn thấy lá này cho tới khi nó rời tay họ.",
  },
  curse: {
    name: "Lời nguyền mông mèo",
    emoji: "🍑",
    color: "from-rose-300 to-rose-700",
    pack: "streaking",
    count: 2,
    how: "Đánh trong lượt của bạn, chọn một người.",
    effect: "Người đó phải chơi “mù”: bài trên tay bị úp và xáo thứ tự, họ chọn lá theo vị trí mà không biết là lá gì — cho tới khi hết lượt kế tiếp của họ.",
  },
  barking: {
    name: "Mèo Sủa",
    emoji: "🐶",
    color: "from-yellow-600 to-amber-900",
    pack: "barking",
    count: 2,
    how: "Đánh trong lượt của bạn (hoặc đánh cả đôi như một cặp mèo).",
    effect: "Chỉ có 2 lá Mèo Sủa. Nếu một người khác đang giữ lá còn lại, họ phải bỏ lá đó kèm 1 Gỡ bom — không có Gỡ bom thì nổ tung! Không ai giữ thì chẳng có gì xảy ra.",
  },
  potluck: {
    name: "Góp nồi",
    emoji: "🍲",
    color: "from-orange-400 to-red-700",
    pack: "barking",
    count: 2,
    how: "Đánh trong lượt của bạn.",
    effect: "Lần lượt từ bạn, mỗi người chọn 1 lá trên tay đặt úp lên đầu chồng bài. Ai rút tiếp theo sẽ ăn “món góp” đầu tiên.",
  },
  ilt: {
    name: "Để đó cho tui",
    emoji: "🫳",
    color: "from-teal-400 to-cyan-800",
    pack: "barking",
    count: 3,
    how: "Đánh trong lượt của bạn, chọn một người.",
    effect: "Lá tiếp theo người đó rút sẽ về tay bạn (lượt của họ vẫn kết thúc). Nếu lá đó là Mèo Nổ thì họ vẫn phải tự lo.",
  },
  alternow: {
    name: "Sửa tương lai ngay",
    emoji: "⚡",
    color: "from-fuchsia-400 to-violet-800",
    pack: "barking",
    count: 2,
    how: "Đánh BẤT CỨ LÚC NÀO, kể cả trong lượt người khác.",
    effect: "Xem 3 lá trên cùng và xếp lại theo ý bạn.",
  },
  bury: {
    name: "Chôn bài",
    emoji: "⚰️",
    color: "from-zinc-500 to-zinc-800",
    pack: "barking",
    count: 2,
    how: "Đánh trong lượt của bạn, thay cho việc rút bài.",
    effect: "Lấy lá trên cùng (không ai được xem, kể cả bạn) và chôn nó vào chồng bài ở vị trí bạn chọn. Lượt của bạn kết thúc.",
  },
  personal: {
    name: "Tự tấn công",
    emoji: "🥊",
    color: "from-red-400 to-rose-800",
    pack: "barking",
    count: 3,
    how: "Đánh trong lượt của bạn.",
    effect: "Bạn phải chơi thêm 2 lượt liền (tổng cộng 3 lượt). Hữu ích khi bạn biết lá tới an toàn.",
  },
  share: {
    name: "Chia sẻ tương lai",
    emoji: "🤝",
    color: "from-sky-400 to-blue-800",
    pack: "barking",
    count: 2,
    how: "Đánh trong lượt của bạn.",
    effect: "Xem và xếp lại 3 lá trên cùng, rồi cho người chơi kế tiếp xem đúng 3 lá đó.",
  },
  zombie: {
    name: "Mèo Xác Sống",
    emoji: "🧟",
    color: "from-lime-500 to-green-900",
    pack: "zombie",
    count: 4,
    how: "Đánh trong lượt của bạn, chọn một người ĐÃ BỊ LOẠI.",
    effect: "Hồi sinh người đó: họ quay lại bàn với 2 lá nhặt ngẫu nhiên từ chồng bài đã đánh (không có Mèo Nổ) và chơi tiếp như bình thường.",
  },
  feed: {
    name: "Nuôi xác sống",
    emoji: "🍖",
    color: "from-rose-500 to-red-900",
    pack: "zombie",
    count: 3,
    how: "Đánh trong lượt của bạn.",
    effect: "Lần lượt từ bạn, mỗi người còn sống chọn 1 lá trên tay bỏ vào chồng bài đã đánh — cho xác sống ăn.",
  },
  dig: {
    name: "Đào sâu",
    emoji: "⛏️",
    color: "from-amber-600 to-yellow-900",
    pack: "zombie",
    count: 4,
    how: "Đánh trong lượt của bạn, thay cho việc rút bài.",
    effect: "Bí mật xem lá trên cùng: giữ nó (như rút bài bình thường), hoặc để nguyên đó và bắt buộc lấy lá ngay bên dưới. Lượt của bạn kết thúc.",
  },
  clone: {
    name: "Nhân bản",
    emoji: "🧬",
    color: "from-cyan-400 to-teal-800",
    pack: "zombie",
    count: 3,
    how: "Đánh trong lượt của bạn, ngay sau một lá hành động.",
    effect: "Chơi lại y hệt hiệu ứng của lá hành động nằm trên cùng chồng bài đã đánh (chỉ những lá không cần nhắm người).",
  },
  grave: {
    name: "Đào mộ",
    emoji: "🪦",
    color: "from-slate-400 to-slate-800",
    pack: "zombie",
    count: 2,
    how: "Đánh trong lượt của bạn.",
    effect: "Lần lượt từ bạn, mỗi người còn sống nhặt ngẫu nhiên 1 lá từ chồng bài đã đánh (không bao giờ là Mèo Nổ).",
  },
  deadattack: {
    name: "Xác sống tấn công",
    emoji: "🧟‍♂️",
    color: "from-green-600 to-emerald-950",
    pack: "zombie",
    count: 2,
    how: "Đánh trong lượt của bạn.",
    effect: "Như Tấn công, nhưng người kế tiếp phải chơi thêm 1 lượt cho MỖI người đã bị loại. Càng nhiều người chết càng đau!",
  },
  slap: {
    name: "Tát",
    emoji: "👋",
    color: "from-orange-300 to-red-700",
    pack: "attacking",
    count: 4,
    how: "Đánh trong lượt của bạn.",
    effect: "Kết thúc lượt mà không rút bài — người kế tiếp phải rút hộ bạn 1 lá rồi mới chơi lượt của họ (chơi 2 lượt). Tát thật thì tuỳ bạn 😄",
  },
  annoy: {
    name: "Nổi cáu",
    emoji: "😾",
    color: "from-yellow-400 to-amber-700",
    pack: "attacking",
    count: 4,
    how: "Đánh trong lượt của bạn, chọn một người.",
    effect: "Một lá (ngẫu nhiên) trên tay người đó bị vô hiệu tới hết lượt kế tiếp của họ — kể cả Gỡ bom hay “Không!”. Có 3 lá ở gói Tấn Công và 1 lá ở gói Phòng Thủ.",
  },
  steal: {
    name: "Cướp bài",
    emoji: "🦝",
    color: "from-neutral-400 to-neutral-800",
    pack: "attacking",
    count: 4,
    how: "Đánh trong lượt của bạn, chọn một người.",
    effect: "Cướp ngẫu nhiên 1 lá trên tay người đó.",
  },
  rollcall: {
    name: "Điểm danh mèo",
    emoji: "📋",
    color: "from-red-500 to-rose-900",
    pack: "defending",
    count: 1,
    how: "Đánh trong lượt của bạn.",
    effect: "Đưa tất cả Mèo Nổ còn lại lên đầu chồng bài rồi kết thúc lượt. Người kế tiếp không được Xáo bài — phải Bỏ lượt, Tấn công… hoặc cầu nguyện.",
  },
  corn: {
    name: "Lời nguyền ngô pha lê",
    emoji: "🌽",
    color: "from-yellow-300 to-lime-700",
    pack: "defending",
    count: 1,
    how: "Đánh trong lượt của bạn.",
    effect: "Không ai được đánh Xáo bài cho tới hết lượt của người chơi kế tiếp.",
  },
  clairvoyance: {
    name: "Thấu thị",
    emoji: "👁️",
    color: "from-indigo-400 to-violet-900",
    pack: "zombie",
    count: 2,
    how: "Đánh khi một người khác vừa gỡ bom và đang nhét Mèo Nổ lại.",
    effect: "Bạn được bí mật biết họ nhét Mèo Nổ ở vị trí nào trong chồng bài.",
  },
};

export const cardName = (t: CardType) => CARDS[t]?.name ?? t;

/** Types the triple / five-card combos can ask for. */
export const NAMEABLE_TYPES = Object.keys(CARDS).filter((t) => t !== "exploding" && t !== "imploding") as CardType[];

/**
 * Where a kitten may be hidden again is in protocol.ts (insertRange).
 * Old rooms may still send "chaos" (the Streaking cards were called Gói Hỗn Loạn).
 */
export const packOf = (e: string): Expansion | null => (e === "chaos" ? "streaking" : (EXPANSIONS as string[]).includes(e) ? (e as Expansion) : null);

/** Ready-made pack combinations the host picks from, each with the player counts it suits. */
export interface Preset {
  id: string;
  name: string;
  emoji: string;
  group: "basic" | "advanced" | "chaos";
  packs: Expansion[];
  minPlayers: number;
  maxPlayers: number;
}

export const PRESETS: Preset[] = [
  { id: "classic", name: "Classic", emoji: "🐱", group: "basic", packs: [], minPlayers: 2, maxPlayers: 5 },
  { id: "runaway", name: "Runaway Cats", emoji: "🏃", group: "basic", packs: ["streaking"], minPlayers: 2, maxPlayers: 5 },
  { id: "implosion", name: "Implosion", emoji: "🌀", group: "basic", packs: ["imploding"], minPlayers: 2, maxPlayers: 6 },
  { id: "zombie", name: "Zombie Apocalypse", emoji: "🧟", group: "basic", packs: ["zombie"], minPlayers: 2, maxPlayers: 5 },
  { id: "war", name: "War of Cats", emoji: "⚔️🛡️", group: "basic", packs: ["attacking", "defending"], minPlayers: 3, maxPlayers: 7 },
  { id: "catchaos", name: "Cat Chaos", emoji: "🏃🌀", group: "basic", packs: ["streaking", "imploding"], minPlayers: 3, maxPlayers: 6 },
  { id: "ultimatechaos", name: "Ultimate Chaos", emoji: "🔥", group: "basic", packs: ["streaking", "imploding", "barking"], minPlayers: 3, maxPlayers: 6 },
  { id: "aggressive", name: "Aggressive Cats", emoji: "⚔️🏃", group: "advanced", packs: ["attacking", "streaking"], minPlayers: 3, maxPlayers: 7 },
  { id: "defchaos", name: "Defensive Chaos", emoji: "🛡️🌀", group: "advanced", packs: ["defending", "imploding"], minPlayers: 2, maxPlayers: 6 },
  { id: "catfight", name: "Cat Fight", emoji: "🐶⚔️", group: "advanced", packs: ["barking", "attacking"], minPlayers: 3, maxPlayers: 7 },
  { id: "zombiewar", name: "Zombie War", emoji: "🧟⚔️", group: "advanced", packs: ["zombie", "attacking"], minPlayers: 3, maxPlayers: 7 },
  { id: "undead", name: "Undead Defense", emoji: "🧟🛡️", group: "advanced", packs: ["zombie", "defending"], minPlayers: 2, maxPlayers: 6 },
  { id: "zombierun", name: "Zombie Run", emoji: "🧟🏃", group: "advanced", packs: ["zombie", "streaking"], minPlayers: 3, maxPlayers: 6 },
  { id: "ultimatewar", name: "Ultimate War", emoji: "🔥", group: "chaos", packs: ["attacking", "defending", "streaking", "imploding"], minPlayers: 4, maxPlayers: 7 },
  { id: "zombiechaos", name: "Zombie Apocalypse Chaos", emoji: "☠️", group: "chaos", packs: ["zombie", "streaking", "imploding", "barking"], minPlayers: 4, maxPlayers: 6 },
  { id: "everything", name: "Everything", emoji: "💀", group: "chaos", packs: ["streaking", "imploding", "barking", "attacking", "zombie", "defending"], minPlayers: 4, maxPlayers: 7 },
];
export const PRESET_BY_ID: Record<string, Preset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

export const PRESET_GROUPS: { id: Preset["group"]; name: string }[] = [
  { id: "basic", name: "Cơ bản" },
  { id: "advanced", name: "Nâng cao" },
  { id: "chaos", name: "Hỗn loạn" },
];
