import { EnemyStatus, EnemyType } from '../types';

export const ENEMY_TEMPLATES: Record<Exclude<EnemyType, 'SHADOW'>, Omit<EnemyStatus, 'hp' | 'buffs'>> = {
  GOBLIN: {
    type: 'GOBLIN',
    name: 'ゴブリン戦士',
    maxHp: 70,
    baseAtk: 5,
    passiveName: '戦闘感覚',
    passiveDesc: '4ターン経過ごとに[集中]10を得る。',
  },
  SKELETON: {
    type: 'SKELETON',
    name: 'ガイコツ魔術師',
    maxHp: 50,
    baseAtk: 10,
    passiveName: '魔法熟練',
    passiveDesc: 'プレイヤーから受ける強攻撃ダメージを25%軽減。防御によるダメージ軽減を無効化。',
  },
  GOLEM: {
    type: 'GOLEM',
    name: 'ゴーレム',
    maxHp: 100,
    baseAtk: 25,
    passiveName: '巨体/瞬発力',
    passiveDesc: '2ターンに1回行動。防御軽減率を文字数×4%に変更。攻撃的中時30%で[圧倒]3または[脱力]3を付与。回避入力時間-2秒。',
  },
  SPIDER: {
    type: 'SPIDER',
    name: 'スパイダー',
    maxHp: 30,
    baseAtk: 5,
    passiveName: '小柄/猛毒',
    passiveDesc: 'プレイヤーに攻撃的中時、50%の確率で[毒]3を付与（既に猛毒状態なら付与しない）。',
  },
};

export function generateEnemy(floor: number, playerBaseAtk: number): EnemyStatus {
  if (floor === 10) {
    // 10層は影の決闘者
    return {
      type: 'SHADOW',
      name: '影の決闘者',
      maxHp: 200,
      hp: 200,
      baseAtk: playerBaseAtk, // 戦闘開始時のプレイヤーの基本攻撃威力と同じ
      buffs: {
        concentration: 0,
      },
      passiveName: '決闘者',
      passiveDesc: '10層にのみ出現。現在のターン数だけ基本攻撃威力が増加する。',
    };
  }

  // 1〜9層はランダムに選択
  const types: Exclude<EnemyType, 'SHADOW'>[] = ['GOBLIN', 'SKELETON', 'GOLEM', 'SPIDER'];
  
  // 初心者向けに、1層はHPや攻撃威力が低めのスパイダーやゴブリンが出やすいなど、
  // あるいは完全ランダムにする。
  const randomType = types[Math.floor(Math.random() * types.length)];
  const template = ENEMY_TEMPLATES[randomType];

  return {
    ...template,
    hp: template.maxHp,
    buffs: {
      concentration: 0,
    },
  };
}
