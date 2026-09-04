import { unitFromSnap, snapFromUnit } from "./save";
import type { BattleEngine } from "./engine";
import type { BattleSnapshot } from "./types";

export function snapshotFromEngine(engine: BattleEngine): BattleSnapshot {
  return {
    missionId: engine.mission.id,
    turn: engine.turn,
    phase: engine.phase === "enemy" ? "player" : engine.phase,
    units: engine.units.map(snapFromUnit),
  };
}

export function applySnapshot(engine: BattleEngine, snap: BattleSnapshot): void {
  if (snap.missionId !== engine.mission.id) return;
  engine.units.splice(0, engine.units.length, ...snap.units.map(unitFromSnap));
  engine.turn = snap.turn;
  engine.phase = "player";
  engine.mode = "idle";
  engine.selectedId = null;
  engine.inspectedId = null;
  engine.pendingFoeId = null;
  engine.result = null;
  engine.banner = null;
  const first = engine.units.find((u) => u.side === "player" && u.alive);
  if (first) engine.cursor = { x: first.x, y: first.y };
}
