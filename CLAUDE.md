# Working preferences

- When asked to "increase" or "add more" of something (loot, decoration density, chest
  counts, etc.), take the middle path — a moderate, proportionate bump. Do not max it out
  or overdo it unless explicitly told to go big.
- Never modify the FOOTPRINT_TYPE_N shape constants in `src/game/data.ts` (their dx/dy hex
  offsets, or a creature's `size`) — these were hand-defined with the user over significant
  back-and-forth and are locked. A creature that can't move because its spawn footprint
  overlaps a wall/pillar is fixed by moving that creature's spawn x/y, never by touching the
  shape. If a real change to a shape is ever needed, ask first and explain exactly why.
