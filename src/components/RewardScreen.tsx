import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Zap, Compass, Heart, Sparkles, ChevronRight, Eye, Swords, Flame } from 'lucide-react';
import { PlayerStatus } from '../types';

interface RewardScreenProps {
  floor: number;
  player: PlayerStatus;
  onSelectReward: (rewardIndex: number, passive?: 'FORESEE' | 'DUEL' | 'KILLER') => void;
}

export default function RewardScreen({ floor, player, onSelectReward }: RewardScreenProps) {
  const currentConcentrationText = player.concentrationGenLevel > 0 
    ? `（現在：毎ターン開始時に [集中] ${player.concentrationGenLevel} 獲得）` 
    : '（未取得）';

  const [randomPassive] = useState<'FORESEE' | 'DUEL' | 'KILLER'>(() => {
    const passives: ('FORESEE' | 'DUEL' | 'KILLER')[] = ['FORESEE', 'DUEL', 'KILLER'];
    return passives[Math.floor(Math.random() * passives.length)];
  });

  const passiveTemplates = {
    FORESEE: {
      title: "予知のルーン",
      desc: "パッシブ【予知】を習得：戦闘開始時に「未来予知」5を得る。被攻撃時に「未来予知」があるなら自動的に回避を試みる。",
      subDesc: `未来を予見し、敵の攻撃を紙一重でかわす秘術。${player.passive ? `※現在のパッシブ「${player.passive === 'FORESEE' ? '予知' : player.passive === 'DUEL' ? '決闘' : '殺手'}」は上書きされます。` : ''}`,
      icon: Eye,
      color: "from-indigo-950/20 to-slate-900/40 hover:border-indigo-500/40 border-slate-800 text-indigo-400",
    },
    DUEL: {
      title: "決闘のルーン",
      desc: "パッシブ【決闘宣布】を習得：回避成功ターン終了時に[集中]5を得て次ターンクリティカル倍率2倍。防御ターン被弾時に自身に[脱力]2付与。",
      subDesc: `攻撃を華麗にいなし、隙だらけの敵に強力なカウンターを叩き込む。${player.passive ? `※現在のパッシブ「${player.passive === 'FORESEE' ? '予知' : player.passive === 'DUEL' ? '決闘' : '殺手'}」は上書きされます。` : ''}`,
      icon: Swords,
      color: "from-amber-950/20 to-slate-900/40 hover:border-amber-500/40 border-slate-800 text-amber-400",
    },
    KILLER: {
      title: "肉斬骨断のルーン",
      desc: "パッシブ【殺手】を習得：強攻撃が必ず後攻になるが、そのターンに受けたダメージの1.5倍を強攻撃威力に加算して反撃する。",
      subDesc: `あえて肉を切らせて骨を断つ、狂気と破壊の超攻撃的パッシブ。${player.passive ? `※現在のパッシブ「${player.passive === 'FORESEE' ? '予知' : player.passive === 'DUEL' ? '決闘' : '殺手'}」は上書きされます。` : ''}`,
      icon: Flame,
      color: "from-rose-950/20 to-slate-900/40 hover:border-rose-500/40 border-slate-800 text-rose-400",
    },
  };

  const selectedPassive = passiveTemplates[randomPassive];

  const rewards = [
    {
      title: "剛腕のルーン",
      desc: "基本攻撃威力 +3 ＆ 攻撃コマンドのタイピング制限時間 -10%",
      subDesc: "より鋭く、強力な一撃を叩き込むための攻撃的強化。",
      icon: Zap,
      color: "from-red-950/20 to-slate-900/40 hover:border-red-500/40 border-slate-800 text-red-400",
    },
    {
      title: "疾風のルーン",
      desc: "全タイピング制限時間 15% 増加",
      subDesc: "すべての行動に余裕を持たせ、じっくりとタイプできるようにする。",
      icon: Compass,
      color: "from-blue-950/20 to-slate-900/40 hover:border-blue-500/40 border-slate-800 text-blue-400",
    },
    {
      title: "明鏡止水のルーン",
      desc: "毎ターン開始時に [集中] +1 を得る",
      subDesc: `攻撃的中時に確率でダメージを1.5倍にする「集中」を自動生成する。重なるとさらに強力に！ ${currentConcentrationText}`,
      icon: Sparkles,
      color: "from-emerald-950/20 to-slate-900/40 hover:border-emerald-500/40 border-slate-800 text-emerald-400",
    },
    {
      title: selectedPassive.title,
      desc: selectedPassive.desc,
      subDesc: selectedPassive.subDesc,
      icon: selectedPassive.icon,
      color: selectedPassive.color,
      isPassive: true,
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-6" id="reward-screen-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full text-center"
      >
        <span className="px-3 py-1 text-xs font-mono tracking-wider text-emerald-400 uppercase bg-emerald-500/10 rounded-full border border-emerald-500/20">
          STAGE {floor} CLEAR!
        </span>

        <h2 className="mt-3 font-sans text-2xl md:text-3xl font-extrabold text-slate-100">
          深淵からの報酬
        </h2>
        
        <p className="mt-1 text-slate-400 text-xs md:text-sm">
          ダンジョンの魔力を吸収し、基礎能力が向上します。
        </p>

        {/* 回復演出 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-center justify-center gap-2.5 text-emerald-400 max-w-md mx-auto shadow-[0_0_12px_rgba(16,185,129,0.15)]"
        >
          <Heart className="w-4 h-4 fill-current animate-pulse" />
          <span className="text-xs md:text-sm font-semibold">
            クリアボーナス：体力が 100%（全回復）しました！
          </span>
        </motion.div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {rewards.map((reward, idx) => {
            const Icon = reward.icon;
            return (
              <motion.button
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.08 }}
                onClick={() => onSelectReward(idx, idx === 3 ? randomPassive : undefined)}
                className={`w-full p-4 text-left bg-gradient-to-br rounded-xl border-2 transition-all duration-300 transform hover:-translate-y-0.5 flex items-start gap-3 cursor-pointer ${reward.color}`}
              >
                <div className="p-2 rounded-lg bg-slate-950 mt-0.5 shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-sans font-bold text-base text-slate-100 flex items-center gap-2 truncate">
                      {reward.title}
                      {reward.isPassive && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-bold animate-pulse shrink-0">Passive</span>
                      )}
                    </h3>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </div>
                  <p className="mt-1 font-sans text-xs md:text-sm font-semibold text-slate-200 leading-snug">
                    {reward.desc}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
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
