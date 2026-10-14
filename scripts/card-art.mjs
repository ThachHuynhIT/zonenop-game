#!/usr/bin/env node
/**
 * Card art for the board games: turn source images into the game's card images.
 *
 *   npm run art:meono                # reads art/meono/*
 *   npm run art:bang                 # reads art/bang/*
 *   node scripts/card-art.mjs <game> [path/to/dir]
 *
 * Two kinds of source file (prompts for both: docs/MEONO_ART_PROMPTS.md, docs/BANG_ART_PROMPTS.md):
 *   - `sheet1.png`, `sheet2.png`…: one image holding a 4×3 grid of twelve cards, cut apart using the
 *     game's `sheets` below (left to right, top row first);
 *   - `<name>.png` (`defuse.png`, `card-bang.png`, `back.png`…): a single card. It wins over the same
 *     card from a sheet, so one bad card can be redone on its own.
 * Each card is cropped to its shape (5:7 400×560 unless the game sets `sizeOf`) and saved as public/games/<game>/cards/<name>.webp,
 * then src/lib/<game>/art.ts is rewritten so the game knows which cards have art. Cards without
 * art keep the drawn face.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const CARD_W = 400;
const CARD_H = 560;
const W = CARD_W;
const H = CARD_H;
const COLS = 4;
const ROWS = 3;
const EXTS = [".png", ".jpg", ".jpeg", ".webp", ".avif"];

/** Keys of `export const <table> = {` in a data file, read from the source so this never drifts from the game. */
function keysOf(file, table, entry) {
  const src = readFileSync(join(ROOT, file), "utf8");
  const start = src.indexOf(`export const ${table}`);
  if (start < 0) throw new Error(`${file}: không thấy ${table}`);
  const body = src.slice(start, src.indexOf("\n};", start));
  return [...body.matchAll(entry)].map((m) => m[1]);
}

const GAMES = {
  meono: {
    names: () => [...keysOf("src/lib/meono/cards.ts", "CARDS", /^ {2}([a-z0-9]+): \{/gm), "back"],
    type: `(CardType | "back")`,
    typeImport: `import type { CardType } from "./cards";`,
    exportName: "MEO_ART",
    about: `Card types that have artwork in public/games/meono/cards/<type>.webp ("back" = the card back).`,
    /** Framed designs that look wrong padded: always cropped to 5:7. */
    alwaysCrop: ["back"],
    /** Cards in each sheet, left to right, top row first (4 columns × 3 rows); null = empty cell. */
    sheets: {
      1: ["exploding", "defuse", "attack", "skip", "favor", "shuffle", "future", "nope", "taco", "melon", "potato", "beard"],
      2: ["rainbow", "imploding", "reverse", "bottom", "feral", "alter", "targeted", "superskip", "swap", "catomic", "streaking", "future5"],
      3: ["garbage", "mark", "curse", "barking", "potluck", "ilt", "alternow", "bury", "personal", "share", "slap", "annoy"],
      4: ["zombie", "feed", "dig", "clone", "grave", "deadattack", "clairvoyance", "steal", "rollcall", "corn", "back", null],
    },
  },
  bang: {
    names: () => {
      const data = "src/lib/bang/cards.ts";
      const entry = /^ {2}([a-z0-9]+): [A-Z]\(/gm;
      return [
        ...keysOf(data, "CARD_TYPES", entry).map((k) => `card-${k}`),
        ...keysOf(data, "CHARACTERS", entry).map((k) => `char-${k}`),
        ...keysOf(data, "EVENTS", entry).map((k) => `event-${k}`),
        "back",
      ];
    },
    type: "BangArt",
    typeImport: `import type { CardKey, CharKey, EventKey } from "./cards";

/** card-<card type> · char-<character> · event-<event card> · back (the playing-card back). */
export type BangArt = \`card-\${CardKey}\` | \`char-\${CharKey}\` | \`event-\${EventKey}\` | "back";`,
    exportName: "BANG_ART",
    /** Output size per art kind: playing cards fill the art box of the card face, events are square. */
    sizeOf: (name) => (name.startsWith("card-") ? [400, 440] : name.startsWith("event-") ? [480, 480] : [W, H]),
    about: "Art files in public/games/bang/cards/<name>.webp.",
    sheets: {
      // Playing cards
      1: ["bang", "missed", "beer", "panic", "catbalou", "stagecoach", "wellsfargo", "generalstore", "indians", "duel", "gatling", "saloon"].map((k) => `card-${k}`),
      2: ["barrel", "scope", "mustang", "jail", "dynamite", "volcanic", "schofield", "remington", "carabine", "winchester", "punch", "dodge"].map((k) => `card-${k}`),
      3: ["springfield", "whisky", "tequila", "ragtime", "brawl", "binocular", "hideout", "bible", "ironplate", "sombrero", "tengallon", "canteen"].map((k) => `card-${k}`),
      4: ["cancan", "conestoga", "derringer", "knife", "pepperbox", "buffalo", "howitzer", "ponyexpress", "aim", "backfire", "bandidas", "escape"].map((k) => `card-${k}`),
      5: ["fanning", "lastcall", "poker", "saved", "tomahawk", "tornado", "bounty", "ghost", "lemat", "rattlesnake", "shotgun", "reload"].map((k) => `card-${k}`),
      6: [...["quickshot", "flintlock", "lockpick", "duck", "nip", "squaw", "bandolier", "belltower", "bigfifty", "doublebarrel", "buntline"].map((k) => `card-${k}`), "back"],
      // Characters
      7: ["bart", "blackjack", "calamity", "elgringo", "jesse", "jourdonnais", "kit", "lucky", "paul", "pedro", "rose", "sid"].map((k) => `char-${k}`),
      8: ["slab", "suzy", "vulture", "willy", "apache", "belle", "bill", "chuck", "doc", "elena", "greg", "herb"].map((k) => `char-${k}`),
      9: ["jose", "molly", "pat", "pixie", "sean", "tequilajoe", "vera", "bigspencer", "flint", "gary", "greygory", "johnpain"].map((k) => `char-${k}`),
      10: ["leevan", "teren", "youl", "donbell", "dutch", "jacky", "josh", "madam", "luzena", "raddie", "simeon", "blackflower"].map((k) => `char-${k}`),
      11: ["colorado", "derspot", "evelyn", "henry", "lemonade", "mick", "tuco", "alpreacher", "bass", "bloody", "frankie", "julie"].map((k) => `char-${k}`),
      // Event cards
      12: ["blessing", "curse", "daltons", "doctor", "ghosttown", "reverse", "hangover", "newidentity", "sermon", "shootout", "reverend", "thirst"].map((k) => `event-${k}`),
      13: ["train", "highnoon", "mine", "ambush", "bloodbrothers", "deadman", "hardliquor", "lasso", "lawwest", "peyote", "ranch", "ricochet"].map((k) => `event-${k}`),
      14: ["roulette", "sniper", "judge", "vendetta", "fistful", "boneyard", "valentine", "dorothy", "helena", "ladyrose", "susanna", "sacagaway"].map((k) => `event-${k}`),
      // The rest
      15: ["char-mexicali", "char-abigail", "char-redringo", "event-showdown", "event-wildwestshow", null, null, null, null, null, null, null],
    },
  },
};

const game = process.argv[2];
const cfg = GAMES[game];
if (!cfg) {
  console.error(`Cách dùng: node scripts/card-art.mjs <${Object.keys(GAMES).join("|")}> [thư mục ảnh]`);
  process.exit(1);
}
const SRC = resolve(process.argv[3] ?? join(ROOT, "art", game));
const OUT = join(ROOT, "public/games", game, "cards");
const MANIFEST = join(ROOT, "src/lib", game, "art.ts");
const NAMES = new Set(cfg.names());

for (const [n, cards] of Object.entries(cfg.sheets)) {
  for (const t of cards) if (t && !NAMES.has(t)) throw new Error(`sheets[${n}]: không có lá "${t}"`);
}
const inSheets = new Set(Object.values(cfg.sheets).flat());
const noSheet = [...NAMES].filter((t) => !inSheets.has(t));
if (noSheet.length) console.warn(`Lưu ý: chưa có trong ảnh lưới nào (chỉ làm được bằng ảnh lẻ): ${noSheet.join(", ")}`);

if (!existsSync(SRC)) {
  console.error(`Không thấy thư mục ảnh nguồn: ${SRC}`);
  process.exit(1);
}

/** How far a panel's shape may be from 5:7 before it is padded instead of cropped. */
const CROP_TOLERANCE = 0.12;

/**
 * Save one card at 400×560. A panel close to 5:7 is cropped to fit; a panel much taller or wider
 * (e.g. a sheet drawn with 9:16 cells) is kept whole and centred on a blurred, enlarged copy of
 * itself, so nothing important is cut off.
 */
async function save(img, name) {
  const [W, H] = cfg.sizeOf?.(name) ?? [CARD_W, CARD_H];
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  const ratio = info.width / info.height;
  const out = join(OUT, `${name}.webp`);
  if (Math.abs(ratio / (W / H) - 1) <= CROP_TOLERANCE) {
    return sharp(data).resize(W, H, { fit: "cover", position: sharp.strategy.attention }).webp({ quality: 82, effort: 6 }).toFile(out);
  }
  if (cfg.alwaysCrop?.includes(name)) {
    return sharp(data).resize(W, H, { fit: "cover", position: sharp.strategy.attention }).webp({ quality: 82, effort: 6 }).toFile(out);
  }
  // Trim a little off the long side first (keeps the padding small), then stretch the edge pixels
  // out to 5:7 — panel backgrounds are gradients, so the copied edges blend in.
  const trimmed =
    ratio < W / H
      ? { w: info.width, h: Math.round(Math.min(info.height, (info.width / ratio) * (1 - CROP_TOLERANCE))) }
      : { w: Math.round(Math.min(info.width, info.height * ratio * (1 - CROP_TOLERANCE))), h: info.height };
  const fit = await sharp(data)
    .resize(trimmed.w, trimmed.h, { fit: "cover", position: sharp.strategy.attention })
    .resize(W, H, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const padX = W - fit.info.width;
  const padY = H - fit.info.height;
  return sharp(fit.data)
    .extend({ left: Math.floor(padX / 2), right: Math.ceil(padX / 2), top: Math.floor(padY / 2), bottom: Math.ceil(padY / 2), extendWith: "copy" })
    .webp({ quality: 82, effort: 6 })
    .toFile(out);
}

/**
 * Where the panels are along one axis: runs of lines that are (almost) all gutter colour split the
 * image into panel spans. Returns `n` [start, end) spans — missing ones (empty cells at the end of a
 * sheet) are filled in from the panel size and spacing that were found — or null when there are no
 * gutters to go by.
 */
function findSpans(isBg, length, n) {
  const spans = [];
  let start = -1;
  for (let i = 0; i <= length; i++) {
    const content = i < length && !isBg(i);
    if (content && start < 0) start = i;
    if (!content && start >= 0) {
      if (i - start > length * 0.05) spans.push([start, i]);
      start = -1;
    }
  }
  if (!spans.length || spans.length > n || (spans.length === 1 && n > 1)) return null;
  if (spans.length === n) return spans;
  const size = Math.round(spans.reduce((t, [a, b]) => t + b - a, 0) / spans.length);
  const pitch = Math.round((spans[spans.length - 1][0] - spans[0][0]) / (spans.length - 1));
  const out = Array.from({ length: n }, (_, i) => [spans[0][0] + i * pitch, spans[0][0] + i * pitch + size]);
  return out[n - 1][1] <= length ? out : null;
}

/**
 * Cut a 4×3 sheet into its cards. With plain gutters (the sheet's corner colour), panels are found
 * by scanning for gutter lines, so uneven gutters and empty cells are fine; without them the image
 * is split evenly. Each panel then loses a thin edge for safety.
 */
async function cutSheet(file, cards) {
  const { data, info } = await sharp(file).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const bg = [data[0], data[1], data[2]];
  const px = (x, y) => {
    const o = (y * width + x) * channels;
    return Math.abs(data[o] - bg[0]) + Math.abs(data[o + 1] - bg[1]) + Math.abs(data[o + 2] - bg[2]) < 45;
  };
  const step = 3; // sample every 3rd pixel along a line
  const lineIsBg = (count, at) => {
    let hit = 0;
    let all = 0;
    for (let i = 0; i < count; i += step, all++) if (at(i)) hit++;
    return hit / all > 0.97;
  };
  const xs = findSpans((x) => lineIsBg(height, (y) => px(x, y)), width, COLS);
  const ys = findSpans((y) => lineIsBg(width, (x) => px(x, y)), height, ROWS);
  const colAt = (c) => (xs ? xs[c] : [Math.floor((c * width) / COLS), Math.floor(((c + 1) * width) / COLS)]);
  const rowAt = (r) => (ys ? ys[r] : [Math.floor((r * height) / ROWS), Math.floor(((r + 1) * height) / ROWS)]);
  const img = sharp(data, { raw: { width, height, channels } });
  const out = [];
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i]) continue;
    const [x0, x1] = colAt(i % COLS);
    const [y0, y1] = rowAt(Math.floor(i / COLS));
    const pad = Math.round(Math.min(x1 - x0, y1 - y0) * 0.02);
    const region = { left: x0 + pad, top: y0 + pad, width: x1 - x0 - 2 * pad, height: y1 - y0 - 2 * pad };
    await save(img.clone().extract(region), cards[i]);
    out.push(cards[i]);
  }
  return out;
}

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC)
  .filter((f) => EXTS.includes(extname(f).toLowerCase()))
  .sort();
const done = [];
const unknown = [];
// Sheets first, so single-card files can replace a card from a sheet.
for (const file of files) {
  const m = /^sheet(\d+)$/i.exec(basename(file, extname(file)));
  if (!m) continue;
  if (!cfg.sheets[m[1]]) {
    unknown.push(file);
    continue;
  }
  const cards = await cutSheet(join(SRC, file), cfg.sheets[m[1]]);
  console.log(`${file} → ${cards.join(", ")}`);
  done.push(...cards);
}
for (const file of files) {
  const name = basename(file, extname(file)).toLowerCase();
  if (/^sheet\d+$/.test(name)) continue;
  if (!NAMES.has(name)) {
    unknown.push(file);
    continue;
  }
  await save(sharp(join(SRC, file)).rotate(), name);
  if (!done.includes(name)) done.push(name);
}

// The manifest lists every image in the output folder, not just this run's.
const have = readdirSync(OUT)
  .filter((f) => f.endsWith(".webp") && NAMES.has(basename(f, ".webp")))
  .map((f) => basename(f, ".webp"))
  .sort();
const hash = createHash("sha1");
for (const t of have) hash.update(t).update(readFileSync(join(OUT, `${t}.webp`)));
const version = have.length ? hash.digest("hex").slice(0, 8) : "0";

writeFileSync(
  MANIFEST,
  `// Generated by scripts/card-art.mjs — do not edit by hand.
${cfg.typeImport}

/**
 * ${cfg.about}
 * Everything else keeps the drawn face (colour + emoji), so art can be added a few cards at a time.
 */
export const ${cfg.exportName}: readonly ${cfg.type}[] = [${have.map((t) => JSON.stringify(t)).join(", ")}];

/** Changes whenever the images change, so browsers don't keep old ones. */
export const ${cfg.exportName}_VERSION = ${JSON.stringify(version)};
`,
);

const missing = [...NAMES].filter((t) => !have.includes(t)).sort();
console.log(`Đã chuyển ${done.length} ảnh${done.length ? `: ${done.join(", ")}` : ""}.`);
if (unknown.length) console.log(`Bỏ qua (tên không khớp lá nào): ${unknown.join(", ")}`);
console.log(`Có ảnh: ${have.length}/${NAMES.size}.${missing.length ? ` Còn thiếu: ${missing.join(", ")}` : ""}`);
