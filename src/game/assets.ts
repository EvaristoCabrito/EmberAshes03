import { DECORATIONS, decorationImage } from "./data";
import type { GameArt, SpriteId, TerrainId } from "./types";

// Number of art variants available per terrain, e.g. plains01.png/plains02.png. Index 0
// (the "01" file) is what every mission renders with unless it names a different variant
// in Mission.tileVariants — keep it as the tile that's safe for existing maps.
export const TILE_VARIANT_COUNT: Record<TerrainId, number> = {
  plains: 3,
  woods: 2,
  ruins: 2,
  water: 2,
  ember: 2,
  hill: 2,
  flame: 2,
  column: 2,
  nave: 2,
  barricade: 2,
  highwood: 2,
  highruin: 2,
  chest: 2,
  door: 2,
  deadtree: 1,
  void: 1,
};
const TILES = Object.keys(TILE_VARIANT_COUNT) as TerrainId[];
const SPRITES: SpriteId[] = ["kael", "nira", "voss", "salazar", "malrec", "aldric", "soldier", "brigand", "captain", "sorcerer", "horror", "pikeman", "wardog", "troll", "familiar"];

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

const HERO_IDLE = new Set<SpriteId>(["kael", "nira", "voss", "salazar", "horror"]);

export async function loadGameArt(): Promise<GameArt> {
  const tiles = {} as Record<TerrainId, HTMLImageElement[]>;
  await Promise.all(
    TILES.map(async (id) => {
      const n = TILE_VARIANT_COUNT[id];
      tiles[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`/game/tiles/${id}${String(i + 1).padStart(2, "0")}.png?v=6`)));
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
      const cacheBust = id === "troll" ? "?v=11" : id === "horror" ? "?v=2" : "";
      sprites[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`/game/sprites/${id}/${i + 1}.png${cacheBust}`)));
    }),
  );
  await Promise.all(
    (["kael", "nira", "voss", "salazar", "malrec", "aldric"] as SpriteId[]).map(async (id) => {
      const n = id === "kael" ? 12 : 4;
      attacks[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`/game/sprites/${id}/atk-${i + 1}.png${id === "kael" ? "?v=2" : ""}`)));
    }),
  );
  const impact = await Promise.all([1, 2, 3, 4].map((n) => loadImage(`/game/fx/impact-${n}.png`)));
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
  return { tiles, decorations, sprites, attacks, idles, walkDirs, impact };
}