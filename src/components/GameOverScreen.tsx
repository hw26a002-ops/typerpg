import { motion } from 'motion/react';
import { Skull, RotateCcw } from 'lucide-react';

interface GameOverScreenProps {
  floor: number;
  onRestart: () => void;
}

export default function GameOverScreen({ floor, onRestart }: GameOverScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8 text-center" id="gameover-screen-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full p-8 bg-slate-900/80 border border-red-900/40 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.15)] backdrop-blur-md"
      >
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="p-4 bg-red-950/40 rounded-full text-red-500 border border-red-500/20"
          >
            <Skull className="w-16 h-16" />
          </motion.div>
        </div>

        <h2 className="font-sans text-3xl font-extrabold text-red-500 tracking-tight">
          力尽きました...
        </h2>
        
        <p className="mt-4 font-sans text-slate-400">
          あなたの冒険はダンジョンの <span className="text-white font-bold">{floor}層</span> で潰えてしまいました。
        </p>

        <p className="mt-2 text-xs text-slate-500 font-mono">
          タイピングの腕を磨き、再び深淵へ挑みましょう。
        </p>

        <div className="mt-8">
          <button
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 hover:border-slate-600 transition duration-300"
            id="retry-btn"
          >
            <RotateCcw className="w-5 h-5" />
            <span>最初から挑戦する</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
