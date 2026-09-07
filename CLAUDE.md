# Working preferences

- **Do only what was asked. Nothing else.** No extra polish, no adjacent improvement, no
  "while I was in there". If something else looks wrong, say so in a sentence and leave it.
- **A number the user gives is the number.** Asked for 0.2666, it is 0.2666 — not 0.2666.1,
  not the next one up, not a scheme that seemed tidier. The same goes for counts, sizes and
  any other figure they name.

- **Always show the screenshots.** This is a game — the user works by looking at it. Any
  screenshot taken while verifying a change gets sent to them, not just read and described.
  Describing a picture instead of showing it hides the work and wastes their time. Send the
  before/after of anything visual, every time, without being asked.

- When asked to "increase" or "add more" of something (loot, decoration density, chest
  counts, etc.), take the middle path — a moderate, proportionate bump. Do not max it out
  or overdo it unless explicitly told to go big.
- Never modify the FOOTPRINT_TYPE_N shape constants in `src/game/data.ts` (their dx/dy hex
  offsets, or a creature's `size`) — these were hand-defined with the user over significant
  back-and-forth and are locked. A creature that can't move because its spawn footprint
  overlaps a wall/pillar is fixed by moving that creature's spawn x/y, never by touching the
  shape. If a real change to a shape is ever needed, ask first and explain exactly why.

## Music

- **Never rename a track file.** The user navigates the library by those names; a renamed
  track is a track they cannot find again. The one exception is a change they ask for by
  name (they asked for the "LANDR-" master tag to be stripped — LANDR is a mastering
  service's tag, not part of any title).
- **Never delete a track, or anything else, that was not asked for.** Byte-identical is not
  a reason: two copies under two names are two entries the user looks for. If something
  looks redundant, say so and leave it alone.
- **Never assume a track belongs to one map.** The same piece is deliberately used by
  several missions, and it must keep playing from where it left off when moving between
  them — the audio element is shared and is not rewound on a change of mission. Do not
  "fix" that.
- Every track lives in `public/game/MUSIC/`, and `MUSIC_TRACKS` in `src/game/data.ts` lists
  the folder so the editor's Trilha dropdown offers all of them. A file added to the folder
  needs its name added to that list.
