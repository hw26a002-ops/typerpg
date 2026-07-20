// ひらがな・記号からローマ字候補への変換マップ
export const SYLLABLE_MAP: Record<string, string[]> = {
  "あ": ["a"], "い": ["i", "yi"], "う": ["u", "wu"], "え": ["e"], "お": ["o"],
  "か": ["ka", "ca"], "き": ["ki"], "く": ["ku", "cu", "qu"], "け": ["ke"], "こ": ["ko", "co"],
  "さ": ["sa"], "し": ["si", "shi", "ci"], "す": ["su"], "せ": ["se"], "そ": ["so"],
  "た": ["ta"], "ち": ["ti", "chi"], "つ": ["tu", "tsu"], "て": ["te"], "と": ["to"],
  "な": ["na"], "に": ["ni"], "ぬ": ["nu"], "ね": ["ne"], "の": ["no"],
  "は": ["ha"], "ひ": ["hi"], "ふ": ["hu", "fu"], "へ": ["he"], "ほ": ["ho"],
  "ま": ["ma"], "み": ["mi"], "む": ["mu"], "め": ["me"], "も": ["mo"],
  "や": ["ya"], "ゆ": ["yu"], "よ": ["yo"],
  "ら": ["ra"], "り": ["ri"], "る": ["ru"], "れ": ["re"], "ろ": ["ro"],
  "わ": ["wa"], "を": ["wo", "o"], "ん": ["nn", "n"],
  "が": ["ga"], "ぎ": ["gi"], "ぐ": ["gu"], "げ": ["ge"], "ご": ["go"],
  "ざ": ["za"], "じ": ["zi", "ji"], "ず": ["zu", "du"], "ぜ": ["ze"], "ぞ": ["zo"],
  "だ": ["da"], "ぢ": ["di"], "づ": ["du"], "で": ["de"], "ど": ["do"],
  "ば": ["ba"], "び": ["bi"], "ぶ": ["bu"], "べ": ["be"], "ぼ": ["bo"],
  "ぱ": ["pa"], "ぴ": ["pi"], "ぷ": ["pu"], "ぺ": ["pe"], "ぽ": ["po"],
  "ー": ["-"], "、": [","], "。": ["."], " ": [" "],
  "ぁ": ["la", "xa"], "ぃ": ["li", "xi"], "ぅ": ["lu", "xu"], "ぇ": ["le", "xe"], "ぉ": ["lo", "xo"],
  "ゃ": ["lya", "xya"], "ゅ": ["lyu", "xyu"], "ょ": ["lyo", "xyo"],
  "っ": ["ltu", "xtu", "ltsu"],
  
  // 2文字音節（拗音、外来語など）
  "きゃ": ["kya"], "きゅ": ["kyu"], "きょ": ["kyo"],
  "しゃ": ["sya", "sha"], "しゅ": ["syu", "shu"], "しょ": ["syo", "sho"],
  "ちゃ": ["tya", "cha"], "ちゅ": ["tyu", "chu"], "ちょ": ["tyo", "cho"],
  "にゃ": ["nya"], "にゅ": ["nyu"], "にょ": ["nyo"],
  "ひゃ": ["hya"], "ひゅ": ["hyu"], "ひょ": ["hyo"],
  "みゃ": ["mya"], "みゅ": ["myu"], "みょ": ["myo"],
  "りゃ": ["rya"], "りゅ": ["ryu"], "りょ": ["ryo"],
  "ぎゃ": ["gya"], "ぎゅ": ["gyu"], "ぎょ": ["gyo"],
  "じゃ": ["zya", "ja"], "じゅ": ["zyu", "ju"], "じょ": ["zyo", "jo"],
  "びゃ": ["bya"], "びゅ": ["byu"], "びょ": ["byo"],
  "ぴゃ": ["pya"], "ぴゅ": ["pyu"], "ぴょ": ["pyo"],
  "てぃ": ["ti", "texi", "telyi"],
  "でぃ": ["di", "dexi", "delyi"],
  "ふぁ": ["fa", "fua"], "ふぃ": ["fi", "fui"], "ふぇ": ["fe", "fue"], "ふぉ": ["fo", "fuo"],
  "うぃ": ["wi", "uilyi"], "うぇ": ["we", "uilye"], "うぉ": ["wo", "uilyo"],
  "ゔぁ": ["va"], "ゔぃ": ["vi"], "ゔ": ["vu"], "ゔぇ": ["ve"], "ゔぉ": ["vo"]
};

// 音節の最初の子音（群）を取得する
export function getFirstConsonants(hiragana: string): string[] {
  if (hiragana === "") return [""];
  const doubleChar = hiragana.substring(0, 2);
  const singleChar = hiragana.substring(0, 1);

  const getConsonantsForSyllable = (text: string): string[] => {
    const options = SYLLABLE_MAP[text];
    if (!options) return [""];
    return options.map(opt => {
      if (["a", "i", "u", "e", "o"].includes(opt[0])) {
        return "";
      }
      const match = opt.match(/^[^aiueo]+/);
      return match ? match[0] : "";
    }).filter(Boolean);
  };

  if (hiragana.length >= 2 && SYLLABLE_MAP[doubleChar]) {
    const res = getConsonantsForSyllable(doubleChar);
    if (res.length > 0) return res;
  }
  return getConsonantsForSyllable(singleChar);
}

// 現在の入力文字列 input が、ひらがな hiragana のローマ字表記の前半部分（prefix）として正しいかを判定する
export function isValidPrefix(hiragana: string, input: string): boolean {
  if (input === "") return true;
  if (hiragana === "") return false;

  const doubleChar = hiragana.substring(0, 2);
  const singleChar = hiragana.substring(0, 1);

  // 「っ」の処理
  if (singleChar === "っ") {
    // 1. 単体入力
    const ltuOptions = ["ltu", "xtu", "ltsu"];
    for (const opt of ltuOptions) {
      if (opt.startsWith(input)) return true;
      if (input.startsWith(opt)) {
        if (isValidPrefix(hiragana.substring(1), input.substring(opt.length))) return true;
      }
    }
    // 2. 子音重ね
    if (hiragana.length > 1) {
      const nextHiragana = hiragana.substring(1);
      const nextCons = getFirstConsonants(nextHiragana);
      for (const cons of nextCons) {
        if (cons !== "") {
          if (cons.startsWith(input)) return true;
          if (input.startsWith(cons)) {
            if (isValidPrefix(nextHiragana, input.substring(cons.length))) return true;
          }
        }
      }
    }
  }

  // 「ん」の処理
  if (singleChar === "ん") {
    if ("n".startsWith(input) || "nn".startsWith(input)) return true;
    if (input.startsWith("nn")) {
      if (isValidPrefix(hiragana.substring(1), input.substring(2))) return true;
    }
    if (input.startsWith("n")) {
      if (hiragana.length > 1) {
        const nextHiragana = hiragana.substring(1);
        const nextCons = getFirstConsonants(nextHiragana);
        const hasVowelOrYorN = nextCons.some(c => c === "" || c === "y" || c === "n" || ["a","i","u","e","o"].includes(c[0]));
        if (!hasVowelOrYorN) {
          if (isValidPrefix(nextHiragana, input.substring(1))) return true;
        }
      } else {
        return true; // 文末の 'n' も許容
      }
    }
  }

  // 一般的な音節
  const checkSyllable = (text: string, remaining: string): boolean => {
    const options = SYLLABLE_MAP[text];
    if (!options) return false;
    for (const opt of options) {
      if (opt.startsWith(input)) return true;
      if (input.startsWith(opt)) {
        if (isValidPrefix(remaining, input.substring(opt.length))) return true;
      }
    }
    return false;
  };

  if (hiragana.length >= 2 && SYLLABLE_MAP[doubleChar]) {
    if (checkSyllable(doubleChar, hiragana.substring(2))) return true;
  }
  if (SYLLABLE_MAP[singleChar]) {
    if (checkSyllable(singleChar, hiragana.substring(1))) return true;
  }

  return false;
}

// 完全一致（入力完了）を判定する
export function isCompleteMatch(hiragana: string, input: string): boolean {
  if (hiragana === "" && input === "") return true;
  if (hiragana === "" || input === "") return false;

  const doubleChar = hiragana.substring(0, 2);
  const singleChar = hiragana.substring(0, 1);

  // 「っ」の処理
  if (singleChar === "っ") {
    // 1. 単体
    const ltuOptions = ["ltu", "xtu", "ltsu"];
    for (const opt of ltuOptions) {
      if (input.startsWith(opt)) {
        if (isCompleteMatch(hiragana.substring(1), input.substring(opt.length))) return true;
      }
    }
    // 2. 子音重ね
    if (hiragana.length > 1) {
      const nextHiragana = hiragana.substring(1);
      const nextCons = getFirstConsonants(nextHiragana);
      for (const cons of nextCons) {
        if (cons !== "" && input.startsWith(cons)) {
          if (isCompleteMatch(nextHiragana, input.substring(cons.length))) return true;
        }
      }
    }
  }

  // 「ん」の処理
  if (singleChar === "ん") {
    if (input === "n" || input === "nn") {
      return hiragana.length === 1;
    }
    if (input.startsWith("nn")) {
      if (isCompleteMatch(hiragana.substring(1), input.substring(2))) return true;
    }
    if (input.startsWith("n")) {
      if (hiragana.length > 1) {
        const nextHiragana = hiragana.substring(1);
        const nextCons = getFirstConsonants(nextHiragana);
        const hasVowelOrYorN = nextCons.some(c => c === "" || c === "y" || c === "n" || ["a","i","u","e","o"].includes(c[0]));
        if (!hasVowelOrYorN) {
          if (isCompleteMatch(nextHiragana, input.substring(1))) return true;
        }
      }
    }
  }

  // 一般的な音節
  const checkSyllable = (text: string, remaining: string): boolean => {
    const options = SYLLABLE_MAP[text];
    if (!options) return false;
    for (const opt of options) {
      if (input.startsWith(opt)) {
        if (isCompleteMatch(remaining, input.substring(opt.length))) return true;
      }
    }
    return false;
  };

  if (hiragana.length >= 2 && SYLLABLE_MAP[doubleChar]) {
    if (checkSyllable(doubleChar, hiragana.substring(2))) return true;
  }
  if (SYLLABLE_MAP[singleChar]) {
    if (checkSyllable(singleChar, hiragana.substring(1))) return true;
  }

  return false;
}

// 現在の入力 input に足して正しい prefix になる次の1キー候補を取得する
export function getNextValidKeys(hiragana: string, input: string): string[] {
  const validKeys: string[] = [];
  const chars = "abcdefghijklmnopqrstuvwxyz-".split("");
  for (const char of chars) {
    if (isValidPrefix(hiragana, input + char)) {
      validKeys.push(char);
    }
  }
  return validKeys;
}

// プレイヤーが入力したローマ字 input に対応する、入力済みのひらがな文字数を精度高く算出する
export function getCompletedHiraganaLength(hiragana: string, input: string): number {
  if (!input) return 0;
  
  let maxI = 0; // 完全に一致したひらがなの文字数
  let matchedJ = 0; // その時のローマ字のインデックス
  
  // ひらがなのプレフィックス i と、入力ローマ字のプレフィックス j のすべての組み合わせをチェック
  for (let i = 1; i <= hiragana.length; i++) {
    const part = hiragana.substring(0, i);
    for (let j = 1; j <= input.length; j++) {
      const subInput = input.substring(0, j);
      if (isCompleteMatch(part, subInput)) {
        if (i > maxI) {
          maxI = i;
          matchedJ = j;
        }
      }
    }
  }
  
  // 余った入力があるかチェック（現在入力中の文字があるか）
  if (matchedJ < input.length) {
    const remainingInput = input.substring(matchedJ);
    const nextChar = hiragana.substring(maxI, maxI + 1);
    if (nextChar && isValidPrefix(nextChar, remainingInput)) {
      return maxI + 0.5; // 入力途中の文字は 0.5 文字分としてカウント
    }
  }
  
  return maxI;
}

