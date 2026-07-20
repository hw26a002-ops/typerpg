import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Sparkles, Heart, RefreshCw, AlertTriangle, Flame, ShieldAlert } from 'lucide-react';
import { PlayerStatus, EnemyStatus, ActionType, BattleLog, EnemyType } from '../types';
import { generateEnemy } from '../data/enemies';
import { getRandomWord, ATTACK_WORDS, STRONG_ATTACK_WORDS, DEFEND_WORDS, EVADE_WORDS, WordPair } from '../data/words';
import { isValidPrefix, isCompleteMatch, getNextValidKeys, getCompletedHiraganaLength } from '../utils/typing';

interface BattleScreenProps {
  floor: number;
  player: PlayerStatus;
  setPlayer: Dispatch<SetStateAction<PlayerStatus>>;
  onWin: () => void;
  onLose: () => void;
}

export default function BattleScreen({ floor, player, setPlayer, onWin, onLose }: BattleScreenProps) {
  const [enemy, setEnemy] = useState<EnemyStatus>(() => generateEnemy(floor, player.baseAtk));
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [turn, setTurn] = useState<number>(1);
  const [phase, setPhase] = useState<'START' | 'SELECT_ACTION' | 'TYPING_ACTION' | 'ENEMY_TURN' | 'TURN_END'>('START');
  
  // タイピング関連ステート
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [menuInput, setMenuInput] = useState<string>('');
  const [targetHiragana, setTargetHiragana] = useState<string>('');
  const [targetKanji, setTargetKanji] = useState<string>('');
  const [typedInput, setTypedInput] = useState<string>('');
  const typedInputRef = useRef<string>('');

  const setTypedInputAndRef = (input: string) => {
    setTypedInput(input);
    typedInputRef.current = input;
  };

  const [isFailed, setIsFailed] = useState<boolean>(false); // 強攻撃・回避用の即失敗フラグ
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [typedCharactersCount, setTypedCharactersCount] = useState<number>(0); // 防御などの入力文字数カウント
  const typedCharactersCountRef = useRef<number>(0);
  const loggedTurnRef = useRef<number>(0);

  const setCharactersCount = (count: number) => {
    setTypedCharactersCount(count);
    typedCharactersCountRef.current = count;
  };

  const [isTimeExceeded, setIsTimeExceeded] = useState<boolean>(false);
  const isTimeExceededRef = useRef<boolean>(false);

  const setIsTimeExceededAndRef = (val: boolean) => {
    setIsTimeExceeded(val);
    isTimeExceededRef.current = val;
  };

  // タイマー関連
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [totalAllowedTime, setTotalAllowedTime] = useState<number>(0);

  // ターン履歴
  const [enemyPreemptedThisTurn, setEnemyPreemptedThisTurn] = useState<boolean>(false);
  const [golemActionReady, setGolemActionReady] = useState<boolean>(true); // ゴーレムの行動可能フラグ
  const [playerUsedActionThisTurn, setPlayerUsedActionThisTurn] = useState<boolean>(false); // 毒判定用
  const [showDefinitions, setShowDefinitions] = useState<boolean>(false); // ステータス効果解説の開閉用

  // パッシブスキル関連一時ステート
  const [foreseeCharge, setForeseeCharge] = useState<number>(0);
  const [isForeseeEvading, setIsForeseeEvading] = useState<boolean>(false);
  const [foreseeEvadeSuccess, setForeseeEvadeSuccess] = useState<boolean | null>(null);
  const [duelCriticalActive, setDuelCriticalActive] = useState<boolean>(false);
  const [killerDamageReserve, setKillerDamageReserve] = useState<boolean>(false);
  const [killerTargetInput, setKillerTargetInput] = useState<string>('');

  const logContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ログ追加ユーティリティ
  const addLog = (text: string, type: BattleLog['type'] = 'system') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), text, type }]);
  };

  // ログが追加されたらスクロール
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // ロボット兵士の戦術変更パッシブ監視
  useEffect(() => {
    if (enemy.type === 'ROBOT') {
      const isBelow50 = enemy.hp < (enemy.maxHp * 0.5);
      
      if (isBelow50) {
        // HP50%未満
        if (enemy.baseAtk !== 15 || enemy.ironShell > 0) {
          setEnemy(prev => ({
            ...prev,
            baseAtk: 15,
            ironShell: 0,
          }));
          addLog(`ロボット兵士の【戦術変更】発動！ 鋼鉄外殻をパージし、基本攻撃威力が 15 に上昇！ さらに先制行動を開始！`, 'enemy_info');
        }
      } else {
        // HP50%以上
        if (enemy.baseAtk !== 5) {
          setEnemy(prev => ({
            ...prev,
            baseAtk: 5,
          }));
          addLog(`ロボット兵士の【戦術変更】維持：基本攻撃威力 5。鋼鉄外殻が維持されている。`, 'enemy_info');
        }
      }
    }
  }, [enemy.hp]);

  // 全制限時間の計算ユーティリティ
  const calculateAllowedTime = (baseTime: number, isAttack: boolean = false): number => {
    // 全制限時間増加（+15% × レベル）
    let time = baseTime * (1 + 0.15 * player.allLimitIncreaseLevel);
    // 攻撃コマンド制限時間減少（-10% × レベル）
    if (isAttack) {
      time = time * (1 - 0.1 * player.atkLimitReductionLevel);
    }
    // 圧倒デバフ（制限時間 -25%）
    if (player.debuffs.overwhelmed > 0) {
      time = time * 0.75;
    }
    return Math.max(time, 1.0); // 最低1秒
  };

  // ==========================================
  // 戦闘ライフサイクル制御
  // ==========================================

  // 戦闘開始 & ターン開始時
  useEffect(() => {
    if (phase === 'START') {
      if (loggedTurnRef.current === turn) return;
      loggedTurnRef.current = turn;

      // ターン開始時にパッシブの一時フラグをリセット
      setForeseeEvadeSuccess(null);
      setIsForeseeEvading(false);

      // 戦闘開始時（1ターン目）のみパッシブの初期チャージなどを設定
      if (turn === 1) {
        if (player.passive === 'FORESEE') {
          setForeseeCharge(5);
          addLog(`パッシブ【予知】発動：戦闘開始時に「未来予知」 5 を得た！`, 'buff');
        } else {
          setForeseeCharge(0);
        }
        setKillerDamageReserve(false);
        setDuelCriticalActive(false);
      }

      addLog(`▼ ターン ${turn} が開始された！`, 'system');

      // 1. プレイヤーの [集中] 毎ターン自動獲得 (報酬ボーナス)
      if (player.concentrationGenLevel > 0) {
        setTimeout(() => {
          setPlayer(prev => ({
            ...prev,
            buffs: {
              ...prev.buffs,
              concentration: prev.buffs.concentration + player.concentrationGenLevel
            }
          }));
        }, 0);
        addLog(`ルーンの加護：[集中] を ${player.concentrationGenLevel} 得た。`, 'buff');
      }

      // 2. 敵のターン開始時パッシブ
      if (enemy.type === 'GOBLIN') {
        // 4ターン経過ごとに [集中] 10
        if (turn % 4 === 0) {
          setEnemy(prev => ({
            ...prev,
            buffs: {
              ...prev.buffs,
              concentration: prev.buffs.concentration + 10
            }
          }));
          addLog(`${enemy.name}は戦場に順応している...！ [集中] 10 を得た。`, 'buff');
        }
      }

      if (enemy.type === 'SHADOW') {
        // 決闘者: ターン数だけ攻撃威力増加
        const newAtk = player.baseAtk + turn;
        setEnemy(prev => ({
          ...prev,
          baseAtk: newAtk
        }));
        addLog(`${enemy.name}の決闘者魂が燃え上がる！ 基本攻撃威力が ${newAtk} に上昇！`, 'buff');
      }

      if (enemy.type === 'GOLEM') {
        // ゴーレムは2ターンに1回しか行動しない
        const isReady = turn % 2 !== 0; // 1, 3, 5, 7, 9... ターンに行動
        setGolemActionReady(isReady);
        if (!isReady) {
          addLog(`${enemy.name}は体を休めている。このターンは攻撃してこない！`, 'enemy_info');
        }
      }

      // 毒判定等のリセット
      setPlayerUsedActionThisTurn(false);

      // 行動選択フェーズへ移行
      setTimeout(() => {
        setSelectedAction(null);
        // ロボット兵士の先制攻撃判定
        if (enemy.type === 'ROBOT' && enemy.hp < (enemy.maxHp * 0.5) && !enemyPreemptedThisTurn) {
          addLog(`ロボット兵士の【先制行動】！ プレイヤーの行動より先に攻撃を仕掛けてきた！`, 'enemy_info');
          setEnemyPreemptedThisTurn(true);
          setPhase('ENEMY_TURN');
        } else {
          setPhase('SELECT_ACTION');
          setMenuInput('');
          
          const limit = calculateAllowedTime(15);
          setTimeLeft(limit);
          setTotalAllowedTime(limit);
        }
      }, 800);
    }
  }, [phase, turn]);

  // タイマーループ
  useEffect(() => {
    if (phase === 'TYPING_ACTION') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            clearInterval(timerRef.current!);
            if (selectedAction === 'ATTACK') {
              setIsTimeExceededAndRef(true);
              return 0;
            } else {
              // タイムオーバー
              handleTimeOver();
              return 0;
            }
          }
          return prev - 0.1;
        });
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, selectedAction]);

  // タイムオーバー処理
  const handleTimeOver = () => {
    addLog("制限時間切れ！ 行動に失敗した。", "player_damage");
    if (phase === 'TYPING_ACTION') {
      if (isForeseeEvading) {
        addLog(`予知による回避に失敗！ 敵の攻撃を避けられなかった！`, 'player_damage');
        setForeseeEvadeSuccess(false);
        setIsForeseeEvading(false);
        setTimeout(() => {
          setPhase('ENEMY_TURN');
        }, 600);
        return;
      }
      // 防御中であれば、そこまで入力した文字数で部分判定
      if (selectedAction === 'DEFEND') {
        const lettersCount = getCompletedHiraganaLength(targetHiragana, typedInputRef.current);
        setCharactersCount(lettersCount);
        const displayedCount = Math.round(lettersCount * 10) / 10;
        addLog(`なんとか ${displayedCount} 文字を盾にし、防御の構えをとった！`, "player_info");
      } else {
        setIsFailed(true);
      }
    } else {
      setIsFailed(true);
    }
    
    if (enemy.type === 'ROBOT' && enemyPreemptedThisTurn) {
      setPhase('TURN_END');
    } else {
      setPhase('ENEMY_TURN');
    }
  };

  // ==========================================
  // キー入力・タイピング処理
  // ==========================================

  // メニュー選択肢のひらがな定義
  const MENU_OPTIONS = {
    ATTACK: 'こうげき',
    STRONG_ATTACK: 'きょうこうげき',
    DEFEND: 'ぼうぎょ',
    EVADE: 'かいひ',
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      
      // a-z と - のみ受け付ける
      if (!/^[a-z-]$/.test(key)) return;

      if (phase === 'SELECT_ACTION') {
        // メニュータイピングの判定
        const nextInput = menuInput + key;
        
        // いずれかのコマンドの Prefix になっているかチェック
        const matchedActions = Object.entries(MENU_OPTIONS).filter(([_, hiragana]) => 
          isValidPrefix(hiragana, nextInput)
        );

        if (matchedActions.length > 0) {
          setMenuInput(nextInput);

          // 完全一致をチェック
          const completedAction = matchedActions.find(([_, hiragana]) => 
            isCompleteMatch(hiragana, nextInput)
          );

          if (completedAction) {
            const action = completedAction[0] as ActionType;
            startAction(action);
          }
        } else {
          // ミス
          setMistakeCount(prev => prev + 1);
        }
      } 
      
      else if (phase === 'TYPING_ACTION') {
        if (isFailed) return;

        const nextInput = typedInput + key;

        if (isValidPrefix(targetHiragana, nextInput)) {
          setTypedInputAndRef(nextInput);

          // タイピング成功した時点での正確なひらがな文字数をリアルタイムに更新
          const currentCount = getCompletedHiraganaLength(targetHiragana, nextInput);
          setCharactersCount(currentCount);

          // 完全一致したか
          if (isCompleteMatch(targetHiragana, nextInput)) {
            // タイピング成功！
            if (isForeseeEvading) {
              addLog(`予知による回避に成功！ 敵の攻撃を完全に受け流した！`, 'player_info');
              setForeseeEvadeSuccess(true);
              setIsForeseeEvading(false);
              setTimeout(() => {
                setPhase('ENEMY_TURN');
              }, 600);
            } else if (selectedAction === 'DEFEND') {
              // 防御の場合はすべて打ち終えても追加ダメージ軽減などは特になく、
              // 文字数カウントの都合上、最後まで打ち終わったら自動で敵のターンへ進む
              setCharactersCount(targetHiragana.length);
              addLog(`完璧な防御！ ${targetHiragana.length}文字による強固な盾を展開した！`, 'player_info');
              setTimeout(() => {
                if (enemy.type === 'ROBOT' && enemyPreemptedThisTurn) {
                  setPhase('TURN_END');
                } else {
                  setPhase('ENEMY_TURN');
                }
              }, 600);
            } else {
              executePlayerAction(nextInput);
            }
          }
        } else {
          // タイピングミス
          setMistakeCount(prev => prev + 1);
          
          // 強攻撃または回避の場合は1文字でもミスすると即座に失敗
          if (selectedAction === 'STRONG_ATTACK' || selectedAction === 'EVADE') {
            setIsFailed(true);
            if (isForeseeEvading) {
              addLog(`タイピングミス！ 予知による回避に失敗した。`, 'player_damage');
              setForeseeEvadeSuccess(false);
              setIsForeseeEvading(false);
              setTimeout(() => {
                setPhase('ENEMY_TURN');
              }, 1000);
            } else {
              addLog(`タイピングミス！ ${selectedAction === 'STRONG_ATTACK' ? '強攻撃' : '回避'}に失敗した。`, 'player_damage');
              setTimeout(() => {
                if (enemy.type === 'ROBOT' && enemyPreemptedThisTurn) {
                  setPhase('TURN_END');
                } else {
                  setPhase('ENEMY_TURN');
                }
              }, 1000);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, menuInput, typedInput, targetHiragana, selectedAction, isFailed]);

  // アクションお題タイピングの開始
  const startAction = (action: ActionType) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    setSelectedAction(action);
    setTypedInputAndRef('');
    setMistakeCount(0);
    setIsFailed(false);
    setCharactersCount(0);
    setIsTimeExceededAndRef(false);

    let wordPair: WordPair = { kanji: '', hiragana: '' };
    let baseTime = 15;

    switch (action) {
      case 'ATTACK':
        wordPair = getRandomWord(ATTACK_WORDS);
        baseTime = 5;
        break;
      case 'STRONG_ATTACK':
        wordPair = getRandomWord(STRONG_ATTACK_WORDS);
        baseTime = 7;
        break;
      case 'DEFEND':
        wordPair = getRandomWord(DEFEND_WORDS);
        baseTime = 15;
        break;
      case 'EVADE':
        wordPair = getRandomWord(EVADE_WORDS);
        baseTime = 5;
        // ゴーレムパッシブ: 回避入力時間を -2秒
        if (enemy.type === 'GOLEM') {
          baseTime = Math.max(baseTime - 2, 1.0);
        }
        break;
    }

    setTargetHiragana(wordPair.hiragana);
    setTargetKanji(wordPair.kanji);
    
    // 制限時間算出
    const limit = calculateAllowedTime(baseTime, action === 'ATTACK');
    setTimeLeft(limit);
    setTotalAllowedTime(limit);
    
    setPhase('TYPING_ACTION');
  };

  // プレイヤーのアクション実行 (攻撃・強攻撃)
  const executePlayerAction = (finalInput: string) => {
    if (timerRef.current) clearInterval(timerRef.current);

    setPlayerUsedActionThisTurn(true);

    if (player.passive === 'KILLER' && selectedAction === 'STRONG_ATTACK') {
      addLog(`「${targetHiragana}」のノーミスタイピングに成功！ パッシブ【殺手】発動：敵の攻撃の後に肉斬骨断の一撃を放ちます！`, 'player_info');
      setKillerDamageReserve(true);
      setKillerTargetInput(finalInput);
      setTimeout(() => {
        setPhase('ENEMY_TURN');
      }, 1000);
      return;
    }

    if (selectedAction === 'EVADE') {
      addLog(`「${targetHiragana}」のノーミスタイピングに成功！ 回避体勢をとった！`, 'player_info');
      setTimeout(() => {
        setPhase('ENEMY_TURN');
      }, 1000);
      return;
    }

    let rawDamage = 0;
    let text = '';
    let isMagic = false;

    if (selectedAction === 'ATTACK') {
      const baseAtkContribution = Math.max(0, targetHiragana.length - mistakeCount);
      const totalBasePower = baseAtkContribution + player.baseAtk;
      if (isTimeExceededRef.current) {
        rawDamage = Math.floor(totalBasePower / 2);
        text = `「${targetHiragana}」のタイピングに成功（時間超過・威力半減）！ ${enemy.name}に攻撃を仕掛けた！`;
      } else {
        rawDamage = totalBasePower;
        text = `「${targetHiragana}」のタイピングに成功！ ${enemy.name}に攻撃を仕掛けた！`;
      }
    } else if (selectedAction === 'STRONG_ATTACK') {
      rawDamage = Math.floor((targetHiragana.length + player.baseAtk) * 1.5);
      text = `「${targetHiragana}」のノーミスタイピングに成功！ 強力な攻撃！`;
      isMagic = true;
    }

    addLog(text, 'player_info');

    // 1. ガイコツ魔術師パッシブ: 魔法ダメージを25%軽減
    if (isMagic && enemy.type === 'SKELETON') {
      rawDamage = Math.floor(rawDamage * 0.75);
      addLog(`ガイコツ魔術師の【魔法熟練】：強攻撃ダメージが25%軽減される！`, 'enemy_info');
    }

    // 2. 集中バフ判定: [集中]数値×10%の確率で、攻撃的中時に与ダメージ
    let finalDamage = rawDamage;
    if (player.buffs.concentration > 0) {
      const chance = player.buffs.concentration * 10;
      const isTriggered = Math.random() * 100 < chance;
      
      if (isTriggered) {
        const mult = duelCriticalActive ? 2.0 : 1.5;
        finalDamage = Math.floor(finalDamage * mult);
        addLog(`[集中]の効果が発動！ 与えるダメージが ${mult}倍（${finalDamage}）になった！`, 'buff');
        
        // 集中を半減（小数点切り捨て、0未満なら消滅＝0以下は消滅）
        setPlayer(prev => {
          const nextConc = Math.floor(prev.buffs.concentration / 2);
          return {
            ...prev,
            buffs: {
              ...prev.buffs,
              concentration: nextConc
            }
          };
        });

        if (duelCriticalActive) {
          setDuelCriticalActive(false);
        }
      }
    }

    // 3. 脱力デバフ判定: 敵に与える与ダメージが30%減少
    if (player.debuffs.weakened > 0) {
      finalDamage = Math.floor(finalDamage * 0.7);
      addLog(`[脱力]の影響で与ダメージが30%減少した（${finalDamage}ダメージ）。`, 'debuff');
    }

    // ROBOTパッシブ: 鋼鉄外殻
    let nextIronShell = enemy.ironShell;
    if (enemy.type === 'ROBOT' && enemy.ironShell > 0) {
      const reductionPercent = enemy.ironShell * 10; // 1につき10%
      const reducedDamage = Math.floor(finalDamage * (1 - reductionPercent / 100));
      addLog(`ロボット兵士の【鋼鉄外殻】：ダメージを ${reductionPercent}% 軽減（-${finalDamage - reducedDamage}）した！`, 'enemy_info');
      finalDamage = reducedDamage;

      // 被ダメージ時にスタックが1減少
      nextIronShell = Math.max(enemy.ironShell - 1, 0);
      addLog(`被ダメージによりロボット兵士の鋼鉄外殻が 1 減少した（残り: ${nextIronShell}）。`, 'enemy_info');
    }

    // ダメージ適用
    setEnemy(prev => {
      const nextHp = Math.max(prev.hp - finalDamage, 0);
      return { 
        ...prev, 
        hp: nextHp,
        ironShell: prev.type === 'ROBOT' ? nextIronShell : prev.ironShell
      };
    });

    addLog(`${enemy.name}に ${finalDamage} のダメージを与えた！`, 'enemy_damage');

    // 次のフェーズへ進む
    setTimeout(() => {
      if (enemy.type === 'ROBOT' && enemyPreemptedThisTurn) {
        // 先制攻撃をすでに受けているので、直接ターン終了へ
        setPhase('TURN_END');
      } else {
        setPhase('ENEMY_TURN');
      }
    }, 1000);
  };

  // ==========================================
  // 【殺手】カウンター攻撃の実行
  // ==========================================
  const executeKillerCounter = (receivedDmg: number) => {
    // 威力計算：強攻撃本来の威力 (お題のひらがな文字数＋プレイヤーの基本攻撃力) * 1.5
    let rawDamage = Math.floor((targetHiragana.length + player.baseAtk) * 1.5);
    
    // 殺手効果：受けたダメージの1.5倍を攻撃威力に加算
    const addition = Math.floor(receivedDmg * 1.5);
    const totalPower = rawDamage + addition;
    
    addLog(`【殺手】カウンター発動！ 被弾ダメージの1.5倍（+${addition} 威力）を強攻撃に上乗せ！`, 'buff');
    
    let finalDamage = totalPower;
    
    // ガイコツ魔術師パッシブ
    if (enemy.type === 'SKELETON') {
      finalDamage = Math.floor(finalDamage * 0.75);
      addLog(`ガイコツ魔術師の【魔法熟練】：強攻撃ダメージが25%軽減される！`, 'enemy_info');
    }
    
    // 集中バフ判定: [集中]数値×10%の確率で、カウンター時に与ダメージが1.5倍 (決闘宣布なら2倍)
    if (player.buffs.concentration > 0) {
      const chance = player.buffs.concentration * 10;
      const isTriggered = Math.random() * 100 < chance;
      
      if (isTriggered) {
        const mult = duelCriticalActive ? 2.0 : 1.5;
        finalDamage = Math.floor(finalDamage * mult);
        addLog(`[集中]の効果が発動！ カウンターダメージが ${mult}倍（${finalDamage}）になった！`, 'buff');
        
        setPlayer(prev => {
          const nextConc = Math.floor(prev.buffs.concentration / 2);
          return {
            ...prev,
            buffs: {
              ...prev.buffs,
              concentration: nextConc
            }
          };
        });

        if (duelCriticalActive) {
          setDuelCriticalActive(false);
        }
      }
    }
    
    // ロボット兵士の鋼鉄外殻
    let nextIronShell = enemy.ironShell;
    if (enemy.type === 'ROBOT' && enemy.ironShell > 0) {
      const reductionPercent = enemy.ironShell * 10;
      const reducedDamage = Math.floor(finalDamage * (1 - reductionPercent / 100));
      addLog(`ロボット兵士の【鋼鉄外殻】：ダメージを ${reductionPercent}% 軽減（-${finalDamage - reducedDamage}）した！`, 'enemy_info');
      finalDamage = reducedDamage;
      
      nextIronShell = Math.max(enemy.ironShell - 1, 0);
      addLog(`被ダメージによりロボット兵士 of 鋼鉄外殻が 1 減少した（残り: ${nextIronShell}）。`, 'enemy_info');
    }
    
    // ダメージ適用
    setEnemy(prev => {
      const nextHp = Math.max(prev.hp - finalDamage, 0);
      return {
        ...prev,
        hp: nextHp,
        ironShell: prev.type === 'ROBOT' ? nextIronShell : prev.ironShell
      };
    });
    
    addLog(`${enemy.name}に ${finalDamage} の肉斬骨断ダメージを与えた！`, 'enemy_damage');
    
    setKillerDamageReserve(false);
    
    // カウンター攻撃が終わったら遷移
    setTimeout(() => {
      if (enemy.hp - finalDamage <= 0) {
        handleEnemyDefeated();
      } else if (enemy.type === 'ROBOT' && enemyPreemptedThisTurn) {
        setPhase('SELECT_ACTION');
        setMenuInput('');
        setSelectedAction(null);
        
        const limit = calculateAllowedTime(15);
        setTimeLeft(limit);
        setTotalAllowedTime(limit);
      } else {
        setPhase('TURN_END');
      }
    }, 1200);
  };

  // ==========================================
  // 敵のターン ＆ プレイヤーの防御/回避 ＆ 毒処理
  // ==========================================

  useEffect(() => {
    if (phase === 'ENEMY_TURN') {
      const runEnemyTurn = async () => {
        // 敵がすでに倒れているなら、敵の攻撃は発生しない
        if (enemy.hp <= 0) {
          handleEnemyDefeated();
          return;
        }

        // ゴーレムがこのターン動けないパッシブの場合
        if (enemy.type === 'GOLEM' && !golemActionReady) {
          addLog(`${enemy.name}は動けない！`, 'enemy_info');
          goToNextPhase();
          return;
        }

        // パッシブ【予知】の割り込み回避タイピング判定
        if (player.passive === 'FORESEE' && foreseeCharge > 0 && selectedAction !== 'EVADE' && !isForeseeEvading && foreseeEvadeSuccess === null) {
          addLog(`パッシブ【予知】：未来予知を発動（スタックを 1 消費。残り ${foreseeCharge - 1}）！ 敵の攻撃を事前に予知し、回避を展開！`, 'buff');
          setForeseeCharge(prev => Math.max(prev - 1, 0));
          setIsForeseeEvading(true);
          
          // 回避タイピングをお題に設定して TYPING_ACTION へ
          const wordPair = getRandomWord(EVADE_WORDS);
          setTargetHiragana(wordPair.hiragana);
          setTargetKanji(wordPair.kanji);
          setTypedInputAndRef('');
          setMistakeCount(0);
          setIsFailed(false);
          setCharactersCount(0);
          setIsTimeExceededAndRef(false);

          let baseTime = 5;
          if (enemy.type === 'GOLEM') {
            baseTime = Math.max(baseTime - 2, 1.0);
          }
          const limit = calculateAllowedTime(baseTime, false);
          setTimeLeft(limit);
          setTotalAllowedTime(limit);
          setPhase('TYPING_ACTION');
          return; // 敵ターン処理を中断し、タイピング完了後に再度このフェーズに入る
        }

        // 敵の攻撃ダメージ計算: 敵の基本攻撃威力 ± 20% (小数点切り捨て)
        const variance = Math.floor(enemy.baseAtk * 0.2);
        const minDmg = enemy.baseAtk - variance;
        const maxDmg = enemy.baseAtk + variance;
        let rawEnemyDmg = Math.floor(minDmg + Math.random() * (maxDmg - minDmg + 1));

        // 敵の [脱力] 判定: 与ダメージが30%減少
        if (enemy.debuffs?.weakened && enemy.debuffs.weakened > 0) {
          rawEnemyDmg = Math.floor(rawEnemyDmg * 0.7);
          addLog(`${enemy.name}は[脱力]の影響で与ダメージが30%減少している（威力: ${rawEnemyDmg}）。`, 'debuff');
        } else {
          addLog(`${enemy.name}の攻撃！ 威力: ${rawEnemyDmg}`, 'enemy_info');
        }

        // 敵の集中バフ判定: [集中]数値×10%の確率で、与ダメージ1.5倍
        if (enemy.buffs.concentration > 0) {
          const chance = enemy.buffs.concentration * 10;
          const isTriggered = Math.random() * 100 < chance;
          if (isTriggered) {
            rawEnemyDmg = Math.floor(rawEnemyDmg * 1.5);
            addLog(`${enemy.name}の[集中]の効果が発動！ 与えるダメージが1.5倍（${rawEnemyDmg}）になった！`, 'buff');
            
            // 集中を半減
            setEnemy(prev => {
              const nextConc = Math.floor(prev.buffs.concentration / 2);
              return {
                ...prev,
                buffs: {
                  ...prev.buffs,
                  concentration: nextConc
                }
              };
            });
          }
        }

        let finalPlayerDmg = rawEnemyDmg;
        let isHit = true; // 的中フラグ

        // 回避の場合の処理
        if ((selectedAction === 'EVADE' && !isFailed) || (player.passive === 'FORESEE' && foreseeEvadeSuccess === true)) {
          finalPlayerDmg = 0;
          isHit = false;
          addLog(`華麗に回避！ 敵の攻撃を完全に受け流した！`, 'player_info');
        } else if ((selectedAction === 'EVADE' && isFailed) || (player.passive === 'FORESEE' && foreseeEvadeSuccess === false)) {
          // 回避失敗時は確実にダメージが直撃
          finalPlayerDmg = rawEnemyDmg;
          isHit = true;
          addLog(`回避失敗！ 無防備なところに攻撃が直撃した！`, 'player_damage');
        }

        // 防御の場合の処理
        else if (selectedAction === 'DEFEND') {
          // ガイコツ魔術師パッシブ: 防御軽減無効
          if (enemy.type === 'SKELETON') {
            addLog(`ガイコツ魔術師の【魔法熟練】：防御によるダメージ軽減が無効化された！`, 'enemy_info');
            finalPlayerDmg = rawEnemyDmg;
            isHit = true;
          } else {
            // 防御軽減率: 通常は文字数×5%、ゴーレムなら文字数×4%
            const ratePerLetter = enemy.type === 'GOLEM' ? 0.04 : 0.05;
            const actualCount = typedCharactersCountRef.current;
            const reductionRate = actualCount * ratePerLetter;
            const percentage = Math.floor(reductionRate * 100);
            const displayedCount = Math.round(actualCount * 10) / 10;

            addLog(`盾を構えた！ 軽減率: ${percentage}% (文字数: ${displayedCount}文字)`, 'player_info');

            if (reductionRate >= 1.0) {
              // 100%超過時: 攻撃は的中していないものとする、カウンターダメージ発動
              isHit = false;
              finalPlayerDmg = 0;
              addLog(`完璧な受け流し！ 敵の攻撃を防ぎきった！`, 'player_info');

              // カウンター計算
              const requiredCount = enemy.type === 'GOLEM' ? 25 : 20;
              const excessLetters = Math.max(actualCount - requiredCount, 0);
              const counterDmg = Math.floor(rawEnemyDmg * (excessLetters * ratePerLetter));

              if (counterDmg > 0) {
                setEnemy(prev => ({
                  ...prev,
                  hp: Math.max(prev.hp - counterDmg, 0)
                }));
                addLog(`【カウンター】！ 衝撃を跳ね返し、${enemy.name}に ${counterDmg} のダメージ！`, 'player_damage');
              }
            } else {
              // 100%未満
              finalPlayerDmg = Math.floor(rawEnemyDmg * (1 - reductionRate));
              isHit = true;
            }
          }
        }

        // ダメージ適用
        if (finalPlayerDmg > 0) {
          setTimeout(() => {
            setPlayer(prev => ({
              ...prev,
              hp: Math.max(prev.hp - finalPlayerDmg, 0)
            }));
          }, 0);
          addLog(`あなたは ${finalPlayerDmg} のダメージを受けた！`, 'player_damage');

          if (player.passive === 'DUEL' && selectedAction === 'DEFEND') {
            setTimeout(() => {
              setPlayer(prev => ({
                ...prev,
                debuffs: {
                  ...prev.debuffs,
                  weakened: 2
                }
              }));
            }, 0);
            addLog(`【決闘宣布】発動！ 防御時の被ダメージにより、自身に [脱力] 2 が付与された！`, 'debuff');
          }
        }

        // プレイヤーの生存確認
        let nextPlayerHp = player.hp - finalPlayerDmg;
        if (nextPlayerHp <= 0) {
          setTimeout(() => {
            onLose();
          }, 1500);
          return;
        }

        // 敵の的中時パッシブ発動
        if (isHit) {
          const isEvadeFailed = (selectedAction === 'EVADE' && isFailed);
          // 1. スパイダー: 攻撃命中時、50%の確率で[毒]3を付与する。(回避失敗時は100%的中)
          if (enemy.type === 'SPIDER') {
            if (isEvadeFailed || Math.random() * 100 < 50) {
              setTimeout(() => {
                setPlayer(prev => {
                  if (prev.debuffs.deadlyPoison) {
                    return prev; // 既に猛毒状態なら付与しない
                  }
                  const currentPoison = prev.debuffs.poison;
                  if (currentPoison > 0) {
                    // すでに毒状態なら、毒を解除し猛毒にする
                    addLog(`${enemy.name}の猛毒が体内を侵食！ [毒]が解除され、恐るべき【猛毒】状態になった！`, 'debuff');
                    return {
                      ...prev,
                      debuffs: {
                        ...prev.debuffs,
                        poison: 0,
                        deadlyPoison: true
                      }
                    };
                  } else {
                    addLog(`${enemy.name}の牙から毒が注入された！ [毒] 3 を受けた！`, 'debuff');
                    return {
                      ...prev,
                      debuffs: {
                        ...prev.debuffs,
                        poison: 3
                      }
                    };
                  }
                });
              }, 0);
            }
          }

          // 2. ゴーレム: 攻撃的中時、30%の確率で[圧倒]または[脱力]3を付与 (回避失敗時は100%的中)
          if (enemy.type === 'GOLEM') {
            if (isEvadeFailed || Math.random() * 100 < 30) {
              const isOverwhelmed = Math.random() < 0.5;
              setTimeout(() => {
                setPlayer(prev => {
                  if (isOverwhelmed) {
                    addLog(`${enemy.name}の圧倒的な威圧感！ [圧倒] 3 （タイピング時間25%減少）を受けた！`, 'debuff');
                    return {
                      ...prev,
                      debuffs: {
                        ...prev.debuffs,
                        overwhelmed: 3
                      }
                    };
                  } else {
                    addLog(`${enemy.name}の重震撃！ [脱力] 3 （与ダメージ30%減少）を受けた！`, 'debuff');
                    return {
                      ...prev,
                      debuffs: {
                        ...prev.debuffs,
                        weakened: 3
                      }
                    };
                  }
                });
              }, 0);
            }
          }
        }

        // ターン終了、または先制攻撃だった場合はプレイヤーの行動選択へ
        setTimeout(() => {
          // 「決闘宣布」効果判定: 回避成功時、ターン終了時に [集中] 5 を得て次のターン クリティカル倍率 2.0 倍
          const wasEvaded = (selectedAction === 'EVADE' && !isFailed) || (player.passive === 'FORESEE' && foreseeEvadeSuccess === true);
          if (player.passive === 'DUEL' && wasEvaded) {
            setDuelCriticalActive(true);
            setPlayer(prev => ({
              ...prev,
              buffs: {
                ...prev.buffs,
                concentration: prev.buffs.concentration + 5
              }
            }));
            addLog(`【決闘宣布】発動！ 回避成功により [集中] 5 獲得、次のターンのクリティカル倍率が 2.0 倍に上昇！`, 'buff');
          }

          // 「殺手」カウンター攻撃 or フェーズ移行
          if (killerDamageReserve) {
            executeKillerCounter(finalPlayerDmg);
          } else if (enemy.type === 'ROBOT' && enemyPreemptedThisTurn) {
            // 先制攻撃が終了したので、プレイヤーのコマンド選択へ
            setPhase('SELECT_ACTION');
            setMenuInput('');
            setSelectedAction(null);
            
            const limit = calculateAllowedTime(15);
            setTimeLeft(limit);
            setTotalAllowedTime(limit);
          } else {
            setPhase('TURN_END');
          }
        }, 1200);
      };

      runEnemyTurn();
    }
  }, [phase]);

  // ターン終了処理 (毒・猛毒ダメージ・デバフカウントダウン)
  useEffect(() => {
    if (phase === 'TURN_END') {
      const handleTurnEnd = async () => {
        // 敵の生存チェック
        if (enemy.hp <= 0) {
          handleEnemyDefeated();
          return;
        }

        // 敵の [脱力] カウントダウン
        if (enemy.debuffs?.weakened && enemy.debuffs.weakened > 0) {
          const nextWeak = enemy.debuffs.weakened - 1;
          setEnemy(prev => ({
            ...prev,
            debuffs: {
              ...prev.debuffs,
              weakened: nextWeak
            }
          }));
          if (nextWeak === 0) {
            addLog(`${enemy.name}の[脱力]が解除された！`, 'system');
          } else {
            addLog(`${enemy.name}の[脱力]が減少した（残り: ${nextWeak}）。`, 'system');
          }
        }

        let totalPoisonDmg = 0;

        // 1. [毒]判定: 攻撃・魔法を使用した場合、ターン終了時に最大HPの4%ダメージ。
        // ※ 攻撃・魔法(強攻撃)を使用したのは `playerUsedActionThisTurn`
        if (player.debuffs.poison > 0 && playerUsedActionThisTurn) {
          const dmg = Math.floor(player.maxHp * 0.04);
          totalPoisonDmg += dmg;
          addLog(`[毒]の浸食：行動したことで毒が回り、${dmg} のダメージを受けた！`, 'player_damage');
        }

        // 2. [猛毒]判定: ターン終了時に最大HPの8%ダメージを受ける。
        if (player.debuffs.deadlyPoison) {
          const dmg = Math.floor(player.maxHp * 0.08);
          totalPoisonDmg += dmg;
          addLog(`【猛毒】の侵食：ターン終了時に激しい毒が巡り、${dmg} のダメージを受けた！`, 'player_damage');
        }

        // 毒ダメージの適用
        let nextHp = player.hp;
        if (totalPoisonDmg > 0) {
          nextHp = Math.max(player.hp - totalPoisonDmg, 0);
          setTimeout(() => {
            setPlayer(prev => ({
              ...prev,
              hp: nextHp
            }));
          }, 0);
        }

        if (nextHp <= 0) {
          setTimeout(() => {
            onLose();
          }, 1500);
          return;
        }

        // 3. デバフ数値の減少処理 (圧倒、脱力、毒)
        setTimeout(() => {
          setPlayer(prev => {
            const nextOverwhelmed = Math.max(prev.debuffs.overwhelmed - 1, 0);
            const nextWeakened = Math.max(prev.debuffs.weakened - 1, 0);
            const nextPoison = Math.max(prev.debuffs.poison - 1, 0);

            // ログを流す
            if (prev.debuffs.overwhelmed === 1) addLog(`[圧倒]状態が解けた。`, 'system');
            if (prev.debuffs.weakened === 1) addLog(`[脱力]状態が解けた。`, 'system');
            if (prev.debuffs.poison === 1) addLog(`[毒]状態が解けた。`, 'system');

            return {
              ...prev,
              debuffs: {
                ...prev.debuffs,
                overwhelmed: nextOverwhelmed,
                weakened: nextWeakened,
                poison: nextPoison,
              }
            };
          });
        }, 0);

        // ロボット兵士：鋼鉄外殻のターン終了時減少
        if (enemy.type === 'ROBOT' && enemy.ironShell > 0) {
          const isBelow50 = enemy.hp < (enemy.maxHp * 0.5);
          if (isBelow50) {
            setEnemy(prev => ({
              ...prev,
              ironShell: Math.max(prev.ironShell - 1, 0)
            }));
            addLog(`ロボット兵士の鋼鉄外殻が1減少した。`, 'enemy_info');
          }
        }

        // 先制フラグのリセット
        setEnemyPreemptedThisTurn(false);

        // ターン経過
        setTurn(prev => prev + 1);

        // 次のターンへ
        setTimeout(() => {
          setPhase('START');
        }, 1200);
      };

      handleTurnEnd();
    }
  }, [phase]);

  const goToNextPhase = () => {
    setTurn(prev => prev + 1);
    setTimeout(() => {
      setPhase('START');
    }, 1000);
  };

  const handleEnemyDefeated = () => {
    addLog(`★ ${enemy.name}を討ち果たした！`, 'system');
    
    // 戦闘終了時に毒デバフ（戦闘終了まで持続する猛毒を含む）や他のデバフはリセット。
    // 仕様には特にリセットの記述はないが、通常戦闘終了時に状態異常は治るのが自然なため、
    // プレイヤーの戦闘用一時ステータスをクリーンアップする。
    setTimeout(() => {
      setPlayer(prev => ({
        ...prev,
        debuffs: {
          overwhelmed: 0,
          weakened: 0,
          poison: 0,
          deadlyPoison: false
        },
        buffs: {
          concentration: 0 // 集中は次の戦闘へ引き継いでもよいが、仕様上リセット
        }
      }));
    }, 0);

    setTimeout(() => {
      onWin();
    }, 1500);
  };

  // ==========================================
  // ビジュアルヘルパー
  // ==========================================

  // タイピングお題のカラーリング処理
  const renderTypingText = () => {
    if (phase !== 'TYPING_ACTION') return null;

    // 現在入力した文字
    const matchedRomaji = typedInput;
    const nextKeys = getNextValidKeys(targetHiragana, typedInput);

    return (
      <div className="text-center font-sans">
        {/* 漢字お題 */}
        {targetKanji && targetKanji !== targetHiragana && (
          <div className="text-xl font-bold text-slate-400 tracking-wide mb-2 select-none" id="target-kanji">
            {targetKanji}
          </div>
        )}

        {/* ひらがなお題 */}
        <div className="text-3xl font-black text-white tracking-wide mb-6 select-none" id="target-hiragana">
          {targetHiragana}
        </div>

        {/* 入力状況表示 */}
        <div className="inline-flex items-center gap-1.5 p-4 bg-neutral-950/80 rounded-2xl border border-neutral-800 text-2xl font-mono px-8 min-w-[320px] justify-center relative overflow-hidden" id="romaji-display">
          {matchedRomaji.split('').map((char, index) => (
            <span key={index} className="text-emerald-400 font-bold drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
              {char}
            </span>
          ))}
          {/* カーソル */}
          <span className="w-2.5 h-7 bg-amber-400 animate-pulse rounded-sm mx-0.5" />
          <span className="text-neutral-600">...</span>
        </div>

        {/* 次に入力すべきキーのガイド */}
        {nextKeys.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-xs text-neutral-500 font-mono">次のキー候補:</span>
            {nextKeys.map((key, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 text-amber-400 text-sm font-mono font-bold rounded shadow-sm">
                {key.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // アクション選択表示
  const renderActionSelection = () => {
    if (phase !== 'SELECT_ACTION') return null;

    const matchedOptions = Object.entries(MENU_OPTIONS).map(([action, hiragana]) => {
      const isPrefix = isValidPrefix(hiragana, menuInput);
      const isTarget = isPrefix && menuInput.length > 0;
      return { action, hiragana, isTarget };
    });

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto w-full px-4">
        {matchedOptions.map(({ action, hiragana, isTarget }) => {
          let styleClass = "border-slate-800 bg-slate-900/40 text-slate-400";
          let actionLabel = "";
          let icon = null;

          switch (action) {
            case 'ATTACK':
              actionLabel = "攻撃";
              icon = <Zap className="w-5 h-5 text-red-400" />;
              if (isTarget) styleClass = "border-red-500 bg-slate-900 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)] scale-[1.02]";
              break;
            case 'STRONG_ATTACK':
              actionLabel = "強攻撃 (魔法 / ノーミス)";
              icon = <Flame className="w-5 h-5 text-red-500 animate-pulse" />;
              if (isTarget) styleClass = "border-red-500 bg-red-950/20 text-white shadow-[inset_0_0_10px_rgba(239,68,68,0.3)] scale-[1.02]";
              break;
            case 'DEFEND':
              actionLabel = "防御 (超過で反射)";
              icon = <Shield className="w-5 h-5 text-blue-400" />;
              if (isTarget) styleClass = "border-blue-500 bg-blue-950/20 text-white shadow-[inset_0_0_10px_rgba(59,130,246,0.3)] scale-[1.02]";
              break;
            case 'EVADE':
              actionLabel = "回避 (ノーミス)";
              icon = <ShieldAlert className="w-5 h-5 text-emerald-400" />;
              if (isTarget) styleClass = "border-emerald-500 bg-emerald-950/20 text-white shadow-[inset_0_0_10px_rgba(16,185,129,0.3)] scale-[1.02]";
              break;
          }

          return (
            <motion.div
              key={action}
              className={`p-5 rounded-xl border-2 transition-all duration-300 flex items-center justify-between ${styleClass}`}
            >
              <div className="flex items-center gap-3">
                {icon}
                <div className="text-left font-sans">
                  <div className="font-bold text-base text-slate-100">{actionLabel}</div>
                  <div className="text-xs text-slate-500 font-mono">
                    ローマ字: <span className="text-red-400/80 font-semibold">{hiragana}</span>
                  </div>
                </div>
              </div>
              
              {/* 入力進行表示 */}
              {isTarget && (
                <span className="text-xs font-mono px-2 py-1 bg-red-950/40 text-red-400 border border-red-900/30 rounded-md">
                  ロックオン中
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    );
  };

  // タイマーの％計算
  const timerPercentage = totalAllowedTime > 0 ? (timeLeft / totalAllowedTime) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl w-full mx-auto p-2 items-start relative" id="battle-screen-container">
      
      {/* デバッグ用：9999ダメージボタン */}
      <div className="absolute top-0 right-2 z-50">
        <button
          onClick={() => {
            setEnemy(prev => {
              const nextHp = Math.max(prev.hp - 9999, 0);
              addLog(`【デバッグ】邪悪な呪文が発動し、敵に9999ダメージを与えた！`, 'player_info');
              if (nextHp === 0) {
                setTimeout(() => {
                  handleEnemyDefeated();
                }, 500);
              }
              return { ...prev, hp: nextHp };
            });
          }}
          className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900/80 text-red-400 hover:text-red-300 border border-red-900/30 rounded text-[10px] font-mono transition-all cursor-pointer shadow-sm select-none"
        >
          DEBUG: 9999 DMG
        </button>
      </div>

      {/* 左コラム: キャラクターのステータス & タイピングUI (8/12幅) */}
      <div className="lg:col-span-8 space-y-4">
        
        {/* 敵とプレイヤーのヘルスバー */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* プレイヤー情報 */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl" id="player-status-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-emerald-500 fill-current animate-pulse" />
                <span className="font-sans font-black text-slate-100 text-lg">PLAYER</span>
              </div>
              <span className="text-sm font-mono text-slate-400">{player.hp} / {player.maxHp}</span>
            </div>

            {/* HPゲージ */}
            <div className="h-4 bg-slate-950 rounded-full border border-slate-800 p-0.5 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-300"
                style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
              />
            </div>

            {/* バフ & デバフ */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-sans">
              <div className="relative group cursor-help px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <span>基本攻撃威力 {player.baseAtk}</span>
                {/* ツールチップ */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                  <div className="font-bold text-slate-100 mb-0.5">基本攻撃威力</div>
                  <div className="leading-snug">タイピング攻撃の基礎威力。タイピング成功した文字数にこの値が加算されます。</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                </div>
              </div>

              {player.buffs.concentration > 0 && (
                <div className="relative group cursor-help px-2 py-0.5 bg-blue-900/50 text-blue-300 border border-blue-700/50 rounded font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span>[集中] {player.buffs.concentration}</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-blue-400 mb-0.5">[集中] バフ</div>
                    <div className="leading-snug">1スタックにつき10%の確率（現在 {player.buffs.concentration * 10}%）で与ダメージが1.5倍になります。発動するとスタック数が半減します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </div>
              )}

              {player.debuffs.overwhelmed > 0 && (
                <div className="relative group cursor-help px-2 py-0.5 bg-red-900/50 text-red-300 border border-red-700/50 rounded font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-bounce" />
                  <span>[圧倒] {player.debuffs.overwhelmed}</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-red-400 mb-0.5">[圧倒] デバフ</div>
                    <div className="leading-snug">タイピングの制限時間が25%減少します。ターン終了時に数値が1減少します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </div>
              )}

              {player.debuffs.weakened > 0 && (
                <div className="relative group cursor-help px-2 py-0.5 bg-yellow-900/50 text-yellow-300 border border-yellow-700/50 rounded font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  <span>[脱力] {player.debuffs.weakened}</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-yellow-400 mb-0.5">[脱力] デバフ</div>
                    <div className="leading-snug">自身の与ダメージが30%減少します。ターン終了時に数値が1減少します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </div>
              )}

              {player.debuffs.poison > 0 && (
                <div className="relative group cursor-help px-2 py-0.5 bg-purple-950/60 text-purple-300 border border-purple-800/50 rounded font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                  <span>[毒] {player.debuffs.poison}</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-purple-400 mb-0.5">[毒] デバフ</div>
                    <div className="leading-snug">ターン終了時に3ダメージを受けます。既に毒状態でさらに毒を受けると「猛毒」状態に悪化。ターン終了時に数値が1減少します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </div>
              )}

              {player.debuffs.deadlyPoison && (
                <div className="relative group cursor-help px-2 py-0.5 bg-orange-900/50 text-orange-300 border border-orange-700/50 rounded font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                  <span>[猛毒]</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-orange-400 mb-0.5">[猛毒] デバフ</div>
                    <div className="leading-snug">ターン終了時に最大体力の8%のダメージを受けます。戦闘終了まで持続します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </div>
              )}

              {player.passive && (
                <div className="relative group cursor-help px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-semibold flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span>
                    【{player.passive === 'FORESEE' ? '予知' : player.passive === 'DUEL' ? '決闘' : '殺手'}】
                    {player.passive === 'FORESEE' && `(予知: ${foreseeCharge})`}
                  </span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-indigo-300 mb-0.5">
                      {player.passive === 'FORESEE' ? '予知のルーン' : player.passive === 'DUEL' ? '決闘のルーン' : '肉斬骨断のルーン'}
                    </div>
                    <div className="leading-snug">
                      {player.passive === 'FORESEE' && '戦闘開始時に「未来予知」5を得る。攻撃を受ける際に「未来予知」があるなら自動で回避タイピングが発生し、成功すれば完全回避！'}
                      {player.passive === 'DUEL' && '回避成功ターン終了時に[集中]+5、次ターンクリ倍率2倍。防御ターン被ダメージ時、自身に[脱力]2を付与。'}
                      {player.passive === 'KILLER' && '強攻撃選択時に必ず後攻（敵の攻撃後）になるが、そのターンに自身が受けたダメージの1.5倍を強攻撃威力に加算！'}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 敵情報 */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl" id="enemy-status-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SkullIcon type={enemy.type} />
                <span className="font-sans font-black text-slate-100 text-lg uppercase tracking-widest">{enemy.name}</span>
              </div>
              <span className="text-sm font-mono text-slate-500">HP {enemy.hp} / {enemy.maxHp}</span>
            </div>

            {/* HPゲージ */}
            <div className="h-4 bg-slate-950 rounded-full border border-slate-800 p-0.5 overflow-hidden">
              <div 
                className="h-full bg-red-600 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.5)] transition-all duration-300"
                style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
              />
            </div>

            <div className="relative group cursor-help mt-3 text-xs font-mono text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded border border-slate-800/50">
              <div className="font-bold text-red-500 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>パッシブ：{enemy.passiveName}</span>
              </div>
              <div>{enemy.passiveDesc}</div>
              {/* ツールチップ */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                <div className="font-bold text-red-400 mb-0.5">敵パッシブ効果</div>
                <div className="leading-snug">敵が常時、または特定の条件で自動的に発動する固有の能力です。</div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 text-xs">
              {enemy.debuffs?.weakened && enemy.debuffs.weakened > 0 && (
                <span className="relative group cursor-help px-2 py-0.5 bg-yellow-950/60 text-yellow-300 border border-yellow-800/50 rounded font-semibold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                  <span>[脱力] {enemy.debuffs.weakened}</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-yellow-400 mb-0.5">[脱力] デバフ</div>
                    <div className="leading-snug">与えるダメージが30%減少します。ターン終了時に数値が1減少します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </span>
              )}
              <span className="relative group cursor-help px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold">
                攻撃威力: {enemy.baseAtk}
                {/* ツールチップ */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                  <div className="font-bold text-slate-100 mb-0.5">敵攻撃威力</div>
                  <div className="leading-snug">敵がターンに繰り出す攻撃の基礎威力。ここから一定の揺らぎを伴ってダメージを計算します。</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                </div>
              </span>
              {enemy.buffs.concentration > 0 && (
                <span className="relative group cursor-help px-2 py-0.5 bg-blue-900/50 text-blue-300 border border-blue-700/50 rounded font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span>集中: {enemy.buffs.concentration}</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-blue-400 mb-0.5">敵 [集中] バフ</div>
                    <div className="leading-snug">敵の1スタックにつき10%の確率（現在 {enemy.buffs.concentration * 10}%）で与ダメージが1.5倍になります。発動するとスタック数が半減します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </span>
              )}
              {enemy.type === 'ROBOT' && enemy.ironShell > 0 && (
                <span className="relative group cursor-help px-2 py-0.5 bg-slate-800 text-slate-100 border border-slate-600 rounded font-semibold flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>鋼鉄外殻: {enemy.ironShell}</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-slate-100 mb-0.5">鋼鉄外殻</div>
                    <div className="leading-snug">受ける最終ダメージを {enemy.ironShell * 10}% 軽減します。被ダメージ時に1減少し、HP50%未満になると消滅します。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </span>
              )}
              {enemy.type === 'ROBOT' && enemy.hp < (enemy.maxHp * 0.5) && (
                <span className="relative group cursor-help px-2 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-800/50 rounded font-semibold flex items-center gap-1 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>必ず先制</span>
                  {/* ツールチップ */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-300 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center pointer-events-none normal-case font-normal leading-normal">
                    <div className="font-bold text-amber-400 mb-0.5">必ず先制攻撃</div>
                    <div className="leading-snug">毎ターン、プレイヤーのアクション選択より先に、強力な攻撃を仕掛けてきます。</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950" />
                  </div>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* メインタイピング作業ステージ */}
        <div className="p-6 bg-slate-900/30 border border-slate-800 rounded-2xl relative min-h-[250px] flex flex-col justify-between overflow-hidden shadow-xl" id="typing-stage">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#64748b 1px, transparent 1px)", backgroundSize: "32px 32px" }}></div>
          
          {/* 上部: タイマー ＆ フェーズ案内 */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <span className="px-3 py-1 bg-slate-950 rounded-lg text-xs font-mono text-red-500 uppercase tracking-widest border border-slate-800">
              {phase === 'SELECT_ACTION' ? 'ACTION SELECT' : phase === 'TYPING_ACTION' ? 'TYPING NOW!' : 'SYSTEM PROCESS'}
            </span>
            
            {/* 制限時間タイマー */}
            {phase === 'TYPING_ACTION' && (
              <div className="flex items-center gap-3 bg-slate-950/60 px-3.5 py-2 rounded-xl border border-red-900/30">
                {isTimeExceeded && (
                  <span className="text-xs font-bold text-amber-500 animate-pulse font-sans">時間超過（威力半減）</span>
                )}
                <span className="text-xl md:text-2xl font-mono text-red-500 font-black tracking-wider drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]">{timeLeft.toFixed(1)}s</span>
                <div className="w-32 bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-red-600 to-amber-500 h-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    animate={{ width: `${timerPercentage}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>
            )}
            {phase === 'SELECT_ACTION' && (
              <div className="flex items-center gap-3 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/50">
                <span className="text-xs md:text-sm font-mono text-slate-500 font-bold tracking-wide">制限時間なし</span>
              </div>
            )}
          </div>

          {/* 中部: コンテンツ表示 */}
          <div className="my-auto flex flex-col items-center justify-center relative z-10 w-full">
            <AnimatePresence mode="wait">
              {phase === 'SELECT_ACTION' && (
                <motion.div
                  key="select-action"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full text-center space-y-6"
                >
                  <p className="text-slate-400 text-sm font-sans leading-relaxed">
                    行動を選択してください。目的のコマンドを <strong className="text-slate-200">ローマ字タイピング</strong> すると決定されます。
                  </p>
                  
                  {renderActionSelection()}
                  
                  {menuInput.length > 0 && (
                    <div className="text-xs font-mono text-slate-500 mt-2">
                      現在の入力: <strong className="text-red-400">{menuInput}</strong>
                    </div>
                  )}
                </motion.div>
              )}

              {phase === 'TYPING_ACTION' && (
                <motion.div
                  key="typing-action"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="w-full"
                >
                  {renderTypingText()}
                </motion.div>
              )}

              {phase === 'START' && (
                <motion.div
                  key="start"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-400 text-center font-sans py-8"
                >
                  戦闘体制を整えています...
                </motion.div>
              )}

              {phase === 'ENEMY_TURN' && (
                <motion.div
                  key="enemy-turn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-400 text-center font-sans py-8"
                >
                  敵が行動を完了するのを待っています...
                </motion.div>
              )}

              {phase === 'TURN_END' && (
                <motion.div
                  key="turn-end"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-400 text-center font-sans py-8"
                >
                  ターン終了処理中...
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 下部: ミスカウントやキー解説 */}
          <div className="mt-6 pt-3 border-t border-slate-800/50 flex items-center justify-between text-xs text-slate-500 font-sans relative z-10">
            <div>
              ミス入力: <span className="font-bold text-red-500">{mistakeCount}</span> 回
            </div>
            <div>
              層: <strong className="text-slate-300">{floor}層</strong> / 10層
            </div>
          </div>

        </div>

      </div>

      {/* 右コラム: バトルログ (4/12幅) & ステータス解説 */}
      <div className="lg:col-span-4 space-y-4 flex flex-col h-full">
        
        {/* バトルログ */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl h-[230px] flex flex-col justify-between" id="battle-log-card">
          <div className="text-sm font-sans font-extrabold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>戦闘ログ</span>
            <span className="text-xs text-slate-500 font-mono">Turn {turn}</span>
          </div>

          <div ref={logContainerRef} className="flex-1 overflow-y-auto mt-2 pr-1 space-y-2 max-h-[160px] text-xs font-sans text-left scrollbar-thin scrollbar-thumb-slate-800">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-10 italic">
                ここに戦闘の記録が刻まれます。
              </div>
            ) : (
              logs.map((log) => {
                let colorClass = "text-slate-400";
                if (log.type === 'player_info') colorClass = "text-emerald-400 font-semibold";
                if (log.type === 'player_damage') colorClass = "text-rose-400";
                if (log.type === 'enemy_info') colorClass = "text-amber-400 font-semibold";
                if (log.type === 'enemy_damage') colorClass = "text-red-400 font-bold";
                if (log.type === 'buff') colorClass = "text-blue-400 font-medium";
                if (log.type === 'debuff') colorClass = "text-red-400 font-medium";
                if (log.type === 'system') colorClass = "text-slate-300 border-l border-slate-700 pl-2";

                return (
                  <div key={log.id} className={`${colorClass} leading-relaxed`}>
                    <span className="text-slate-500 mr-1">{log.type === 'system' ? '' : '>'}</span> {log.text}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右側：バフ・デバフ解説カード (デザインHTMLより) */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-xs" id="status-definitions-card">
          <button 
            onClick={() => setShowDefinitions(!showDefinitions)}
            className="w-full flex items-center justify-between text-slate-400 font-bold uppercase tracking-tighter hover:text-slate-200 transition-colors cursor-pointer"
          >
            <span>Status Definitions</span>
            <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono">
              {showDefinitions ? 'HIDE ▲' : 'SHOW ▼'}
            </span>
          </button>
          
          {showDefinitions && (
            <div className="mt-3 grid grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-2 pt-2 border-t border-slate-800/50">
              <div>
                <div className="text-blue-400 font-bold underline mb-0.5">[集中] (バフ)</div>
                <p className="text-[10px] text-slate-500 leading-snug">1スタックにつき10%の確率で、攻撃的中時に与ダメージが1.5倍に。発動で半減。</p>
              </div>
              <div>
                <div className="text-red-400 font-bold underline mb-0.5">[圧倒] (デバフ)</div>
                <p className="text-[10px] text-slate-500 leading-snug">タイピングの制限時間が25%減少。ターン終了時に数値が1減少。</p>
              </div>
              <div>
                <div className="text-yellow-400 font-bold underline mb-0.5">[脱力] (デバフ)</div>
                <p className="text-[10px] text-slate-500 leading-snug">与ダメージが30%減少。ターン終了時に数値が1減少。</p>
              </div>
              <div>
                <div className="text-purple-400 font-bold underline mb-0.5">[毒] (デバフ)</div>
                <p className="text-[10px] text-slate-500 leading-snug">ターン終了時に3ダメージ。さらに毒を受けると「猛毒」に。ターン終了時に数値が1減少。</p>
              </div>
              <div className="col-span-2 lg:col-span-1">
                <div className="text-orange-400 font-bold underline mb-0.5">[猛毒] (デバフ)</div>
                <p className="text-[10px] text-slate-500 leading-snug">ターン終了時に最大体力の8%のダメージ。この戦闘が終了するまで持続。</p>
              </div>
              <div className="col-span-2 lg:col-span-1">
                <div className="text-slate-400 font-bold underline mb-0.5">[鋼鉄外殻] (敵バフ)</div>
                <p className="text-[10px] text-slate-500 leading-snug">ロボット兵士専用。1スタックにつき被ダメージを10%軽減。被ダメージ時に1減少し、HP50%未満になると消滅する。</p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

// 敵タイプに応じたアイコン
function SkullIcon({ type }: { type: EnemyType }) {
  switch (type) {
    case 'GOBLIN':
      return <span className="text-xl">👺</span>;
    case 'SKELETON':
      return <span className="text-xl">💀</span>;
    case 'GOLEM':
      return <span className="text-xl">🗿</span>;
    case 'SPIDER':
      return <span className="text-xl">🕷️</span>;
    case 'SHADOW':
      return <span className="text-xl">👤</span>;
    case 'ROBOT':
      return <span className="text-xl">🤖</span>;
    default:
      return <span className="text-xl">👾</span>;
  }
}
