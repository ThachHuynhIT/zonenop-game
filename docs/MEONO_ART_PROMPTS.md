# Mèo Nổ — bộ prompt vẽ tranh lá bài (theo cụm 12 lá)

Mỗi prompt tạo **một ảnh lưới 4 cột × 3 hàng = 12 lá**. 47 lá (46 mặt trước + mặt sau) gói gọn trong **4 ảnh**. Script tự cắt ảnh lưới ra thành từng lá. Tạo cả cụm một lúc còn giúp các lá đồng bộ nét vẽ và màu hơn so với tạo lẻ.

Lá nào chưa có tranh vẫn hiện mặt vẽ bằng màu + emoji như cũ, nên bạn làm dần từng cụm cũng được.

## Cách dùng

1. Mở công cụ tạo ảnh (ChatGPT/DALL·E, Midjourney, Ideogram, Gemini, Stable Diffusion…), dán **đoạn phong cách chung**, rồi dán prompt của **một cụm**.
2. Lưu ảnh vào `art/meono/` với tên **`sheet1.png` … `sheet4.png`** (đúng số cụm).
3. Chạy:

   ```bash
   npm install          # lần đầu, để có sharp
   npm run art:meono
   ```

   Script bỏ lề ngoài, chia ảnh thành 12 ô (trái → phải, từ hàng trên xuống), gọt khe giữa các ô, cắt mỗi ô về tỉ lệ 5:7, thu về 400×560, rồi lưu `public/games/meono/cards/<mã>.webp` và cập nhật `src/lib/meono/art.ts`. Cuối cùng nó in ra lá nào còn thiếu.
4. Commit `public/games/meono/cards/*.webp` và `src/lib/meono/art.ts`. Thư mục `art/` chứa ảnh gốc, nặng, nên đã nằm trong `.gitignore`.

**Làm lại một lá bị xấu:** tạo riêng lá đó (dùng mô tả ô tương ứng trong cụm, bỏ phần “sprite sheet”), lưu thành `art/meono/<mã>.png` (ví dụ `nope.png`) rồi chạy lại. Ảnh lẻ luôn **thắng** ô cùng tên trong ảnh lưới.

**Ảnh bị cắt lệch** (công cụ không vẽ đúng 4×3, ô to nhỏ không đều): tạo lại, hoặc tự cắt ô đó ra thành ảnh lẻ như trên.

**Ô không đúng tỉ lệ 5:7** (ví dụ ảnh dọc 1060×1484 cho ô cao và hẹp): ô lệch dưới 12% thì được cắt cho vừa. Lệch nhiều hơn thì script chỉ gọt bớt 12% rồi kéo dài mép tranh cho đủ 5:7, nên không mất chi tiết ở trên và dưới. Tranh có vật chạm sát mép trái/phải sẽ thấy vệt kéo dài; muốn đẹp hơn thì vẽ lại ô đó thành ảnh lẻ 5:7. Riêng mặt sau lá (`back`, có khung hoạ tiết) luôn được cắt.

### Mẹo để ảnh lưới cắt chuẩn và đẹp

- Yêu cầu **đúng 4 cột × 3 hàng, 12 ô bằng nhau**, có **khe và lề màu kem trơn** giữa các ô. Script dựa vào màu lề (lấy ở góc ảnh) để gọt khe.
- **Tạo ảnh càng to càng tốt.** 12 ô trong một ảnh 1024 px thì mỗi ô chỉ còn khoảng 240×340 px, mờ hơn kích thước lá trong game (400×560). Hãy chọn độ phân giải cao nhất công cụ cho phép (≥ 2048 px), hoặc dùng chức năng upscale (Midjourney “Upscale”, Upscayl…) trước khi lưu.
- Tỉ lệ ảnh: gần vuông (12 lá 5:7 xếp 4×3 ≈ 20:21). Midjourney: `--ar 20:21`. ChatGPT/DALL·E: chọn ảnh vuông.
- 12 ô là nhiều. Nếu công cụ hay vẽ sai số ô hoặc lẫn nội dung giữa các ô, hãy tạo lại vài lần, hoặc làm lại riêng những lá bị hỏng bằng ảnh lẻ.
- **Không để chữ trong tranh.** Game tự in tên lá ở dải trên cùng và biểu tượng gói ở góc dưới phải, nên trong mỗi ô hãy chừa **khoảng 15% phía trên** và **góc dưới phải** đơn giản.
- Khi đã ưng một cụm, dùng ảnh đó làm **ảnh tham chiếu phong cách** cho các cụm sau (Midjourney `--sref <link>`; ChatGPT: đính kèm ảnh và nói “same art style as this image”).
- Tranh do bạn tự vẽ hoặc tự tạo. Không dùng tranh của bộ bài thương mại (Exploding Kittens…) vì đó là tác phẩm có bản quyền và repo/web này công khai.

## Đoạn phong cách chung (dán trước mỗi cụm)

```
A single high-resolution image laid out as a sprite sheet: exactly 4 columns × 3 rows of twelve equal-size vertical playing-card
illustrations (each 5:7 portrait), separated by even gutters and an outer margin of plain flat cream colour (#f5f0e6). Each panel is a
separate, complete illustration with its own softly-lit gradient background filling the panel edge to edge, no card borders or frames.
Original artwork for a party card game about cats and bombs. Cute, funny cartoon style: chunky round cats with big expressive eyes,
thick clean outlines, flat colours with soft cel shading, simple bold shapes that read clearly at small size. One clear subject per panel,
centred. Leave the top 15% and the bottom-right corner of every panel simple and uncluttered. The same art style and the same line weight
in all twelve panels. No text, no letters, no numbers, no captions, no logos anywhere.
Original character designs, not imitating any existing card game or artist.
```

Midjourney: thêm `--ar 20:21 --style raw` vào cuối cả prompt.

## Prompt từng cụm

Thứ tự ô là **trái → phải, từ hàng trên xuống**. Đừng đổi thứ tự, vì script cắt theo đúng thứ tự này (danh sách nằm trong `GAMES.meono.sheets` của `scripts/card-art.mjs`).

### Cụm 1 → `sheet1.png`: bộ cơ bản

```
Row 1, left to right:
1. A startled cat sitting on a big round cartoon bomb with a lit sparkling fuse, fur standing on end; charcoal-to-crimson background.
2. A calm cat in a tiny bomb-squad helmet snipping a wire on a bomb with little scissors, relieved sparkle; lime-to-emerald background.
3. A fierce little cat warrior leaping forward with a plastic sword and a saucepan helmet, motion lines; orange-to-red background.
4. A cat casually tiptoeing away past a sleeping bomb, whistling, holding a tiny suitcase; sky-blue-to-blue background.
Row 2, left to right:
5. A cat with huge pleading eyes and paws pressed together, begging for something; muted grey background.
6. A dizzy happy cat spinning inside a tornado of flying playing cards; amber-to-dark-gold background.
7. A fortune-teller cat in a starry shawl gazing into a glowing crystal ball showing three small blank cards; magenta-to-pink background.
8. A very unimpressed cat raising one paw in a firm "stop" gesture, a big glowing red forbidden-circle shape behind it; red-to-rose background.
Row 3, left to right:
9. A happy cat tucked inside a giant crunchy taco shell like a blanket, lettuce and tomato around it; yellow-to-orange background.
10. A round cat that is half watermelon (green striped rind back, pink belly with seeds), sitting proudly; green-to-pink background.
11. A lumpy potato-shaped cat with little sprouts on its head, sitting in a pile of potatoes; pale-to-earthy-yellow background.
12. A dignified cat with an enormous bushy beard reaching the floor, holding a tiny comb; light stone-grey background.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `exploding` Mèo Nổ | `defuse` Gỡ bom | `attack` Tấn công | `skip` Bỏ lượt |
| 2 | `favor` Xin xỏ | `shuffle` Xáo bài | `future` Xem tương lai | `nope` Không! |
| 3 | `taco` Mèo Taco | `melon` Mèo Dưa Hấu | `potato` Mèo Khoai Tây | `beard` Mèo Râu |

### Cụm 2 → `sheet2.png`: mèo cầu vồng + gói Mèo Tự Huỷ + Mèo Chạy Rông (1)

```
Row 1, left to right:
1. A joyful cat sliding down a rainbow, leaving a sparkling rainbow trail from its tail; pastel violet-sky-green background.
2. A surprised cat being sucked into a small swirling vortex, stretched and spiralling; deep indigo-to-violet cosmic background.
3. A cat doing a U-turn on a little scooter, skid marks forming a circular arrow; teal-to-cyan background.
4. A cat upside-down under a tall stack of cards, sneakily pulling out the bottom card, tongue out; slate-grey background.
Row 2, left to right:
5. A scruffy wild alley cat with a torn ear and glowing eyes, mischievous grin, crouched on a trash can lid at night; near-black background.
6. A wizard cat in a pointy hat rearranging three floating glowing cards with a magic wand; purple-to-indigo starry background.
7. A focused cat archer aiming a suction-cup arrow at a big target, one eye closed; red-to-dark-orange background.
8. A cat in a superhero cape blasting off like a rocket with a speed trail; blue-to-indigo background.
Row 3, left to right:
9. Two cats juggling cards in a circle between the top and the bottom of a card stack; emerald-to-deep-teal background.
10. A cat in an oversized hazmat suit carrying a glowing green cartoon bomb, a harmless puffy cloud behind; yellow-to-moss-green background.
11. A gleeful cat sprinting while carrying a bomb in its arms like a football, wind in its fur; pink-to-fuchsia background.
12. A cat astronomer peering through a brass telescope, five small glowing cards in the sky like constellations; violet-to-dark-purple background.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `rainbow` Mèo Cầu Vồng | `imploding` Mèo Tự Huỷ | `reverse` Đảo chiều | `bottom` Rút từ đáy |
| 2 | `feral` Mèo Hoang | `alter` Sửa tương lai | `targeted` Tấn công chỉ định | `superskip` Siêu bỏ lượt |
| 3 | `swap` Đổi đầu đuôi | `catomic` Bom Mèo Nguyên Tử | `streaking` Mèo Chạy Rông | `future5` Xem tương lai ×5 |

### Cụm 3 → `sheet3.png`: Mèo Chạy Rông (2) + gói Mèo Sủa + Tấn Công (1)

```
Row 1, left to right:
1. A cat happily diving head-first into a trash can full of crumpled cards and fish bones, tail sticking out; stone-grey background.
2. A detective cat with a magnifying glass sticking a big bookmark ribbon onto a card; amber-to-orange background.
3. A blindfolded cat fumbling with a fan of cards under a spooky purple curse cloud shaped like a cat's rear (cute, not rude); rose background.
4. A confused cat barking loudly like a dog, wearing a floppy dog-ear headband, shock lines; dark-gold-to-amber background.
Row 2, left to right:
5. Cat paws dropping mystery cards into a big bubbling stew pot while a cat chef stirs with a ladle; orange-to-dark-red background.
6. A sly cat stretching a long paw to snatch a card out of the air before another cat catches it; teal-to-dark-cyan background.
7. A cat with crackling lightning paws rapidly rearranging three floating cards, electric sparks; fuchsia-to-deep-violet background.
8. A solemn cat gravedigger with a small shovel burying a face-down card in a pile of cards, a tiny candle; grey background.
Row 3, left to right:
9. A cat in boxing gloves accidentally punching itself, dizzy stars around its head, still smiling; red-to-deep-rose background.
10. Two friendly cats sharing one pair of binoculars, looking at three glowing cards; sky-blue-to-navy background.
11. A cat mid-slap with a big fluffy paw, another cat's cheek squished, a comic impact star; orange-to-red background.
12. An extremely grumpy cat with puffed-up fur, crossed arms and a tiny storm cloud above its head; yellow-to-amber background.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `garbage` Dọn rác | `mark` Đánh dấu | `curse` Lời nguyền mông mèo | `barking` Mèo Sủa |
| 2 | `potluck` Góp nồi | `ilt` Để đó cho tui | `alternow` Sửa tương lai ngay | `bury` Chôn bài |
| 3 | `personal` Tự tấn công | `share` Chia sẻ tương lai | `slap` Tát | `annoy` Nổi cáu |

### Cụm 4 → `sheet4.png`: gói Mèo Xác Sống + phần còn lại + mặt sau (11 ô)

```
Row 1, left to right:
1. A cute goofy zombie cat with stitches and a bandage, arms stretched forward, rising from a small grave mound; lime-to-dark-green background.
2. Nervous cats tossing cards like snacks to a hungry cartoon zombie cat wearing a bib; rose-to-dark-red background.
3. A miner cat with a headlamp and pickaxe digging down through layers of stacked cards; amber-to-dark-ochre background.
4. A scientist cat stepping out of a glowing capsule next to an identical copy of itself, both surprised; cyan-to-dark-teal background.
Row 2, left to right:
5. A cat with a lantern digging up an old card from a mound with a small tombstone, soft moonlight; slate background.
6. A small horde of silly zombie cats charging forward together, arms out, one waving a tiny flag; green-to-very-dark-emerald background.
7. A cat with a glowing third eye on its forehead, seeing through a stack of cards to a tiny bomb hidden inside; indigo-to-deep-violet background.
8. A masked bandit cat (raccoon-style eye mask) tiptoeing away with a card in a sack; light-to-dark grey background.
Row 3, left to right:
9. A strict teacher cat with a clipboard and glasses, a row of round bombs standing in line like students; red-to-very-dark-rose background.
10. A cat staring at a glowing, sparkling crystal corn cob that casts a mysterious curse aura; pale-yellow-to-moss-green background.
11. A card-back design: a perfectly symmetrical pattern with a cute cat face and a small bomb in the centre, surrounded by repeating
    diagonal stripes and paw prints, rich burnt-orange and dark rust colours, decorative and centred.
12. Leave this panel empty: plain cream, the same colour as the gutters.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `zombie` Mèo Xác Sống | `feed` Nuôi xác sống | `dig` Đào sâu | `clone` Nhân bản |
| 2 | `grave` Đào mộ | `deadattack` Xác sống tấn công | `clairvoyance` Thấu thị | `steal` Cướp bài |
| 3 | `rollcall` Điểm danh mèo | `corn` Lời nguyền ngô pha lê | `back` Mặt sau | *(bỏ trống)* |
