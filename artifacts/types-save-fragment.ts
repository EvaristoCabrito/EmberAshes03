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
