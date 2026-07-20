import { EnemyStatus, EnemyType } from '../types';

export const ENEMY_TEMPLATES: Record<Exclude<EnemyType, 'SHADOW'>, Omit<EnemyStatus, 'hp' | 'buffs' | 'ironShell'>> = {
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
  ROBOT: {
    type: 'ROBOT',
    name: 'ロボット兵士',
    maxHp: 100,
    baseAtk: 10, // 戦術変更により、HP50%以上時は戦闘開始時に -5 されて 5 になる
    passiveName: '戦術変更',
    passiveDesc: '戦闘開始時、鋼鉄外殻7を得る。HP50%以上で基本攻撃力-5、鋼鉄外殻が減少せず維持（ターン終了時。被ダメージ時は減少）。HP50%未満で基本攻撃力+5、自分の鋼鉄外殻を除去し必ず先制攻撃。',
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
      ironShell: 0,
      passiveName: '決闘者',
      passiveDesc: '10層にのみ出現。現在のターン数だけ基本攻撃威力が増加する。',
    };
  }

  if (floor === 5) {
    // 5層はロボット兵士固定
    const template = ENEMY_TEMPLATES.ROBOT;
    // 戦闘開始時に鋼鉄外殻7を得る。
    // また「体力が50%以上なら、基本攻撃威力-5」が適用される。
    // 初期HPは100%（50%以上）なので、初期 baseAtk は 10 - 5 = 5 になる。
    return {
      ...template,
      hp: template.maxHp,
      baseAtk: template.baseAtk - 5, // HP50%以上なので基本攻撃威力-5
      buffs: {
        concentration: 0,
      },
      ironShell: 7, // 戦闘開始時、鋼鉄外殻7
    };
  }

  // 1〜9層（5層除く）はランダムに選択。ROBOT と SHADOW は除外。
  const types: Exclude<EnemyType, 'SHADOW' | 'ROBOT'>[] = ['GOBLIN', 'SKELETON', 'GOLEM', 'SPIDER'];
  
  const randomType = types[Math.floor(Math.random() * types.length)];
  const template = ENEMY_TEMPLATES[randomType];

  return {
    ...template,
    hp: template.maxHp,
    buffs: {
      concentration: 0,
    },
    ironShell: 0,
  };
}
