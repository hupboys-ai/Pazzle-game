
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCcw, Trophy, ArrowRight, Lightbulb, 
  Star, Loader2, Home, Volume2, VolumeX, 
  Play, FastForward, Settings, Share2, Award,
  ShieldCheck, Smartphone
} from 'lucide-react';
import { generateDrawingLevel, generateProceduralFallback } from './services/geminiService.ts';
import { DrawingLevel, GameState } from './types.ts';

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
    connect: () => playTone(1350, 'sine', 0.05, 0.03),
    error: () => playTone(160, 'sawtooth', 0.15, 0.04),
    win: () => { [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.4, 0.04), i * 85)); },
    click: () => playTone(850, 'sine', 0.03, 0.02),
    reward: () => playTone(1600, 'triangle', 0.4, 0.05)
  };
};

const BannerAd: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-[60px] bg-zinc-950/80 border border-white/5 flex items-center justify-between px-6 rounded-2xl overflow-hidden backdrop-blur-2xl mb-2 relative">
      {!isLoaded ? (
        <div className="absolute inset-0 ad-shimmer flex items-center justify-center">
          <span className="text-[8px] font-black text-white/5 uppercase tracking-[0.4em]">Requesting Ad...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Smartphone size={16} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-white tracking-widest leading-none flex items-center gap-1">
                AdMob Live <ShieldCheck size={8} className="text-indigo-400" />
              </span>
              <span className="text-[7px] text-zinc-600 font-bold uppercase">ca-app-pub-8223244910</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-[7px] bg-white text-black px-1.5 py-0.5 rounded-sm font-black uppercase">AD</div>
          </div>
        </>
      )}
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
  const [adState, setAdState] = useState<'IDLE' | 'LOADING' | 'PLAYING'>('IDLE');
  const [adTimer, setAdTimer] = useState(2);
  
  const levelQueue = useRef<Map<number, DrawingLevel>>(new Map());
  const audio = useRef<ReturnType<typeof createAudioSystem> | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const colors = ['#00F2FF', '#FF00FF', '#39FF14', '#FFD700', '#FF3131', '#7DF9FF', '#AAFF00'];
  const themeColor = colors[(levelNumber - 1) % colors.length];

  useEffect(() => { 
    audio.current = createAudioSystem(); 
    const firstLvl = generateProceduralFallback(1);
    levelQueue.current.set(1, firstLvl);
    setLevel(firstLvl);
    for(let i = 2; i <= 8; i++) prefetch(i);
  }, []);

  const prefetch = useCallback(async (n: number) => {
    if (levelQueue.current.has(n)) return;
    try {
      const lvl = await generateDrawingLevel(n);
      levelQueue.current.set(n, lvl);
    } catch (e) {
      levelQueue.current.set(n, generateProceduralFallback(n));
    }
  }, []);

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
      prefetch(n + 1);
    } else {
      setGameState('LOADING');
      generateDrawingLevel(n).then(lvl => {
        setLevel(lvl);
        setGameState('PLAYING');
      });
    }
  };

  const triggerRewardedAd = (callback: () => void) => {
    setAdState('LOADING');
    playSfx('click');
    setTimeout(() => {
      setAdState('PLAYING');
      setAdTimer(2);
      const itv = setInterval(() => {
        setAdTimer(t => {
          if (t <= 1) { clearInterval(itv); return 0; }
          return t - 1;
        });
      }, 1000);
      setTimeout(() => {
        setAdState('IDLE');
        callback();
        playSfx('reward');
      }, 2100);
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !level || currentNodeId === null || adState !== 'IDLE') return;
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    setTouchPos({ x, y });

    for (const node of level.nodes) {
      const d = Math.sqrt((node.x - x)**2 + (node.y - y)**2);
      if (d < 38 && node.id !== currentNodeId) {
        const k = [currentNodeId, node.id].sort().join('-');
        const exists = level.edges.find(ed => (ed.from === currentNodeId && ed.to === node.id) || (ed.from === node.id && ed.to === currentNodeId));
        if (exists && !usedEdges.has(k)) {
          setUsedEdges(new Set(usedEdges).add(k));
          setCurrentNodeId(node.id);
          playSfx('connect');
          if (usedEdges.size + 1 === level.edges.length) {
            setTimeout(() => { setGameState('WIN'); playSfx('win'); }, 50);
          }
          break;
        }
      }
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && level && usedEdges.size < level.edges.length) {
      setShake(true); playSfx('error'); setTimeout(() => setShake(false), 200);
      setUsedEdges(new Set()); setCurrentNodeId(null);
    }
    setIsDrawing(false);
  };

  if (gameState === 'MENU') {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-between p-10 safe-area-inset">
        <div className="pt-20 text-center">
          <h1 className="text-[100px] font-black italic tracking-tighter leading-[0.6] text-white">
            NEON<br/><span className="text-zinc-800">ONE</span>
          </h1>
          <p className="mt-8 text-zinc-800 font-black uppercase tracking-[0.4em] text-[8px]">PRO PUZZLE ENGINE v2.5</p>
        </div>
        <div className="flex flex-col items-center gap-6 w-full max-w-[320px]">
          <button onClick={() => { playSfx('click'); startLevel(levelNumber); }} 
                  className="w-full bg-white text-black py-8 rounded-[3rem] font-black text-5xl active:scale-95 transition-all flex items-center justify-center gap-6">
            PLAY <Play fill="black" size={40}/>
          </button>
          <div className="flex gap-4 w-full">
            <button onClick={() => { setMuted(!muted); playSfx('click'); }} className="flex-1 bg-zinc-900 border border-white/5 p-5 rounded-2xl flex justify-center text-white active:scale-90">
              {muted ? <VolumeX size={28} /> : <Volume2 size={28} />}
            </button>
            <button className="flex-1 bg-zinc-900 border border-white/5 p-5 rounded-2xl flex justify-center text-white active:scale-90">
              <Settings size={28} />
            </button>
          </div>
        </div>
        <BannerAd />
      </div>
    );
  }

  if (gameState === 'LOADING') {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin opacity-10 mb-4" />
        <p className="text-zinc-800 font-black tracking-[0.4em] text-[9px] uppercase">Generating Intelligence...</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-black flex flex-col items-center justify-between safe-area-inset pb-6 transition-all duration-300 ${shake ? 'bg-rose-950/10' : ''}`}>
      {adState !== 'IDLE' && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950 flex flex-col items-center justify-center p-12 text-center">
           <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-white/5 flex flex-col items-center backdrop-blur-3xl">
             <Award className="text-yellow-400 mb-6 animate-bounce" size={60} />
             <h2 className="text-2xl font-black italic uppercase text-white tracking-widest mb-1">REWARD AD</h2>
             <p className="text-zinc-700 text-[8px] font-black tracking-[0.3em] mb-10 uppercase">ca-app-pub-9049225512</p>
             <div className="w-56 h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-5">
                <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${((2-adTimer)/2)*100}%` }}></div>
             </div>
             <p className="text-white/30 text-[9px] font-black uppercase tracking-tighter">Wait: {adTimer}s</p>
           </div>
        </div>
      )}

      <div className="w-full px-8 pt-8 flex justify-between items-center">
        <button onClick={() => { playSfx('click'); setGameState('MENU'); }} className="p-3 bg-zinc-900 rounded-xl border border-white/5 text-white active:scale-90"><Home size={22}/></button>
        <div className="bg-zinc-900/80 px-6 py-2 rounded-full border border-white/5 flex items-center gap-2">
          <Star className="text-yellow-400 fill-yellow-400" size={14}/>
          <span className="text-white font-black text-xl italic tracking-tighter">LVL {levelNumber}</span>
        </div>
        <button onClick={() => { setUsedEdges(new Set()); setCurrentNodeId(null); playSfx('click'); }} className="p-3 bg-zinc-900 rounded-xl border border-white/5 text-white active:rotate-180 transition-transform duration-300">
          <RotateCcw size={22}/></button>
      </div>

      <div ref={container} className="relative bg-[#040404] rounded-[4rem] border border-white/5"
           style={{ width: 'min(90vw, 360px)', height: 'min(90vw, 360px)' }}
           onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <svg width="100%" height="100%" viewBox="0 0 400 400" className="overflow-visible z-20 pointer-events-none">
          {level?.edges.map((e, i) => {
            const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
            return <line key={`bg-${i}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="#0f0f11" strokeWidth="24" strokeLinecap="round" />;
          })}
          {level?.edges.map((e, i) => {
            const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
            const isUsed = usedEdges.has([e.from, e.to].sort().join('-'));
            return isUsed && (
              <line key={`fg-${i}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={themeColor} strokeWidth="24" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${themeColor})` }} />
            );
          })}
          {isDrawing && currentNodeId !== null && (
            <line x1={level?.nodes.find(n => n.id === currentNodeId)?.x} y1={level?.nodes.find(n => n.id === currentNodeId)?.y} x2={touchPos.x} y2={touchPos.y} stroke={`${themeColor}22`} strokeWidth="14" strokeDasharray="12,12" strokeLinecap="round" />
          )}
          {level?.nodes.map(n => {
            const isActive = currentNodeId === n.id;
            return <circle key={n.id} cx={n.x} cy={n.y} r="18" fill={isActive ? "white" : "#050505"} stroke={isActive ? themeColor : "#151518"} strokeWidth="5" className="transition-all duration-200" />;
          })}
        </svg>
        <div className="absolute inset-0 z-30 pointer-events-none">
          {level?.nodes.map(n => (
            <div key={n.id} className="absolute w-40 h-40 -translate-x-1/2 -translate-y-1/2 pointer-events-auto" 
                 style={{ left: `${(n.x/400)*100}%`, top: `${(n.y/400)*100}%` }} 
                 onPointerDown={(e) => { e.stopPropagation(); setIsDrawing(true); setCurrentNodeId(n.id); playSfx('click'); }} />
          ))}
        </div>
      </div>

      <div className="w-full px-8 flex flex-col gap-3 max-w-[400px]">
        <div className="flex gap-3">
          <button onClick={() => triggerRewardedAd(() => {})} className="flex-1 bg-zinc-900/50 py-5 rounded-2xl flex items-center justify-center gap-2 text-white font-black text-[10px] tracking-widest border border-white/5 active:scale-95">
            <Lightbulb size={20} className="text-yellow-400" /> HINT
          </button>
          <button onClick={() => triggerRewardedAd(() => setGameState('WIN'))} className="flex-1 bg-zinc-900/50 py-5 rounded-2xl flex items-center justify-center gap-2 text-white font-black text-[10px] tracking-widest border border-white/5 active:scale-95">
            <FastForward size={20} className="text-rose-500" /> SKIP
          </button>
        </div>
        <BannerAd />
      </div>

      {gameState === 'WIN' && (
        <div className="fixed inset-0 z-[11000] bg-black/98 flex items-center justify-center p-10 backdrop-blur-3xl animate-in zoom-in duration-300">
          <div className="text-center w-full max-w-sm">
            <Trophy size={120} className="mx-auto text-yellow-400 animate-bounce mb-6" />
            <h2 className="text-[90px] font-black italic text-white tracking-tighter mb-4 leading-[0.6] uppercase">IQ<br/><span className="text-yellow-400">BOOST</span></h2>
            <div className="flex flex-col gap-4 mt-10">
              <button onClick={() => { setLevelNumber(n => n + 1); startLevel(levelNumber + 1); playSfx('click'); }} 
                      className="w-full bg-white text-black py-7 rounded-[3rem] text-3xl font-black flex items-center justify-center gap-5 active:scale-90 transition-all">
                NEXT <ArrowRight size={38} strokeWidth={5} />
              </button>
              <button onClick={() => { if(navigator.share) navigator.share({ title: 'Neon One', text: `Level ${levelNumber} is easy! Can you win?`, url: window.location.href }); }} 
                      className="w-full bg-zinc-900/20 text-white py-5 rounded-2xl font-black uppercase text-[9px] tracking-widest border border-white/5 flex items-center justify-center gap-2 active:scale-95">
                <Share2 size={20} /> SHARE CHALLENGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
