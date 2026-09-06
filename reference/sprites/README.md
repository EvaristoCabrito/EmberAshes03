# reference/sprites

Cuts that are not wired into the game. Everything the game actually loads lives in
`public/game/sprites/<sprite id>/`, and `src/game/assets.ts` names each set and its frame
count — a folder here is not loaded by anything.

## lancer / lancer-min

Two cuts of the Lancer from the second reference video, kept because the container they
were made in does not survive the session.

- `lancer/` — the full pass: 12 idle, `atk-1..8`, `def-1..8`, `move-1..8`, all 256².
- `lancer-min/` — 6 idle and `atk-1..6`, the frames worth keeping out of that pass.

Neither is installed. `public/game/sprites/aldric/` (4 idle + 4 attack at 128²) is still
what the Lancer uses, on the author's call: better sprites are being made, and a pre-alpha
build should not have its art swapped out from under it. To install one later, copy the
frames into `public/game/sprites/aldric/` and update that sprite's frame counts in
`assets.ts` — the loader rejects on any missing file, so the count on disk and the count in
the code have to move together.

## familiar_spritesheet_8x8_*.png

The sheet `public/game/sprites/familiar/` was sliced out of.
