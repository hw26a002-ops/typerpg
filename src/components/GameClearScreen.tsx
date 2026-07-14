import { motion } from 'motion/react';
import { Trophy, RefreshCw, Star, Zap, Eye, Clock } from 'lucide-react';
import { PlayerStatus } from '../types';

interface GameClearScreenProps {
  player: PlayerStatus;
  onRestart: () => void;
}

export default function GameClearScreen({ player, onRestart }: GameClearScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 text-center" id="gameclear-screen-container">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-xl w-full p-8 bg-gradient-to-b from-red-950/20 to-slate-900/90 border border-red-900/40 rounded-3xl shadow-[0_0_30px_rgba(220,38,38,0.15)] backdrop-blur-md relative overflow-hidden"
      >
        {/* 背景の光り物 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-red-500/10 rounded-full blur-3xl -z-10" />

        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.8, times: [0, 0.6, 1] }}
            className="p-5 bg-red-600 text-white rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.4)]"
          >
            <Trophy className="w-16 h-16 animate-bounce" />
          </motion.div>
        </div>

        <h2 className="font-sans text-4xl font-black text-red-400 tracking-widest uppercase">
          ダンジョン完全制覇！
        </h2>
        
        <p className="mt-4 font-sans text-slate-200 text-lg font-medium leading-relaxed">
          おめでとうございます！<br />
          タイピングの試練を乗り越え、影の決闘者を討ち倒しました！
        </p>

        <p className="mt-2 text-sm text-slate-400">
          あなたのタイピング技術と英断は、歴史に語り継がれるでしょう。
        </p>

        {/* 最終ステータスの表示 */}
        <div className="mt-8 p-6 bg-slate-950/50 rounded-2xl border border-slate-800 text-left space-y-3">
          <div className="text-xs font-mono tracking-wider text-red-400 uppercase font-bold border-b border-slate-800 pb-2 mb-3">
            【最終的なあなたの力】
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm font-sans text-slate-300">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-400" />
              <span>基本攻撃威力: <strong className="text-white">{player.baseAtk}</strong></span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>全制限時間増加: <strong className="text-white">+{player.allLimitIncreaseLevel * 5}%</strong></span>
            </div>

            <div className="flex items-center gap-2 col-span-2">
              <Star className="w-4 h-4 text-emerald-400" />
              <span>毎ターン[集中]獲得: <strong className="text-white">+{player.concentrationGenLevel}</strong></span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <button
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition duration-300 shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]"
            id="play-again-btn"
          >
            <RefreshCw className="w-5 h-5" />
            <span>もう一度挑戦する</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
