
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCcw, Trophy, ArrowRight, Lightbulb, 
  Star, Loader2, Home, Volume2, VolumeX, 
  Play, FastForward, Settings, Share2, Award, Zap,
  ShieldCheck, Smartphone
} from 'lucide-react';
import { generateDrawingLevel, generateProceduralFallback } from './services/geminiService';
import { DrawingLevel, GameState } from './types';

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
    const timer = setTimeout(() => setIsLoaded(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-[60px] bg-zinc-950 border border-white/10 flex items-center justify-between px-6 rounded-2xl overflow-hidden backdrop-blur-xl mb-2 relative">
      {!isLoaded ? (
        <div className="absolute inset-0 ad-shimmer flex items-center justify-center">
          <span className="text-[10px] font-black text-white/10 uppercase tracking-[0.3em]">Loading Banner...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              <Smartphone size={18} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase text-white tracking-widest leading-none flex items-center gap-1">
                AdMob Live <ShieldCheck size={9} className="text-blue-400" />
              </span>
              <span className="text-[7px] text-zinc-600 font-bold tracking-tighter uppercase">ID: ...8223244910</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-[8px] bg-white text-black px-1.5 py-0.5 rounded-sm font-black uppercase mb-1">PROMOTED</div>
            <span className="text-[6px] text-zinc-800 font-black uppercase">Click for Hint</span>
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
    levelQueue.current.set(1, generateProceduralFallback(1));
    for(let i = 2; i <= 5; i++) prefetch(i);
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
      // Prefetch next 2 levels in background
      prefetch(n + 1);
      prefetch(n + 2);
    } else {
      setGameState('LOADING');
      generateDrawingLevel(n).then(lvl => {
        setLevel(lvl);
        setGameState('PLAYING');
        prefetch(n + 1);
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
    }, 600);
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
            setTimeout(() => { setGameState('WIN'); playSfx('win'); }, 40);
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
          <h1 className="text-[110px] font-black italic tracking-tighter leading-[0.55] text-white">
            NEON<br/><span className="text-zinc-800">ONE</span>
          </h1>
          <p className="mt-8 text-zinc-700 font-black uppercase tracking-[0.5em] text-[10px]">PREMIUM ENGINE 2025</p>
        </div>
        <div className="flex flex-col items-center gap-6 w-full max-w-[340px]">
          <button onClick={() => { playSfx('click'); startLevel(levelNumber); }} 
                  className="w-full bg-white text-black py-9 rounded-[3.5rem] font-black text-6xl shadow-[0_0_80px_rgba(255,255,255,0.15)] active:scale-95 transition-all flex items-center justify-center gap-6">
            PLAY <Play fill="black" size={48}/>
          </button>
          <div className="flex gap-4 w-full">
            <button onClick={() => { setMuted(!muted); playSfx('click'); }} className="flex-1 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex justify-center text-white active:scale-90">
              {muted ? <VolumeX size={34} /> : <Volume2 size={34} />}
            </button>
            <button className="flex-1 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex justify-center text-white active:scale-90">
              <Settings size={34} />
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
        <Loader2 className="w-12 h-12 text-white animate-spin opacity-20 mb-4" strokeWidth={5} />
        <p className="text-zinc-600 font-black tracking-[0.6em] text-[10px] uppercase">PRE-LOADING NEXT LEVEL</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-black flex flex-col items-center justify-between safe-area-inset pb-6 transition-all duration-300 ${shake ? 'bg-rose-950/20' : ''}`}>
      {adState !== 'IDLE' && (
        <div className="fixed inset-0 z-[10000] bg-zinc-950 flex flex-col items-center justify-center p-12 text-center">
           <div className="p-10 bg-zinc-900/40 rounded-[3rem] border border-white/5 flex flex-col items-center">
             <Award className="text-yellow-400 mb-8 animate-bounce" size={70} />
             <h2 className="text-3xl font-black italic uppercase text-white tracking-widest mb-2">REWARD VIDEO</h2>
             <p className="text-zinc-600 text-[9px] font-black tracking-[0.4em] mb-12 uppercase">ID: 9049225512</p>
             <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden mb-6">
                <div className="h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${((2-adTimer)/2)*100}%` }}></div>
             </div>
             <p className="text-white/40 text-[10px] font-black uppercase tracking-tighter">Reward Loading: {adTimer}s</p>
           </div>
        </div>
      )}

      <div className="w-full px-8 pt-8 flex justify-between items-center z-50">
        <button onClick={() => { playSfx('click'); setGameState('MENU'); }} className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-white active:scale-90 shadow-xl"><Home size={24}/></button>
        <div className="bg-zinc-900/90 px-8 py-3 rounded-full border border-zinc-800 flex items-center gap-3 backdrop-blur-md">
          <Star className="text-yellow-400 fill-yellow-400" size={16}/>
          <span className="text-white font-black text-2xl italic tracking-tighter uppercase">LVL {levelNumber}</span>
        </div>
        <button onClick={() => { setUsedEdges(new Set()); setCurrentNodeId(null); playSfx('click'); }} className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 text-white active:rotate-180 transition-all duration-300 shadow-xl">
          <RotateCcw size={24}/>
        </button>
      </div>

      <div className="flex flex-col items-center w-full px-6">
        <div ref={container} className={`relative bg-[#080808] rounded-[5rem] border-2 border-zinc-900 transition-all duration-200 ${gameState === 'WIN' ? 'win-pulse' : ''}`}
             style={{ width: 'min(92vw, 380px)', height: 'min(92vw, 380px)', boxShadow: isDrawing ? `0 0 100px ${themeColor}15` : 'none' }}
             onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
          <svg width="100%" height="100%" viewBox="0 0 400 400" className="overflow-visible relative z-20 pointer-events-none">
            {level?.edges.map((e, i) => {
              const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
              return <line key={`bg-${i}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="#18181b" strokeWidth="26" strokeLinecap="round" />;
            })}
            {level?.edges.map((e, i) => {
              const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
              const isUsed = usedEdges.has([e.from, e.to].sort().join('-'));
              return isUsed && (
                <line key={`fg-${i}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={themeColor} strokeWidth="26" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 10px ${themeColor})` }} />
              );
            })}
            {isDrawing && currentNodeId !== null && (
              <line x1={level?.nodes.find(n => n.id === currentNodeId)?.x} y1={level?.nodes.find(n => n.id === currentNodeId)?.y} x2={touchPos.x} y2={touchPos.y} stroke={`${themeColor}44`} strokeWidth="16" strokeDasharray="16,14" strokeLinecap="round" />
            )}
            {level?.nodes.map(n => {
              const isActive = currentNodeId === n.id;
              return <circle key={n.id} cx={n.x} cy={n.y} r="20" fill={isActive ? "white" : "#0d0d0d"} stroke={isActive ? themeColor : "#2a2a2e"} strokeWidth="6" className="transition-all duration-200" />;
            })}
          </svg>
          <div className="absolute inset-0 z-30 pointer-events-none">
            {level?.nodes.map(n => (
              <div key={n.id} className="absolute w-44 h-44 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer touch-none" 
                   style={{ left: `${(n.x/400)*100}%`, top: `${(n.y/400)*100}%` }} 
                   onPointerDown={(e) => { e.stopPropagation(); setIsDrawing(true); setCurrentNodeId(n.id); playSfx('click'); }} />
            ))}
          </div>
        </div>
      </div>

      <div className="w-full px-8 flex flex-col gap-4 max-w-[440px] z-50">
        <div className="flex gap-4">
          <button onClick={() => triggerRewardedAd(() => {})} className="flex-1 bg-zinc-900 py-6 rounded-[2rem] flex items-center justify-center gap-3 text-white font-black text-[12px] tracking-widest border border-zinc-800 active:scale-95 shadow-2xl">
            <Lightbulb size={24} className="text-yellow-400" /> HINT
          </button>
          <button onClick={() => triggerRewardedAd(() => setGameState('WIN'))} className="flex-1 bg-zinc-900 py-6 rounded-[2rem] flex items-center justify-center gap-3 text-white font-black text-[12px] tracking-widest border border-zinc-800 active:scale-95 shadow-2xl">
            <FastForward size={24} className="text-rose-500" /> SKIP
          </button>
        </div>
        <BannerAd />
      </div>

      {gameState === 'WIN' && (
        <div className="fixed inset-0 z-[11000] bg-black/98 flex items-center justify-center p-10 animate-in zoom-in duration-300 backdrop-blur-3xl">
          <div className="text-center w-full max-w-sm">
            <Trophy size={140} className="mx-auto text-yellow-400 animate-bounce mb-8 drop-shadow-[0_0_50px_rgba(250,204,21,0.2)]" />
            <h2 className="text-[100px] font-black italic text-white tracking-tighter mb-4 uppercase leading-[0.6]">IQ<br/><span className="text-yellow-400">UP!</span></h2>
            <div className="flex flex-col gap-5 mt-12">
              <button onClick={() => { setLevelNumber(n => n + 1); startLevel(levelNumber + 1); playSfx('click'); }} 
                      className="w-full bg-white text-black py-9 rounded-[4.5rem] text-4xl font-black flex items-center justify-center gap-6 active:scale-90 shadow-2xl transition-all">
                NEXT <ArrowRight size={44} strokeWidth={5} />
              </button>
              <button onClick={() => { if(navigator.share) navigator.share({ title: 'Neon One', text: `Level ${levelNumber} Complete!`, url: window.location.href }); }} 
                      className="w-full bg-zinc-900/50 text-white py-6 rounded-3xl font-black uppercase text-[10px] tracking-widest border border-zinc-800 flex items-center justify-center gap-3 active:scale-95">
                <Share2 size={24} /> BRAG TO FRIENDS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
