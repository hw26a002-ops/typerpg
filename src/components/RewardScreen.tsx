import { motion } from 'motion/react';
import { ShieldAlert, Zap, Compass, Heart, Sparkles, ChevronRight } from 'lucide-react';
import { PlayerStatus } from '../types';

interface RewardScreenProps {
  floor: number;
  player: PlayerStatus;
  onSelectReward: (rewardIndex: number) => void;
}

export default function RewardScreen({ floor, player, onSelectReward }: RewardScreenProps) {
  const healAmount = Math.floor(player.maxHp * 0.2);
  const currentConcentrationText = player.concentrationGenLevel > 0 
    ? `（現在：毎ターン開始時に [集中] ${player.concentrationGenLevel} 獲得）` 
    : '（未取得）';

  const rewards = [
    {
      title: "剛腕のルーン",
      desc: "基本攻撃威力 +1 ＆ 攻撃コマンドのタイピング制限時間 -10%",
      subDesc: "より鋭く、強力な一撃を叩き込むための攻撃的強化。",
      icon: Zap,
      color: "from-red-950/20 to-slate-900/40 hover:border-red-500/40 border-slate-800 text-red-400",
    },
    {
      title: "疾風のルーン",
      desc: "全タイピング制限時間 5% 増加",
      subDesc: "すべての行動に余裕を持たせ、じっくりとタイプできるようにする。",
      icon: Compass,
      color: "from-blue-950/20 to-slate-900/40 hover:border-blue-500/40 border-slate-800 text-blue-400",
    },
    {
      title: "明鏡止水のルーン",
      desc: "毎ターン開始時に [集中] +1 を得る",
      subDesc: `攻撃的中時に確率でダメージを1.2倍にする「集中」を自動生成する。重なるとさらに強力に！ ${currentConcentrationText}`,
      icon: Sparkles,
      color: "from-emerald-950/20 to-slate-900/40 hover:border-emerald-500/40 border-slate-800 text-emerald-400",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8" id="reward-screen-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full text-center"
      >
        <span className="px-3 py-1 text-xs font-mono tracking-wider text-emerald-400 uppercase bg-emerald-500/10 rounded-full border border-emerald-500/20">
          STAGE {floor} CLEAR!
        </span>

        <h2 className="mt-4 font-sans text-3xl font-extrabold text-slate-100">
          深淵からの報酬
        </h2>
        
        <p className="mt-2 text-slate-400 text-sm">
          ダンジョンの魔力を吸収し、基礎能力が向上します。
        </p>

        {/* 回復演出 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-center justify-center gap-3 text-emerald-400 max-w-sm mx-auto shadow-[0_0_12px_rgba(16,185,129,0.15)]"
        >
          <Heart className="w-5 h-5 fill-current animate-pulse" />
          <span className="text-sm font-semibold">
            クリアボーナス：体力が 20%（+{healAmount} HP）回復しました！
          </span>
        </motion.div>

        <div className="mt-8 space-y-4">
          {rewards.map((reward, idx) => {
            const Icon = reward.icon;
            return (
              <motion.button
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                onClick={() => onSelectReward(idx)}
                className={`w-full p-5 text-left bg-gradient-to-r rounded-xl border-2 transition-all duration-300 transform hover:-translate-y-0.5 flex items-start gap-4 cursor-pointer ${reward.color}`}
              >
                <div className="p-3 rounded-lg bg-slate-950 mt-1">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold text-lg text-slate-100">
                      {reward.title}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-100" />
                  </div>
                  <p className="mt-1 font-sans text-sm font-semibold text-slate-200">
                    {reward.desc}
                  </p>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    {reward.subDesc}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
