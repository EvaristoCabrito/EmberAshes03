/** Maps authored in the Map Editor, saved as real files under src/game/maps/.
 *
 * The editor's "Salvar" posts a draft to the dev-only route in
 * scripts/map-save-plugin.mjs, which writes src/game/maps/<id>-<serial>.json —
 * "vau-001.json", "vau-002.json", "misty-cave-001.json". Serials are never
 * overwritten: each save appends the next number, so an edit can always be
 * rolled back to an earlier one by deleting the newer file.
 *
 * A saved map is found by its scenario id (its file name) and, when it names a
 * locationId, shows up at that spot on the world map. The highest serial for a
 * given id is the one that plays.
 *
 * Nothing here runs the procedural passes in data.ts (rockifyColumns,
 * decorateOpenTerrain): those exist to dress the hand-written RAW_MISSIONS, and
 * a map arranged by hand in the editor loads exactly as it was arranged.
 */
import { MISSIONS, TILE_CHAR, WORLD_LOCATIONS } from "./data";
import type { DecorationPlacement, Mission, Spawn, TerrainId, WinCondition, WorldLocation } from "./types";

/** A spawn as edited in the Map Editor — the real Spawn shape plus a per-spawn test
 * level, which only exists for "Testar" (balance testing). It never leaves the editor:
 * draftToMission() strips it back down to a plain Spawn before export/playtest. */
export interface DraftSpawn extends Spawn {
  level: number;
}

export interface MapDraft {
  /** Which campaign scenario this map authors for — matches a real Mission.id (e.g.
   * "o-vau") to version-edit that scenario, or any free id for a standalone map with no
   * campaign slot. Versions are grouped and saved under this id — it's the "Cenário
   * alvo" the user assigns, not a per-edit-session unique key. It is also the file
   * name saved maps get, so it's how a map is found again. */
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
  /** Which world map location this map hangs off, by WorldLocation.id — "" for a map
   * that shouldn't appear on the map at all. A map already reachable through its
   * scenario's own location keeps showing up there whatever this says; this is what
   * puts a NEW map somewhere (Village, Cemetery, Misty Cave, ...). */
  locationId: string;
  cols: number;
  rows: number;
  tiles: TerrainId[];
  /** Art variant per tile (same indexing as tiles) — which numbered version (001, 002,
   * ...) paints there. Defaults to 0 (the "001" file, safe for existing missions). */
  tileVariants: number[];
  decorations: DecorationPlacement[];
  playerSpawns: DraftSpawn[];
  enemySpawns: DraftSpawn[];
}

/** One saved map file. `serial` matches the number in the file name. */
export interface MapFile {
  serial: number;
  savedAt: number;
  draft: MapDraft;
}

export function draftToMission(d: MapDraft): Mission {
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

/** Pads a serial the way saved file names do — three digits, same convention as the
 * numbered art variants (plains001.png). */
export function serialLabel(serial: number): string {
  return String(serial).padStart(3, "0");
}

export function mapFileName(id: string, serial: number): string {
  return `${id}-${serialLabel(serial)}.json`;
}

const MAP_MODULES = import.meta.glob<MapFile>("./maps/*.json", { eager: true, import: "default" });

/** Every saved file, newest serial per scenario id. Two files for the same id (vau-001,
 * vau-002) are the same scenario twice — the higher serial is the one that plays, the
 * lower stays on disk as the rollback. */
function latestPerScenario(): Map<string, MapFile> {
  const best = new Map<string, MapFile>();
  for (const file of Object.values(MAP_MODULES)) {
    if (!file || typeof file !== "object" || !file.draft?.id) continue;
    const current = best.get(file.draft.id);
    if (!current || file.serial > current.serial) best.set(file.draft.id, file);
  }
  return best;
}

const LATEST = latestPerScenario();

/** Saved maps, as playable Missions. */
export const SAVED_MISSIONS: Mission[] = [...LATEST.values()].map((f) => draftToMission(f.draft));

/** Every saved version on disk for one scenario id, oldest serial first — what the
 * editor lists so an earlier save can be reopened. */
export function savedVersionsFor(id: string): MapFile[] {
  return Object.values(MAP_MODULES)
    .filter((f): f is MapFile => !!f && typeof f === "object" && f.draft?.id === id)
    .sort((a, b) => a.serial - b.serial);
}

export function latestSerialFor(id: string): number {
  return LATEST.get(id)?.serial ?? 0;
}

/** The campaign, with saved maps applied: a saved map whose id matches a shipped mission
 * replaces it, and one with a new id is appended as a new mission. */
export const ALL_MISSIONS: Mission[] = (() => {
  const saved = new Map(SAVED_MISSIONS.map((m) => [m.id, m]));
  const merged = MISSIONS.map((m) => saved.get(m.id) ?? m);
  const shipped = new Set(MISSIONS.map((m) => m.id));
  for (const m of SAVED_MISSIONS) if (!shipped.has(m.id)) merged.push(m);
  return merged;
})();

export function missionById(id: string): Mission | undefined {
  return ALL_MISSIONS.find((m) => m.id === id);
}

/** The world map, with saved maps hung off the locations they name. A map whose
 * scenario already belongs to a location stays there; locationId is what places a map
 * that had nowhere to appear before. */
export const ALL_LOCATIONS: WorldLocation[] = (() => {
  const extra = new Map<string, string[]>();
  for (const file of LATEST.values()) {
    const loc = file.draft.locationId;
    if (!loc) continue;
    const already = WORLD_LOCATIONS.some((l) => l.id !== loc && l.missionIds.includes(file.draft.id));
    if (already) continue;
    extra.set(loc, [...(extra.get(loc) ?? []), file.draft.id]);
  }
  return WORLD_LOCATIONS.map((l) => {
    const add = (extra.get(l.id) ?? []).filter((id) => !l.missionIds.includes(id));
    return add.length > 0 ? { ...l, missionIds: [...l.missionIds, ...add] } : l;
  });
})();

export function locationForMission(missionId: string): WorldLocation | undefined {
  return ALL_LOCATIONS.find((l) => l.missionIds.includes(missionId));
}

export function missionsForLocation(loc: WorldLocation): Mission[] {
  const live = ALL_LOCATIONS.find((l) => l.id === loc.id) ?? loc;
  return live.missionIds.map((id) => missionById(id)).filter((m): m is Mission => !!m);
}
