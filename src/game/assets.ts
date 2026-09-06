import { DECORATIONS, decorationImage } from "./data";
import type { GameArt, SpriteId, TerrainId } from "./types";

// Number of art variants available per terrain, e.g. plains001.png / plains002.png.
// Index 0 (the "001" file) is what every mission renders with unless it names a
// different variant in Mission.tileVariants — keep it as the tile that's safe
// for existing maps.
export const TILE_VARIANT_COUNT: Record<TerrainId, number> = {
  plains: 1,
  woods: 2,
  ruins: 1,
  water: 2,
  ember: 1,
  hill: 1,
  flame: 1,
  column: 1,
  nave: 1,
  barricade: 1,
  highwood: 1,
  highruin: 1,
  chest: 1,
  door: 1,
  deadtree: 1,
  void: 1,
};

/** The art file a tile variant paints with, without path or cache-buster — "woods002".
 * Two variants of the same terrain differ only in art, so this is the only way to tell
 * from a painted map which of them a cell is actually using. */
export function tileVariantName(id: TerrainId, variant: number): string {
  return `${id}${String(variant + 1).padStart(3, "0")}`;
}

export function tileVariantSrc(id: TerrainId, variant: number): string {
  return `/game/tiles/${tileVariantName(id, variant)}.png?v=16`;
}
const TILES = Object.keys(TILE_VARIANT_COUNT) as TerrainId[];
const SPRITES: SpriteId[] = ["kael", "nira", "voss", "salazar", "malrec", "aldric", "soldier", "brigand", "captain", "sorcerer", "horror", "Asherah", "pikeman", "wardog", "troll", "familiar", "swamp-blue-calf", "ancient-golem"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const fail = () => reject(new Error(`Falha ao carregar ${src}`));
    const t = window.setTimeout(fail, 8000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      fail();
    };
    img.src = src;
  });
}

// Sprites cut as a 12-frame idle rather than the 4-frame default — the heroes, the two
// big horrors, and the two creatures cut from reference video (familiar, ancient golem).
// loadGameArt rejects on any missing file, so this set and what is on disk have to move
// together.
const HERO_IDLE = new Set<SpriteId>(["kael", "nira", "voss", "salazar", "horror", "Asherah", "familiar", "ancient-golem"]);

export async function loadGameArt(): Promise<GameArt> {
  const tiles = {} as Record<TerrainId, HTMLImageElement[]>;
  await Promise.all(
    TILES.map(async (id) => {
      const n = TILE_VARIANT_COUNT[id];
      tiles[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(tileVariantSrc(id, i))));
    }),
  );
  const decorations = {} as Record<string, HTMLImageElement>;
  await Promise.all(
    Object.keys(DECORATIONS).map(async (id) => {
      decorations[id] = await loadImage(decorationImage(id));
    }),
  );
  const sprites = {} as Record<SpriteId, HTMLImageElement[]>;
  const attacks: Partial<Record<SpriteId, HTMLImageElement[]>> = {};
  await Promise.all(
    SPRITES.map(async (id) => {
      const n = HERO_IDLE.has(id) ? 12 : 4;
      const cacheBust = id === "troll" ? "?v=11" : id === "Asherah" ? "?v=3" : id === "familiar" ? "?v=6" : "";
      sprites[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`/game/sprites/${id}/${i + 1}.png${cacheBust}`)));
    }),
  );
  // Attack cuts, per sprite: how many atk-*.png frames are on disk, and the cache-bust the
  // set was last republished under. attackPose spreads whatever count it finds across the
  // lunge/hit/recover stages, so a set only has to be listed here to animate.
  const ATTACK_FRAMES: Partial<Record<SpriteId, { n: number; bust: string }>> = {
    kael: { n: 12, bust: "?v=2" },
    nira: { n: 4, bust: "" },
    voss: { n: 4, bust: "" },
    salazar: { n: 4, bust: "" },
    malrec: { n: 4, bust: "" },
    aldric: { n: 4, bust: "" },
    familiar: { n: 8, bust: "?v=6" },
    "ancient-golem": { n: 8, bust: "" },
  };
  await Promise.all(
    (Object.keys(ATTACK_FRAMES) as SpriteId[]).map(async (id) => {
      const { n, bust } = ATTACK_FRAMES[id]!;
      attacks[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`/game/sprites/${id}/atk-${i + 1}.png${bust}`)));
    }),
  );
  // Walk cycles: move-*.png, same shape as the attack table. A sprite absent from here has
  // no walk cut and falls back to its idle loop played faster, as every sprite used to.
  const WALK_FRAMES: Partial<Record<SpriteId, { n: number; bust: string }>> = {
    familiar: { n: 8, bust: "?v=6" },
    "ancient-golem": { n: 8, bust: "" },
  };
  const walks: Partial<Record<SpriteId, HTMLImageElement[]>> = {};
  await Promise.all(
    (Object.keys(WALK_FRAMES) as SpriteId[]).map(async (id) => {
      const { n, bust } = WALK_FRAMES[id]!;
      walks[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`/game/sprites/${id}/move-${i + 1}.png${bust}`)));
    }),
  );
  const impact = await Promise.all([1, 2, 3, 4].map((n) => loadImage(`/game/fx/impact-${n}.png`)));
  const backdrops: Record<string, HTMLImageElement> = {
    profundezas: await loadImage("/game/assets/profundezas-bg.jpg?v=2"),
  };
  const idles: Partial<Record<SpriteId, HTMLImageElement[]>> = {
    kael: await Promise.all(Array.from({ length: 36 }, (_, i) => loadImage(`/game/sprites/kael/stand-${i + 1}.png?v=2`))),
  };
  const walkDirs: GameArt["walkDirs"] = {
    kael: {
      front: await loadImage("/game/sprites/kael/walk-front.png"),
      back: await loadImage("/game/sprites/kael/walk-back.png"),
      side: await loadImage("/game/sprites/kael/walk-side.png"),
    },
  };
  return { tiles, decorations, sprites, attacks, walks, idles, walkDirs, impact, backdrops };
}