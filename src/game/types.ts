export type PotionId = "mid" | "weak" | "potent" | "disease" | "manaSmall" | "manaMid" | "manaLarge";

export interface Bag {
  mid: number;
  weak: number;
  potent: number;
  disease: number;
  manaSmall: number;
  manaMid: number;
  manaLarge: number;
  /** Gazuas: abrem baús e portas trancadas no mapa (não são poção, contam à parte). */
  lockpick: number;
}

export interface Spells {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
  tier5: number;
  tier6: number;
  tier7: number;
  tier8: number;
  tier9: number;
  tier10: number;
}

export const TIER_KEYS = ["tier1", "tier2", "tier3", "tier4", "tier5", "tier6", "tier7", "tier8", "tier9", "tier10"] as const;
export type TierKey = (typeof TIER_KEYS)[number];

export type TerrainId = "plains" | "woods" | "ruins" | "water" | "ember" | "hill" | "flame" | "column" | "nave" | "barricade" | "highwood" | "highruin" | "chest" | "door" | "deadtree" | "void";
export type Side = "player" | "enemy";
export type ClassId =
  | "swordsman"
  | "archer"
  | "mage"
  | "healer"
  | "soldier"
  | "brigand"
  | "captain"
  | "cultist"
  | "horror"
  | "pikeman"
  | "wardog"
  | "troll"
  | "assassin"
  | "rogue"
  | "lancer"
  | "conjurer"
  | "paladin"
  | "heavyKnight"
  // Promoted classes (promotion at level 15) — provisional stats/sprites, wired for
  // spell-slot progression only. Combat stats, real art and the promotion quest come later.
  | "elementalist"
  | "warlock"
  | "sorcerer"
  | "necromancer"
  | "cleric"
  | "bishop"
  | "ranger"
  | "sentinel"
  | "templar"
  // Conjurer tier 1 (Summon Familiar): not a recruitable class — its combat stats are
  // computed live from its summoner (see castSummonFamiliar), CLASSES.familiar only
  // supplies a sprite/size/range fallback and satisfies the ClassId-keyed tables below.
  | "familiar";
export type SpriteId = "kael" | "nira" | "voss" | "salazar" | "malrec" | "aldric" | "soldier" | "brigand" | "captain" | "sorcerer" | "horror" | "pikeman" | "wardog" | "troll" | "familiar";
export type HealId = "cureMinor" | "cureWounds";
export type SpellKind =
  | "fireball"
  | HealId
  | "longShot"
  | "piercing"
  | "lightning"
  | "magicMissile"
  | "causticVenom"
  | "doubleStrike"
  | "cleave"
  | "cureDisease"
  | "piercingThrust"
  | "sweep"
  | "trip"
  | "summonFamiliar"
  | "webOfDreams";
export type ScreenId = "boot" | "title" | "campaign" | "worldMap" | "briefing" | "cutscene" | "epilogue" | "battle" | "victory" | "defeat" | "inn" | "testMenu" | "mapEditor";
export type Phase = "player" | "enemy";
export type InputMode = "idle" | "selected" | "awaitAction" | "awaitAttack" | "awaitOffHand" | "awaitSpell" | "locked";

export interface Point {
  x: number;
  y: number;
}

export interface TerrainDef {
  id: TerrainId;
  name: string;
  moveCost: number;
  def: number;
  atk: number;
  passable: boolean;
  hazardDice?: number;
  hazardFaces?: number;
  height?: number;
  blocksShot?: boolean;
  cover?: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  hp: number;
  atk: number;
  mag: number;
  def: number;
  res: number;
  mov: number;
  minRange: number;
  maxRange: number;
  sprite: SpriteId;
  size: number;
  /** Footprint block for big creatures (size >= 4), in hexes. Defaults to 2 wide x 4 tall. */
  footprintW?: number;
  footprintH?: number;
  /**
   * Explicit footprint shape for big creatures (size >= 4), as {dx, dy} offsets from the
   * unit's own tile — dy: 0 is the front row (feet, closest to the player), negative dy is
   * further back. Overrides footprintW/footprintH when set, for shapes that aren't a plain
   * rectangle.
   */
  footprintOffsets?: { dx: number; dy: number }[];
  /** Turn-order priority: lower acts first. Only set for player classes so far. */
  init?: number;
}

export interface Spawn {
  name: string;
  classId: ClassId;
  x: number;
  y: number;
  /** Enemy-only: skips the normal 1%-per-kill loot roll and always drops something (from
   * the same random weapon-or-gear pool a chest rolls from) when this unit dies — for named
   * unique bosses the mission wants to reliably reward. */
  guaranteedDrop?: boolean;
}

export type WinCondition = "rout" | "boss";

/** A multi-hex terrain prop (mountain, ruin, bridge, ...): rendered as a single image
 * spanning several hexes rather than clipped to one, drawn on top of the regular tile
 * grid so it doesn't need to fill each hex's exact shape. Every hex in its footprint is
 * impassable and blocks line of sight, independent of whatever terrain tile is under it. */
export interface DecorationDef {
  id: string;
  name: string;
  /** Hex offsets from the anchor cell (dx/dy in board coordinates, same convention as
   * Unit.footprintOffsets — {dx:1,dy:0} is always the same-row neighbor). */
  footprint: { dx: number; dy: number }[];
}

/** A decoration placed on a mission's map, anchored at (x,y). */
export interface DecorationPlacement {
  id: string;
  x: number;
  y: number;
}

export interface Mission {
  id: string;
  index: number;
  title: string;
  place: string;
  briefing: string;
  objective: string;
  win: WinCondition;
  cols: number;
  rows: number;
  layout: string[];
  playerSpawns: Spawn[];
  enemySpawns: Spawn[];
  hub?: boolean;
  /** Which art variant to use per tile, row-major, same indexing as layout flattened.
   * Missing/undefined index or omitted array entirely means variant 0 (the default) —
   * existing missions never set this and keep rendering exactly as before. */
  tileVariants?: number[];
  /** Multi-hex terrain props (mountains, ruins, bridges, ...) placed on this map.
   * Omitted/empty on every existing mission — purely additive. */
  decorations?: DecorationPlacement[];
  /** Coordinates of chests on this map that should roll noticeably better loot when opened
   * — same pool and range as a normal chest (see useLockpick), just tipped toward the
   * better end: more Ember, better gear odds. For a chest worth gating behind a locked
   * door/sub-area rather than just leaving out in the open. Omitted on every existing
   * mission — purely additive. */
  betterChests?: { x: number; y: number }[];
}

/** A travel spot on the campaign world map. Most locations cover a single mission; a
 * location can also bundle a short arc of missions (e.g. an approach, an encounter, and
 * its aftermath at the same landmark) picked from one sub-menu instead of getting a
 * marker each — missionIds just lists them in story order. */
export interface WorldLocation {
  id: string;
  name: string;
  /** Position on the world map image, in percent (0-100) of its width/height. */
  x: number;
  y: number;
  missionIds: string[];
}

export interface Unit {
  id: string;
  name: string;
  classId: ClassId;
  className: string;
  role: string;
  side: Side;
  sprite: SpriteId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  mag: number;
  def: number;
  res: number;
  mov: number;
  minRange: number;
  maxRange: number;
  moved: boolean;
  acted: boolean;
  facing: 1 | -1;
  walkPose: "front" | "back" | "side";
  alive: boolean;
  drawX: number;
  drawY: number;
  flash: number;
  fade: number;
  bob: number;
  level: number;
  /** XP toward the next level (0..EXP_TO_LEVEL-1). Player-only; always 0 for enemies. */
  xp: number;
  bag: Bag;
  spells: Spells;
  /** Equipped WeaponDef id, or null (player units start with the group's weakest weapon; enemies have none). */
  weaponId: string | null;
  /** Tabletop-style enhancement on the equipped weapon, 0..5. */
  weaponEnh: number;
  size: number;
  footprintW?: number;
  footprintH?: number;
  footprintOffsets?: { dx: number; dy: number }[];
  shock: { dice: number; faces: number; bonus: number } | null;
  diseased: boolean;
  diseaseBase: { atk: number; mag: number; def: number; res: number; mov: number } | null;
  /** Caustic Venom residue: 1D4 damage at the start of every one of this unit's own turns
   * (see startOfTurnEffects) until cured — same cure trigger as diseased (Cure Disease
   * spell or the disease potion), but no stat penalty of its own. */
  poisoned: boolean;
  /** Shield Bash victim: loses their entire next turn, then clears automatically. */
  stunned: boolean;
  /** How many of this unit's own upcoming turns `stunned` still eats — Shield Bash sets this
   * to 1, Trip (Lancer tier 3) to 2. Decremented each time it costs a turn; `stunned` only
   * clears once this reaches 0. */
  stunTurns: number;
  /** Trip (Lancer tier 3) victim: a permanent (this battle) −10% to ATK/MAG/DEF/RES/MOV,
   * applied once and never restored — unlike `diseased`, nothing cures it. */
  crippled: boolean;
  /** Equipped off-hand EquipmentDef id (kind "weapon" or "shield"), or null. */
  offHandId: string | null;
  /** Summon Familiar (Conjurer tier 1): a player-side unit that doesn't count toward "any
   * hero still alive" for the defeat check or the playerAlive HUD figure — the party can't
   * survive a wipe on a pet alone. Everything else about it (selecting, moving, acting,
   * being targeted) works exactly like any other player unit. */
  summoned: boolean;
  /** Web of Dreams (Conjurer tier 2) victim: skips its own upcoming turns just like
   * `stunned`, but decrements on a separate counter (`sleepTurns`, set by a 1D4 roll) and
   * clears early — mid-round, not just at its own next turn — the instant it takes a hit,
   * which also applies that hit's `sleepBonusDamage` multiplier. */
  asleep: boolean;
  sleepTurns: number;
  /** Mirrors Spawn.guaranteedDrop — read once in markDead, never touched afterward. */
  guaranteedDrop: boolean;
  /** Total path cost already spent moving this unit's own turn — reset once in
   * beginUnitTurn. Free repositioning (see effectiveUnitForReach) recomputes reach fresh
   * from wherever the unit currently stands after every move, which without this would
   * hand back a full, fresh `mov` budget each time and let a unit walk the length of the
   * map in hex-by-hex hops within a single turn; subtracting what's already been spent
   * caps the turn's real total distance at `mov`, same as it's always meant to be, while
   * still letting the player freely change their mind about WHERE within that budget to
   * end up (the actual point of free repositioning). */
  moveBudgetUsed: number;
}

export interface UnitPublic {
  id: string;
  name: string;
  classId: ClassId;
  className: string;
  role: string;
  side: Side;
  sprite: SpriteId;
  hp: number;
  maxHp: number;
  atk: number;
  mag: number;
  def: number;
  res: number;
  mov: number;
  minRange: number;
  maxRange: number;
  moved: boolean;
  acted: boolean;
  x: number;
  y: number;
  level: number;
  xp: number;
  bag: Bag;
  spells: Spells;
  weaponId: string | null;
  weaponEnh: number;
  size: number;
  diseased: boolean;
  poisoned: boolean;
  stunned: boolean;
  crippled: boolean;
  offHandId: string | null;
  summoned: boolean;
  asleep: boolean;
  /** True while this unit's current cell sits inside an active Web of Dreams zone — purely a
   * display flag; the movement penalty it implies is computed live off the zone, not stored. */
  restrained: boolean;
}

export interface WeaponDef {
  id: string;
  name: string;
  /** Classes (base and prestige) allowed to equip this weapon. */
  usableBy: ClassId[];
  dice: number;
  faces: number;
  bonus: number;
  price: number;
  /** Attack range, D&D-weapon-style — determined by the weapon itself, not the wielder's class. */
  minRange: number;
  maxRange: number;
  /** True for bow/crossbow-type weapons: grants the elevated-terrain range bonus (see effectiveMaxRange). */
  ranged?: boolean;
  /** Occupies both hands — an offHand item can't be equipped alongside it. */
  twoHanded?: boolean;
  /** The one class (of usableBy's pool, if it's a shared one) this weapon is thematically
   * tuned for — a staff named after a school of magic, say — and deals 10% more damage to
   * whoever wields it while actually being that class. Every other class in the pool can
   * still equip and use it at no penalty, just without the bonus. */
  bonusClass?: ClassId;
}

/**
 * Paper-doll equipment slots. "mainHand" isn't stored here — it's the existing weapon
 * system (SaveData.equipped/weapons). Every other slot is a bare skeleton for now: the
 * type and the UI exist, but EQUIPMENT in data.ts has no items in it yet.
 */
export type EquipSlot =
  | "head"
  | "neck"
  | "shoulders"
  | "back"
  | "chest"
  | "hands"
  | "waist"
  | "legs"
  | "feet"
  | "ring1"
  | "ring2"
  | "offHand";

export interface EquipmentDef {
  id: string;
  name: string;
  slot: EquipSlot;
  /** Classes (base and prestige) allowed to equip this item. Empty/omitted = any class. */
  usableBy?: ClassId[];
  hp?: number;
  atk?: number;
  mag?: number;
  def?: number;
  res?: number;
  mov?: number;
  price?: number;
  /** offHand-slot items only: "weapon" grants an off-hand attack command (using this
   * item's own dice/range below); "shield" grants Shield Bash instead (this shield's own
   * dmgMul, 70% chance to stun for the target's next turn). Both show as the command menu's
   * first option, and both are blocked while the main hand holds a WeaponDef.twoHanded
   * weapon. */
  kind?: "weapon" | "shield";
  dice?: number;
  faces?: number;
  bonus?: number;
  minRange?: number;
  maxRange?: number;
  /** Shield Bash's damage multiplier for this specific shield — stronger shields close the
   * gap toward 1 (no penalty at all on the best ones), instead of one flat rate for every
   * shield. */
  dmgMul?: number;
}

export interface Forecast {
  attacker: string;
  defender: string;
  dmgOut: number;
  dmgBack: number;
  canCounter: boolean;
  critOut: boolean;
  kill: boolean;
}

export interface TerrainHover {
  id: TerrainId;
  name: string;
  def: number;
  atk: number;
  passable: boolean;
  hazard?: string;
  note?: string;
}

export interface HudSnapshot {
  phase: Phase;
  banner: string | null;
  selected: UnitPublic | null;
  hoveredUnit: UnitPublic | null;
  terrain: TerrainHover | null;
  mode: InputMode;
  canAttack: boolean;
  /** Selected unit has an unused offHand item and could still act — "weapon" for an
   * off-hand attack command, "shield" for Shield Bash, null when neither applies. */
  offHandKind: "weapon" | "shield" | null;
  canLockpick: boolean;
  forecast: Forecast | null;
  turn: number;
  objective: string;
  missionTitle: string;
  playerAlive: number;
  enemyAlive: number;
  busy: boolean;
  result: "victory" | "defeat" | null;
  winAvailable: boolean;
  zoom: number;
  speedMode: "normal" | "fast";
  tip: string | null;
  inspected: UnitPublic | null;
  pendingFoe: UnitPublic | null;
  spellReady: boolean;
  spellKind: SpellKind | null;
  /** This round's turn order (both sides mixed), lowest initiative first. */
  turnQueue: { id: string; name: string; side: Side; acted: boolean; active: boolean }[];
  /** Rolling combat log — attacks, spells, heals, kills, loot — newest last. */
  log: string[];
}

export interface WalkDirs {
  front: HTMLImageElement;
  back: HTMLImageElement;
  side: HTMLImageElement;
}

export interface GameArt {
  /** Every art variant for a terrain type, e.g. tiles.plains[0]/[1] — index 0 is the
   * default (what existing missions render with when a tile doesn't name a variant). */
  tiles: Record<TerrainId, HTMLImageElement[]>;
  /** Multi-hex decoration art, keyed by DecorationDef.id. */
  decorations: Record<string, HTMLImageElement>;
  sprites: Record<SpriteId, HTMLImageElement[]>;
  attacks: Partial<Record<SpriteId, HTMLImageElement[]>>;
  idles: Partial<Record<SpriteId, HTMLImageElement[]>>;
  walkDirs: Partial<Record<SpriteId, WalkDirs>>;
  impact: HTMLImageElement[];
}

export interface BattleUnitSnap {
  id: string;
  name: string;
  classId: ClassId;
  side: Side;
  x: number;
  y: number;
  hp: number;
  moved: boolean;
  facing: 1 | -1;
  alive: boolean;
  level: number;
  bag: Bag;
  spells: Spells;
}

export interface BattleSnapshot {
  missionId: string;
  turn: number;
  phase: Phase;
  units: BattleUnitSnap[];
}

export interface SaveData {
  version: number;
  completed: string[];
  unitHp: Record<string, number>;
  levels: Record<string, number>;
  xp: Record<string, number>;
  bags: Record<string, Bag>;
  /** Hero name → promoted ClassId chosen at PROMOTE_LEVEL. Unset until the player picks. */
  promotions: Record<string, ClassId>;
  /** Owned WeaponDef id → enhancement level (0..5). Presence in the map means it's owned. */
  weapons: Record<string, number>;
  /** Hero name → equipped WeaponDef id. */
  equipped: Record<string, string>;
  /** Hero name → slot → equipped EquipmentDef id. */
  equipment: Record<string, Partial<Record<EquipSlot, string>>>;
  /** Owned but unassigned EquipmentDef id → count — the party's shared gear stash. Loot
   * lands here first (never auto-equipped onto whoever found it); the player assigns it to
   * a hero from the Paperdoll picker, same as the weapon pool already works. */
  looseEquipment: Record<string, number>;
  /** Hero name → tier key → spell uses spent so far in the current scenario (a world-map
   * location's whole run of missions) — carried between missions within one location so
   * charges don't refill until that scenario ends. Cleared back to {} whenever a mission
   * starts a fresh scenario (see startBattle in GameApp.tsx); Stone Bridge always resets,
   * being the tutorial. */
  spellUses: Record<string, Partial<Record<TierKey, number>>>;
  ember: number;
  emberSeeded: boolean;
  muted: boolean;
  updatedAt: number;
  pendingMission: string | null;
}

export interface SaveBank {
  version: number;
  lastSlot: number;
  muted: boolean;
  slots: Array<SaveData | null>;
}

export interface GrowthLine {
  name: string;
  from: number;
  to: number;
  hpBattle: number;
  maxFrom: number;
  restHp: number;
  levelHp: number;
  hpCamp: number;
  maxTo: number;
  powerFrom: number;
  powerTo: number;
  powerKind: "AT" | "MAG";
  atkFrom: number;
  atkTo: number;
  magFrom: number;
  magTo: number;
  defFrom: number;
  defTo: number;
  resFrom: number;
  resTo: number;
  fallen: boolean;
  /** XP toward the next level at the end of the mission (0..EXP_TO_LEVEL-1). */
  xp: number;
  /** XP toward the level shown by `xp` at mission start — the ResultScreen's XP bar
   * animates from here up to `xp` rather than snapping straight to the final value. Only
   * meaningful (nonzero) when `to === from`; a level-up resets it to 0 since the bar is now
   * tracking progress in a different level than the one `xpFrom` would describe. */
  xpFrom: number;
}
