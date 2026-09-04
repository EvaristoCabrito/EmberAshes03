import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Pencil, RotateCcw, Swords, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadGameArt, TILE_VARIANT_COUNT } from "./assets";
import { installAudioUnlock, playMenuMusic, playTheme, resumeAudio, setMuted, sfxPlay, stopMusic, unlockAudio } from "./audio";
import { BattleCanvas } from "./BattleCanvas";
import { InnScreen } from "./InnScreen";
import { BackpackScreen, PaperDollScreen } from "./InventoryScreens";
import { CAUSTIC_VENOM, CHEST_LOOT, CLASSES, CLEAVE, CURE_DISEASE, CURES, DECORATIONS, DOUBLE_STRIKE, EQUIPMENT, EXP_TO_LEVEL, FIREBALL, KILL_DROP_CHANCE, LIGHTNING, LONG_SHOT, MAGIC_MISSILE, PIERCING, PIERCING_THRUST, MAX_LEVEL, MISSIONS, POTIONS, POTION_LOOT_WEIGHT, PROMOTE_LEVEL, PROMOTED_BASE, PROMOTIONS, SUMMON_FAMILIAR, SWEEP, TRIP, TERRAIN, TILE_CHAR, WEAPONS, WEAPON_MAX_ENH, WEB_OF_DREAMS, WORLD_LOCATIONS, BAG_MAX, LOCKPICK_PRICE, POTION_CARRY_MAX, POTION_PRICE, decorationCells, decorationImage, diceFormula, emberForKill, enemyLevelFor, fireballFormula, lightningFormula, locationForMission, missionById, missionsForLocation, parseLayout, potionLabel, rangeLabel, sheetLine, spellTier, startingBags, statsFor, terrainNote, tierKey, tierUses, weaponEnhCost, weaponSellValue, type SpellTier } from "./data";
import { BattleEngine } from "./engine";
import { WorldMapScreen } from "./WorldMapScreen";
import {
  activeSave,
  emptySave,
  formatStamp,
  hasAnySave,
  isSlotEmpty,
  loadBank,
  setMutedBank,
  SLOT_COUNT,
  slotProgress,
  writeSlot,
  selectSlot,
} from "./save";
import type { ClassId, DecorationPlacement, EquipSlot, GameArt, GrowthLine, HudSnapshot, Mission, PotionId, SaveBank, SaveData, ScreenId, SpellKind, Spawn, TerrainId, UnitPublic, WinCondition, WorldLocation } from "./types";

function hudBlank(): HudSnapshot {
  return {
    phase: "player",
    banner: null,
    selected: null,
    hoveredUnit: null,
    terrain: null,
    mode: "idle",
    canAttack: false,
    offHandKind: null,
    canLockpick: false,
    forecast: null,
    turn: 1,
    objective: "",
    missionTitle: "",
    playerAlive: 0,
    enemyAlive: 0,
    busy: false,
    result: null,
    winAvailable: false,
    zoom: 1,
    speedMode: "normal",
    tip: null,
    inspected: null,
    pendingFoe: null,
    spellReady: false,
    spellKind: null,
    turnQueue: [],
    log: [],
  };
}

function innUnlocked(completed: string[]): boolean {
  return completed.includes("estalagem");
}

function lockedMission(id: string, completed: string[], test: boolean): boolean {
  if (test) return false;
  const m = missionById(id);
  if (!m) return true;
  if (m.hub) return !innUnlocked(completed) && !MISSIONS.some((x) => x.index === m.index - 1 && completed.includes(x.id));
  if (completed.includes(id)) return true;
  if (m.index === 0) return false;
  const prev = MISSIONS.find((x) => x.index === m.index - 1);
  return prev ? !completed.includes(prev.id) : false;
}

/** Per-mission status for the world map's location chapter list — "done" once completed,
 * else whatever lockedMission says, so chapters within a multi-mission location open one
 * at a time in the same order the flat campaign list already enforces. */
function missionStatus(id: string, completed: string[], test: boolean): "locked" | "available" | "done" {
  if (completed.includes(id)) return "done";
  return lockedMission(id, completed, test) ? "locked" : "available";
}

/** A world map location is "done" once every mission it covers is completed, "available"
 * once its next not-yet-completed mission is reachable, else "locked". */
function locationStatus(loc: WorldLocation, completed: string[], test: boolean): "locked" | "available" | "done" {
  const missions = missionsForLocation(loc);
  const next = missions.find((m) => !completed.includes(m.id));
  if (!next) return missions.length > 0 ? "done" : "locked";
  return missionStatus(next.id, completed, test) === "locked" ? "locked" : "available";
}

const BRIEF_ART: Record<string, string> = {
  vau: "/game/assets/brief-vau.jpg",
  bosque: "/game/assets/brief-bosque.jpg?v=2",
  aldeia: "/game/assets/brief-aldeia.jpg",
  muralha: "/game/assets/brief-muralha.jpg",
  fortaleza: "/game/assets/brief-fortaleza.jpg",
  templo: "/game/assets/brief-templo.jpg",
  cripta: "/game/assets/brief-cripta.jpg",
  estalagem: "/game/assets/brief-estalagem.jpg",
  colina: "/game/assets/brief-colina.jpg",
  passagem: "/game/assets/brief-passagem.jpg?v=2",
  vertente: "/game/assets/brief-vertente.jpg?v=2",
  portao: "/game/assets/brief-portao.jpg",
};

function briefArt(id: string): string | null {
  return BRIEF_ART[id] ?? null;
}

const HERO_PORTRAIT: Partial<Record<string, string>> = {
  kael: "/game/portraits/kael.png?v=2",
  nira: "/game/portraits/nira.png",
  voss: "/game/portraits/voss.png",
  salazar: "/game/portraits/salazar.png",
  malrec: "/game/portraits/malrec.png",
  aldric: "/game/portraits/aldric.png",
};

// Only the small pouch exists as a carried-bag icon so far — swap this to read the party's
// actual pouch tier once the shared-capacity upgrade system (small/mid/large) is built.
const BAG_ICON = "/game/icons/equipment/small-leather-pouch.png";

type SlotAction = { kind: "spell"; spell: SpellKind } | { kind: "potion"; potion: PotionId };
const HOTBAR_SLOTS = 12;
/** Modo teste: Ember "infinito" pra testar compras/upgrades sem travar em custo. */
const TEST_EMBER = 900000;
const ALL_POTIONS: PotionId[] = ["weak", "mid", "potent", "disease", "manaSmall", "manaMid", "manaLarge"];
const HOTBAR_KEY = "ember-hotbar-v1";

function classSpells(classId: ClassId): SpellKind[] {
  // Promoted classes keep everything the base class already granted (hybrid, nothing
  // lost at PROMOTE_LEVEL) — prestige-only spells get their own case here once designed.
  switch (PROMOTED_BASE[classId] ?? classId) {
    case "swordsman":
      return ["doubleStrike", "cleave"];
    case "mage":
      return ["magicMissile", "lightning", "fireball", "causticVenom"];
    case "conjurer":
      // Phantasmal Force / Summon Swarm (tiers 3-4) join this list as they're built — see
      // SPELL_TIER for the intended tier assignment.
      return ["summonFamiliar", "webOfDreams"];
    case "archer":
      return ["longShot", "piercing"];
    case "healer":
      return ["cureMinor", "cureWounds", "cureDisease"];
    case "lancer":
      return ["piercingThrust", "sweep", "trip"];
    default:
      return [];
  }
}

function defaultSlots(classId: ClassId): (SlotAction | null)[] {
  const combined: SlotAction[] = [
    ...classSpells(classId).map((spell): SlotAction => ({ kind: "spell", spell })),
    ...ALL_POTIONS.map((potion): SlotAction => ({ kind: "potion", potion })),
  ];
  const slots: (SlotAction | null)[] = combined.slice(0, HOTBAR_SLOTS);
  while (slots.length < HOTBAR_SLOTS) slots.push(null);
  return slots;
}

function loadHotbars(): Record<string, (SlotAction | null)[]> {
  try {
    const raw = window.localStorage.getItem(HOTBAR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHotbars(bars: Record<string, (SlotAction | null)[]>) {
  try {
    window.localStorage.setItem(HOTBAR_KEY, JSON.stringify(bars));
  } catch {
    // localStorage unavailable — hotbar just won't persist across reloads
  }
}

function slotIcon(action: SlotAction): string {
  if (action.kind === "potion") return `/game/icons/potion-${action.potion}.png`;
  switch (action.spell) {
    case "doubleStrike":
      return "/game/icons/cleave.png";
    case "cleave":
      return "/game/icons/cleave-crossed-blades.png";
    case "fireball":
      return "/game/icons/fireball.png";
    case "causticVenom":
      return "/game/icons/caustic-venom.png";
    case "lightning":
      return "/game/icons/lightning.png?v=4";
    case "magicMissile":
      return "/game/icons/magic-missile.png";
    case "longShot":
      return "/game/icons/long-shot.png?v=3";
    case "piercing":
      return "/game/icons/piercing.png?v=3";
    case "cureMinor":
      return "/game/icons/cure-minor.png?v=5";
    case "cureWounds":
      return "/game/icons/cure-wounds.png?v=5";
    case "cureDisease":
      return "/game/icons/cure-minor.png?v=5";
    // Lancer's kit has no dedicated art yet — borrowed placeholders, distinct from each
    // other within Aldric's own hotbar even though they overlap other classes' icons.
    case "piercingThrust":
      return "/game/icons/piercing.png?v=3";
    case "sweep":
      return "/game/icons/cleave-crossed-blades.png";
    case "trip":
      return "/game/icons/cleave.png";
    case "summonFamiliar":
      return "/game/icons/magic-missile.png";
    // No dedicated web/mist art yet — the caustic-venom cloud icon is the closest existing
    // placeholder for a hazy area effect, and doesn't collide with anything else in the
    // Conjurer's own hotbar (their kit no longer shares Mage's spell list).
    case "webOfDreams":
      return "/game/icons/caustic-venom.png";
  }
}

function slotLabel(action: SlotAction): string {
  if (action.kind === "potion") return potionLabel(action.potion);
  switch (action.spell) {
    case "doubleStrike":
      return DOUBLE_STRIKE.name;
    case "cleave":
      return CLEAVE.name;
    case "fireball":
      return FIREBALL.name;
    case "causticVenom":
      return CAUSTIC_VENOM.name;
    case "lightning":
      return LIGHTNING.name;
    case "magicMissile":
      return MAGIC_MISSILE.name;
    case "longShot":
      return LONG_SHOT.name;
    case "piercing":
      return PIERCING.name;
    case "cureMinor":
      return CURES.cureMinor.name;
    case "cureWounds":
      return CURES.cureWounds.name;
    case "cureDisease":
      return CURE_DISEASE.name;
    case "piercingThrust":
      return PIERCING_THRUST.name;
    case "sweep":
      return SWEEP.name;
    case "trip":
      return TRIP.name;
    case "summonFamiliar":
      return SUMMON_FAMILIAR.name;
    case "webOfDreams":
      return WEB_OF_DREAMS.name;
  }
}

function slotTooltip(action: SlotAction): string {
  const label = slotLabel(action);
  if (action.kind === "potion") {
    const def = POTIONS[action.potion];
    if (def.effect === "mana") {
      const restore = def.manaRestore ?? 0;
      return `${label} · restaura ${restore} uso${restore === 1 ? "" : "s"} de cada magia que ainda tem carga disponível, sem passar do máximo de cada nível.`;
    }
  }
  return label;
}

function slotCount(action: SlotAction, unit: UnitPublic): number {
  if (action.kind === "potion") return unit.bag[action.potion];
  const tier = spellTier(action.spell);
  return tier ? unit.spells[tierKey(tier)] : 0;
}

export function GameApp() {
  const [screen, setScreen] = useState<ScreenId>("title");
  const [bank, setBank] = useState<SaveBank>(() => (typeof window === "undefined" ? { version: 7, lastSlot: 0, muted: false, slots: [null, null, null, null, null] } : loadBank()));
  const save = activeSave(bank);
  const [art, setArt] = useState<GameArt | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [engine, setEngine] = useState<BattleEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(hudBlank);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [muted, setMutedUi] = useState(() => (typeof window === "undefined" ? false : loadBank().muted));
  const muteReady = useRef(false);
  const [lastGrowth, setLastGrowth] = useState<GrowthLine[] | null>(null);
  const [lastLoot, setLastLoot] = useState<string[]>([]);
  const [pendingPromotions, setPendingPromotions] = useState<{ name: string; options: [ClassId, ClassId] }[]>([]);
  // Set right after a victory that leaves more chapters at the same location — the world
  // map opens with that location's chapter list already popped open instead of the bare
  // map, so a multi-mission location plays as one continuous series of combats.
  const [openLocationOnMap, setOpenLocationOnMap] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testEmber, setTestEmber] = useState(TEST_EMBER);
  const awardedRef = useRef<string | null>(null);
  const combatStartRef = useRef<SaveData | null>(null);
  const [slotMode, setSlotMode] = useState<"new" | "continue" | "save" | "load" | null>(null);
  const [overwrite, setOverwrite] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadGameArt()
      .then((a) => {
        if (alive) setArt(a);
      })
      .catch((err: Error) => {
        if (alive) setLoadError(err.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setMuted(muted);
    if (!muteReady.current) {
      muteReady.current = true;
      return;
    }
    setBank((b) => setMutedBank(b, muted));
  }, [muted]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") resumeAudio();
    };
    document.addEventListener("visibilitychange", onVis);
    const disarm = installAudioUnlock();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      disarm();
    };
  }, []);

  const [customMission, setCustomMission] = useState<Mission | null>(null);
  const mission = customMission && customMission.id === missionId ? customMission : missionId ? resolveMission(missionId) : undefined;
  const hasProgress = hasAnySave(bank);

  const applySlot = (next: SaveBank) => {
    setBank(next);
    const rec = activeSave(next);
    combatStartRef.current = rec;
  };

  const persistCurrent = (data: SaveData, slot = bank.lastSlot) => {
    const next = writeSlot(bank, slot, { ...data, muted });
    applySlot(next);
    return next;
  };

  const enterFromSave = (rec: SaveData) => {
    setTestMode(false);
    setLastGrowth(null);
    setLastLoot([]);
    if (rec.pendingMission && resolveMission(rec.pendingMission)) {
      setMissionId(rec.pendingMission);
      setScreen("briefing");
      return;
    }
    setMissionId(null);
    setScreen("worldMap");
  };

  const startBattle = useCallback(
    (id: string, carried = save.unitHp, override?: Mission, playerLevels?: Record<string, number>, enemyLevels?: Record<string, number>) => {
      if (!art) return;
      // A real mission start (no override) always clears any leftover playtest identity —
      // otherwise a stale customMission from an earlier Map Editor session can collide
      // with a real campaign mission of the same id (missionToDraft now targets the real
      // id for versioning) and reroute a normal victory back into the editor.
      if (!override) {
        setCustomMission(null);
      }
      const m = override ?? resolveMission(id);
      if (!m) return;
      const levels: Record<string, number> = testMode
        ? override
          ? Object.fromEntries(m.playerSpawns.map((s) => [s.name, playerLevels?.[s.name] ?? m.index + 1]))
          : { Kael: m.index + 1, Neera: m.index + 1, Voss: m.index + 1, Salazar: m.index + 1 }
        : save.levels;
      const bags = testMode ? startingBags() : save.bags;
      // Partial progress toward the next level (not enough to level up yet) has to carry
      // into the battle same as levels/bags do — otherwise every mission start quietly
      // zeroes out whatever XP was left over from the previous one, most visibly when
      // replaying an already-completed mission with nothing left to kill.
      const xp = testMode ? undefined : save.xp;
      // Test mode always starts at full HP — half-HP carry-over only makes sense for real runs.
      const hp = testMode ? {} : { ...carried };
      if (!testMode) {
        const snapshot: SaveData = {
          ...save,
          unitHp: hp,
          levels,
          bags,
          pendingMission: id,
          muted,
        };
        combatStartRef.current = snapshot;
        persistCurrent(snapshot);
      }
      const promotions = testMode ? {} : save.promotions;
      const weapons = testMode
        ? undefined
        : Object.fromEntries(Object.entries(save.equipped).map(([hero, id]) => [hero, { id, enh: save.weapons[id] ?? 0 }]));
      const offHand = testMode
        ? undefined
        : Object.fromEntries(
            Object.entries(save.equipment)
              .map(([hero, e]) => [hero, e.offHand] as const)
              .filter((entry): entry is [string, string] => !!entry[1]),
          );
      const ownedWeaponIds = testMode ? undefined : Object.keys(save.weapons);
      // Spell tier uses don't refill between missions within the same world-map location's
      // run (a "scenario") — only once the whole scenario is done, per direct instruction.
      // Stone Bridge (the tutorial) always resets, and so does the very first mission of any
      // scenario (nothing to carry over yet).
      const loc = locationForMission(m.id);
      const scenarioStart = !loc || loc.id === "stonebridge" || loc.missionIds.every((mid) => !save.completed.includes(mid));
      const spellSpent = testMode || scenarioStart ? undefined : save.spellUses;
      const battle = new BattleEngine(m, art, { hp, levels, bags, xp, promotions, weapons, offHand, enemyLevels, ownedWeaponIds, spellSpent }, Date.now() % 100000);
      if (typeof window !== "undefined" && window.innerWidth < 720) battle.zoom = 0;
      awardedRef.current = null;
      setEngine(battle);
      setMissionId(id);
      setHud(battle.getHud());
      setPaused(false);
      setSlotMode(null);
      setScreen("battle");
    },
    [art, save, testMode, muted, bank],
  );

  const onHud = useCallback((next: HudSnapshot) => {
    setHud(next);
  }, []);

  useEffect(() => {
    if (screen !== "battle" || !hud.result) return;
    const t = window.setTimeout(() => {
      if (hud.result === "victory" && (missionId === "templo" || missionId === "portao")) {
        setScreen("epilogue");
        return;
      }
      if (hud.result) setScreen(hud.result);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [hud.result, screen, missionId]);

  const persistVictory = useCallback(() => {
    if (!engine || !mission) return;
    const battleHp = engine.battlePlayerHp();
    const bags = engine.remainingBags();
    const growth: GrowthLine[] = [];
    const newPromotions: { name: string; options: [ClassId, ClassId] }[] = [];
    const levels = { ...save.levels };
    const xp = { ...(save.xp ?? {}) };
    const hp: Record<string, number> = {};
    for (const u of engine.units.filter((x) => x.side === "player")) {
      // Levels (and any level-ups from XP earned mid-battle) already happened live in the
      // engine — `from` is just whatever was on file before this mission started.
      const from = levels[u.name] ?? u.level;
      const to = u.level;
      const stFrom = statsFor(u.classId, from);
      const stTo = statsFor(u.classId, to);
      const mag = CLASSES[u.classId].mag > 0;
      const battle = battleHp[u.name] ?? u.hp;
      const healed = u.alive
        ? Math.min(stTo.hp, battle + Math.ceil((stTo.hp - battle) * 0.5))
        : Math.max(1, Math.ceil(stTo.hp * 0.5));
      const restHp = u.alive ? healed - battle : healed;
      hp[u.name] = healed;
      growth.push({
        name: u.name,
        from,
        to,
        hpBattle: battle,
        maxFrom: stFrom.hp,
        restHp,
        levelHp: stTo.hp - stFrom.hp,
        hpCamp: healed,
        maxTo: stTo.hp,
        powerFrom: mag ? stFrom.mag : stFrom.atk,
        powerTo: mag ? stTo.mag : stTo.atk,
        powerKind: mag ? "MAG" : "AT",
        atkFrom: stFrom.atk,
        atkTo: stTo.atk,
        magFrom: stFrom.mag,
        magTo: stTo.mag,
        defFrom: stFrom.def,
        defTo: stTo.def,
        resFrom: stFrom.res,
        resTo: stTo.res,
        fallen: !u.alive,
        xp: u.xp,
        xpFrom: from === to ? (save.xp?.[u.name] ?? 0) : 0,
      });
      if (!testMode && u.alive) {
        levels[u.name] = to;
        xp[u.name] = u.xp;
      }
      const options = PROMOTIONS[u.classId];
      if (!testMode && u.alive && options && !save.promotions[u.name] && from < PROMOTE_LEVEL && to >= PROMOTE_LEVEL) {
        newPromotions.push({ name: u.name, options });
      }
    }
    setLastGrowth(growth);
    if (newPromotions.length > 0) setPendingPromotions(newPromotions);
    if (awardedRef.current === mission.id) return;
    awardedRef.current = mission.id;
    const completed = save.completed.includes(mission.id) ? save.completed : [...save.completed, mission.id];
    if (!testMode) {
      const loot = engine.units
        .filter((x) => x.side === "enemy" && !x.alive)
        .reduce((n, u) => n + emberForKill(u.classId), 0);
      const weapons = { ...save.weapons };
      const found: string[] = [];
      // Weapon drops are already resolved and logged live, in-battle, by the engine
      // (kill drops in markDead, chest loot in useLockpick — both ownership- and
      // mission-level-aware). This just folds engine.lootWeapons into the save; it used to
      // ALSO roll its own separate 15%-per-dead-enemy chance here, completely independent
      // of and in addition to the engine's roll, silently doubling the real drop odds.
      for (const id of engine.lootWeapons) {
        if (weapons[id] == null) {
          weapons[id] = 0;
          found.push(WEAPONS[id]!.name);
        }
      }
      // Equipment found in chests goes to the party's shared, unassigned stash — never
      // auto-equipped onto whoever happened to open the chest — so the player assigns it to
      // whichever hero they want from the Paperdoll picker afterward.
      const looseEquipment = { ...save.looseEquipment };
      for (const id of engine.lootEquipment) {
        looseEquipment[id] = (looseEquipment[id] ?? 0) + 1;
        found.push(EQUIPMENT[id]!.name);
      }
      setLastLoot(found);
      persistCurrent({
        ...save,
        completed,
        unitHp: hp,
        bags,
        levels,
        xp,
        weapons,
        looseEquipment,
        // engine.spentTiers() already reflects the full scenario-cumulative total (it was
        // seeded from save.spellUses at battle start unless this mission reset the
        // scenario) — a straight overwrite, not a merge.
        spellUses: engine.spentTiers(),
        ember: (save.ember ?? 0) + loot + engine.lootEmber,
        emberSeeded: true,
        muted,
        pendingMission: null,
      });
    }
  }, [engine, mission, save, testMode, muted, bank]);

  useEffect(() => {
    if (screen === "victory") persistVictory();
  }, [screen, persistVictory]);

  const choosePromotion = (name: string, classId: ClassId) => {
    sfxPlay.ui();
    persistCurrent({ ...save, promotions: { ...save.promotions, [name]: classId } });
    setPendingPromotions((list) => list.filter((p) => p.name !== name));
  };

  const bootAudio = () => {
    unlockAudio();
    sfxPlay.ui();
  };

  const openMission = (id: string) => {
    bootAudio();
    setCustomMission(null);
    setMissionId(id);
    setScreen("briefing");
  };

  const beginMission = () => {
    if (!missionId) return;
    bootAudio();
    if (missionId === "templo") {
      setScreen("cutscene");
      return;
    }
    if (mission?.hub || missionId === "estalagem") {
      const completed = save.completed.includes(missionId) ? save.completed : [...save.completed, missionId];
      if (!testMode) persistCurrent({ ...save, completed, pendingMission: null });
      setScreen("inn");
      return;
    }
    startBattle(missionId);
  };

  useEffect(() => {
    if (muted) {
      stopMusic();
      return;
    }
    if (screen === "boot" || screen === "cutscene" || screen === "epilogue") {
      stopMusic();
      return;
    }
    // Victory/defeat and the mission briefing keep whatever track that mission plays
    // instead of falling through to the menu theme below — a win screen or a briefing
    // is still "in" that mission, not back at the title.
    const inMission = screen === "battle" || screen === "victory" || screen === "defeat" || screen === "briefing";
    if (inMission && missionId === "templo") {
      playTheme("temple");
      return;
    }
    if (inMission && missionId === "aldeia") {
      playTheme("aldeia");
      return;
    }
    if (inMission && (missionId === "vau" || missionId === "bosque" || missionId === "cripta" || missionId === "vertente")) {
      playTheme("early");
      return;
    }
    if (screen === "inn") {
      playTheme("inn");
      return;
    }
    if (screen === "worldMap") {
      playTheme("worldMap");
      return;
    }
    if (inMission && (missionId === "muralha" || missionId === "fortaleza")) {
      playTheme("siege");
      return;
    }
    if (inMission && (missionId === "colina" || missionId === "passagem")) {
      playTheme("hill");
      return;
    }
    if (inMission && missionId === "portao") {
      playTheme("portao");
      return;
    }
    if (inMission) {
      playTheme("early");
      return;
    }
    playMenuMusic();
  }, [screen, muted, missionId]);

  const leaveBoot = useCallback(() => {
    playMenuMusic();
    setScreen("worldMap");
  }, []);

  return (
    <main className="relative h-dvh min-h-0 bg-bg text-fg overflow-hidden">
      {screen === "boot" && (
        <CutsceneScreen src="/game/title-open.mp4" muted={false} onSkip={leaveBoot} />
      )}
      {screen === "title" && (
        <TitleScreen
          ready={!!art}
          error={loadError}
          hasProgress={hasProgress}
          muted={muted}
          help={help}
          onMute={() => {
            unlockAudio();
            setMutedUi((v) => !v);
          }}
          onHelp={() => setHelp((v) => !v)}
          onNew={() => {
            bootAudio();
            setTestMode(false);
            setOverwrite(null);
            setSlotMode("new");
          }}
          onContinue={() => {
            bootAudio();
            setTestMode(false);
            setOverwrite(null);
            setSlotMode("continue");
          }}
          onTest={() => {
            bootAudio();
            setTestMode(true);
            setTestEmber(TEST_EMBER);
            setLastGrowth(null);
            setLastLoot([]);
            setMissionId(null);
            setScreen("testMenu");
          }}
        />
      )}

      {screen === "testMenu" && (
        <TestMenuScreen
          onBack={() => setScreen("title")}
          onDebug={() => setScreen("worldMap")}
          onMapEditor={() => setScreen("mapEditor")}
        />
      )}

      {screen === "mapEditor" && (
        <MapEditorScreen
          onBack={() => setScreen("testMenu")}
          onPlaytest={(m, playerLevels, enemyLevels) => {
            setCustomMission(m);
            startBattle(m.id, {}, m, playerLevels, enemyLevels);
          }}
        />
      )}

      {screen === "campaign" && (
        <CampaignScreen
          completed={save.completed}
          test={testMode}
          ember={testMode ? testEmber : (save.ember ?? 0)}
          onBack={() => (testMode ? setScreen("testMenu") : setScreen("worldMap"))}
          onPick={openMission}
        />
      )}

      {screen === "worldMap" && (
        <WorldMapScreen
          locations={WORLD_LOCATIONS}
          status={(loc) => locationStatus(loc, save.completed, testMode)}
          missionStatus={(id) => missionStatus(id, save.completed, testMode)}
          ember={testMode ? testEmber : (save.ember ?? 0)}
          test={testMode}
          muted={muted}
          onMute={() => {
            unlockAudio();
            setMutedUi((v) => !v);
          }}
          autoOpenLocationId={openLocationOnMap}
          centerLocationId={locationForMission(MISSIONS.find((m) => !m.hub && !save.completed.includes(m.id))?.id ?? "")?.id ?? null}
          onBack={() => setScreen(testMode ? "testMenu" : "title")}
          onPick={openMission}
          onOpenList={() => setScreen("campaign")}
        />
      )}

      {screen === "briefing" && mission && (
        <BriefingScreen mission={mission} onBack={() => setScreen("worldMap")} onStart={beginMission} />
      )}

      {screen === "inn" && (
        <InnScreen
          bags={save.bags}
          ember={testMode ? testEmber : (save.ember ?? 0)}
          muted={muted}
          weapons={save.weapons}
          equipped={save.equipped}
          heroClass={Object.fromEntries(DEFAULT_HEROES.map((h) => [h.name, save.promotions[h.name] ?? h.classId]))}
          save={testMode ? { ...save, ember: testEmber } : save}
          onMute={() => {
            unlockAudio();
            setMutedUi((v) => !v);
          }}
          onLeave={() => setScreen("worldMap")}
          onBuyWeapon={(hero: string, weaponId: string) => {
            const rec = activeSave(bank);
            const w = WEAPONS[weaponId];
            if (!w || rec.weapons[weaponId] != null) return false;
            const held = testMode ? testEmber : (rec.ember ?? 0);
            if (held < w.price) return false;
            if (testMode) setTestEmber(held - w.price);
            persistCurrent({
              ...rec,
              ember: testMode ? rec.ember ?? 0 : held - w.price,
              emberSeeded: true,
              weapons: { ...rec.weapons, [weaponId]: 0 },
              pendingMission: null,
            });
            return true;
          }}
          onEquipWeapon={(hero: string, weaponId: string) => {
            const rec = activeSave(bank);
            if (rec.weapons[weaponId] == null) return;
            persistCurrent({ ...rec, equipped: { ...rec.equipped, [hero]: weaponId }, pendingMission: null });
          }}
          onEquipItem={(hero: string, slot: EquipSlot, itemId: string) => {
            const rec = activeSave(bank);
            if ((rec.looseEquipment[itemId] ?? 0) <= 0) return;
            persistCurrent({
              ...rec,
              equipment: { ...rec.equipment, [hero]: { ...(rec.equipment[hero] ?? {}), [slot]: itemId } },
              pendingMission: null,
            });
          }}
          onUpgradeWeapon={(weaponId: string) => {
            const rec = activeSave(bank);
            const enh = rec.weapons[weaponId] ?? 0;
            if (enh >= WEAPON_MAX_ENH) return false;
            const cost = weaponEnhCost(enh + 1);
            const held = testMode ? testEmber : (rec.ember ?? 0);
            if (held < cost) return false;
            if (testMode) setTestEmber(held - cost);
            persistCurrent({
              ...rec,
              ember: testMode ? rec.ember ?? 0 : held - cost,
              emberSeeded: true,
              weapons: { ...rec.weapons, [weaponId]: enh + 1 },
              pendingMission: null,
            });
            return true;
          }}
          onSellWeapon={(weaponId: string) => {
            const rec = activeSave(bank);
            const enh = rec.weapons[weaponId];
            if (enh == null) return false;
            const value = weaponSellValue(weaponId, enh);
            const held = testMode ? testEmber : (rec.ember ?? 0);
            if (testMode) setTestEmber(held + value);
            const weapons = { ...rec.weapons };
            delete weapons[weaponId];
            const equipped = { ...rec.equipped };
            for (const hero of Object.keys(equipped)) {
              if (equipped[hero] === weaponId) delete equipped[hero];
            }
            persistCurrent({
              ...rec,
              ember: testMode ? rec.ember ?? 0 : held + value,
              emberSeeded: true,
              weapons,
              equipped,
              pendingMission: null,
            });
            return value;
          }}
          onPay={(hero: string, cart: Record<PotionId, number>, lockpicks: number) => {
            const rec = activeSave(bank);
            let cost = 0;
            const bag = { ...(rec.bags[hero] ?? startingBags()[hero]) };
            for (const kind of Object.keys(cart) as PotionId[]) {
              const qty = cart[kind] ?? 0;
              if (qty <= 0) continue;
              if ((bag[kind] ?? 0) + qty > POTION_CARRY_MAX[kind]) return false;
              cost += POTION_PRICE[kind] * qty;
              bag[kind] = (bag[kind] ?? 0) + qty;
            }
            if (lockpicks > 0) {
              if ((bag.lockpick ?? 0) + lockpicks > BAG_MAX) return false;
              cost += LOCKPICK_PRICE * lockpicks;
              bag.lockpick = (bag.lockpick ?? 0) + lockpicks;
            }
            const held = testMode ? testEmber : (rec.ember ?? 0);
            if (cost <= 0 || held < cost) return false;
            if (testMode) setTestEmber(held - cost);
            persistCurrent({
              ...rec,
              ember: testMode ? rec.ember ?? 0 : held - cost,
              emberSeeded: true,
              bags: { ...rec.bags, [hero]: bag },
              pendingMission: null,
            });
            return true;
          }}
        />
      )}

      {screen === "cutscene" && (
        <CutsceneScreen src="/game/asherah-rite.mp4" muted={muted} onSkip={() => startBattle("templo")} />
      )}

      {screen === "epilogue" && (
        <CutsceneScreen
          src={missionId === "portao" ? "/game/portao-end.mp4" : "/game/temple-aftermath.mp4"}
          muted={muted}
          onSkip={() => setScreen("victory")}
        />
      )}

      {screen === "battle" && engine && (
        <BattleScreen
          engine={engine}
          hud={hud}
          paused={paused}
          muted={muted}
          save={save}
          onHud={onHud}
          onPause={() => setPaused(true)}
          onResume={() => {
            setSlotMode(null);
            setOverwrite(null);
            setPaused(false);
          }}
          onMute={() => {
            unlockAudio();
            setMutedUi((v) => !v);
          }}
          onSave={() => {
            setOverwrite(null);
            setSlotMode("save");
          }}
          onLoad={() => {
            setOverwrite(null);
            setSlotMode("load");
          }}
          onQuit={() => {
            setPaused(false);
            setSlotMode(null);
            setEngine(null);
            setScreen("worldMap");
          }}
        />
      )}

      {screen === "victory" && mission && (
        <ResultScreen
          win
          title={mission.title}
          body="O campo ficou em silêncio."
          turn={hud.turn}
          growth={lastGrowth}
          loot={lastLoot}
          art={briefArt(mission.id)}
          innOpen={!customMission && innUnlocked(save.completed) && mission.index <= 11}
          onInn={() => {
            setMissionId("estalagem");
            setScreen("inn");
          }}
          onMap={() => {
            if (customMission) {
              setCustomMission(null);
              setScreen("mapEditor");
              return;
            }
            // Reopens the world map straight onto this mission's location — if that
            // location has more chapters left, its list pops open immediately (a
            // multi-mission location plays as one continuous series of combats instead
            // of dropping back to the bare map after every fight).
            setOpenLocationOnMap(locationForMission(mission.id)?.id ?? null);
            setScreen("worldMap");
          }}
          mapLabel={customMission ? "Voltar ao editor" : "Mapa"}
          onTitle={() => setScreen("title")}
          // The raw "next mission by global index" shortcut this used to offer could skip
          // straight past an entire other location (missions aren't numbered in location
          // order) — hasNext is always false below now, so this never fires; onMap is the
          // one continue path, and it's location-aware.
          onNext={() => {}}
          hasNext={false}
        />
      )}

      {screen === "victory" && pendingPromotions.length > 0 && (
        <PromotionScreen pending={pendingPromotions} onPick={choosePromotion} />
      )}

      {screen === "defeat" && mission && (
        <ResultScreen
          win={false}
          title={mission.title}
          body="A linha quebrou."
          turn={hud.turn}
          growth={null}
          art={briefArt(mission.id)}
          onTitle={() => setScreen("title")}
          onNext={() => startBattle(mission.id, save.unitHp, customMission ?? undefined)}
          onMap={
            customMission
              ? () => {
                  setCustomMission(null);
                  setScreen("mapEditor");
                }
              : undefined
          }
          mapLabel={customMission ? "Voltar ao editor" : undefined}
          hasNext
          retry
        />
      )}

      {slotMode && (
        <SlotScreen
          mode={slotMode}
          bank={bank}
          overwrite={overwrite}
          onOverwrite={setOverwrite}
          onClose={() => {
            setSlotMode(null);
            setOverwrite(null);
          }}
          onPick={(index) => {
            bootAudio();
            if (slotMode === "new") {
              const next = writeSlot(bank, index, emptySave(muted));
              applySlot(next);
              setSlotMode(null);
              setOverwrite(null);
              setLastGrowth(null);
              setLastLoot([]);
              setMissionId(null);
              setEngine(null);
              setScreen("boot");
              return;
            }
            if (slotMode === "continue" || slotMode === "load") {
              const rec = bank.slots[index];
              if (!rec) return;
              const next = selectSlot(bank, index);
              applySlot(next);
              setSlotMode(null);
              setOverwrite(null);
              setPaused(false);
              setEngine(null);
              enterFromSave(rec);
              return;
            }
            const snapshot = combatStartRef.current ?? { ...save, pendingMission: missionId, muted };
            const next = writeSlot(bank, index, snapshot);
            applySlot(next);
            setSlotMode(null);
            setOverwrite(null);
            setPaused(false);
          }}
        />
      )}
    </main>
  );
}

function CutsceneScreen({
  src,
  muted,
  onSkip,
}: {
  src: string;
  muted: boolean;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [portrait, setPortrait] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px) and (orientation: portrait)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px) and (orientation: portrait)");
    const sync = () => setPortrait(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const ori = screen.orientation as ScreenOrientation & { lock?: (mode: string) => Promise<void>; unlock?: () => void };
    void ori.lock?.("landscape").catch(() => {});
    return () => {
      mq.removeEventListener("change", sync);
      try {
        ori.unlock?.();
      } catch {
        /* ignore */
      }
    };
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = muted;
    const kick = () => {
      void el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => {});
      });
    };
    kick();
    el.addEventListener("canplay", kick);
    const t = window.setTimeout(onSkip, 20000);
    return () => {
      el.removeEventListener("canplay", kick);
      window.clearTimeout(t);
    };
  }, [muted, src, onSkip]);
  return (
    <section className="relative h-dvh w-dvw bg-black overflow-hidden">
      <div className="cutscene-stage">
        <video ref={ref} src={src} playsInline autoPlay preload="auto" onEnded={onSkip} onError={onSkip} />
      </div>
      {portrait && (
        <p className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] text-center text-[11px] tracking-[0.16em] uppercase text-muted">
          Deite o telefone
        </p>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex justify-end">
        <Button size="md" variant="ghost" onClick={onSkip}>
          Pular
        </Button>
      </div>
    </section>
  );
}

function TitleScreen({
  ready,
  error,
  hasProgress,
  muted,
  help,
  onMute,
  onHelp,
  onNew,
  onContinue,
  onTest,
}: {
  ready: boolean;
  error: string | null;
  hasProgress: boolean;
  muted: boolean;
  help: boolean;
  onMute: () => void;
  onHelp: () => void;
  onNew: () => void;
  onContinue: () => void;
  onTest: () => void;
}) {
  return (
    <section className="relative min-h-dvh flex flex-col overflow-hidden">
      <div className="title-hero absolute inset-0" aria-hidden />
      <div className="title-veil absolute inset-0" />
      <header className="relative z-10 flex items-center justify-end px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onMute}
          className="size-11 grid place-items-center rounded-md border border-border text-fg"
          aria-label={muted ? "Ativar som" : "Silenciar"}
        >
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      </header>
      <div className="relative z-10 flex flex-1 flex-col justify-end px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-xl mx-auto w-full">
        <p className="text-sm tracking-[0.28em] uppercase text-muted mb-3">Táticas em cinzas</p>
        <h1 className="font-display text-5xl sm:text-7xl font-medium tracking-tight leading-none mb-4">Ember</h1>
        <p className="text-[11px] tracking-[0.18em] uppercase text-muted -mt-3 mb-4">V. 2.58</p>
        <p className="text-muted text-base leading-relaxed mb-8 max-w-md">
          Três sobreviventes. Um tabuleiro de guerra. Cada casa conta.
        </p>
        <div className="flex flex-col gap-3">
          <Button size="xl" disabled={!ready} onClick={onNew}>
            {ready ? "Nova campanha" : "Carregando…"}
          </Button>
          {hasProgress && (
            <Button size="lg" variant="ghost" disabled={!ready} onClick={onContinue}>
              Continuar
            </Button>
          )}
          <Button size="lg" variant="quiet" onClick={onHelp}>
            Como jogar
          </Button>
          <Button size="lg" variant="ghost" disabled={!ready} onClick={onTest}>
            Modo teste
          </Button>
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      </div>
      {help && <HelpModal onClose={onHelp} />}
    </section>
  );
}

/** One entry per casting-speed tier: which classes share it, one classId to read the table
 * from (every class in the group has identical numbers), and how many tiers it goes up to.
 * Class names, not hero names — keeps it about the role, not who's playing it. */
const SKILL_SPEED_GROUPS: { label: string; classes: string; classId: ClassId; maxTier: number }[] = [
  {
    label: "Conjuração Rápida",
    classes: ["mage", "conjurer", "healer", "elementalist", "sorcerer", "bishop"].map((c) => CLASSES[c as ClassId].name).join(", "),
    classId: "mage",
    maxTier: 10,
  },
  {
    label: "Conjuração Média",
    classes: ["archer", "warlock", "necromancer", "cleric", "paladin", "assassin", "templar"].map((c) => CLASSES[c as ClassId].name).join(", "),
    classId: "archer",
    maxTier: 8,
  },
  {
    label: "Conjuração Lenta",
    classes: ["swordsman", "lancer", "heavyKnight", "ranger", "sentinel"].map((c) => CLASSES[c as ClassId].name).join(", "),
    classId: "swordsman",
    maxTier: 6,
  },
];

/** One row per potion in the loot-weighted pick (weightedPotionPick) — % chance is its share
 * of the total weight across every potion, so this always matches what's actually rolled. */
const POTION_LOOT_ROWS: { name: string; weight: number }[] = (Object.entries(POTION_LOOT_WEIGHT) as [keyof typeof POTION_LOOT_WEIGHT, number][]).map(
  ([id, weight]) => ({ name: POTIONS[id].name, weight }),
);
const POTION_LOOT_TOTAL = POTION_LOOT_ROWS.reduce((n, r) => n + r.weight, 0);

/** One entry per skill/spell tier slot (SPELL_TIER's own keys) — tier, damage formula (a
 * plain string for flat skills, or a function of level for the two that scale), and a
 * one-line effect note. Kept next to SPELL_TIER by hand since a skill's shape (splash, line,
 * status effect) isn't data SPELL_TIER itself carries. */
const SKILL_DAMAGE_ROWS: { name: string; tier: SpellTier; formula: string | ((level: number) => string); note: string }[] = [
  { name: MAGIC_MISSILE.name, tier: spellTier("magicMissile")!, formula: diceFormula(MAGIC_MISSILE.dice, MAGIC_MISSILE.faces, MAGIC_MISSILE.bonus), note: "Nunca erra." },
  { name: LONG_SHOT.name, tier: spellTier("longShot")!, formula: `arma +${diceFormula(LONG_SHOT.bonusDice, LONG_SHOT.bonusFaces, LONG_SHOT.bonus)}`, note: `Alcance ×${LONG_SHOT.rangeMul}+${LONG_SHOT.rangeBonus}.` },
  { name: CURES.cureMinor.name, tier: spellTier("cureMinor")!, formula: `${diceFormula(CURES.cureMinor.dice, CURES.cureMinor.faces, CURES.cureMinor.bonus)} (cura)`, note: "—" },
  { name: DOUBLE_STRIKE.name, tier: spellTier("doubleStrike")!, formula: "2× dano de arma", note: "Ataca duas vezes." },
  { name: PIERCING_THRUST.name, tier: spellTier("piercingThrust")!, formula: `dano de arma, −${Math.round(PIERCING_THRUST.armorIgnore * 100)}% armadura`, note: "Acerta em linha; o segundo alvo recebe metade." },
  { name: SUMMON_FAMILIAR.name, tier: spellTier("summonFamiliar")!, formula: "—", note: `Invoca aliado com ${Math.round(SUMMON_FAMILIAR.statScale * 100)}% dos atributos atuais.` },
  {
    name: LIGHTNING.name,
    tier: spellTier("lightning")!,
    formula: (level: number) => lightningFormula(level),
    note: `Eco em outro alvo adjacente: ${diceFormula(LIGHTNING.echoDice, LIGHTNING.echoFaces, LIGHTNING.echoBonus)}. Nv8+: mais 2 dados.`,
  },
  { name: PIERCING.name, tier: spellTier("piercing")!, formula: `${PIERCING.dmgMul}× dano de arma`, note: "—" },
  { name: CURES.cureWounds.name, tier: spellTier("cureWounds")!, formula: `${diceFormula(CURES.cureWounds.dice, CURES.cureWounds.faces, CURES.cureWounds.bonus)} (cura)`, note: "—" },
  { name: CLEAVE.name, tier: spellTier("cleave")!, formula: `arma +${diceFormula(CLEAVE.bonusDice, CLEAVE.bonusFaces, CLEAVE.bonusBonus)}`, note: `Atinge até ${CLEAVE.hexes} hexes.` },
  { name: SWEEP.name, tier: spellTier("sweep")!, formula: "dano de arma", note: `Todos os inimigos adjacentes; empurra ${SWEEP.knockback} hex.` },
  {
    name: WEB_OF_DREAMS.name,
    tier: spellTier("webOfDreams")!,
    formula: "—",
    note: `${Math.round(WEB_OF_DREAMS.sleepChance * 100)}% de dormir por ${diceFormula(WEB_OF_DREAMS.sleepDice, WEB_OF_DREAMS.sleepFaces, 0)} turnos (+${Math.round(WEB_OF_DREAMS.sleepBonusDamage * 100)}% dano ao acordar); prende o movimento a 1 hex na área por ${WEB_OF_DREAMS.durationRounds} turnos.`,
  },
  { name: TRIP.name, tier: spellTier("trip")!, formula: `arma +${diceFormula(1, TRIP.bonusFaces, TRIP.bonusBonus)}`, note: `Atordoa ${TRIP.stunRounds} turnos; −${Math.round(TRIP.statPenalty * 100)}% de status pro resto da batalha.` },
  {
    name: FIREBALL.name,
    tier: spellTier("fireball")!,
    formula: (level: number) => fireballFormula(level),
    note: "Nv5+: dados maiores. Nv9+: maiores ainda. Área de raio 2.",
  },
  { name: CURE_DISEASE.name, tier: spellTier("cureDisease")!, formula: "—", note: "Cura doença." },
  {
    name: CAUSTIC_VENOM.name,
    tier: spellTier("causticVenom")!,
    formula: `centro ${diceFormula(CAUSTIC_VENOM.centerDice, CAUSTIC_VENOM.centerFaces, CAUSTIC_VENOM.centerBonus)} · respingo ${diceFormula(CAUSTIC_VENOM.splashDice, CAUSTIC_VENOM.splashFaces, CAUSTIC_VENOM.splashBonus)}`,
    note: "Envenena: 1D4 no início de cada turno do alvo, até curado. Área de raio 2.",
  },
].sort((a, b) => a.tier - b.tier);

function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"basicos" | "tabelas" | "loot" | "dano">("basicos");
  return (
    <div className="absolute inset-0 z-20 bg-bg/80 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="font-display text-2xl">Como jogar</h2>
          <button type="button" onClick={onClose} className="size-11 grid place-items-center" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex gap-1 mb-4 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("basicos")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "basicos" ? "border-accent text-fg" : "border-transparent text-muted"}`}
          >
            Básicos
          </button>
          <button
            type="button"
            onClick={() => setTab("tabelas")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "tabelas" ? "border-accent text-fg" : "border-transparent text-muted"}`}
          >
            Usos
          </button>
          <button
            type="button"
            onClick={() => setTab("dano")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "dano" ? "border-accent text-fg" : "border-transparent text-muted"}`}
          >
            Dano
          </button>
          <button
            type="button"
            onClick={() => setTab("loot")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "loot" ? "border-accent text-fg" : "border-transparent text-muted"}`}
          >
            Loot
          </button>
        </div>
        {tab === "basicos" ? (
          <ul className="space-y-3 text-sm text-muted leading-relaxed">
            <li>Toque numa aliada para ver movimento (azul) e ataque (vermelho).</li>
            <li>Toque num inimigo para ver HP, alcance e a área vermelha de perigo.</li>
            <li>Golpe de arma: AT − DF, dentro do alcance da ficha.</li>
            <li>Magia ofensiva: o dado − RES, no alcance da magia.</li>
            <li>Todo mundo tem AT, MAG, DF, RES, Mov e Alc. Nada fica de fora da ficha.</li>
            <li>Terreno alto (barranco, tronco morto, casa abandonada): +2 de dano. A arqueira também ganha +1 de alcance. No alto, outro hex alto na frente não corta a flecha.</li>
            <li>Barricada (estacas, 3 hexes): ninguém passa. De trás você atira. Projéteis não acertam quem está atrás.</li>
            <li>Depois de mover, dois cliques no personagem = Esperar e passa ao próximo.</li>
          </ul>
        ) : tab === "tabelas" ? (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">
              Cada classe tem uma velocidade de conjuração — ela decide quantos usos de cada tier (1 a 5) a
              classe tem em cada nível. As tabelas abaixo mostram os números exatos, nível a nível.
            </p>
            {SKILL_SPEED_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="text-sm font-medium">
                  {g.label} <span className="text-muted font-normal">· {g.classes}</span>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs tabular-nums border-collapse">
                    <thead>
                      <tr className="text-muted">
                        <th className="text-left font-normal pr-2 py-1">Nv</th>
                        {Array.from({ length: g.maxTier }, (_, i) => i + 1).map((t) => (
                          <th key={t} className="text-right font-normal px-1.5 py-1">
                            T{t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((level) => (
                        <tr key={level} className="border-t border-border/60">
                          <td className="text-left py-0.5 pr-2 text-muted">{level}</td>
                          {Array.from({ length: g.maxTier }, (_, i) => i + 1).map((t) => (
                            <td key={t} className="text-right px-1.5 py-0.5">
                              {tierUses(g.classId, t as SpellTier, level)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "dano" ? (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">
              Fórmula de dano (ou efeito) de cada magia/habilidade, por tier. Relâmpago e Bola de Fogo
              escalam com o nível de quem conjura — a tabela mostra Nv 1, 5, 9 e 30 pra ver a curva inteira.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left font-normal pr-2 py-1">Habilidade</th>
                    <th className="text-center font-normal px-1.5 py-1">Tier</th>
                    <th className="text-left font-normal px-1.5 py-1">Fórmula</th>
                    <th className="text-left font-normal pl-1.5 py-1">Efeito</th>
                  </tr>
                </thead>
                <tbody>
                  {SKILL_DAMAGE_ROWS.map((row) => (
                    <tr key={row.name} className="border-t border-border/60 align-top">
                      <td className="text-left py-1 pr-2 font-medium whitespace-nowrap">{row.name}</td>
                      <td className="text-center px-1.5 py-1 text-muted">T{row.tier}</td>
                      <td className="text-left px-1.5 py-1 tabular-nums">
                        {typeof row.formula === "string" ? (
                          row.formula
                        ) : (
                          <span className="space-x-1.5">
                            <span>Nv1: {row.formula(1)}</span>
                            <span className="text-muted">· Nv5: {row.formula(5)}</span>
                            <span className="text-muted">· Nv9: {row.formula(9)}</span>
                            <span className="text-muted">· Nv30: {row.formula(30)}</span>
                          </span>
                        )}
                      </td>
                      <td className="text-left pl-1.5 py-1 text-muted">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted leading-relaxed">
              Chances de drop, do jeito que estão programadas agora.
            </p>
            <div>
              <p className="text-sm font-medium">Poções em baú (por baú)</p>
              <p className="text-xs text-muted leading-relaxed mb-2">
                Todo baú dá Ember + uma poção garantida (sorteada abaixo) + uma chance separada de item.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs tabular-nums border-collapse">
                  <thead>
                    <tr className="text-muted">
                      <th className="text-left font-normal pr-2 py-1">Poção</th>
                      <th className="text-right font-normal pl-1.5 py-1">Chance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {POTION_LOOT_ROWS.map((r) => (
                      <tr key={r.name} className="border-t border-border/60">
                        <td className="text-left py-0.5 pr-2">{r.name}</td>
                        <td className="text-right pl-1.5 py-0.5">{((r.weight / POTION_LOOT_TOTAL) * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-sm text-muted leading-relaxed space-y-1">
              <p className="text-fg font-medium text-sm">Ember e item de baú</p>
              <p>
                Ember: {CHEST_LOOT.emberBase}–{CHEST_LOOT.emberBase + CHEST_LOOT.emberDice - 1} por baú.
              </p>
              <p>Chance extra de arma ou equipamento: {Math.round(CHEST_LOOT.gearChance * 100)}%.</p>
            </div>
            <div className="text-sm text-muted leading-relaxed space-y-1">
              <p className="text-fg font-medium text-sm">Drop ao matar inimigo</p>
              <p>Inimigo comum: {(KILL_DROP_CHANCE * 100).toFixed(0)}% de chance de largar uma arma.</p>
              <p>Chefes nomeados (drop garantido): sempre largam arma ou equipamento ao morrer.</p>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Toda arma/equipamento largado é sorteado por preço — quanto mais caro, mais raro — e limitado ao
              nível de itens da missão atual, então cada trecho da campanha só solta o que faz sentido pra ele.
            </p>
          </div>
        )}
        <Button className="mt-5 w-full" onClick={onClose}>
          Entendi
        </Button>
      </div>
    </div>
  );
}

function TestMenuScreen({
  onBack,
  onDebug,
  onMapEditor,
}: {
  onBack: () => void;
  onDebug: () => void;
  onMapEditor: () => void;
}) {
  return (
    <section className="h-dvh min-h-0 flex flex-col bg-bg">
      <header className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 border-b border-border">
        <button type="button" onClick={onBack} className="size-10 grid place-items-center rounded-md border border-border" aria-label="Voltar">
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">Modo teste</p>
          <h1 className="font-display text-3xl leading-none">O que abrir?</h1>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-3 p-5 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={onDebug}
          className="text-left rounded-xl border border-border bg-bg/40 px-5 py-4 hover:border-accent"
        >
          <p className="font-display text-2xl leading-tight">Debug</p>
          <p className="text-sm text-muted mt-1">Joga qualquer missão da campanha, sem travar progresso — o de sempre.</p>
        </button>
        <button
          type="button"
          onClick={onMapEditor}
          className="text-left rounded-xl border border-border bg-bg/40 px-5 py-4 hover:border-accent"
        >
          <p className="font-display text-2xl leading-tight">Map Editor</p>
          <p className="text-sm text-muted mt-1">Pinta terreno, posiciona spawns, testa na hora e exporta pra colar no jogo.</p>
        </button>
      </div>
    </section>
  );
}

const MAP_VERSIONS_KEY = "ember-map-versions";
const MAP_ACTIVE_KEY = "ember-map-active";
const EDITOR_COLS_DEFAULT = 10;
const EDITOR_ROWS_DEFAULT = 8;

/** A spawn as edited in the Map Editor — the real Spawn shape plus a per-spawn test
 * level, which only exists for "Testar" (balance testing). It never leaves the editor:
 * draftToMission() strips it back down to a plain Spawn before export/playtest. */
interface DraftSpawn extends Spawn {
  level: number;
}

interface MapDraft {
  /** Which campaign scenario this map authors for — matches a real Mission.id (e.g.
   * "o-vau") to version-edit that scenario, or any free id for a standalone map with no
   * campaign slot. Versions are grouped and saved under this id — it's the "Cenário
   * alvo" the user assigns, not a per-edit-session unique key. */
  id: string;
  /** Mission.index of the scenario being edited (enemy scaling, procedural terrain hash
   * — see enemyLevelFor). 0 for a standalone map with no real campaign slot. */
  index: number;
  title: string;
  place: string;
  briefing: string;
  objective: string;
  win: WinCondition;
  hub: boolean;
  cols: number;
  rows: number;
  tiles: TerrainId[];
  /** Art variant per tile (same indexing as tiles) — which numbered version (01, 02, ...)
   * paints there. Defaults to 0 (the "01" file, safe for existing missions). */
  tileVariants: number[];
  decorations: DecorationPlacement[];
  playerSpawns: DraftSpawn[];
  enemySpawns: DraftSpawn[];
}

/** Default level for a newly added spawn: enough spell slots unlocked to actually test
 * with, without being maxed out. */
const DEFAULT_TEST_LEVEL = 10;

function blankDraft(): MapDraft {
  return {
    id: `custom-${Date.now().toString(36)}`,
    index: 0,
    title: "Mapa sem nome",
    place: "",
    briefing: "",
    objective: "Derrote todos os inimigos",
    win: "rout",
    hub: false,
    cols: EDITOR_COLS_DEFAULT,
    rows: EDITOR_ROWS_DEFAULT,
    tiles: Array.from({ length: EDITOR_COLS_DEFAULT * EDITOR_ROWS_DEFAULT }, () => "plains" as TerrainId),
    tileVariants: Array.from({ length: EDITOR_COLS_DEFAULT * EDITOR_ROWS_DEFAULT }, () => 0),
    decorations: [],
    playerSpawns: [],
    enemySpawns: [],
  };
}

/** Loads an existing campaign mission into the editor, targeting that same mission's id —
 * so saved versions stack up under it and "Ativar" can make one of them live for that
 * real campaign slot. The immutable static Mission data itself is never touched; this
 * only ever writes to the versioned localStorage store. */
function missionToDraft(m: Mission): MapDraft {
  const n = m.cols * m.rows;
  const variants = m.tileVariants ?? [];
  return {
    id: m.id,
    index: m.index,
    title: m.title,
    place: m.place,
    briefing: m.briefing,
    objective: m.objective,
    win: m.win,
    hub: !!m.hub,
    cols: m.cols,
    rows: m.rows,
    tiles: parseLayout(m.layout),
    tileVariants: Array.from({ length: n }, (_, i) => variants[i] ?? 0),
    decorations: m.decorations ?? [],
    playerSpawns: m.playerSpawns.map((s) => ({ ...s, level: DEFAULT_TEST_LEVEL })),
    enemySpawns: m.enemySpawns.map((s) => ({ ...s, level: enemyLevelFor(m.index) })),
  };
}

const DEFAULT_HEROES: { name: string; classId: ClassId }[] = [
  { name: "Kael", classId: "swordsman" },
  { name: "Neera", classId: "archer" },
  { name: "Voss", classId: "mage" },
  { name: "Salazar", classId: "healer" },
];

/** One saved edit of a scenario. Versions never get overwritten — every "Salvar" appends
 * a new serial under the draft's id (the target scenario). "Ativar" a serial to make it
 * the one real campaign play uses instead of the immutable static Mission data; the
 * static data itself is never modified by any of this. */
interface MapVersion {
  serial: number;
  draft: MapDraft;
  savedAt: number;
}

function loadVersionStore(): Record<string, MapVersion[]> {
  try {
    const raw = window.localStorage.getItem(MAP_VERSIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, MapVersion[]>) : {};
  } catch {
    return {};
  }
}

function saveVersionStore(store: Record<string, MapVersion[]>) {
  try {
    window.localStorage.setItem(MAP_VERSIONS_KEY, JSON.stringify(store));
  } catch {
    // ignore — editor still works in-session without persistence
  }
}

function loadActiveVersions(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(MAP_ACTIVE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveActiveVersions(map: Record<string, number>) {
  try {
    window.localStorage.setItem(MAP_ACTIVE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function draftToMission(d: MapDraft): Mission {
  const layout: string[] = [];
  for (let r = 0; r < d.rows; r++) {
    let row = "";
    for (let c = 0; c < d.cols; c++) row += TILE_CHAR[d.tiles[r * d.cols + c] ?? "plains"];
    layout.push(row);
  }
  return {
    id: d.id,
    index: d.index,
    title: d.title,
    place: d.place,
    briefing: d.briefing,
    objective: d.objective,
    win: d.win,
    cols: d.cols,
    rows: d.rows,
    layout,
    tileVariants: d.tileVariants.some((v) => v) ? d.tileVariants : undefined,
    decorations: d.decorations.length > 0 ? d.decorations : undefined,
    playerSpawns: d.playerSpawns.map(({ level: _level, ...s }) => s),
    enemySpawns: d.enemySpawns.map(({ level: _level, ...s }) => s),
    hub: d.hub || undefined,
  };
}

/** Resolves a mission id for REAL play (not the editor's own playtest): an activated
 * custom version takes precedence over the immutable static MISSIONS data, so authoring
 * a scenario in the Map Editor can actually replace what the campaign plays without ever
 * touching the shipped data. */
function resolveMission(id: string): Mission | undefined {
  const active = loadActiveVersions()[id];
  if (active) {
    const version = loadVersionStore()[id]?.find((v) => v.serial === active);
    if (version) return draftToMission(version.draft);
  }
  return missionById(id);
}

const TERRAIN_SWATCH: Record<TerrainId, string> = {
  plains: "#9c8f6f",
  woods: "#3f5c3a",
  ruins: "#6b6560",
  water: "#2c5f7a",
  ember: "#7a2c2c",
  hill: "#8a7a4f",
  flame: "#b5501f",
  column: "#4a4a52",
  nave: "#26262c",
  barricade: "#5a4630",
  highwood: "#4a3f2a",
  highruin: "#5f584c",
  chest: "#7a5c2e",
  door: "#4a3524",
  deadtree: "#4a3f2a",
  void: "#050505",
};

/** Hover text for a terrain type: its combat stats plus terrainNote()'s callout, so the
 * editor documents what each tile actually does instead of just naming it. */
function terrainHint(t: TerrainId): string {
  const d = TERRAIN[t];
  const parts = [d.passable ? `Mov ${d.moveCost}` : "Intransponível", `Def +${d.def}`, `Atk +${d.atk}`];
  if (d.blocksShot) parts.push("bloqueia tiro/visão");
  if (d.hazardDice) parts.push(`dano ${d.hazardDice}D${d.hazardFaces} por turno parado`);
  const note = terrainNote(t);
  return note ? `${parts.join(" · ")} — ${note}` : parts.join(" · ");
}

function MapEditorScreen({
  onBack,
  onPlaytest,
}: {
  onBack: () => void;
  onPlaytest: (m: Mission, playerLevels: Record<string, number>, enemyLevels: Record<string, number>) => void;
}) {
  const [versionStore, setVersionStore] = useState<Record<string, MapVersion[]>>(() => loadVersionStore());
  const [activeVersions, setActiveVersions] = useState<Record<string, number>>(() => loadActiveVersions());
  const [draft, setDraft] = useState<MapDraft>(() => blankDraft());
  const [brush, setBrush] = useState<TerrainId>("plains");
  const [variant, setVariant] = useState(0);
  const [decoBrush, setDecoBrush] = useState<string>(Object.keys(DECORATIONS)[0]!);
  const [mode, setMode] = useState<"paint" | "player" | "enemy" | "decoration">("paint");
  const [gridStyle, setGridStyle] = useState<"hex" | "square">("hex");
  const [exportText, setExportText] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const versions = versionStore[draft.id] ?? [];
  const activeSerial = activeVersions[draft.id];

  const decoLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of draft.decorations) {
      const def = DECORATIONS[p.id];
      if (!def) continue;
      for (const f of def.footprint) m.set(`${p.x + f.dx},${p.y + f.dy}`, def.name);
    }
    return m;
  }, [draft.decorations]);

  const setTile = (i: number, t: TerrainId) => {
    setDraft((d) => {
      const tiles = d.tiles.slice();
      const tileVariants = d.tileVariants.slice();
      tiles[i] = t;
      tileVariants[i] = Math.min(variant, TILE_VARIANT_COUNT[t] - 1);
      return { ...d, tiles, tileVariants };
    });
  };

  const toggleSpawn = (x: number, y: number) => {
    setDraft((d) => {
      const key: "playerSpawns" | "enemySpawns" = mode === "player" ? "playerSpawns" : "enemySpawns";
      const list = d[key];
      const existing = list.findIndex((s) => s.x === x && s.y === y);
      if (existing >= 0) {
        return { ...d, [key]: list.filter((_, i) => i !== existing) };
      }
      const n = list.length + 1;
      const spawn: DraftSpawn = {
        name: mode === "player" ? `Herói ${n}` : `Inimigo ${n}`,
        classId: mode === "player" ? "swordsman" : "soldier",
        x,
        y,
        level: mode === "player" ? DEFAULT_TEST_LEVEL : enemyLevelFor(0),
      };
      return { ...d, [key]: [...list, spawn] };
    });
  };

  const toggleDecoration = (x: number, y: number) => {
    setDraft((d) => {
      const covered = decorationCells(d.decorations);
      // clicking any hex a decoration already covers removes that whole placement,
      // regardless of which cell of its footprint was clicked
      const hit = d.decorations.find((p) => {
        const def = DECORATIONS[p.id];
        return def?.footprint.some((f) => p.x + f.dx === x && p.y + f.dy === y);
      });
      if (hit) return { ...d, decorations: d.decorations.filter((p) => p !== hit) };
      const def = DECORATIONS[decoBrush];
      if (!def) return d;
      // refuse to place if any covered cell is out of bounds or already taken
      for (const f of def.footprint) {
        const cx = x + f.dx;
        const cy = y + f.dy;
        if (cx < 0 || cy < 0 || cx >= d.cols || cy >= d.rows) return d;
        if (covered.has(`${cx},${cy}`)) return d;
      }
      return { ...d, decorations: [...d.decorations, { id: decoBrush, x, y }] };
    });
  };

  const onCellClick = (x: number, y: number) => {
    const i = y * draft.cols + x;
    if (mode === "paint") setTile(i, brush);
    else if (mode === "decoration") toggleDecoration(x, y);
    else toggleSpawn(x, y);
  };

  const resize = (cols: number, rows: number) => {
    cols = Math.max(3, Math.min(40, cols));
    rows = Math.max(3, Math.min(40, rows));
    setDraft((d) => {
      const tiles: TerrainId[] = [];
      const tileVariants: number[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const inOld = r < d.rows && c < d.cols;
          tiles.push(inOld ? (d.tiles[r * d.cols + c] ?? "plains") : "plains");
          tileVariants.push(inOld ? (d.tileVariants[r * d.cols + c] ?? 0) : 0);
        }
      }
      const inBounds = (s: Spawn) => s.x < cols && s.y < rows;
      const decorations = d.decorations.filter((p) => {
        const def = DECORATIONS[p.id];
        if (!def) return false;
        return def.footprint.every((f) => p.x + f.dx >= 0 && p.y + f.dy >= 0 && p.x + f.dx < cols && p.y + f.dy < rows);
      });
      return {
        ...d,
        cols,
        rows,
        tiles,
        tileVariants,
        decorations,
        playerSpawns: d.playerSpawns.filter(inBounds),
        enemySpawns: d.enemySpawns.filter(inBounds),
      };
    });
  };

  const updateSpawn = (side: "playerSpawns" | "enemySpawns", i: number, patch: Partial<DraftSpawn>) => {
    setDraft((d) => {
      const list = d[side].slice();
      list[i] = { ...list[i]!, ...patch };
      return { ...d, [side]: list };
    });
  };

  const removeSpawn = (side: "playerSpawns" | "enemySpawns", i: number) => {
    setDraft((d) => ({ ...d, [side]: d[side].filter((_, idx) => idx !== i) }));
  };

  const addDefaultHeroes = () => {
    setDraft((d) => {
      const occupied = new Set([...d.playerSpawns, ...d.enemySpawns].map((s) => `${s.x},${s.y}`));
      const already = new Set(d.playerSpawns.map((s) => s.name));
      const added: DraftSpawn[] = [];
      let x = 0;
      const y = d.rows - 1;
      for (const h of DEFAULT_HEROES) {
        if (already.has(h.name)) continue;
        while (x < d.cols && occupied.has(`${x},${y}`)) x++;
        if (x >= d.cols) break;
        added.push({ name: h.name, classId: h.classId, x, y, level: DEFAULT_TEST_LEVEL });
        occupied.add(`${x},${y}`);
        x++;
      }
      return { ...d, playerSpawns: [...d.playerSpawns, ...added] };
    });
  };

  const doSave = () => {
    const list = versionStore[draft.id] ?? [];
    const serial = (list[list.length - 1]?.serial ?? 0) + 1;
    const next = { ...versionStore, [draft.id]: [...list, { serial, draft, savedAt: Date.now() }] };
    setVersionStore(next);
    saveVersionStore(next);
    setNote(`Salvo como v${serial} de "${draft.id}". Use Ativar pra valer pra campanha.`);
  };

  const doExport = () => {
    doSave();
    setExportText(JSON.stringify(draftToMission(draft), null, 2));
    setCopyOk(false);
  };

  const doActivate = (serial: number) => {
    const next = { ...activeVersions, [draft.id]: serial };
    setActiveVersions(next);
    saveActiveVersions(next);
    setNote(`v${serial} agora é a versão valendo pra "${draft.id}" na campanha.`);
  };

  const doDeactivate = () => {
    const next = { ...activeVersions };
    delete next[draft.id];
    setActiveVersions(next);
    saveActiveVersions(next);
    setNote(`"${draft.id}" voltou a usar o cenário original.`);
  };

  const doDeleteVersion = (serial: number) => {
    const list = (versionStore[draft.id] ?? []).filter((v) => v.serial !== serial);
    const next = { ...versionStore, [draft.id]: list };
    if (list.length === 0) delete next[draft.id];
    setVersionStore(next);
    saveVersionStore(next);
    if (activeVersions[draft.id] === serial) doDeactivate();
    setNote(`v${serial} excluída.`);
  };

  const classOptions = Object.keys(CLASSES) as ClassId[];

  return (
    <section className="h-dvh min-h-0 flex flex-col bg-bg">
      <header className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 border-b border-border">
        <button type="button" onClick={onBack} className="size-10 grid place-items-center rounded-md border border-border" aria-label="Voltar">
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">Modo teste</p>
          <h1 className="font-display text-2xl leading-none">Map Editor</h1>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={() => setDraft(blankDraft())}>
            Novo
          </Button>
          <select
            className="bg-bg border border-border rounded-md px-2 py-1.5"
            value=""
            onChange={(e) => {
              const m = missionById(e.target.value);
              if (m) setDraft(missionToDraft(m));
            }}
          >
            <option value="">Carregar da campanha…</option>
            {MISSIONS.filter((m) => !m.hub).map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          {Object.keys(versionStore).length > 0 && (
            <select
              id="mapPick"
              className="flex-1 min-w-0 bg-bg border border-border rounded-md px-2 py-1.5"
              value=""
              title="Abre a versão mais recente salva para esse cenário — a lista de versões abaixo deixa escolher outra"
              onChange={(e) => {
                const list = versionStore[e.target.value];
                const latest = list?.[list.length - 1];
                if (latest) setDraft(latest.draft);
              }}
            >
              <option value="">Abrir cenário com versões salvas…</option>
              {Object.entries(versionStore).map(([id, list]) => (
                <option key={id} value={id}>
                  {id} ({list.length} versão{list.length === 1 ? "" : "ões"}
                  {activeVersions[id] ? `, v${activeVersions[id]} ativa` : ""})
                </option>
              ))}
            </select>
          )}
        </div>
        {note && (
          <p className="text-xs text-accent bg-accent/10 border border-accent/40 rounded-md px-2 py-1.5">{note}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex flex-col gap-1" title="O cenário da campanha que essa edição mira. Bate com o id de uma missão real (ex.: o-vau) pra poder ativar essa versão nela, ou qualquer id livre pra um mapa avulso.">
            <span className="text-muted text-xs uppercase tracking-wide">Cenário alvo (Id)</span>
            <input
              className="bg-bg border border-border rounded-md px-2 py-1.5"
              value={draft.id}
              onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value.replace(/[^a-z0-9-]/gi, "") }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted text-xs uppercase tracking-wide">Título</span>
            <input
              className="bg-bg border border-border rounded-md px-2 py-1.5"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted text-xs uppercase tracking-wide">Local</span>
            <input
              className="bg-bg border border-border rounded-md px-2 py-1.5"
              value={draft.place}
              onChange={(e) => setDraft((d) => ({ ...d, place: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted text-xs uppercase tracking-wide">Objetivo</span>
            <input
              className="bg-bg border border-border rounded-md px-2 py-1.5"
              value={draft.objective}
              onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-muted text-xs uppercase tracking-wide">Briefing</span>
            <textarea
              className="bg-bg border border-border rounded-md px-2 py-1.5 min-h-16"
              value={draft.briefing}
              onChange={(e) => setDraft((d) => ({ ...d, briefing: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted text-xs uppercase tracking-wide">Vitória</span>
            <select
              className="bg-bg border border-border rounded-md px-2 py-1.5"
              value={draft.win}
              onChange={(e) => setDraft((d) => ({ ...d, win: e.target.value as WinCondition }))}
            >
              <option value="rout">Derrote todos (rout)</option>
              <option value="boss">Derrube o chefe (boss)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input type="checkbox" checked={draft.hub} onChange={(e) => setDraft((d) => ({ ...d, hub: e.target.checked }))} />
            <span className="text-muted">É um hub (sem combate)</span>
          </label>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <span className="text-muted text-xs uppercase tracking-wide">Col</span>
            <input
              type="number"
              className="w-16 bg-bg border border-border rounded-md px-2 py-1"
              value={draft.cols}
              onChange={(e) => resize(Number(e.target.value) || draft.cols, draft.rows)}
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted text-xs uppercase tracking-wide">Lin</span>
            <input
              type="number"
              className="w-16 bg-bg border border-border rounded-md px-2 py-1"
              value={draft.rows}
              onChange={(e) => resize(draft.cols, Number(e.target.value) || draft.rows)}
            />
          </label>
          <div className="flex-1" />
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["hex", "square"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGridStyle(g)}
                title={g === "hex" ? "Grade em hexágono, igual ao jogo" : "Grade quadrada (mais rápida de editar)"}
                className={`px-2.5 py-1.5 ${gridStyle === g ? "bg-accent text-bg" : "bg-bg text-muted"}`}
              >
                {g === "hex" ? "Hexágono" : "Quadrado"}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["paint", "decoration", "player", "enemy"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-2.5 py-1.5 ${mode === m ? "bg-accent text-bg" : "bg-bg text-muted"}`}
              >
                {m === "paint" ? "Terreno" : m === "decoration" ? "Decoração" : m === "player" ? "Herói" : "Inimigo"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={addDefaultHeroes}>
            Adicionar Kael, Neera, Voss, Salazar
          </Button>
          <p className="text-xs text-muted ml-auto">Nível de cada um é editável na lista abaixo.</p>
        </div>

        {mode === "paint" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TERRAIN) as TerrainId[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  title={terrainHint(t)}
                  onClick={() => {
                    setBrush(t);
                    setVariant((v) => Math.min(v, (TILE_VARIANT_COUNT[t] ?? 1) - 1));
                  }}
                  className={`text-xs px-2 py-1 rounded-md border flex items-center gap-1.5 ${brush === t ? "border-accent" : "border-border"}`}
                >
                  <span className="size-3 rounded-sm inline-block" style={{ background: TERRAIN_SWATCH[t] }} />
                  {TERRAIN[t].name}
                </button>
              ))}
            </div>
            {(TILE_VARIANT_COUNT[brush] ?? 1) > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted uppercase tracking-wide">Versão</span>
                {Array.from({ length: TILE_VARIANT_COUNT[brush] }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    title={`Pinta ${TERRAIN[brush].name} usando a arte ${String(i + 1).padStart(2, "0")}`}
                    onClick={() => setVariant(i)}
                    className={`size-7 rounded-md border overflow-hidden ${variant === i ? "border-accent" : "border-border"}`}
                  >
                    <img src={`/game/tiles/${brush}${String(i + 1).padStart(2, "0")}.png`} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {mode === "decoration" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">
              Clique na casa âncora pra colocar; clique em qualquer casa que a decoração cubra pra remover. Toda casa
              coberta fica intransponível e bloqueia visão/tiro, não importa o terreno por baixo.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.values(DECORATIONS).map((dec) => (
                <button
                  key={dec.id}
                  type="button"
                  title={`${dec.name} · ${dec.footprint.length} hexes`}
                  onClick={() => setDecoBrush(dec.id)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${decoBrush === dec.id ? "border-accent" : "border-border"}`}
                >
                  <img src={decorationImage(dec.id)} alt="" className="size-6 rounded-sm object-cover bg-bg" />
                  {dec.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {(mode === "player" || mode === "enemy") && (
          <p className="text-xs text-muted">
            Clique numa casa vazia pra adicionar {mode === "player" ? "um herói" : "um inimigo"}; clique numa casa ocupada
            (do mesmo lado) pra remover. Edite nome/classe na lista abaixo.
          </p>
        )}

        <div
          className="overflow-auto resize shrink-0 border border-border rounded-md p-2 bg-bg/40 h-[60vh] min-h-[320px] min-w-[280px] [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-bg/60 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
          style={{ scrollbarWidth: "auto", scrollbarColor: "var(--color-border, #5a5a5a) transparent" }}
        >
          {gridStyle === "square" ? (
            <div
              className="grid gap-px w-max"
              style={{ gridTemplateColumns: `repeat(${draft.cols}, 22px)` }}
            >
              {draft.tiles.map((t, i) => {
                const x = i % draft.cols;
                const y = Math.floor(i / draft.cols);
                const p = draft.playerSpawns.find((s) => s.x === x && s.y === y);
                const e = draft.enemySpawns.find((s) => s.x === x && s.y === y);
                const deco = decoLookup.get(`${x},${y}`);
                return (
                  <button
                    key={i}
                    type="button"
                    title={p ? p.name : e ? e.name : deco ?? terrainHint(t)}
                    onClick={() => onCellClick(x, y)}
                    className={`size-[22px] grid place-items-center text-[9px] font-bold ${deco ? "outline outline-2 outline-offset-[-2px] outline-amber-400/80" : ""}`}
                    style={{ background: TERRAIN_SWATCH[t] }}
                  >
                    {p ? <span className="text-sky-300">P</span> : e ? <span className="text-red-400">E</span> : deco ? <span className="text-amber-300">D</span> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            (() => {
              const HR = 13;
              const SQRT3 = Math.sqrt(3);
              const hexW = SQRT3 * HR;
              const hexH = 2 * HR;
              const boardW = HR * SQRT3 * (draft.cols + 0.5);
              const boardH = HR * (1.5 * (draft.rows - 1) + 2);
              return (
                <div className="relative" style={{ width: boardW, height: boardH }}>
                  {draft.tiles.map((t, i) => {
                    const x = i % draft.cols;
                    const y = Math.floor(i / draft.cols);
                    const p = draft.playerSpawns.find((s) => s.x === x && s.y === y);
                    const e = draft.enemySpawns.find((s) => s.x === x && s.y === y);
                    const deco = decoLookup.get(`${x},${y}`);
                    const cx = HR * SQRT3 * (x + 0.5 * (y & 1) + 0.5);
                    const cy = HR * (1.5 * y + 1);
                    return (
                      <button
                        key={i}
                        type="button"
                        title={p ? p.name : e ? e.name : deco ?? terrainHint(t)}
                        onClick={() => onCellClick(x, y)}
                        className={`absolute grid place-items-center text-[8px] font-bold border ${deco ? "border-amber-400" : "border-black/20"}`}
                        style={{
                          left: cx - hexW / 2,
                          top: cy - HR,
                          width: hexW,
                          height: hexH,
                          background: TERRAIN_SWATCH[t],
                          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                        }}
                      >
                        {p ? <span className="text-sky-300">P</span> : e ? <span className="text-red-400">E</span> : deco ? <span className="text-amber-300">D</span> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>

        {draft.decorations.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs uppercase tracking-wide text-muted">Decorações ({draft.decorations.length})</p>
            {draft.decorations.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs bg-bg border border-border rounded-md px-2 py-1">
                <img src={decorationImage(p.id)} alt="" className="size-6 rounded-sm object-cover" />
                <span className="flex-1 min-w-0 truncate">{DECORATIONS[p.id]?.name ?? p.id}</span>
                <span className="text-muted tabular-nums">{p.x},{p.y}</span>
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, decorations: d.decorations.filter((_, idx) => idx !== i) }))}
                  className="text-danger px-1"
                  aria-label="Remover"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(["playerSpawns", "enemySpawns"] as const).map((side) => (
          <div key={side} className="flex flex-col gap-1.5">
            <p className="text-xs uppercase tracking-wide text-muted">
              {side === "playerSpawns" ? "Heróis" : "Inimigos"} ({draft[side].length})
            </p>
            {draft[side].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className="text-muted tabular-nums w-10">{s.x},{s.y}</span>
                <input
                  className="flex-1 min-w-0 bg-bg border border-border rounded-md px-1.5 py-1"
                  value={s.name}
                  onChange={(e) => updateSpawn(side, i, { name: e.target.value })}
                />
                <select
                  className="bg-bg border border-border rounded-md px-1.5 py-1"
                  value={s.classId}
                  onChange={(e) => updateSpawn(side, i, { classId: e.target.value as ClassId })}
                >
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      {CLASSES[c].name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 shrink-0" title="Nível (só afeta o Testar)">
                  <span className="text-muted">Nv</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_LEVEL}
                    className="w-12 bg-bg border border-border rounded-md px-1 py-1"
                    value={s.level}
                    onChange={(e) =>
                      updateSpawn(side, i, { level: Math.max(1, Math.min(MAX_LEVEL, Number(e.target.value) || DEFAULT_TEST_LEVEL)) })
                    }
                  />
                </label>
                <button type="button" onClick={() => removeSpawn(side, i)} className="text-danger px-1.5" aria-label="Remover">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-wide text-muted">
            Versões salvas de "{draft.id}" ({versions.length})
          </p>
          {versions.length === 0 ? (
            <p className="text-xs text-muted">Nenhuma ainda — Salvar cria a v1.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {versions
                .slice()
                .reverse()
                .map((v) => (
                  <div key={v.serial} className="flex items-center gap-1.5 text-xs bg-bg border border-border rounded-md px-2 py-1.5">
                    <span className={`font-bold tabular-nums ${activeSerial === v.serial ? "text-accent" : ""}`}>v{v.serial}</span>
                    <span className="text-muted flex-1 min-w-0 truncate">
                      {new Date(v.savedAt).toLocaleString()}
                      {activeSerial === v.serial ? " · ativa na campanha" : ""}
                    </span>
                    <Button size="sm" variant="quiet" onClick={() => setDraft(v.draft)}>
                      Carregar
                    </Button>
                    <Button size="sm" variant="quiet" disabled={activeSerial === v.serial} onClick={() => doActivate(v.serial)}>
                      Ativar
                    </Button>
                    <button type="button" onClick={() => doDeleteVersion(v.serial)} className="text-danger px-1" aria-label="Excluir versão">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}
          {activeSerial != null && (
            <Button size="sm" variant="ghost" onClick={doDeactivate} title="Volta esse cenário a usar os dados originais imutáveis em vez de uma versão editada">
              Usar cenário original (desativar v{activeSerial})
            </Button>
          )}
        </div>

        {exportText && (
          <label className="flex flex-col gap-1">
            <span className="text-muted text-xs uppercase tracking-wide">
              Exportado — copia e manda pro Claude colar em data.ts
            </span>
            <textarea readOnly className="bg-bg border border-border rounded-md px-2 py-1.5 text-xs font-mono h-40" value={exportText} />
          </label>
        )}
      </div>

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2 border-t border-border">
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            const playerLevels = Object.fromEntries(draft.playerSpawns.map((s) => [s.name, s.level]));
            const enemyLevels = Object.fromEntries(draft.enemySpawns.map((s) => [s.name, s.level]));
            onPlaytest(draftToMission(draft), playerLevels, enemyLevels);
          }}
        >
          Testar
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={doSave}>
            Salvar
          </Button>
          <Button variant="ghost" className="flex-1" onClick={doExport}>
            Exportar
          </Button>
          {exportText && (
            <Button
              variant="ghost"
              className="flex-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportText);
                  setCopyOk(true);
                } catch {
                  setCopyOk(false);
                }
              }}
            >
              {copyOk ? "Copiado!" : "Copiar"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function CampaignScreen({
  missions = MISSIONS,
  completed,
  test,
  ember,
  onBack,
  onPick,
}: {
  missions?: Mission[];
  completed: string[];
  test: boolean;
  ember: number;
  onBack: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <section className="h-dvh min-h-0 flex flex-col bg-bg">
      <header className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 border-b border-border">
        <button type="button" onClick={onBack} className="size-10 grid place-items-center rounded-md border border-border" aria-label="Voltar">
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm uppercase tracking-[0.18em] text-muted">{test ? "Modo teste" : "Campanha"}</p>
          <h1 className="font-display text-3xl leading-none">Cenários</h1>
        </div>
        <p className="text-sm tabular-nums text-muted border border-border rounded-md px-2 py-1">Ember {ember}</p>
      </header>
      <ol className="flex-1 min-h-0 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
        {missions.map((m) => {
          const lock = lockedMission(m.id, completed, test);
          const done = completed.includes(m.id);
          const openInn = !!m.hub && !lock;
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={lock}
                onClick={() => onPick(m.id)}
                className={`w-full text-left rounded-xl border bg-surface px-4 py-3 disabled:opacity-40 ${
                  openInn ? "inn-open" : "border-border"
                }`}
              >
                <p className="text-sm uppercase tracking-[0.16em] text-muted">
                  {String(m.index + 1).padStart(2, "0")} · {m.place}
                  {m.hub && !lock ? " · aberta" : done ? " · feito" : ""}
                </p>
                <p className="font-display text-2xl">{m.title}</p>
                <p className="text-base text-muted">{m.objective}</p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function BriefingScreen({
  mission,
  onBack,
  onStart,
}: {
  mission: (typeof MISSIONS)[number];
  onBack: () => void;
  onStart: () => void;
}) {
  const art = briefArt(mission.id);
  return (
    <section className="relative h-dvh min-h-0 flex flex-col overflow-hidden bg-bg">
      {art && (
        <>
          <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/35" />
        </>
      )}
      <header className="relative z-10 flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <button type="button" onClick={onBack} className="size-10 grid place-items-center rounded-md border border-border bg-bg/70" aria-label="Voltar">
          <ChevronLeft className="size-5" />
        </button>
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-muted">{mission.place}</p>
          <h1 className="font-display text-3xl leading-none">{mission.title}</h1>
        </div>
      </header>
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto p-5 max-w-lg">
        <p className="text-lg leading-relaxed text-fg/90">{mission.briefing}</p>
        <p className="mt-4 text-base uppercase tracking-[0.16em] text-accent">{mission.objective}</p>
      </div>
      <div className="relative z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button size="xl" className="w-full" onClick={onStart}>
          <Swords className="size-5" /> {mission.hub ? "Entrar" : "Entrar em combate"}
        </Button>
      </div>
    </section>
  );
}

function BattleScreen({
  engine,
  hud,
  paused,
  muted,
  save,
  onHud,
  onPause,
  onResume,
  onMute,
  onSave,
  onLoad,
  onQuit,
}: {
  engine: BattleEngine;
  hud: HudSnapshot;
  paused: boolean;
  muted: boolean;
  save: SaveData;
  onHud: (h: HudSnapshot) => void;
  onPause: () => void;
  onResume: () => void;
  onMute: () => void;
  onSave: () => void;
  onLoad: () => void;
  onQuit: () => void;
}) {
  const [showStatus, setShowStatus] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const [invView, setInvView] = useState<"doll" | "pack" | null>(null);
  const [hotbars, setHotbars] = useState<Record<string, (SlotAction | null)[]>>({});
  const [editingSlots, setEditingSlots] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  // Dismissing the "encerrar missão?" popup only hides THAT popup — the "Encerrar missão"
  // button in the footer stays available the whole time the field is clear (see hud.winAvailable),
  // so dismissing never strands the player without a way to finish when they're ready.
  // Resets whenever the field freshly clears again (a trap/trigger spawn dealt with),
  // rather than staying dismissed for the rest of the battle.
  const [winPopupDismissed, setWinPopupDismissed] = useState(false);
  const wasWinAvailable = useRef(false);
  useEffect(() => {
    if (hud.winAvailable && !wasWinAvailable.current) setWinPopupDismissed(false);
    wasWinAvailable.current = hud.winAvailable;
  }, [hud.winAvailable]);
  useEffect(() => {
    setHotbars(loadHotbars());
  }, []);
  useEffect(() => {
    if (showLog && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [showLog, hud.log.length]);
  // Loot found (a chest opened, a kill dropped gear) jumps the footer straight to the log so
  // it isn't missed; it reverts to the stat sheet on its own once a different unit takes its
  // turn, same as if the player had never touched the toggle.
  const prevLogLenRef = useRef(hud.log.length);
  useEffect(() => {
    if (hud.log.length > prevLogLenRef.current) {
      const added = hud.log.slice(prevLogLenRef.current);
      if (added.some((line) => line.startsWith("Loot:") || line.includes("achou"))) setShowLog(true);
    }
    prevLogLenRef.current = hud.log.length;
  }, [hud.log.length]);
  const activeUnitId = hud.turnQueue.find((t) => t.active)?.id ?? null;
  const prevActiveIdRef = useRef(activeUnitId);
  useEffect(() => {
    if (activeUnitId !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeUnitId;
      setShowLog(false);
    }
  }, [activeUnitId]);
  const unit: UnitPublic | null = hud.selected ?? hud.pendingFoe ?? hud.inspected;
  // The Mochila/Equipamento screens read straight off `save`, which is only the roster
  // snapshot from before this mission started — a chest opened mid-battle mutates the live
  // BattleEngine unit (and engine.lootEmber/lootWeapons/lootEquipment), not `save`, so those
  // finds never showed up until the mission ended. Patch a live view in for the duration of
  // the battle instead of touching the screens themselves, which are also used from the Inn
  // (no `engine` there, where `save` genuinely is the whole truth).
  const liveWeapons = { ...save.weapons };
  for (const id of engine.lootWeapons) if (!(id in liveWeapons)) liveWeapons[id] = 0;
  const liveLooseEquipment = { ...save.looseEquipment };
  for (const id of engine.lootEquipment) liveLooseEquipment[id] = (liveLooseEquipment[id] ?? 0) + 1;
  const liveSave: SaveData = {
    ...save,
    ember: save.ember + engine.lootEmber,
    bags: { ...save.bags, ...Object.fromEntries(engine.units.filter((u) => u.side === "player").map((u) => [u.name, u.bag])) },
    weapons: liveWeapons,
    looseEquipment: liveLooseEquipment,
  };
  const foe = hud.pendingFoe ?? (hud.inspected && hud.inspected.side === "enemy" && hud.selected ? hud.inspected : null);
  const showAct = hud.mode === "awaitAction" || hud.mode === "awaitAttack" || hud.mode === "selected" || hud.mode === "awaitSpell";
  const actor = hud.selected?.side === "player" ? hud.selected : null;
  const slots = actor ? (hotbars[actor.name] ?? defaultSlots(actor.classId)) : [];

  function setSlot(index: number, action: SlotAction | null) {
    if (!actor) return;
    const next = { ...hotbars, [actor.name]: slots.map((s, i) => (i === index ? action : s)) };
    setHotbars(next);
    saveHotbars(next);
  }

  function runSlot(action: SlotAction) {
    if (action.kind === "potion") {
      engine.usePotion(action.potion);
      return;
    }
    switch (action.spell) {
      case "doubleStrike":
        engine.startDoubleStrike();
        break;
      case "cleave":
        engine.startCleave();
        break;
      case "fireball":
        engine.startFireball();
        break;
      case "causticVenom":
        engine.startCausticVenom();
        break;
      case "lightning":
        engine.startLightning();
        break;
      case "magicMissile":
        engine.startMagicMissile();
        break;
      case "longShot":
        engine.startLongShot();
        break;
      case "piercing":
        engine.startPiercing();
        break;
      case "cureMinor":
        engine.startCure("cureMinor");
        break;
      case "cureWounds":
        engine.startCure("cureWounds");
        break;
      case "cureDisease":
        engine.startCureDisease();
        break;
      case "piercingThrust":
        engine.startPiercingThrust();
        break;
      case "sweep":
        engine.startSweep();
        break;
      case "trip":
        engine.startTrip();
        break;
      case "summonFamiliar":
        engine.startSummonFamiliar();
        break;
      case "webOfDreams":
        engine.startWebOfDreams();
        break;
    }
  }

  function slotDisabled(action: SlotAction): boolean {
    if (!actor || !showAct || hud.busy || actor.acted) return true;
    const count = slotCount(action, actor);
    if (count <= 0) return true;
    if (action.kind === "potion" && POTIONS[action.potion].effect === "heal" && actor.hp >= actor.maxHp) return true;
    return false;
  }

  function slotActive(action: SlotAction): boolean {
    return hud.mode === "awaitSpell" && action.kind === "spell" && hud.spellKind === action.spell;
  }

  function activateSlot(i: number) {
    if (!actor || i < 0 || i >= slots.length) return;
    const action = slots[i];
    if (editingSlots) {
      setPickerSlot(i);
      return;
    }
    if (!action || slotDisabled(action)) return;
    runSlot(action);
  }
  const activateSlotRef = useRef(activateSlot);
  activateSlotRef.current = activateSlot;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const m = /^F([1-9]|1[0-2])$/.exec(e.key);
      if (!m) return;
      e.preventDefault();
      activateSlotRef.current(Number(m[1]) - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section className="relative h-dvh min-h-0 flex flex-col bg-bg">
      <div className="relative flex-1 min-h-0">
        <BattleCanvas engine={engine} onHud={onHud} paused={paused} />
        {hud.turnQueue.length > 1 && (
          <div className="pointer-events-none absolute inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] flex items-center gap-1 flex-wrap">
            <p className="bg-surface/90 border border-border rounded-md px-2 py-0.5 text-[15px] leading-tight flex items-center gap-1.5 flex-wrap">
              {hud.turnQueue.map((q, i) => (
                <span key={q.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted">→</span>}
                  <span
                    className={
                      q.active
                        ? "text-accent font-medium"
                        : q.acted
                          ? "text-muted line-through"
                          : q.side === "enemy"
                            ? "text-danger"
                            : "text-fg"
                    }
                  >
                    {q.name}
                  </span>
                </span>
              ))}
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] flex items-start justify-end gap-1">
          <p className="bg-surface/90 border border-border rounded-md px-1.5 py-0.5 text-[10px] tabular-nums text-muted pointer-events-none">
            T{hud.turn} · {hud.playerAlive}/{hud.enemyAlive}
          </p>
          {hud.terrain && (hud.terrain.note || hud.terrain.id === "barricade" || hud.terrain.id === "hill" || hud.terrain.id === "highwood" || hud.terrain.id === "highruin") && (
            <p className="bg-surface/90 border border-border rounded-md px-1.5 py-0.5 text-[10px] text-accent pointer-events-none max-w-[14rem] truncate">
              {hud.terrain.name}
            </p>
          )}
          <div className="flex items-center gap-1 pointer-events-auto shrink-0">
            <button
              type="button"
              onClick={onMute}
              className="size-7 grid place-items-center rounded-md border border-border bg-surface/90"
              aria-label="Som"
            >
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              className="h-7 px-2 rounded-md border border-border bg-surface/90 text-[10px] tracking-[0.14em] uppercase"
            >
              Opções
            </button>
          </div>
        </div>
        {hud.banner && (
          <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center">
            <div className="bg-surface/95 border border-border rounded-md px-4 py-1.5 font-display text-lg tracking-wide">
              {hud.banner}
            </div>
          </div>
        )}
        {hud.tip && !(hud.winAvailable && !winPopupDismissed) && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2">
            <p className="bg-surface/90 border border-border rounded-md px-2 py-1 text-xs text-muted text-center">{hud.tip}</p>
          </div>
        )}
        {hud.winAvailable && !hud.result && !winPopupDismissed && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center">
            <div className="pointer-events-auto bg-surface/95 border border-accent rounded-md px-3 py-2 flex items-center gap-3 flex-wrap justify-center">
              <p className="text-sm">Todos os inimigos caíram. Encerrar a missão?</p>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => engine.confirmFinish()}>
                  Encerrar missão
                </Button>
                <Button size="sm" variant="quiet" onClick={() => setWinPopupDismissed(true)}>
                  Continuar explorando
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-border bg-surface px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="min-h-16 sm:min-h-[4.5rem] flex items-center gap-2">
          {unit ? (
            <>
              <button
                type="button"
                onClick={() => setShowStatus(true)}
                className="shrink-0 rounded-md ring-offset-2 ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:opacity-80"
                title="Ver status"
              >
                <img
                  src={HERO_PORTRAIT[unit.sprite] ?? `/game/sprites/${unit.sprite}/1.png`}
                  alt=""
                  className={
                    HERO_PORTRAIT[unit.sprite]
                      ? "h-16 w-12 sm:h-20 sm:w-14 object-cover rounded-md"
                      : "h-14 w-14 object-contain"
                  }
                />
              </button>
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className="min-w-0 flex-1 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title={showLog ? "Ver status" : "Ver log de combate"}
              >
                {showLog ? (
                  <div ref={logRef} className="h-16 sm:h-20 overflow-y-auto pr-1">
                    {hud.log.length === 0 ? (
                      <p className="text-[12.5px] text-muted">Nada aconteceu ainda.</p>
                    ) : (
                      hud.log.map((line, i) => (
                        <p key={i} className="text-[12.5px] text-muted leading-snug">
                          {line}
                        </p>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {unit.name} · Nv {unit.level}
                        {unit.side === "player" && (
                          <span className="text-xs text-muted font-normal ml-1 align-middle tabular-nums">
                            {unit.level >= MAX_LEVEL ? "· NÍVEL MÁX." : `· ${unit.xp}/${EXP_TO_LEVEL} XP`}
                          </span>
                        )}
                      </p>
                      <p className={`text-xs ${unit.side === "enemy" ? "text-danger" : "text-muted"}`}>
                        {unit.className}
                        {unit.diseased && <span className="text-danger"> · Doente</span>}
                        {unit.poisoned && <span className="text-danger"> · Envenenado</span>}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-border overflow-hidden">
                        <div
                          className={`hp-fill h-full ${unit.side === "enemy" ? "bg-danger" : "bg-accent"}`}
                          style={{ width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs tabular-nums text-fg shrink-0">
                        {unit.hp}/{unit.maxHp}
                      </p>
                    </div>
                    <p className="text-[11px] tabular-nums text-muted leading-snug">
                      {hud.forecast && foe
                        ? `${hud.forecast.dmgOut} em ${foe.name}${hud.forecast.canCounter ? ` · contra ${hud.forecast.dmgBack}` : " · sem contra"}${hud.forecast.kill ? " · abate" : ""}`
                        : sheetLine(unit)}
                    </p>
                  </>
                )}
              </button>
            </>
          ) : (
            <p className="text-xs text-muted">{hud.phase === "enemy" ? "O inimigo age…" : "Toque numa aliada ou num inimigo."}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 min-h-10 items-center mt-1">
          {hud.offHandKind && (
            <Button
              size="sm"
              variant="quiet"
              disabled={!showAct || hud.busy || hud.mode === "awaitSpell"}
              onClick={() => engine.startOffHand()}
              title={
                hud.offHandKind === "shield"
                  ? `${Math.round((EQUIPMENT[unit?.offHandId ?? ""]?.dmgMul ?? 0.75) * 100)}% do dano normal · 70% de chance de atordoar por 1 turno`
                  : "Ataca com a arma da mão secundária"
              }
            >
              {hud.offHandKind === "shield" ? "Investida de Escudo" : "Mão Secundária"}
            </Button>
          )}
          <Button size="sm" disabled={!showAct || !hud.canAttack || hud.busy || hud.mode === "awaitSpell"} onClick={() => engine.startAttack()}>
            Atacar
          </Button>
          {hud.mode === "awaitSpell" && (
            <Button size="sm" disabled={!hud.spellReady || hud.busy} onClick={() => engine.confirmSpell()}>
              Lançar
            </Button>
          )}
          {hud.canLockpick && (
            <button
              type="button"
              disabled={!showAct || hud.busy}
              onClick={() => engine.useLockpick()}
              title="Custa 1 Gazua para abrir."
              className="relative h-9 px-2 rounded-md border border-border bg-bg flex items-center gap-1 disabled:opacity-40"
            >
              <img src="/game/icons/lockpick.png" alt="" className="size-5 rounded-sm object-contain" />
              <span className="text-sm tabular-nums">×{actor?.bag.lockpick ?? 0}</span>
            </button>
          )}
          <Button size="sm" variant="quiet" disabled={!showAct || hud.busy} onClick={() => engine.wait()}>
            Esperar
          </Button>
          <Button size="sm" variant="ghost" disabled={!showAct || hud.busy} onClick={() => engine.cancel()}>
            Cancelar
          </Button>
          {actor && (
            <div className="flex items-center gap-1">
              {slots.map((action, i) => {
                const empty = !action;
                const disabled = action ? slotDisabled(action) : !editingSlots;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!editingSlots && disabled}
                    onClick={() => activateSlot(i)}
                    title={`F${i + 1} · ${action ? slotTooltip(action) : "Slot vazio"}`}
                    className={`relative size-9 grid place-items-center rounded-md border ${
                      action && slotActive(action) ? "border-accent bg-accent/20" : "border-border bg-bg"
                    } ${editingSlots ? "outline outline-1 outline-dashed outline-muted" : ""} disabled:opacity-40`}
                  >
                    <span className="absolute -top-1 -left-1 bg-surface border border-border rounded px-0.5 text-[8px] tabular-nums leading-tight text-muted">
                      F{i + 1}
                    </span>
                    {empty ? (
                      <span className="text-muted text-xs">+</span>
                    ) : (
                      <>
                        <img src={slotIcon(action)} alt="" className="size-6 rounded-sm object-cover" />
                        <span className="absolute -bottom-1 -right-1 bg-surface border border-border rounded px-0.5 text-[9px] tabular-nums leading-tight">
                          {slotCount(action, actor)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setEditingSlots((v) => !v)}
                title="Configurar slots"
                className={`size-9 grid place-items-center rounded-md border ${editingSlots ? "border-accent bg-accent/20" : "border-border bg-bg"}`}
              >
                <Pencil className="size-4" />
              </button>
            </div>
          )}
          {hud.winAvailable && !hud.result && (
            <Button size="sm" className="ml-auto" onClick={() => engine.confirmFinish()}>
              Encerrar missão
            </Button>
          )}
          <Button size="sm" variant="ghost" className={hud.winAvailable && !hud.result ? "" : "ml-auto"} disabled={hud.phase !== "player" || !!hud.result} onClick={() => engine.endTurn()}>
            Fim do turno
          </Button>
        </div>
      </footer>

      {paused && (
        <div className="absolute inset-0 z-30 bg-bg/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-6">
            <h2 className="font-display text-2xl mb-4">Opções</h2>
            <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">Zoom</p>
            <div className="grid grid-cols-4 gap-1 mb-4">
              {(["Distante", "Longe", "Médio", "Perto"] as const).map((label, i) => (
                <Button key={label} size="sm" variant={hud.zoom === i ? undefined : "quiet"} onClick={() => engine.setZoom(i)}>
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">Velocidade</p>
            <div className="grid grid-cols-2 gap-1 mb-4">
              {(["normal", "fast"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={hud.speedMode === mode ? undefined : "quiet"}
                  onClick={() => engine.setSpeed(mode)}
                >
                  {mode === "normal" ? "Normal" : "Rápida"}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={onResume}>Continuar</Button>
              <Button variant="quiet" onClick={onSave}>
                Save
              </Button>
              <Button variant="quiet" onClick={onLoad}>
                Load
              </Button>
              <Button variant="ghost" onClick={onQuit}>
                Desistir
              </Button>
            </div>
          </div>
        </div>
      )}

      {showStatus && unit && (
        <StatusPanel
          unit={unit}
          onClose={() => setShowStatus(false)}
          onOpenInventory={
            unit.side === "player"
              ? () => {
                  setShowStatus(false);
                  setInvView("pack");
                }
              : undefined
          }
        />
      )}

      {invView === "doll" && unit && unit.side === "player" && (
        <PaperDollScreen
          heroName={unit.name}
          classId={unit.classId}
          save={liveSave}
          onClose={() => setInvView(null)}
          onSwitchToBackpack={() => setInvView("pack")}
        />
      )}
      {invView === "pack" && unit && unit.side === "player" && (
        <BackpackScreen
          heroName={unit.name}
          save={liveSave}
          onClose={() => setInvView(null)}
          onSwitchToDoll={() => setInvView("doll")}
        />
      )}

      {pickerSlot != null && actor && (
        <SlotPicker
          classId={actor.classId}
          onPick={(action) => {
            setSlot(pickerSlot, action);
            setPickerSlot(null);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </section>
  );
}

function SlotPicker({
  classId,
  onPick,
  onClose,
}: {
  classId: ClassId;
  onPick: (action: SlotAction | null) => void;
  onClose: () => void;
}) {
  const options: SlotAction[] = [
    ...classSpells(classId).map((spell): SlotAction => ({ kind: "spell", spell })),
    ...ALL_POTIONS.map((potion): SlotAction => ({ kind: "potion", potion })),
  ];
  return (
    <div
      className="absolute inset-0 z-50 bg-bg/85 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-lg">Escolher pra esse slot</p>
          <button type="button" onClick={onClose} className="size-8 grid place-items-center rounded-md border border-border" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-1.5 max-h-[60dvh] overflow-y-auto">
          {options.map((action) => (
            <button
              key={action.kind === "potion" ? `p-${action.potion}` : `s-${action.spell}`}
              type="button"
              onClick={() => onPick(action)}
              className="flex items-center gap-2 bg-bg border border-border rounded-md px-2 py-2 text-left"
            >
              <img src={slotIcon(action)} alt="" className="size-6 rounded-sm object-cover shrink-0" />
              <span className="text-sm">{slotLabel(action)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPick(null)}
            className="flex items-center gap-2 bg-bg border border-border rounded-md px-2 py-2 text-left text-muted"
          >
            <span className="size-6 grid place-items-center shrink-0">—</span>
            <span className="text-sm">Deixar vazio</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPanel({ unit, onClose, onOpenInventory }: { unit: UnitPublic; onClose: () => void; onOpenInventory?: () => void }) {
  const stats: Array<[string, string | number]> = [
    ["ATK", unit.atk],
    ["MAG", unit.mag],
    ["DEF", unit.def],
    ["RES", unit.res],
    ["MOV", unit.mov],
    ["Alcance", rangeLabel(unit.minRange, unit.maxRange)],
  ];
  const base = PROMOTED_BASE[unit.classId] ?? unit.classId;
  const mage = base === "mage";
  const conjurer = base === "conjurer";
  const healer = base === "healer";
  const archer = base === "archer";
  const swordsman = base === "swordsman";
  const lancer = base === "lancer";

  return (
    <div
      className="absolute inset-0 z-40 bg-bg/85 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[88dvh] overflow-y-auto bg-surface border border-border rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={HERO_PORTRAIT[unit.sprite] ?? `/game/sprites/${unit.sprite}/1.png`}
              alt=""
              className={
                HERO_PORTRAIT[unit.sprite]
                  ? "h-24 w-20 object-cover rounded-lg border border-border shrink-0"
                  : "h-20 w-20 object-contain shrink-0"
              }
            />
            <div className="min-w-0">
              <p className="font-display text-xl leading-tight truncate">{unit.name}</p>
              <p className={`text-xs ${unit.side === "enemy" ? "text-danger" : "text-muted"}`}>
                {unit.className} · Nv {unit.level}
              </p>
              {unit.diseased && <p className="text-xs text-danger mt-0.5">Doente · −10% em todos os stats</p>}
              {unit.poisoned && <p className="text-xs text-danger mt-0.5">Envenenado · 1D4 dano por turno</p>}
              {unit.side === "player" && (
                <div className="mt-1.5 max-w-[9rem]">
                  {unit.level >= MAX_LEVEL ? (
                    <p className="text-[11px] text-muted tabular-nums">Nível máximo</p>
                  ) : (
                    <>
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${(unit.xp / EXP_TO_LEVEL) * 100}%` }} />
                      </div>
                      <p className="text-[11px] text-muted tabular-nums mt-0.5">
                        {unit.xp}/{EXP_TO_LEVEL} XP
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenInventory && (
              <button type="button" onClick={onOpenInventory} className="h-9 px-3 rounded-md border border-border text-sm flex items-center gap-1.5">
                <img src={BAG_ICON} alt="" className="size-5 rounded-sm object-contain" />
                Mochila
              </button>
            )}
            <button type="button" onClick={onClose} className="size-8 grid place-items-center rounded-md border border-border" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full ${unit.side === "enemy" ? "bg-danger" : "bg-accent"}`}
                style={{ width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }}
              />
            </div>
            <p className="text-xs tabular-nums text-fg shrink-0">
              {unit.hp}/{unit.maxHp}
            </p>
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">Ficha</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-bg border border-border rounded-md px-2 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
              <p className="text-sm font-medium tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {unit.side === "player" && (swordsman || mage || conjurer || archer || healer || lancer) && (
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-muted mb-2">Magias e habilidades</p>
            <div className="grid grid-cols-1 gap-1.5">
                  {swordsman && (
                    <>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/cleave.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          {DOUBLE_STRIKE.name} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("doubleStrike")!)]}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/cleave-crossed-blades.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          {CLEAVE.name} {CLEAVE.hexes} hex, arma + {diceFormula(CLEAVE.bonusDice, CLEAVE.bonusFaces, CLEAVE.bonusBonus)}{" "}
                          <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("cleave")!)]}</span>
                        </p>
                      </div>
                    </>
                  )}
                  {mage && (
                    <>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/magic-missile.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          {MAGIC_MISSILE.name} {diceFormula(MAGIC_MISSILE.dice, MAGIC_MISSILE.faces, MAGIC_MISSILE.bonus)}{" "}
                          <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("magicMissile")!)]}</span>
                        </p>
                      </div>
                      {unit.spells[tierKey(spellTier("lightning")!)] > 0 && (
                        <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                          <img src="/game/icons/lightning.png?v=4" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                          <p className="text-xs truncate">
                            Raio {lightningFormula(unit.level)} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("lightning")!)]}</span>
                          </p>
                        </div>
                      )}
                      {unit.spells[tierKey(spellTier("fireball")!)] > 0 && (
                        <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                          <img src="/game/icons/fireball.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                          <p className="text-xs truncate">
                            Fogo {fireballFormula(unit.level)} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("fireball")!)]}</span>
                          </p>
                        </div>
                      )}
                      {unit.spells[tierKey(spellTier("causticVenom")!)] > 0 && (
                        <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                          <img src="/game/icons/caustic-venom.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                          <p className="text-xs truncate">
                            {CAUSTIC_VENOM.name} {diceFormula(CAUSTIC_VENOM.centerDice, CAUSTIC_VENOM.centerFaces, CAUSTIC_VENOM.centerBonus)}{" "}
                            <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("causticVenom")!)]}</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {conjurer && (
                    <>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/magic-missile.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          {SUMMON_FAMILIAR.name} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("summonFamiliar")!)]}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/caustic-venom.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          {WEB_OF_DREAMS.name} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("webOfDreams")!)]}</span>
                        </p>
                      </div>
                    </>
                  )}
                  {archer && (
                    <>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/long-shot.png?v=3" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          Longo <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("longShot")!)]}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/piercing.png?v=3" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          Perfura <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("piercing")!)]}</span>
                        </p>
                      </div>
                    </>
                  )}
                  {healer && (
                    <>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/cure-minor.png?v=5" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          Menor <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("cureMinor")!)]}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/cure-wounds.png?v=5" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          Simples <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("cureWounds")!)]}</span>
                        </p>
                      </div>
                      {unit.spells[tierKey(spellTier("cureDisease")!)] > 0 && (
                        <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                          <img src="/game/icons/cure-minor.png?v=5" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                          <p className="text-xs truncate">
                            {CURE_DISEASE.name} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("cureDisease")!)]}</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {lancer && (
                    <>
                      <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                        <img src="/game/icons/piercing.png?v=3" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                        <p className="text-xs truncate">
                          {PIERCING_THRUST.name} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("piercingThrust")!)]}</span>
                        </p>
                      </div>
                      {unit.spells[tierKey(spellTier("sweep")!)] > 0 && (
                        <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                          <img src="/game/icons/cleave-crossed-blades.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                          <p className="text-xs truncate">
                            {SWEEP.name} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("sweep")!)]}</span>
                          </p>
                        </div>
                      )}
                      {unit.spells[tierKey(spellTier("trip")!)] > 0 && (
                        <div className="flex items-center gap-1.5 bg-bg border border-border rounded-md px-2 py-1.5">
                          <img src="/game/icons/cleave.png" alt="" className="size-5 rounded-sm object-cover shrink-0" />
                          <p className="text-xs truncate">
                            {TRIP.name} <span className="tabular-nums text-muted">×{unit.spells[tierKey(spellTier("trip")!)]}</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
          </>
        )}
      </div>
    </div>
  );
}

/** XP bar on the post-mission screen: mounts at the hero's pre-battle progress, then eases
 * up to the post-battle value on the next paint, so the gain reads as a fill instead of
 * snapping straight to the end state. */
function GrowthXpBar({ from, to }: { from: number; to: number }) {
  const [pct, setPct] = useState(from);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPct(to));
    return () => cancelAnimationFrame(id);
  }, [to]);
  return (
    <span className="h-1.5 w-24 rounded-full bg-border overflow-hidden shrink-0">
      <span className="block h-full bg-accent transition-[width] duration-[1400ms] ease-out" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  );
}

function ResultScreen({
  win,
  title,
  body,
  turn,
  growth,
  art,
  onTitle,
  onNext,
  onInn,
  onMap,
  mapLabel,
  hasNext,
  innOpen,
  retry,
  loot,
}: {
  win: boolean;
  title: string;
  body: string;
  turn: number;
  growth: GrowthLine[] | null;
  art: string | null;
  onTitle: () => void;
  onNext: () => void;
  onInn?: () => void;
  onMap?: () => void;
  mapLabel?: string;
  hasNext: boolean;
  innOpen?: boolean;
  retry?: boolean;
  loot?: string[];
}) {
  return (
    <section className="relative h-dvh min-h-0 flex flex-col overflow-hidden bg-bg">
      {art && (
        <>
          <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/40 to-bg/20" />
        </>
      )}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-4">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">
          {win ? "Vitória" : "Derrota"} · T{turn}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2 mb-2">{title}</h1>
        <p className="text-lg text-muted mb-6">{body}</p>
        {loot && loot.length > 0 && <p className="text-sm text-accent mb-4">Achado no campo: {loot.join(", ")}</p>}
        {growth && growth.length > 0 && (
          <ul className="mb-6 space-y-2 max-w-lg">
            {growth.map((g) => (
              <li key={g.name} className="rounded-md border border-border bg-bg/55 px-3 py-2.5">
                <p className="font-medium text-lg">
                  {g.name}
                  {g.to !== g.from ? ` · Nv ${g.from} → ${g.to}` : ` · Nv ${g.from}`}
                  {g.fallen ? " · caiu" : ""}
                </p>
                {g.to < MAX_LEVEL ? (
                  <p className="flex items-center gap-2 mt-1 text-sm">
                    <GrowthXpBar from={(g.xpFrom / EXP_TO_LEVEL) * 100} to={(g.xp / EXP_TO_LEVEL) * 100} />
                    <span className="text-muted tabular-nums">
                      {g.xp}/{EXP_TO_LEVEL} XP{g.to !== g.from ? " · subiu" : ""}
                    </span>
                  </p>
                ) : (
                  g.to !== g.from && <p className="mt-1 text-sm text-accent">Nível máximo · subiu</p>
                )}
                <p className="text-sm text-muted tabular-nums mt-1">Combate: {g.hpBattle}/{g.maxFrom}</p>
                {g.fallen ? (
                  <p className="text-sm text-muted tabular-nums">Descanso: revive com {g.hpCamp} HP (metade de {g.maxTo})</p>
                ) : (
                  <p className="text-sm tabular-nums text-fg/90">
                    Descanso: {g.restHp > 0 ? `+${g.restHp} HP` : "sem feridas"}
                    <span className="text-muted"> · metade do que faltava</span>
                  </p>
                )}
                {g.to !== g.from && (
                  <p className="text-sm tabular-nums text-accent">
                    Nível: +{g.levelHp} HP máximo ({g.maxFrom} → {g.maxTo})
                    {g.atkTo !== g.atkFrom ? ` · AT ${g.atkFrom} → ${g.atkTo}` : ""}
                    {g.magTo !== g.magFrom ? ` · MAG ${g.magFrom} → ${g.magTo}` : ""}
                    {g.defTo !== g.defFrom ? ` · DF ${g.defFrom} → ${g.defTo}` : ""}
                    {g.resTo !== g.resFrom ? ` · RES ${g.resFrom} → ${g.resTo}` : ""}
                  </p>
                )}
                <p className="text-base tabular-nums mt-1">Acampamento: {g.hpCamp}/{g.maxTo}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative z-10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2">
        {hasNext && (
          <Button size="xl" className="w-full" onClick={onNext}>
            {retry ? (
              <>
                <RotateCcw className="size-5" /> Tentar de novo
              </>
            ) : (
              "Próxima missão"
            )}
          </Button>
        )}
        {win && innOpen && onInn && (
          <Button variant="quiet" className="w-full inn-open" onClick={onInn}>
            Estalagem do Osso Seco
          </Button>
        )}
        {(win || mapLabel) && onMap && (
          <Button variant="ghost" className="w-full" onClick={onMap}>
            {mapLabel ?? "Cenários"}
          </Button>
        )}
        <Button variant="ghost" className="w-full" onClick={onTitle}>
          Tela inicial
        </Button>
      </div>
    </section>
  );
}

function PromotionScreen({
  pending,
  onPick,
}: {
  pending: { name: string; options: [ClassId, ClassId] }[];
  onPick: (name: string, classId: ClassId) => void;
}) {
  const current = pending[0];
  if (!current) return null;
  return (
    <div className="absolute inset-0 z-50 bg-bg/90 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-5 max-h-[90dvh] overflow-y-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Nível {PROMOTE_LEVEL}</p>
        <h2 className="font-display text-2xl leading-none mt-1 mb-2">{current.name} pode se promover</h2>
        <p className="text-sm text-muted mb-4">
          Escolha um caminho. {current.name} não perde as magias que já tem — as novas se somam a partir de agora.
        </p>
        <div className="flex flex-col gap-2">
          {current.options.map((classId) => {
            const cls = CLASSES[classId];
            return (
              <button
                key={classId}
                type="button"
                onClick={() => onPick(current.name, classId)}
                className="w-full text-left rounded-xl border border-border bg-bg/40 px-4 py-3 hover:border-accent"
              >
                <p className="font-display text-xl leading-tight">{cls.name}</p>
                <p className="text-sm text-muted">{sheetLine(statsFor(classId, PROMOTE_LEVEL))}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SlotScreen({
  mode,
  bank,
  overwrite,
  onOverwrite,
  onClose,
  onPick,
}: {
  mode: "new" | "continue" | "save" | "load";
  bank: SaveBank;
  overwrite: number | null;
  onOverwrite: (i: number | null) => void;
  onClose: () => void;
  onPick: (index: number) => void;
}) {
  const title = mode === "new" ? "Nova campanha" : mode === "continue" ? "Continuar" : mode === "load" ? "Load" : "Save";
  const hint =
    mode === "new"
      ? "Escolha o slot. Um slot ocupado será substituído."
      : mode === "continue" || mode === "load"
        ? "O último usado vem marcado. Toque para carregar."
        : "Grava o começo deste combate. O slot anterior permanece se você escolher outro.";

  return (
    <div className="absolute inset-0 z-40 bg-bg/85 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl p-5 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Arquivos</p>
            <h2 className="font-display text-2xl leading-none mt-1">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="size-11 grid place-items-center" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm text-muted mb-4">{hint}</p>
        <ol className="flex flex-col gap-2">
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const slot = bank.slots[i] ?? null;
            const empty = isSlotEmpty(slot);
            const last = i === bank.lastSlot && hasAnySave(bank) && !empty;
            const info = slotProgress(slot);
            const disabled = (mode === "continue" || mode === "load") && empty;
            const confirm = overwrite === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if ((mode === "new" || mode === "save") && !empty && !confirm) {
                      onOverwrite(i);
                      return;
                    }
                    onPick(i);
                  }}
                  className={`w-full text-left rounded-xl border px-4 py-3 disabled:opacity-40 ${
                    last ? "border-accent bg-bg/70" : "border-border bg-bg/40"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Slot {i + 1}</p>
                    {last && <p className="text-[10px] uppercase tracking-[0.14em] text-accent">Último usado</p>}
                  </div>
                  <p className="font-display text-xl leading-tight">{info.title}</p>
                  <p className="text-sm text-muted">{info.detail}</p>
                  {slot && !empty && (
                    <p className="text-xs tabular-nums text-muted mt-1">{formatStamp(slot.updatedAt)}</p>
                  )}
                  {confirm && <p className="text-xs text-accent mt-2">Toque de novo para substituir este slot.</p>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

