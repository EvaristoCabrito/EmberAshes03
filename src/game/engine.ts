import { CAUSTIC_VENOM, CHEST_LOOT, CLASSES, CLEAVE, CURE_DISEASE, CURES, DECORATIONS, DISEASE, DOUBLE_STRIKE, EMPTY_BAG, EQUIPMENT, EXP_TO_LEVEL, expForHit, FIREBALL, FOOTPRINT_TYPE_8, KILL_DROP_CHANCE, LIGHTNING, LONG_SHOT, MAGIC_MISSILE, MAX_LEVEL, PIERCING, PIERCING_THRUST, POTION_CARRY_MAX, POTIONS, SUMMON_FAMILIAR, SWEEP, TRIP, WEAPONS, WEB_OF_DREAMS, cureSpan, decorationCells, diceFormula, effectiveMaxRange, enemyLevelFor, fireballFormula, fireballOrigin, fireballPower, fireballRangeTiles, fireballTiles, hexAreaTiles, isProjectile, lightningDice, lightningFormula, missionGearLevel, parseLayout, potionLabel, rollCure, rollDice, rollPotion, spellTier, starterWeaponFor, STARTING_BAG, statsFor, terrainNote, TERRAIN, tierKey, tierUses, weightedLootPick, weightedPotionPick, weightedWeaponPick } from "./data";
import type { SpellTier } from "./data";
import { canCounter, makeForecast, mulberry32, rollDamage, rollDamageCustom } from "./combat";
import {
  attackableEnemies,
  canHitFrom,
  clearShot,
  computeReachable,
  computeThreat,
  cleaveHexes,
  cubeAdd,
  cubeRound,
  cubeToOddr,
  footprint,
  footprintFrontRow,
  hexNeighbors,
  hexDist,
  inBounds,
  inWeaponRange,
  key,
  manhattan,
  occupancy,
  occupies,
  oddrToCube,
  piercingLine,
  shotKind,
  allAxisRays,
  reconstructPath,
  terrainDistanceField,
  tileAt,
  unitSize,
  type ReachCell,
} from "./pathfinding";
import { sfxPlay } from "./audio";
import type {
  Bag,
  ClassId,
  DecorationPlacement,
  Forecast,
  GameArt,
  HealId,
  HudSnapshot,
  InputMode,
  Mission,
  Phase,
  Point,
  PotionId,
  SpellKind,
  TerrainId,
  TierKey,
  Unit,
  UnitPublic,
} from "./types";

interface Layout {
  ox: number;
  oy: number;
  tile: number;
  cols: number;
  rows: number;
}

interface Particle {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
  kind: "spark" | "text" | "impact";
  frame: number;
}

const PARTICLE_CAP = 32;
const ZOOM_RADII = [22, 34, 50, 72];

function blankParticle(): Particle {
  return {
    live: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 1,
    color: "#fff",
    kind: "spark",
    frame: 0,
  };
}

type Seq =
  | { type: "move"; id: string; path: Point[] }
  | {
      type: "combat";
      att: string;
      def: string;
      bonusDice?: number;
      bonusFlat?: number;
      noCounter?: boolean;
      spellKind?: SpellKind;
      /** Off-hand weapon attack: roll these dice instead of the attacker's main-hand
       * weapon. Only applied on the attacker's own strike, never on a counter. */
      customDice?: { dice: number; faces: number; bonus: number };
      /** Shield Bash: multiplies the attacker's own strike damage (e.g. 0.75). */
      dmgMul?: number;
      /** Shield Bash: chance (0-1) the strike, if it lands, stuns the defender for their
       * next turn. */
      stunChance?: number;
    }
  | { type: "spell"; att: string; tiles: Point[]; ids: string[]; dice?: number; faces?: number; bonus?: number; moreDice?: number; moreFaces?: number; label?: string; echo?: { dice: number; faces: number; bonus: number }; dmgMul?: number; weaponBonusDice?: number; weaponBonusFaces?: number; weaponBonusBonus?: number; spellKind?: SpellKind; centerId?: string; centerDice?: number; centerFaces?: number; centerBonus?: number; poison?: boolean }
  | { type: "heal"; att: string; def: string; kind: HealId }
  | { type: "cureDisease"; att: string; def: string }
  | { type: "banner"; text: string; dur: number }
  | { type: "delay"; dur: number }
  | { type: "checkEnd" };

interface MoveAnim {
  type: "move";
  id: string;
  path: Point[];
  i: number;
  t: number;
}

interface CombatAnim {
  type: "combat";
  att: string;
  def: string;
  stage: "lunge" | "hit" | "recover" | "counterLunge" | "counterHit" | "counterRecover" | "fade";
  t: number;
  swapped: boolean;
  bonusDice: number;
  bonusFlat: number;
  noCounter: boolean;
  spellKind: SpellKind | null;
  customDice: { dice: number; faces: number; bonus: number } | null;
  dmgMul: number;
  stunChance: number;
}

interface SpellAnim {
  type: "spell";
  att: string;
  tiles: Point[];
  ids: string[];
  t: number;
  hit: boolean;
  extraDice: number;
  extraFaces: number;
  extraBonus: number;
  moreDice: number;
  moreFaces: number;
  echo: { dice: number; faces: number; bonus: number } | null;
  dmgMul: number;
  weaponBonusDice: number;
  weaponBonusFaces: number;
  weaponBonusBonus: number;
  spellKind: SpellKind | null;
  /** Caustic Venom: the one unit in `ids` that takes the bigger centerDice/Faces/Bonus roll
   * instead of the regular extraDice/Faces/Bonus splash roll — null for every other spell. */
  centerId: string | null;
  centerDice: number;
  centerFaces: number;
  centerBonus: number;
  /** Whether landing a hit also poisons the target (see startOfTurnEffects) — both sides,
   * Caustic Venom's splash spares no one. */
  poison: boolean;
}

interface HealAnim {
  type: "heal";
  att: string;
  def: string;
  kind: HealId;
  t: number;
  applied: boolean;
}

interface CureDiseaseAnim {
  type: "cureDisease";
  att: string;
  def: string;
  t: number;
  applied: boolean;
}

type Active =
  | MoveAnim
  | CombatAnim
  | SpellAnim
  | HealAnim
  | CureDiseaseAnim
  | { type: "banner"; text: string; t: number; dur: number }
  | { type: "delay"; t: number; dur: number };

function pub(u: Unit, restrained: boolean): UnitPublic {
  return {
    id: u.id,
    name: u.name,
    classId: u.classId,
    className: u.className,
    role: u.role,
    side: u.side,
    sprite: u.sprite,
    hp: u.hp,
    maxHp: u.maxHp,
    atk: u.atk,
    mag: u.mag,
    def: u.def,
    res: u.res,
    mov: u.mov,
    minRange: u.minRange,
    maxRange: u.maxRange,
    moved: u.moved,
    acted: u.acted,
    x: u.x,
    y: u.y,
    level: u.level,
    xp: u.xp,
    bag: { ...u.bag },
    spells: { ...u.spells },
    weaponId: u.weaponId,
    weaponEnh: u.weaponEnh,
    size: u.size,
    diseased: u.diseased,
    poisoned: u.poisoned,
    stunned: u.stunned,
    crippled: u.crippled,
    offHandId: u.offHandId,
    summoned: u.summoned,
    asleep: u.asleep,
    restrained,
  };
}

interface Roster {
  hp: Record<string, number>;
  levels: Record<string, number>;
  xp?: Record<string, number>;
  bags?: Record<string, Bag>;
  /** Hero name → promoted ClassId chosen at PROMOTE_LEVEL, overriding the mission spawn's base class. */
  promotions?: Record<string, ClassId>;
  /** Hero name → equipped weapon + enhancement, resolved from save.equipped/save.weapons. Falls
   * back to that class's free starter weapon when a hero has no entry yet. */
  weapons?: Record<string, { id: string; enh: number }>;
  /** Hero name → equipped offHand EquipmentDef id (shield or off-hand weapon), resolved
   * from save.equipment[hero].offHand. */
  offHand?: Record<string, string>;
  /** Enemy name → level override, for Map Editor balance-testing. Falls back to the
   * mission's uniform enemyLevelFor(index) when a name has no entry. */
  enemyLevels?: Record<string, number>;
  /** Every weapon id already in the player's save — chest and kill-drop loot rolls exclude
   * these so a drop never announces a weapon the player already has. */
  ownedWeaponIds?: string[];
  /** Hero name → tier key → spell uses already spent so far this scenario (a world-map
   * location's whole run of missions) — carried in from the previous mission(s) so spell
   * charges don't refill until the scenario ends, per direct instruction. Undefined/omitted
   * means "reset to full," used for a scenario's first mission and for Stone Bridge, which
   * always resets (it's the tutorial). See GameApp.tsx's startBattle for who computes this. */
  spellSpent?: Record<string, Partial<Record<TierKey, number>>>;
}

/** Remaining uses for one spell tier at spawn — the class/level cap minus whatever the
 * roster says this hero already spent so far this scenario (see Roster.spellSpent), never
 * below 0. Always 0 for enemies, matching the previous unconditional side-check inline. */
function remainingTier(classId: ClassId, tier: SpellTier, key: TierKey, level: number, side: Unit["side"], roster: Roster | undefined, name: string): number {
  if (side !== "player") return 0;
  const cap = tierUses(classId, tier, level);
  const spent = roster?.spellSpent?.[name]?.[key] ?? 0;
  return Math.max(0, cap - spent);
}

function spawnUnit(spawn: Mission["playerSpawns"][number], side: Unit["side"], i: number, roster?: Roster, enemyLevel = 1): Unit {
  const classId = (side === "player" ? roster?.promotions?.[spawn.name] : undefined) ?? spawn.classId;
  const cls = CLASSES[classId];
  const level = side === "enemy" ? (roster?.enemyLevels?.[spawn.name] ?? enemyLevel) : (roster?.levels[spawn.name] ?? 1);
  const st = statsFor(classId, level);
  const hpCap = roster?.hp[spawn.name];
  const hp = hpCap != null && hpCap > 0 ? Math.min(st.hp, hpCap) : st.hp;
  const weapon = side === "player" ? (roster?.weapons?.[spawn.name] ?? { id: starterWeaponFor(classId), enh: 0 }) : null;
  // Range is a weapon property (D&D-weapon-style), not a class stat — falls back to the
  // class baseline only when there's no equipped weapon to read it from (e.g. enemies).
  const weaponDef = weapon?.id ? WEAPONS[weapon.id] : null;
  const minRange = weaponDef?.minRange ?? st.minRange;
  const maxRange = weaponDef?.maxRange ?? st.maxRange;
  // A two-handed main-hand weapon leaves no free hand for an off-hand item, regardless of
  // what's saved in equipment — enforced here too, not just at the equip screen.
  const offHandId = side === "player" && !weaponDef?.twoHanded ? (roster?.offHand?.[spawn.name] ?? null) : null;
  return {
    id: `${side}-${spawn.name}-${i}`,
    name: spawn.name,
    classId: cls.id,
    className: cls.name,
    role: cls.role,
    side,
    sprite: cls.sprite,
    x: spawn.x,
    y: spawn.y,
    hp,
    maxHp: st.hp,
    atk: st.atk,
    mag: st.mag,
    def: st.def,
    res: st.res,
    mov: st.mov,
    minRange,
    maxRange,
    moved: false,
    acted: false,
    facing: side === "player" ? 1 : -1,
    walkPose: "front",
    alive: true,
    drawX: spawn.x,
    drawY: spawn.y,
    flash: 0,
    fade: 1,
    bob: 0,
    level,
    xp: side === "player" ? (roster?.xp?.[spawn.name] ?? 0) : 0,
    bag: side === "player" ? { ...(roster?.bags?.[spawn.name] ?? (cls.id === "healer" ? EMPTY_BAG : STARTING_BAG)) } : { ...EMPTY_BAG },
    spells: {
      tier1: remainingTier(cls.id, 1, "tier1", level, side, roster, spawn.name),
      tier2: remainingTier(cls.id, 2, "tier2", level, side, roster, spawn.name),
      tier3: remainingTier(cls.id, 3, "tier3", level, side, roster, spawn.name),
      tier4: remainingTier(cls.id, 4, "tier4", level, side, roster, spawn.name),
      tier5: remainingTier(cls.id, 5, "tier5", level, side, roster, spawn.name),
      tier6: remainingTier(cls.id, 6, "tier6", level, side, roster, spawn.name),
      tier7: remainingTier(cls.id, 7, "tier7", level, side, roster, spawn.name),
      tier8: remainingTier(cls.id, 8, "tier8", level, side, roster, spawn.name),
      tier9: remainingTier(cls.id, 9, "tier9", level, side, roster, spawn.name),
      tier10: remainingTier(cls.id, 10, "tier10", level, side, roster, spawn.name),
    },
    weaponId: weapon?.id ?? null,
    weaponEnh: weapon?.enh ?? 0,
    size: cls.size,
    footprintW: cls.footprintW,
    footprintH: cls.footprintH,
    footprintOffsets: cls.footprintOffsets,
    shock: null,
    diseased: false,
    diseaseBase: null,
    poisoned: false,
    stunned: false,
    stunTurns: 0,
    crippled: false,
    offHandId,
    summoned: false,
    asleep: false,
    sleepTurns: 0,
    guaranteedDrop: side === "enemy" && !!spawn.guaranteedDrop,
    moveBudgetUsed: 0,
  };
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export class BattleEngine {
  readonly mission: Mission;
  readonly tiles: TerrainId[];
  /** Art variant index per tile, same indexing as tiles. Undefined/missing = variant 0. */
  readonly tileVariants: number[];
  readonly decorations: DecorationPlacement[];
  readonly cols: number;
  readonly rows: number;
  units: Unit[] = [];
  art: GameArt;
  phase: Phase = "player";
  mode: InputMode = "locked";
  turn = 1;
  selectedId: string | null = null;
  inspectedId: string | null = null;
  pendingFoeId: string | null = null;
  threat: Point[] = [];
  cursor: Point = { x: 0, y: 0 };
  reach: Map<string, ReachCell> = new Map();
  attackFrom: Map<string, Point> = new Map();
  /** Active Web of Dreams patches (Conjurer tier 2) — cast, not terrain, so they live here
   * rather than on the map. Ticks down by one every startNewRound and is dropped at 0. */
  webZones: { cells: Set<string>; roundsLeft: number }[] = [];
  /** Whether the unit whose turn is currently active was standing in a web zone at the
   * START of that turn — decided once in beginUnitTurn and left alone for the rest of it
   * (see effectiveUnitForReach). */
  private turnRestrained = false;
  /** All alive units for this round, sorted by CLASSES[classId].init (lower first, ties favor the player). */
  private turnOrder: string[] = [];
  /** id of the unit whose turn we've already dispatched — lets the tick loop react only on change. */
  private activeUnitId: string | null = null;
  orig: Point | null = null;
  hover: Point | null = null;
  private lastClickAt = 0;
  private lastClickCell: Point | null = null;
  result: "victory" | "defeat" | null = null;
  /** True once every enemy the win condition cares about is dead — the battle CAN end, but
   * doesn't until the player confirms (see confirmFinish). Lets them keep playing to loot
   * remaining chests, and flips back to false on its own if a trap/trigger spawns a fresh
   * enemy after the field first looked clear. */
  winAvailable = false;
  banner: string | null = null;
  /** Ember found in chests opened mid-battle; folded into the save's Ember total on victory. */
  lootEmber = 0;
  /** Weapon ids found in chests or off an enemy kill mid-battle; folded into the save's
   * weapon stash on victory. */
  lootWeapons: string[] = [];
  /** EquipmentDef ids found in chests mid-battle; folded into the save's shared gear stash
   * on victory (save.looseEquipment) — never auto-equipped onto whoever opened the chest,
   * the player assigns it to a hero afterward from the Paperdoll picker. */
  lootEquipment: string[] = [];
  /** Every weapon id the player already owns, plus anything granted mid-battle the moment
   * it's granted — checked before every loot roll so a chest or kill drop never announces
   * a weapon the player already has (it used to: the roll didn't know about ownership at
   * all, so a "found" weapon could silently vanish once persistVictory deduped it against
   * the save, with nothing to show for the mid-battle "you found X" message). */
  private ownedWeapons: Set<string>;
  /** Rolling combat log — attacks, spells, heals, kills, and loot, newest last. Capped so
   * a long battle doesn't grow it without bound; read via getHud() for the in-battle log
   * view. */
  log: string[] = [];
  tip: string | null;
  private lastTipSeen: string | null = null;
  private tipSetAt = 0;
  time = 0;
  trauma = 0;
  hitstop = 0;
  zoom = 1;
  /** How long a unit takes to glide across one hex — "normal" is the default, readable
   * pace; "fast" is the old, snappier speed for players who prefer it. Toggled from the
   * pause menu, applies to the very next step (mid-step changes aren't jarring since a
   * step is at most a quarter second). */
  speedMode: "normal" | "fast" = "normal";
  camX = 0;
  camY = 0;
  private viewW = 1;
  private viewH = 1;
  private camReady = false;
  private queue: Seq[] = [];
  private active: Active | null = null;
  private particles: Particle[] = Array.from({ length: PARTICLE_CAP }, blankParticle);
  private particleLive = 0;
  private onNextIdle: (() => void) | null = null;
  private rng: () => number;
  private listeners = new Set<() => void>();
  private reducedMotion = false;
  private layout: Layout = { ox: 0, oy: 0, tile: 48, cols: 8, rows: 7 };
  private spellArmed = false;
  private spellAim: Point | null = null;
  private spellKind: SpellKind | null = null;

  constructor(mission: Mission, art: GameArt, roster: Roster, seed = 1) {
    this.mission = mission;
    this.art = art;
    this.ownedWeapons = new Set(roster.ownedWeaponIds ?? []);
    this.cols = mission.cols;
    this.rows = mission.rows;
    this.tiles = parseLayout(mission.layout);
    this.tileVariants = mission.tileVariants ?? [];
    this.decorations = mission.decorations ?? [];
    // Every hex a decoration's footprint covers is impassable and blocks line of sight,
    // regardless of the terrain painted under it — "column" already has exactly those
    // properties, so reusing it here needs no new passability/LOS plumbing anywhere else.
    for (const cellKey of decorationCells(this.decorations)) {
      const [xs, ys] = cellKey.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) this.tiles[y * this.cols + x] = "column";
    }
    this.rng = mulberry32(seed + mission.index * 97);
    this.units = [
      ...mission.playerSpawns.map((s, i) => spawnUnit(s, "player", i, roster)),
      ...mission.enemySpawns.map((s, i) => spawnUnit(s, "enemy", i, roster, enemyLevelFor(mission.index))),
    ];
    for (const u of this.units) {
      this.nudgeOffHazard(u);
      u.bob = this.rng() * 16;
    }
    this.turnOrder = this.sortByInitiative(this.units.filter((u) => u.alive));
    const first = this.units.find((u) => u.side === "player");
    if (first) this.cursor = { x: first.x, y: first.y };
    this.tip =
      mission.index === 0
        ? "Toque numa aliada para mover. Toque num inimigo para ver HP e alcance."
        : mission.win === "boss"
          ? "Objetivo: o capitão. Toque nele para ver a área de perigo."
          : "Toque num inimigo para ver HP, alcance e onde ele pode atacar.";
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.reducedMotion = true;
    }
  }

  /** Sorts by CLASSES[classId].init ascending; equal init favors the player side. */
  private sortByInitiative(units: Unit[]): string[] {
    return [...units]
      .sort((a, b) => {
        const ia = CLASSES[a.classId].init ?? 999;
        const ib = CLASSES[b.classId].init ?? 999;
        if (ia !== ib) return ia - ib;
        if (a.side !== b.side) return a.side === "player" ? -1 : 1;
        return 0;
      })
      .map((u) => u.id);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  getHud(): HudSnapshot {
    const selected = this.units.find((u) => u.id === this.selectedId) ?? null;
    const hoverCell = this.hover ?? this.cursor;
    const hoverUnit = hoverCell
      ? this.units.find((u) => u.alive && occupies(u, hoverCell.x, hoverCell.y))
      : undefined;
    const terr = hoverCell ? TERRAIN[tileAt(this.tiles, this.cols, hoverCell.x, hoverCell.y)] : null;
    const inspected = this.units.find((u) => u.id === this.inspectedId) ?? null;
    const pendingFoe = this.units.find((u) => u.id === this.pendingFoeId) ?? null;
    const foeForForecast = pendingFoe ?? (inspected && inspected.side === "enemy" ? inspected : null);
    let forecast: Forecast | null = null;
    if (selected && foeForForecast && selected.side === "player") {
      const from = this.attackFrom.get(foeForForecast.id);
      const fx = from?.x ?? selected.x;
      const fy = from?.y ?? selected.y;
      const fake = { ...selected, x: fx, y: fy };
      forecast = makeForecast(
        fake,
        foeForForecast,
        tileAt(this.tiles, this.cols, fx, fy),
        tileAt(this.tiles, this.cols, foeForForecast.x, foeForForecast.y),
        this.tiles,
        this.cols,
      );
    }
    const canAttack =
      !!selected &&
      !selected.acted &&
      (this.attackFrom.size > 0 ||
        this.units.some((u) => u.alive && u.side !== selected.side && canHitFrom(selected, selected, u, this.tiles, this.cols)));
    const canLockpick = !!selected && !selected.acted && selected.bag.lockpick > 0 && !!this.adjacentLock(selected);
    const offHandKind: "weapon" | "shield" | null =
      selected && !selected.acted && selected.offHandId ? (EQUIPMENT[selected.offHandId]?.kind ?? null) : null;
    return {
      phase: this.phase,
      banner: this.banner,
      selected: selected ? pub(selected, this.isWebCell(selected.x, selected.y)) : null,
      hoveredUnit: hoverUnit ? pub(hoverUnit, this.isWebCell(hoverUnit.x, hoverUnit.y)) : null,
      terrain: terr
        ? {
            id: terr.id,
            name: terr.name,
            def: terr.def,
            atk: terr.atk,
            passable: terr.passable,
            hazard: terr.hazardDice ? `${terr.hazardDice}d${terr.hazardFaces ?? 8}` : undefined,
            note: terrainNote(terr.id),
          }
        : null,
      mode: this.mode,
      canAttack,
      offHandKind,
      canLockpick,
      forecast,
      turn: this.turn,
      objective: this.mission.objective,
      missionTitle: this.mission.title,
      playerAlive: this.units.filter((u) => u.side === "player" && u.alive && !u.summoned).length,
      enemyAlive: this.units.filter((u) => u.side === "enemy" && u.alive).length,
      busy: this.mode === "locked" || !!this.active || this.queue.length > 0,
      result: this.result,
      winAvailable: this.winAvailable,
      zoom: this.zoom,
      speedMode: this.speedMode,
      tip: this.tip,
      inspected: inspected
        ? pub(inspected, this.isWebCell(inspected.x, inspected.y))
        : pendingFoe
          ? pub(pendingFoe, this.isWebCell(pendingFoe.x, pendingFoe.y))
          : null,
      pendingFoe: pendingFoe ? pub(pendingFoe, this.isWebCell(pendingFoe.x, pendingFoe.y)) : null,
      spellReady:
        this.mode === "awaitSpell" &&
        !!selected &&
        !!this.hover &&
        this.spellAimValid(selected, this.hover),
      spellKind: this.mode === "awaitSpell" ? this.spellKind : null,
      turnQueue: (() => {
        const active = this.activeTurnUnit();
        return this.turnOrder
          .map((id) => this.units.find((u) => u.id === id))
          .filter((u): u is Unit => !!u && u.alive)
          .map((u) => ({ id: u.id, name: u.name, side: u.side, acted: u.moved, active: u.id === active?.id }));
      })(),
      log: this.log,
    };
  }

  battlePlayerHp(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const u of this.units) {
      if (u.side !== "player") continue;
      out[u.name] = u.alive ? u.hp : 0;
    }
    return out;
  }

  remainingPlayerHp(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const u of this.units) {
      if (u.side !== "player") continue;
      if (!u.alive) out[u.name] = Math.max(1, Math.ceil(u.maxHp * 0.5));
      else out[u.name] = Math.min(u.maxHp, u.hp + Math.ceil((u.maxHp - u.hp) * 0.5));
    }
    return out;
  }

  remainingBags(): Record<string, Bag> {
    const out: Record<string, Bag> = {};
    for (const u of this.units) {
      if (u.side !== "player") continue;
      out[u.name] = { ...u.bag };
    }
    return out;
  }

  /** Hands a found potion to `starter` (the one who opened the chest), or — if their bag for
   * that kind is already full — to the next alive party member in line with room. Returns
   * false only if the whole party is capped out on that potion, so the drop is lost. */
  private givePotion(starter: Unit, kind: PotionId): boolean {
    const cap = POTION_CARRY_MAX[kind];
    const order = [starter, ...this.units.filter((x) => x !== starter)];
    for (const target of order) {
      if (target.side !== "player" || !target.alive) continue;
      const have = target.bag[kind] ?? 0;
      if (have < cap) {
        target.bag[kind] = have + 1;
        return true;
      }
    }
    return false;
  }

  /** Hero name → tier key → spell uses spent so far this scenario, for persisting into
   * save.spellUses (see Roster.spellSpent) — recomputed as the current class/level cap
   * minus whatever's left, so a level-up mid-battle naturally reflects the bigger cap
   * instead of needing its own bookkeeping. */
  spentTiers(): Record<string, Partial<Record<TierKey, number>>> {
    const out: Record<string, Partial<Record<TierKey, number>>> = {};
    for (const u of this.units) {
      if (u.side !== "player") continue;
      const perTier: Partial<Record<TierKey, number>> = {};
      for (let t = 1; t <= 10; t++) {
        const key = tierKey(t as SpellTier);
        const cap = tierUses(u.classId, t as SpellTier, u.level);
        perTier[key] = Math.max(0, cap - u.spells[key]);
      }
      out[u.name] = perTier;
    }
    return out;
  }

  tick(dt: number): void {
    const cap = Math.min(0.05, dt);
    this.time += cap;
    if (this.tip !== this.lastTipSeen) {
      this.lastTipSeen = this.tip;
      this.tipSetAt = this.time;
    } else if (this.tip !== null && this.time - this.tipSetAt >= 5) {
      this.tip = null;
      this.lastTipSeen = null;
    }
    if (this.onNextIdle && !this.active && this.queue.length === 0) {
      const fn = this.onNextIdle;
      this.onNextIdle = null;
      fn();
    }
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - cap * 2.2);
    for (const u of this.units) {
      if (u.flash > 0) u.flash = Math.max(0, u.flash - cap * 4);
      if (!u.alive && u.fade > 0) u.fade = Math.max(0, u.fade - cap * 2.4);
      if (u.alive) {
        const haste =
          u.classId === "wardog" ? 1.4 : u.size >= 4 ? 0.58 : u.classId === "mage" || u.classId === "cultist" ? 0.8 : 1;
        u.bob += cap * haste;
      }
    }
    if (this.particleLive) {
      let live = 0;
      for (const p of this.particles) {
        if (!p.live) continue;
        p.life += cap;
        if (p.life >= p.max) {
          p.live = false;
          continue;
        }
        p.x += p.vx * cap;
        p.y += p.vy * cap;
        if (p.kind === "impact") p.frame += cap * 12;
        live += 1;
      }
      this.particleLive = live;
    }
    if (this.hitstop > 0) {
      this.hitstop -= cap;
      this.emit();
      return;
    }
    if (!this.active && this.queue.length) this.startSeq(this.queue.shift()!);
    if (this.active) this.stepActive(cap);
    if (!this.result && !this.active && this.queue.length === 0) {
      const active = this.activeTurnUnit();
      const activeId = active?.id ?? null;
      if (activeId !== this.activeUnitId) {
        this.activeUnitId = activeId;
        if (active) this.beginUnitTurn(active);
        else this.startNewRound();
      }
    }
    this.emit();
  }

  private startSeq(step: Seq): void {
    if (step.type === "move") {
      this.active = { type: "move", id: step.id, path: step.path, i: 0, t: 0 };
      sfxPlay.move();
    } else if (step.type === "combat") {
      const target = this.units.find((u) => u.id === step.def);
      if (!target || !target.alive) return;
      this.active = {
        type: "combat",
        att: step.att,
        def: step.def,
        stage: "lunge",
        t: 0,
        swapped: false,
        bonusDice: step.bonusDice ?? 0,
        bonusFlat: step.bonusFlat ?? 0,
        noCounter: step.noCounter ?? false,
        spellKind: step.spellKind ?? null,
        customDice: step.customDice ?? null,
        dmgMul: step.dmgMul ?? 1,
        stunChance: step.stunChance ?? 0,
      };
    } else if (step.type === "spell") {
      this.active = {
        type: "spell",
        att: step.att,
        tiles: step.tiles,
        ids: step.ids,
        t: 0,
        hit: false,
        extraDice: step.dice ?? 0,
        extraFaces: step.faces ?? 8,
        extraBonus: step.bonus ?? 0,
        moreDice: step.moreDice ?? 0,
        moreFaces: step.moreFaces ?? 6,
        echo: step.echo ?? null,
        dmgMul: step.dmgMul ?? 1,
        weaponBonusDice: step.weaponBonusDice ?? 0,
        weaponBonusFaces: step.weaponBonusFaces ?? 8,
        weaponBonusBonus: step.weaponBonusBonus ?? 0,
        spellKind: step.spellKind ?? null,
        centerId: step.centerId ?? null,
        centerDice: step.centerDice ?? 0,
        centerFaces: step.centerFaces ?? 8,
        centerBonus: step.centerBonus ?? 0,
        poison: step.poison ?? false,
      };
      this.banner = step.label ?? "";
      sfxPlay.crit();
    } else if (step.type === "heal") {
      this.active = { type: "heal", att: step.att, def: step.def, kind: step.kind, t: 0, applied: false };
      this.banner = CURES[step.kind].name;
      sfxPlay.ui();
    } else if (step.type === "cureDisease") {
      this.active = { type: "cureDisease", att: step.att, def: step.def, t: 0, applied: false };
      this.banner = CURE_DISEASE.name;
      sfxPlay.ui();
    } else if (step.type === "banner") {
      this.banner = step.text;
      this.active = { type: "banner", text: step.text, t: 0, dur: step.dur };
      sfxPlay.turn();
    } else if (step.type === "delay") {
      this.active = { type: "delay", t: 0, dur: step.dur };
    } else if (step.type === "checkEnd") {
      this.evaluateEnd();
    }
  }

  private stepActive(dt: number): void {
    const a = this.active;
    if (!a) return;
    if (a.type === "delay" || a.type === "banner") {
      a.t += dt;
      if (a.type === "banner" && a.t >= a.dur) this.banner = null;
      if (a.t >= a.dur) {
        this.active = null;
        if (a.type === "banner" && a.text === "Fase do jogador") this.mode = "idle";
      }
      return;
    }
    if (a.type === "move") {
      const unit = this.units.find((u) => u.id === a.id);
      if (!unit || a.path.length < 2) {
        this.active = null;
        return;
      }
      const from = a.path[a.i]!;
      const to = a.path[a.i + 1];
      if (!to) {
        unit.x = from.x;
        unit.y = from.y;
        unit.drawX = from.x;
        unit.drawY = from.y;
        this.active = null;
        return;
      }
      if (to.x !== from.x) unit.facing = to.x > from.x ? 1 : -1;
      unit.walkPose = to.y < from.y ? "back" : to.y > from.y ? "front" : "side";
      a.t += dt;
      const dur = this.speedMode === "fast" ? 0.12 : 0.22;
      const k = easeOut(Math.min(1, a.t / dur));
      unit.drawX = from.x + (to.x - from.x) * k;
      unit.drawY = from.y + (to.y - from.y) * k;
      if (a.t >= dur) {
        a.i += 1;
        a.t = 0;
        unit.x = to.x;
        unit.y = to.y;
        unit.drawX = to.x;
        unit.drawY = to.y;
        this.ensureVisible(unit.x, unit.y);
        this.smashBarricades(unit);
        this.applyTileHazard(unit, to);
        if (!unit.alive) {
          this.active = null;
          this.selectedId = null;
          this.pendingFoeId = null;
          this.evaluateEnd();
          if (!this.result && this.phase === "player") this.mode = "idle";
        }
      }
      return;
    }
    if (a.type === "combat") this.stepCombat(a, dt);
    if (a.type === "spell") this.stepSpell(a, dt);
    if (a.type === "heal") this.stepHeal(a, dt);
    if (a.type === "cureDisease") this.stepCureDisease(a, dt);
  }

  private stepCombat(a: CombatAnim, dt: number): void {
    const att = this.units.find((u) => u.id === a.att);
    const def = this.units.find((u) => u.id === a.def);
    if (!att || !def) {
      this.active = null;
      return;
    }
    a.t += dt;
    const lunge = 0.2;
    if (a.stage === "lunge" || a.stage === "counterLunge") {
      const actor = a.stage === "lunge" ? att : def;
      const target = a.stage === "lunge" ? def : att;
      const k = Math.min(1, a.t / lunge);
      actor.drawX = actor.x + (target.x - actor.x) * 0.28 * k;
      actor.drawY = actor.y + (target.y - actor.y) * 0.28 * k;
      if (a.t >= lunge) {
        a.t = 0;
        a.stage = a.stage === "lunge" ? "hit" : "counterHit";
      }
      return;
    }
    if (a.stage === "hit" || a.stage === "counterHit") {
      if (a.t < 0.02) {
        const actor = a.stage === "hit" ? att : def;
        const target = a.stage === "hit" ? def : att;
        const attTile = tileAt(this.tiles, this.cols, actor.x, actor.y);
        const defTile = tileAt(this.tiles, this.cols, target.x, target.y);
        // customDice/dmgMul/stunChance are the attacker's own strike (off-hand weapon or
        // Shield Bash) — never applied to the defender's counter, which always uses their
        // real equipped weapon at full strength.
        const hit =
          a.stage === "hit" && a.customDice
            ? rollDamageCustom(actor, target, attTile, defTile, a.customDice.dice, a.customDice.faces, a.customDice.bonus, this.rng)
            : rollDamage(actor, target, attTile, defTile, this.rng);
        if (a.stage === "hit" && a.bonusDice > 0) {
          hit.dmg += rollDice(1, a.bonusDice, a.bonusFlat, this.rng);
        }
        if (a.stage === "hit" && a.dmgMul !== 1) {
          hit.dmg = Math.max(1, Math.floor(hit.dmg * a.dmgMul));
        }
        if (a.stage === "hit" && a.stunChance > 0 && this.rng() < a.stunChance) {
          target.stunned = true;
          target.stunTurns = 1;
          sfxPlay.stun();
        }
        if (target.asleep) {
          hit.dmg = Math.max(1, Math.round(hit.dmg * (1 + WEB_OF_DREAMS.sleepBonusDamage)));
          target.asleep = false;
          target.sleepTurns = 0;
        }
        target.hp = Math.max(0, target.hp - hit.dmg);
        target.flash = 1;
        // Only the original attacker's own strike earns XP — a successful counter deals
        // damage but grants none, or a unit that gets ganged up on levels for free just by
        // standing there and countering every hit.
        if (target.side !== actor.side && a.stage === "hit") {
          // Long Shot finishing the target off also doubles the kill's XP, same as a
          // non-AoE Mage/Conjurer spell kill (see stepSpell).
          const killBonus = target.hp <= 0 && a.spellKind === "longShot" ? 2 : 1;
          this.gainExp(actor, target.level, hit.dmg, killBonus);
        }
        this.spawnHit(target, hit.dmg, hit.crit);
        this.pushLog(`${actor.name} atacou ${target.name}: ${hit.dmg} dano${hit.crit ? " (crítico)" : ""}`);
        if (target.hp <= 0) {
          this.markDead(target);
        } else {
          sfxPlay.hit();
          if (a.stage === "hit") this.maybeInflictDisease(actor, target);
          if (a.stage === "hit" && a.spellKind === "trip") {
            target.stunned = true;
            target.stunTurns = TRIP.stunRounds;
            if (!target.crippled) {
              target.crippled = true;
              const keep = 1 - TRIP.statPenalty;
              target.atk = Math.round(target.atk * keep);
              target.mag = Math.round(target.mag * keep);
              target.def = Math.round(target.def * keep);
              target.res = Math.round(target.res * keep);
              target.mov = Math.max(1, Math.round(target.mov * keep));
            }
            sfxPlay.trip();
          }
        }
        if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.28);
        this.hitstop = 0.06;
      }
      if (a.t >= 0.18) {
        a.t = 0;
        a.stage = a.stage === "hit" ? "recover" : "counterRecover";
      }
      return;
    }
    if (a.stage === "recover" || a.stage === "counterRecover") {
      const actor = a.stage === "recover" ? att : def;
      const k = Math.min(1, a.t / 0.16);
      actor.drawX = actor.drawX + (actor.x - actor.drawX) * k;
      actor.drawY = actor.drawY + (actor.y - actor.drawY) * k;
      if (a.t >= 0.16) {
        actor.drawX = actor.x;
        actor.drawY = actor.y;
        a.t = 0;
        if (a.stage === "recover") {
          if (!a.noCounter && !def.stunned && def.alive && canCounter(att, def, { x: att.x, y: att.y }, this.tiles, this.cols)) a.stage = "counterLunge";
          else if (!def.alive) a.stage = "fade";
          else this.finishCombat(att);
        } else if (!att.alive) a.stage = "fade";
        else this.finishCombat(att);
      }
      return;
    }
    if (a.stage === "fade") {
      for (const u of this.units) {
        if (!u.alive && u.fade > 0) u.fade = Math.max(0, u.fade - dt * 2.4);
      }
      if (a.t >= 0.4) this.finishCombat(att);
    }
  }

  private stepSpell(a: SpellAnim, dt: number): void {
    const att = this.units.find((u) => u.id === a.att);
    if (!att) {
      this.active = null;
      return;
    }
    a.t += dt;
    if (!a.hit && a.t >= 0.18) {
      a.hit = true;
      sfxPlay.spell();
      // AoE/line spells: the first enemy actually hit grants full XP, every enemy after
      // that in the same cast grants half — hitting a whole group shouldn't out-earn
      // picking them off one at a time, but the first one still counts fully.
      let firstAoeEnemyHit = true;
      // Piercing Thrust: front-to-back falloff along the line — the first body it hits eats
      // the full hit, everyone skewered behind them takes half.
      let thrustHitIndex = 0;
      for (const id of a.ids) {
        const foe = this.units.find((u) => u.id === id && u.alive);
        if (!foe) continue;
        const defTile = TERRAIN[tileAt(this.tiles, this.cols, foe.x, foe.y)];
        if (defTile.id === "barricade") {
          this.emitParticle({
            x: foe.drawX,
            y: foe.drawY - 0.35,
            vx: 0,
            vy: -0.18,
            life: 0,
            max: 1.6,
            size: 1,
            color: "#e0b48a",
            text: "bloqueado",
            kind: "text",
            frame: 0,
          });
          continue;
        }
        let dmg: number;
        let crit = false;
        if (a.centerId && foe.id === a.centerId) {
          const attTile = TERRAIN[tileAt(this.tiles, this.cols, att.x, att.y)];
          const defTile = TERRAIN[tileAt(this.tiles, this.cols, foe.x, foe.y)];
          dmg = rollDice(a.centerDice, a.centerFaces, a.centerBonus, this.rng);
          dmg = Math.max(1, dmg - foe.res + attTile.atk - (defTile.cover ?? 0));
        } else if (a.extraDice > 0) {
          const attTile = TERRAIN[tileAt(this.tiles, this.cols, att.x, att.y)];
          const defTile = TERRAIN[tileAt(this.tiles, this.cols, foe.x, foe.y)];
          dmg = rollDice(a.extraDice, a.extraFaces, a.extraBonus, this.rng);
          if (a.moreDice > 0) dmg += rollDice(a.moreDice, a.moreFaces, 0, this.rng);
          dmg = Math.max(1, dmg - foe.res + attTile.atk - (defTile.cover ?? 0));
        } else if (a.spellKind === "piercingThrust") {
          // Armor-piercing: the defender's DEF is treated as 20% lower for this hit only.
          const softened = { ...foe, def: Math.max(0, Math.floor(foe.def * (1 - PIERCING_THRUST.armorIgnore))) };
          const hit = rollDamage(
            att,
            softened,
            tileAt(this.tiles, this.cols, att.x, att.y),
            tileAt(this.tiles, this.cols, foe.x, foe.y),
            this.rng,
          );
          dmg = thrustHitIndex === 0 ? hit.dmg : Math.max(1, Math.floor(hit.dmg * 0.5));
          crit = hit.crit;
          thrustHitIndex++;
        } else {
          const hit = rollDamage(
            att,
            foe,
            tileAt(this.tiles, this.cols, att.x, att.y),
            tileAt(this.tiles, this.cols, foe.x, foe.y),
            this.rng,
          );
          dmg = hit.dmg;
          crit = hit.crit;
          if (a.weaponBonusDice > 0) dmg += rollDice(a.weaponBonusDice, a.weaponBonusFaces, a.weaponBonusBonus, this.rng);
        }
        if (a.dmgMul > 1) dmg = Math.max(1, dmg * a.dmgMul);
        if (foe.asleep) {
          dmg = Math.max(1, Math.round(dmg * (1 + WEB_OF_DREAMS.sleepBonusDamage)));
          foe.asleep = false;
          foe.sleepTurns = 0;
        }
        foe.hp = Math.max(0, foe.hp - dmg);
        foe.flash = 1;
        if (a.poison) foe.poisoned = true;
        // AoE/line abilities (fireball, cleave, piercing...) run this once per unit actually
        // hit, so every landed hit grants its own XP — piercing can also clip an ally in the
        // line, which must never grant XP.
        if (foe.side !== att.side) {
          // Black Mage / Conjurer finishing an enemy off with one of their own single-target
          // spells (Magic Missile, Lightning) doubles the XP from that kill — never for AoE/line
          // spells, where only the first enemy hit grants full XP and the rest grant half.
          const isAoeSpell =
            a.spellKind === "fireball" ||
            a.spellKind === "cleave" ||
            a.spellKind === "piercing" ||
            a.spellKind === "causticVenom" ||
            a.spellKind === "piercingThrust" ||
            a.spellKind === "sweep";
          const xpMul =
            foe.hp <= 0 && !isAoeSpell && (att.classId === "mage" || att.classId === "conjurer")
              ? 2
              : isAoeSpell && !firstAoeEnemyHit
                ? 0.5
                : 1;
          if (isAoeSpell) firstAoeEnemyHit = false;
          this.gainExp(att, foe.level, dmg, xpMul);
        }
        this.spawnHit(foe, dmg, crit);
        this.pushLog(`${att.name} atingiu ${foe.name} com magia: ${dmg} dano${crit ? " (crítico)" : ""}`);
        if (foe.hp <= 0) {
          this.markDead(foe);
        } else {
          sfxPlay.hit();
          if (a.echo) foe.shock = { ...a.echo };
          if (a.spellKind === "sweep") this.knockBack(att, foe);
        }
      }
      if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.45);
      this.emitParticle({
        x: att.x,
        y: att.y,
        vx: 0,
        vy: -0.4,
        life: 0,
        max: 0.45,
        size: 1,
        color: "#c45a32",
        kind: "impact",
        frame: 0,
      });
    }
    if (a.t >= 0.55) this.finishCombat(att);
  }

  private stepHeal(a: HealAnim, dt: number): void {
    const att = this.units.find((u) => u.id === a.att);
    const target = this.units.find((u) => u.id === a.def);
    if (!att || !target) {
      this.active = null;
      return;
    }
    a.t += dt;
    if (!a.applied && a.t >= 0.2) {
      a.applied = true;
      const heal = rollCure(a.kind, this.rng);
      const gained = Math.min(heal, target.maxHp - target.hp);
      target.hp += gained;
      this.gainExp(att, target.level, gained);
      this.emitParticle({
        x: target.drawX,
        y: target.drawY - 0.35,
        vx: 0,
        vy: -0.18,
        life: 0,
        max: 2,
        size: 1,
        color: "#d8ead2",
        text: `+${gained}`,
        kind: "text",
        frame: 0,
      });
      this.tip = `${CURES[a.kind].name} · +${gained} HP`;
      this.pushLog(`${att.name} curou ${target.name}: +${gained} HP`);
      sfxPlay.heal();
    }
    if (a.t >= 0.5) this.finishCombat(att);
  }

  private stepCureDisease(a: CureDiseaseAnim, dt: number): void {
    const att = this.units.find((u) => u.id === a.att);
    const target = this.units.find((u) => u.id === a.def);
    if (!att || !target) {
      this.active = null;
      return;
    }
    a.t += dt;
    if (!a.applied && a.t >= 0.2) {
      a.applied = true;
      this.curePlayerDisease(target);
      this.emitParticle({
        x: target.drawX,
        y: target.drawY - 0.35,
        vx: 0,
        vy: -0.18,
        life: 0,
        max: 2,
        size: 1,
        color: "#d8ead2",
        text: "curado",
        kind: "text",
        frame: 0,
      });
      this.tip = `${CURE_DISEASE.name} · ${target.name} está curado.`;
      sfxPlay.heal();
    }
    if (a.t >= 0.5) this.finishCombat(att);
  }

  /** 20% chance for a wardog's bite to inflict disease on a surviving target. */
  private maybeInflictDisease(actor: Unit, target: Unit): void {
    if (actor.classId !== "wardog" || !target.alive || target.diseased) return;
    if (this.rng() >= DISEASE.biteChance) return;
    target.diseased = true;
    target.diseaseBase = { atk: target.atk, mag: target.mag, def: target.def, res: target.res, mov: target.mov };
    const pen = (n: number) => Math.round(n * (1 - DISEASE.statPenalty));
    target.atk = pen(target.atk);
    target.mag = pen(target.mag);
    target.def = pen(target.def);
    target.res = pen(target.res);
    target.mov = Math.max(1, pen(target.mov));
    this.tip = `${target.name} não se sente muito bem.`;
  }

  /**
   * Grants XP for an action with a measurable, real effect — damage on a hit, HP restored by
   * a heal or potion — and applies any level-ups on the spot, mid-battle. Multi-target
   * abilities (fireball, cleave, piercing...) call this once per unit actually hit, so every
   * landed hit counts on its own. Side-eligibility (don't gain XP for friendly fire) is the
   * caller's job, since the same helper also grants XP for healing your own side.
   */
  private pushLog(line: string): void {
    this.log.push(line);
    if (this.log.length > 200) this.log.shift();
  }

  /** Single choke point for a unit's death: sfx, the log line, and — for an enemy — the
   * kill-drop roll, so every death path (melee, counter, spell, lightning echo, tile
   * hazard) behaves identically instead of four separate copies of the same logic. */
  private markDead(u: Unit): void {
    u.alive = false;
    sfxPlay.death();
    this.pushLog(`${u.name} foi derrotado.`);
    if (u.side === "enemy" && u.guaranteedDrop) {
      // Named unique bosses (Spawn.guaranteedDrop) skip the roll entirely and always drop
      // something — from the same weapon-or-gear pool a chest rolls from, not the plain
      // weapon-only kill-drop pool below.
      const drop = weightedLootPick(this.rng, missionGearLevel(this.mission.index), this.ownedWeapons);
      if (drop.kind === "weapon") {
        if (this.ownedWeapons.has(drop.id)) {
          this.lootEmber += 15;
        } else {
          this.ownedWeapons.add(drop.id);
          this.lootWeapons.push(drop.id);
          this.pushLog(`Loot: ${WEAPONS[drop.id]?.name ?? drop.id}`);
        }
      } else {
        this.lootEquipment.push(drop.id);
        this.pushLog(`Loot: ${EQUIPMENT[drop.id]?.name ?? drop.id}`);
      }
    } else if (u.side === "enemy" && this.rng() < KILL_DROP_CHANCE) {
      // 1% per kill, capped to what this mission's own enemies are geared for (see
      // missionGearLevel), and never a weapon already owned — an early mission never hands
      // out the campaign's best gear.
      const id = weightedWeaponPick(this.rng, Object.keys(WEAPONS), missionGearLevel(this.mission.index));
      if (this.ownedWeapons.has(id)) {
        this.lootEmber += 15;
      } else {
        this.ownedWeapons.add(id);
        this.lootWeapons.push(id);
        this.pushLog(`Loot: ${WEAPONS[id]?.name ?? id}`);
      }
    }
  }

  private gainExp(attacker: Unit, targetLevel: number, amount: number, multiplier = 1): void {
    if (amount <= 0 || attacker.side !== "player" || !attacker.alive) return;
    if (attacker.level >= MAX_LEVEL) return;
    const gained = Math.round(expForHit(attacker.level, targetLevel) * multiplier);
    if (gained <= 0) return;
    attacker.xp += gained;
    while (attacker.xp >= EXP_TO_LEVEL && attacker.level < MAX_LEVEL) {
      attacker.xp -= EXP_TO_LEVEL;
      this.levelUpUnit(attacker);
    }
    if (attacker.level >= MAX_LEVEL) attacker.xp = 0;
  }

  /** Bumps a unit by one level: stat growth, the level's HP gain added to current HP (not a full heal), and any newly-unlocked tier uses granted right away. */
  private levelUpUnit(u: Unit): void {
    const from = u.level;
    const to = from + 1;
    const before = statsFor(u.classId, from);
    const after = statsFor(u.classId, to);
    u.level = to;
    u.maxHp = after.hp;
    u.atk = after.atk;
    u.mag = after.mag;
    u.def = after.def;
    u.res = after.res;
    u.hp = Math.min(u.maxHp, u.hp + (after.hp - before.hp));
    for (let t = 1; t <= 10; t++) {
      const tier = t as SpellTier;
      const key = tierKey(tier);
      const gain = tierUses(u.classId, tier, to) - tierUses(u.classId, tier, from);
      if (gain > 0) u.spells[key] += gain;
    }
    this.tip = `${u.name} subiu para o nível ${to}!`;
  }

  private curePlayerDisease(u: Unit): void {
    u.poisoned = false;
    if (!u.diseaseBase) {
      u.diseased = false;
      return;
    }
    u.atk = u.diseaseBase.atk;
    u.mag = u.diseaseBase.mag;
    u.def = u.diseaseBase.def;
    u.res = u.diseaseBase.res;
    u.mov = u.diseaseBase.mov;
    u.diseaseBase = null;
    u.diseased = false;
  }

  /**
   * Marks a unit as having acted this turn. A player unit that hasn't moved yet this turn
   * stays selected so it can still use its one move (order-independent move+attack); a unit
   * that already moved, is dead, or belongs to the enemy ends its turn immediately instead —
   * leaving an enemy "selected" here would expose it to player input (move/attack picks).
   */
  private finishAction(u: Unit): void {
    u.acted = true;
    this.pendingFoeId = null;
    this.inspectedId = null;
    this.threat = [];
    this.attackFrom.clear();
    const alreadyMoved = !u.alive || u.side !== "player" || !this.orig || u.x !== this.orig.x || u.y !== this.orig.y;
    if (alreadyMoved) {
      u.moved = true;
      this.selectedId = null;
      this.reach.clear();
      this.orig = null;
      this.mode = this.phase === "player" ? "idle" : "locked";
      return;
    }
    this.selectedId = u.id;
    this.orig = { x: u.x, y: u.y };
    this.reach = computeReachable(this.effectiveUnitForReach(u), this.tiles, this.cols, this.rows, this.units);
    this.mode = "selected";
  }

  private finishCombat(att: Unit): void {
    att.drawX = att.x;
    att.drawY = att.y;
    this.active = null;
    this.spellKind = null;
    // A spell/heal/cureDisease sets this.banner directly (the cast name, e.g. "Bola de
    // Fogo") when it starts, outside the dedicated "banner" active-step type — which is
    // the only other thing that ever set it, and the only thing that ever cleared it (see
    // stepActive). Every skill routes through this single completion point regardless of
    // which one it was, so clearing it here is the one place that actually covers all of
    // them instead of the banner sitting on screen until something unrelated overwrites it.
    this.banner = null;
    this.evaluateEnd();
    if (this.result) {
      this.selectedId = null;
      this.pendingFoeId = null;
      this.inspectedId = null;
      this.threat = [];
      this.reach.clear();
      this.attackFrom.clear();
      this.orig = null;
      this.mode = "idle";
      return;
    }
    this.finishAction(att);
  }

  private smashBarricades(unit: Unit): void {
    if (unit.classId !== "troll" || !unit.alive) return;
    const fill: TerrainId = this.tiles.includes("nave") ? "nave" : "plains";
    const seen = new Set<string>();
    let n = 0;
    for (const p of footprint(unit)) {
      for (const c of [p, ...hexNeighbors(p.x, p.y)]) {
        if (!inBounds(c.x, c.y, this.cols, this.rows)) continue;
        const k = key(c.x, c.y);
        if (seen.has(k)) continue;
        seen.add(k);
        const i = c.y * this.cols + c.x;
        if (this.tiles[i] !== "barricade") continue;
        this.tiles[i] = fill;
        n += 1;
        this.emitParticle({
          x: c.x,
          y: c.y,
          vx: 0,
          vy: -0.2,
          life: 0,
          max: 0.45,
          size: 1,
          color: "#c4a07a",
          kind: "impact",
          frame: 0,
        });
      }
    }
    if (n) {
      this.tip = "O troll parte a barricada.";
      this.trauma = Math.min(1, this.trauma + 0.35);
      sfxPlay.hit();
    }
  }

  private nudgeOffHazard(unit: Unit): void {
    const here = TERRAIN[tileAt(this.tiles, this.cols, unit.x, unit.y)];
    if (here.passable && !here.hazardDice) return;
    const occ = occupancy(this.units);
    const seen = new Set<string>([key(unit.x, unit.y)]);
    const q: Point[] = [{ x: unit.x, y: unit.y }];
    while (q.length) {
      const cur = q.shift()!;
      for (const n of hexNeighbors(cur.x, cur.y)) {
        if (n.x < 0 || n.y < 0 || n.x >= this.cols || n.y >= this.rows) continue;
        const k = key(n.x, n.y);
        if (seen.has(k)) continue;
        seen.add(k);
        const terr = TERRAIN[tileAt(this.tiles, this.cols, n.x, n.y)];
        const who = occ.get(k);
        if (terr.passable && !terr.hazardDice && (!who || who.id === unit.id)) {
          unit.x = n.x;
          unit.y = n.y;
          unit.drawX = n.x;
          unit.drawY = n.y;
          return;
        }
        q.push(n);
      }
    }
  }

  /** Lightning echo + standing-hazard damage, applied once when this unit's own turn begins. */
  private startOfTurnEffects(u: Unit): void {
    if (!u.alive) return;
    if (u.shock) {
      const echo = u.shock;
      u.shock = null;
      const dmg = Math.max(1, rollDice(echo.dice, echo.faces, echo.bonus, this.rng) - u.res);
      u.hp = Math.max(0, u.hp - dmg);
      u.flash = 1;
      this.spawnHit(u, dmg, false);
      this.tip = `Relâmpago · ${diceFormula(echo.dice, echo.faces, echo.bonus)} − RES`;
      this.pushLog(`Eco de relâmpago em ${u.name}: ${dmg} dano`);
      sfxPlay.hit();
      if (u.hp <= 0) {
        this.markDead(u);
      }
    }
    if (u.alive && u.poisoned) {
      const dmg = rollDice(1, 4, 0, this.rng);
      u.hp = Math.max(0, u.hp - dmg);
      u.flash = 1;
      this.spawnHit(u, dmg, false);
      this.tip = `Veneno · 1D4 dano`;
      this.pushLog(`Veneno consome ${u.name}: ${dmg} dano`);
      sfxPlay.hit();
      if (u.hp <= 0) {
        this.markDead(u);
      }
    }
    if (u.alive) this.applyTileHazard(u, { x: u.x, y: u.y });
    this.evaluateEnd();
  }

  private applyTileHazard(unit: Unit, cell: Point): void {
    const terr = TERRAIN[tileAt(this.tiles, this.cols, cell.x, cell.y)];
    if (!terr.hazardDice || !unit.alive) return;
    const faces = terr.hazardFaces ?? 8;
    let dmg = 0;
    for (let i = 0; i < terr.hazardDice; i++) dmg += 1 + Math.floor(this.rng() * faces);
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.flash = 1;
    this.spawnHit(unit, dmg, false);
    this.pushLog(`${terr.name} feriu ${unit.name}: ${dmg} dano`);
    sfxPlay.hit();
    if (unit.hp <= 0) {
      this.markDead(unit);
      this.onNextIdle = null;
    }
  }

  private emitParticle(init: Omit<Particle, "live">): void {
    if (this.reducedMotion && init.kind === "spark") return;
    let slot: Particle | undefined;
    for (const p of this.particles) {
      if (!p.live) {
        slot = p;
        break;
      }
    }
    if (!slot) {
      slot = this.particles.find((p) => p.kind !== "text") ?? this.particles[0]!;
      let oldest = 0;
      for (const p of this.particles) {
        if (p.kind === "text") continue;
        if (p.life / p.max > oldest) {
          oldest = p.life / p.max;
          slot = p;
        }
      }
    } else this.particleLive += 1;
    slot.live = true;
    slot.x = init.x;
    slot.y = init.y;
    slot.vx = init.vx;
    slot.vy = init.vy;
    slot.life = init.life;
    slot.max = init.max;
    slot.size = init.size;
    slot.color = init.color;
    slot.text = init.text;
    slot.kind = init.kind;
    slot.frame = init.frame;
  }

  private spawnHit(target: Unit, dmg: number, crit: boolean): void {
    const cx = target.drawX;
    const cy = target.drawY;
    this.emitParticle({
      x: cx,
      y: cy - 0.35,
      vx: 0,
      vy: -0.18,
      life: 0,
      max: 2,
      size: 1,
      color: crit ? "#f0ebe3" : "#f2d2c6",
      text: crit ? `CRÍTICO  −${dmg}` : `−${dmg}`,
      kind: "text",
      frame: 0,
    });
    this.emitParticle({
      x: cx,
      y: cy - 0.15,
      vx: 0,
      vy: 0,
      life: 0,
      max: 0.32,
      size: 1,
      color: "#fff",
      kind: "impact",
      frame: 0,
    });
    if (this.reducedMotion) return;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + this.rng();
      this.emitParticle({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * (1.4 + this.rng()),
        vy: Math.sin(ang) * (1.4 + this.rng()) - 0.4,
        life: 0,
        max: 0.28 + this.rng() * 0.12,
        size: 2 + this.rng() * 2,
        color: i % 2 ? "#b54a32" : "#f0ebe3",
        kind: "spark",
        frame: 0,
      });
    }
  }

  private evaluateEnd(): void {
    if (this.result) return;
    const p = this.units.some((u) => u.side === "player" && u.alive && !u.summoned);
    const bossAlive = this.units.some((u) => u.side === "enemy" && u.alive && u.classId === "captain");
    const anyEnemy = this.units.some((u) => u.side === "enemy" && u.alive);
    const won = this.mission.win === "boss" ? !bossAlive : !anyEnemy;
    // Victory doesn't end the battle by itself anymore — it just makes ending it an option
    // (see winAvailable/confirmFinish) so the player can keep taking normal turns to loot
    // remaining chests, with a click-whenever-ready control staying available the whole
    // time rather than a one-shot prompt they could dismiss and then have no way back to.
    // If a trap/trigger spawns a fresh enemy after the field first looked clear, this goes
    // back to false on its own until they're dealt with too. Defeat has no such choice:
    // with no player units left there's nothing left to do.
    this.winAvailable = won;
    if (!p) this.result = "defeat";
  }

  /** Player-confirmed "yes, end the mission now" — only takes effect while winAvailable
   * (the field is actually clear); a beat too late (a fresh spawn just made it false again)
   * is simply ignored rather than ending the battle out from under a live fight. */
  confirmFinish(): void {
    if (this.winAvailable && !this.result) this.result = "victory";
  }

  /** First not-yet-acted unit in this round's initiative order, or null if everyone has gone. */
  activeTurnUnit(): Unit | null {
    for (const id of this.turnOrder) {
      const u = this.units.find((x) => x.id === id);
      if (u && u.alive && !u.moved) return u;
    }
    return null;
  }

  private select(unit: Unit): void {
    if (unit.side !== "player" || !unit.alive || unit.moved || this.phase !== "player") {
      this.inspect(unit);
      return;
    }
    const active = this.activeTurnUnit();
    if (active && active.id !== unit.id) {
      this.inspect(unit);
      this.tip = `Ainda não é a vez de ${unit.name} — espere ${active.name} agir.`;
      return;
    }
    if (this.selectedId === unit.id && this.mode === "awaitAction") return;
    this.selectedId = unit.id;
    this.pendingFoeId = null;
    this.inspectedId = null;
    this.orig = { x: unit.x, y: unit.y };
    this.reach = computeReachable(this.effectiveUnitForReach(unit), this.tiles, this.cols, this.rows, this.units);
    this.attackFrom = unit.acted ? new Map() : attackableEnemies(unit, this.reach, this.units, this.tiles, this.cols);
    this.threat = [];
    this.mode = "selected";
    this.tip = null;
    this.ensureVisible(unit.x, unit.y);
    sfxPlay.select();
  }

  private inspect(unit: Unit): void {
    this.inspectedId = unit.id;
    this.threat = computeThreat(unit, this.tiles, this.cols, this.rows, this.units);
    const max = effectiveMaxRange(unit, tileAt(this.tiles, this.cols, unit.x, unit.y));
    const tile = TERRAIN[tileAt(this.tiles, this.cols, unit.x, unit.y)];
    this.tip = `${unit.name} · HP ${unit.hp}/${unit.maxHp} · Alc ${unit.minRange === max ? max : `${unit.minRange}–${max}`}${
      tile.height ? " · alto +2" : ""
    }${tile.id === "barricade" ? " · barricada bloqueia projéteis" : ""}${
      unit.classId === "troll" ? " · parte barricadas" : ""
    }${
      unit.shock ? ` · Relâmpago ${diceFormula(unit.shock.dice, unit.shock.faces, unit.shock.bonus)} − RES no turno` : ""
    }${unit.diseased ? " · Doente (−10% em todos os stats)" : ""}${unit.poisoned ? " · Envenenado (1D4 dano por turno)" : ""}`;
    this.ensureVisible(unit.x, unit.y);
    sfxPlay.ui();
  }

  deselect(commit = false): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (
      !commit &&
      u &&
      this.orig &&
      (u.x !== this.orig.x || u.y !== this.orig.y) &&
      (this.mode === "awaitAction" || this.mode === "selected")
    ) {
      u.x = this.orig.x;
      u.y = this.orig.y;
      u.drawX = u.x;
      u.drawY = u.y;
    }
    this.selectedId = null;
    this.pendingFoeId = null;
    this.inspectedId = null;
    this.threat = [];
    this.reach.clear();
    this.attackFrom.clear();
    this.orig = null;
    this.mode = "idle";
  }

  cancel(): void {
    if (this.mode === "awaitSpell") {
      this.mode = "awaitAction";
      this.spellArmed = false;
      this.spellAim = null;
      this.spellKind = null;
      this.tip = null;
      return;
    }
    this.deselect();
    sfxPlay.ui();
  }

  wait(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || this.phase !== "player") return;
    u.moved = true;
    u.x = Math.round(u.drawX);
    u.y = Math.round(u.drawY);
    u.drawX = u.x;
    u.drawY = u.y;
    this.deselect(true);
    sfxPlay.ui();
  }

  startAttack(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted) return;
    this.mode = "awaitAttack";
    this.tip = "Toque no alvo.";
    sfxPlay.ui();
  }

  startOffHand(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || !u.offHandId) return;
    this.mode = "awaitOffHand";
    this.tip = "Toque no alvo.";
    sfxPlay.ui();
  }

  startFireball(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "fireball") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "fireball";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${FIREBALL.name}: alcance ${FIREBALL.range}, ${fireballFormula(u.level)} − RES em área. Toque para mirar, toque de novo para lançar.`;
    sfxPlay.ui();
  }

  startCausticVenom(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "causticVenom") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "causticVenom";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${CAUSTIC_VENOM.name}: alcance ${CAUSTIC_VENOM.range}, alvo ${diceFormula(CAUSTIC_VENOM.centerDice, CAUSTIC_VENOM.centerFaces, CAUSTIC_VENOM.centerBonus)} − RES, respingo ${diceFormula(CAUSTIC_VENOM.splashDice, CAUSTIC_VENOM.splashFaces, CAUSTIC_VENOM.splashBonus)} − RES em área — envenena todos atingidos, até aliados. Toque para mirar, toque de novo para lançar.`;
    sfxPlay.ui();
  }

  startLongShot(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "longShot") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "longShot";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${LONG_SHOT.name}: alcance ${u.minRange}–${this.longMax(u)}, AT − DF + ${diceFormula(LONG_SHOT.bonusDice, LONG_SHOT.bonusFaces, LONG_SHOT.bonus)}. Toque no inimigo.`;
    sfxPlay.ui();
  }

  startPiercing(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "piercing") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "piercing";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${PIERCING.name}: reta da colmeia. Dobro do AT − DF em cada um na linha, aliado ou inimigo.`;
    sfxPlay.ui();
  }

  startLightning(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "lightning") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "lightning";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `Relâmpago: alcance ${LIGHTNING.range}, ${lightningFormula(u.level)} − RES. No turno seguinte ${diceFormula(LIGHTNING.echoDice, LIGHTNING.echoFaces, LIGHTNING.echoBonus)} − RES. Toque no inimigo.`;
    sfxPlay.ui();
  }

  startMagicMissile(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "magicMissile") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "magicMissile";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${MAGIC_MISSILE.name}: alcance ${MAGIC_MISSILE.range}, ${diceFormula(MAGIC_MISSILE.dice, MAGIC_MISSILE.faces, MAGIC_MISSILE.bonus)} − RES. Acerto garantido. Toque no inimigo.`;
    sfxPlay.ui();
  }

  startDoubleStrike(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "doubleStrike") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "doubleStrike";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${DOUBLE_STRIKE.name}: ataca duas vezes com o dano normal da arma. Toque no inimigo.`;
    sfxPlay.ui();
  }

  startCleave(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "cleave") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "cleave";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${CLEAVE.name}: ${CLEAVE.hexes} hexes adjacentes, dano da arma + ${diceFormula(CLEAVE.bonusDice, CLEAVE.bonusFaces, CLEAVE.bonusBonus)}. Toque num hex vizinho.`;
    sfxPlay.ui();
  }

  startPiercingThrust(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "piercingThrust") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "piercingThrust";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${PIERCING_THRUST.name}: reta curta, ignora ${Math.round(PIERCING_THRUST.armorIgnore * 100)}% da defesa. 1º alvo dano cheio, os demais metade.`;
    sfxPlay.ui();
  }

  /** Sweep (Lancer tier 2) needs no target — it always hits every enemy on an adjacent hex
   * and resolves immediately, same as Esperar/Arrombar rather than the aim-then-Lançar flow
   * every other spell uses. */
  startSweep(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "sweep") <= 0) return;
    const tiles = hexNeighbors(u.x, u.y);
    const ids: string[] = [];
    for (const t of tiles) {
      const who = this.units.find((x) => x.alive && occupies(x, t.x, t.y));
      if (who && who.id !== u.id && who.side !== u.side && !ids.includes(who.id)) ids.push(who.id);
    }
    this.spendTier(u, "sweep");
    this.spellKind = null;
    this.spellArmed = false;
    this.spellAim = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({ type: "spell", att: u.id, tiles, ids, label: SWEEP.name, spellKind: "sweep" });
    sfxPlay.sweep();
  }

  startTrip(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "trip") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "trip";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${TRIP.name}: dano da arma + ${diceFormula(1, TRIP.bonusFaces, TRIP.bonusBonus)}, atordoa por ${TRIP.stunRounds} turnos e reduz stats em ${Math.round(TRIP.statPenalty * 100)}% até o fim do combate. Toque no inimigo.`;
    sfxPlay.ui();
  }

  startSummonFamiliar(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "summonFamiliar") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "summonFamiliar";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${SUMMON_FAMILIAR.name}: convoca um aliado com metade dos seus atributos atuais, até ${SUMMON_FAMILIAR.range} hexes. Toque num espaço livre.`;
    sfxPlay.ui();
  }

  startWebOfDreams(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "webOfDreams") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "webOfDreams";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${WEB_OF_DREAMS.name}: cria uma teia grudenta por ${WEB_OF_DREAMS.durationRounds} rodadas — quem estiver dentro fica com movimento reduzido a 1 hex, e testa ${Math.round(WEB_OF_DREAMS.sleepChance * 100)}% de chance de adormecer por ${diceFormula(WEB_OF_DREAMS.sleepDice, WEB_OF_DREAMS.sleepFaces, 0)} turnos a cada turno que permanecer lá dentro (cumulativo). Alcance ${WEB_OF_DREAMS.range}. Toque para mirar.`;
    sfxPlay.ui();
  }

  confirmSpell(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    const cell = this.hover;
    if (!u || this.mode !== "awaitSpell" || !cell || !this.spellKind) return;
    if (this.spellKind === "fireball") {
      this.confirmFireball();
      return;
    }
    if (this.spellKind === "causticVenom") {
      this.confirmCausticVenom();
      return;
    }
    if (this.spellKind === "longShot") {
      this.castLongShot(u, cell);
      return;
    }
    if (this.spellKind === "piercing") {
      this.castPiercing(u, cell);
      return;
    }
    if (this.spellKind === "piercingThrust") {
      this.castPiercingThrust(u, cell);
      return;
    }
    if (this.spellKind === "trip") {
      this.castTrip(u, cell);
      return;
    }
    if (this.spellKind === "summonFamiliar") {
      this.castSummonFamiliar(u, cell);
      return;
    }
    if (this.spellKind === "webOfDreams") {
      this.castWebOfDreams(u, cell);
      return;
    }
    if (this.spellKind === "lightning") {
      this.castLightning(u, cell);
      return;
    }
    if (this.spellKind === "magicMissile") {
      this.castMagicMissile(u, cell);
      return;
    }
    if (this.spellKind === "doubleStrike") {
      this.castDoubleStrike(u, cell);
      return;
    }
    if (this.spellKind === "cleave") {
      this.castCleave(u, cell);
      return;
    }
    if (this.spellKind === "cureDisease") {
      this.castCureDisease(u, cell);
      return;
    }
    if (this.spellKind === "sweep") return; // instant, resolved by startSweep — never reaches here
    this.castHeal(u, cell, this.spellKind);
  }

  startCure(kind: HealId): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, kind) <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = kind;
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${CURES[kind].name}: ${cureSpan(kind)} HP, alcance ${CURES[kind].range}. Toque num aliado ferido.`;
    sfxPlay.ui();
  }

  startCureDisease(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.acted || this.tierRemaining(u, "cureDisease") <= 0) return;
    this.mode = "awaitSpell";
    this.spellKind = "cureDisease";
    this.spellArmed = false;
    this.spellAim = null;
    this.hover = null;
    this.tip = `${CURE_DISEASE.name}: cura doença, alcance ${CURE_DISEASE.range}. Toque num aliado doente.`;
    sfxPlay.ui();
  }

  confirmHeal(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    const cell = this.hover;
    if (!u || this.mode !== "awaitSpell" || !cell || !this.isHeal(this.spellKind)) return;
    this.castHeal(u, cell, this.spellKind);
  }

  private isHeal(kind: SpellKind | null): kind is HealId {
    return kind === "cureMinor" || kind === "cureWounds";
  }

  private tierRemaining(u: Unit, kind: SpellKind): number {
    const tier = spellTier(kind);
    return tier ? u.spells[tierKey(tier)] : 0;
  }

  private spendTier(u: Unit, kind: SpellKind): void {
    const tier = spellTier(kind);
    if (!tier) return;
    u.spells[tierKey(tier)] -= 1;
  }

  private longMax(u: Unit): number {
    const ranged = u.weaponId ? !!WEAPONS[u.weaponId]?.ranged : false;
    const extra = ranged && TERRAIN[tileAt(this.tiles, this.cols, u.x, u.y)].height ? 1 : 0;
    return u.maxRange * LONG_SHOT.rangeMul + LONG_SHOT.rangeBonus + extra;
  }

  /** True while (x,y) sits inside any still-active Web of Dreams patch. */
  private isWebCell(x: number, y: number): boolean {
    return this.webZones.some((z) => z.cells.has(key(x, y)));
  }

  /** Every reach computation for a unit's own turn — including every re-derive free
   * repositioning does after each move — funnels through here, so both of its clamps stay
   * correct no matter how many times the player changes their mind about where to end up:
   *
   * 1. Web of Dreams' "restrained / difficult terrain" clause: a unit whose current cell was
   *    webbed at the START of its turn (this.turnRestrained, decided once in beginUnitTurn,
   *    not re-checked live — see the old note this replaced) gets mov clamped to 1.
   * 2. moveBudgetUsed: free repositioning recomputes reach fresh from wherever the unit
   *    currently stands, which — with the unit's real, full mov every time — would hand back
   *    a fresh movement budget on every single move and let a unit hop across the whole map
   *    in one turn. Subtracting what's already been spent (see commitMove) caps the turn's
   *    real total distance at mov, same as it's always meant to be; the player still gets to
   *    freely change their mind about WHERE within that budget to land, no clunky cancel/
   *    reselect needed — that part is the actual point of free repositioning and stays.
   *
   * Both clamps use the same "shallow clone with one derived stat overridden" trick Piercing
   * Thrust's armor-ignore calc uses — the real Unit's own mov is never touched. */
  private effectiveUnitForReach(u: Unit): Unit {
    const remaining = Math.max(0, u.mov - u.moveBudgetUsed);
    const cap = this.turnRestrained ? Math.min(remaining, 1) : remaining;
    return cap === u.mov ? u : { ...u, mov: cap };
  }

  private spellAimValid(caster: Unit, cell: Point): boolean {
    if (!this.spellKind) return false;
    if (this.spellKind === "fireball") {
      if (manhattan(caster, cell) > FIREBALL.range) return false;
      return clearShot(caster, fireballOrigin(cell, this.cols, this.rows), this.tiles, this.cols, "bolt");
    }
    if (this.spellKind === "causticVenom") {
      if (manhattan(caster, cell) > CAUSTIC_VENOM.range) return false;
      return clearShot(caster, fireballOrigin(cell, this.cols, this.rows), this.tiles, this.cols, "bolt");
    }
    if (this.spellKind === "longShot") {
      const d = manhattan(caster, cell);
      const here = occupancy(this.units).get(key(cell.x, cell.y));
      if (!here || !here.alive || here.side !== "enemy" || d < caster.minRange || d > this.longMax(caster)) return false;
      return clearShot(caster, cell, this.tiles, this.cols, "arrow");
    }
    if (this.spellKind === "piercing") return this.piercingRay(caster, cell) !== null;
    if (this.spellKind === "piercingThrust") return this.piercingThrustRay(caster, cell) !== null;
    if (this.spellKind === "lightning") {
      const here = occupancy(this.units).get(key(cell.x, cell.y));
      if (!here || !here.alive || here.side !== "enemy" || manhattan(caster, cell) > LIGHTNING.range) return false;
      return clearShot(caster, cell, this.tiles, this.cols, "bolt");
    }
    if (this.spellKind === "magicMissile") {
      const here = occupancy(this.units).get(key(cell.x, cell.y));
      if (!here || !here.alive || here.side !== "enemy" || manhattan(caster, cell) > MAGIC_MISSILE.range) return false;
      return clearShot(caster, cell, this.tiles, this.cols, "bolt");
    }
    if (this.spellKind === "summonFamiliar") {
      if (manhattan(caster, cell) > SUMMON_FAMILIAR.range) return false;
      if (!inBounds(cell.x, cell.y, this.cols, this.rows)) return false;
      if (!TERRAIN[tileAt(this.tiles, this.cols, cell.x, cell.y)].passable) return false;
      return !occupancy(this.units).get(key(cell.x, cell.y));
    }
    if (this.spellKind === "webOfDreams") {
      if (manhattan(caster, cell) > WEB_OF_DREAMS.range) return false;
      return clearShot(caster, fireballOrigin(cell, this.cols, this.rows), this.tiles, this.cols, "bolt");
    }
    if (this.spellKind === "doubleStrike" || this.spellKind === "trip") {
      const here = occupancy(this.units).get(key(cell.x, cell.y));
      return !!here && here.alive && here.side !== caster.side && canHitFrom(caster, caster, here, this.tiles, this.cols);
    }
    if (this.spellKind === "cleave") {
      return hexNeighbors(caster.x, caster.y).some((p) => p.x === cell.x && p.y === cell.y);
    }
    if (this.spellKind === "cureDisease") return this.validCureDiseaseTarget(caster, cell);
    return this.validHealTarget(caster, cell);
  }

  private piercingRay(from: Point, through: Point): Point[] | null {
    const raw = piercingLine(from, through, this.cols, this.rows);
    if (!raw) return null;
    const fromHigh = !!TERRAIN[tileAt(this.tiles, this.cols, from.x, from.y)].height;
    const out: Point[] = [];
    for (const p of raw) {
      const t = TERRAIN[tileAt(this.tiles, this.cols, p.x, p.y)];
      if (t.id === "barricade" || t.blocksShot) break;
      if (t.height && !fromHigh) break;
      out.push(p);
    }
    return out.length ? out : null;
  }

  /** Piercing Thrust (Lancer tier 1): the same straight-line traversal as Piercing, capped
   * to the caster's own weapon reach + 1 hex — a short lunge, not an arrow flying the length
   * of the board. */
  private piercingThrustRay(caster: Unit, through: Point): Point[] | null {
    const raw = this.piercingRay(caster, through);
    if (!raw) return null;
    const capped = raw.slice(0, caster.maxRange + 1);
    return capped.length ? capped : null;
  }

  /** Sweep (Lancer tier 2): shoves `foe` one hex further along the line from `att` through
   * `foe`, silently doing nothing if that hex is off the board, impassable, or already
   * occupied — a blocked shove just fails, it never displaces someone else instead. */
  private knockBack(att: Unit, foe: Unit): void {
    const from = oddrToCube(att.x, att.y);
    const at = oddrToCube(foe.x, foe.y);
    const dir = { q: at.q - from.q, r: at.r - from.r, s: at.s - from.s };
    const pushed = cubeAdd(at, dir);
    const dest = cubeToOddr(pushed.q, pushed.r);
    if (!inBounds(dest.x, dest.y, this.cols, this.rows)) return;
    if (!TERRAIN[tileAt(this.tiles, this.cols, dest.x, dest.y)].passable) return;
    if (this.units.some((u) => u.alive && occupies(u, dest.x, dest.y))) return;
    foe.x = dest.x;
    foe.y = dest.y;
    foe.drawX = dest.x;
    foe.drawY = dest.y;
    this.emitParticle({
      x: foe.drawX,
      y: foe.drawY + 0.3,
      vx: 0,
      vy: 0,
      life: 0,
      max: 0.35,
      size: 1,
      color: "#c9b28a",
      kind: "impact",
      frame: 0,
    });
  }

  private validHealTarget(caster: Unit, cell: Point): boolean {
    if (!this.isHeal(this.spellKind)) return false;
    const range = CURES[this.spellKind].range;
    if (manhattan(caster, cell) > range) return false;
    const occ = occupancy(this.units);
    const who = occ.get(key(cell.x, cell.y));
    return !!who && who.side === "player" && who.alive && who.hp < who.maxHp;
  }

  private validCureDiseaseTarget(caster: Unit, cell: Point): boolean {
    if (manhattan(caster, cell) > CURE_DISEASE.range) return false;
    const occ = occupancy(this.units);
    const who = occ.get(key(cell.x, cell.y));
    return !!who && who.side === "player" && who.alive && (who.diseased || who.poisoned);
  }

  private healRangeTiles(from: Point, range: number): Point[] {
    const out: Point[] = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (manhattan(from, { x, y }) <= range) out.push({ x, y });
      }
    }
    return out;
  }

  private castHeal(unit: Unit, cell: Point, kind: HealId): void {
    if (!this.validHealTarget(unit, cell)) {
      this.tip = "Alvo inválido.";
      sfxPlay.ui();
      return;
    }
    const occ = occupancy(this.units);
    const target = occ.get(key(cell.x, cell.y));
    if (!target) return;
    this.spendTier(unit, kind);
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({ type: "heal", att: unit.id, def: target.id, kind });
  }

  private castCureDisease(unit: Unit, cell: Point): void {
    if (!this.validCureDiseaseTarget(unit, cell)) {
      this.tip = "Alvo inválido.";
      sfxPlay.ui();
      return;
    }
    const occ = occupancy(this.units);
    const target = occ.get(key(cell.x, cell.y));
    if (!target) return;
    this.spendTier(unit, "cureDisease");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({ type: "cureDisease", att: unit.id, def: target.id });
  }

  confirmFireball(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    const cell = this.hover;
    if (!u || this.mode !== "awaitSpell" || !cell) return;
    if (manhattan(u, cell) > FIREBALL.range) {
      this.tip = "Fora de alcance.";
      sfxPlay.ui();
      return;
    }
    this.castFireball(u, cell);
  }

  confirmCausticVenom(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    const cell = this.hover;
    if (!u || this.mode !== "awaitSpell" || !cell) return;
    if (manhattan(u, cell) > CAUSTIC_VENOM.range) {
      this.tip = "Fora de alcance.";
      sfxPlay.ui();
      return;
    }
    this.castCausticVenom(u, cell);
  }

  private castLongShot(unit: Unit, cell: Point): void {
    if (!this.spellAimValid(unit, cell)) {
      this.tip = "Alvo fora de alcance.";
      sfxPlay.ui();
      return;
    }
    const occ = occupancy(this.units);
    const foe = occ.get(key(cell.x, cell.y));
    if (!foe) return;
    this.spendTier(unit, "longShot");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({
      type: "combat",
      att: unit.id,
      def: foe.id,
      bonusDice: LONG_SHOT.bonusFaces,
      bonusFlat: LONG_SHOT.bonus,
      spellKind: "longShot",
    });
  }

  private castPiercing(unit: Unit, cell: Point): void {
    const line = this.piercingRay(unit, cell);
    if (!line) {
      this.tip = "Escolha uma reta da colmeia.";
      sfxPlay.ui();
      return;
    }
    const ids: string[] = [];
    for (const t of line) {
      const who = this.units.find((x) => x.alive && occupies(x, t.x, t.y));
      if (who && who.id !== unit.id && !ids.includes(who.id)) ids.push(who.id);
    }
    this.spendTier(unit, "piercing");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({ type: "spell", att: unit.id, tiles: line, ids, label: PIERCING.name, dmgMul: PIERCING.dmgMul, spellKind: "piercing" });
  }

  private castPiercingThrust(unit: Unit, cell: Point): void {
    const line = this.piercingThrustRay(unit, cell);
    if (!line) {
      this.tip = "Escolha uma reta na frente.";
      sfxPlay.ui();
      return;
    }
    const ids: string[] = [];
    for (const t of line) {
      const who = this.units.find((x) => x.alive && occupies(x, t.x, t.y));
      if (who && who.id !== unit.id && !ids.includes(who.id)) ids.push(who.id);
    }
    this.spendTier(unit, "piercingThrust");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    sfxPlay.thrust();
    this.queue.push({ type: "spell", att: unit.id, tiles: line, ids, label: PIERCING_THRUST.name, spellKind: "piercingThrust" });
  }

  private castLightning(unit: Unit, cell: Point): void {
    if (!this.spellAimValid(unit, cell)) {
      this.tip = "Alvo fora de alcance.";
      sfxPlay.ui();
      return;
    }
    const occ = occupancy(this.units);
    const foe = occ.get(key(cell.x, cell.y));
    if (!foe) return;
    this.spendTier(unit, "lightning");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({
      type: "spell",
      att: unit.id,
      tiles: [cell],
      ids: [foe.id],
      dice: lightningDice(unit.level),
      faces: LIGHTNING.faces,
      bonus: LIGHTNING.bonus,
      label: LIGHTNING.name,
      echo: { dice: LIGHTNING.echoDice, faces: LIGHTNING.echoFaces, bonus: LIGHTNING.echoBonus },
      spellKind: "lightning",
    });
  }

  private castMagicMissile(unit: Unit, cell: Point): void {
    if (!this.spellAimValid(unit, cell)) {
      this.tip = "Alvo fora de alcance.";
      sfxPlay.ui();
      return;
    }
    const occ = occupancy(this.units);
    const foe = occ.get(key(cell.x, cell.y));
    if (!foe) return;
    this.spendTier(unit, "magicMissile");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({
      type: "spell",
      att: unit.id,
      tiles: [cell],
      ids: [foe.id],
      dice: MAGIC_MISSILE.dice,
      faces: MAGIC_MISSILE.faces,
      bonus: MAGIC_MISSILE.bonus,
      label: MAGIC_MISSILE.name,
      spellKind: "magicMissile",
    });
  }

  private castDoubleStrike(unit: Unit, cell: Point): void {
    if (!this.spellAimValid(unit, cell)) {
      this.tip = "Toque no inimigo.";
      sfxPlay.ui();
      return;
    }
    const occ = occupancy(this.units);
    const foe = occ.get(key(cell.x, cell.y));
    if (!foe) return;
    this.spendTier(unit, "doubleStrike");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({ type: "combat", att: unit.id, def: foe.id, noCounter: true });
    this.queue.push({ type: "combat", att: unit.id, def: foe.id });
  }

  private castTrip(unit: Unit, cell: Point): void {
    if (!this.spellAimValid(unit, cell)) {
      this.tip = "Toque no inimigo.";
      sfxPlay.ui();
      return;
    }
    const occ = occupancy(this.units);
    const foe = occ.get(key(cell.x, cell.y));
    if (!foe) return;
    this.spendTier(unit, "trip");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({
      type: "combat",
      att: unit.id,
      def: foe.id,
      noCounter: true,
      bonusDice: TRIP.bonusFaces,
      bonusFlat: TRIP.bonusBonus,
      spellKind: "trip",
    });
  }

  /** Summon Familiar (Conjurer tier 1): spawns a new player-side unit directly into
   * `this.units` — no queued animation step, it just appears. It has no slot in this round's
   * `turnOrder` (that's rebuilt from `this.units` fresh every round in startNewRound), so it
   * waits for the round after this one to act, same as any other reinforcement would. */
  private castSummonFamiliar(unit: Unit, cell: Point): void {
    if (!this.spellAimValid(unit, cell)) {
      this.tip = "Escolha um espaço livre ao alcance.";
      sfxPlay.ui();
      return;
    }
    const cls = CLASSES.familiar;
    const scale = SUMMON_FAMILIAR.statScale;
    const maxHp = Math.max(1, Math.round(unit.maxHp * scale));
    const familiar: Unit = {
      id: `player-familiar-${this.units.length}`,
      name: `Familiar de ${unit.name}`,
      classId: "familiar",
      className: cls.name,
      role: cls.role,
      side: "player",
      sprite: cls.sprite,
      x: cell.x,
      y: cell.y,
      hp: maxHp,
      maxHp,
      atk: Math.round(unit.atk * scale),
      mag: Math.round(unit.mag * scale),
      def: Math.round(unit.def * scale),
      res: Math.round(unit.res * scale),
      mov: cls.mov,
      minRange: cls.minRange,
      maxRange: cls.maxRange,
      moved: false,
      acted: false,
      facing: 1,
      walkPose: "front",
      alive: true,
      drawX: cell.x,
      drawY: cell.y,
      flash: 0,
      fade: 1,
      bob: 0,
      level: unit.level,
      xp: 0,
      bag: { ...EMPTY_BAG },
      spells: { tier1: 0, tier2: 0, tier3: 0, tier4: 0, tier5: 0, tier6: 0, tier7: 0, tier8: 0, tier9: 0, tier10: 0 },
      weaponId: null,
      weaponEnh: 0,
      size: cls.size,
      footprintW: cls.footprintW,
      footprintH: cls.footprintH,
      footprintOffsets: cls.footprintOffsets,
      shock: null,
      diseased: false,
      diseaseBase: null,
      poisoned: false,
      stunned: false,
      stunTurns: 0,
      crippled: false,
      offHandId: null,
      summoned: true,
      asleep: false,
      sleepTurns: 0,
      guaranteedDrop: false,
      moveBudgetUsed: 0,
    };
    this.units.push(familiar);
    this.spendTier(unit, "summonFamiliar");
    this.spellKind = null;
    this.emitParticle({
      x: cell.x,
      y: cell.y - 0.2,
      vx: 0,
      vy: -0.3,
      life: 0,
      max: 0.5,
      size: 1.4,
      color: "#8c6cd8",
      kind: "impact",
      frame: 0,
    });
    this.tip = `${unit.name} invocou ${familiar.name}.`;
    sfxPlay.spell();
    this.finishAction(unit);
  }

  private castWebOfDreams(unit: Unit, click: Point): void {
    if (!this.spellAimValid(unit, click)) {
      this.tip = "Escolha um espaço ao alcance.";
      sfxPlay.ui();
      return;
    }
    const cells = hexAreaTiles(click, WEB_OF_DREAMS.size, this.cols, this.rows);
    const cellKeys = new Set(cells.map((p) => key(p.x, p.y)));
    this.webZones.push({ cells: cellKeys, roundsLeft: WEB_OF_DREAMS.durationRounds });
    let asleepCount = 0;
    for (const u of this.units) {
      if (!u.alive || !cellKeys.has(key(u.x, u.y))) continue;
      if (this.rng() < WEB_OF_DREAMS.sleepChance) {
        u.asleep = true;
        u.sleepTurns = rollDice(WEB_OF_DREAMS.sleepDice, WEB_OF_DREAMS.sleepFaces, 0, this.rng);
        asleepCount++;
      }
    }
    this.spendTier(unit, "webOfDreams");
    this.spellKind = null;
    this.emitParticle({
      x: click.x,
      y: click.y - 0.2,
      vx: 0,
      vy: -0.3,
      life: 0,
      max: 0.5,
      size: 1.4,
      color: "#8c6cd8",
      kind: "impact",
      frame: 0,
    });
    this.tip = `${unit.name} conjurou ${WEB_OF_DREAMS.name}${asleepCount > 0 ? ` — ${asleepCount} adormeceu(ram)` : ""}.`;
    this.pushLog(`${unit.name} conjura ${WEB_OF_DREAMS.name}.`);
    sfxPlay.spell();
    this.finishAction(unit);
  }

  private castCleave(unit: Unit, cell: Point): void {
    if (!this.spellAimValid(unit, cell)) {
      this.tip = "Toque num hex vizinho.";
      sfxPlay.ui();
      return;
    }
    const tiles = cleaveHexes(unit, cell, CLEAVE.hexes, this.cols, this.rows);
    if (tiles.length === 0) {
      this.tip = "Toque num hex vizinho.";
      sfxPlay.ui();
      return;
    }
    const ids: string[] = [];
    for (const t of tiles) {
      const who = this.units.find((x) => x.alive && occupies(x, t.x, t.y));
      if (who && who.id !== unit.id && who.side !== unit.side && !ids.includes(who.id)) ids.push(who.id);
    }
    this.spendTier(unit, "cleave");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({
      type: "spell",
      att: unit.id,
      tiles,
      ids,
      label: CLEAVE.name,
      weaponBonusDice: CLEAVE.bonusDice,
      weaponBonusFaces: CLEAVE.bonusFaces,
      weaponBonusBonus: CLEAVE.bonusBonus,
      spellKind: "cleave",
    });
  }

  usePotion(kind: PotionId): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.side !== "player" || !u.alive || u.acted) return;
    if (this.mode !== "awaitAction" && this.mode !== "selected" && this.mode !== "awaitAttack" && this.mode !== "awaitSpell")
      return;
    if (this.phase !== "player" || this.result) return;
    if (u.bag[kind] <= 0) return;
    const def = POTIONS[kind];
    if (def.effect === "disease") {
      if (!u.diseased && !u.poisoned) {
        this.tip = `${def.name} · ${u.name} não está doente.`;
        sfxPlay.ui();
        return;
      }
      u.bag[kind] -= 1;
      this.curePlayerDisease(u);
      u.x = Math.round(u.drawX);
      u.y = Math.round(u.drawY);
      this.tip = `${def.name} · doença curada.`;
      this.finishAction(u);
      sfxPlay.ui();
      return;
    }
    if (def.effect === "mana") {
      const restore = def.manaRestore ?? 0;
      let restored = 0;
      for (let t = 1; t <= 10; t++) {
        const tk = tierKey(t as SpellTier);
        const cap = tierUses(u.classId, t as SpellTier, u.level);
        if (cap <= 0) continue;
        const next = Math.min(cap, u.spells[tk] + restore);
        restored += next - u.spells[tk];
        u.spells[tk] = next;
      }
      if (restored <= 0) {
        this.tip = `${def.name} · magias já estão no máximo.`;
        sfxPlay.ui();
        return;
      }
      u.bag[kind] -= 1;
      u.x = Math.round(u.drawX);
      u.y = Math.round(u.drawY);
      this.emitParticle({
        x: u.drawX,
        y: u.drawY - 0.35,
        vx: 0,
        vy: -0.18,
        life: 0,
        max: 2,
        size: 1,
        color: "#a08cd8",
        text: `+${restored}`,
        kind: "text",
        frame: 0,
      });
      this.tip = `${def.name} · +${restored} usos de magia`;
      this.finishAction(u);
      sfxPlay.ui();
      return;
    }
    if (u.hp >= u.maxHp) return;
    const heal = rollPotion(kind, this.rng);
    const gained = Math.min(heal, u.maxHp - u.hp);
    u.hp += gained;
    this.gainExp(u, u.level, gained);
    u.bag[kind] -= 1;
    u.x = Math.round(u.drawX);
    u.y = Math.round(u.drawY);
    this.emitParticle({
      x: u.drawX,
      y: u.drawY - 0.35,
      vx: 0,
      vy: -0.18,
      life: 0,
      max: 2,
      size: 1,
      color: "#d8ead2",
      text: `+${gained}`,
      kind: "text",
      frame: 0,
    });
    this.tip = `${potionLabel(kind)} · +${gained} HP`;
    this.finishAction(u);
    sfxPlay.ui();
  }

  /** First adjacent locked chest/door around a unit's own tile, or null if none. */
  private adjacentLock(u: Unit): Point | null {
    for (const p of hexNeighbors(u.x, u.y)) {
      if (!inBounds(p.x, p.y, this.cols, this.rows)) continue;
      const t = tileAt(this.tiles, this.cols, p.x, p.y);
      if (t === "chest" || t === "door") return p;
    }
    return null;
  }

  /** "Arrombar": spends a Gazua to open an adjacent locked chest/door. */
  useLockpick(): void {
    const u = this.units.find((x) => x.id === this.selectedId);
    if (!u || u.side !== "player" || !u.alive || u.acted) return;
    if (this.mode !== "awaitAction" && this.mode !== "selected" && this.mode !== "awaitAttack" && this.mode !== "awaitSpell")
      return;
    if (this.phase !== "player" || this.result) return;
    if (u.bag.lockpick <= 0) return;
    const target = this.adjacentLock(u);
    if (!target) return;
    const i = target.y * this.cols + target.x;
    const wasChest = this.tiles[i] === "chest";
    this.tiles[i] = "plains";
    u.bag.lockpick -= 1;
    u.x = Math.round(u.drawX);
    u.y = Math.round(u.drawY);
    this.emitParticle({
      x: target.x,
      y: target.y,
      vx: 0,
      vy: -0.2,
      life: 0,
      max: 0.45,
      size: 1,
      color: "#d8b862",
      kind: "impact",
      frame: 0,
    });
    const found: string[] = [];
    if (wasChest) {
      // Every chest gives Ember, a guaranteed potion (weighted so the weak tier is the
      // common case, rarer as potency climbs), and — a separate, independent roll — a
      // chance at a piece of gear, weighted so the strongest is the rarest and capped to
      // what this mission's own enemies are geared for (see missionGearLevel). A chest
      // listed in Mission.betterChests (gated behind a locked area, say) tips both those
      // numbers up — same pool and range, not a different one.
      const better = this.mission.betterChests?.some((c) => c.x === target.x && c.y === target.y) ?? false;
      const gain = (better ? CHEST_LOOT.betterEmberBase : CHEST_LOOT.emberBase) + Math.floor(this.rng() * (better ? CHEST_LOOT.betterEmberDice : CHEST_LOOT.emberDice));
      this.lootEmber += gain;
      const potionKind = weightedPotionPick(this.rng);
      if (this.givePotion(u, potionKind)) found.push(POTIONS[potionKind].name);
      if (this.rng() < (better ? CHEST_LOOT.betterGearChance : CHEST_LOOT.gearChance)) {
        const drop = weightedLootPick(this.rng, missionGearLevel(this.mission.index), this.ownedWeapons);
        if (drop.kind === "weapon") {
          this.ownedWeapons.add(drop.id);
          this.lootWeapons.push(drop.id);
          found.push(WEAPONS[drop.id]!.name);
        } else {
          this.lootEquipment.push(drop.id);
          found.push(EQUIPMENT[drop.id]!.name);
        }
      }
      this.tip = `${u.name} arrombou o baú · +${gain} Ember · achou ${found.join(", ")}.`;
      this.pushLog(this.tip);
    } else {
      this.tip = `${u.name} arrombou a porta.`;
      this.pushLog(this.tip);
    }
    this.finishAction(u);
    if (wasChest) {
      sfxPlay.chest();
      if (found.length > 0) setTimeout(() => sfxPlay.loot(), 130);
    } else {
      sfxPlay.ui();
    }
  }

  /** "Fim do turno": passes whoever's turn it currently is (same as Esperar). */
  endTurn(): void {
    const active = this.activeTurnUnit();
    if (!active || active.side !== "player" || this.result) return;
    active.moved = true;
    active.x = Math.round(active.drawX);
    active.y = Math.round(active.drawY);
    active.drawX = active.x;
    active.drawY = active.y;
    this.deselect(true);
    sfxPlay.ui();
  }

  /** Dispatches control for whoever is next in this round's initiative order. */
  private beginUnitTurn(u: Unit): void {
    this.phase = u.side;
    u.moveBudgetUsed = 0;
    this.startOfTurnEffects(u);
    if (!u.alive) {
      this.activeUnitId = null; // force re-detection next tick, skipping the unit that just died
      return;
    }
    if (u.stunned) {
      u.stunTurns = Math.max(0, u.stunTurns - 1);
      u.stunned = u.stunTurns > 0;
      u.moved = true;
      u.acted = true;
      this.tip = `${u.name} está atordoado(a) — perde o turno.`;
      this.activeUnitId = null; // force re-detection next tick, moving on to whoever's next
      return;
    }
    // Still standing in an active web patch at the start of your own turn means another
    // sleepChance roll every turn you stay put, not just the one at cast — and a success
    // stacks another 1D4 onto whatever sleepTurns you're already carrying (even mid-nap)
    // rather than replacing it, so lingering in the web keeps digging the hole deeper.
    if (this.isWebCell(u.x, u.y) && this.rng() < WEB_OF_DREAMS.sleepChance) {
      const wasAsleep = u.asleep;
      const extra = rollDice(WEB_OF_DREAMS.sleepDice, WEB_OF_DREAMS.sleepFaces, 0, this.rng);
      u.asleep = true;
      u.sleepTurns += extra;
      this.pushLog(wasAsleep ? `${u.name} afunda mais fundo na teia (+${extra} turnos).` : `${u.name} adormece na teia.`);
    }
    if (u.asleep) {
      u.sleepTurns = Math.max(0, u.sleepTurns - 1);
      u.asleep = u.sleepTurns > 0;
      u.moved = true;
      u.acted = true;
      this.tip = `${u.name} está adormecido(a) — perde o turno.`;
      this.activeUnitId = null; // force re-detection next tick, moving on to whoever's next
      return;
    }
    // Decided once, off the unit's position right now (the start of its turn) — every
    // reach computation for the rest of this turn (repositioning included) uses this same
    // verdict instead of re-checking, see effectiveUnitForReach.
    this.turnRestrained = this.isWebCell(u.x, u.y);
    if (u.side === "player") {
      u.acted = false;
      this.selectedId = u.id;
      this.pendingFoeId = null;
      this.inspectedId = null;
      this.orig = { x: u.x, y: u.y };
      this.reach = computeReachable(this.effectiveUnitForReach(u), this.tiles, this.cols, this.rows, this.units);
      this.attackFrom = attackableEnemies(u, this.reach, this.units, this.tiles, this.cols);
      this.threat = [];
      this.mode = "selected";
      this.tip = null;
      this.centerOn(u.x, u.y);
    } else {
      this.mode = "locked";
      this.runAiFor(u);
    }
  }

  /** Everyone has had their turn this round — reset and re-roll the initiative order. */
  private startNewRound(): void {
    this.mode = "locked";
    this.selectedId = null;
    this.pendingFoeId = null;
    this.inspectedId = null;
    this.reach.clear();
    this.attackFrom.clear();
    this.threat = [];
    for (const u of this.units) {
      u.moved = false;
      u.acted = false;
    }
    for (const z of this.webZones) z.roundsLeft -= 1;
    this.webZones = this.webZones.filter((z) => z.roundsLeft > 0);
    this.turnOrder = this.sortByInitiative(this.units.filter((u) => u.alive));
    this.turn += 1;
    this.activeUnitId = null;
  }

  private runAiFor(next: Unit): void {
    this.smashBarricades(next);
    const reach = computeReachable(this.effectiveUnitForReach(next), this.tiles, this.cols, this.rows, this.units);
    const players = this.units.filter((u) => u.side === "player" && u.alive);
    let best: { foe: Unit; from: Point; score: number } | null = null;
    for (const cell of reach.values()) {
      for (const foe of players) {
        if (!canHitFrom(next, cell, foe, this.tiles, this.cols)) continue;
        const terr = TERRAIN[tileAt(this.tiles, this.cols, cell.x, cell.y)];
        const score = (foe.maxHp - foe.hp) * 3 + terr.def * 2 + (foe.hp <= 8 ? 20 : 0);
        if (!best || score > best.score) best = { foe, from: { x: cell.x, y: cell.y }, score };
      }
    }
    if (best) {
      if (best.from.x !== next.x || best.from.y !== next.y) {
        this.queue.push({ type: "move", id: next.id, path: reconstructPath(reach, best.from) });
      }
      this.queue.push({ type: "combat", att: next.id, def: best.foe.id });
      this.queue.push({ type: "delay", dur: 0.12 });
      return;
    }
    if (players.length === 0) {
      next.moved = true;
      return;
    }
    // Real path distance (walls/pillars-aware), not raw hex distance — a straight-line
    // "closest" pick can freeze an enemy in place forever once it's on the far side of an
    // obstacle, because every actual step first reads as moving away (see
    // terrainDistanceField). Computed once per player and reused for both picking who to
    // chase and which reachable cell actually closes the gap.
    const fields = players.map((p) => ({ p, field: terrainDistanceField(p, this.tiles, this.cols, this.rows) }));
    let nearest = fields[0]!;
    for (const f of fields) {
      const dCur = f.field.get(key(next.x, next.y)) ?? Infinity;
      const dBest = nearest.field.get(key(next.x, next.y)) ?? Infinity;
      if (dCur < dBest) nearest = f;
    }
    let closest: Point | null = null;
    let dist = Infinity;
    for (const cell of reach.values()) {
      const d = nearest.field.get(key(cell.x, cell.y)) ?? Infinity;
      if (d < dist) {
        dist = d;
        closest = { x: cell.x, y: cell.y };
      }
    }
    if (closest && (closest.x !== next.x || closest.y !== next.y)) {
      this.queue.push({ type: "move", id: next.id, path: reconstructPath(reach, closest) });
    }
    next.moved = true;
    this.queue.push({ type: "delay", dur: 0.08 });
  }

  pointerMove(cssX: number, cssY: number): void {
    const cell = this.hitCell(cssX, cssY);
    this.hover = cell;
  }

  pointerDown(cssX: number, cssY: number, via: "click" | "tap" = "click"): void {
    if (this.result || this.mode === "locked") return;
    const cell = this.hitCell(cssX, cssY);
    if (!cell) {
      if (this.mode === "selected" || this.mode === "awaitAction") this.deselect();
      return;
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const selected = this.units.find((u) => u.id === this.selectedId);
    const same =
      this.lastClickCell && this.lastClickCell.x === cell.x && this.lastClickCell.y === cell.y && now - this.lastClickAt < 340;
    this.lastClickAt = now;
    this.lastClickCell = cell;
    if (same && (this.mode === "awaitAction" || this.mode === "selected") && selected && occupies(selected, cell.x, cell.y)) {
      this.wait();
      const next = this.units.find((u) => u.side === "player" && u.alive && !u.moved);
      if (next) this.select(next);
      return;
    }
    this.cursor = cell;
    this.ensureVisible(cell.x, cell.y);
    this.handleCell(cell, via);
  }

  keyDown(code: string): void {
    if (this.result || this.mode === "locked") {
      if (code === "KeyE") this.endTurn();
      return;
    }
    if (code === "Enter" || code === "Space") this.handleCell(this.cursor, "click");
    if (code === "Escape") this.cancel();
    if (code === "KeyE") this.endTurn();
    if (code === "KeyZ") this.wait();
  }

  private handleCell(cell: Point, via: "click" | "tap" = "click"): void {
    const occ = occupancy(this.units);
    const here = occ.get(key(cell.x, cell.y));
    const selected = this.units.find((u) => u.id === this.selectedId);

    if (this.mode === "awaitSpell" && selected) {
      this.hover = cell;
      if (!this.spellAimValid(selected, cell)) {
        this.tip =
          this.spellKind === "piercing"
            ? "Escolha uma reta da colmeia."
            : this.spellKind === "cleave"
              ? "Toque num hex vizinho."
              : this.spellKind === "longShot"
                ? "Alvo fora de alcance."
                : "Alvo inválido.";
        this.spellArmed = false;
        sfxPlay.ui();
        return;
      }
      if (
        via === "tap" &&
        (!this.spellArmed || !this.spellAim || this.spellAim.x !== cell.x || this.spellAim.y !== cell.y)
      ) {
        this.spellArmed = true;
        this.spellAim = cell;
        this.tip = "Toque de novo ou Lançar.";
        sfxPlay.ui();
        return;
      }
      this.confirmSpell();
      return;
    }

    if (here && here.side === "player" && here.alive && !here.moved && this.phase === "player") {
      if (selected && this.mode === "awaitAction") {
        if (here.id === selected.id) return;
        this.deselect();
      }
      this.select(here);
      return;
    }
    if (here && here.side === "enemy" && here.alive) {
      if (selected && !selected.acted && this.mode === "awaitOffHand") {
        if (canHitFrom(selected, selected, here, this.tiles, this.cols)) {
          this.commitOffHandAction(selected, here, { x: selected.x, y: selected.y });
          return;
        }
        this.tip = "Fora de alcance.";
        sfxPlay.ui();
        this.inspect(here);
        return;
      }
      if (selected && !selected.acted && (this.mode === "awaitAttack" || this.mode === "awaitAction" || this.mode === "selected")) {
        if (this.mode === "selected") {
          const from = this.attackFrom.get(here.id);
          if (from && (from.x !== selected.x || from.y !== selected.y)) {
            this.commitMove(selected, from, () => {
              const u = this.units.find((x) => x.id === selected.id);
              const f = this.units.find((x) => x.id === here.id);
              if (u && f && u.alive && f.alive && canHitFrom(u, u, f, this.tiles, this.cols)) {
                this.commitAttack(u, f, { x: u.x, y: u.y });
              }
            });
            return;
          }
        }
        if (canHitFrom(selected, selected, here, this.tiles, this.cols)) {
          this.commitAttack(selected, here, { x: selected.x, y: selected.y });
          return;
        }
        if (shotKind(selected) && inWeaponRange(selected.x, selected.y, here.x, here.y, selected.minRange, effectiveMaxRange(selected, tileAt(this.tiles, this.cols, selected.x, selected.y)))) {
          this.tip = TERRAIN[tileAt(this.tiles, this.cols, here.x, here.y)].id === "barricade"
            ? "Barricada bloqueia o projétil."
            : "O terreno alto corta a flecha.";
          sfxPlay.ui();
          this.inspect(here);
          return;
        }
      }
      // Clicking the enemy already under inspection again closes it, same as clicking empty
      // ground deselects a selected hero, instead of just re-inspecting a no-op.
      if (this.inspectedId === here.id && !selected) {
        this.inspectedId = null;
        this.threat = [];
        this.tip = null;
        return;
      }
      this.inspect(here);
      return;
    }
    if (selected && this.mode === "selected") {
      if (this.reach.has(key(cell.x, cell.y)) && !here) {
        this.commitMove(selected, cell);
        return;
      }
    }
    if (selected && this.mode === "awaitAction" && !here) {
      this.deselect();
    }
    if (!here && this.inspectedId && !selected) {
      this.inspectedId = null;
      this.threat = [];
      this.tip = null;
    }
  }

  private commitMove(unit: Unit, to: Point, after?: () => void): void {
    const path = reconstructPath(this.reach, to);
    if (path.length === 0) path.push({ x: unit.x, y: unit.y }, to);
    // Cost of THIS move specifically (from wherever the unit currently stands, not from its
    // turn-start position) — captured now, off the reach map this move was picked from,
    // before it gets cleared/recomputed below. Folded into moveBudgetUsed so a repositioning
    // chain's total distance is capped at the unit's own mov (see effectiveUnitForReach),
    // not re-granted a fresh budget on every hop.
    const stepCost = this.reach.get(key(to.x, to.y))?.cost ?? 0;
    this.mode = "locked";
    this.queue.push({ type: "move", id: unit.id, path });
    this.queue.push({ type: "delay", dur: 0.02 });
    this.onNextIdle = () => {
      unit.x = Math.round(to.x);
      unit.y = Math.round(to.y);
      unit.drawX = unit.x;
      unit.drawY = unit.y;
      unit.moveBudgetUsed += stepCost;
      if (unit.acted) {
        unit.moved = true;
        this.selectedId = null;
        this.pendingFoeId = null;
        this.inspectedId = null;
        this.threat = [];
        this.reach.clear();
        this.attackFrom.clear();
        this.orig = null;
        this.mode = "idle";
        return;
      }
      // Not acted yet — movement isn't a one-shot: the unit stays "selected" with a fresh
      // reach from its new spot, so the player can keep repositioning freely until they
      // either use a skill (see the u.acted branch above, unchanged) or end the turn.
      this.selectedId = unit.id;
      this.mode = "selected";
      this.reach = computeReachable(this.effectiveUnitForReach(unit), this.tiles, this.cols, this.rows, this.units);
      this.attackFrom = attackableEnemies(unit, this.reach, this.units, this.tiles, this.cols);
      after?.();
    };
  }

  private commitAttack(unit: Unit, foe: Unit, from: Point): void {
    const at = { x: Math.round(from.x), y: Math.round(from.y) };
    if (!canHitFrom(unit, at, foe, this.tiles, this.cols)) {
      this.mode = "awaitAction";
      this.tip = "Fora de alcance.";
      return;
    }
    this.mode = "locked";
    if (at.x !== unit.x || at.y !== unit.y) {
      const path = reconstructPath(this.reach, at);
      if (path.length > 1) this.queue.push({ type: "move", id: unit.id, path });
    }
    this.queue.push({ type: "combat", att: unit.id, def: foe.id });
  }

  /** Off-hand attack (a light weapon in the offHand slot) or Shield Bash (a shield
   * there) — whichever EQUIPMENT[unit.offHandId].kind resolves to. Reuses the same
   * "already in range from here" check as a normal Atacar; no move-then-act chaining. */
  private commitOffHandAction(unit: Unit, foe: Unit, from: Point): void {
    const item = unit.offHandId ? EQUIPMENT[unit.offHandId] : null;
    if (!item || !canHitFrom(unit, from, foe, this.tiles, this.cols)) {
      this.mode = "awaitAction";
      this.tip = "Fora de alcance.";
      return;
    }
    this.mode = "locked";
    if (item.kind === "shield") {
      this.queue.push({ type: "combat", att: unit.id, def: foe.id, dmgMul: item.dmgMul ?? 0.75, stunChance: 0.7 });
    } else {
      this.queue.push({
        type: "combat",
        att: unit.id,
        def: foe.id,
        customDice: { dice: item.dice ?? 1, faces: item.faces ?? 4, bonus: item.bonus ?? 0 },
      });
    }
  }

  private castFireball(unit: Unit, click: Point): void {
    const origin = fireballOrigin(click, this.cols, this.rows);
    const tiles = fireballTiles(origin, this.cols, this.rows);
    const ids: string[] = [];
    for (const t of tiles) {
      const u = this.units.find((x) => x.alive && occupies(x, t.x, t.y));
      if (u && !ids.includes(u.id)) ids.push(u.id);
    }
    this.spendTier(unit, "fireball");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    const power = fireballPower(unit.level);
    this.queue.push({
      type: "spell",
      att: unit.id,
      tiles,
      ids,
      dice: power.dice,
      faces: power.faces,
      bonus: power.bonus,
      label: FIREBALL.name,
      spellKind: "fireball",
    });
  }

  private castCausticVenom(unit: Unit, click: Point): void {
    const origin = fireballOrigin(click, this.cols, this.rows);
    const tiles = fireballTiles(origin, this.cols, this.rows);
    const ids: string[] = [];
    for (const t of tiles) {
      const u = this.units.find((x) => x.alive && occupies(x, t.x, t.y));
      if (u && !ids.includes(u.id)) ids.push(u.id);
    }
    const center = this.units.find((x) => x.alive && occupies(x, origin.x, origin.y));
    this.spendTier(unit, "causticVenom");
    this.spellKind = null;
    this.tip = null;
    this.mode = "locked";
    this.queue.push({
      type: "spell",
      att: unit.id,
      tiles,
      ids,
      dice: CAUSTIC_VENOM.splashDice,
      faces: CAUSTIC_VENOM.splashFaces,
      bonus: CAUSTIC_VENOM.splashBonus,
      centerId: center?.id,
      centerDice: CAUSTIC_VENOM.centerDice,
      centerFaces: CAUSTIC_VENOM.centerFaces,
      centerBonus: CAUSTIC_VENOM.centerBonus,
      poison: true,
      label: CAUSTIC_VENOM.name,
      spellKind: "causticVenom",
    });
  }

  panBy(dx: number, dy: number): void {
    this.camX += dx;
    this.camY += dy;
    this.clampCam();
  }

  setZoom(level: number): void {
    const next = Math.max(0, Math.min(ZOOM_RADII.length - 1, Math.round(level)));
    if (next === this.zoom) return;
    const old = ZOOM_RADII[this.zoom]!;
    const neu = ZOOM_RADII[next]!;
    const k = neu / old;
    this.camX = (this.camX + this.viewW / 2) * k - this.viewW / 2;
    this.camY = (this.camY + this.viewH / 2) * k - this.viewH / 2;
    this.zoom = next;
    this.clampCam();
    this.emit();
  }

  setSpeed(mode: "normal" | "fast"): void {
    this.speedMode = mode;
    this.emit();
  }

  cycleZoom(dir: number): void {
    this.setZoom(this.zoom + (dir < 0 ? -1 : 1));
  }

  private boardPad(tile: number): number {
    return tile * 2.4;
  }

  private boardSize(tile: number): { w: number; h: number } {
    const sqrt3 = Math.sqrt(3);
    return {
      w: tile * sqrt3 * (this.cols + 0.5),
      h: tile * (1.5 * (this.rows - 1) + 2) + this.boardPad(tile),
    };
  }

  private clampCam(): void {
    const tile = ZOOM_RADII[this.zoom]!;
    const { w, h } = this.boardSize(tile);
    const maxX = Math.max(0, w - this.viewW);
    const maxY = Math.max(0, h - this.viewH);
    this.camX = Math.min(maxX, Math.max(0, this.camX));
    this.camY = Math.min(maxY, Math.max(0, this.camY));
  }

  ensureVisible(col: number, row: number): void {
    const { cx, cy } = this.hexCenter(col, row);
    const tile = ZOOM_RADII[this.zoom]!;
    const m = 64;
    const top = this.boardPad(tile);
    if (cx < m) this.camX += cx - m;
    if (cy < top) this.camY += cy - top;
    if (cx > this.viewW - m) this.camX += cx - (this.viewW - m);
    if (cy > this.viewH - m) this.camY += cy - (this.viewH - m);
    this.clampCam();
  }

  private focusPlayers(): void {
    const u = this.units.find((x) => x.side === "player" && x.alive) ?? this.units[0];
    if (!u) return;
    this.centerOn(u.x, u.y);
  }

  private centerOn(col: number, row: number): void {
    const { cx, cy } = this.hexCenter(col, row);
    this.camX += cx - this.viewW / 2;
    this.camY += cy - this.viewH / 2;
    this.clampCam();
  }

  private hitCell(cssX: number, cssY: number): Point | null {
    const { ox, oy, tile } = this.layout;
    const sqrt3 = Math.sqrt(3);
    const x = cssX - ox - tile * sqrt3 * 0.5;
    const y = cssY - oy - this.boardPad(tile) - tile;
    const q = ((sqrt3 / 3) * x - (1 / 3) * y) / tile;
    const r = ((2 / 3) * y) / tile;
    const c = cubeRound(q, r, -q - r);
    const col = c.q + (c.r - (c.r & 1)) / 2;
    const row = c.r;
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return { x: col, y: row };
  }

  private hexCenter(col: number, row: number): { cx: number; cy: number } {
    const { ox, oy, tile } = this.layout;
    const sqrt3 = Math.sqrt(3);
    return {
      cx: ox + tile * sqrt3 * (col + 0.5 * (row & 1) + 0.5),
      cy: oy + this.boardPad(tile) + tile * (1.5 * row + 1),
    };
  }

  private hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      const x = cx + size * Math.cos(a);
      const y = cy + size * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /** Multi-hex terrain props draw as one image over their whole footprint's bounding box,
   * not hex-clipped like regular tiles — they don't need to fill the exact hex shape. */
  private drawDecorations(ctx: CanvasRenderingContext2D, tile: number, cssW: number, cssH: number): void {
    const SQRT3 = Math.sqrt(3);
    for (const p of this.decorations) {
      const def = DECORATIONS[p.id];
      const img = this.art.decorations[p.id];
      if (!def || !img) continue;
      let minDx = 0;
      let maxDx = 0;
      let minDy = 0;
      let maxDy = 0;
      let sumCx = 0;
      let sumCy = 0;
      for (const { dx, dy } of def.footprint) {
        minDx = Math.min(minDx, dx);
        maxDx = Math.max(maxDx, dx);
        minDy = Math.min(minDy, dy);
        maxDy = Math.max(maxDy, dy);
        const c = this.hexCenter(p.x + dx, p.y + dy);
        sumCx += c.cx;
        sumCy += c.cy;
      }
      const n = def.footprint.length;
      const cx = sumCx / n;
      const cy = sumCy / n;
      if (cx < -tile * 4 || cy < -tile * 4 || cx > cssW + tile * 4 || cy > cssH + tile * 4) continue;
      const w = tile * SQRT3 * (maxDx - minDx + 1.7);
      const h = tile * (1.5 * (maxDy - minDy) + 2.3);
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }
  }

  private drawBarricadeMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, tile: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(58, 32, 18, 0.38)";
    this.hexPath(ctx, cx, cy, tile * 0.9);
    ctx.fill();
    ctx.strokeStyle = "rgba(196, 148, 96, 0.95)";
    ctx.lineWidth = Math.max(2, tile * 0.08);
    this.hexPath(ctx, cx, cy, tile * 0.82);
    ctx.stroke();
    const w = tile * 0.08;
    ctx.strokeStyle = "#d4b08a";
    ctx.lineWidth = Math.max(2.2, w);
    ctx.lineCap = "round";
    for (let i = -2; i <= 2; i++) {
      const sx = cx + i * tile * 0.16;
      ctx.beginPath();
      ctx.moveTo(sx, cy + tile * 0.3);
      ctx.lineTo(sx, cy - tile * 0.34);
      ctx.stroke();
    }
    ctx.strokeStyle = "#8a5230";
    ctx.lineWidth = Math.max(2.4, tile * 0.07);
    ctx.beginPath();
    ctx.moveTo(cx - tile * 0.4, cy - tile * 0.04);
    ctx.lineTo(cx + tile * 0.4, cy - tile * 0.04);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - tile * 0.38, cy + tile * 0.12);
    ctx.lineTo(cx + tile * 0.38, cy + tile * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  private footprintCentroid(
    x: number,
    y: number,
    size: number,
    footprintW?: number,
    footprintOffsets?: { dx: number; dy: number }[],
  ): { cx: number; cy: number } {
    // Units with an extended footprint anchor on their front tile(s) only — averaging in the
    // cells behind them would drag the sprite's feet upward, off the tile the player actually
    // sees them standing on.
    const cells =
      size >= 4 || footprintOffsets ? footprintFrontRow({ x, y, footprintOffsets }, footprintW ?? 2) : footprint({ x, y, size });
    let cx = 0;
    let cy = 0;
    for (const p of cells) {
      const c = this.hexCenter(p.x, p.y);
      cx += c.cx;
      cy += c.cy;
    }
    const n = Math.max(1, cells.length);
    return { cx: cx / n, cy: cy / n };
  }

  private unitPixel(u: Unit): { cx: number; cy: number } {
    if (this.active && this.active.type === "move" && this.active.id === u.id) {
      const a = this.active;
      const from = a.path[a.i];
      const to = a.path[a.i + 1];
      if (from && to) {
        const dur = 0.12;
        const k = easeOut(Math.min(1, a.t / dur));
        const A = this.footprintCentroid(from.x, from.y, u.size, u.footprintW, u.footprintOffsets);
        const B = this.footprintCentroid(to.x, to.y, u.size, u.footprintW, u.footprintOffsets);
        return { cx: A.cx + (B.cx - A.cx) * k, cy: A.cy + (B.cy - A.cy) * k };
      }
    }
    return this.footprintCentroid(u.x, u.y, u.size, u.footprintW, u.footprintOffsets);
  }

  private idleFrame(u: Unit, n: number): number {
    if (n <= 1) return 0;
    const moving = this.active?.type === "move" && this.active.id === u.id;
    if (u.classId === "wardog") {
      const rate = moving ? 4.2 : 2.6;
      return Math.floor(u.bob * rate) % n;
    }
    const base =
      u.classId === "horror" || u.classId === "troll"
        ? 2.0
        : u.sprite === "kael" || u.classId === "mage" || u.classId === "cultist" || u.classId === "healer"
          ? 1.7
          : u.classId === "captain"
            ? 1.75
            : 1.85;
    const rate = base * (moving ? 2.2 : 1);
    if (moving || this.reducedMotion) return Math.floor(u.bob * rate) % n;
    const cycle = Math.max(2, n * 2 - 2);
    const pace = cycle / 2.6;
    const x = Math.floor(u.bob * pace) % cycle;
    return x < n ? x : cycle - x;
  }

  private attackPose(u: Unit): number | null {
    const frames = this.art.attacks[u.sprite];
    if (!frames || frames.length < 4) return null;
    const a = this.active;
    if (!a) return null;
    const n = frames.length;
    const long = n >= 12;
    if (a.type === "combat") {
      const counter = a.stage.startsWith("counter");
      const actor = counter ? a.def : a.att;
      if (u.id !== actor) return null;
      if (long) {
        if (a.stage === "lunge" || a.stage === "counterLunge") return Math.min(5, Math.floor((a.t / 0.2) * 6));
        if (a.stage === "hit" || a.stage === "counterHit") return Math.min(8, 6 + Math.floor((a.t / 0.18) * 3));
        if (a.stage === "recover" || a.stage === "counterRecover") return Math.min(11, 9 + Math.floor((a.t / 0.16) * 3));
        return 11;
      }
      if (a.stage === "lunge" || a.stage === "counterLunge") return a.t < 0.1 ? 0 : 1;
      if (a.stage === "hit" || a.stage === "counterHit") return 2;
      if (a.stage === "recover" || a.stage === "counterRecover") return 3;
      return 3;
    }
    if ((a.type === "spell" || a.type === "heal") && a.att === u.id) {
      if (long) return Math.min(n - 1, Math.floor(Math.min(0.99, a.t / 0.4) * n));
      if (a.t < 0.12) return 0;
      if (a.t < 0.22) return 1;
      if (a.t < 0.4) return 2;
      return 3;
    }
    return null;
  }

  private liveMotion(u: Unit, cell: number): { bob: number; sway: number; breath: number } {
    if (!u.alive || this.reducedMotion) return { bob: 0, sway: 0, breath: 0 };
    const t = u.bob;
    if (u.classId === "wardog") {
      return {
        bob: Math.sin(t * 2.2) * 1.15,
        sway: 0,
        breath: 0.014 + Math.sin(t * 2.2) * 0.018,
      };
    }
    const heavy = u.size >= 4 ? 1.4 : u.size === 2 ? 1.12 : 1;
    if (u.sprite === "kael" || u.size >= 4) {
      return { bob: 0, sway: 0, breath: 0 };
    }
    const bob = Math.sin(t * 1.55) * (1.15 * heavy);
    const sway = Math.sin(t * 0.85 + 0.3) * (cell * 0.008 * heavy);
    const breath = 0.012 + Math.sin(t * 1.55) * 0.014;
    return { bob, sway, breath };
  }

  render(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, dpr: number): void {
    const sqrt3 = Math.sqrt(3);
    const tile = ZOOM_RADII[this.zoom]!;
    const { w: boardW, h: boardH } = this.boardSize(tile);
    this.viewW = cssW;
    this.viewH = cssH;
    if (!this.camReady) {
      this.layout = { ox: 0, oy: 0, tile, cols: this.cols, rows: this.rows };
      this.camReady = true;
      this.focusPlayers();
    }
    this.clampCam();
    const ox = boardW < cssW ? (cssW - boardW) / 2 : -this.camX;
    const oy = boardH < cssH ? (cssH - boardH) / 2 : -this.camY;
    this.layout = { ox, oy, tile, cols: this.cols, rows: this.rows };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#0c0b0a";
    ctx.fillRect(0, 0, cssW, cssH);

    const shake = this.reducedMotion ? 0 : this.trauma * this.trauma;
    if (shake) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
    }

    // Barricade marks draw in a separate pass after decorations (below) so a barricade
    // always reads in front of a decoration sitting next to it, never the other way
    // around — a decoration's image spills past its own hex (a deliberate fringe margin,
    // see drawDecorations) and would otherwise paint over a barricade drawn earlier.
    const barricades: { cx: number; cy: number }[] = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const { cx, cy } = this.hexCenter(x, y);
        if (cx < -tile * 2 || cy < -tile * 2 || cx > cssW + tile * 2 || cy > cssH + tile * 2) continue;
        const id = tileAt(this.tiles, this.cols, x, y);
        const variants = this.art.tiles[id];
        const variant = this.tileVariants[y * this.cols + x] ?? 0;
        const img = variants[variant] ?? variants[0];
        ctx.save();
        this.hexPath(ctx, cx, cy, tile * 0.98);
        ctx.clip();
        if (img) ctx.drawImage(img, cx - tile, cy - tile, tile * 2, tile * 2);
        else {
          ctx.fillStyle = "#1e1b18";
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = "rgba(240,235,227,0.14)";
        ctx.lineWidth = 1;
        this.hexPath(ctx, cx, cy, tile * 0.98);
        ctx.stroke();
        if (id === "barricade") barricades.push({ cx, cy });
      }
    }

    this.drawDecorations(ctx, tile, cssW, cssH);
    for (const { cx, cy } of barricades) this.drawBarricadeMark(ctx, cx, cy, tile);


    // Every selectable area (walkable ground, spell range, an aimed AoE) gets the same
    // treatment: a soft colored glow plus a bright rim, on top of the flat fill — the flat
    // fill alone reads as a dim tint on some terrain art and is easy to miss. The glow
    // breathes (same sine pulse as the active-turn-unit ring above) rather than sitting
    // static, the classic tactics-RPG "selectable tile" look.
    const glowPulse = this.reducedMotion ? 1 : 0.72 + Math.sin(this.time * 3.2) * 0.28;
    const overlay = (cells: Iterable<Point>, fill: string) => {
      const rgb = /rgba?\(([^),]+),([^),]+),([^),]+)/.exec(fill);
      const [r, g, b] = rgb ? [rgb[1]!.trim(), rgb[2]!.trim(), rgb[3]!.trim()] : ["255", "255", "255"];
      ctx.save();
      ctx.shadowColor = `rgba(${r},${g},${b},${(0.9 * glowPulse).toFixed(3)})`;
      ctx.shadowBlur = tile * (0.32 + 0.34 * glowPulse);
      ctx.fillStyle = fill;
      ctx.strokeStyle = `rgba(${r},${g},${b},${Math.min(1, 0.7 + 0.3 * glowPulse).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.5, tile * (0.05 + 0.03 * glowPulse));
      for (const c of cells) {
        const { cx, cy } = this.hexCenter(c.x, c.y);
        this.hexPath(ctx, cx, cy, tile * 0.92);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    };

    for (const zone of this.webZones) {
      const cells = [...zone.cells].map((k) => {
        const [x, y] = k.split(",").map(Number);
        return { x: x!, y: y! };
      });
      overlay(cells, "rgba(130,100,190,0.3)");
    }

    if (this.mode === "idle" && this.threat.length) overlay(this.threat, "rgba(163,90,74,0.44)");

    if (this.mode === "awaitSpell") {
      const selected = this.units.find((u) => u.id === this.selectedId);
      if (selected && this.spellKind === "fireball") {
        overlay(fireballRangeTiles(selected, this.cols, this.rows), "rgba(196,90,50,0.3)");
        const cell = this.hover ?? this.spellAim;
        if (cell && manhattan(selected, cell) <= FIREBALL.range) {
          overlay(fireballTiles(fireballOrigin(cell, this.cols, this.rows), this.cols, this.rows), "rgba(196,90,50,0.5)");
        }
      } else if (selected && this.spellKind === "causticVenom") {
        overlay(fireballRangeTiles(selected, this.cols, this.rows), "rgba(110,150,60,0.3)");
        const cell = this.hover ?? this.spellAim;
        if (cell && manhattan(selected, cell) <= CAUSTIC_VENOM.range) {
          overlay(fireballTiles(fireballOrigin(cell, this.cols, this.rows), this.cols, this.rows), "rgba(140,190,70,0.5)");
        }
      } else if (selected && this.spellKind === "longShot") {
        const reach: Point[] = [];
        const max = this.longMax(selected);
        for (let y = 0; y < this.rows; y++) {
          for (let x = 0; x < this.cols; x++) {
            const d = manhattan(selected, { x, y });
            if (d >= selected.minRange && d <= max) reach.push({ x, y });
          }
        }
        overlay(reach, "rgba(90,120,70,0.3)");
        const cell = this.hover ?? this.spellAim;
        if (cell && this.spellAimValid(selected, cell)) overlay([cell], "rgba(140,170,80,0.55)");
      } else if (selected && this.spellKind === "piercing") {
        overlay(allAxisRays(selected, this.cols, this.rows), "rgba(120,90,50,0.28)");
        const cell = this.hover ?? this.spellAim;
        const line = cell ? this.piercingRay(selected, cell) : null;
        if (line) overlay(line, "rgba(196,120,50,0.55)");
      } else if (selected && this.spellKind === "piercingThrust") {
        overlay(this.healRangeTiles(selected, selected.maxRange + 1), "rgba(180,120,60,0.28)");
        const cell = this.hover ?? this.spellAim;
        const line = cell ? this.piercingThrustRay(selected, cell) : null;
        if (line) overlay(line, "rgba(220,150,70,0.55)");
      } else if (selected && (this.spellKind === "doubleStrike" || this.spellKind === "trip")) {
        overlay(this.healRangeTiles(selected, selected.maxRange), "rgba(160,90,50,0.3)");
        const cell = this.hover ?? this.spellAim;
        if (cell && this.spellAimValid(selected, cell)) overlay([cell], "rgba(196,90,50,0.55)");
      } else if (selected && this.spellKind === "cleave") {
        overlay(hexNeighbors(selected.x, selected.y), "rgba(160,90,50,0.3)");
        const cell = this.hover ?? this.spellAim;
        const arc = cell ? cleaveHexes(selected, cell, CLEAVE.hexes, this.cols, this.rows) : [];
        if (arc.length) overlay(arc, "rgba(196,90,50,0.55)");
      } else if (selected && this.spellKind === "summonFamiliar") {
        overlay(this.healRangeTiles(selected, SUMMON_FAMILIAR.range), "rgba(140,110,200,0.28)");
        const cell = this.hover ?? this.spellAim;
        if (cell && this.spellAimValid(selected, cell)) overlay([cell], "rgba(180,150,230,0.55)");
      } else if (selected && this.spellKind === "webOfDreams") {
        overlay(this.healRangeTiles(selected, WEB_OF_DREAMS.range), "rgba(120,90,170,0.28)");
        const cell = this.hover ?? this.spellAim;
        if (cell && manhattan(selected, cell) <= WEB_OF_DREAMS.range) {
          overlay(hexAreaTiles(cell, WEB_OF_DREAMS.size, this.cols, this.rows), "rgba(150,110,210,0.5)");
        }
      } else if (selected && this.spellKind === "lightning") {
        overlay(this.healRangeTiles(selected, LIGHTNING.range), "rgba(80,120,170,0.3)");
        const cell = this.hover ?? this.spellAim;
        if (cell && this.spellAimValid(selected, cell)) overlay([cell], "rgba(120,170,220,0.55)");
      } else if (selected && this.spellKind === "magicMissile") {
        overlay(this.healRangeTiles(selected, MAGIC_MISSILE.range), "rgba(130,90,170,0.3)");
        const cell = this.hover ?? this.spellAim;
        if (cell && this.spellAimValid(selected, cell)) overlay([cell], "rgba(180,140,220,0.55)");
      } else if (selected && this.isHeal(this.spellKind)) {
        overlay(this.healRangeTiles(selected, CURES[this.spellKind].range), "rgba(90,140,100,0.34)");
        const cell = this.hover ?? this.spellAim;
        if (cell && this.validHealTarget(selected, cell)) overlay([cell], "rgba(120,180,120,0.55)");
      } else if (selected && this.spellKind === "cureDisease") {
        overlay(this.healRangeTiles(selected, CURE_DISEASE.range), "rgba(90,140,100,0.34)");
        const cell = this.hover ?? this.spellAim;
        if (cell && this.validCureDiseaseTarget(selected, cell)) overlay([cell], "rgba(120,180,120,0.55)");
      }
    }

    if (this.mode === "selected" || this.mode === "awaitAttack" || this.mode === "awaitAction") {
      if (this.mode === "selected") overlay(this.reach.values(), "rgba(61,106,138,0.5)");
      const selected = this.units.find((u) => u.id === this.selectedId);
      const atkTiles: Point[] = [];
      for (const foe of this.units) {
        if (!foe.alive || foe.side === "player") continue;
        if (this.mode === "selected" && this.attackFrom.has(foe.id)) atkTiles.push(...footprint(foe));
        if ((this.mode === "awaitAttack" || this.mode === "awaitAction") && selected && canHitFrom(selected, selected, foe, this.tiles, this.cols)) {
          atkTiles.push(...footprint(foe));
        }
      }
      overlay(atkTiles, "rgba(163,90,74,0.55)");
      if (this.pendingFoeId) {
        const foe = this.units.find((u) => u.id === this.pendingFoeId);
        if (foe) overlay(footprint(foe), "rgba(181,74,50,0.55)");
      }
    }

    // Whose turn it is, drawn last (after the walkable/attack overlays above) so it's never
    // washed out underneath them — the active unit always stands on its own reach overlay,
    // and a thin ring alone got lost under that blue fill. A full golden hex fill, not just
    // a rim, per direct feedback ("the whole hex must get golden").
    const active = this.activeTurnUnit();
    if (active) {
      const { cx, cy } = this.hexCenter(active.x, active.y);
      const pulse = 0.75 + Math.sin(this.time * 4) * 0.25;
      const glowColor = active.side === "enemy" ? "230,120,90" : "255,215,140";
      ctx.save();
      ctx.shadowColor = `rgba(${glowColor},${0.9 * pulse})`;
      ctx.shadowBlur = tile * 0.7 * pulse;
      ctx.fillStyle = `rgba(${glowColor},${(0.34 + 0.18 * pulse).toFixed(3)})`;
      ctx.strokeStyle = `rgba(${glowColor},${0.95 * pulse})`;
      ctx.lineWidth = Math.max(2, tile * 0.09);
      this.hexPath(ctx, cx, cy, tile * 0.94);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const cur = this.hover ?? this.cursor;
    {
      const { cx, cy } = this.hexCenter(cur.x, cur.y);
      const hid = tileAt(this.tiles, this.cols, cur.x, cur.y);
      const ht = TERRAIN[hid];
      const blocked = !ht.passable;
      if (blocked) {
        ctx.save();
        ctx.shadowColor = "rgba(219,58,44,0.95)";
        ctx.shadowBlur = tile * 0.55;
        ctx.strokeStyle = "rgba(255,90,72,0.95)";
        ctx.lineWidth = 3;
        this.hexPath(ctx, cx, cy, tile * 0.9);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = "rgba(240,235,227,0.9)";
        ctx.lineWidth = 2;
        this.hexPath(ctx, cx, cy, tile * 0.9);
        ctx.stroke();
      }
      if (blocked || ht.height) {
        const label = blocked ? ht.name.toUpperCase() : "ALTO +2";
        const fontPx = Math.max(11, Math.round(tile * 0.32));
        ctx.font = `700 ${fontPx}px Figtree, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(3, fontPx * 0.22);
        ctx.strokeStyle = "rgba(12,11,10,0.88)";
        ctx.fillStyle = blocked ? "#ff7a68" : "#efe4c4";
        ctx.strokeText(label, cx, cy + tile * 0.38);
        ctx.fillText(label, cx, cy + tile * 0.38);
      }
    }

    const cell = tile * sqrt3;
    const sorted = [...this.units].sort((a, b) => a.drawY - b.drawY || a.drawX - b.drawX);
    for (const u of sorted) {
      if (u.fade <= 0) continue;
      const s = unitSize(u);
      const boss = u.classId === "captain";
      const { cx: px, cy: py } = this.unitPixel(u);
      const foot = s >= 4 ? 2.15 : s === 2 ? 1.5 : boss ? 1.12 : 1;
      const { bob, sway, breath } = this.liveMotion(u, cell);
      ctx.save();
      ctx.globalAlpha = u.fade * (u.moved && u.side === "player" && this.phase === "player" ? 0.55 : 1);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath();
      ctx.ellipse(
        px + sway,
        py + cell * 0.22,
        cell * 0.22 * foot * (1 + breath * 0.4),
        cell * 0.1 * Math.min(2.2, foot) * (1 - breath * 0.3),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      const atk = this.attackPose(u);
      const moving = this.active?.type === "move" && this.active.id === u.id;
      const idle = !atk && !moving ? this.art.idles[u.sprite] : undefined;
      const frames = atk != null ? this.art.attacks[u.sprite] : idle ?? this.art.sprites[u.sprite];
      const n = frames?.length ?? 0;
      const fi = atk != null ? atk : this.idleFrame(u, n || 4);
      const walkDirs = moving ? this.art.walkDirs[u.sprite] : undefined;
      const img = (walkDirs ? walkDirs[u.walkPose] : undefined) ?? frames?.[fi] ?? frames?.[0];
      // The draw-size correction keys off the footprint SHAPE (reference equality against
      // FOOTPRINT_TYPE_8), not a hardcoded classId — every Type 8 creature (Troll, Asherah/
      // Ember Starved, and any future one) gets the same default correction automatically,
      // rather than needing its own one-off case added here. Depends on that creature's own
      // sprite frames being cropped to roughly the same canvas-fill ratio as the others —
      // this correction assumes that, it doesn't measure it.
      const isType8 = u.footprintOffsets === FOOTPRINT_TYPE_8;
      const h = cell * (s >= 4 ? 3.35 : s === 2 ? 1.72 : boss ? 1.44 : 1.42) * 1.2 * (isType8 ? 0.75 : 1);
      const w = cell * (s >= 4 ? 2.85 : s === 2 ? 1.85 : boss ? 1.12 : 1.11) * 1.2 * (isType8 ? 0.75 : 1);
      // Big creatures plant their feet at the bottom corner of their front hex (tile * 0.9,
      // matching the hex outline radius used elsewhere) instead of the smaller offset tuned
      // for normal-size sprites, so the feet don't float above the tile they stand on.
      const footY = s >= 4 ? tile * 0.9 : cell * 0.42;
      ctx.translate(px + sway, py + footY + bob);
      if (u.sprite === "kael") ctx.scale(u.facing, 1);
      else ctx.scale(u.facing * (1 - breath * 0.22), 1 + breath);
      if (u.flash > 0) ctx.filter = `brightness(${1.8 + u.flash})`;
      if (img) ctx.drawImage(img, -w / 2, -h, w, h);
      else {
        ctx.fillStyle = u.side === "player" ? "#8a97a1" : "#a35a4a";
        ctx.fillRect(-w / 2, -h, w, h);
      }
      ctx.filter = "none";
      ctx.restore();

      if (u.alive) {
        const bw = cell * (s >= 4 ? 1.35 : s === 2 ? 0.9 : boss ? 0.68 : 0.62);
        const bh = Math.max(4, cell * 0.07);
        const bx = px - bw / 2;
        const by = py - h + cell * 0.42 + bob - Math.max(8, cell * 0.12);
        ctx.fillStyle = "rgba(12,11,10,0.82)";
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = "#2c2824";
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = u.side === "player" ? "#c8c4bc" : "#b54a32";
        ctx.fillRect(bx, by, bw * Math.max(0, u.hp / u.maxHp), bh);
        if (cell >= 32) {
          ctx.font = `600 ${Math.round(cell * 0.22)}px Figtree, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(12,11,10,0.9)";
          ctx.fillStyle = "#f0ebe3";
          ctx.strokeText(`${u.hp}`, px, by - 1);
          ctx.fillText(`${u.hp}`, px, by - 1);
        }
        if (u.stunned) {
          const gx = px;
          const gy = by - bh - cell * 0.16;
          const r = cell * 0.13;
          const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
          glow.addColorStop(0, "rgba(255,90,70,0.95)");
          glow.addColorStop(0.6, "rgba(255,60,50,0.55)");
          glow.addColorStop(1, "rgba(255,60,50,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(gx, gy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (u.id === this.selectedId) {
        ctx.strokeStyle = "#d8d3cc";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(px + sway, py + cell * 0.22, cell * 0.32 * foot, cell * 0.12 * Math.min(2.2, foot), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (this.particleLive) {
      const dmgCell = tile * Math.sqrt(3);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of this.particles) {
        if (!p.live || p.kind === "text") continue;
        const { cx, cy } = this.hexCenter(Math.round(p.x), Math.round(p.y));
        const px = cx;
        const py = cy - tile * 0.2;
        ctx.globalAlpha = 1 - p.life / p.max;
        if (p.kind === "impact") {
          const img = this.art.impact[Math.min(3, Math.floor(p.frame))];
          if (img) ctx.drawImage(img, px - tile * 0.45, py - tile * 0.45, tile * 0.9, tile * 0.9);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(px, py, p.size, p.size);
        }
      }
      for (const p of this.particles) {
        if (!p.live || p.kind !== "text" || !p.text) continue;
        const { cx, cy } = this.hexCenter(Math.round(p.x), Math.round(p.y));
        const fade = 0.4;
        const a = p.life < p.max - fade ? 1 : Math.max(0, 1 - (p.life - (p.max - fade)) / fade);
        ctx.globalAlpha = a;
        const fontPx = Math.max(16, Math.round(dmgCell * 0.42));
        ctx.font = `800 ${fontPx}px Figtree, sans-serif`;
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(4, fontPx * 0.22);
        ctx.strokeStyle = "rgba(12,11,10,0.92)";
        ctx.fillStyle = p.color;
        ctx.strokeText(p.text, cx, cy - dmgCell * 0.85 - p.life * 16);
        ctx.fillText(p.text, cx, cy - dmgCell * 0.85 - p.life * 16);
      }
      ctx.globalAlpha = 1;
    }

    if (shake) ctx.restore();
  }
}
