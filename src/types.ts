export interface PlayerStatus {
  maxHp: number;
  hp: number;
  baseAtk: number;
  buffs: {
    concentration: number; // 集中
  };
  debuffs: {
    overwhelmed: number; // 圧倒
    weakened: number;    // 脱力
    poison: number;      // 毒
    deadlyPoison: boolean; // 猛毒
  };
  // 報酬による累積補正
  atkLimitReductionLevel: number; // 攻撃制限時間-10% の取得回数
  allLimitIncreaseLevel: number;  // 全制限時間5%増加 の取得回数
  concentrationGenLevel: number;  // 毎ターン[集中]+1 の取得回数
}

export type EnemyType = 'GOBLIN' | 'SKELETON' | 'GOLEM' | 'SPIDER' | 'SHADOW';

export interface EnemyStatus {
  type: EnemyType;
  name: string;
  maxHp: number;
  hp: number;
  baseAtk: number;
  buffs: {
    concentration: number;
  };
  // 敵のパッシブスキル説明など
  passiveName: string;
  passiveDesc: string;
}

export type ActionType = 'ATTACK' | 'STRONG_ATTACK' | 'DEFEND' | 'EVADE';

export interface BattleLog {
  id: string;
  text: string;
  type: 'system' | 'player_info' | 'player_damage' | 'enemy_info' | 'enemy_damage' | 'heal' | 'buff' | 'debuff';
}
