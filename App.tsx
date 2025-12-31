
import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, Trophy, ArrowRight, Lightbulb, 
  Star, Loader2, Home, Volume2, VolumeX, 
  Play, FastForward, Settings, Share2, Award, Zap
} from 'lucide-react';
import { generateDrawingLevel, generateProceduralFallback } from './services/geminiService';
import { DrawingLevel, GameState, Difficulty } from './types';

const createAudioSystem = () => {
  let ctx: AudioContext | null = null;
  const init = () => { 
    if (!ctx) {
      try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } 
      catch (e) { console.warn("Audio Context Disabled"); }
    }
  };
  const playTone = (freq: number, type: OscillatorType, duration: number, volume: number) => {
    try {
      init();
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator(); 
      const gain = ctx.createGain();
      osc.type = type; 
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };
  return {
    connect: () => playTone(1300, 'sine', 0.08, 0.04),
    error: () => playTone(160, 'sawtooth', 0.2, 0.06),
    win: () => { [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.5, 0.04), i * 100)); },
    click: () => playTone(950, 'sine', 0.05, 0.03),
    reward: () => playTone(1400, 'triangle', 0.4, 0.05)
  };
};

const AdMobBanner: React.FC = () => (
  <div className="w-full h-[65px] bg-zinc-900/40 border border-white/5 flex items-center justify-between px-6 relative overflow-hidden rounded-[2rem] backdrop-blur-lg">
    <div className="absolute top-0 left-4 bg-zinc-800 px-2 py-0.5 rounded-b text-[7px] font-black text-white/30 tracking-[0.2em]">AD</div>
    <div className="flex items-center gap-4">
      <div className="w-9 h-9 bg-gradient-to-tr from-purple-500 to-pink-600 rounded-xl flex items-center justify-center animate-pulse shadow-lg">
        <Zap className="text-white" size={18} />
      </div>
      <div className="flex flex-col">
        <span className="text-white text-[11px] font-black uppercase">Viral Reward</span>
        <span className="text-zinc-500 text-[9px] font-bold">Watch to unlock hints</span>
      </div>
    </div>
    <button className="px-5 py-2 bg-white text-black text-[10px] font-black rounded-full active:scale-95 transition-transform shadow-xl">CLAIM</button>
  </div>
);

const DifficultyTag: React.FC<{ difficulty: Difficulty }> = ({ difficulty }) => {
  const styles: Record<Difficulty, string> = {
    'EASY': 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    'MEDIUM': 'text-sky-400 border-sky-500/20 bg-sky-500/5',
    'HARD': 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    'ULTRA HARD': 'text-rose-400 border-rose-500/20 bg-rose-500/5',
    'ULTRA PRO HARD': 'text-purple-400 border-purple-500/40 bg-purple-500/10 animate-pulse'
  };
  return (
    <div className={`px-5 py-1.5 rounded-full border text-[9px] font-black tracking-[0.2em] uppercase mb-6 ${styles[difficulty]}`}>
      {difficulty}
    </div>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [level, setLevel] = useState<DrawingLevel | null>(null);
  const [levelNumber, setLevelNumber] = useState(1);
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [usedEdges, setUsedEdges] = useState<Set<string>>(new Set());
  const [isDrawing, setIsDrawing] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });
  const [shake, setShake] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isAdShowing, setIsAdShowing] = useState(false);
  const [adTimer, setAdTimer] = useState(3);
  
  // Instant Level Queue
  const levelQueue = useRef<Map<number, DrawingLevel>>(new Map());
  const audio = useRef<ReturnType<typeof createAudioSystem> | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const colors = ['#00F2FF', '#FF00FF', '#39FF14', '#FFD700', '#FF3131', '#7DF9FF', '#CCFF00'];
  const themeColor = colors[(levelNumber - 1) % colors.length];

  useEffect(() => { 
    audio.current = createAudioSystem(); 
    // Start Queue: Level 1 (Local), Level 2-5 (Background)
    levelQueue.current.set(1, generateProceduralFallback(1));
    for(let i = 2; i <= 5; i++) prefetch(i);
  }, []);

  const prefetch = async (n: number) => {
    if (levelQueue.current.has(n)) return;
    try {
      const lvl = await generateDrawingLevel(n);
      levelQueue.current.set(n, lvl);
    } catch (e) {
      levelQueue.current.set(n, generateProceduralFallback(n));
    }
  };

  const playSfx = (type: keyof ReturnType<typeof createAudioSystem>) => {
    if (!muted && audio.current) (audio.current as any)[type]();
  };

  const startLevel = (n: number) => {
    const data = levelQueue.current.get(n);
    if (data) {
      setLevel(data);
      setUsedEdges(new Set());
      setCurrentNodeId(null);
      setGameState('PLAYING');
      // Prefetch the next 3 levels whenever a level starts
      for(let i = 1; i <= 3; i++) prefetch(n + i);
    } else {
      setGameState('LOADING');
      generateDrawingLevel(n).then(lvl => {
        setLevel(lvl);
        setGameState('PLAYING');
        prefetch(n + 1);
      });
    }
  };

  const handleMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!isDrawing || !level || currentNodeId === null || isAdShowing) return;
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    const x = ((cx - rect.left) / rect.width) * 400;
    const y = ((cy - rect.top) / rect.height) * 400;
    setTouchPos({ x, y });

    const nodes = level.nodes;
    for(let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const d = Math.sqrt((node.x - x)**2 + (node.y - y)**2);
      if (d < 45 && node.id !== currentNodeId) {
        const k = [currentNodeId, node.id].sort().join('-');
        const exists = level.edges.find(ed => (ed.from === currentNodeId && ed.to === node.id) || (ed.from === node.id && ed.to === currentNodeId));
        if (exists && !usedEdges.has(k)) {
          setUsedEdges(new Set(usedEdges).add(k));
          setCurrentNodeId(node.id);
          playSfx('connect');
          if (usedEdges.size + 1 === level.edges.length) {
            setTimeout(() => { setGameState('WIN'); playSfx('win'); }, 100);
          }
        }
      }
    }
  };

  const handleUp = () => {
    if (isDrawing && level && usedEdges.size < level.edges.length) {
      setShake(true); playSfx('error'); setTimeout(() => setShake(false), 250);
      setUsedEdges(new Set()); setCurrentNodeId(null);
    }
    setIsDrawing(false);
  };

  const showAd = (callback: () => void) => {
    setAdTimer(2);
    setIsAdShowing(true);
    const itv = setInterval(() => setAdTimer(t => t - 1), 1000);
    setTimeout(() => {
      clearInterval(itv);
      setIsAdShowing(false);
      callback();
      playSfx('reward');
    }, 2200);
  };

  if (gameState === 'MENU') {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-between p-10 safe-area-inset">
        <div className="pt-24 text-center">
          <h1 className="text-[110px] font-black italic tracking-tighter leading-[0.55] text-white">
            NEON<br/><span className="text-zinc-800">ONE</span>
          </h1>
          <p className="mt-10 text-zinc-600 font-black uppercase tracking-[0.9em] text-[11px]">IQ TRAINING 2025</p>
        </div>
        <div className="flex flex-col items-center gap-6 w-full max-w-[340px]">
          <button onClick={() => { playSfx('click'); startLevel(levelNumber); }} 
                  className="w-full bg-white text-black py-10 rounded-[4rem] font-black text-6xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-6">
            PLAY <Play fill="black" size={48}/>
          </button>
          <div className="flex gap-4 w-full">
            <button onClick={() => { setMuted(!muted); playSfx('click'); }} className="flex-1 bg-zinc-900 border border-zinc-800 p-7 rounded-[2.5rem] flex justify-center text-white active:scale-90">
              {muted ? <VolumeX size={34} /> : <Volume2 size={34} />}
            </button>
            <button className="flex-1 bg-zinc-900 border border-zinc-800 p-7 rounded-[2.5rem] flex justify-center text-white active:scale-90">
              <Settings size={34} />
            </button>
          </div>
        </div>
        <AdMobBanner />
      </div>
    );
  }

  if (gameState === 'LOADING') {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-white animate-spin opacity-25 mb-6" strokeWidth={5} />
        <p className="text-zinc-600 font-black tracking-[0.8em] text-[9px] uppercase">READYING ENGINE</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-black flex flex-col items-center justify-between safe-area-inset pb-6 transition-all duration-300 ${shake ? 'bg-red-950/20' : ''}`}>
      {isAdShowing && (
        <div className="fixed inset-0 z-[1000] bg-black/98 flex flex-col items-center justify-center p-12 text-center backdrop-blur-2xl animate-in fade-in duration-200">
          <Award className="text-white mb-6 animate-bounce" size={80} />
          <h2 className="text-2xl font-black italic uppercase mb-6 text-white tracking-widest leading-none">REWARDING</h2>
          <div className="w-full max-w-xs h-1.5 bg-zinc-900 rounded-full overflow-hidden">
             <div className="h-full bg-white transition-all duration-1000" style={{ width: `${(2-adTimer)/2*100}%` }}></div>
          </div>
        </div>
      )}

      <div className="w-full px-8 pt-8 flex justify-between items-center z-50">
        <button onClick={() => { playSfx('click'); setGameState('MENU'); }} className="p-4 bg-zinc-900 rounded-[2rem] border border-zinc-800 text-white active:scale-90 shadow-lg"><Home size={26}/></button>
        <div className="bg-zinc-900/95 px-8 py-3 rounded-full border border-zinc-800 flex items-center gap-3">
          <Star className="text-yellow-400 fill-yellow-400" size={20}/>
          <span className="text-white font-black text-2xl italic tracking-tighter">LVL {levelNumber}</span>
        </div>
        <button onClick={() => { setUsedEdges(new Set()); setCurrentNodeId(null); playSfx('click'); }} className="p-4 bg-zinc-900 rounded-[2rem] border border-zinc-800 text-white active:rotate-180 transition-all duration-500 shadow-lg">
          <RotateCcw size={26}/>
        </button>
      </div>

      <div className="flex flex-col items-center w-full px-6">
        {level && <DifficultyTag difficulty={level.difficulty} />}
        
        <div ref={container} className={`relative bg-[#050505] rounded-[5.5rem] border-2 border-zinc-900 transition-all duration-300 ${gameState === 'WIN' ? 'win-anim' : ''}`}
             style={{ width: 'min(92vw, 400px)', height: 'min(92vw, 400px)', boxShadow: isDrawing ? `0 0 100px ${themeColor}10` : 'none' }}
             onPointerMove={handleMove} onPointerUp={handleUp}>
          <svg width="100%" height="100%" viewBox="0 0 400 400" className="overflow-visible relative z-20 pointer-events-none">
            {level?.edges.map((e, i) => {
              const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
              return <line key={`bg-${i}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="#18181b" strokeWidth="24" strokeLinecap="round" />;
            })}
            {level?.edges.map((e, i) => {
              const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
              const isUsed = usedEdges.has([e.from, e.to].sort().join('-'));
              return isUsed && (
                <React.Fragment key={i}>
                  <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={themeColor} strokeWidth="32" strokeLinecap="round" opacity="0.15" />
                  <line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={themeColor} strokeWidth="22" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 12px ${themeColor})` }} />
                </React.Fragment>
              );
            })}
            {isDrawing && currentNodeId !== null && (
              <line x1={level?.nodes.find(n => n.id === currentNodeId)?.x} y1={level?.nodes.find(n => n.id === currentNodeId)?.y} x2={touchPos.x} y2={touchPos.y} stroke={`${themeColor}88`} strokeWidth="10" strokeDasharray="12,10" strokeLinecap="round" />
            )}
            {level?.nodes.map(n => {
              const isActive = currentNodeId === n.id;
              return (
                <g key={n.id}>
                  <circle cx={n.x} cy={n.y} r="20" fill={isActive ? "white" : "#0c0c0c"} stroke={isActive ? themeColor : "#2a2a2e"} strokeWidth="6" className="transition-all duration-200" />
                  {isActive && <circle cx={n.x} cy={n.y} r="50" fill={`${themeColor}10`} className="animate-ping" />}
                </g>
              );
            })}
          </svg>
          <div className="absolute inset-0 z-30 pointer-events-none">
            {level?.nodes.map(n => (
              <div key={n.id} className="absolute w-44 h-44 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer" 
                   style={{ left: `${(n.x/400)*100}%`, top: `${(n.y/400)*100}%` }} 
                   onPointerDown={(e) => { e.stopPropagation(); setIsDrawing(true); setCurrentNodeId(n.id); playSfx('click'); }} />
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-8 flex flex-col gap-4 max-w-[440px] z-50">
        <div className="flex gap-4">
          <button onClick={() => showAd(() => {})} className="flex-1 bg-zinc-900 py-6 rounded-[2rem] flex items-center justify-center gap-3 text-white font-black text-[12px] tracking-widest border border-zinc-800 active:scale-95 shadow-lg">
            <Lightbulb size={24} className="text-yellow-400" /> HINT
          </button>
          <button onClick={() => showAd(() => setGameState('WIN'))} className="flex-1 bg-zinc-900 py-6 rounded-[2rem] flex items-center justify-center gap-3 text-white font-black text-[12px] tracking-widest border border-zinc-800 active:scale-95 shadow-lg">
            <FastForward size={24} className="text-rose-500" /> SKIP
          </button>
        </div>
        <AdMobBanner />
      </div>

      {gameState === 'WIN' && (
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-10 animate-in zoom-in duration-200 backdrop-blur-3xl">
          <div className="text-center w-full max-w-sm">
            <Trophy size={140} className="mx-auto text-yellow-400 animate-bounce mb-8 drop-shadow-[0_0_50px_rgba(250,204,21,0.2)]" />
            <h2 className="text-[100px] font-black italic text-white tracking-tighter mb-4 uppercase leading-[0.6]">IQ<br/><span className="text-yellow-400">BOSS</span></h2>
            <p className="text-zinc-600 font-bold tracking-[0.4em] text-[11px] mb-12 uppercase">LEVEL {levelNumber} DONE</p>
            <div className="flex flex-col gap-5">
              <button onClick={() => { setLevelNumber(n => n + 1); startLevel(levelNumber + 1); playSfx('click'); }} 
                      className="w-full bg-white text-black py-9 rounded-[4.5rem] text-4xl font-black flex items-center justify-center gap-6 active:scale-90 shadow-2xl">
                NEXT <ArrowRight size={44} strokeWidth={5} />
              </button>
              <button onClick={() => { if(navigator.share) navigator.share({ title: 'Neon One', text: `Cleared level ${levelNumber}!`, url: window.location.href }); }} 
                      className="w-full bg-zinc-900/50 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest border border-zinc-800 active:scale-95 flex items-center justify-center gap-3">
                <Share2 size={20} /> SHARE PERFORMANCE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
