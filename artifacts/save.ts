import { CLASSES, CURES, FIREBALL, MAX_LEVEL, MISSIONS, startingBags, statsFor } from "./data";
import type { Bag, BattleSnapshot, BattleUnitSnap, ClassId, SaveData, Side, Unit } from "./types";

export const SAVE_KEY = "ember-save";
export const SAVE_BAK_KEY = "ember-save.bak";
const LEGACY_KEY = "brasa-save";
export const SAVE_VERSION = 6;

export const DEFAULT_LEVELS: Record<string, number> = { Kael: 1, Neera: 1, Voss: 1, Salazar: 1 };

const HEROES = ["Kael", "Neera", "Voss", "Salazar"] as const;
const MISSION_IDS = new Set(MISSIONS.map((m) => m.id));

function emptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    completed: [],
    unitHp: {},
    levels: { ...DEFAULT_LEVELS },
    bags: startingBags(),
    muted: false,
    updatedAt: Date.now(),
    battle: null,
  };
}

function cloneBags(src?: Record<string, Bag>): Record<string, Bag> {
  const base = startingBags();
  if (!src) return base;
  for (const name of Object.keys(base)) {
    const b = src[name];
    if (!b) continue;
    base[name] = {
      mid: clampInt(b.mid, 0, 9),
      weak: clampInt(b.weak ?? (b as { high?: number }).high, 0, 9),
    };
  }
  return base;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function renameHero<T>(map: Record<string, T> | undefined, from: string, to: string): void {
  if (!map) return;
  if (map[from] != null && map[to] == null) {
    map[to] = map[from];
    delete map[from];
  }
}

function cleanStringList(value: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item) continue;
    if (allowed && !allowed.has(item)) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function cleanLevels(raw: unknown): Record<string, number> {
  const levels = { ...DEFAULT_LEVELS };
  if (!raw || typeof raw !== "object") return levels;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!HEROES.includes(k as (typeof HEROES)[number])) continue;
    levels[k] = clampInt(v, 1, MAX_LEVEL);
  }
  return levels;
}

function cleanHp(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!HEROES.includes(k as (typeof HEROES)[number])) continue;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0) continue;
    out[k] = n;
  }
  return out;
}

function cleanBag(raw: unknown): Bag {
  const b = raw && typeof raw === "object" ? (raw as Bag) : { mid: 0, weak: 0 };
  return { mid: clampInt(b.mid, 0, 9), weak: clampInt(b.weak, 0, 9) };
}

const CLASS_IDS = new Set(Object.keys(CLASSES));

function cleanUnitSnap(raw: unknown): BattleUnitSnap | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as BattleUnitSnap;
  if (typeof u.id !== "string" || typeof u.name !== "string") return null;
  if (!CLASS_IDS.has(u.classId)) return null;
  if (u.side !== "player" && u.side !== "enemy") return null;
  return {
    id: u.id,
    name: u.name,
    classId: u.classId,
    side: u.side,
    x: clampInt(u.x, 0, 32),
    y: clampInt(u.y, 0, 32),
    hp: clampInt(u.hp, 0, 400),
    moved: !!u.moved,
    facing: u.facing === -1 ? -1 : 1,
    alive: !!u.alive && u.hp > 0,
    level: clampInt(u.level, 1, MAX_LEVEL),
    bag: cleanBag(u.bag),
    spells: {
      fireball: clampInt(u.spells?.fireball, 0, FIREBALL.uses),
      cureMinor: clampInt(u.spells?.cureMinor, 0, CURES.cureMinor.uses),
      cureWounds: clampInt(u.spells?.cureWounds, 0, CURES.cureWounds.uses),
    },
  };
}

function cleanBattle(raw: unknown): BattleSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as BattleSnapshot;
  if (typeof b.missionId !== "string" || !MISSION_IDS.has(b.missionId)) return null;
  if (!Array.isArray(b.units) || b.units.length === 0) return null;
  const units = b.units.map(cleanUnitSnap).filter((u): u is BattleUnitSnap => !!u);
  if (!units.some((u) => u.side === "player" && u.alive)) return null;
  return {
    missionId: b.missionId,
    turn: clampInt(b.turn, 1, 99),
    phase: b.phase === "enemy" ? "enemy" : "player",
    units,
  };
}

function migrate(raw: Record<string, unknown>): SaveData {
  renameHero(raw.levels as Record<string, number> | undefined, "Nira", "Neera");
  renameHero(raw.unitHp as Record<string, number> | undefined, "Nira", "Neera");
  renameHero(raw.bags as Record<string, Bag> | undefined, "Nira", "Neera");
  renameHero(raw.levels as Record<string, number> | undefined, "Silas", "Salazar");
  renameHero(raw.unitHp as Record<string, number> | undefined, "Silas", "Salazar");
  renameHero(raw.bags as Record<string, Bag> | undefined, "Silas", "Salazar");

  const version = clampInt(raw.version, 0, SAVE_VERSION);
  const levels = cleanLevels(raw.levels);
  if (!raw.levels || typeof raw.levels !== "object") {
    const n = 1 + cleanStringList(raw.completed).length;
    for (const k of Object.keys(levels)) levels[k] = Math.min(MAX_LEVEL, n);
  }

  return {
    version: SAVE_VERSION,
    completed: cleanStringList(raw.completed, MISSION_IDS),
    unitHp: cleanHp(raw.unitHp),
    levels,
    bags: version < 4 ? startingBags() : cloneBags(raw.bags as Record<string, Bag>),
    muted: raw.muted === true,
    updatedAt: typeof raw.updatedAt === "number" && raw.updatedAt > 0 ? raw.updatedAt : Date.now(),
    battle: cleanBattle(raw.battle),
  };
}

function parseRaw(text: string | null): SaveData | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return migrate(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadSave(): SaveData {
  const primary = parseRaw(readKey(SAVE_KEY));
  if (primary) return primary;
  const bak = parseRaw(readKey(SAVE_BAK_KEY));
  if (bak) {
    persist(bak, false);
    return bak;
  }
  const legacy = parseRaw(readKey(LEGACY_KEY));
  if (legacy) {
    persist(legacy, false);
    return legacy;
  }
  return emptySave();
}

function persist(data: SaveData, rotateBackup: boolean): void {
  const next: SaveData = { ...data, version: SAVE_VERSION, updatedAt: Date.now() };
  const json = JSON.stringify(next);
  if (rotateBackup) {
    const prev = readKey(SAVE_KEY);
    if (prev && prev !== json) writeKey(SAVE_BAK_KEY, prev);
  }
  writeKey(SAVE_KEY, json);
}

export function writeSave(data: SaveData): SaveData {
  const next = migrate({ ...data, version: SAVE_VERSION });
  persist(next, true);
  return next;
}

export function patchSave(partial: Partial<SaveData>): SaveData {
  const current = loadSave();
  return writeSave({ ...current, ...partial, battle: partial.battle === undefined ? current.battle : partial.battle });
}

export function clearSave(): SaveData {
  const next = emptySave();
  persist(next, true);
  return next;
}

export function clearBattle(): SaveData {
  return patchSave({ battle: null });
}

export function exportSave(data: SaveData = loadSave()): string {
  return JSON.stringify({ ...data, version: SAVE_VERSION }, null, 2);
}

export function importSave(json: string): SaveData {
  const parsed = parseRaw(json);
  if (!parsed) throw new Error("Arquivo de save inválido.");
  return writeSave(parsed);
}

export function unitFromSnap(snap: BattleUnitSnap): Unit {
  const cls = CLASSES[snap.classId as ClassId];
  const st = statsFor(snap.classId as ClassId, snap.level);
  const hp = snap.alive ? Math.min(st.hp, Math.max(0, snap.hp)) : 0;
  return {
    id: snap.id,
    name: snap.name,
    classId: cls.id,
    className: cls.name,
    role: cls.role,
    side: snap.side as Side,
    sprite: cls.sprite,
    x: snap.x,
    y: snap.y,
    hp,
    maxHp: st.hp,
    atk: st.atk,
    mag: st.mag,
    def: st.def,
    res: st.res,
    mov: st.mov,
    minRange: st.minRange,
    maxRange: st.maxRange,
    moved: snap.moved,
    facing: snap.facing,
    alive: snap.alive && hp > 0,
    drawX: snap.x,
    drawY: snap.y,
    flash: 0,
    fade: snap.alive ? 1 : 0,
    bob: 0,
    level: snap.level,
    bag: { ...snap.bag },
    spells: { ...snap.spells },
    size: cls.size,
  };
}

export function snapFromUnit(u: Unit): BattleUnitSnap {
  return {
    id: u.id,
    name: u.name,
    classId: u.classId,
    side: u.side,
    x: u.x,
    y: u.y,
    hp: u.hp,
    moved: u.moved,
    facing: u.facing,
    alive: u.alive,
    level: u.level,
    bag: { ...u.bag },
    spells: { ...u.spells },
  };
}
