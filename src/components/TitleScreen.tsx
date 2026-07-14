import { motion } from 'motion/react';
import { Play, BookOpen } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 text-center" id="title-screen-container">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl w-full"
      >
        <span className="px-4 py-1.5 text-xs font-mono tracking-wider text-red-400 uppercase bg-red-950/40 rounded-full border border-red-900/30 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
          ターン制タイピングRPG
        </span>
        
        <h1 className="mt-6 font-sans text-5xl md:text-6xl font-black tracking-widest text-slate-100 uppercase" id="game-title">
          タイピングダンジョン
        </h1>
        
        <p className="mt-4 text-slate-400 font-sans text-base max-w-lg mx-auto leading-relaxed">
          1層から10層までのダンジョンをタイピングの力で切り開き、最深部で待つ「影の決闘者」を討て。
        </p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-10 mb-8 p-6 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-sm text-left max-w-xl mx-auto"
        >
          <div className="flex items-center gap-2 mb-4 text-red-400 font-bold border-b border-slate-800 pb-2">
            <BookOpen className="w-5 h-5" />
            <span>基本ルール & コマンド</span>
          </div>

          <div className="space-y-4 text-sm text-slate-300 font-sans">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-slate-800 text-slate-300 font-mono mt-0.5 text-xs border border-slate-700">攻撃</div>
              <div>
                <p className="font-semibold text-slate-200">簡単な単語（制限時間 7秒）</p>
                <p className="text-xs text-slate-400">成功で「文字数 + 自身の攻撃力」のダメージを与える。</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-red-950/40 text-red-400 border border-red-900/30 font-mono mt-0.5 text-xs">強攻撃</div>
              <div>
                <p className="font-semibold text-slate-200">少し長めの文章（制限時間 15秒 / ノーミス必須）</p>
                <p className="text-xs text-slate-400">1文字でもミスすると失敗。成功で「(文字数 + 自身の攻撃力) × 1.5」の特大ダメージ（魔法属性扱い）。</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-blue-950/40 text-blue-400 border border-blue-900/30 font-mono mt-0.5 text-xs">防御</div>
              <div>
                <p className="font-semibold text-slate-200">長めの文章（制限時間 15秒）</p>
                <p className="text-xs text-slate-400">「打ち込んだ文字数 × 5%」ダメージ軽減。100%を超過すると無効化し、超過分に応じた強力なカウンターをお見舞いする！</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 font-mono mt-0.5 text-xs">回避</div>
              <div>
                <p className="font-semibold text-slate-200">短めの文章（制限時間 5秒 / ノーミス必須）</p>
                <p className="text-xs text-slate-400">1文字でもミスすると失敗。成功で敵のどんな大技もノーダメージで回避する。</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onStart}
            className="group relative flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold font-sans rounded-xl transition duration-300 shadow-[0_0_25px_rgba(220,38,38,0.3)] hover:shadow-[0_0_35px_rgba(220,38,38,0.5)] transform hover:-translate-y-0.5"
            id="start-game-btn"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>挑戦を開始する</span>
            <span className="absolute -inset-0.5 rounded-xl bg-red-500 opacity-0 group-hover:opacity-20 blur-sm transition duration-300"></span>
          </button>
          
          <span className="text-xs text-slate-500 font-mono">
            ※ ローマ字タイピングは、ja / zya などの様々な入力ゆらぎをサポートしています。
          </span>
        </div>
      </motion.div>
    </div>
  );
}
