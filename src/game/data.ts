import { TIER_KEYS } from "./types";
import type { Bag, ClassDef, ClassId, DecorationDef, DecorationPlacement, EquipmentDef, EquipSlot, HealId, Mission, PotionId, SpellKind, TerrainDef, TerrainId, TierKey, Unit, WeaponDef, WorldLocation } from "./types";

export const TERRAIN: Record<TerrainId, TerrainDef> = {
  plains: { id: "plains", name: "Planície", moveCost: 1, def: 0, atk: 0, passable: true },
  woods: { id: "woods", name: "Bosque", moveCost: 2, def: 1, atk: 0, passable: true },
  ruins: { id: "ruins", name: "Ruínas", moveCost: 1, def: 2, atk: 0, passable: true },
  water: { id: "water", name: "Água", moveCost: 99, def: 0, atk: 0, passable: false },
  ember: { id: "ember", name: "Brasa", moveCost: 99, def: 0, atk: 0, passable: false },
  hill: { id: "hill", name: "Barranco", moveCost: 2, def: 1, atk: 2, passable: true, height: 1 },
  flame: { id: "flame", name: "Chama", moveCost: 3, def: 0, atk: 0, passable: true, hazardDice: 1, hazardFaces: 8 },
  column: { id: "column", name: "Coluna", moveCost: 99, def: 0, atk: 0, passable: false, blocksShot: true },
  nave: { id: "nave", name: "Laje negra", moveCost: 1, def: 0, atk: 0, passable: true },
  barricade: { id: "barricade", name: "Barricada", moveCost: 99, def: 0, atk: 0, passable: false, blocksShot: true },
  highwood: { id: "highwood", name: "Tronco morto", moveCost: 2, def: 1, atk: 2, passable: true, height: 1 },
  highruin: { id: "highruin", name: "Casa abandonada", moveCost: 2, def: 1, atk: 2, passable: true, height: 1 },
  chest: { id: "chest", name: "Baú trancado", moveCost: 99, def: 0, atk: 0, passable: false },
  door: { id: "door", name: "Porta trancada", moveCost: 99, def: 0, atk: 0, passable: false, blocksShot: true },
  deadtree: { id: "deadtree", name: "Tronco caído", moveCost: 2, def: 1, atk: 2, passable: true, height: 1 },
  /** Pure void — a building block for closed/indoor maps: apaga o terreno e nem se atravessa, nem se vê através. */
  void: { id: "void", name: "Vazio", moveCost: 99, def: 0, atk: 0, passable: false, blocksShot: true },
};

// Footprint "tamanho tipo N" catalog: standard, reusable creature footprint shapes, named by
// their hex count. Every entry is centered on the unit's own front tile (dy:0 is the row
// closest to the player, where the feet render) rather than spread out to one side. New
// creature sizes should get their own FOOTPRINT_TYPE_N here instead of a one-off shape.

/** Tipo 3 — a normal side-by-side pair plus one hex behind, on the creature's back (e.g. o Cão de guerra). */
const FOOTPRINT_TYPE_3 = [
  { dx: 0, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
];

/** Tipo 8 — a 2-wide/3-tall block plus one hex above the head and one at the arms row (Troll, Asherah).
 * Exported so the renderer can key its "big creature" draw-size correction off the footprint
 * shape itself (reference equality) instead of a hardcoded classId, the same size correction
 * applying to every Type 8 creature by default rather than needing a one-off per class. */
export const FOOTPRINT_TYPE_8 = [
  { dx: 0, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 0, dy: -2 },
  { dx: 1, dy: -2 },
  { dx: 0, dy: -3 },
];

const DECO_PAIR = [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }];
const DECO_TRIO = [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }];

// Multi-hex terrain props: rendered as one image over their whole footprint instead of
// clipped per hex (see DecorationDef). Cropped from LargeHexes1-3.jpg.
export const DECORATIONS: Record<string, DecorationDef> = {
  "mountain-ridge": { id: "mountain-ridge", name: "Cordilheira", footprint: DECO_PAIR },
  "spike-rocks": { id: "spike-rocks", name: "Agulhas de Pedra", footprint: DECO_PAIR },
  "dead-tree-large": { id: "dead-tree-large", name: "Árvore Morta Grande", footprint: DECO_PAIR },
  "dense-forest": { id: "dense-forest", name: "Bosque Denso", footprint: DECO_PAIR },
  "broken-cliff-wall": { id: "broken-cliff-wall", name: "Muralha Rochosa Partida", footprint: DECO_PAIR },
  "boulder-cluster": { id: "boulder-cluster", name: "Amontoado de Pedras", footprint: DECO_TRIO },
  "ruined-cottage": { id: "ruined-cottage", name: "Casa em Ruínas", footprint: DECO_PAIR },
  "broken-tower": { id: "broken-tower", name: "Torre Derrubada", footprint: DECO_PAIR },
  "ruined-chapel": { id: "ruined-chapel", name: "Capela em Ruínas", footprint: DECO_PAIR },
  "abandoned-mansion": { id: "abandoned-mansion", name: "Mansão Abandonada", footprint: DECO_TRIO },
  "stone-bridge": { id: "stone-bridge", name: "Ponte de Pedra", footprint: DECO_PAIR },
  "broken-wall-segment": { id: "broken-wall-segment", name: "Muralha em Ruínas", footprint: DECO_PAIR },
  gatehouse: { id: "gatehouse", name: "Portão Fortificado", footprint: DECO_PAIR },
  watchtower: { id: "watchtower", name: "Torre de Vigia", footprint: DECO_PAIR },
  "ancient-shrine": { id: "ancient-shrine", name: "Santuário Antigo", footprint: DECO_PAIR },
};

export function decorationImage(id: string): string {
  return `/game/decorations/${id}.png`;
}

/** Every hex a placed decoration's footprint covers — impassable and blocks line of
 * sight, independent of the terrain tile underneath (per user: "half covered is not a
 * walking path"). */
export function decorationCells(placements: { id: string; x: number; y: number }[]): Set<string> {
  const out = new Set<string>();
  for (const p of placements) {
    const def = DECORATIONS[p.id];
    if (!def) continue;
    for (const { dx, dy } of def.footprint) out.add(`${p.x + dx},${p.y + dy}`);
  }
  return out;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  swordsman: {
    id: "swordsman",
    name: "Guerreiro",
    role: "Linha de frente",
    hp: 34,
    atk: 9,
    mag: 0,
    def: 6,
    res: 3,
    mov: 5,
    minRange: 1,
    maxRange: 1,
    sprite: "kael",
    size: 1,
    init: 7,
  },
  archer: {
    id: "archer",
    name: "Arqueira",
    role: "Alcance",
    hp: 24,
    atk: 8,
    mag: 0,
    def: 3,
    res: 4,
    mov: 6,
    minRange: 2,
    maxRange: 3,
    sprite: "nira",
    size: 1,
    init: 3,
  },
  mage: {
    id: "mage",
    name: "Mago Negro",
    role: "Magia",
    hp: 22,
    atk: 3,
    mag: 10,
    def: 2,
    res: 6,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "voss",
    size: 1,
    init: 5,
  },
  healer: {
    id: "healer",
    name: "Curandeiro",
    role: "Cura",
    hp: 26,
    atk: 4,
    mag: 8,
    def: 3,
    res: 6,
    mov: 5,
    minRange: 1,
    maxRange: 1,
    sprite: "salazar",
    size: 1,
    init: 8,
  },
  soldier: {
    id: "soldier",
    name: "Soldado",
    role: "Milícia",
    hp: 31,
    atk: 8,
    mag: 0,
    def: 4,
    res: 2,
    mov: 3,
    minRange: 1,
    maxRange: 1,
    sprite: "soldier",
    size: 1,
    init: 2,
  },
  pikeman: {
    id: "pikeman",
    name: "Piqueiro",
    role: "Pique",
    hp: 33,
    atk: 8,
    mag: 0,
    def: 5,
    res: 2,
    mov: 3,
    minRange: 1,
    maxRange: 2,
    sprite: "pikeman",
    size: 1,
    init: 3,
  },
  brigand: {
    id: "brigand",
    name: "Besteiro",
    role: "Emboscada",
    hp: 25,
    atk: 7,
    mag: 0,
    def: 2,
    res: 3,
    mov: 3,
    minRange: 2,
    maxRange: 3,
    sprite: "brigand",
    size: 1,
    init: 4,
  },
  captain: {
    id: "captain",
    name: "Capitão",
    role: "Comando",
    hp: 60,
    atk: 11,
    mag: 0,
    def: 7,
    res: 4,
    mov: 4,
    minRange: 1,
    maxRange: 1,
    sprite: "captain",
    size: 1,
    init: 1,
  },
  wardog: {
    id: "wardog",
    name: "Cão de guerra",
    role: "Profano",
    hp: 40,
    atk: 9,
    mag: 0,
    def: 3,
    res: 1,
    mov: 5,
    minRange: 1,
    maxRange: 1,
    sprite: "wardog",
    size: 2,
    footprintOffsets: FOOTPRINT_TYPE_3,
    init: 6,
  },
  cultist: {
    id: "cultist",
    name: "Feiticeiro",
    role: "Rito",
    hp: 23,
    atk: 2,
    mag: 9,
    def: 2,
    res: 5,
    mov: 3,
    minRange: 1,
    maxRange: 2,
    sprite: "sorcerer",
    size: 1,
    init: 5,
  },
  horror: {
    id: "horror",
    name: "Asherah",
    role: "Pesadelo",
    hp: 120,
    atk: 13,
    mag: 0,
    def: 6,
    res: 4,
    mov: 2,
    minRange: 1,
    maxRange: 1,
    sprite: "horror",
    size: 4,
    footprintOffsets: FOOTPRINT_TYPE_8,
    init: 7,
  },
  troll: {
    id: "troll",
    name: "Troll da caverna",
    role: "Bruto",
    hp: 88,
    atk: 12,
    mag: 0,
    def: 9,
    res: 3,
    mov: 2,
    minRange: 1,
    maxRange: 1,
    sprite: "troll",
    size: 4,
    footprintOffsets: FOOTPRINT_TYPE_8,
    init: 8,
  },
  // Classes novas — nome, papel e arte ainda são provisórios (sprite reaproveita
  // um já existente até a arte definitiva chegar).
  assassin: {
    id: "assassin",
    name: "Assassino",
    role: "Emboscada",
    hp: 20,
    atk: 9,
    mag: 0,
    def: 2,
    res: 3,
    mov: 6,
    minRange: 1,
    maxRange: 1,
    sprite: "brigand",
    size: 1,
    init: 1,
  },
  rogue: {
    id: "rogue",
    name: "Ladino",
    role: "Infiltração",
    hp: 22,
    atk: 7,
    mag: 0,
    def: 2,
    res: 3,
    mov: 6,
    minRange: 1,
    maxRange: 2,
    sprite: "brigand",
    size: 1,
    init: 2,
  },
  lancer: {
    id: "lancer",
    name: "Lanceiro",
    role: "Pique",
    hp: 26,
    atk: 8,
    mag: 0,
    def: 4,
    res: 3,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "aldric",
    size: 1,
    init: 4,
  },
  conjurer: {
    id: "conjurer",
    name: "Conjurador",
    role: "Suporte arcano",
    // Follows the Mago Negro's own evolution path (same spell list — see classSpells — and
    // matching ATK/MAG/DEF/MOV growth) but frailer and harder to burn down with magic:
    // less HP, more RES, both at base and per level (see GROWTH.conjurer).
    hp: 18,
    atk: 3,
    mag: 10,
    def: 2,
    res: 9,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "malrec",
    size: 1,
    init: 6,
  },
  // Conjurer tier 1 (Summon Familiar): every combat stat here is a fallback only — the
  // actual summoned unit's stats are computed live from its summoner (see
  // castSummonFamiliar).
  familiar: {
    id: "familiar",
    name: "Familiar",
    role: "Invocação",
    hp: 10,
    atk: 3,
    mag: 3,
    def: 1,
    res: 1,
    mov: 5,
    minRange: 1,
    maxRange: 1,
    sprite: "familiar",
    size: 1,
    init: 5,
  },
  paladin: {
    id: "paladin",
    name: "Paladino",
    role: "Guardião",
    hp: 30,
    atk: 6,
    mag: 4,
    def: 7,
    res: 5,
    mov: 5,
    minRange: 1,
    maxRange: 1,
    sprite: "captain",
    size: 1,
    init: 9,
  },
  heavyKnight: {
    id: "heavyKnight",
    name: "Cavaleiro Pesado",
    role: "Muralha",
    hp: 32,
    atk: 7,
    mag: 0,
    def: 9,
    res: 3,
    mov: 4,
    minRange: 1,
    maxRange: 1,
    sprite: "troll",
    size: 1,
    init: 10,
  },
  // Classes promovidas (promoção no nível 15) — stats de combate, arte e nome definitivo
  // ainda são provisórios (copiados 1:1 da classe base, sprite reaproveitado). Só a
  // progressão de magia (tierUses / CLASS_TIER_TABLE mais abaixo) já é a de verdade.
  elementalist: {
    id: "elementalist",
    name: "Elementalista",
    role: "Promovido — Mago Negro",
    hp: 22,
    atk: 3,
    mag: 10,
    def: 2,
    res: 6,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "voss",
    size: 1,
    init: 5,
  },
  warlock: {
    id: "warlock",
    name: "Bruxo",
    role: "Promovido — Mago Negro",
    hp: 22,
    atk: 3,
    mag: 10,
    def: 2,
    res: 6,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "voss",
    size: 1,
    init: 5,
  },
  sorcerer: {
    id: "sorcerer",
    name: "Arcanista",
    role: "Promovido — Conjurador",
    hp: 18,
    atk: 3,
    mag: 10,
    def: 2,
    res: 9,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "sorcerer",
    size: 1,
    init: 6,
  },
  necromancer: {
    id: "necromancer",
    name: "Necromante",
    role: "Promovido — Conjurador",
    hp: 18,
    atk: 3,
    mag: 10,
    def: 2,
    res: 9,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "sorcerer",
    size: 1,
    init: 6,
  },
  cleric: {
    id: "cleric",
    name: "Clérigo",
    role: "Promovido — Curandeiro",
    hp: 26,
    atk: 4,
    mag: 8,
    def: 3,
    res: 6,
    mov: 5,
    minRange: 1,
    maxRange: 1,
    sprite: "salazar",
    size: 1,
    init: 8,
  },
  bishop: {
    id: "bishop",
    name: "Bispo",
    role: "Promovido — Curandeiro",
    hp: 26,
    atk: 4,
    mag: 8,
    def: 3,
    res: 6,
    mov: 5,
    minRange: 1,
    maxRange: 1,
    sprite: "salazar",
    size: 1,
    init: 8,
  },
  ranger: {
    id: "ranger",
    name: "Patrulheiro",
    role: "Promovido — Arqueira",
    hp: 24,
    atk: 8,
    mag: 0,
    def: 3,
    res: 4,
    mov: 6,
    minRange: 2,
    maxRange: 3,
    sprite: "nira",
    size: 1,
    init: 3,
  },
  sentinel: {
    id: "sentinel",
    name: "Sentinela",
    role: "Promovido — Lanceiro",
    hp: 26,
    atk: 8,
    mag: 0,
    def: 4,
    res: 3,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "pikeman",
    size: 1,
    init: 4,
  },
  templar: {
    id: "templar",
    name: "Templário",
    role: "Promovido — Lanceiro",
    hp: 26,
    atk: 8,
    mag: 0,
    def: 4,
    res: 3,
    mov: 5,
    minRange: 1,
    maxRange: 2,
    sprite: "pikeman",
    size: 1,
    init: 4,
  },
};

export const HERO_NAMES = ["Kael", "Neera", "Voss", "Salazar"] as const;

export const GROWTH: Record<ClassId, { hp: number; atk: number; mag: number; def: number; res: number }> = {
  swordsman: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
  archer: { hp: 3, atk: 2, mag: 0, def: 1, res: 1 },
  mage: { hp: 3, atk: 0, mag: 3, def: 1, res: 3 },
  healer: { hp: 3, atk: 0, mag: 1, def: 2, res: 2 },
  soldier: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
  pikeman: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
  brigand: { hp: 3, atk: 2, mag: 0, def: 1, res: 1 },
  captain: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
  wardog: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
  cultist: { hp: 3, atk: 0, mag: 2, def: 1, res: 2 },
  horror: { hp: 4, atk: 2, mag: 0, def: 2, res: 2 },
  troll: { hp: 5, atk: 2, mag: 0, def: 2, res: 1 },
  assassin: { hp: 3, atk: 3, mag: 0, def: 1, res: 1 },
  rogue: { hp: 3, atk: 2, mag: 0, def: 1, res: 1 },
  lancer: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
  // Same shape as mage's growth (atk/mag/def) but hp grows slower and res grows faster,
  // matching CLASSES.conjurer's base-stat deltas — see the note there.
  conjurer: { hp: 2, atk: 0, mag: 3, def: 1, res: 4 },
  // Never actually used to level up — a familiar's stats are recomputed from its summoner
  // every time one is cast, not from a level table. Present only because GROWTH is keyed by
  // every ClassId.
  familiar: { hp: 0, atk: 0, mag: 0, def: 0, res: 0 },
  paladin: { hp: 5, atk: 1, mag: 1, def: 3, res: 2 },
  heavyKnight: { hp: 5, atk: 1, mag: 0, def: 3, res: 1 },
  // Provisório — copiado da classe base (ver nota em CLASSES acima).
  elementalist: { hp: 3, atk: 0, mag: 3, def: 1, res: 3 },
  warlock: { hp: 3, atk: 0, mag: 3, def: 1, res: 3 },
  sorcerer: { hp: 2, atk: 0, mag: 3, def: 1, res: 4 },
  necromancer: { hp: 2, atk: 0, mag: 3, def: 1, res: 4 },
  cleric: { hp: 3, atk: 0, mag: 1, def: 2, res: 2 },
  bishop: { hp: 3, atk: 0, mag: 1, def: 2, res: 2 },
  ranger: { hp: 3, atk: 2, mag: 0, def: 1, res: 1 },
  sentinel: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
  templar: { hp: 4, atk: 2, mag: 0, def: 2, res: 1 },
};

export const MAX_LEVEL = 30;

/** XP needed to go up one level — flat at every level, Final Fantasy Tactics-style. */
export const EXP_TO_LEVEL = 100;

/** XP a hit, heal, or potion lands when attacker and target are the same level. */
export const BASE_EXP_PER_HIT = 20;

/** Level gap at which XP falls all the way to its floor (see expForHit) — beyond this,
 * still worth something, just never less. */
const EXP_FALLOFF_LEVELS = 10;

/**
 * XP granted for a single qualifying action (a damaging hit, a heal, a potion — anything
 * that calls gainExp). Fighting your own level or below always pays the full
 * BASE_EXP_PER_HIT; fighting below your weight class tapers that off linearly down to a
 * floor of 1 once the level gap reaches EXP_FALLOFF_LEVELS — e.g. a level 15 attacking a
 * level 5 (a 10-level gap) gains 1, a level 1 attacking a level 1 gains the full 20. Never
 * drops to 0: a hit always earns something, however outmatched the target.
 */
export function expForHit(attackerLevel: number, defenderLevel: number): number {
  const gap = Math.max(0, attackerLevel - defenderLevel);
  if (gap >= EXP_FALLOFF_LEVELS) return 1;
  const t = gap / EXP_FALLOFF_LEVELS;
  return Math.round(BASE_EXP_PER_HIT - (BASE_EXP_PER_HIT - 1) * t);
}

export function statsFor(classId: ClassId, level: number) {
  const cls = CLASSES[classId];
  const g = GROWTH[classId];
  const n = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  return {
    hp: cls.hp + g.hp * n,
    atk: cls.atk + g.atk * n,
    mag: cls.mag + g.mag * n,
    def: cls.def + g.def * n,
    res: cls.res + g.res * n,
    mov: cls.mov,
    minRange: cls.minRange,
    maxRange: cls.maxRange,
    level: Math.max(1, Math.min(MAX_LEVEL, level)),
  };
}

export function rangeLabel(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

export function powerLabel(atk: number, mag: number): string {
  return mag > 0 ? `MAG ${mag}` : `AT ${atk}`;
}

export function sheetLine(u: { atk: number; mag: number; def: number; res: number; mov: number; minRange: number; maxRange: number }): string {
  return `AT ${u.atk} · MAG ${u.mag} · DF ${u.def} · RES ${u.res} · Mov ${u.mov} · Alc ${rangeLabel(u.minRange, u.maxRange)}`;
}

export interface PotionDef {
  id: PotionId;
  name: string;
  dice: number;
  faces: number;
  bonus: number;
  effect: "heal" | "disease" | "mana";
  /** Mana potions only: restores this many uses of every spell tier the drinker's class/
   * level has any capacity in at all (not just depleted ones), each tier capped at its own
   * max — never used for heal/disease potions. */
  manaRestore?: number;
}

export const POTIONS: Record<PotionId, PotionDef> = {
  mid: { id: "mid", name: "Poção Média", dice: 2, faces: 8, bonus: 4, effect: "heal" },
  weak: { id: "weak", name: "Poção Fraca", dice: 1, faces: 8, bonus: 2, effect: "heal" },
  potent: { id: "potent", name: "Poção De Cura Potente", dice: 2, faces: 12, bonus: 6, effect: "heal" },
  disease: { id: "disease", name: "Poção De Curar Doenças", dice: 0, faces: 0, bonus: 0, effect: "disease" },
  manaSmall: { id: "manaSmall", name: "Poção De Mana Pequena", dice: 0, faces: 0, bonus: 0, effect: "mana", manaRestore: 1 },
  manaMid: { id: "manaMid", name: "Poção De Mana Média", dice: 0, faces: 0, bonus: 0, effect: "mana", manaRestore: 2 },
  manaLarge: { id: "manaLarge", name: "Poção De Mana Grande", dice: 0, faces: 0, bonus: 0, effect: "mana", manaRestore: 3 },
};

export const STARTING_BAG: Bag = { mid: 2, weak: 2, potent: 1, disease: 1, manaSmall: 1, manaMid: 0, manaLarge: 0, lockpick: 3 };
export const EMPTY_BAG: Bag = { mid: 0, weak: 0, potent: 0, disease: 0, manaSmall: 0, manaMid: 0, manaLarge: 0, lockpick: 0 };

/** Rarity weights for loot rolls: weaker/cheaper potions and gear come up far more often
 * than the strongest ones — "the strongest is harder to come out". */
// Mana potions are twice as hard to find as their equivalent-tier healing potion — half
// the loot weight of weak/mid/potent respectively.
export const POTION_LOOT_WEIGHT: Record<PotionId, number> = { weak: 50, mid: 30, potent: 12, disease: 8, manaSmall: 25, manaMid: 15, manaLarge: 6 };

function weightedPick<T>(rng: () => number, entries: [T, number][]): T {
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let roll = rng() * total;
  for (const [item, w] of entries) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return entries[entries.length - 1]![0];
}

export function weightedPotionPick(rng: () => number): PotionId {
  return weightedPick(rng, Object.entries(POTION_LOOT_WEIGHT) as [PotionId, number][]);
}

/** Loot-table weight for a priced item — inversely proportional to price (sqrt-tempered so
 * top-tier gear is meaningfully rarer without being nearly unobtainable from chest luck). */
function priceWeight(price: number): number {
  return 1 / Math.sqrt(Math.max(1, price));
}

export type LootDrop = { kind: "weapon"; id: string } | { kind: "equipment"; id: string };

/** Lowest/highest price across every lootable item (every weapon, every offHand
 * EquipmentDef) — the endpoints of the 1-MAX_LEVEL power-level scale below. Recomputed
 * from whatever WEAPONS/EQUIPMENT currently contain rather than hardcoded, so adding a new
 * weapon or piece of gear (with a price, same as every existing one) automatically finds
 * its place on the scale — nothing else to update by hand. */
function lootPriceRange(): { min: number; max: number } {
  const prices = [...Object.values(WEAPONS).map((w) => w.price), ...Object.values(EQUIPMENT).map((e) => e.price ?? 60)];
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Maps any lootable item's price onto the same 1-MAX_LEVEL scale player levels run —
 * log-scaled, since price itself climbs roughly exponentially from rung to rung (see
 * WEAPON_RUNGS). A level-1 dagger and a level-30 endgame greataxe read the same way loot
 * power reads everywhere else in the game. */
export function gearPowerLevel(price: number): number {
  const { min, max } = lootPriceRange();
  if (max <= min) return 1;
  const t = Math.log(Math.max(min, price) / min) / Math.log(max / min);
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(1 + t * (MAX_LEVEL - 1))));
}

/** How strong loot on a mission is allowed to roll, on that same 1-MAX_LEVEL scale —
 * matched to that mission's own enemies (enemyLevelFor), scaled up from its 1-4 range to
 * the full MAX_LEVEL so loot keeps pace with the whole campaign, not just its first
 * quarter. An early mission's enemies are weak, so its loot table only reaches low power
 * levels; missions near the end open up the full range. */
export function missionGearLevel(missionIndex: number): number {
  const enemyMax = 4; // enemyLevelFor's own ceiling
  return Math.max(1, Math.min(MAX_LEVEL, Math.round((enemyLevelFor(missionIndex) / enemyMax) * MAX_LEVEL)));
}

/** Weighted random pick across every weapon and every offHand EquipmentDef, rarer as price
 * climbs, capped to maxLevel on the gearPowerLevel scale (see missionGearLevel) and — for
 * weapons — excluding anything in ownedWeaponIds so a drop never announces a weapon the
 * recipient already has. Used for chest loot and enemy kill drops alike. */
export function weightedLootPick(rng: () => number, maxLevel = MAX_LEVEL, ownedWeaponIds: ReadonlySet<string> = new Set()): LootDrop {
  const build = (level: number): [LootDrop, number][] => [
    ...Object.values(WEAPONS)
      .filter((w) => gearPowerLevel(w.price) <= level && !ownedWeaponIds.has(w.id))
      .map((w): [LootDrop, number] => [{ kind: "weapon", id: w.id }, priceWeight(w.price)]),
    ...Object.values(EQUIPMENT)
      .filter((e) => gearPowerLevel(e.price ?? 60) <= level)
      .map((e): [LootDrop, number] => [{ kind: "equipment", id: e.id }, priceWeight(e.price ?? 60)]),
  ];
  // The mission-level cap can (rarely) leave nothing eligible once owned weapons are also
  // excluded — widen to the full range rather than crash on an empty pool.
  const entries = build(maxLevel);
  return weightedPick(rng, entries.length > 0 ? entries : build(MAX_LEVEL));
}

/** Weighted random pick across a given set of weapon ids, capped to maxLevel on the
 * gearPowerLevel scale — for drop sources that only ever granted a weapon before (e.g.
 * enemy kill drops), optionally restricted to a pool (e.g. "not already owned"). Defaults
 * to every weapon in the game. */
export function weightedWeaponPick(rng: () => number, ids: string[] = Object.keys(WEAPONS), maxLevel = MAX_LEVEL): string {
  const capped = ids.filter((id) => gearPowerLevel(WEAPONS[id]?.price ?? 100) <= maxLevel);
  const pool = capped.length > 0 ? capped : ids;
  const entries: [string, number][] = pool.map((id): [string, number] => [id, priceWeight(WEAPONS[id]?.price ?? 100)]);
  return weightedPick(rng, entries);
}
export const BAG_MAX = 9;

/** How many of each potion a single hero can carry at once — a "goes to whoever has room
 * next" chest-loot overflow (see BattleEngine.useLockpick) keeps a full-up party from
 * losing drops outright. */
export const POTION_CARRY_MAX: Record<PotionId, number> = {
  weak: 5,
  mid: 5,
  potent: 5,
  disease: 4,
  manaSmall: 2,
  manaMid: 2,
  manaLarge: 2,
};

export const POTION_PRICE: Record<PotionId, number> = {
  weak: 4,
  mid: 8,
  potent: 14,
  disease: 10,
  // Mana potions cost 25% more than their equivalent-tier healing potion.
  manaSmall: 5,
  manaMid: 10,
  manaLarge: 18,
};

/** Preço modesto da Gazua na Estalagem (Brue). */
export const LOCKPICK_PRICE = 6;

/** Chest-loot odds (BattleEngine.useLockpick): Ember gain is emberBase + 1..emberDice, and
 * gearChance is an independent roll for one extra weapon/equipment drop on top of the
 * guaranteed potion. The "better" numbers are for a chest listed in Mission.betterChests
 * (currently unused by any mission, kept for a future locked-loot-room) — same pool and
 * price range as a normal chest, just better odds. */
export const CHEST_LOOT = {
  emberBase: 3,
  emberDice: 6,
  gearChance: 0.4,
  betterEmberBase: 5,
  betterEmberDice: 8,
  betterGearChance: 0.55,
};

/** Chance a regular (non-boss) enemy drops a weapon on death — see BattleEngine.markDead.
 * Named unique bosses (Spawn.guaranteedDrop) skip this roll entirely. */
export const KILL_DROP_CHANCE = 0.01;

// ---------------------------------------------------------------- Weapons
// Damage dice ladder shared by every weapon pool, 1D4 (weakest) up to 2D12 (strongest).
// Each weapon picks one rung; price scales with it. Enhancement (+1..+5, at the Ferreiro)
// stacks flat on top and is tracked per hero save, not here.
// The "+" bonus is exclusive to the Ferreiro's enhancement system (see WEAPON_ENH_COST) —
// base weapon rungs are pure dice, no flat bonus baked in.
// Prices climb steeply on purpose: per-kill Ember drops are 2-10 (EMBER_DROP) and chest
// loot is 3-8, so a whole early mission nets maybe 20-40 Ember. The top rung has to cost
// more than a realistic full campaign's income, or the best weapon in the game is a
// mission-1 impulse buy instead of an endgame goal.
const WEAPON_RUNGS: { dice: number; faces: number; bonus: number; price: number }[] = [
  { dice: 1, faces: 4, bonus: 0, price: 40 },
  { dice: 1, faces: 6, bonus: 0, price: 90 },
  { dice: 1, faces: 8, bonus: 0, price: 180 },
  { dice: 1, faces: 10, bonus: 0, price: 320 },
  { dice: 1, faces: 12, bonus: 0, price: 520 },
  { dice: 2, faces: 6, bonus: 0, price: 800 },
  { dice: 2, faces: 8, bonus: 0, price: 1200 },
  { dice: 2, faces: 10, bonus: 0, price: 1800 },
  { dice: 2, faces: 12, bonus: 0, price: 2600 },
];

// Attack range is a property of the weapon itself, D&D-weapon-style — not of the class
// wielding it. MELEE = swords/axes/maces/daggers/staves, REACH = spears/polearms
// (can strike from 2 without exposing themselves at 1), RANGED = bows (can't strike
// adjacent, gets the elevated-terrain bonus in effectiveMaxRange).
type RangeSpec = { minRange: number; maxRange: number; ranged?: boolean };
const MELEE: RangeSpec = { minRange: 1, maxRange: 1 };
const REACH: RangeSpec = { minRange: 1, maxRange: 2 };
const RANGED: RangeSpec = { minRange: 2, maxRange: 3, ranged: true };

function wpn(id: string, name: string, usableBy: ClassId[], rung: number, range: RangeSpec = MELEE, bonusClass?: ClassId): WeaponDef {
  const r = WEAPON_RUNGS[rung - 1]!;
  return { id, name, usableBy, dice: r.dice, faces: r.faces, bonus: r.bonus, price: r.price, minRange: range.minRange, maxRange: range.maxRange, ranged: range.ranged, bonusClass };
}

const ARCANE_MAGE_TRIO: ClassId[] = ["mage", "elementalist", "warlock"];
const ARCANE_CONJURER_TRIO: ClassId[] = ["conjurer", "sorcerer", "necromancer"];
// Both arcane trios pool together: any arcane caster can wield any arcane staff, per design.
const ARCANE_ALL: ClassId[] = [...ARCANE_MAGE_TRIO, ...ARCANE_CONJURER_TRIO];
const HEAL_TRIO: ClassId[] = ["healer", "bishop", "cleric"];
const WARRIOR_TRIO: ClassId[] = ["swordsman", "paladin", "heavyKnight"];
const ARCHER_TRIO: ClassId[] = ["archer", "ranger", "assassin"];
const LANCER_TRIO: ClassId[] = ["lancer", "sentinel", "templar"];

export const WEAPONS: Record<string, WeaponDef> = {
  // Mago Negro / Elementalista / Bruxo — cajados arcanos, pool compartilhado (any of the
  // three can equip any of these), but each one is thematically tuned to exactly one of
  // them and hits 10% harder in that class's own hands (see combat.ts's
  // weaponClassBonusMul) — the name is the tell: primal/pure-arcane pieces go to the base
  // Mago, elemental ones to the Elementalista, pact/corruption ones to the Bruxo.
  "cajado-de-osso": wpn("cajado-de-osso", "Cajado de Osso", ARCANE_ALL, 1, REACH, "mage"),
  "cajado-abissal": wpn("cajado-abissal", "Cajado Abissal", ARCANE_ALL, 2, REACH, "warlock"),
  "cajado-de-ebano": wpn("cajado-de-ebano", "Cajado de Ébano", ARCANE_ALL, 3, REACH, "mage"),
  "cajado-igneo": wpn("cajado-igneo", "Cajado Ígneo", ARCANE_ALL, 4, REACH, "elementalist"),
  "bastao-do-pacto": wpn("bastao-do-pacto", "Bastão do Pacto", ARCANE_ALL, 5, REACH, "warlock"),
  "cajado-tempestuoso": wpn("cajado-tempestuoso", "Cajado Tempestuoso", ARCANE_ALL, 6, REACH, "elementalist"),
  "cetro-da-corrupcao": wpn("cetro-da-corrupcao", "Cetro da Corrupção", ARCANE_ALL, 7, REACH, "warlock"),
  "cajado-terrano": wpn("cajado-terrano", "Cajado Terrano", ARCANE_ALL, 8, REACH, "elementalist"),
  "bastao-do-vacuo": wpn("bastao-do-vacuo", "Bastão do Vácuo", ARCANE_ALL, 9, REACH, "mage"),

  // Conjurador / Arcanista / Necromante — cajados arcanos, pool compartilhado com a trinca
  // acima. É uma linha paralela para outras três classes, não uma continuação da mesma
  // escala — mesma faixa 1D4-2D12 do Mago, como toda outra trinca de classes no jogo. Same
  // per-class tuning as above: otherworldly/summoning pieces go to the Conjurador,
  // pure-arcane ones to the Arcanista, death/decay ones to the Necromante.
  "cajado-arcano": wpn("cajado-arcano", "Cajado Arcano", ARCANE_ALL, 1, REACH, "sorcerer"),
  "cajado-etereo": wpn("cajado-etereo", "Cajado Etéreo", ARCANE_ALL, 2, REACH, "conjurer"),
  "cajado-da-luz-sombria": wpn("cajado-da-luz-sombria", "Cajado da Luz Sombria", ARCANE_ALL, 3, REACH, "conjurer"),
  "cajado-da-chama-purpura": wpn("cajado-da-chama-purpura", "Cajado da Chama Púrpura", ARCANE_ALL, 4, REACH, "sorcerer"),
  "cajado-funebre": wpn("cajado-funebre", "Cajado Fúnebre", ARCANE_ALL, 5, REACH, "necromancer"),
  "bastao-do-caos": wpn("bastao-do-caos", "Bastão do Caos", ARCANE_ALL, 6, REACH, "conjurer"),
  "bastao-dos-restos": wpn("bastao-dos-restos", "Bastão dos Restos", ARCANE_ALL, 7, REACH, "necromancer"),
  "cajado-do-arcano-puro": wpn("cajado-do-arcano-puro", "Cajado do Arcano Puro", ARCANE_ALL, 8, REACH, "sorcerer"),
  "cajado-da-praga": wpn("cajado-da-praga", "Cajado da Praga", ARCANE_ALL, 9, REACH, "necromancer"),

  // Curandeiro / Bispo / Clérigo — cajados de cura, pool compartilhado.
  // Progressão contígua 1D4→2D12, sem pular tier — cada rung do 1 ao 9 tem um cajado.
  "cajado-da-renovacao": wpn("cajado-da-renovacao", "Cajado da Renovação", HEAL_TRIO, 1),
  "cajado-da-esperanca": wpn("cajado-da-esperanca", "Cajado da Esperança", HEAL_TRIO, 2),
  "cajado-da-graca": wpn("cajado-da-graca", "Cajado da Graça", HEAL_TRIO, 3),
  "cetro-da-luz": wpn("cetro-da-luz", "Cetro da Luz", HEAL_TRIO, 4),
  "bastao-da-purificacao": wpn("bastao-da-purificacao", "Bastão da Purificação", HEAL_TRIO, 5),
  "cajado-do-bispo": wpn("cajado-do-bispo", "Cajado do Bispo", HEAL_TRIO, 6),
  "cajado-da-comunhao": wpn("cajado-da-comunhao", "Cajado da Comunhão", HEAL_TRIO, 7),
  "cajado-da-fe": wpn("cajado-da-fe", "Cajado da Fé", HEAL_TRIO, 8),
  "cajado-da-justica": wpn("cajado-da-justica", "Cajado da Justiça", HEAL_TRIO, 9),

  // Guerreiro / Paladino / Cavaleiro Pesado — espada/machado/maça, pool compartilhado.
  // Martelos também servem para o Clérigo ("não derrama sangue"). Tudo corpo a corpo.
  "espada-larga": wpn("espada-larga", "Espada Larga", WARRIOR_TRIO, 1),
  "espadao": wpn("espadao", "Espadão", WARRIOR_TRIO, 2),
  "machado-de-guerra": wpn("machado-de-guerra", "Machado de Guerra", WARRIOR_TRIO, 3),
  "espada-da-lealdade": wpn("espada-da-lealdade", "Espada da Lealdade", WARRIOR_TRIO, 4),
  "espadao-pesado": wpn("espadao-pesado", "Espadão Pesado", WARRIOR_TRIO, 5),
  "lamina-sagrada": wpn("lamina-sagrada", "Lâmina Sagrada", WARRIOR_TRIO, 6),
  "martelo-de-guerra": wpn("martelo-de-guerra", "Martelo de Guerra", [...WARRIOR_TRIO, "cleric"], 7),
  "martelo-da-justica": wpn("martelo-da-justica", "Martelo da Justiça", [...WARRIOR_TRIO, "cleric"], 8),
  "machado-barbaro": wpn("machado-barbaro", "Machado Bárbaro", WARRIOR_TRIO, 9),

  // Arqueira / Patrulheiro / Assassina — arco/besta/adaga, pool compartilhado.
  // Único desvio deliberado do D&D real (onde adaga < arco): aqui toda arma corpo a corpo
  // (adaga, katar) supera toda arma à distância (arco, besta), risco de chegar perto paga
  // mais. Arcos e besta ocupam os rungs 1-5, corpo a corpo/alcance ocupam os rungs 6-9.
  "arco-composto": wpn("arco-composto", "Arco Composto", ARCHER_TRIO, 1, RANGED),
  "arco-longo": wpn("arco-longo", "Arco Longo", ARCHER_TRIO, 2, RANGED),
  "arco-elfico": wpn("arco-elfico", "Arco Élfico", ARCHER_TRIO, 3, RANGED),
  "arco-do-cacador": wpn("arco-do-cacador", "Arco do Caçador", ARCHER_TRIO, 4, RANGED),
  "besta-leve": wpn("besta-leve", "Besta Leve", ARCHER_TRIO, 5, { minRange: 1, maxRange: 3, ranged: true }),
  "punhal-curvo": wpn("punhal-curvo", "Punhal Curvo", ARCHER_TRIO, 6),
  "katar": wpn("katar", "Katar", ARCHER_TRIO, 7),
  "adaga-sombria": wpn("adaga-sombria", "Adaga Sombria", ARCHER_TRIO, 8),
  "adaga-de-veneno": wpn("adaga-de-veneno", "Adaga de Veneno", ARCHER_TRIO, 9),

  // Lanceiro / Sentinela / Templário — lança e lança-e-escudo, exclusivo dessa linha.
  // Lanças alcançam 2 hexes; a versão com escudo troca alcance por defesa mais de perto.
  "lanca": wpn("lanca", "Lança", LANCER_TRIO, 1, REACH),
  "partisan": wpn("partisan", "Partisan", LANCER_TRIO, 2, REACH),
  "guisarme": wpn("guisarme", "Guisarme", LANCER_TRIO, 3, REACH),
  "lanca-de-defesa": wpn("lanca-de-defesa", "Lança de Defesa", LANCER_TRIO, 4, REACH),
  "espada-e-escudo": wpn("espada-e-escudo", "Espada e Escudo", LANCER_TRIO, 5),
  "maca-e-escudo-sentinel": wpn("maca-e-escudo-sentinel", "Maça e Escudo", LANCER_TRIO, 6),
  "maca-e-escudo-templar": wpn("maca-e-escudo-templar", "Maça e Escudo", LANCER_TRIO, 7),
  "lanca-e-escudo-sentinel": wpn("lanca-e-escudo-sentinel", "Lança e Escudo", LANCER_TRIO, 8, REACH),
  "lanca-e-escudo-templar": wpn("lanca-e-escudo-templar", "Lança e Escudo", LANCER_TRIO, 9, REACH),
};

export function weaponIcon(id: string): string {
  return `/game/icons/weapons/${id}.png`;
}

export function weaponsForClass(classId: ClassId): WeaponDef[] {
  return Object.values(WEAPONS).filter((w) => w.usableBy.includes(classId));
}

export function weaponPower(w: WeaponDef): number {
  return (w.dice * (w.faces + 1)) / 2 + w.bonus;
}

/** Cheapest/weakest weapon a class can use — auto-equipped for free until the player picks another. */
export function starterWeaponFor(classId: ClassId): string | null {
  const list = weaponsForClass(classId);
  if (list.length === 0) return null;
  return list.reduce((a, b) => (weaponPower(a) <= weaponPower(b) ? a : b)).id;
}

export function weaponRoll(weaponId: string | null | undefined, enh: number, rng: () => number): number {
  if (!weaponId) return 0;
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  return rollDice(w.dice, w.faces, w.bonus, rng) + enh;
}

export function weaponPreview(weaponId: string | null | undefined, enh: number): number {
  if (!weaponId) return 0;
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  return Math.round(weaponPower(w) + enh);
}

export function weaponDiceLabel(weaponId: string): string {
  const w = WEAPONS[weaponId];
  return w ? diceFormula(w.dice, w.faces, w.bonus) : "";
}

export function weaponRangeLabel(weaponId: string): string {
  const w = WEAPONS[weaponId];
  return w ? `Alc ${rangeLabel(w.minRange, w.maxRange)}` : "";
}

/** Ember cost of the Ferreiro's enhancement ranks +1..+5 (index 0 = cost of the first rank). */
export const WEAPON_ENH_COST = [25, 50, 80, 150, 300];
export const WEAPON_MAX_ENH = WEAPON_ENH_COST.length;

/** Sell price: half of the weapon's base price plus half of every enhancement Ember sunk into it. */
export function weaponSellValue(weaponId: string, enh: number): number {
  const w = WEAPONS[weaponId];
  if (!w) return 0;
  const enhSpent = WEAPON_ENH_COST.slice(0, enh).reduce((a, b) => a + b, 0);
  return Math.floor((w.price + enhSpent) / 2);
}

export function weaponEnhCost(nextRank: number): number {
  return WEAPON_ENH_COST[nextRank - 1] ?? Infinity;
}

// ------------------------------------------------------------- Equipment (paper doll)
// Skeleton for every slot except offHand: the data shape exists and is wired into a
// screen, but no EquipmentDef exists yet. "mainHand" isn't a slot here — it's the weapon
// system above. offHand is real: a shield (Shield Bash) or a light off-hand weapon, never
// both at once, and never alongside a two-handed main-hand weapon (see offHandBlocked).
export const EQUIPMENT_SLOTS: { id: EquipSlot; label: string }[] = [
  { id: "head", label: "Cabeça" },
  { id: "neck", label: "Pescoço" },
  { id: "shoulders", label: "Ombros" },
  { id: "back", label: "Costas" },
  { id: "chest", label: "Peito" },
  { id: "hands", label: "Mãos" },
  { id: "waist", label: "Cintura" },
  { id: "legs", label: "Pernas" },
  { id: "feet", label: "Pés" },
  { id: "ring1", label: "Anel" },
  { id: "ring2", label: "Anel" },
  { id: "offHand", label: "Mão Secundária" },
];

export const EQUIPMENT: Record<string, EquipmentDef> = {
  // ---- offHand: shields (Shield Bash), the dmgMul ladder climbs from a real penalty to
  // none at all on the strongest ("it will scale all the way to no penalty").
  broquel: { id: "broquel", name: "Broquel", slot: "offHand", kind: "shield", usableBy: ["swordsman", "heavyKnight", "paladin"], def: 1, dmgMul: 0.5, price: 60 },
  "shield-buckler": { id: "shield-buckler", name: "Broquel de Aço", slot: "offHand", kind: "shield", usableBy: ["swordsman", "heavyKnight", "paladin"], def: 1, dmgMul: 0.6, price: 90 },
  "shield-round": { id: "shield-round", name: "Escudo Redondo", slot: "offHand", kind: "shield", usableBy: ["swordsman", "heavyKnight", "paladin"], def: 2, dmgMul: 0.7, price: 150 },
  "shield-heater": { id: "shield-heater", name: "Escudo em Coração", slot: "offHand", kind: "shield", usableBy: ["swordsman", "heavyKnight", "paladin"], def: 2, dmgMul: 0.8, price: 220 },
  "shield-kite": { id: "shield-kite", name: "Escudo em Pipa", slot: "offHand", kind: "shield", usableBy: ["swordsman", "heavyKnight", "paladin"], def: 3, dmgMul: 0.9, price: 320 },
  "shield-tower": { id: "shield-tower", name: "Escudo Torre", slot: "offHand", kind: "shield", usableBy: ["swordsman", "heavyKnight", "paladin"], def: 4, dmgMul: 1, price: 450 },
  "cross-kite-shield": { id: "cross-kite-shield", name: "Escudo em Cunha com Cruz", slot: "offHand", kind: "shield", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, dmgMul: 0.85, price: 380 },
  "ancient-round-shield": { id: "ancient-round-shield", name: "Escudo Redondo Ancestral", slot: "offHand", kind: "shield", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, dmgMul: 0.7, price: 260 },
  // ---- offHand: light weapon (off-hand attack, no Shield Bash)
  "adaga-secundaria": { id: "adaga-secundaria", name: "Adaga Secundária", slot: "offHand", kind: "weapon", usableBy: ARCHER_TRIO, dice: 1, faces: 4, bonus: 0, minRange: 1, maxRange: 1, price: 70 },

  // ---- head: cloth for casters/scouts, steel for the frontline — mirrors the weapon
  // trios (ARCANE_ALL, ARCHER_TRIO, WARRIOR_TRIO+LANCER_TRIO), not one-off class lists.
  hood: { id: "hood", name: "Capuz", slot: "head", usableBy: [...ARCANE_ALL, ...ARCHER_TRIO], res: 1, price: 40 },
  cowl: { id: "cowl", name: "Cogula Reforçada", slot: "head", usableBy: [...ARCANE_ALL, ...ARCHER_TRIO], def: 1, res: 1, price: 55 },
  barbute: { id: "barbute", name: "Barbuta", slot: "head", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, price: 90 },
  sallet: { id: "sallet", name: "Elmo Salade", slot: "head", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, price: 140 },
  "heavy-war-helmet": { id: "heavy-war-helmet", name: "Elmo de Guerra Pesado", slot: "head", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 4, price: 200 },
  "great-helm": { id: "great-helm", name: "Elmo de Grande Porte", slot: "head", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 5, price: 260 },
  "full-helm": { id: "full-helm", name: "Elmo Completo Gótico", slot: "head", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 4, price: 210 },
  "worn-woolen-hood": { id: "worn-woolen-hood", name: "Capuz de Lã Gasto", slot: "head", usableBy: [...ARCANE_ALL, ...ARCHER_TRIO], res: 1, price: 35 },

  // ---- chest: cloth for casters, leather for scouts/rogues, chain for clerics, plate for
  // the frontline — same material camps as every other slot, now with somewhere to wear it.
  "leather-steel-cuirass": { id: "leather-steel-cuirass", name: "Couraça de Couro e Aço", slot: "chest", usableBy: [...ARCHER_TRIO, "rogue"], def: 2, mov: 1, price: 140 },
  "chainmail-hauberk": { id: "chainmail-hauberk", name: "Cota de Malha", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO, ...HEAL_TRIO], def: 2, price: 150 },
  "heavy-brigandine": { id: "heavy-brigandine", name: "Brigantina Pesada", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, price: 200 },
  "scale-armor": { id: "scale-armor", name: "Armadura Escamada Medieval", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, res: 1, price: 220 },
  "plate-cuirass": { id: "plate-cuirass", name: "Couraça de Placas", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 4, price: 260 },
  "gothic-plate-cuirass": { id: "gothic-plate-cuirass", name: "Couraça Gótica", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 4, res: 1, price: 280 },
  "knights-cuirass": { id: "knights-cuirass", name: "Couraça de Cavaleiro", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 4, price: 270 },
  "dark-scale-cuirass": { id: "dark-scale-cuirass", name: "Couraça Escamada Sombria", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 4, res: 1, price: 300 },
  "brutal-knight-cuirass": { id: "brutal-knight-cuirass", name: "Couraça Brutal de Cavaleiro Pesado", slot: "chest", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 5, price: 340 },

  // ---- shoulders (pauldrons/mantles — leather for the archer line, steel for the frontline)
  "leather-shoulder-guards": { id: "leather-shoulder-guards", name: "Protetores de Ombro de Couro", slot: "shoulders", usableBy: [...ARCHER_TRIO, "rogue"], def: 1, mov: 1, price: 90 },
  "chainmail-mantle": { id: "chainmail-mantle", name: "Manto de Malha", slot: "shoulders", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO, ...HEAL_TRIO], def: 1, res: 1, price: 120 },
  "armored-shoulder-mantle": { id: "armored-shoulder-mantle", name: "Manto de Ombro Blindado", slot: "shoulders", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, price: 150 },
  "massive-pauldrons": { id: "massive-pauldrons", name: "Ombreiras Maciças", slot: "shoulders", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, price: 150 },
  "spiked-shoulder-armor": { id: "spiked-shoulder-armor", name: "Ombreira Pesada Assimétrica", slot: "shoulders", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 1, atk: 1, price: 160 },
  "gothic-shoulder-plates": { id: "gothic-shoulder-plates", name: "Placas de Ombro Góticas", slot: "shoulders", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, price: 210 },
  "gothic-pauldrons-exceptional": { id: "gothic-pauldrons-exceptional", name: "Ombreiras Góticas Excepcionais", slot: "shoulders", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, price: 230 },

  // ---- legs: leather for the archer line, steel/mail for the frontline — same two
  // material camps as head gear, no caster-tier leg armor exists yet.
  "studded-leather-pants": { id: "studded-leather-pants", name: "Calças de Couro Cravejado", slot: "legs", usableBy: ARCHER_TRIO, def: 1, mov: 1, price: 60 },
  "chainmail-leggings": { id: "chainmail-leggings", name: "Grevas de Malha", slot: "legs", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, price: 110 },
  "plate-greaves": { id: "plate-greaves", name: "Grevas de Placas", slot: "legs", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, price: 170 },
  "plate-legs": { id: "plate-legs", name: "Perneiras de Placas Completas", slot: "legs", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 4, mov: -1, price: 230 },

  // ---- feet: same material split
  "worn-leather-boots": { id: "worn-leather-boots", name: "Botas de Couro Gastas", slot: "feet", usableBy: ARCHER_TRIO, mov: 1, price: 35 },
  "worn-mud-boots": { id: "worn-mud-boots", name: "Botas Enlameadas", slot: "feet", usableBy: ARCHER_TRIO, def: 1, price: 45 },
  "buckled-leather-boots": { id: "buckled-leather-boots", name: "Botas de Fivela", slot: "feet", usableBy: ARCHER_TRIO, def: 1, mov: 1, price: 70 },
  "steel-sabatons": { id: "steel-sabatons", name: "Solerets de Aço", slot: "feet", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, price: 110 },

  // ---- hands: all gauntlets, all warrior-type gear (no archer-line hand armor yet) — and,
  // except for the chainmail pair, clerics can wear these too.
  "studded-gauntlets": { id: "studded-gauntlets", name: "Manoplas Cravejadas", slot: "hands", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO, ...HEAL_TRIO], atk: 1, price: 90 },
  "chainmail-gloves": { id: "chainmail-gloves", name: "Luvas de Malha", slot: "hands", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 1, mag: 1, price: 65 },
  "plate-gauntlets": { id: "plate-gauntlets", name: "Manoplas de Placas", slot: "hands", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO, ...HEAL_TRIO], atk: 1, def: 2, price: 150 },
  "spiked-gauntlet": { id: "spiked-gauntlet", name: "Manopla Cravada Brutal", slot: "hands", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO, ...HEAL_TRIO], atk: 3, def: 1, price: 220 },
  "dark-steel-gauntlets": { id: "dark-steel-gauntlets", name: "Manoplas de Aço Sombrio", slot: "hands", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO, ...HEAL_TRIO], atk: 1, def: 1, price: 170 },
  "engraved-vambrace": { id: "engraved-vambrace", name: "Braçadeira de Aço Gravada", slot: "hands", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, price: 140 },

  // ---- feet
  "heavy-armored-boots": { id: "heavy-armored-boots", name: "Botas Blindadas Pesadas", slot: "feet", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 3, mov: -1, price: 160 },

  // ---- back (cloaks — cloth for casters/scouts, armored mantles for the frontline)
  "ornamental-cloak-clasp": { id: "ornamental-cloak-clasp", name: "Fivela de Capa Ornamentada", slot: "back", mov: 1, res: 1, price: 90 },
  "travelers-cloak": { id: "travelers-cloak", name: "Capa de Viajante", slot: "back", usableBy: [...ARCANE_ALL, ...ARCHER_TRIO], res: 1, price: 60 },
  "leather-cape": { id: "leather-cape", name: "Capa Curta de Couro", slot: "back", usableBy: [...ARCHER_TRIO, "rogue"], res: 1, price: 70 },
  "wine-cloak": { id: "wine-cloak", name: "Capa Tingida de Vinho", slot: "back", usableBy: [...ARCANE_ALL, ...ARCHER_TRIO], res: 1, mov: 1, price: 80 },
  "tattered-war-cloak": { id: "tattered-war-cloak", name: "Capa de Guerra Esfarrapada", slot: "back", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 1, res: 1, price: 110 },
  "noble-war-cloak": { id: "noble-war-cloak", name: "Capa Nobre de Guerra Esfarrapada", slot: "back", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 1, atk: 1, price: 180 },
  "fur-trimmed-cloak": { id: "fur-trimmed-cloak", name: "Capa de Inverno com Pele", slot: "back", res: 2, price: 130 },
  "ornate-noble-cloak": { id: "ornate-noble-cloak", name: "Capa Nobre Ornamentada", slot: "back", usableBy: ARCANE_ALL, mag: 2, price: 200 },

  // ---- waist
  "plain-leather-belt": { id: "plain-leather-belt", name: "Cinto de Couro Simples", slot: "waist", hp: 2, price: 30 },
  "heavy-iron-buckle": { id: "heavy-iron-buckle", name: "Fivela de Ferro Pesada", slot: "waist", def: 1, price: 45 },
  "small-leather-pouch": { id: "small-leather-pouch", name: "Bolsa de Couro Pequena", slot: "waist", hp: 3, price: 50 },
  "double-buckle-belt": { id: "double-buckle-belt", name: "Cinto de Fivela Dupla", slot: "waist", def: 1, hp: 2, price: 70 },
  "ornate-dagger-belt": { id: "ornate-dagger-belt", name: "Cinturão Ornamentado com Bainha", slot: "waist", atk: 1, price: 90 },
  "utility-pouch-belt": { id: "utility-pouch-belt", name: "Cinturão de Utilidades", slot: "waist", atk: 1, hp: 2, price: 120 },

  // ---- neck (holy/arcane trinkets)
  amulet: { id: "amulet", name: "Amuleto de Cordão de Couro", slot: "neck", mag: 1, price: 70 },
  "weathered-medallion": { id: "weathered-medallion", name: "Medalhão Desgastado", slot: "neck", res: 2, price: 80 },
  "heavy-metal-pendant": { id: "heavy-metal-pendant", name: "Pingente de Metal Pesado", slot: "neck", def: 1, res: 1, price: 100 },
  "silver-necklace": { id: "silver-necklace", name: "Colar de Prata Simples", slot: "neck", res: 1, price: 55 },
  "runic-amulet": { id: "runic-amulet", name: "Amuleto Rúnico", slot: "neck", mag: 1, price: 65 },
  "leather-gorget": { id: "leather-gorget", name: "Goguete de Couro Pesado", slot: "neck", usableBy: [...ARCHER_TRIO, ...WARRIOR_TRIO, "rogue"], def: 1, price: 70 },
  "iron-talisman": { id: "iron-talisman", name: "Talismã de Ferro Pesado", slot: "neck", def: 1, price: 95 },
  "steel-gorget": { id: "steel-gorget", name: "Goguete de Aço Medieval", slot: "neck", usableBy: [...WARRIOR_TRIO, ...LANCER_TRIO], def: 2, price: 110 },
  "ornate-pendant": { id: "ornate-pendant", name: "Pingente Medieval Ornamentado", slot: "neck", res: 1, mag: 1, price: 130 },
  "ancient-pendant": { id: "ancient-pendant", name: "Pingente Ancestral", slot: "neck", mag: 2, price: 240 },

  // ---- rings (magic items, ring1/ring2 share this pool — see offHandBlocked usage note)
  "plain-iron-ring": { id: "plain-iron-ring", name: "Anel de Ferro Simples", slot: "ring1", hp: 3, price: 40 },
  "silver-signet-ring": { id: "silver-signet-ring", name: "Anel de Sinete de Prata", slot: "ring1", atk: 1, price: 90 },
  "heavy-steel-ring": { id: "heavy-steel-ring", name: "Anel de Aço Pesado", slot: "ring1", def: 1, res: 1, price: 150 },
  "blackened-iron-ring": { id: "blackened-iron-ring", name: "Anel de Ferro Enegrecido", slot: "ring1", mag: 2, price: 220 },
  "ancient-gold-ring": { id: "ancient-gold-ring", name: "Anel de Ouro Ancestral", slot: "ring1", atk: 1, mag: 1, def: 1, price: 320 },
  "black-metal-ring": { id: "black-metal-ring", name: "Anel de Metal Negro Ornamentado", slot: "ring1", atk: 1, def: 1, price: 280 },
};

/** Whether a class's main-hand weapon choice blocks the offHand slot — true when it's a
 * two-handed weapon (lances and the like: both hands are already full). */
export function offHandBlocked(mainHandWeaponId: string | null): boolean {
  const w = mainHandWeaponId ? WEAPONS[mainHandWeaponId] : null;
  return !!w?.twoHanded;
}

/** Short "+N STAT" summary line for a passive-stat EquipmentDef, classic-RPG-tooltip style. */
export function equipmentStatSummary(it: EquipmentDef): string {
  const parts: string[] = [];
  if (it.hp) parts.push(`${it.hp > 0 ? "+" : ""}${it.hp} HP`);
  if (it.atk) parts.push(`${it.atk > 0 ? "+" : ""}${it.atk} AT`);
  if (it.mag) parts.push(`${it.mag > 0 ? "+" : ""}${it.mag} MAG`);
  if (it.def) parts.push(`${it.def > 0 ? "+" : ""}${it.def} DF`);
  if (it.res) parts.push(`${it.res > 0 ? "+" : ""}${it.res} RES`);
  if (it.mov) parts.push(`${it.mov > 0 ? "+" : ""}${it.mov} Mov`);
  return parts.join(" · ");
}

export function equipmentIcon(id: string): string {
  return `/game/icons/equipment/${id}.png`;
}

export function equipmentForClass(classId: ClassId, slot: EquipSlot): EquipmentDef[] {
  return Object.values(EQUIPMENT).filter((e) => e.slot === slot && (!e.usableBy || e.usableBy.includes(classId)));
}

export const EMBER_DROP: Partial<Record<ClassId, number>> = {
  soldier: 2,
  brigand: 2,
  pikeman: 3,
  wardog: 2,
  cultist: 4,
  captain: 6,
  horror: 10,
  troll: 8,
};

export function emberForKill(classId: ClassId): number {
  return EMBER_DROP[classId] ?? 2;
}

export function emberFromCompleted(completed: string[]): number {
  let n = 0;
  for (const id of completed) {
    const m = missionById(id);
    if (!m || m.hub) continue;
    for (const e of m.enemySpawns) n += emberForKill(e.classId);
  }
  return n;
}

export const CURES: Record<HealId, { name: string; dice: number; faces: number; bonus: number; range: number }> = {
  cureMinor: { name: "Cura Menor", dice: 1, faces: 8, bonus: 3, range: 1 },
  cureWounds: { name: "Cura Média", dice: 3, faces: 8, bonus: 3, range: 2 },
};

export function rollDice(dice: number, faces: number, bonus: number, rng: () => number): number {
  let total = bonus;
  for (let i = 0; i < dice; i++) total += 1 + Math.floor(rng() * faces);
  return total;
}

export function rollCure(kind: HealId, rng: () => number): number {
  const p = CURES[kind];
  return rollDice(p.dice, p.faces, p.bonus, rng);
}

export function diceFormula(dice: number, faces: number, bonus: number): string {
  if (dice <= 0) return "";
  const core = `${dice}D${faces}`;
  return bonus ? `${core}+${bonus}` : core;
}

export function cureLabel(kind: HealId): string {
  const p = CURES[kind];
  return `${p.name} ${diceFormula(p.dice, p.faces, p.bonus)}`;
}

export function rollPotion(kind: PotionId, rng: () => number): number {
  const p = POTIONS[kind];
  return rollDice(p.dice, p.faces, p.bonus, rng);
}

export function potionLabel(kind: PotionId): string {
  const p = POTIONS[kind];
  const formula = diceFormula(p.dice, p.faces, p.bonus);
  return formula ? `${p.name} ${formula}` : p.name;
}

export function diceSpan(dice: number, faces: number, bonus: number): string {
  return `${dice + bonus}–${dice * faces + bonus}`;
}

export function cureSpan(kind: HealId): string {
  const p = CURES[kind];
  return diceFormula(p.dice, p.faces, p.bonus);
}

export function potionSpan(kind: PotionId): string {
  const p = POTIONS[kind];
  return diceFormula(p.dice, p.faces, p.bonus);
}

export const FIREBALL = {
  name: "Bola De Fogo",
  size: 2,
  range: 4,
  dice: 2,
  faces: 8,
  bonus: 4,
};

export const CAUSTIC_VENOM = {
  name: "Veneno Cáustico",
  // Same radius-2 splash shape as Fireball (reuses fireballOrigin/fireballTiles) — the
  // clicked point takes the bigger centerDice roll, every other unit caught in the splash
  // (either side — it spares no one) takes the smaller splashDice roll, and every landed
  // hit poisons its target: 1D4 at the start of each of their own turns until cured by
  // Cure Disease or the disease potion (see startOfTurnEffects/curePlayerDisease).
  size: 2,
  range: 4,
  centerDice: 4,
  centerFaces: 8,
  centerBonus: 0,
  splashDice: 2,
  splashFaces: 8,
  splashBonus: 0,
};

export const LONG_SHOT = {
  name: "Tiro Longo",
  rangeMul: 2,
  rangeBonus: 1,
  bonusDice: 1,
  bonusFaces: 8,
  bonus: 1,
};

export const PIERCING = {
  name: "Tiro Perfurante",
  dmgMul: 2,
};

/** Lancer tier 1: a short-reach line thrust (weapon range + 1 hex) that ignores a slice of
 * the target's armor and hits everyone caught in the line — 1st target full damage, every
 * one behind it half. */
export const PIERCING_THRUST = {
  name: "Investida Perfurante",
  armorIgnore: 0.2,
};

/** Lancer tier 2: an instant, unaimed swing that hits every enemy on an adjacent hex for
 * plain weapon damage and shoves each one back a hex to reopen reach. */
export const SWEEP = {
  name: "Varredura",
  knockback: 1,
};

/** Lancer tier 3: a single-target hook-the-legs strike — weapon damage + 1D8, stuns for 2 of
 * the target's own turns, and knocks 10% off every stat for the rest of the battle (not
 * cured by anything, unlike Doente). */
export const TRIP = {
  name: "Rasteira",
  bonusFaces: 8,
  bonusBonus: 0,
  stunRounds: 2,
  statPenalty: 0.1,
};

export const DOUBLE_STRIKE = {
  name: "Corte Duplo",
};

export const CLEAVE = {
  name: "Cleave",
  hexes: 3,
  bonusDice: 1,
  bonusFaces: 8,
  bonusBonus: 2,
};

export const MAGIC_MISSILE = {
  name: "Míssil Mágico",
  range: 4,
  // Three darts, each 1d4+1, that never miss — modeled as one roll of 3 dice-of-4 plus a
  // flat +3 (one dart's flat bonus × 3), which is exactly equivalent to summing three
  // separate 1d4+1 rolls.
  dice: 3,
  faces: 4,
  bonus: 3,
};

/** Conjurer tier 1: summons a controllable ally at half the conjurer's current stats
 * (recomputed from the conjurer at cast time, so a later-battle or higher-level cast comes
 * in stronger) anywhere within range, passable and unoccupied. Stays until the battle ends —
 * no duration to track, no re-cast limit beyond the tier's own uses per scenario. */
export const SUMMON_FAMILIAR = {
  name: "Invocar Familiar",
  range: 6,
  statScale: 0.5,
};

/** Conjurer tier 2: drops a sticky patch of webbing centered on the target cell. Every unit
 * (either side) standing in it at cast time rolls sleepChance to fall asleep for 1D4 of its
 * own turns (early wake + sleepBonusDamage on the hit that wakes it). While the zone lasts,
 * anyone whose current cell is inside it — caught at cast time or wandered in after — has
 * their movement clamped to 1 hex for the turn (see BattleEngine.effectiveUnitForReach): the
 * "difficult terrain / restrained" part of the spell, folded into one mechanic. */
export const WEB_OF_DREAMS = {
  name: "Teia dos Sonhos",
  range: 5,
  size: 1,
  durationRounds: 3,
  sleepChance: 0.25,
  sleepDice: 1,
  sleepFaces: 4,
  sleepBonusDamage: 0.25,
};

export const LIGHTNING = {
  name: "Relâmpago",
  range: 4,
  dice: 4,
  faces: 12,
  bonus: 6,
  echoDice: 1,
  echoFaces: 12,
  echoBonus: 2,
};

export const DISEASE = {
  biteChance: 0.2,
  statPenalty: 0.1,
};

export const CURE_DISEASE = {
  name: "Curar Doença Leve",
  range: 1,
};

export function lightningDice(level: number): number {
  return LIGHTNING.dice + (level >= 8 ? 2 : 0);
}

export function lightningFormula(level: number): string {
  return diceFormula(lightningDice(level), LIGHTNING.faces, LIGHTNING.bonus);
}

export function fireballPower(level: number): { dice: number; faces: number; bonus: number } {
  if (level >= 9) return { dice: 6, faces: 6, bonus: 10 };
  if (level >= 5) return { dice: 4, faces: 6, bonus: 6 };
  return { dice: FIREBALL.dice, faces: FIREBALL.faces, bonus: FIREBALL.bonus };
}

export function fireballFormula(level: number): string {
  const p = fireballPower(level);
  return diceFormula(p.dice, p.faces, p.bonus);
}

/** Spell-slot tiers (D&D-style): how fast each class unlocks and refills tier N depends on its casting speed. */
export type SpellTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type TierSpeed = "full" | "half" | "slow";

const TIER_SPEED: Partial<Record<ClassId, TierSpeed>> = {
  rogue: "slow",
};

/** Levels needed to go from one tier's unlock to the next, for that casting speed. */
const TIER_SPEED_STEP: Record<TierSpeed, number> = { full: 3, half: 4, slow: 5 };

/**
 * Explicit level×tier slot tables. These don't follow the TIER_SPEED_STEP formula
 * above — they're the exact numbers validated by hand: "quarto" (6 tiers), "meio"
 * (8 tiers) and "pleno"/maxed (10 tiers), every tier reaching 5 slots by level 30,
 * total never dropping between levels.
 */
const QUARTER_TABLE: number[][] = [
  [1, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0],
  [2, 1, 0, 0, 0, 0, 0, 0],
  [2, 1, 0, 0, 0, 0, 0, 0],
  [2, 1, 0, 0, 0, 0, 0, 0],
  [3, 2, 0, 0, 0, 0, 0, 0],
  [3, 2, 1, 0, 0, 0, 0, 0],
  [3, 2, 1, 0, 0, 0, 0, 0],
  [4, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 2, 1, 0, 0, 0, 0],
  [4, 3, 2, 1, 0, 0, 0, 0],
  [5, 4, 2, 1, 0, 0, 0, 0],
  [5, 4, 3, 2, 0, 0, 0, 0],
  [5, 4, 3, 2, 1, 0, 0, 0],
  [5, 5, 3, 2, 1, 0, 0, 0],
  [5, 5, 4, 3, 1, 0, 0, 0],
  [5, 5, 4, 3, 2, 1, 0, 0],
  [5, 5, 4, 3, 2, 1, 0, 0],
  [5, 5, 5, 4, 2, 1, 0, 0],
  [5, 5, 5, 4, 3, 2, 0, 0],
  [5, 5, 5, 4, 3, 2, 0, 0],
  [5, 5, 5, 5, 3, 2, 0, 0],
  [5, 5, 5, 5, 4, 3, 0, 0],
  [5, 5, 5, 5, 4, 3, 0, 0],
  [5, 5, 5, 5, 4, 3, 0, 0],
  [5, 5, 5, 5, 5, 4, 0, 0],
  [5, 5, 5, 5, 5, 4, 0, 0],
  [5, 5, 5, 5, 5, 4, 0, 0],
  [5, 5, 5, 5, 5, 5, 0, 0],
];

const HALF_TABLE: number[][] = [
  [1, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0],
  [2, 1, 0, 0, 0, 0, 0, 0],
  [3, 1, 0, 0, 0, 0, 0, 0],
  [3, 2, 0, 0, 0, 0, 0, 0],
  [4, 2, 1, 0, 0, 0, 0, 0],
  [4, 3, 1, 0, 0, 0, 0, 0],
  [5, 3, 2, 0, 0, 0, 0, 0],
  [5, 4, 2, 1, 0, 0, 0, 0],
  [5, 4, 3, 1, 0, 0, 0, 0],
  [5, 5, 3, 2, 0, 0, 0, 0],
  [5, 5, 4, 2, 1, 0, 0, 0],
  [5, 5, 4, 3, 1, 0, 0, 0],
  [5, 5, 5, 3, 2, 0, 0, 0],
  [5, 5, 5, 4, 2, 1, 0, 0],
  [5, 5, 5, 4, 3, 1, 0, 0],
  [5, 5, 5, 5, 3, 2, 0, 0],
  [5, 5, 5, 5, 4, 2, 1, 0],
  [5, 5, 5, 5, 4, 3, 1, 0],
  [5, 5, 5, 5, 5, 3, 2, 0],
  [5, 5, 5, 5, 5, 4, 2, 1],
  [5, 5, 5, 5, 5, 4, 3, 1],
  [5, 5, 5, 5, 5, 5, 3, 2],
  [5, 5, 5, 5, 5, 5, 4, 2],
  [5, 5, 5, 5, 5, 5, 4, 3],
  [5, 5, 5, 5, 5, 5, 5, 3],
  [5, 5, 5, 5, 5, 5, 5, 4],
  [5, 5, 5, 5, 5, 5, 5, 4],
  [5, 5, 5, 5, 5, 5, 5, 5],
];

const FULL_TABLE: number[][] = [
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 1, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0, 0],
  [5, 4, 2, 1, 0, 0, 0, 0, 0, 0],
  [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  [5, 5, 3, 2, 0, 0, 0, 0, 0, 0],
  [5, 5, 4, 3, 1, 0, 0, 0, 0, 0],
  [5, 5, 4, 3, 2, 0, 0, 0, 0, 0],
  [5, 5, 5, 4, 2, 1, 0, 0, 0, 0],
  [5, 5, 5, 4, 3, 2, 0, 0, 0, 0],
  [5, 5, 5, 5, 3, 2, 0, 0, 0, 0],
  [5, 5, 5, 5, 4, 3, 1, 0, 0, 0],
  [5, 5, 5, 5, 4, 3, 2, 0, 0, 0],
  [5, 5, 5, 5, 5, 4, 2, 1, 0, 0],
  [5, 5, 5, 5, 5, 4, 3, 2, 0, 0],
  [5, 5, 5, 5, 5, 5, 3, 2, 0, 0],
  [5, 5, 5, 5, 5, 5, 4, 3, 1, 0],
  [5, 5, 5, 5, 5, 5, 4, 3, 2, 0],
  [5, 5, 5, 5, 5, 5, 5, 4, 2, 1],
  [5, 5, 5, 5, 5, 5, 5, 4, 3, 2],
  [5, 5, 5, 5, 5, 5, 5, 5, 3, 2],
  [5, 5, 5, 5, 5, 5, 5, 5, 4, 3],
  [5, 5, 5, 5, 5, 5, 5, 5, 4, 3],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 4],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 4],
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
];

/** Every class's slot table, base and promoted alike. Promotion (level 15) doesn't
 * change the slot table on its own — it only unlocks the promoted class's spell list
 * on top of the base class's (hybrid, nothing lost). Base tier and each promotion:
 *   Black Mage  ALTA  — Elementalist ALTA (pleno) · Warlock MEIA
 *   Conjurer    ALTA  — Sorcerer ALTA (pleno)     · Necromancer MEIA
 *   Healer      ALTA  — Bishop ALTA (pleno)       · Cleric MEIA
 *   Warrior     QUARTA — Paladin MEIA              · Heavy Knight QUARTA
 *   Archer      MEIA  — Ranger QUARTA             · Assassin MEIA
 *   Lancer      QUARTA — Sentinel QUARTA           · Templar MEIA
 */
const CLASS_TIER_TABLE: Partial<Record<ClassId, number[][]>> = {
  mage: FULL_TABLE,
  conjurer: FULL_TABLE,
  healer: FULL_TABLE,
  swordsman: QUARTER_TABLE,
  archer: HALF_TABLE,
  lancer: QUARTER_TABLE,
  elementalist: FULL_TABLE,
  warlock: HALF_TABLE,
  sorcerer: FULL_TABLE,
  necromancer: HALF_TABLE,
  bishop: FULL_TABLE,
  cleric: HALF_TABLE,
  paladin: HALF_TABLE,
  heavyKnight: QUARTER_TABLE,
  ranger: QUARTER_TABLE,
  assassin: HALF_TABLE,
  sentinel: QUARTER_TABLE,
  templar: HALF_TABLE,
};

export const PROMOTE_LEVEL = 15;

/** Base class → the two classes it can promote into at PROMOTE_LEVEL. Player picks one;
 * the base class's own spell list stays available afterward (hybrid, nothing lost). */
export const PROMOTIONS: Partial<Record<ClassId, [ClassId, ClassId]>> = {
  mage: ["elementalist", "warlock"],
  conjurer: ["sorcerer", "necromancer"],
  healer: ["cleric", "bishop"],
  swordsman: ["paladin", "heavyKnight"],
  archer: ["ranger", "assassin"],
  lancer: ["sentinel", "templar"],
};

/** Reverse of PROMOTIONS: promoted ClassId → its base ClassId. Lets anything keyed on
 * the base class (spell lists today; combat stats/sprites later) resolve for a promoted
 * unit too, so promotion only adds — it never drops what the base class already granted. */
export const PROMOTED_BASE: Partial<Record<ClassId, ClassId>> = Object.fromEntries(
  Object.entries(PROMOTIONS).flatMap(([base, options]) => options!.map((o) => [o, base])),
) as Partial<Record<ClassId, ClassId>>;

export function tierUses(classId: ClassId, tier: SpellTier, level: number): number {
  const table = CLASS_TIER_TABLE[classId];
  if (table) {
    const row = table[Math.max(0, Math.min(29, level - 1))]!;
    return row[tier - 1] ?? 0;
  }
  const speed = TIER_SPEED[classId];
  if (!speed) return 0;
  const step = TIER_SPEED_STEP[speed];
  return Math.max(0, Math.min(5, Math.floor(level / step) - tier + 2));
}

export const SPELL_TIER: Partial<Record<SpellKind, SpellTier>> = {
  magicMissile: 1,
  longShot: 1,
  cureMinor: 1,
  doubleStrike: 1,
  piercingThrust: 1,
  lightning: 2,
  piercing: 2,
  cureWounds: 2,
  cleave: 2,
  sweep: 2,
  trip: 3,
  summonFamiliar: 1,
  webOfDreams: 2,
  fireball: 3,
  cureDisease: 3,
  causticVenom: 4,
};

export function spellTier(kind: SpellKind): SpellTier | null {
  return SPELL_TIER[kind] ?? null;
}

export function tierKey(tier: SpellTier): TierKey {
  return TIER_KEYS[tier - 1];
}

export function enemyLevelFor(missionIndex: number): number {
  if (missionIndex >= 9) return 4;
  if (missionIndex >= 5) return 3;
  if (missionIndex >= 2) return 2;
  return 1;
}

export function fireballOrigin(click: { x: number; y: number }, _cols: number, _rows: number): { x: number; y: number } {
  return { x: click.x, y: click.y };
}

export function fireballTiles(origin: { x: number; y: number }, cols: number, rows: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const radius = FIREBALL.size;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const Aq = x - (y - (y & 1)) / 2;
      const Ar = y;
      const As = -Aq - Ar;
      const Bq = origin.x - (origin.y - (origin.y & 1)) / 2;
      const Br = origin.y;
      const Bs = -Bq - Br;
      const d = (Math.abs(Aq - Bq) + Math.abs(Ar - Br) + Math.abs(As - Bs)) / 2;
      if (d <= radius) out.push({ x, y });
    }
  }
  return out;
}

/** Generic hex-radius area, same cube-distance math as fireballTiles but parameterized —
 * used by Web of Dreams (and anything else with its own AoE size) instead of FIREBALL.size. */
export function hexAreaTiles(origin: { x: number; y: number }, radius: number, cols: number, rows: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const Aq = x - (y - (y & 1)) / 2;
      const Ar = y;
      const As = -Aq - Ar;
      const Bq = origin.x - (origin.y - (origin.y & 1)) / 2;
      const Br = origin.y;
      const Bs = -Bq - Br;
      const d = (Math.abs(Aq - Bq) + Math.abs(Ar - Br) + Math.abs(As - Bs)) / 2;
      if (d <= radius) out.push({ x, y });
    }
  }
  return out;
}

export function fireballRangeTiles(from: { x: number; y: number }, cols: number, rows: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const Aq = x - (y - (y & 1)) / 2;
      const Ar = y;
      const As = -Aq - Ar;
      const Bq = from.x - (from.y - (from.y & 1)) / 2;
      const Br = from.y;
      const Bs = -Bq - Br;
      const d = (Math.abs(Aq - Bq) + Math.abs(Ar - Br) + Math.abs(As - Bs)) / 2;
      if (d <= FIREBALL.range) out.push({ x, y });
    }
  }
  return out;
}

export function startingBags(): Record<string, Bag> {
  return {
    Kael: { ...STARTING_BAG },
    Neera: { ...STARTING_BAG },
    Voss: { ...STARTING_BAG },
    Salazar: { ...EMPTY_BAG, lockpick: 3 },
  };
}

const CHAR: Record<string, TerrainId> = {
  ".": "plains",
  w: "woods",
  r: "ruins",
  a: "water",
  e: "ember",
  h: "hill",
  f: "flame",
  c: "column",
  n: "nave",
  b: "barricade",
  d: "highwood",
  s: "highruin",
  k: "chest",
  o: "door",
  t: "deadtree",
  v: "void",
};

export function parseLayout(layout: string[]): TerrainId[] {
  const tiles: TerrainId[] = [];
  for (const row of layout) {
    for (const ch of row) {
      tiles.push(CHAR[ch] ?? "plains");
    }
  }
  return tiles;
}

export const TILE_CHAR: Record<TerrainId, string> = {
  plains: ".",
  woods: "w",
  ruins: "r",
  water: "a",
  ember: "e",
  hill: "h",
  flame: "f",
  column: "c",
  nave: "n",
  barricade: "b",
  highwood: "d",
  highruin: "s",
  chest: "k",
  door: "o",
  deadtree: "t",
  void: "v",
};

export function isRangedWeapon(unit: { maxRange: number; mag: number }): boolean {
  return unit.maxRange > 1 && unit.mag === 0;
}

export function isProjectile(unit: { maxRange: number }): boolean {
  return unit.maxRange > 1;
}

export function effectiveMaxRange(unit: Pick<Unit, "maxRange" | "weaponId">, tile: TerrainId): number {
  const high = TERRAIN[tile].height ? 1 : 0;
  const ranged = unit.weaponId ? !!WEAPONS[unit.weaponId]?.ranged : false;
  return unit.maxRange + (ranged ? high : 0);
}

export function terrainNote(id: TerrainId): string | undefined {
  const t = TERRAIN[id];
  if (t.height) return `${t.name} · +2 dano · arqueira +1 alcance`;
  if (t.id === "barricade") return "não se atravessa · 3 hexes · de trás você atira · quem está atrás não é acertado";
  if (t.id === "chest") return "trancado · precisa de Gazua para abrir · pode conter Ember";
  if (t.id === "door") return "trancada · precisa de Gazua para abrir";
  if (t.id === "void") return "vazio · não se atravessa, não se vê através · apaga o terreno pra fechar áreas indoor";
  return undefined;
}

const RAW_MISSIONS: Mission[] = [
  {
    id: "vau",
    index: 0,
    title: "O Vau",
    place: "Rio de cinza",
    briefing:
      "O rio ainda corta a planície queimada. Três sobreviventes. Do outro lado, a milícia que os persegue. Atravessem o vau e abram caminho.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 8,
    rows: 7,
    layout: [
      "..ww..h.",
      "...ww.h.",
      "aaa.aaaa",
      "aaa.aaah",
      ".h......",
      "w......w",
      "ww....ww",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 2, y: 6 },
      { name: "Neera", classId: "archer", x: 3, y: 6 },
      { name: "Voss", classId: "mage", x: 4, y: 6 },
    ],
    enemySpawns: [
      { name: "Soldado", classId: "soldier", x: 1, y: 0 },
      { name: "Soldado", classId: "soldier", x: 6, y: 0 },
      { name: "Besteiro", classId: "brigand", x: 4, y: 1 },
    ],
  },
  {
    id: "bosque",
    index: 1,
    title: "Bosque Morto",
    place: "Troncos secos",
    briefing:
      "As árvores não têm folhas há duas estações. O bosque aperta o passo e esconde besteiros. Não deixem Kael sozinho na frente.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 9,
    rows: 8,
    layout: [
      "w.w...w.w",
      ".www.www.",
      "w..w.w..w",
      "ww.....ww",
      "w..hhh..w",
      ".w.....w.",
      "w.......w",
      "ww.....ww",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 7 },
      { name: "Neera", classId: "archer", x: 3, y: 7 },
      { name: "Voss", classId: "mage", x: 5, y: 7 },
    ],
    enemySpawns: [
      { name: "Soldado", classId: "soldier", x: 1, y: 0 },
      { name: "Soldado", classId: "soldier", x: 7, y: 0 },
      { name: "Besteiro", classId: "brigand", x: 4, y: 1 },
      { name: "Besteiro", classId: "brigand", x: 2, y: 2 },
    ],
  },
  {
    id: "aldeia",
    index: 2,
    title: "Aldeia Queimada",
    place: "Casario em ruína",
    briefing:
      "A aldeia ainda fumega. Casas em chama custam o passo e queimam quem atravessa — 1d8. Piqueiros alcançam duas casas. Não corram pelo fogo.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 10,
    rows: 8,
    layout: [
      "eewrr.wree",
      "ew.fff...e",
      "w.rrr.rr.w",
      ".fff..fff.",
      "ww.rr.rr.w",
      ".f.h..h.f.",
      "w...ff...w",
      "www....www",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 7 },
      { name: "Neera", classId: "archer", x: 3, y: 7 },
      { name: "Voss", classId: "mage", x: 5, y: 7 },
    ],
    enemySpawns: [
      { name: "Piqueiro", classId: "pikeman", x: 3, y: 2 },
      { name: "Piqueiro", classId: "pikeman", x: 7, y: 2 },
      { name: "Soldado", classId: "soldier", x: 5, y: 2 },
      { name: "Besteiro", classId: "brigand", x: 2, y: 5 },
      { name: "Besteiro", classId: "brigand", x: 6, y: 5 },
    ],
  },
  {
    id: "muralha",
    index: 3,
    title: "Muralha Rasa",
    place: "Porta da fortaleza",
    briefing:
      "A muralha baixa ainda segura o caminho. Besteiros no adarve, soldados no vão do portão. Três cães de guerra — carne de rito, ferro uruk no focinho — tomam duas casas cada. Não deixem cercar Kael.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 11,
    rows: 8,
    layout: [
      "rrrr.e.rrrr",
      "r.........r",
      "rrr.....rrr",
      "r.........r",
      "....hhh....",
      "h.........h",
      "...........",
      "www.....www",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 5, y: 7 },
      { name: "Neera", classId: "archer", x: 4, y: 7 },
      { name: "Voss", classId: "mage", x: 6, y: 7 },
    ],
    enemySpawns: [
      { name: "Soldado", classId: "soldier", x: 4, y: 1 },
      { name: "Soldado", classId: "soldier", x: 6, y: 1 },
      { name: "Soldado", classId: "soldier", x: 5, y: 2 },
      { name: "Besteiro", classId: "brigand", x: 1, y: 3 },
      { name: "Besteiro", classId: "brigand", x: 9, y: 3 },
      { name: "Cão de guerra", classId: "wardog", x: 3, y: 5 },
      { name: "Cão de guerra", classId: "wardog", x: 7, y: 5 },
      { name: "Cão de guerra", classId: "wardog", x: 5, y: 4 },
    ],
  },
  {
    id: "fortaleza",
    index: 4,
    title: "Fortaleza de Cinzas",
    place: "Pátio interior",
    briefing:
      "O capitão espera no pátio. Derrubem ele — a guarda se dispersa. Voss e Neera acertam de longe, sem contra-ataque. Não encostem no chefe. Usem bosque e ruína.",
    objective: "Derrube o capitão",
    win: "boss",
    cols: 10,
    rows: 8,
    layout: [
      "rrr.ee.rrr",
      "r........r",
      "r........r",
      "r........r",
      "r..rrrr..r",
      "r.ww..ww.r",
      "e........e",
      "ee......ee",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 7 },
      { name: "Neera", classId: "archer", x: 3, y: 7 },
      { name: "Voss", classId: "mage", x: 5, y: 7 },
    ],
    enemySpawns: [
      { name: "Capitão", classId: "captain", x: 4, y: 1 },
      { name: "Soldado", classId: "soldier", x: 2, y: 2 },
      { name: "Soldado", classId: "soldier", x: 7, y: 2 },
      { name: "Besteiro", classId: "brigand", x: 8, y: 3 },
    ],
  },
  {
    id: "templo",
    index: 5,
    title: "As Jaulas da Lua Carmim",
    place: "Nave enforcada",
    briefing:
      "A lua de sangue pende sobre a nave. Gaiolas de ferro e carne. O rito já acabou — Asherah ocupa o altar. Matem todos. Se ela alcançar Voss, ele cai.",
    objective: "Derrote Asherah e os feiticeiros",
    win: "rout",
    cols: 13,
    rows: 12,
    layout: [
      "rrrrreeerrrrr",
      "rcnhhhnnnncrr",
      "rnnhhhhnnnncr",
      "rcnnfnnnnfncr",
      "rnncnnrnncnnr",
      "rcnnnnnnnnncr",
      "rnncnnnrrcnnr",
      "rcnnnnnnnncnr",
      "rnnrnnnnnrnnr",
      "rcnncnnncncnr",
      "rnnnnnnnnnnnr",
      "rrrnnnnnnnrrr",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 5, y: 11 },
      { name: "Neera", classId: "archer", x: 6, y: 11 },
      { name: "Voss", classId: "mage", x: 7, y: 11 },
    ],
    enemySpawns: [
      { name: "Asherah", classId: "horror", x: 6, y: 2 },
      { name: "Feiticeiro", classId: "cultist", x: 2, y: 4 },
      { name: "Feiticeiro", classId: "cultist", x: 10, y: 4 },
      { name: "Feiticeiro", classId: "cultist", x: 2, y: 8 },
      { name: "Feiticeiro", classId: "cultist", x: 10, y: 8 },
    ],
  },
  {
    id: "cripta",
    index: 6,
    title: "Cripta de Cinzas",
    place: "Sob o templo",
    briefing:
      "Asherah caiu. O prisioneiro do rito anda — Salazar, clérigo sem poções. Duas curas menores e uma cura simples por combate. A cripta ainda tem culto. Não deixem cercá-lo.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 11,
    rows: 10,
    layout: [
      "rrrrrrrrrrr",
      "rcncnnncncr",
      "nnnnnnnnnnn",
      "rcncnnncncr",
      "nnnnnnnnnnn",
      "rcncnnncncr",
      "nnnnnnnnnnn",
      "rcncnnncncr",
      "nnnnnnnnnnn",
      "rrrnnnnnrrr",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 9 },
      { name: "Neera", classId: "archer", x: 5, y: 9 },
      { name: "Voss", classId: "mage", x: 6, y: 9 },
      { name: "Salazar", classId: "healer", x: 7, y: 9 },
    ],
    enemySpawns: [
      { name: "Feiticeiro", classId: "cultist", x: 2, y: 1 },
      { name: "Feiticeiro", classId: "cultist", x: 8, y: 1 },
      { name: "Piqueiro", classId: "pikeman", x: 5, y: 2 },
      { name: "Soldado", classId: "soldier", x: 1, y: 4 },
      { name: "Soldado", classId: "soldier", x: 9, y: 4 },
      { name: "Besteiro", classId: "brigand", x: 5, y: 5 },
    ],
  },
  {
    id: "estalagem",
    index: 7,
    title: "A Estalagem do Osso Seco",
    place: "Pousada à margem da cinza",
    briefing:
      "A estrada acaba num copo. O Osso Seco ainda serve, se Ember pagar. Brue vende o que restou da adega. O mudo escreve. A hóspede do porão só fala. Ninguém ataca aqui.",
    objective: "Descanso, conversa e troca",
    win: "rout",
    hub: true,
    cols: 8,
    rows: 6,
    layout: [
      "rrrrrrrr",
      "r......r",
      "r......r",
      "r......r",
      "r......r",
      "rrrrrrrr",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 2, y: 4 },
      { name: "Neera", classId: "archer", x: 3, y: 4 },
      { name: "Voss", classId: "mage", x: 4, y: 4 },
      { name: "Salazar", classId: "healer", x: 5, y: 4 },
    ],
    enemySpawns: [],
  },
  {
    id: "colina",
    index: 8,
    title: "A Colina Morta",
    place: "Encosta seca",
    briefing:
      "Uma colina ampla, coberta de vegetação morta. Árvores retorcidas, capim amarelado, pedras antigas. O caminho sobe. Quanto mais alto, mais a encosta vira paredão. No cume, a silhueta de uma construção fortificada. A superfície acaba.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 11,
    rows: 9,
    layout: [
      "ccc...ccccc",
      "chhhhhhhhcc",
      "h.w.h.w.h.h",
      ".w...h...w.",
      "wh.......hw",
      ".h..hhh..h.",
      "w.w.....w.w",
      "...........",
      "www.....www",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 8 },
      { name: "Neera", classId: "archer", x: 3, y: 8 },
      { name: "Voss", classId: "mage", x: 6, y: 8 },
      { name: "Salazar", classId: "healer", x: 7, y: 8 },
    ],
    enemySpawns: [
      { name: "Besteiro", classId: "brigand", x: 2, y: 2 },
      { name: "Besteiro", classId: "brigand", x: 8, y: 2 },
      { name: "Soldado", classId: "soldier", x: 5, y: 3 },
      { name: "Piqueiro", classId: "pikeman", x: 4, y: 5 },
      { name: "Piqueiro", classId: "pikeman", x: 6, y: 5 },
      { name: "Soldado", classId: "soldier", x: 1, y: 6 },
      { name: "Besteiro", classId: "brigand", x: 9, y: 6 },
    ],
  },
  {
    id: "passagem",
    index: 9,
    title: "A Passagem Antiga",
    place: "Caverna talhada",
    briefing:
      "A única passagem pelo paredão é uma caverna escavada há muito tempo. Paredes talhadas, blocos de pedra, nichos e plataformas sem função. Raízes no teto. No escuro vive um troll da caverna, em armadura grosseira. Ele parte barricadas. Desce e sobe através da montanha.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 11,
    rows: 10,
    layout: [
      "ccccccccccc",
      "cnnnnnnnnnc",
      "cnnncnnncnn",
      "cnnnnnnnnnc",
      "cnncccccnnc",
      "cnnnnnnnnnc",
      "cnnncnnncnn",
      "cnnnnnnnnnc",
      "cnnnnnnnnnc",
      "cccnnnnnccc",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 9 },
      { name: "Neera", classId: "archer", x: 3, y: 9 },
      { name: "Voss", classId: "mage", x: 6, y: 9 },
      { name: "Salazar", classId: "healer", x: 7, y: 9 },
    ],
    enemySpawns: [
      { name: "Feiticeiro", classId: "cultist", x: 2, y: 1 },
      { name: "Feiticeiro", classId: "cultist", x: 8, y: 1 },
      { name: "Piqueiro", classId: "pikeman", x: 5, y: 2 },
      { name: "Soldado", classId: "soldier", x: 1, y: 5 },
      { name: "Soldado", classId: "soldier", x: 9, y: 5 },
      { name: "Besteiro", classId: "brigand", x: 5, y: 6 },
      { name: "Feiticeiro", classId: "cultist", x: 5, y: 3 },
      { name: "Troll da caverna", classId: "troll", x: 6, y: 6 },
    ],
  },
  {
    id: "profundezas",
    index: 10,
    title: "As Profundezas Famintas",
    place: "Câmaras mais fundas da caverna",
    briefing:
      "A passagem continua abaixo, mais funda que qualquer mapa registrado. O ar cheira a cinza fria. Pilares talhados sustentam um teto que não deveria existir a essa profundidade. Algo aqui não come há muito tempo — e não é comida que procura.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 13,
    rows: 9,
    layout: [
      "ccccccccccccc",
      "cnnnnnnnnnnnc",
      "cnncnnnnncnnc",
      "cnnnnnnnnnnnc",
      "cncnnncnnncnc",
      "cnnnnnnnnnnnc",
      "cnnncnnncnnnc",
      "nnnnnnnnnnnnc",
      "cnnnnnnnnnnnc",
    ],
    // No locked door/chest room on this map — dropped per direct instruction. Row 7's open
    // west wall (the "n" where every other row has "c") is the entrance the party actually
    // walked in through — non-functional (it doesn't lead anywhere off-map, there's nowhere
    // for it to lead), but a dungeon needs a visible way in for the room to read as coherent
    // rather than a sealed box the party spawned inside of. The map's own normal chest
    // auto-sprinkle (see decorateOpenTerrain/placeChests) still applies here same as any
    // other mission, capped at 1 for a map this size.
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 5, y: 7 },
      { name: "Neera", classId: "archer", x: 4, y: 7 },
      { name: "Voss", classId: "mage", x: 6, y: 7 },
      { name: "Salazar", classId: "healer", x: 7, y: 7 },
    ],
    // Ember Starved is size:4 with FOOTPRINT_TYPE_8, which extends 3 rows above its own
    // anchor tile — y:1 (tried earlier) pushed part of that footprint to negative y, off
    // the map entirely, which is why it wasn't rendering/showing up at all rather than just
    // looking wrong. y:3 keeps the whole footprint in bounds (top edge lands exactly on the
    // y:0 border row, same as the two trolls at y:6 do lower down) while still sitting
    // noticeably deeper than them (distance 4 from the y:7 entrance vs. their 1).
    enemySpawns: [
      { name: "Feiticeiro", classId: "cultist", x: 3, y: 1 },
      { name: "Feiticeiro", classId: "cultist", x: 9, y: 1 },
      { name: "Piqueiro", classId: "pikeman", x: 8, y: 2 },
      { name: "Soldado", classId: "soldier", x: 2, y: 3 },
      { name: "Soldado", classId: "soldier", x: 10, y: 3 },
      { name: "Besteiro", classId: "brigand", x: 7, y: 4 },
      { name: "Feiticeiro", classId: "cultist", x: 6, y: 5 },
      { name: "Piqueiro", classId: "pikeman", x: 3, y: 5 },
      { name: "Troll da caverna", classId: "troll", x: 2, y: 6 },
      // x:10,y:7 (was x:10,y:6) — the old spot wedged this troll's own footprint
      // (FOOTPRINT_TYPE_8 reaches 3 rows above its anchor) against a pillar, so every
      // neighboring cell failed computeReachable's passability check and it was left with a
      // reach of just its own tile: permanently frozen in place regardless of any AI logic,
      // since it could never move onto anything reach-checked. One row deeper clears it.
      { name: "Troll da caverna", classId: "troll", x: 10, y: 7 },
      { name: "Ember Starved", classId: "horror", x: 6, y: 3, guaranteedDrop: true },
    ],
  },
  {
    id: "vertente",
    index: 11,
    // Reserved/placeholder title — this mission and "portao" right after it (the Fortified
    // Temple Complex arc) are locked out of the world map (see WORLD_LOCATIONS's "vertente"
    // entry) until their content gets a real pass; "profundezas" now sits ahead of them as
    // the new mission 11 a player actually reaches.
    title: "R1",
    place: "Face norte da colina",
    briefing:
      "A passagem desemboca na outra face. Pouco muda no chão. Muda a vista: a elevação inteira acima, e no topo o Templo Fortificado, nítido pela primeira vez. Não parece abandonado. A encosta é pior deste lado.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 11,
    rows: 9,
    layout: [
      "rrrr.e.rrrr",
      "r.........r",
      "hhh.....hhh",
      ".w.h...h.w.",
      "h.........h",
      ".w..hhh..w.",
      "w.........w",
      "...........",
      "www.....www",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 8 },
      { name: "Neera", classId: "archer", x: 3, y: 8 },
      { name: "Voss", classId: "mage", x: 6, y: 8 },
      { name: "Salazar", classId: "healer", x: 7, y: 8 },
    ],
    enemySpawns: [
      { name: "Besteiro", classId: "brigand", x: 2, y: 1 },
      { name: "Besteiro", classId: "brigand", x: 8, y: 1 },
      { name: "Soldado", classId: "soldier", x: 5, y: 2 },
      { name: "Piqueiro", classId: "pikeman", x: 3, y: 4 },
      { name: "Piqueiro", classId: "pikeman", x: 7, y: 4 },
      { name: "Cão de guerra", classId: "wardog", x: 1, y: 6 },
      { name: "Cão de guerra", classId: "wardog", x: 9, y: 6 },
    ],
  },
  {
    id: "portao",
    index: 12,
    title: "R2",
    place: "Portões do cume",
    briefing:
      "O caminho acaba diante da entrada. Muralhas espessas, torres no corpo da igreja, portão monumental. Antigo e preservado. A escadaria sobe até as portas. O interior fica para depois.",
    objective: "Derrote todos os inimigos",
    win: "rout",
    cols: 11,
    rows: 8,
    layout: [
      "rrr.....rrr",
      "r.........r",
      "rrr.....rrr",
      "....hhh....",
      "...........",
      "h.........h",
      "...........",
      "www.....www",
    ],
    playerSpawns: [
      { name: "Kael", classId: "swordsman", x: 4, y: 7 },
      { name: "Neera", classId: "archer", x: 3, y: 7 },
      { name: "Voss", classId: "mage", x: 6, y: 7 },
      { name: "Salazar", classId: "healer", x: 7, y: 7 },
    ],
    enemySpawns: [
      { name: "Capitão", classId: "captain", x: 5, y: 1 },
      { name: "Soldado", classId: "soldier", x: 2, y: 1 },
      { name: "Soldado", classId: "soldier", x: 8, y: 1 },
      { name: "Besteiro", classId: "brigand", x: 1, y: 2 },
      { name: "Besteiro", classId: "brigand", x: 9, y: 2 },
      { name: "Piqueiro", classId: "pikeman", x: 4, y: 3 },
      { name: "Piqueiro", classId: "pikeman", x: 6, y: 3 },
      { name: "Feiticeiro", classId: "cultist", x: 5, y: 0 },
      { name: "Cão de guerra", classId: "wardog", x: 2, y: 5 },
      { name: "Cão de guerra", classId: "wardog", x: 8, y: 5 },
    ],
  },
];

function expandMaps(missions: Mission[]): Mission[] {
  return missions.map((m) => {
    if (m.hub) return m;
    const layout: string[] = [];
    for (const row of m.layout) {
      const wide = Array.from(row, (ch) => ch + ch).join("");
      layout.push(wide, wide);
    }
    const place = <T extends { x: number; y: number }>(s: T): T => ({ ...s, x: s.x * 2, y: s.y * 2 });
    return stampTactics({
      ...m,
      cols: m.cols * 2,
      rows: m.rows * 2,
      layout,
      playerSpawns: m.playerSpawns.map(place),
      enemySpawns: m.enemySpawns.map(place),
    });
  });
}

/** The six neighbor cells of an odd-r offset hex grid coordinate, as absolute [x, y] pairs
 * — the one copy of this offset table for the whole file (it was previously re-declared
 * three separate times: twice inline in stampTactics, once more for decorateOpenTerrain's
 * flood-fill/connectivity checks below). */
function hexAdj(x: number, y: number): [number, number][] {
  const even: [number, number][] = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
  const odd: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
  return (y & 1 ? odd : even).map(([dx, dy]) => [x + dx, y + dy]);
}

function oddrDist(ax: number, ay: number, bx: number, by: number): number {
  const aq = ax - (ay - (ay & 1)) / 2;
  const bq = bx - (by - (by & 1)) / 2;
  const ar = ay;
  const br = by;
  return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(-aq - ar - (-bq - br))) / 2;
}

function stampTactics(m: Mission): Mission {
  const tiles = parseLayout(m.layout);
  const blocked = new Set<string>();
  const mark = (x: number, y: number) => blocked.add(`${x},${y}`);
  for (const s of [...m.playerSpawns, ...m.enemySpawns]) {
    mark(s.x, s.y);
    for (const [nx, ny] of hexAdj(s.x, s.y)) mark(nx, ny);
  }
  const cand: { x: number; y: number }[] = [];
  for (let y = 1; y < m.rows - 1; y++) {
    for (let x = 1; x < m.cols - 1; x++) {
      const t = tiles[y * m.cols + x];
      if ((t === "plains" || t === "nave" || t === "woods") && !blocked.has(`${x},${y}`)) cand.push({ x, y });
    }
  }
  let seed = (m.index + 1) * 9973;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = cand[i]!;
    cand[i] = cand[j]!;
    cand[j] = tmp;
  }
  const taken: { x: number; y: number }[] = [];
  const walkable = (t: TerrainId | undefined) => !!t && TERRAIN[t].passable;
  const canWalk = (tilesNow: TerrainId[]) => {
    const from = m.playerSpawns[0];
    const to = m.enemySpawns[0];
    if (!from || !to) return true;
    const seen = new Set<string>([`${from.x},${from.y}`]);
    const q = [{ x: from.x, y: from.y }];
    while (q.length) {
      const p = q.pop()!;
      if (oddrDist(p.x, p.y, to.x, to.y) <= 1) return true;
      for (const [nx, ny] of hexAdj(p.x, p.y)) {
        if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows) continue;
        const k = `${nx},${ny}`;
        if (seen.has(k)) continue;
        if (!walkable(tilesNow[ny * m.cols + nx])) continue;
        seen.add(k);
        q.push({ x: nx, y: ny });
      }
    }
    return false;
  };
  const okBase = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= m.cols - 1 || y >= m.rows - 1) return false;
    if (blocked.has(`${x},${y}`)) return false;
    const t = tiles[y * m.cols + x];
    return t === "plains" || t === "nave" || t === "woods";
  };
  const cubeOf = (col: number, row: number) => {
    const q = col - (row - (row & 1)) / 2;
    return { q, r: row };
  };
  const oddrOf = (q: number, r: number) => ({ x: q + (r - (r & 1)) / 2, y: r });
  const cubeDirs = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  const avg = (list: { x: number; y: number }[]) => ({
    x: list.reduce((s, p) => s + p.x, 0) / Math.max(1, list.length),
    y: list.reduce((s, p) => s + p.y, 0) / Math.max(1, list.length),
  });
  const P = avg(m.playerSpawns);
  const E = avg(m.enemySpawns);
  const frontX = (P.x + E.x) / 2;
  const frontY = (P.y + E.y) / 2;
  const minY = Math.min(P.y, E.y);
  const maxY = Math.max(P.y, E.y);
  const walls: { cells: { x: number; y: number }[]; score: number }[] = [];
  for (const p of cand) {
    if (!okBase(p.x, p.y)) continue;
    const A = cubeOf(p.x, p.y);
    for (const [dq, dr] of cubeDirs) {
      const cells = [p];
      let q = A.q;
      let r = A.r;
      let good = true;
      for (let k = 0; k < 2; k++) {
        q += dq!;
        r += dr!;
        const n = oddrOf(q, r);
        n.x = Math.round(n.x);
        n.y = Math.round(n.y);
        if (!okBase(n.x, n.y)) {
          good = false;
          break;
        }
        cells.push(n);
      }
      if (!good) continue;
      const mx = cells.reduce((s, c) => s + c.x, 0) / 3;
      const my = cells.reduce((s, c) => s + c.y, 0) / 3;
      const between = my > minY + 1.2 && my < maxY - 1.2;
      const sameRow = cells.every((c) => c.y === cells[0]!.y) ? 3 : 0;
      const dFront = Math.abs(mx - frontX) * 0.3 + Math.abs(my - frontY);
      const central = 1 - Math.abs(mx - (m.cols - 1) / 2) / (m.cols / 2);
      walls.push({ cells, score: (between ? 12 : 0) + sameRow + central * 4 - dFront });
    }
  }
  walls.sort((a, b) => b.score - a.score);
  let placed = 0;
  for (const wall of walls) {
    if (placed >= 2) break;
    if (wall.cells.some((c) => taken.some((q) => oddrDist(c.x, c.y, q.x, q.y) < 3))) continue;
    const prev = wall.cells.map((c) => tiles[c.y * m.cols + c.x]!);
    for (const c of wall.cells) tiles[c.y * m.cols + c.x] = "barricade";
    if (!canWalk(tiles)) {
      wall.cells.forEach((c, i) => {
        tiles[c.y * m.cols + c.x] = prev[i]!;
      });
      continue;
    }
    taken.push(...wall.cells);
    placed += 1;
  }
  const pick = (n: number, kind: TerrainId) => {
    let got = 0;
    for (const p of cand) {
      if (got >= n) break;
      const i = p.y * m.cols + p.x;
      if (tiles[i] === "hill" || tiles[i] === "highwood" || tiles[i] === "highruin" || tiles[i] === "deadtree" || tiles[i] === "barricade") continue;
      if (taken.some((q) => oddrDist(p.x, p.y, q.x, q.y) < 3)) continue;
      tiles[i] = kind;
      taken.push(p);
      got += 1;
    }
  };
  pick(3, "hill");
  const highKinds: TerrainId[] = ["hill", "highwood", "highruin", "deadtree"];
  for (let y = 0; y < m.rows; y++) {
    for (let x = 0; x < m.cols; x++) {
      const i = y * m.cols + x;
      if (tiles[i] !== "hill") continue;
      const v = (x * 17 + y * 31 + m.index * 9) % highKinds.length;
      tiles[i] = highKinds[v] ?? "hill";
    }
  }
  const layout: string[] = [];
  for (let y = 0; y < m.rows; y++) {
    let row = "";
    for (let x = 0; x < m.cols; x++) row += TILE_CHAR[tiles[y * m.cols + x] ?? "plains"] ?? ".";
    layout.push(row);
  }
  return { ...m, layout };
}

const ROCK_IDS = ["mountain-ridge", "spike-rocks", "broken-cliff-wall"];

/** Replaces every "column" tile (a marble pillar rendered on its own patch of grass —
 * looks absurd indoors, and doubly so on a plains/cave map that has no grass anywhere
 * else) with rock-formation decorations instead, on every mission that uses columns at
 * all, not just the worst offenders. Runs after expandMaps() specifically because a raw
 * mission's single hex always doubles into a horizontally-adjacent PAIR of the same tile
 * (expandMaps does `ch + ch` per character) — so working at the expanded grid means every
 * column, however isolated it looked in the original hand-authored layout, already has a
 * same-row neighbor to pair with here. That's what makes plain adjacent-pair matching
 * enough: no leftover singles to fall back on, no footprint mismatch to design around.
 * (An earlier pass tried placing decorations directly on the raw pre-expansion missions —
 * their coordinates don't survive expandMaps(), which scales spawns but not decorations,
 * so anything placed that way renders in the wrong spot. Doing it here, post-expansion,
 * on real rendered coordinates, sidesteps that entirely.) */
function rockifyColumns(mission: Mission): Mission {
  if (mission.hub) return mission;
  const grid = mission.layout.map((row) => row.split(""));
  const fallbackFloor = mission.layout.some((row) => row.includes("n")) ? "n" : ".";
  const decorations: DecorationPlacement[] = [...(mission.decorations ?? [])];
  const claimed = new Set<string>();
  let next = 0;
  for (let y = 0; y < mission.rows; y++) {
    for (let x = 0; x < mission.cols - 1; x++) {
      const key = `${x},${y}`;
      if (grid[y]![x] !== "c" || claimed.has(key)) continue;
      const rightKey = `${x + 1},${y}`;
      if (grid[y]![x + 1] !== "c" || claimed.has(rightKey)) continue;
      claimed.add(key);
      claimed.add(rightKey);
      decorations.push({ id: ROCK_IDS[next % ROCK_IDS.length]!, x, y });
      next += 1;
    }
  }
  // Defensive fallback only — the doubling guarantee above means this should never fire,
  // but an unpaired column left as-is would still be the exact sprite we're trying to
  // get rid of, so any survivor becomes plain floor instead.
  for (let y = 0; y < mission.rows; y++) {
    for (let x = 0; x < mission.cols; x++) {
      if (grid[y]![x] === "c" && !claimed.has(`${x},${y}`)) grid[y]![x] = fallbackFloor;
    }
  }
  return { ...mission, layout: grid.map((row) => row.join("")), decorations };
}

// Local seeded RNG for decorateOpenTerrain below — deliberately NOT imported from
// combat.ts, since it imports from data.ts already and importing back would create a
// circular module dependency. hexAdj above is the shared neighbor-offset helper both this
// section and stampTactics use.
function mulberry32Local(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TREE_DECOS = ["dense-forest", "dead-tree-large"];
const RUIN_DECOS = ["ruined-cottage", "broken-tower", "ruined-chapel", "broken-wall-segment", "boulder-cluster", "abandoned-mansion"];
// Fallback dressing for an indoor/underground map (floorChar "n") with nothing of its own to
// convert — no trees, no buildings, just loose rock. The buildings in RUIN_DECOS also read as
// extra doorways/entrances when scattered around a cave, easy to mistake for actual lockable
// doors on top of it looking wrong on its own.
const INDOOR_DECOS = ["boulder-cluster"];
const CONVERT_TO_OPEN = new Set(["w", "r"]);
const KEEP_HOST = new Set([".", "h", "f", "n"]);

type Cell = [number, number];

function inBoundsCell(x: number, y: number, cols: number, rows: number): boolean {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

function floodClusters(grid: string[][], cols: number, rows: number, chars: Set<string>): Cell[][] {
  const seen = new Set<string>();
  const clusters: Cell[][] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const key = `${x},${y}`;
      if (seen.has(key) || !chars.has(grid[y]![x]!)) continue;
      const stack: Cell[] = [[x, y]];
      seen.add(key);
      const comp: Cell[] = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        for (const [nx, ny] of hexAdj(cx, cy)) {
          const k = `${nx},${ny}`;
          if (inBoundsCell(nx, ny, cols, rows) && !seen.has(k) && chars.has(grid[ny]?.[nx] ?? "")) {
            seen.add(k);
            stack.push([nx, ny]);
            comp.push([nx, ny]);
          }
        }
      }
      clusters.push(comp);
    }
  }
  return clusters;
}

function connectivityOk(grid: string[][], cols: number, rows: number, blockedExtra: Set<string>, spawns: Cell[]): boolean {
  if (spawns.length === 0) return true;
  const passable = (x: number, y: number): boolean => {
    if (blockedExtra.has(`${x},${y}`)) return false;
    const id = CHAR[grid[y]![x]!] ?? "plains";
    return TERRAIN[id]?.passable !== false;
  };
  const [sx, sy] = spawns[0]!;
  const seen = new Set([`${sx},${sy}`]);
  const stack: Cell[] = [[sx, sy]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    for (const [nx, ny] of hexAdj(cx, cy)) {
      const k = `${nx},${ny}`;
      if (inBoundsCell(nx, ny, cols, rows) && !seen.has(k) && passable(nx, ny)) {
        seen.add(k);
        stack.push([nx, ny]);
      }
    }
  }
  return spawns.every(([x, y]) => seen.has(`${x},${y}`));
}

function chebyshev(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

function minDist(cell: Cell, pts: Cell[]): number {
  return pts.length ? Math.min(...pts.map((p) => chebyshev(cell, p))) : Infinity;
}

/** Sprinkles a handful of lockable chests ("here and there", not blanket coverage) onto
 * open ground — spaced apart, never where they'd cut off a spawn (same BFS check as
 * decoration placement, since a chest is impassable terrain until picked), and biased
 * toward enemy territory: candidates are ranked by (distance from the nearest player
 * spawn) minus (distance from the nearest enemy spawn), so a chest is worth fighting
 * through the enemy line for, not a freebie sitting next to the party's own spawn. */
function placeChests(
  grid: string[][],
  cols: number,
  rows: number,
  playerSpawns: Cell[],
  enemySpawns: Cell[],
  spawnSet: Set<string>,
  blockedExtra: Set<string>,
  seed: number,
  floorChar: string,
): void {
  const rng = mulberry32Local(seed);
  const spawns = [...playerSpawns, ...enemySpawns];
  const candidates: Cell[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = `${x},${y}`;
      if (spawnSet.has(k) || blockedExtra.has(k) || grid[y]![x] !== floorChar) continue;
      candidates.push([x, y]);
    }
  }
  candidates.sort((a, b) => {
    const scoreA = minDist(a, playerSpawns) - minDist(a, enemySpawns);
    const scoreB = minDist(b, playerSpawns) - minDist(b, enemySpawns);
    return scoreB - scoreA;
  });
  const pool = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const budget = Math.min(3, Math.max(1, Math.floor((cols * rows) / 150)));
  const placed: Cell[] = [];
  for (const [cx, cy] of pool) {
    if (placed.length >= budget) break;
    if (placed.some(([px, py]) => Math.max(Math.abs(px - cx), Math.abs(py - cy)) < 3)) continue;
    const candidate = new Set(blockedExtra);
    candidate.add(`${cx},${cy}`);
    if (connectivityOk(grid, cols, rows, candidate, spawns)) {
      grid[cy]![cx] = "k";
      blockedExtra.add(`${cx},${cy}`);
      placed.push([cx, cy]);
    }
  }
}

/** Strips "funky" single-hex clutter tiles — woods ("w") and ruins ("r"), whose baked-in
 * tree/house art tiles awkwardly at hex scale (and reads as grass/greenery even indoors,
 * e.g. a temple nave) — back to plain ground, replaced with a modest sprinkling of the
 * multi-hex decoration objects instead. Elevation (hill), fire (flame) and ember are
 * untouched. Also sprinkles 1-3 lockable chests per map onto open ground, deterministically
 * seeded by mission id so they don't reshuffle on reload. Every placement is verified with a
 * BFS connectivity check — dropped if it would cut any spawn off from the rest of the board —
 * so this can never produce an unwinnable map. Runs last, after rockifyColumns, on the same
 * real expanded coordinates the game actually renders. */
function decorateOpenTerrain(mission: Mission): Mission {
  if (mission.hub) return mission;
  const { cols, rows } = mission;
  const grid: string[][] = mission.layout.map((row) => row.split(""));
  const playerSpawns: Cell[] = mission.playerSpawns.map((s): Cell => [s.x, s.y]);
  const enemySpawns: Cell[] = mission.enemySpawns.map((s): Cell => [s.x, s.y]);
  const spawns: Cell[] = [...playerSpawns, ...enemySpawns];
  const spawnSet = new Set(spawns.map(([x, y]) => `${x},${y}`));
  // A decoration's art (especially the "large" multi-hex ones, like a tree canopy) commonly
  // renders taller/wider than its own hex footprint and visually bleeds into a neighboring
  // hex — fine over open ground, but reads as a unit standing "inside" the decoration if
  // that neighbor happens to be a spawn point, which is confusing even where it's not
  // actually a pathing block. Building a one-hex buffer around every spawn (not just
  // excluding the spawn tile itself) keeps decorations from ever anchoring close enough for
  // that visual bleed to reach a unit.
  const spawnClearance = new Set(spawnSet);
  for (const [sx, sy] of spawns) for (const [nx, ny] of hexAdj(sx, sy)) spawnClearance.add(`${nx},${ny}`);
  // A map that already uses "nave" (indoor black-slab floor) anywhere is an indoor/
  // underground space — walls stripped off of it should become more slab floor, not
  // grassy plains, or the whole room reads as an outdoor field with rocks scattered on it
  // (exactly what happened to "templo": most of its "r" ruin walls had no room left in the
  // decoration budget, so they fell back to plain grass on a map that's supposed to be a
  // hanged nave underground).
  const floorChar = mission.layout.some((row) => row.includes("n")) ? "n" : ".";

  const woodClusters = floodClusters(grid, cols, rows, new Set(["w"])).sort((a, b) => b.length - a.length);
  const ruinClusters = floodClusters(grid, cols, rows, new Set(["r"])).sort((a, b) => b.length - a.length);
  const totalWr = woodClusters.reduce((n, c) => n + c.length, 0) + ruinClusters.reduce((n, c) => n + c.length, 0);

  const decorations: DecorationPlacement[] = [];
  const blockedExtra = new Set<string>();

  function tryPlaceOne(anchor: Cell, pool: string[]): boolean {
    const [ax, ay] = anchor;
    for (const name of pool) {
      const def = DECORATIONS[name];
      if (!def) continue;
      const cells: Cell[] = def.footprint.map((f): Cell => [ax + f.dx, ay + f.dy]);
      if (!cells.every(([cx, cy]) => inBoundsCell(cx, cy, cols, rows))) continue;
      if (cells.some(([cx, cy]) => spawnClearance.has(`${cx},${cy}`))) continue;
      if (!cells.every(([cx, cy]) => CONVERT_TO_OPEN.has(grid[cy]![cx]!) || KEEP_HOST.has(grid[cy]![cx]!))) continue;
      if (cells.some(([cx, cy]) => blockedExtra.has(`${cx},${cy}`))) continue;
      const candidate = new Set(blockedExtra);
      for (const [cx, cy] of cells) candidate.add(`${cx},${cy}`);
      if (connectivityOk(grid, cols, rows, candidate, spawns)) {
        for (const [cx, cy] of cells) blockedExtra.add(`${cx},${cy}`);
        decorations.push({ id: name, x: ax, y: ay });
        return true;
      }
    }
    return false;
  }

  function placeInClusters(clusters: Cell[][], pool: string[], budget: number): number {
    let placed = 0;
    let di = 0;
    for (const cluster of clusters) {
      if (placed >= budget) break;
      if (cluster.length < 2) continue;
      const perClusterBudget = Math.max(1, Math.floor(cluster.length / 5));
      let got = 0;
      for (const anchor of cluster) {
        if (placed >= budget || got >= perClusterBudget) break;
        const [ax, ay] = anchor;
        if (spawnClearance.has(`${ax},${ay}`)) continue;
        const offset = di % pool.length;
        const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
        if (tryPlaceOne(anchor, rotated)) {
          di += 1;
          got += 1;
          placed += 1;
        }
      }
    }
    return placed;
  }

  const cap = totalWr > 0 ? Math.min(8, Math.max(2, Math.floor(totalWr / 6))) : 0;
  const placedTrees = placeInClusters(woodClusters, TREE_DECOS, cap);
  const placedRuins = placeInClusters(ruinClusters, RUIN_DECOS, Math.max(0, cap - placedTrees) + (placedTrees < cap ? 2 : 0));

  // A map with no wood/ruin clutter to begin with got zero decorations above — cap is 0
  // when there's nothing to convert. Top it up straight onto open ground so every map ends
  // up dressed, not just the ones that already had funky tiles to work with. Indoor/
  // underground maps (floorChar "n" — see its own doc comment above) never get trees or
  // buildings out of this fallback pool, direct feedback: "there are never houses inside a
  // cave" — just loose rock clutter, which reads fine anywhere.
  if (placedTrees + placedRuins < 3) {
    const openGround: Cell[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const k = `${x},${y}`;
        if (grid[y]![x] === floorChar && !spawnClearance.has(k) && !blockedExtra.has(k)) openGround.push([x, y]);
      }
    }
    const rng = mulberry32Local(seedFromId(`${mission.id}-deco`));
    for (let i = openGround.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [openGround[i], openGround[j]] = [openGround[j]!, openGround[i]!];
    }
    const pool = floorChar === "n" ? INDOOR_DECOS : [...TREE_DECOS, ...RUIN_DECOS];
    let placed = 0;
    const budget = 4;
    for (const anchor of openGround) {
      if (placed >= budget) break;
      const offset = placed % pool.length;
      const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
      if (tryPlaceOne(anchor, rotated)) placed += 1;
    }
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (CONVERT_TO_OPEN.has(grid[y]![x]!)) grid[y]![x] = floorChar;
    }
  }

  // Skip the auto-sprinkle entirely on a map that already hand-places its own chest(s) in
  // the raw layout — piling more on top made a mission with its own locked/gated chest feel
  // stuffed with more locks than lockpicks could realistically cover.
  const hasAuthoredChest = mission.layout.some((row) => row.includes("k"));
  if (!hasAuthoredChest) {
    placeChests(grid, cols, rows, playerSpawns, enemySpawns, spawnSet, blockedExtra, seedFromId(mission.id), floorChar);
  }

  return {
    ...mission,
    layout: grid.map((row) => row.join("")),
    decorations: [...(mission.decorations ?? []), ...decorations],
  };
}

/** Missions whose open ground is meant to read as dead/scorched, not living grass — the
 * plains tile's default art is lush green, wrong for a place whose own briefing describes
 * it as ash-choked. Swaps every plains cell to the desaturated third art variant
 * (plains03.png) instead. Add a mission id here rather than touching its terrain type: it's
 * still mechanically plains (same move cost, same defense), just dressed differently. */
const DEAD_GROUND_MISSIONS = new Set(["portao"]);
const DEAD_GROUND_VARIANT = 2;

function applyDeadGround(mission: Mission): Mission {
  if (!DEAD_GROUND_MISSIONS.has(mission.id)) return mission;
  const tiles = parseLayout(mission.layout);
  const variants = mission.tileVariants ? [...mission.tileVariants] : new Array(tiles.length).fill(0);
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === "plains") variants[i] = DEAD_GROUND_VARIANT;
  }
  return { ...mission, tileVariants: variants };
}

export const MISSIONS: Mission[] = expandMaps(RAW_MISSIONS).map(rockifyColumns).map(decorateOpenTerrain).map(applyDeadGround);

export function missionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Campaign world map markers, positioned (percent x/y, 0-100) against the real map art
 * at public/game/assets/world-map.jpg, pinned to that art's own labels per direct instruction:
 * Stone Bridge (missions 1-3: O Vau, Bosque Morto, Aldeia Queimada), the first of the two
 * "Ruins" (missions 4-6 plus Cripta de Cinzas, mission 7 — it's set under the temple ruins
 * above it, so it joins them as that location's 4th fight instead of Cemetery), the Inn
 * (mission 8), Dungeon (Colina Morta and Passagem Antiga, missions 9-10 — moved here from
 * Cemetery, which sits locked with no missions until more content backfills it), and the
 * Dungeon also picked up a third mission, "As Profundezas Famintas" (mission 11 —
 * deeper still, a new unique boss). The Fortified Temple Complex's own two missions
 * ("vertente"/"portao", titled R1/R2 as placeholders) are locked out of the map entirely
 * for now — pushed later in the story than mission 12, not ready for a real pass yet — same
 * "no missionIds" treatment as every other undeveloped location below. Those (Village,
 * Farm, the second Ruins, Cemetery, Frozen Swamp, Forest, Misty Cave — the last reserved
 * for a future troll encounter arc, City — reserved for the second Ferreiro) render
 * permanently locked until missions are written for them — "we'll open up more as we make
 * more missions." */
export const WORLD_LOCATIONS: WorldLocation[] = [
  { id: "stonebridge", name: "Stone Bridge", x: 14, y: 71, missionIds: ["vau", "bosque", "aldeia"] },
  { id: "ruins", name: "Ruins", x: 8, y: 56, missionIds: ["muralha", "fortaleza", "templo", "cripta"] },
  { id: "estalagem", name: "Inn", x: 48, y: 39, missionIds: ["estalagem"] },
  { id: "dungeon", name: "Dungeon", x: 60, y: 64, missionIds: ["colina", "passagem", "profundezas"] },
  // Locked (empty missionIds) on purpose — R1/R2 aren't ready for a real pass yet, see the
  // doc comment above.
  { id: "vertente", name: "Fortified Temple Complex", x: 78, y: 7, missionIds: [] },
  // Named on the map, not yet assigned to any mission — visible on the map (permanently
  // locked) as a preview of the world until content is written for them.
  { id: "village", name: "Village", x: 17, y: 27, missionIds: [] },
  { id: "farm", name: "Farm", x: 89, y: 46, missionIds: [] },
  { id: "ruins2", name: "Ruins", x: 12, y: 43, missionIds: [] },
  { id: "cemetery", name: "Cemetery", x: 46, y: 69, missionIds: [] },
  { id: "frozen-swamp", name: "Frozen Swamp", x: 20, y: 86, missionIds: [] },
  { id: "forest", name: "Forest", x: 85, y: 79, missionIds: [] },
  { id: "misty-cave", name: "Misty Cave", x: 63, y: 19, missionIds: [] },
  // Reserved for the second Ferreiro (higher-tier gear, once the current one's stock is
  // split into a low/high tier pair) — locked like every other undeveloped location until
  // missions and that second shop actually exist.
  { id: "city", name: "City", x: 35, y: 50, missionIds: [] },
];

export function locationForMission(missionId: string): WorldLocation | undefined {
  return WORLD_LOCATIONS.find((l) => l.missionIds.includes(missionId));
}

export function missionsForLocation(loc: WorldLocation): Mission[] {
  return loc.missionIds.map((id) => missionById(id)).filter((m): m is Mission => !!m);
}

/** Mission index at which a hero first appears as a player spawn — computed from
 * MISSIONS itself, not hardcoded, so a newly added hero (e.g. the next two joining the
 * roster) gets gated automatically the moment their first mission is authored. */
const HERO_JOIN_INDEX: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const m of MISSIONS) {
    if (m.hub) continue;
    for (const s of m.playerSpawns) {
      if (out[s.name] == null || m.index < out[s.name]!) out[s.name] = m.index;
    }
  }
  return out;
})();

/** Whether a hero has joined the party yet — false before the mission they first appear
 * in has been reached, so their gear doesn't show up in party-wide UI (Ferreiro,
 * Mochila) before the story actually recruits them. Recruited once the PRECEDING mission
 * is completed, since that's the one whose briefing/outcome frees them — e.g. Salazar
 * (first playerSpawn in "cripta", index 6) becomes recruited on completing mission 06,
 * "Nave Enforcada" (index 5), where Asherah falls and he's found as her prisoner. */
export function heroRecruited(name: string, completed: string[]): boolean {
  const joinIndex = HERO_JOIN_INDEX[name] ?? 0;
  if (joinIndex <= 0) return true;
  return completed.some((id) => (missionById(id)?.index ?? -1) >= joinIndex - 1);
}
