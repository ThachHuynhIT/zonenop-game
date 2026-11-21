# Pixel UI verification

Verified locally on 2026-11-20–21 using the Playwright connector and synthetic `PixelQA` / `Bạn bè` accounts, HTTP responses and WebSocket views. No real account was created and no production room was joined. The synthetic session token is deliberately invalid outside the intercepted requests.

- `hub-desktop.png` / `hub-mobile.png`: production build at 1440×900 / 390×844.
- `login-mobile.png`: signed-out view at 390×844.
- `typhu-mobile.png`: Cờ Tỷ Phú fixture at 390×844; detailed board art and game geometry preserved.

## Observed checks

| Area | Coverage | Result |
|---|---|---|
| Eight online games | Waiting, playing and ended: 24 cases | Rendered without page errors or horizontal overflow |
| Online tables | 320×740, 360×800, 390×844, 768×1024, 844×390: 40 cases | No horizontal document overflow |
| Hub, eight lobbies, Contra | 320×740, 390×844, 1440×900, 844×390: 40 cases | No horizontal document overflow |
| Spectator views | All eight online games | Rendered without page errors or overflow |
| Reconnect | Close an accepted Tiến Lên fixture socket with code 1012 | Reconnecting status appeared, one replacement joined, no page errors |
| Dialogs | Score/rules/guide dialog in each online game at 390 and 1440px | Named; Tab remains inside; Escape closes and returns focus. Mobile Vaul failure was reproduced and rechecked after fixing autofocus/restoration |
| Chat | Open, incoming message while focusing a game control, reading older messages, failed acknowledgement and retry | Opening focus only; external focus/scroll preserved; failed draft retained and retry succeeded |
| Mèo Nổ hidden hand | Four selectable face-down cards | Generic labels, no identity in title, `aria-pressed` changed false → true |
| Registration | Mismatched passwords; widths 320/360/390/768/1440 | Client validation shown; no overflow |
| Contra | Token scope, focused start/movement, focus loss, Enter on return link | Palette resolved; link navigated correctly. Blur/hidden/repeat/modifier cleanup covered by unit tests |
| Production CSS/chunks | Hub, Tiến Lên, Nối Chữ, Splendor; mobile dialogs | Correct display font; focus/restore checks passed; no page errors |

Reduced-motion emulation was included when selecting the hidden hand and navigating Contra. Source uses `motion-safe` for decorative pulses and MotionConfig's user preference. Screenshot/fixture checks do not verify backend rules, true multiplayer timing, every action branch, every map size or physical iOS/Android browser behavior. Contra remains a keyboard game.
