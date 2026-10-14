# Đấu Súng (Bang) — bộ prompt vẽ tranh (theo cụm 12 tranh)

Mỗi prompt tạo **một ảnh lưới 4 cột × 3 hàng = 12 tranh**. Bang có 173 tranh, gói trong **15 ảnh**:

| Ảnh | Nội dung | Hiện ở đâu trong game |
|---|---|---|
| `sheet1` … `sheet6` | 71 loại lá bài + mặt sau | lá trên tay, lá vừa đánh, chồng bài úp |
| `sheet7` … `sheet11` | 60 nhân vật | ảnh chân dung ở ghế, thẻ nhân vật lúc chọn |
| `sheet12` … `sheet14` | 36 lá sự kiện | banner sự kiện, bảng xem chi tiết |
| `sheet15` | 3 nhân vật + 2 sự kiện còn lại | như trên |

Chưa có tranh thì game vẫn hiện emoji như cũ, nên bạn làm dần từng cụm cũng được. Trang bị (Cơn Sốt Vàng) và vai trò chỉ hiện dạng chip nhỏ nên không cần tranh.

## Cách dùng

1. Mở công cụ tạo ảnh (ChatGPT/DALL·E, Midjourney, Ideogram, Gemini, Stable Diffusion…), dán **đoạn phong cách chung**, rồi dán prompt của **một cụm**.
2. Lưu ảnh vào `art/bang/` với tên **`sheet1.png` … `sheet15.png`** (đúng số cụm).
3. Chạy:

   ```bash
   npm install          # lần đầu, để có sharp
   npm run art:bang
   ```

   Script bỏ lề ngoài, chia ảnh thành 12 ô (trái → phải, từ hàng trên xuống), gọt khe giữa các ô, cắt mỗi ô về tỉ lệ 5:7, thu về 400×560, rồi lưu `public/games/bang/cards/<tên>.webp` và cập nhật `src/lib/bang/art.ts`. Cuối cùng nó in ra tranh nào còn thiếu.
4. Commit `public/games/bang/cards/*.webp` và `src/lib/bang/art.ts`. Thư mục `art/` chứa ảnh gốc, nặng, nên đã nằm trong `.gitignore`.

**Làm lại một tranh bị xấu:** tạo riêng tranh đó (dùng mô tả ô tương ứng, bỏ phần “sprite sheet”), lưu thành `art/bang/<tên>.png` rồi chạy lại. Ảnh lẻ luôn **thắng** ô cùng tên trong ảnh lưới. Tên file ảnh lẻ:

- lá bài: `card-<mã>.png`, ví dụ `card-bang.png`, `card-missed.png`
- nhân vật: `char-<mã>.png`, ví dụ `char-bart.png`
- sự kiện: `event-<mã>.png`, ví dụ `event-highnoon.png`
- mặt sau lá bài: `back.png`

Mã của từng tranh nằm trong bảng dưới mỗi cụm.

### Mẹo

- Yêu cầu **đúng 4 cột × 3 hàng, 12 ô bằng nhau**, có **khe và lề màu kem trơn**. Script dựa vào màu lề (lấy ở góc ảnh) để gọt khe.
- **Tạo ảnh càng to càng tốt** (≥ 2048 px, hoặc upscale trước khi lưu). Ảnh 1024 px chia 12 thì mỗi ô chỉ còn khoảng 240×340 px.
- Tỉ lệ ảnh gần vuông (≈ 20:21). Midjourney: `--ar 20:21`. ChatGPT/DALL·E: chọn ảnh vuông.
- **Không để chữ trong tranh.** Lá bài: game in số + chất ở **góc trên trái** và tên ở **dải 15% dưới cùng**, nên hai chỗ đó cần đơn giản. Nhân vật và sự kiện được cắt nhỏ thành ảnh đại diện, nên chủ thể cần **ở giữa** và **mặt nhân vật ở nửa trên**.
- Khi đã ưng một cụm, dùng ảnh đó làm **ảnh tham chiếu phong cách** cho các cụm sau (Midjourney `--sref <link>`; ChatGPT: đính kèm ảnh và nói “same art style as this image”).
- Tranh và nhân vật phải là của bạn. Đừng yêu cầu vẽ giống tranh hay nhân vật của bộ bài thương mại (BANG!…), vì đó là tác phẩm có bản quyền và repo/web này công khai. Mô tả trong file này đều là nhân vật tự nghĩ ra, dựa trên tên tiếng Việt và năng lực trong game.

## Đoạn phong cách chung (dán trước mỗi cụm)

```
A single high-resolution image laid out as a sprite sheet: exactly 4 columns × 3 rows of twelve equal-size vertical panels
(each 5:7 portrait), separated by even gutters and an outer margin of plain flat cream colour (#f5f0e6). Each panel is a
separate, complete illustration whose background fills the panel edge to edge, no borders or frames.
Original artwork for a humorous Wild West party card game. Style: warm spaghetti-western comic illustration, bold ink outlines,
textured flat colours with soft shading, dusty desert palette (ochre, rust, sand, saddle brown, faded teal sky), dramatic light.
One clear subject per panel, centred, readable at small size. The same art style and line weight in all twelve panels.
Keep the top-left corner and the bottom 15% of every panel simple. No text, no letters, no numbers, no captions, no logos anywhere.
Original designs, not imitating any existing card game, film or artist.
```

Midjourney: thêm `--ar 20:21 --style raw` vào cuối cả prompt.

**Thêm câu này** trước danh sách ô của các cụm **nhân vật** (7–11, và 3 ô đầu của cụm 15):

```
All panels are half-body portraits of different original cartoon characters facing the viewer, face in the upper half of the panel,
each with a distinctive silhouette, outfit and colour accent.
```

## Lá bài

Thứ tự ô là **trái → phải, từ hàng trên xuống**. Đừng đổi thứ tự, vì script cắt theo đúng thứ tự này (danh sách nằm trong `GAMES.bang.sheets` của `scripts/card-art.mjs`).

### Cụm 1 → `sheet1.png`: bộ gốc, lá nâu

```
Row 1, left to right:
1. A revolver firing seen from the side, a big comic muzzle-flash burst and a puff of smoke.
2. A cowboy ducking sideways as a bullet whizzes past his hat, motion lines.
3. A foamy mug of beer sliding along a polished wooden saloon bar.
4. A panicked cowboy with bulging eyes, hat flying off, grabbing at something.
Row 2, left to right:
5. A saloon dancer in a frilly dress high-kicking an object out of a cowboy's hand.
6. A stagecoach pulled by two horses racing across the desert, dust cloud behind.
7. A frontier bank vault with its heavy door swung open and gold coins spilling out.
8. A general-store counter laid out with jars, sacks, tins and tools.
Row 3, left to right:
9. Distant silhouettes of horse riders charging over a desert ridge at sunset, arrows streaking across the sky; seen from far away, no faces.
10. Two gunslingers facing each other on a dusty main street at high noon, long shadows.
11. A hand-cranked gatling gun on a wooden cart firing, smoke and shell casings.
12. A lively saloon interior behind swinging doors, everyone raising their glasses.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `card-bang` BANG! | `card-missed` Trượt! | `card-beer` Bia | `card-panic` Hoảng Loạn |
| 2 | `card-catbalou` Quậy Phá | `card-stagecoach` Xe Ngựa | `card-wellsfargo` Ngân Hàng | `card-generalstore` Tạp Hoá |
| 3 | `card-indians` Da Đỏ! | `card-duel` Đấu Tay Đôi | `card-gatling` Súng Máy | `card-saloon` Quán Rượu |

### Cụm 2 → `sheet2.png`: bộ gốc, lá xanh dương + Thị trấn Né Đạn (1)

```
Row 1, left to right:
1. A bullet-riddled wooden barrel with a cowboy peeking out from behind it.
2. A brass rifle scope, its round view showing crosshairs over a distant cactus.
3. A wild mustang rearing up in the desert, mane flying.
4. A tiny frontier jail cell with iron bars and a glum cowboy behind them.
Row 2, left to right:
5. A bundle of red dynamite sticks with a lit, sparkling fuse.
6. A small repeating pistol with a red-hot glowing barrel and a lick of flame.
7. A long-barrelled revolver resting on a leather holster.
8. A light rifle leaning against a wooden fence post.
Row 3, left to right:
9. A carbine rifle with a leather strap hanging from a saddle.
10. A long engraved lever-action rifle mounted over a stone mantel.
11. A cowboy throwing a huge punch, comic impact star.
12. A cowboy doing an acrobatic cartwheel to dodge a bullet.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `card-barrel` Thùng Gỗ | `card-scope` Ống Ngắm | `card-mustang` Ngựa Hoang | `card-jail` Nhà Giam |
| 2 | `card-dynamite` Thuốc Nổ | `card-volcanic` Súng Liên Thanh | `card-schofield` Súng Lục Dài | `card-remington` Súng Trường Nhẹ |
| 3 | `card-carabine` Súng Cạc-bin | `card-winchester` Súng Săn Dài | `card-punch` Đấm | `card-dodge` Né |

### Cụm 3 → `sheet3.png`: Thị trấn Né Đạn (2)

```
Row 1, left to right:
1. A marksman on a rooftop aiming a very long rifle at a far-away target.
2. A bottle of whisky and a full shot glass on a green poker table.
3. A bottle of tequila with a lime wedge and salt, a cactus through the window.
4. Hands pounding the keys of an upright saloon piano, music notes flying.
Row 2, left to right:
5. A saloon brawl as a cartoon dust cloud with fists, hats and chairs flying out.
6. A pair of old brass binoculars on a rock overlooking a canyon.
7. A hidden cave in a canyon wall, warm lantern light inside.
8. A worn leather bible with a bullet stuck in its cover.
Row 3, left to right:
9. A dented iron chest plate with bullet marks.
10. A huge embroidered sombrero with a bullet hole through the brim.
11. A tall cowboy hat with a bullet hole, hanging on a hook.
12. A metal canteen dripping water under the blazing sun.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `card-springfield` Súng Trường Xa | `card-whisky` Whisky | `card-tequila` Tequila | `card-ragtime` Nhạc Ragtime |
| 2 | `card-brawl` Ẩu Đả | `card-binocular` Ống Nhòm | `card-hideout` Hang Ẩn Nấp | `card-bible` Kinh Thánh |
| 3 | `card-ironplate` Giáp Sắt | `card-sombrero` Mũ Rộng Vành | `card-tengallon` Mũ Cao Bồi | `card-canteen` Bi Đông |

### Cụm 4 → `sheet4.png`: Thị trấn Né Đạn (3) + Thung Lũng Bóng Ma (1)

```
Row 1, left to right:
1. Two can-can dancers high-kicking on a small saloon stage.
2. A covered conestoga wagon rolling across the prairie.
3. A tiny derringer pistol peeking out of a lady's lace glove.
4. A bowie knife stuck upright in a wooden table.
Row 2, left to right:
5. A pepperbox pistol with a cluster of many barrels.
6. A heavy buffalo rifle, a herd of bison on the horizon.
7. A small wheeled cannon firing, a big round puff of smoke.
8. A pony-express rider galloping with bulging mail bags.
Row 3, left to right:
9. Close-up of a squinting gunslinger's eye lining up the sights of a revolver.
10. A bullet bouncing off a frying pan straight back toward the shooter.
11. Two masked women outlaws on horseback, bandanas over their faces, confident.
12. A cowboy sneaking out of a saloon window at night.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `card-cancan` Múa Cancan | `card-conestoga` Xe Thồ | `card-derringer` Súng Bỏ Túi | `card-knife` Dao Găm |
| 2 | `card-pepperbox` Súng Ổ Xoay | `card-buffalo` Súng Săn Bò | `card-howitzer` Đại Bác | `card-ponyexpress` Ngựa Trạm |
| 3 | `card-aim` Nhắm Kỹ | `card-backfire` Phản Đòn | `card-bandidas` Nữ Cướp | `card-escape` Chuồn |

### Cụm 5 → `sheet5.png`: Thung Lũng Bóng Ma (2) + Trang Bị Tận Răng (1)

```
Row 1, left to right:
1. A gunslinger fanning a revolver's hammer, several muzzle flashes in a row.
2. A last glass of red wine on the bar under a clock about to strike midnight.
3. A poker table with a fan of cards, chips and a sly grin across the table.
4. A cowboy heroically shoving a friend out of the path of a bullet.
Row 2, left to right:
5. A throwing axe spinning through the air toward a wooden post.
6. A dusty tornado sweeping cards and hats across the desert.
7. A blank reward poster nailed to a wooden wall, bags of coins below it.
8. A friendly, translucent cowboy ghost floating above a grave.
Row 3, left to right:
9. A heavy revolver with an extra shotgun barrel under the main barrel.
10. A coiled rattlesnake shaking its tail on a sun-baked rock.
11. A sawed-off double-barrel shotgun blasting a spray of pellets.
12. Hands loading brass cartridges into a revolver cylinder.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `card-fanning` Bắn Quạt | `card-lastcall` Ly Cuối | `card-poker` Xì Phé | `card-saved` Cứu Nguy |
| 2 | `card-tomahawk` Rìu Ném | `card-tornado` Lốc Xoáy | `card-bounty` Treo Thưởng | `card-ghost` Hồn Ma |
| 3 | `card-lemat` Súng Hai Cỡ | `card-rattlesnake` Rắn Chuông | `card-shotgun` Súng Hoa Cải | `card-reload` Nạp Đạn |

### Cụm 6 → `sheet6.png`: Trang Bị Tận Răng (2) + mặt sau

```
Row 1, left to right:
1. Twin revolvers firing in two different directions at once, two muzzle flashes.
2. An antique flintlock pistol with a spark at the pan and a puff of smoke.
3. Hands picking a heavy padlock with thin metal tools.
4. A cowboy ducking low as his hat flies off, a little duck waddling past.
Row 2, left to right:
5. A cowboy taking a small sip from a silver hip flask.
6. A hook on a rope snatching a hat off a table.
7. A leather bandolier full of brass bullets.
8. A frontier church bell tower with its bell swinging and ringing.
Row 3, left to right:
9. A huge big-bore hunting rifle on a tripod, aimed across a valley.
10. A double-barrel shotgun with engraved barrels on a gun rack.
11. A revolver with an absurdly long barrel.
12. Card-back design: a perfectly symmetrical pattern with a sheriff star and two crossed revolvers in the centre,
    rope and horseshoe ornaments around it, rich rust-red and gold, decorative and centred.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `card-quickshot` Bắn Nhanh | `card-flintlock` Súng Kíp | `card-lockpick` Bẻ Khoá | `card-duck` Cúi Đầu! |
| 2 | `card-nip` Hớp Rượu | `card-squaw` Giật Đồ | `card-bandolier` Đai Đạn | `card-belltower` Tháp Chuông |
| 3 | `card-bigfifty` Súng Săn Lớn | `card-doublebarrel` Súng Hai Nòng | `card-buntline` Súng Nòng Dài | `back` Mặt sau |

## Nhân vật

Nhớ thêm câu “half-body portraits…” ở trên vào trước danh sách ô.

### Cụm 7 → `sheet7.png`: bộ gốc (1)

```
Row 1, left to right:
1. A tough cowboy covered in bandages and plasters, grinning through the bruises.
2. A slick gambler in a black top hat and waistcoat, fanning playing cards.
3. A wild frontier woman in fringed buckskin and tall boots, two revolvers, fierce grin.
4. A tall foreign stranger in a long dusty duster coat and scarf, stern gaze.
Row 2, left to right:
5. A sly pickpocket in fingerless gloves, twirling someone's wallet.
6. A relaxed lucky cowboy with a four-leaf clover tucked in his hatband.
7. A sharp-eyed card reader with a monocle, peeking at the top of a deck.
8. An old man with a white beard grinning and rolling a pair of dice.
Row 3, left to right:
9. A slippery rider leaning far back in the saddle, hard to hit.
10. A cheerful scavenger holding up treasures pulled from a junk crate.
11. A keen-eyed woman sharpshooter with an eagle feather in her hat, one eye narrowed.
12. A reckless daredevil with a bottle of medicine in each hand, sweating but smiling.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `char-bart` Ba Lì Đòn | `char-blackjack` Cờ Đen | `char-calamity` Cô Tai Ương | `char-elgringo` Gã Ngoại Quốc |
| 2 | `char-jesse` Giét Móc Túi | `char-jourdonnais` Giò Đỏ May | `char-kit` Kít Soi Bài | `char-lucky` Lão Hên |
| 3 | `char-paul` Phôn Né Tránh | `char-pedro` Pê Nhặt Rác | `char-rose` Rô Mắt Ưng | `char-sid` Sít Liều Mạng |

### Cụm 8 → `sheet8.png`: bộ gốc (2) + Thị trấn Né Đạn (1)

```
Row 1, left to right:
1. A menacing hitman with a skull-print bandana and two pistols.
2. A cheerful young woman with a flower in her hair and a small pistol.
3. A hunched undertaker in black with a vulture perched on his shoulder.
4. A cocky kid gunslinger in an oversized hat, twin cap guns.
Row 2, left to right:
5. A young Native American archer in traditional clothing, calm and confident, a respectful and dignified portrait.
6. A glamorous stage star in a sequined dress with a sparkling star brooch.
7. A completely expressionless poker-faced man, unreadable eyes.
8. A gambler yanking the lever of an old slot machine.
Row 3, left to right:
9. A frontier doctor with a stethoscope round his neck and a revolver in his belt.
10. A graceful woman in a flowing dress, twisting elegantly aside.
11. A gravedigger leaning on a shovel, lantern at his feet.
12. A herbalist hunter with bundles of desert herbs on his belt.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `char-slab` Sờ Lép Sát Thủ | `char-suzy` Su Xinh | `char-vulture` Kền Kền | `char-willy` Uy Nhóc |
| 2 | `char-apache` Thổ Dân Trẻ | `char-belle` Cô Ngôi Sao | `char-bill` Bin Mặt Trơ | `char-chuck` Chắc Liều |
| 3 | `char-doc` Bác Sĩ Súng | `char-elena` Ê-lê-na | `char-greg` Thợ Đào Mộ | `char-herb` Thợ Săn Cỏ |

### Cụm 9 → `sheet9.png`: Thị trấn Né Đạn (2) + Gánh Xiếc Miền Tây (1)

```
Row 1, left to right:
1. A handyman with an open toolbox and a wrench.
2. A woman with lightning-fast hands shown as a blur, cards flying between her fingers.
3. A grinning thief with a sack of stolen goods and a raccoon on his shoulder.
4. A tiny cowgirl under an enormous hat.
Row 2, left to right:
5. A man hugging a comically tall stack of cards to his chest.
6. A jolly red-nosed drinker cradling tequila bottles.
7. An actress holding up a comedy mask and a tragedy mask.
8. An enormous bear-like giant of a man with a bushy beard, gentle smile.
Row 3, left to right:
9. A travelling trader with trinkets pinned all over his coat.
10. A collector with a wicker basket full of discarded odds and ends.
11. A man in a grey suit with several faces drawn like masks around his head.
12. A battered man with his arm in a sling, wincing.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `char-jose` Hô-xê | `char-molly` Mô-li Nhanh Tay | `char-pat` Pát Trộm Đồ | `char-pixie` Tí Hon |
| 2 | `char-sean` Sơn Ôm Bài | `char-tequilajoe` Tê Nghiện Rượu | `char-vera` Vê Bắt Chước | `char-bigspencer` Ông Bự |
| 3 | `char-flint` Phờ-lin Đổi Chác | `char-gary` Ga Nhặt Nhạnh | `char-greygory` Xám Nhiều Mặt | `char-johnpain` Giôn Đau Đớn |

### Cụm 10 → `sheet10.png`: Gánh Xiếc (2) + Cơn Sốt Vàng + Thung Lũng Bóng Ma (1)

```
Row 1, left to right:
1. A gunslinger glancing back over his shoulder with a smoking revolver.
2. A pale, stubborn man with bandages who simply refuses to fall down.
3. A man with a huge toothy grin, hand stretched out expectantly.
4. A man in a bowler hat ringing a brass hand bell.
Row 2, left to right:
5. A greedy prospector biting a gold coin.
6. A generous fellow happily tossing coins into the air.
7. A shopper pushing a small wooden cart piled with goods and a long receipt.
8. A saloon owner lady carrying several beer mugs at once.
Row 3, left to right:
9. A merchant woman with price tags hanging from her shawl.
10. A shifty trader with a snake coiled around his arm.
11. A gold-obsessed miner hugging a pickaxe, gold nuggets in his hat.
12. A mysterious woman in black holding a black rose.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `char-leevan` Li Bắn Lại | `char-teren` Tê Rèn Lì | `char-youl` Du Cười Toe | `char-donbell` Đông Chuông |
| 2 | `char-dutch` Đát Tham Vàng | `char-jacky` Giắc-ki Hào Phóng | `char-josh` Giốt Mua Chịu | `char-madam` Bà Chủ Quán |
| 3 | `char-luzena` Lu Buôn Bán | `char-raddie` Rết Đổi Vàng | `char-simeon` Si Mê Vàng | `char-blackflower` Hoa Đen |

### Cụm 11 → `sheet11.png`: Thung Lũng Bóng Ma (2) + Trang Bị Tận Răng (1)

```
Row 1, left to right:
1. A rugged mountain man in furs, snowy peaks behind him.
2. A man in a spotted bandana with a small bell on his hat.
3. A hot-tempered woman with two smoking revolvers, flames behind her.
4. A prickly man in a cactus-green poncho, cactus spines on his sleeves.
Row 2, left to right:
5. A cheerful man holding a big jug of lemonade with lemon slices.
6. A guarded man peering over a battered metal shield.
7. A monk-like bandit in a hooded robe with a rosary and a revolver.
8. A travelling preacher holding a bible high.
Row 3, left to right:
9. A burly blacksmith with a hammer, sparks flying off an anvil.
10. A fierce red-haired woman gunslinger in a crimson scarf.
11. A tinkerer with a big horseshoe magnet pulling bullets toward him.
12. A sharp-eyed woman holding a folded straight razor, cool expression.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `char-colorado` Cô-lô-ra-đô | `char-derspot` Đốm Chuông | `char-evelyn` Ê-vơ-lin Nóng Súng | `char-henry` Hen-ri Gai Góc |
| 2 | `char-lemonade` Chanh Muối | `char-mick` Mích Phòng Thủ | `char-tuco` Tu Cô Tu Sĩ | `char-alpreacher` Mục Sư Al |
| 3 | `char-bass` Bát Thợ Rèn | `char-bloody` Mê-ri Máu | `char-frankie` Phờ-ran-ki | `char-julie` Giu-li Dao Cạo |

## Lá sự kiện

Mỗi ô là **một cảnh** thể hiện luật của sự kiện. Chủ thể ở giữa vì ảnh bị cắt vuông khi hiện trên banner.

### Cụm 12 → `sheet12.png`: Giữa Trưa (1)

```
Row 1, left to right:
1. Warm rays of light breaking through clouds over the prairie, heart shapes glowing in the sky.
2. Dark storm clouds and a glowing evil-eye amulet, spade shapes swirling.
3. Four bandit brothers of increasing height standing in a row, masks on.
4. A frontier doctor bandaging a line of patients.
Row 2, left to right:
5. An abandoned town at dusk with friendly ghost cowboys drifting through the street.
6. A crowd rushing the wrong way toward a gold strike, big curved arrow shape of dust.
7. A cowboy with a pounding headache holding an ice pack to his head.
8. A man trying on a new disguise in a mirror, a second face reflected back.
Row 3, left to right:
9. A preacher at a wooden pulpit in a small frontier church, guns left at the door.
10. Several gunslingers firing from both sides of a main street.
11. A reverend firmly pouring a mug of beer onto the ground.
12. A parched desert, an empty canteen and a cow skull.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `event-blessing` Phúc Lành | `event-curse` Lời Nguyền | `event-daltons` Anh Em Nhà Cướp | `event-doctor` Bác Sĩ |
| 2 | `event-ghosttown` Thị Trấn Ma | `event-reverse` Đổ Xô Tìm Vàng | `event-hangover` Say Xỉn | `event-newidentity` Danh Tính Mới |
| 3 | `event-sermon` Bài Giảng | `event-shootout` Đọ Súng | `event-reverend` Mục Sư | `event-thirst` Khát Nước |

### Cụm 13 → `sheet13.png`: Giữa Trưa (2) + Nắm Bài (1)

```
Row 1, left to right:
1. A steam train pulling into a small desert station, steam billowing.
2. A blazing white sun over an empty main street, a clock tower showing twelve.
3. The boarded-up entrance of an abandoned mine, rusty cart on rails.
4. Bandits crouching in tall golden grass beside a trail, waiting.
Row 2, left to right:
5. Two men clasping forearms in a solemn pact, sunset behind them.
6. A coffin lid creaking open with a cartoony hand poking out.
7. A dusty bottle of strong liquor marked only with a skull and crossbones.
8. A lasso loop flying through the air and catching a hat and a pistol.
Row 3, left to right:
9. A judge's gavel and a sheriff's star resting on a thick law book.
10. Colourful glowing mushrooms in the desert under a swirling psychedelic sky.
11. A cattle ranch with a red barn, fences and grazing cows.
12. A bullet ricocheting off a tin can, zig-zag trail.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `event-train` Tàu Đến Ga | `event-highnoon` Giữa Trưa | `event-mine` Mỏ Bỏ Hoang | `event-ambush` Phục Kích |
| 2 | `event-bloodbrothers` Anh Em Kết Nghĩa | `event-deadman` Người Chết Sống Lại | `event-hardliquor` Rượu Mạnh | `event-lasso` Dây Thòng Lọng |
| 3 | `event-lawwest` Luật Miền Tây | `event-peyote` Nấm Ảo Giác | `event-ranch` Nông Trại | `event-ricochet` Đạn Nảy |

### Cụm 14 → `sheet14.png`: Nắm Bài (2) + Gánh Xiếc Miền Tây (1)

```
Row 1, left to right:
1. A revolver cylinder spinning on a card table, one chamber glinting.
2. A sniper lying on top of a wooden water tower.
3. A stern judge in a black robe raising a gavel.
4. A vengeful man sharpening a dagger by lamplight.
Row 2, left to right:
5. A clenched fist crushing a fistful of playing cards.
6. A moonlit graveyard with cartoony skeleton hands rising out of the ground.
7. A big heart pierced by an arrow above a pile of love letters.
8. An angry woman shouting, a small tornado of fury around her.
Row 3, left to right:
9. A fortune teller in a colourful wagon gazing into a crystal ball.
10. An elegant lady with a rose sliding into a neighbour's chair at the table.
11. A cheerful dancer with a banjo on a small stage.
12. A card table with every hand laid face up for all to see.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `event-roulette` Cò Quay Nga | `event-sniper` Bắn Tỉa | `event-judge` Quan Toà | `event-vendetta` Báo Thù |
| 2 | `event-fistful` Nắm Bài | `event-boneyard` Nghĩa Địa | `event-valentine` Tình Nhân | `event-dorothy` Cơn Giận Đô-rô-ti |
| 3 | `event-helena` Bà Đồng Hê-lê-na | `event-ladyrose` Quý Bà Hoa Hồng | `event-susanna` Cô Su-da-na | `event-sacagaway` Lật Bài Ngửa |

## Phần còn lại

### Cụm 15 → `sheet15.png`: 3 nhân vật + 2 sự kiện (5 ô)

```
Row 1, left to right:
1. Half-body portrait: a lively man wearing a bandolier of red chili peppers.
2. Half-body portrait: an elegant lady with a huge ribbon bow and a parasol, unimpressed look.
3. Half-body portrait: a gunslinger dressed all in red with four bullets glinting on his belt.
4. Event scene: two gunslingers in a final face-off at dusk, tumbleweed rolling between them.
Row 2, left to right:
5. Event scene: a big striped circus tent in the desert with western performers and banners (no text).
6. Leave this panel empty: plain cream, the same colour as the gutters.
7. Leave this panel empty: plain cream.
8. Leave this panel empty: plain cream.
Row 3: leave all four panels empty, plain cream.
```

| Hàng | Ô 1 | Ô 2 | Ô 3 | Ô 4 |
|---|---|---|---|---|
| 1 | `char-mexicali` Mếch-xi-ca-li | `char-abigail` Bà Á-bi | `char-redringo` Rinh-gô Đỏ | `event-showdown` Quyết Đấu |
| 2 | `event-wildwestshow` Gánh Xiếc Miền Tây | *(trống)* | *(trống)* | *(trống)* |
| 3 | *(trống)* | *(trống)* | *(trống)* | *(trống)* |

Cụm này chỉ có 5 tranh, nên có thể dễ hơn nếu bạn tạo 5 ảnh lẻ (`char-mexicali.png`, `char-abigail.png`, `char-redringo.png`, `event-showdown.png`, `event-wildwestshow.png`) thay vì một ảnh lưới.
