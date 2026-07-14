import { useState } from 'react';
import TitleScreen from './components/TitleScreen';
import BattleScreen from './components/BattleScreen';
import RewardScreen from './components/RewardScreen';
import GameOverScreen from './components/GameOverScreen';
import GameClearScreen from './components/GameClearScreen';
import { PlayerStatus } from './types';

type ScreenType = 'TITLE' | 'BATTLE' | 'REWARD' | 'GAME_OVER' | 'GAME_CLEAR';

const getInitialPlayer = (): PlayerStatus => ({
  maxHp: 100,
  hp: 100,
  baseAtk: 1, // 基本攻撃威力：1
  buffs: {
    concentration: 0,
  },
  debuffs: {
    overwhelmed: 0,
    weakened: 0,
    poison: 0,
    deadlyPoison: false,
  },
  atkLimitReductionLevel: 0,
  allLimitIncreaseLevel: 0,
  concentrationGenLevel: 0,
});

export default function App() {
  const [screen, setScreen] = useState<ScreenType>('TITLE');
  const [floor, setFloor] = useState<number>(1);
  const [player, setPlayer] = useState<PlayerStatus>(getInitialPlayer);

  // ゲームスタート
  const handleStartGame = () => {
    setPlayer(getInitialPlayer());
    setFloor(1);
    setScreen('BATTLE');
  };

  // 戦闘勝利時
  const handleBattleWin = () => {
    if (floor === 10) {
      // 10層の影の決闘者を倒したらゲームクリア！
      setScreen('GAME_CLEAR');
    } else {
      // それ以外は報酬選択画面へ。体力回復も行う。
      setScreen('REWARD');
    }
  };

  // 報酬の選択＆適用
  const handleSelectReward = (rewardIndex: number) => {
    setPlayer(prev => {
      // 撃破後の体力100%回復 (全回復)
      const newHp = prev.maxHp;

      let baseAtk = prev.baseAtk;
      let atkLimitReductionLevel = prev.atkLimitReductionLevel;
      let allLimitIncreaseLevel = prev.allLimitIncreaseLevel;
      let concentrationGenLevel = prev.concentrationGenLevel;

      if (rewardIndex === 0) {
        // 基本攻撃威力+1、攻撃コマンドのタイピング制限時間-10%
        baseAtk += 1;
        atkLimitReductionLevel += 1;
      } else if (rewardIndex === 1) {
        // 全タイピング制限時間5%増加
        allLimitIncreaseLevel += 1;
      } else if (rewardIndex === 2) {
        // 毎ターン開始時に[集中]1を得る。複数回取得で得る数値を+1
        concentrationGenLevel += 1;
      }

      return {
        ...prev,
        hp: newHp,
        baseAtk,
        atkLimitReductionLevel,
        allLimitIncreaseLevel,
        concentrationGenLevel,
      };
    });

    // 次の層に進む
    setFloor(prev => prev + 1);
    setScreen('BATTLE');
  };

  // ゲームオーバー
  const handleBattleLose = () => {
    setScreen('GAME_OVER');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 flex flex-col justify-between" id="app-main">
      {/* ヘッダー */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0 sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-red-600 rounded rotate-45 flex items-center justify-center">
            <span className="text-white font-bold -rotate-45">TD</span>
          </div>
          <h1 className="text-xl font-bold tracking-widest text-slate-100">TYPING DUNGEON</h1>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-sm text-slate-400 font-mono tracking-tighter">
            SYSTEM: <span className="text-emerald-500 underline underline-offset-4 font-bold">ACTIVE</span>
          </div>
          {screen === 'BATTLE' && (
            <div className="bg-slate-800 px-4 py-1 rounded-full border border-slate-700 text-sm">
              <span className="text-slate-400 text-xs mr-2 uppercase">Floor</span>
              <span className="text-slate-100 font-bold">{floor} / 10</span>
            </div>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8 flex flex-col justify-center">
        {screen === 'TITLE' && (
          <TitleScreen onStart={handleStartGame} />
        )}
        
        {screen === 'BATTLE' && (
          <BattleScreen
            floor={floor}
            player={player}
            setPlayer={setPlayer}
            onWin={handleBattleWin}
            onLose={handleBattleLose}
          />
        )}
        
        {screen === 'REWARD' && (
          <RewardScreen
            floor={floor}
            player={player}
            onSelectReward={handleSelectReward}
          />
        )}
        
        {screen === 'GAME_OVER' && (
          <GameOverScreen
            floor={floor}
            onRestart={handleStartGame}
          />
        )}
        
        {screen === 'GAME_CLEAR' && (
          <GameClearScreen
            player={player}
            onRestart={handleStartGame}
          />
        )}
      </div>

      {/* フッター */}
      <footer className="py-6 border-t border-slate-800 text-center text-xs text-slate-500 font-mono">
        © 2026 Typing Dungeon. Created for Typing Warriors.
      </footer>
    </main>
  );
}
