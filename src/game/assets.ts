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

export function tileVariantSrc(id: TerrainId, variant: number): string {
  return `/game/tiles/${id}${String(variant + 1).padStart(3, "0")}.png?v=16`;
}
const TILES = Object.keys(TILE_VARIANT_COUNT) as TerrainId[];
const SPRITES: SpriteId[] = ["kael", "nira", "voss", "salazar", "malrec", "aldric", "soldier", "brigand", "captain", "sorcerer", "horror", "Asherah", "pikeman", "wardog", "troll", "familiar", "swamp-blue-calf"];

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

// The familiar's new sprites are a 12-frame idle like the heroes'. Its old set was 44
// frames of a much rougher cut; loadGameArt rejects on any missing file, so this count and
// what is on disk have to move together.
const HERO_IDLE = new Set<SpriteId>(["kael", "nira", "voss", "salazar", "horror", "Asherah", "familiar"]);

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
  await Promise.all(
    (["kael", "nira", "voss", "salazar", "malrec", "aldric"] as SpriteId[]).map(async (id) => {
      const n = id === "kael" ? 12 : 4;
      attacks[id] = await Promise.all(Array.from({ length: n }, (_, i) => loadImage(`/game/sprites/${id}/atk-${i + 1}.png${id === "kael" ? "?v=2" : ""}`)));
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
  return { tiles, decorations, sprites, attacks, idles, walkDirs, impact, backdrops };
}