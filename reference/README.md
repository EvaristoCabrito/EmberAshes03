# reference

Source and concept material that is not shipped: nothing here is loaded by the game at
runtime, and nothing under `src/` or `public/` points at it. It lives in the repo so the
art it produced can be re-cut later without hunting for the original.

- `art/` — placeholder sheets, concept passes and screenshots (paper doll, backpack, weapon
  and skill icon sets, title treatments, hex studies, world maps).
- `sprites/` — spritesheets a character was cut from. `familiar_spritesheet_8x8_*.png` is
  what `public/game/sprites/familiar/` was sliced out of.
- `audio/` — tracks not wired into the game. The world-map piece is here rather than in
  `public/game/music/`, which holds only what `src/game/audio.ts` actually plays.

Shipped art lives in `public/game/` — that is the only place the game reads from.

## art/barricade

The four barricade renders, on black. `log-bundle-b.jpg` is what
`public/game/decorations/barricade.png` was matted out of — one hex, 420x353. The two
spiked palisades are long: they would suit a two-hex variant, which does not exist yet.
