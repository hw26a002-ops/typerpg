import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Sparkles, Heart, RefreshCw, AlertTriangle, Flame, ShieldAlert } from 'lucide-react';
import { PlayerStatus, EnemyStatus, ActionType, BattleLog, EnemyType } from '../types';
import { generateEnemy } from '../data/enemies';
import { getRandomWord, ATTACK_WORDS, STRONG_ATTACK_WORDS, DEFEND_WORDS, EVADE_WORDS } from '../data/words';
import { isValidPrefix, isCompleteMatch, getNextValidKeys } from '../utils/typing';

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
  const [typedInput, setTypedInput] = useState<string>('');
  const [isFailed, setIsFailed] = useState<boolean>(false); // 強攻撃・回避用の即失敗フラグ
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [typedCharactersCount, setTypedCharactersCount] = useState<number>(0); // 防御などの入力文字数カウント

  // タイマー関連
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [totalAllowedTime, setTotalAllowedTime] = useState<number>(0);

  // ターン履歴
  const [golemActionReady, setGolemActionReady] = useState<boolean>(true); // ゴーレムの行動可能フラグ
  const [playerUsedActionThisTurn, setPlayerUsedActionThisTurn] = useState<boolean>(false); // 毒判定用

  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ログ追加ユーティリティ
  const addLog = (text: string, type: BattleLog['type'] = 'system') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), text, type }]);
  };

  // ログが追加されたらスクロール
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 全制限時間の計算ユーティリティ
  const calculateAllowedTime = (baseTime: number, isAttack: boolean = false): number => {
    // 全制限時間増加（+5% × レベル）
    let time = baseTime * (1 + 0.05 * player.allLimitIncreaseLevel);
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
        setPhase('SELECT_ACTION');
        setMenuInput('');
        setSelectedAction(null);
        
        const limit = calculateAllowedTime(15);
        setTimeLeft(limit);
        setTotalAllowedTime(limit);
      }, 800);
    }
  }, [phase, turn]);

  // タイマーループ
  useEffect(() => {
    if (phase === 'SELECT_ACTION' || phase === 'TYPING_ACTION') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            clearInterval(timerRef.current!);
            // タイムオーバー
            handleTimeOver();
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // タイムオーバー処理
  const handleTimeOver = () => {
    addLog("制限時間切れ！ 行動に失敗した。", "player_damage");
    if (phase === 'TYPING_ACTION') {
      // 防御中であれば、そこまで入力した文字数で部分判定
      if (selectedAction === 'DEFEND') {
        const lettersCount = typedInput.length;
        setTypedCharactersCount(lettersCount);
        addLog(`なんとか ${lettersCount} 文字を盾にし、防御の構えをとった！`, "player_info");
      } else {
        setIsFailed(true);
      }
    } else {
      setIsFailed(true);
    }
    
    setPhase('ENEMY_TURN');
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
          setTypedInput(nextInput);

          // 完全一致したか
          if (isCompleteMatch(targetHiragana, nextInput)) {
            // タイピング成功！
            if (selectedAction === 'DEFEND') {
              // 防御の場合はすべて打ち終えても追加ダメージ軽減などは特になく、
              // 文字数カウントの都合上、最後まで打ち終わったら自動で敵のターンへ進む
              setTypedCharactersCount(targetHiragana.length);
              addLog(`完璧な防御！ ${targetHiragana.length}文字による強固な盾を展開した！`, 'player_info');
              setTimeout(() => {
                setPhase('ENEMY_TURN');
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
            addLog(`タイピングミス！ ${selectedAction === 'STRONG_ATTACK' ? '強攻撃' : '回避'}に失敗した。`, 'player_damage');
            setTimeout(() => {
              setPhase('ENEMY_TURN');
            }, 1000);
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
    setTypedInput('');
    setMistakeCount(0);
    setIsFailed(false);

    let word = '';
    let baseTime = 15;

    switch (action) {
      case 'ATTACK':
        word = getRandomWord(ATTACK_WORDS);
        baseTime = 5;
        break;
      case 'STRONG_ATTACK':
        word = getRandomWord(STRONG_ATTACK_WORDS);
        baseTime = 7;
        break;
      case 'DEFEND':
        word = getRandomWord(DEFEND_WORDS);
        baseTime = 15;
        break;
      case 'EVADE':
        word = getRandomWord(EVADE_WORDS);
        baseTime = 5;
        // ゴーレムパッシブ: 回避入力時間を -2秒
        if (enemy.type === 'GOLEM') {
          baseTime = Math.max(baseTime - 2, 1.0);
        }
        break;
    }

    setTargetHiragana(word);
    
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
      rawDamage = targetHiragana.length + player.baseAtk;
      text = `「${targetHiragana}」のタイピングに成功！ ${enemy.name}に攻撃を仕掛けた！`;
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

    // 2. 集中バフ判定: [集中]数値×10%の確率で、攻撃的中時に与ダメージ1.2倍
    let finalDamage = rawDamage;
    if (player.buffs.concentration > 0) {
      const chance = player.buffs.concentration * 10;
      const isTriggered = Math.random() * 100 < chance;
      
      if (isTriggered) {
        finalDamage = Math.floor(finalDamage * 1.5);
        addLog(`[集中]の効果が発動！ 与えるダメージが1.5倍（${finalDamage}）になった！`, 'buff');
        
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
      }
    }

    // 3. 脱力デバフ判定: 敵に与える与ダメージが30%減少
    if (player.debuffs.weakened > 0) {
      finalDamage = Math.floor(finalDamage * 0.7);
      addLog(`[脱力]の影響で与ダメージが30%減少した（${finalDamage}ダメージ）。`, 'debuff');
    }

    // ダメージ適用
    setEnemy(prev => {
      const nextHp = Math.max(prev.hp - finalDamage, 0);
      return { ...prev, hp: nextHp };
    });

    addLog(`${enemy.name}に ${finalDamage} のダメージを与えた！`, 'enemy_damage');

    // 次のフェーズへ進む
    setTimeout(() => {
      setPhase('ENEMY_TURN');
    }, 1000);
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

        // 敵の攻撃ダメージ計算: 敵の基本攻撃威力 ± 20% (小数点切り捨て)
        const variance = Math.floor(enemy.baseAtk * 0.2);
        const minDmg = enemy.baseAtk - variance;
        const maxDmg = enemy.baseAtk + variance;
        let rawEnemyDmg = Math.floor(minDmg + Math.random() * (maxDmg - minDmg + 1));

        addLog(`${enemy.name}の攻撃！ 威力: ${rawEnemyDmg}`, 'enemy_info');

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
        if (selectedAction === 'EVADE' && !isFailed) {
          finalPlayerDmg = 0;
          isHit = false;
          addLog(`華麗に回避！ 敵の攻撃を完全に受け流した！`, 'player_info');
        } else if (selectedAction === 'EVADE' && isFailed) {
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
            const reductionRate = typedCharactersCount * ratePerLetter;
            const percentage = Math.floor(reductionRate * 100);

            addLog(`盾を構えた！ 軽減率: ${percentage}% (文字数: ${typedCharactersCount}文字)`, 'player_info');

            if (reductionRate >= 1.0) {
              // 100%超過時: 攻撃は的中していないものとする、カウンターダメージ発動
              isHit = false;
              finalPlayerDmg = 0;
              addLog(`完璧な受け流し！ 敵の攻撃を防ぎきった！`, 'player_info');

              // カウンター計算
              const requiredCount = enemy.type === 'GOLEM' ? 25 : 20;
              const excessLetters = Math.max(typedCharactersCount - requiredCount, 0);
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

        // ターン終了フェーズへ
        setTimeout(() => {
          setPhase('TURN_END');
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
        {/* ひらがなお題 */}
        <div className="text-3xl font-black text-white tracking-wide mb-6 animate-pulse select-none" id="target-hiragana">
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl w-full mx-auto p-4 items-start" id="battle-screen-container">
      
      {/* 左コラム: キャラクターのステータス & タイピングUI (8/12幅) */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* 敵とプレイヤーのヘルスバー */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* プレイヤー情報 */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl" id="player-status-card">
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
              <div className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <span>基本攻撃威力 {player.baseAtk}</span>
              </div>

              {player.buffs.concentration > 0 && (
                <div className="px-2 py-0.5 bg-blue-900/50 text-blue-300 border border-blue-700/50 rounded font-semibold flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>[集中] {player.buffs.concentration}</span>
                </div>
              )}

              {player.debuffs.overwhelmed > 0 && (
                <div className="px-2 py-0.5 bg-red-900/50 text-red-300 border border-red-700/50 rounded font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                  <span>[圧倒] {player.debuffs.overwhelmed}</span>
                </div>
              )}

              {player.debuffs.weakened > 0 && (
                <div className="px-2 py-0.5 bg-yellow-900/50 text-yellow-300 border border-yellow-700/50 rounded font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>[脱力] {player.debuffs.weakened}</span>
                </div>
              )}

              {player.debuffs.poison > 0 && (
                <div className="px-2 py-0.5 bg-red-900/50 text-red-300 border border-red-700/50 rounded font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>[毒] {player.debuffs.poison}</span>
                </div>
              )}

              {player.debuffs.deadlyPoison && (
                <div className="px-2 py-0.5 bg-orange-900/50 text-orange-300 border border-orange-700/50 rounded font-semibold flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>[猛毒]</span>
                </div>
              )}
            </div>
          </div>

          {/* 敵情報 */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl" id="enemy-status-card">
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

            <div className="mt-3 text-xs font-mono text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded border border-slate-800/50">
              <div className="font-bold text-red-500 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>パッシブ：{enemy.passiveName}</span>
              </div>
              <div>{enemy.passiveDesc}</div>
            </div>

            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 rounded font-semibold">
                攻撃威力: {enemy.baseAtk}
              </span>
              {enemy.buffs.concentration > 0 && (
                <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 border border-blue-700/50 rounded font-semibold">
                  集中: {enemy.buffs.concentration}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* メインタイピング作業ステージ */}
        <div className="p-8 bg-slate-900/30 border border-slate-800 rounded-3xl relative min-h-[300px] flex flex-col justify-between overflow-hidden shadow-xl" id="typing-stage">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#64748b 1px, transparent 1px)", backgroundSize: "32px 32px" }}></div>
          
          {/* 上部: タイマー ＆ フェーズ案内 */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <span className="px-3 py-1 bg-slate-950 rounded-lg text-xs font-mono text-red-500 uppercase tracking-widest border border-slate-800">
              {phase === 'SELECT_ACTION' ? 'ACTION SELECT' : phase === 'TYPING_ACTION' ? 'TYPING NOW!' : 'SYSTEM PROCESS'}
            </span>
            
            {/* 制限時間タイマー */}
            {(phase === 'SELECT_ACTION' || phase === 'TYPING_ACTION') && (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono text-red-500 font-bold">{timeLeft.toFixed(1)}s</span>
                <div className="w-24 bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden">
                  <motion.div
                    className="bg-red-600 h-full shadow-[0_0_8px_rgba(220,38,38,0.5)]"
                    animate={{ width: `${timerPercentage}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
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
          <div className="mt-8 pt-4 border-t border-slate-800/50 flex items-center justify-between text-xs text-slate-500 font-sans relative z-10">
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
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl h-[310px] flex flex-col justify-between" id="battle-log-card">
          <div className="text-sm font-sans font-extrabold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>戦闘ログ</span>
            <span className="text-xs text-slate-500 font-mono">Turn {turn}</span>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-2 max-h-[235px] text-xs font-sans text-left scrollbar-thin scrollbar-thumb-slate-800">
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
            <div ref={logEndRef} />
          </div>
        </div>

        {/* 右側：バフ・デバフ解説カード (デザインHTMLより) */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-xs" id="status-definitions-card">
          <div className="text-slate-400 font-bold mb-2 uppercase tracking-tighter">Status Definitions</div>
          <div className="space-y-3">
            <div>
              <div className="text-blue-400 font-bold underline mb-1">[集中]</div>
              <p className="text-[10px] text-slate-500 leading-normal">与ダメージ1.5倍に。発動時、数値を半減。</p>
            </div>
            <div>
              <div className="text-red-400 font-bold underline mb-1">[圧倒]</div>
              <p className="text-[10px] text-slate-500 leading-normal">制限時間が25%減少。ターン終了時に数値-1。</p>
            </div>
            <div>
              <div className="text-orange-400 font-bold underline mb-1">[猛毒]</div>
              <p className="text-[10px] text-slate-500 leading-normal">ターン終了時に最大体力の8%ダメージ。戦闘終了まで持続。</p>
            </div>
          </div>
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
    default:
      return <span className="text-xl">👾</span>;
  }
}
