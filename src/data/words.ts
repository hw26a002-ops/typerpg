export interface WordPair {
  kanji: string;
  hiragana: string;
}

// 攻撃コマンド用のワードリスト（5〜8文字程度）
export const ATTACK_WORDS: WordPair[] = [
  { kanji: "烈風の刃", hiragana: "れっぷうのやいば" },
  { kanji: "氷結の槍", hiragana: "ひょうけつのやり" },
  { kanji: "灼熱の炎", hiragana: "しゃくねつのほのお" },
  { kanji: "暗黒の剣", hiragana: "あんこくのつるぎ" },
  { kanji: "迅雷の弾", hiragana: "じんらいのだん" },
  { kanji: "聖なる怒り", hiragana: "せいなるいかり" },
  { kanji: "大地の力", hiragana: "だいちのちから" },
  { kanji: "嵐の舞い", hiragana: "あらしのまい" },
  { kanji: "鋼の拳", hiragana: "はがねのこぶし" },
  { kanji: "光の矢", hiragana: "ひかりのや" },
  { kanji: "漆黒の牙", hiragana: "しっこくのきば" },
  { kanji: "祈りの歌", hiragana: "いのりのうた" },
  { kanji: "爆裂弾", hiragana: "ばくれつだん" },
  { kanji: "烈火の剣", hiragana: "れっかのつるぎ" }
];

// 強攻撃用のワードリスト
export const STRONG_ATTACK_WORDS: WordPair[] = [
  { kanji: "稲妻を纏う一撃", hiragana: "いなずまをまとういちげき" },
  { kanji: "灼熱の炎で焼き尽くす", hiragana: "しゃくねつのほのおでやきつくす" },
  { kanji: "天から降り注ぐ光", hiragana: "てんからふりそそぐひかり" },
  { kanji: "すべてを凍らせる吹雪", hiragana: "すべてをこおらせるふぶき" },
  { kanji: "だいちを揺るがす打撃", hiragana: "だいちをゆるがすだげき" },
  { kanji: "一心不乱の連撃", hiragana: "いっしんふらんのれんげき" },
  { kanji: "神秘の力を解き放つ", hiragana: "しんぴのちからをときはなつ" },
  { kanji: "真紅の刃で切り裂く", hiragana: "しんくのやいばできりさく" },
  { kanji: "すべてを打ち砕く大鎌", hiragana: "すべてをうちくだくおおかま" },
  { kanji: "聖者の怒りを喰らえ", hiragana: "せいじゃのいかりをくらえ" },
  { kanji: "暗黒の闇に包む", hiragana: "あんこくのやみにつつむ" },
  { kanji: "地獄の高熱を放つ", hiragana: "じごくのこうねつをはなつ" }
];

// 防御用のワードリスト
export const DEFEND_WORDS: WordPair[] = [
  { kanji: "鉄壁の盾を構えて敵の攻撃に備える", hiragana: "てっぺきのたてをかまえててきのこうげきにそなえる" },
  { kanji: "魔力のバリアを張って敵の攻撃を防ぐ", hiragana: "まりょくのばりあをはっててきのこうげきをふせぐ" },
  { kanji: "身体を鋼鉄のように硬くして衝撃を耐える", hiragana: "しんたいをこうてつのようにかたくしてしょうげきをたえる" },
  { kanji: "風の繭に包まれて敵の猛攻をいなす", hiragana: "かぜのまゆにつつまれててきのもうこうをいなす" },
  { kanji: "聖なるオーラを身に包み敵の技を跳ね返す", hiragana: "せいなるおーらをみにつつみてきのわざをはねかえす" },
  { kanji: "大地の恵みを受けて衝撃を受け止める", hiragana: "だいちのめぐみをうけてしょうげきをうけとめる" }
];

// 回避用のワードリスト
export const EVADE_WORDS: WordPair[] = [
  { kanji: "ひらりとかわす", hiragana: "ひらりとかわす" },
  { kanji: "神速のステップ", hiragana: "しんそくのすてっぷ" },
  { kanji: "風のように舞う", hiragana: "かぜのようにまう" },
  { kanji: "しゃがんで避ける", hiragana: "しゃがんでよける" },
  { kanji: "後ろに跳ぶ", hiragana: "うしろにとぶ" },
  { kanji: "サイドステップ", hiragana: "さいどすてっぷ" },
  { kanji: "敵の目を眩ます", hiragana: "てきのめをくらます" },
  { kanji: "しゃがんで風を待つ", hiragana: "しゃがんでかぜをまつ" }
];

// ランダムに1つ取得する
export function getRandomWord(words: WordPair[]): WordPair {
  const index = Math.floor(Math.random() * words.length);
  return words[index];
}
