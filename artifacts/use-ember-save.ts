import { applySnapshot, snapshotFromEngine } from "./persist";
import { patchSave } from "./save";
import type { BattleEngine } from "./engine";
import type { BattleSnapshot, SaveData } from "./types";

export function resumeSnapshot(save: SaveData): BattleSnapshot | null {
  return save.battle ?? null;
}

export function hydrateBattle(engine: BattleEngine, snap: BattleSnapshot | null | undefined): void {
  if (!snap) return;
  applySnapshot(engine, snap);
}

export function checkpointBattle(engine: BattleEngine): SaveData {
  return patchSave({ battle: snapshotFromEngine(engine) });
}

export function finishBattleSave(): SaveData {
  return patchSave({ battle: null });
}
