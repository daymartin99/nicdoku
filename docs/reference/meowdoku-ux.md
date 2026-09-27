# Meowdoku UX reference (Yandex Games build)

Researched 2026-09-27 by playing https://yandex.com/games/app/meowdoku-537825 in the built-in browser at a 390x844 viewport (mobile emulation), and by reading the game's public static bundle (`index.html`, `assets/index-*.js`, `assets/index-*.css`, build `2026.08.08.001`). This is the current build, and it differs from older descriptions of the game:

- **No score, no golden fish, no region tracker with per-colour cat icons, no back button, no bottom row of tools apart from Hint, no level map, no daily challenge, no shop, no home menu.**
- The HUD has a trophy (leaderboard), a "Level N" title, a gear, a "cats placed / N" pill, 3 hearts, a strip of rule chips, the board, and one hint button.

How values are labelled:
- **[code]** values come from the game bundle, so they are exact. Positions are in the game's logical space of **886 x 1920**. At 390px CSS width the scale is about **0.44**.
- **[meas]** values were measured from screenshots and are accurate to about ±2 CSS px.
- **[est]** values are estimates.

Engine: PixiJS canvas plus Spine for the cat animations. There is no DOM UI inside the game iframe (the only DOM is `<div id="game">` holding the canvas). Font stack: `Nunito, Inter, Arial` for canvas text (weight 800 for titles and buttons). CSS sets `touch-action:none; user-select:none; overscroll-behavior:none; -webkit-tap-highlight-color:transparent`.

---

## 1. Screens, in the order I met them

1. **Yandex portal landing page** (not the game). This is where most of the platform friction sits:
   - A full-screen IAB consent wall ("We value your privacy", 1742 partners). "AGREE" is the prominent button. Declining takes **MORE OPTIONS, then REJECT ALL** (2 taps).
   - A game card with a "Play now" button, similar-games carousels and a "Log in" button.
   - On mobile the page is a bottom sheet with "Play now".
2. **"Rotate device / This game support only portrait orientation" + PLAY** (Yandex overlay). It was a false positive under emulation (`screen.orientation` reported landscape) and I had to hide it with DOM inspection to continue. Real phones in portrait would normally not see it, but it is a platform-level interruption to be aware of.
3. **Loading/splash**: not observed. The game appeared within about 1 s and there is no branded splash in the bundle beyond an inline "The game failed to load. Please refresh." fallback (#F4EFED background, #8B5968 800-weight text).
4. **Tutorial (first launch only) starts straight away**, with no menu. There are 6 slides on a 4x4 board. Everything that is not the focus is dimmed by a dark overlay: the board cells turn into dark variants (#173941, #472715, #3B1026 and #AFE68E for the target), and the target cells get a yellow-green (#E6E62A-ish [est]) rounded outline plus an animated white 3D "hand" pointer. The slides:
   1. "**Double-tap** to place the cat on a cell." Afterwards the screen lightens and shows "Well done! Only one cat per **color**." with a **Got it!** button.
   2. "Nice! Cats can't be in the **same row or column**." with a bottom card "Tap empty cells to exclude them." The row and column cells are outlined and you tap each one.
   3. "Only the last **rose cell** remains. **Double-tap** to place a cat".
   4. "No cats can be **adjacent** to each other." with "Swipe across these cells to exclude them." (3 cells in an L shape).
   5. "Only the last **blue cell** remains…" (double-tap).
   6. "Find the **last cat**!" with the card "Tap here for a hint." and a lamp icon. Tapping it shows "Hints preview a helpful move / **Apply** to reveal it" over a dimmed board, with the target cell outlined yellow. Then you double-tap the last cat. On completion every remaining cell is auto-X'd and the screen shows "Excellent! You've mastered the rules!" with **Start Game**.
   - Keywords in tutorial copy are coloured #D03655. Colour names are coloured with the region's own colour ("blue cell" in sky blue).
   - Tutorial cards are white with rounded corners of about 12 CSS px and a soft drop shadow (a darker band under the card, like a 3D button).
5. **In-game (Level 1)** comes straight after "Start Game". **There is no level-start popup.** On later sessions, pressing "Play now" drops you directly into your current level (progress is saved in Yandex cloud or local storage).
6. **Win**: see §3.
7. **Fail ("Try Again")**: see §3.
8. **Interstitial ad**: comes before every next level and every retry (§5).
9. **Settings** (gear): a modal titled "Settings" with one row, "Sound [ON/OFF toggle]", and an orange **Done** button. The toggle is a green (#16C55F [est]) pill with a white knob. There is nothing else in it: no music, no haptics, no language, no reset.
10. **Leaderboard** (trophy): a modal titled "Leaderboard / Levels completed" with Rank, Player and Levels columns. As a guest it shows "Sign in to view leaders" and **Done**. I stopped there, since sign-in is required.
11. **Daily challenge, shop, home menu, level select**: none of these exist in this build.

**Taps from opening the app to playing a puzzle:**
- First visit: 2 taps for the consent wall, 1 for Play now, and possibly 1 for the rotate overlay, then the tutorial runs.
- Returning: 1 tap (Play now), then you are on the board.
- Inside the game: **0** taps between levels apart from the "Level N" button, but every level change carries an ad.

---

## 2. In-game layout at 390 px wide (4x4 board, Level 1)

The game iframe sits below Yandex's black top bar (32–44 CSS px tall, with Menu, the Yandex Games logo, "All Games" and fullscreen). A Yandex sticky banner of other games sometimes sits at the bottom (about 90 px, closable with ×).

| Element | Value |
|---|---|
| Page background | **#F4EFED** [code] (also used as `theme-color`) |
| Header row | Trophy button (left) and gear (right): white circles about **35 CSS px** across [meas], dusty-plum glyphs #8B5968. "Level N" centred, about 21 px, weight 800, #8B5968 [meas]. Centre line about 45 px below the top of the iframe [meas]. |
| Counter pill | White pill about **89x28 px** [meas]. Contains a tuxedo cat face (Spine), a **green placed count** (#16C55F-ish [est]) and "/4" in #8B5968, about 18 px, weight 800. |
| Lives pill | White pill about **89x28 px** containing **3 red glossy hearts** (sprites `heart_full`/`heart_dim`). A lost heart turns pale pink (dim sprite). |
| Rules strip | White card **354 px wide, about 49 px tall**, radius about 8 px, soft shadow. It holds 3 chips (**about 108x35 px**, radius 8 logical ≈ 3.5 px, fill **#F6EEE9** [code], text #8B5968, weight 600, about 11 px): "1 Cat per color", "1 Cat per column & row" (2 lines), "Cats cannot touch". Chips sit at x = 58 + i·262 logical, width 246 logical [code]. |
| Gap from rules to board | About 50–60 px of empty space [meas] (the board is vertically centred in the leftover space). |
| Board card | White (#FFFFFF), corner radius **18 logical ≈ 8 px** [code]. Side margin about **7 px** at 390 (card is about 377 px wide) [meas]. Inner padding 24 logical (4–5 grids) or 20 logical (6+), scaled, ≈ **10.5 px** [code+meas]. |
| Cell size | **4x4: about 85 px**; **5x5: about 66 px** [meas] |
| Cell gap | 12 logical (≤4), 13 (5), 9 (6+), scaled by boardSize/856, minimum 8 → **about 5.3 px** at 390 [code+meas] |
| Cell radius | `max(8, cell*0.07)` logical → **about 6 px** on an 85 px cell [code] |
| Cell fill | Flat region colour, no border, no gradient. No grid lines between cells, just the white card showing through the gaps. |
| Cat piece | Spine tuxedo cat head drawn at **0.9 x cell** [code] (overflows the cell slightly because of the ears). Cats blink and idle. All cats share one mood: idle, **sad** (ears flat, eyes shut, 3.2 s after a mistake) or **happy** (1.85 s on the final cat). |
| X glyph | 2 strokes, half-length **0.306 x cell** (the X spans **61 %** of the cell), stroke width **max(9 logical, 0.16 x cell)** ≈ **13.6 px** on an 85 px cell, **round caps**, alpha 0.98. **White** (#FFFFFF) normally, **#D03655** for a wrong-cat X [code]. Very bold and chunky, sitting directly on the colour with no background chip. |
| Hint button | White circle about **51 px** [meas], centred about 30 px below the board, with a yellow 3D lamp icon. Red badge (**#D03655**, about 25 px, white 800-weight number) top-right showing hints left (starts at **5**). |
| Bottom | Empty below the hint button. There are no other tool buttons. (Assets for a "cat tool" and token count exist in the bundle, `catTokens=5`, but it was not shown.) |

Touch targets: the whole cell is the hit area, including under the gap offsets (`cellFromPoint`). Header buttons are hit-tested as circles of 58 logical radius (about 25 px) [code], so they are generous.

---

## 3. Interaction feel (exact timings from code, confirmed in play)

### Input model
- Pointer Events with `setPointerCapture`. There is a mouse/touch fallback and duplicate-pointer filtering.
- **Single tap on an empty cell gives an X after 80 ms** (`gt=0x50`).
  - The X is committed after 80 ms, not after the double-tap window, so it feels instant. A 180 ms cell "press" animation (scale down to 0.945 and nudge down 3 logical px on a sine curve) starts on pointerdown.
  - The X draws in over **190 ms**: stroke 1 animates over the first 62 % of progress, stroke 2 over the last 72 %, overlapping, while the glyph scales from **0.88 to 1.0**.
  - The X comes with a soft ring and confetti-dot burst (desktop). Effects are skipped for drag-marked cells on touch devices.
- **Double-tap window is 420 ms** (`ht=0x1a4`). A second tap on the same cell within 420 ms turns it into a **cat**. The X from the first tap is simply replaced, so there is no visible flash worth mentioning.
- **Tap on an X clears it** (toggle, with an erase animation and sound). This worked in the tutorial and in normal play. Once in play, repeated taps on the same X did not clear it, which I believe was the input-lock bug below and not intended behaviour.
- **Tap on a placed cat** does nothing. **Double-tap on a placed cat removes it** (counter decrements). Given (pre-placed) cats are locked: tapping them only pulses the cell white.
- **Drag**:
  - The drag starts once the pointer has moved **14 logical px (about 6 CSS px)** from pointerdown (`_t=0xe`).
  - **Drag mode is set by the first cell.** Starting on an empty cell marks X on every empty cell passed. **Starting on an X erases** X's along the path and leaves empty cells alone (confirmed).
  - The path is interpolated in steps of `max(10, cell*0.32)` so fast swipes don't skip cells. On touch devices it is applied in batches of up to 10 cells per animation frame.
  - Cats and locked cells are skipped. Drag sound and haptics are throttled to one every 58 ms.
- **No auto-X in normal play.** Placing a cat does *not* auto-exclude its row, column, neighbours or region (auto-exclude exists in code but only runs in the tutorial). Completing the puzzle does not fill X's either (the tutorial did).
- **No undo button.**

### Wrong cat (double-tap on a non-solution cell)
The game checks against the stored solution, not against the rules. Everything below happens at once (confirmed):
1. A heart is lost straight away (the heart sprite turns pale).
2. The cell becomes an **X** (the cat is never shown). A broken-heart sprite (two halves, `et_broken_heart_1/2`) splits over the cell. When that finishes, the X turns **crimson #D03655** and stays that way (it can be erased like any X).
3. The cell pulses in **#FF3158**.
4. **The board shakes horizontally for 360 ms**: `x += sin(t·10π)·(1−t)·12` logical, which is about ±5 px decaying over 5 oscillations.
5. Error sound (`mark_wrong_1.ogg`) and vibration pattern [18, 30, 18] ms.
6. **Every cat on the board turns sad** for 3.2 s.
7. At 0 hearts the **fail screen opens 980 ms later**.

### Correct cat
- The cell press animation plays.
- The cat drops in and pops with overshoot (it briefly grows past the cell edge, about 1.3x [est]).
- A radial light sprite scales from 0.72x to 1.5x the cell over **620 ms** while rotating and fading.
- A burst of 18 coloured confetti bits and 10 white sparkles.
- `mark_cat.ogg` and a 16 ms vibration.
- The counter number (green) updates immediately. There is no count-up animation.

### Region completion
There is no separate region-complete effect. The region tracker does not exist in this build. The counter "k/N" is the only progress UI.

### Win sequence
- Last correct cat: the cats turn happy, the `all_cleared` sound plays, and the **overlay opens 1.9 s later** (`0x76c`).
- The overlay is a full-screen **#111111 at 82 % alpha**. On it:
  - A random word from ["Incredible", "Genius", "Intelligent", "Awesome", "Brilliant", "Purrfect"]: white, 82 logical px (about 36 CSS px), weight 800, **orange stroke #F59A18**, with a brown (#7A3E13) shadow copy.
  - A large rendered trumpet-playing tuxedo cat with a rotating ray-light sprite, pulsing yellow (#FFDF3F) concentric glow rings and a falling confetti sprite.
  - A 12 s looping pulse tween.
- The **"Level N+1" button appears only after 2.0 s** (then fades in over 260 ms). **The overlay cannot be skipped or tapped through.** Total time from the last tap to a usable button is about **3.9 s**.
- The win screen has no score, stars, time or share button.
- Pressing the button shows a **"loading" overlay** (#111111 at 64 %, white ring with an orange #F59A18 dot spinner), then an **interstitial ad**, then the next level.

### Fail sequence ("Try Again")
- The same dark overlay. The title "Try Again" is white with a crimson outline.
- A big crying tuxedo cat hugging a broken red heart, with tears and small floating hearts.
- The **"Retry" button appears after 2.0 s** and is the only option. There is no "continue with an ad", no "back to menu" and no hint offer.
- Retry leads to the **interstitial ad**, then the same level restarts from scratch with 3 hearts.

### Hints
- 5 free hints, and the count persists across levels.
- A hint dims the board and outlines the relevant cells. It **previews the X's it would place** (semi-transparent white X's), shows a didactic message card (#8B5968 text with the key phrase in #D03655) and an orange **Apply** button. Examples:
  - "Use this cat: **exclude cells in its row**"
  - "Cats can't touch: exclude its neighbors"
  - "Only one empty {color} cell remains"
  - "{color} can only be in this row"
  - "Look here - this cell can safely hold a cat"
- Tapping outside Apply keeps the hint open (only a click sound).
- At 0 hints, tapping the lamp starts a **rewarded video** that grants **+1 hint**. If ads are unavailable it shows "Ads are unavailable :(".

### Haptics and sound (code)
| Event | Vibration |
|---|---|
| X / erase | 8 ms (throttled to one per 58 ms on touch) |
| Cat | 16 ms |
| Error / fail | [18, 30, 18] ms |
| Win | [16, 28, 16] ms |

- Sounds: `mark_x_2`, `unmark_x_2`, `mark_cat`, `mark_wrong_1`, `all_cleared`, `level_win`, `level_fail`, `use_hint`, `btn_click_2`, `board_enter_1`, `tile_handlike_clip`. On a drag of many cells, extra generated blips layer up (up to 2 more).

---

## 4. Colours

UI (all [code]):
| Token | Hex |
|---|---|
| Page background | `#F4EFED` |
| Primary text / icons | `#8B5968` (dusty plum) |
| Accent / wrong X / hint badge / keywords | `#D03655` |
| Wrong-cell pulse | `#FF3158` |
| Primary button (orange pill, 3D darker bottom edge) | `#F59A18` (white 800-weight label) |
| Rule chip fill | `#F6EEE9` |
| Cards / board / pills | `#FFFFFF` |
| Modal / result overlay | `#111111` at 82 % (win/fail), 64 % (ad-wait) |
| Win glow | `#FFDF3F` |
| Win title shadow | `#7A3E13` |

Region palette with the game's own colour names (used in hint copy) [code]:
| Name | Hex |
|---|---|
| Olive Yellow | `#DDBC48` |
| Rose | `#E09EBD` |
| Berry Rose | `#B75888` |
| Violet | `#8F6FCC` |
| Sky Blue | `#6FC1E2` |
| Teal | `#50BDAD` |
| Mint Green | `#AEE194` |
| Caramel | `#A56946` |
| Pink | `#F690E9` |
| Peach | `#F6A36D` |
| Steel Blue | `#6481B2` |

- Each level carries its own palette order. There are 8 base orderings of the first 8 colours, and big boards add Pink, Peach and Steel Blue.
- Tutorial colours: Sky `#6CC6E3`, Orange `#FFA567`, Mint `#AEE68D`, Magenta `#BE5A8D`.
- The palette is soft, mid-saturation and pastel-leaning. White X's read clearly on all of them. The yellows are the weakest contrast for a white X.

---

## 5. Ads and friction (in the order met)

1. **IAB consent wall** before anything else. Accepting is 1 tap. Rejecting takes 2 taps via "MORE OPTIONS".
2. **Yandex landing page / bottom sheet** with "Play now", a "Log in to save progress" nag and similar-games carousels.
3. **Rotate-device overlay** with a PLAY button that did nothing under emulation (a false positive).
4. **Persistent Yandex top bar** (about 32–44 px) and a **sticky bottom "other games" banner** (about 90 px, closable) that eat vertical space during play.
5. **Interstitial before every next level and every retry.**
   - The game shows its own dark "please wait" spinner overlay first (the ad timeout is 60 s).
   - The ad itself varied: a Google full-screen video ad (small "Close" top-right, big "Learn More" CTA) or a Yandex ad-feed grid (× top-right).
   - Observed waits: **about 12 s** (retry) and **about 16 s** (level 3) from the button tap until the ad could be closed.
6. **An unexplained full-screen grey veil** appeared twice right after a double-tap mid-level (probably a platform or ad layer). It swallowed the input and had to be tapped away.
7. **Win/fail buttons are locked for 2 s** on top of the 1.9 s pre-win delay.
8. **Hints beyond 5 cost a rewarded video.**
9. **Leaderboard needs sign-in.**
10. **Input occasionally locked up.** Taps on the board or buttons were ignored until I clicked an empty area. This looks consistent with the game rejecting pointers while a stale `activePointerId` is still set, since `handlePointerStart` returns early if another pointer id is active. In our clone, pointerdown should always reset any stale pointer.

---

## 6. Verdict

### The 5 things most worth copying
1. **The X feel.** The X commits 80 ms after the tap (it doesn't wait for the double-tap window), draws its two strokes in over 190 ms with a 0.88→1 scale, sits on a tiny cell-press dip, and is a chunky white X with round caps (61 % of the cell, stroke about 16 % of the cell). This is the core of why marking feels great.
2. **Drag rules.** The first cell decides the mode (start on an X to erase, start on empty to mark). The drag starts after about 6 px of movement, the path is interpolated so fast swipes never skip cells, cats and givens are skipped, and effects are batched per frame for smoothness.
3. **Mistake feedback that teaches without dead-ending.** The heart goes instantly, the wrong cell becomes a *red* X (so the information is kept), with a 360 ms decaying board shake, a broken-heart split and all cats turning sad. It is clear but brief.
4. **Clean, calm board styling.** Warm off-white page (#F4EFED), white rounded board card, flat pastel cells with small (about 5 px) gaps and small radii (about 6 px), plum text (#8B5968) and a single crimson accent (#D03655). There are no borders and no gradients.
5. **Didactic hints.** Each hint previews the exact X's it will place, says *why* in one sentence using the colour's name, and needs an explicit Apply. The copy strings are worth borrowing: "Use this cat: exclude cells in its row", "Only one empty {color} cell remains", "{color} can only be in this row". The tutorial is also concise: 6 steps, each rule taught with a real action.

### The 5 worst frictions (do NOT copy)
1. **An interstitial before every next level and every retry**, with a 12–16 s wait including a spinner. Tapping "Retry" is punished with an ad.
2. **Forced waits**: 1.9 s before the win overlay plus 2.0 s before its button can be pressed (and 2.0 s on fail). The celebration can't be skipped, so each level costs about 4 s of dead time.
3. **Platform chrome and gates**: consent wall, landing page, rotate overlay, top bar and sticky bottom banner. Two or more taps and roughly 130 px of lost height before you see a board.
4. **Fail has only Retry.** A full restart (with an ad) after 3 mistakes. There is no undo, no "continue" option and no path back to the board with your marks kept. Mistakes are judged against the stored solution rather than the rules, so a "logically possible" guess also costs a heart.
5. **Fragile input.** Taps occasionally ignored (stale pointer lock) and a stray grey veil swallowing taps. Plus a thin feature set around the board: no undo, no auto-X option, no settings beyond sound, and the leaderboard is locked behind sign-in.
