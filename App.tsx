
import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, Trophy, ArrowRight, Lightbulb, 
  Star, Loader2, Home, Volume2, VolumeX, 
  Zap, Play, FastForward, Settings, Share2, Award
} from 'lucide-react';
import { generateDrawingLevel } from './services/geminiService';
import { DrawingLevel, GameState } from './types';

const AdBanner: React.FC = () => (
  <div className="w-full h-[60px] bg-zinc-900/40 border-y border-zinc-800/30 flex items-center justify-center relative shrink-0 overflow-hidden rounded-xl">
    <div className="absolute top-0 left-2 bg-zinc-800/80 px-2 py-0.5 rounded-b-md text-[7px] font-bold text-zinc-500 uppercase tracking-widest">Sponsored</div>
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 bg-zinc-800 rounded animate-pulse"></div>
      <div className="flex flex-col gap-1">
        <div className="w-24 h-2 bg-zinc-800 rounded"></div>
        <div className="w-16 h-1.5 bg-zinc-800/50 rounded"></div>
      </div>
      <div className="ml-4 px-3 py-1 bg-cyan-500/20 text-cyan-400 text-[8px] font-bold rounded-full border border-cyan-500/30 uppercase tracking-tighter">Install</div>
    </div>
  </div>
);

const AudioSystem = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const init = () => { if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); };
  const playTone = (freq: number, type: OscillatorType, duration: number, volume: number) => {
    init(); const ctx = ctxRef.current!; if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  };
  return {
    connect: () => playTone(1200, 'sine', 0.08, 0.03),
    error: () => playTone(140, 'sawtooth', 0.4, 0.04),
    win: () => { [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'sine', 0.7, 0.03), i * 150)); },
    click: () => playTone(900, 'sine', 0.05, 0.02),
    reward: () => playTone(1000, 'triangle', 0.5, 0.05)
  };
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
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adTimer, setAdTimer] = useState(5);
  
  const audio = useRef<ReturnType<typeof AudioSystem> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const themeColors = ['#00f2ff', '#bc13fe', '#ff0055', '#39ff14', '#faff00'];
  const theme = { color: themeColors[levelNumber % themeColors.length] };

  useEffect(() => { audio.current = AudioSystem(); }, []);

  const playSound = (type: keyof ReturnType<typeof AudioSystem>) => {
    if (!muted && audio.current) (audio.current as any)[type]();
  };

  const startLevel = async (num: number) => {
    setGameState('LOADING');
    const lvl = await generateDrawingLevel(num);
    setLevel(lvl);
    setUsedEdges(new Set());
    setCurrentNodeId(null);
    setGameState('PLAYING');
  };

  const handlePointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!isDrawing || !level || currentNodeId === null || isWatchingAd) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = (e as React.TouchEvent).touches[0].clientX;
      clientY = (e as React.TouchEvent).touches[0].clientY;
    } else {
      clientX = (e as React.PointerEvent).clientX;
      clientY = (e as React.PointerEvent).clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 400;
    const y = ((clientY - rect.top) / rect.height) * 400;
    setTouchPos({ x, y });

    level.nodes.forEach(node => {
      const dist = Math.sqrt((node.x - x) ** 2 + (node.y - y) ** 2);
      if (dist < 40 && node.id !== currentNodeId) {
        const key = [currentNodeId, node.id].sort().join('-');
        const validEdge = level.edges.find(edge => 
          (edge.from === currentNodeId && edge.to === node.id) || (edge.from === node.id && edge.to === currentNodeId)
        );
        
        if (validEdge && !usedEdges.has(key)) {
          setUsedEdges(new Set(usedEdges).add(key));
          setCurrentNodeId(node.id);
          playSound('connect');
          if (usedEdges.size + 1 === level.edges.length) {
            setTimeout(() => { setGameState('WIN'); playSound('win'); }, 400);
          }
        }
      }
    });
  };

  const handlePointerUp = () => {
    if (isDrawing && level && usedEdges.size < level.edges.length) {
      setShake(true); playSound('error'); setTimeout(() => setShake(false), 400);
      setUsedEdges(new Set()); setCurrentNodeId(null);
    }
    setIsDrawing(false);
  };

  const watchAd = (onComplete: () => void) => {
    setIsWatchingAd(true);
    setAdTimer(5);
    const interval = setInterval(() => {
      setAdTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    setTimeout(() => { setIsWatchingAd(false); playSound('reward'); onComplete(); }, 5500);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Neon One IQ',
        text: `I just beat Level ${levelNumber} in Neon One! Think you have a higher IQ? Try it now:`,
        url: window.location.href
      }).catch(() => {});
    }
  };

  if (gameState === 'MENU') {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-between p-10 text-white overflow-hidden">
        <div className="pt-32 text-center relative w-full">
          <div className="absolute -inset-20 bg-cyan-500/5 blur-[120px] rounded-full"></div>
          <h1 className="text-8xl font-black tracking-tighter italic leading-[0.75] relative z-10 select-none">
            NEON<br/><span className="text-zinc-600">ONE</span>
          </h1>
          <div className="mt-10 flex items-center justify-center gap-4 text-zinc-600 font-bold uppercase tracking-[0.7em] text-[11px] relative z-10 opacity-70">
            <div className="h-[1px] w-6 bg-zinc-800"></div>
            IQ MASTER
            <div className="h-[1px] w-6 bg-zinc-800"></div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8 w-full max-w-xs relative z-10">
          <button onClick={() => startLevel(levelNumber)} 
                  className="w-full bg-white text-black py-8 rounded-[3.5rem] font-black text-4xl shadow-[0_30px_90px_rgba(255,255,255,0.25)] active:scale-95 transition-all flex items-center justify-center gap-4 hover:bg-zinc-100">
            START <Play className="fill-black" size={36}/>
          </button>
          <div className="flex gap-4 w-full">
            <button onClick={() => setMuted(!muted)} className="flex-1 bg-zinc-900/60 border border-zinc-800 p-6 rounded-3xl flex justify-center text-zinc-500 active:bg-zinc-800 transition-colors backdrop-blur-md">
              {muted ? <VolumeX size={26}/> : <Volume2 size={26}/>}
            </button>
            <button className="flex-1 bg-zinc-900/60 border border-zinc-800 p-6 rounded-3xl flex justify-center text-zinc-500 active:bg-zinc-800 transition-colors backdrop-blur-md">
              <Settings size={26}/>
            </button>
          </div>
        </div>
        <div className="w-full max-w-sm mb-6"><AdBanner /></div>
      </div>
    );
  }

  if (gameState === 'LOADING') {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <Loader2 className="w-24 h-24 text-white animate-spin opacity-20" strokeWidth={3} />
          <div className="absolute inset-0 bg-white/5 blur-3xl animate-pulse rounded-full"></div>
        </div>
        <p className="mt-12 text-zinc-600 font-bold tracking-[0.6em] text-[12px] uppercase animate-pulse">Forging Level...</p>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-[#050505] flex flex-col items-center justify-between transition-colors duration-500 ${shake ? 'bg-red-900/10' : ''}`}>
      {isWatchingAd && (
        <div className="fixed inset-0 z-[200] bg-black/98 flex flex-col items-center justify-center p-12 text-center backdrop-blur-3xl animate-in fade-in duration-300">
          <Award className="text-white mb-10 animate-bounce" size={80} />
          <h2 className="text-3xl font-black italic tracking-widest uppercase mb-6">Unlocking Hint</h2>
          <div className="w-full max-w-[240px] h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/10 shadow-inner">
             <div className="h-full bg-white transition-all duration-1000 ease-linear shadow-[0_0_20px_white]" style={{ width: `${(5-adTimer)/5*100}%` }}></div>
          </div>
          <p className="mt-8 text-zinc-500 text-[11px] font-bold uppercase tracking-widest">Resuming in {adTimer}s</p>
        </div>
      )}

      <div className="w-full px-8 pt-16 flex justify-between items-center z-10">
        <button onClick={() => setGameState('MENU')} className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-zinc-500 active:scale-90 transition-transform shadow-xl"><Home size={24}/></button>
        <div className="bg-zinc-900/95 px-8 py-3 rounded-full border border-zinc-800 flex items-center gap-4 shadow-2xl backdrop-blur-xl">
          <Star className="text-yellow-400 fill-yellow-400" size={18}/>
          <span className="text-white font-black text-2xl italic tracking-tighter uppercase">LEVEL {levelNumber}</span>
        </div>
        <button onClick={() => { setUsedEdges(new Set()); setCurrentNodeId(null); playSound('click'); }} className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-zinc-500 active:rotate-180 transition-all duration-700 shadow-xl">
          <RotateCcw size={24}/>
        </button>
      </div>

      <div ref={containerRef} className="relative bg-black rounded-[5rem] border border-zinc-900/60 transition-all duration-700 overflow-visible"
           style={{ width: 'min(92vw, 380px)', height: 'min(92vw, 380px)', boxShadow: isDrawing ? `0 0 100px ${theme.color}20` : `0 0 40px ${theme.color}05` }}
           onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        <svg width="100%" height="100%" viewBox="0 0 400 400" className="overflow-visible relative z-20 pointer-events-none">
          {level?.edges.map((e, i) => {
            const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
            return <line key={`bg-${i}`} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="#1a1a1e" strokeWidth="18" strokeLinecap="round" />;
          })}
          {level?.edges.map((e, i) => {
            const n1 = level.nodes.find(n => n.id === e.from)!; const n2 = level.nodes.find(n => n.id === e.to)!;
            const isUsed = usedEdges.has([e.from, e.to].sort().join('-'));
            return <line key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={isUsed ? theme.color : "transparent"} strokeWidth="20" strokeLinecap="round" className="transition-all duration-300" style={{ filter: isUsed ? `drop-shadow(0 0 15px ${theme.color})` : 'none' }} />;
          })}
          {isDrawing && currentNodeId !== null && (
            <line x1={level?.nodes.find(n => n.id === currentNodeId)?.x} y1={level?.nodes.find(n => n.id === currentNodeId)?.y} x2={touchPos.x} y2={touchPos.y} stroke={`${theme.color}70`} strokeWidth="6" strokeDasharray="12,10" />
          )}
          {level?.nodes.map(n => {
            const isActive = currentNodeId === n.id;
            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r="16" fill={isActive ? "white" : "#0e0e11"} stroke={isActive ? theme.color : "#2a2a2e"} strokeWidth="5" className="transition-all duration-300" />
                {isActive && <circle cx={n.x} cy={n.y} r="35" fill={`${theme.color}15`} className="animate-ping" />}
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 z-30 pointer-events-none">
          {level?.nodes.map(n => (
            <div key={n.id} className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer" style={{ left: `${(n.x/400)*100}%`, top: `${(n.y/400)*100}%` }} onPointerDown={(e) => { e.stopPropagation(); setIsDrawing(true); setCurrentNodeId(n.id); playSound('click'); }} />
          ))}
        </div>
      </div>

      <div className="w-full px-8 pb-8 flex flex-col gap-6">
        <div className="flex gap-5">
          <button onClick={() => watchAd(() => {})} className="flex-1 bg-zinc-900/60 py-7 rounded-[2.5rem] flex items-center justify-center gap-3 text-[11px] font-black tracking-[0.2em] text-white active:scale-95 border border-zinc-800 backdrop-blur-md transition-all shadow-xl group">
            <Lightbulb size={22} className="text-yellow-400 group-hover:scale-110 transition-transform" /> HINT
          </button>
          <button onClick={() => watchAd(() => { setGameState('WIN'); playSound('win'); })} className="flex-1 bg-zinc-900/60 py-7 rounded-[2.5rem] flex items-center justify-center gap-3 text-[11px] font-black tracking-[0.2em] text-white active:scale-95 border border-zinc-800 backdrop-blur-md transition-all shadow-xl group">
            <FastForward size={22} className="text-rose-500 group-hover:scale-110 transition-transform" /> SKIP
          </button>
        </div>
        <AdBanner />
      </div>

      {gameState === 'WIN' && (
        <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-10 backdrop-blur-[50px] animate-in zoom-in duration-500">
          <div className="text-center w-full max-w-sm">
            <Trophy size={160} className="mx-auto text-yellow-400 mb-10 animate-bounce" />
            <h2 className="text-7xl font-black italic text-white tracking-tighter mb-4 uppercase leading-none">CLEARED</h2>
            <p className="text-zinc-600 font-bold tracking-[0.4em] text-[12px] uppercase mb-16">IQ Increasing...</p>
            <div className="flex flex-col gap-5">
              <button onClick={() => { setLevelNumber(n => n + 1); startLevel(levelNumber + 1); playSound('click'); }} 
                      className="w-full bg-white text-black py-8 rounded-[3.5rem] text-4xl font-black flex items-center justify-center gap-4 shadow-[0_30px_90px_rgba(255,255,255,0.2)] active:scale-95 transition-all">
                NEXT <ArrowRight size={44} strokeWidth={4} />
              </button>
              <button onClick={handleShare} className="w-full bg-zinc-900 text-zinc-500 py-7 rounded-[3rem] font-bold flex items-center justify-center gap-3 border border-zinc-800 active:bg-zinc-800 active:scale-95 transition-all">
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
