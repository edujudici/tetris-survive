
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GRID_SIZE, COLUMNS, ROWS, CANVAS_WIDTH, CANVAS_HEIGHT, GRAVITY, JUMP_FORCE, PLAYER_SPEED, DIFFICULTY_CONFIG, DifficultyLevel } from './constants';
import { Position, Tetromino, TetrominoType, Player, COLORS, SHAPES } from './types';

interface Skin {
  id: string;
  color: string;
  name: string;
  price?: number;
}

const SKINS: Skin[] = [
  { id: 'classic', color: '#4ade80', name: 'Clássico' },
  { id: 'neon', color: '#22d3ee', name: 'Ciano Neon' },
  { id: 'ruby', color: '#f87171', name: 'Rubi' },
  { id: 'gold', color: '#fbbf24', name: 'Ouro' },
  { id: 'purple', color: '#a78bfa', name: 'Ametista' },
  { id: 'ghost', color: '#f1f5f9', name: 'Fantasma' },
];

const levelConfigs = [
  { timeLimit: 120, baseSpawn: 2000, baseSpeed: 2.5, label: "Vale dos Blocos" },
  { timeLimit: 120, baseSpawn: 1600, baseSpeed: 3.5, label: "Ruínas de Neon" },
  { timeLimit: 120, baseSpawn: 1300, baseSpeed: 4.5, label: "Pico Radioativo" },
  { timeLimit: 120, baseSpawn: 1000, baseSpeed: 5.5, label: "Abismo Digital" },
  { timeLimit: 120, baseSpawn: 700, baseSpeed: 7.0, label: "O Confronto Final" }
];

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'REGISTER' | 'IDLE' | 'TREINAMENTO_MENU' | 'MAPA' | 'PLAYING' | 'GAMEOVER' | 'VICTORY' | 'LOCKER'>('REGISTER');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('MEDIO');
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [unlockedLevels, setUnlockedLevels] = useState<number>(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [isEmergencyFlash, setIsEmergencyFlash] = useState(false);
  const [playerName, setPlayerName] = useState<string>('');
  const [inactivityTime, setInactivityTime] = useState(0); 
  const [isMobile, setIsMobile] = useState(false);
  
  const [currentSkin, setCurrentSkin] = useState<Skin>(() => {
    const saved = localStorage.getItem('tetris_selected_skin');
    return saved ? JSON.parse(saved) : SKINS[0];
  });

  const [highScore, setHighScore] = useState<number>(() => Number(localStorage.getItem('tetris_high_score')) || 0);

  const playerRef = useRef<Player>({ x: (CANVAS_WIDTH / 2) - 15, y: CANVAS_HEIGHT - 45, width: 28, height: 35, vx: 0, vy: 0, isJumping: false });
  const staticBlocksRef = useRef<{x: number, y: number, color: string}[]>([]);
  const fallingBlocksRef = useRef<Tetromino[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>(undefined);
  const lastSpawnTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastMovementTimeRef = useRef<number>(0);

  useEffect(() => {
    const savedName = localStorage.getItem('tetris_player_name');
    if (savedName) {
      setPlayerName(savedName);
      setGameState('IDLE');
    }
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim().length >= 2) {
      localStorage.setItem('tetris_player_name', playerName.trim());
      setGameState('IDLE');
    }
  };

  const selectSkin = (skin: Skin) => {
    setCurrentSkin(skin);
    localStorage.setItem('tetris_selected_skin', JSON.stringify(skin));
  };

  const checkHighScore = useCallback((finalScore: number) => {
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('tetris_high_score', finalScore.toString());
    }
  }, [highScore]);

  const spawnTetromino = useCallback(() => {
    const types: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z', 'TRIO'];
    const type = types[Math.floor(Math.random() * types.length)];
    const shape = SHAPES[type];
    const pieceWidth = shape[0].length;
    const randomCol = Math.floor(Math.random() * (COLUMNS - pieceWidth + 1));
    const newBlock: Tetromino = { type, pos: { x: randomCol * GRID_SIZE, y: -GRID_SIZE * 4 }, shape, color: COLORS[type] };
    fallingBlocksRef.current.push(newBlock);
  }, []);

  const checkLines = useCallback(() => {
    const blocks = staticBlocksRef.current;
    const isTooHigh = blocks.some(b => b.y <= GRID_SIZE * 2);
    if (isTooHigh) {
      setIsEmergencyFlash(true);
      setScore(prev => prev + 1000);
      setTimeout(() => {
        staticBlocksRef.current = [];
        setIsEmergencyFlash(false);
      }, 200);
      return;
    }

    const linesToClear: number[] = [];
    for (let y = 0; y < CANVAS_HEIGHT; y += GRID_SIZE) {
      const blocksInLine = blocks.filter(b => b.y === y);
      if (blocksInLine.length >= COLUMNS) linesToClear.push(y);
    }

    if (linesToClear.length > 0) {
      setIsClearing(true);
      setScore(prev => prev + (linesToClear.length * 500));
      setTimeout(() => {
        let newBlocks = staticBlocksRef.current.filter(b => !linesToClear.includes(b.y));
        linesToClear.sort((a, b) => a - b).forEach(lineY => {
          newBlocks = newBlocks.map(b => (b.y < lineY ? { ...b, y: b.y + GRID_SIZE } : b));
          if (playerRef.current.y < lineY) playerRef.current.y += GRID_SIZE;
        });
        staticBlocksRef.current = newBlocks;
        setIsClearing(false);
      }, 150);
    }
  }, []);

  const resetGame = (level: DifficultyLevel, advLevel: number | null = null) => {
    setDifficulty(level);
    setCurrentLevel(advLevel);
    playerRef.current = { x: (CANVAS_WIDTH / 2) - 14, y: CANVAS_HEIGHT - 45, width: 28, height: 35, vx: 0, vy: 0, isJumping: false };
    staticBlocksRef.current = [];
    fallingBlocksRef.current = [];
    setScore(0);
    setInactivityTime(0);
    setTimeLeft(advLevel ? levelConfigs[advLevel - 1].timeLimit : 0);
    setGameState('PLAYING');
    const now = performance.now();
    lastSpawnTimeRef.current = now;
    lastTimeRef.current = now;
    lastMovementTimeRef.current = now;
  };

  const update = (time: number) => {
    if (gameState !== 'PLAYING') return;
    
    const timeSinceLastMove = time - lastMovementTimeRef.current;
    setInactivityTime(timeSinceLastMove);
    if (timeSinceLastMove > 5000) {
      checkHighScore(score);
      setGameState('GAMEOVER');
      return;
    }

    let spawnRate = DIFFICULTY_CONFIG[difficulty].spawnRate;
    let fallSpeed = DIFFICULTY_CONFIG[difficulty].fallSpeed;

    if (currentLevel !== null) {
      const dt = time - lastTimeRef.current;
      if (dt >= 1000) {
        setTimeLeft(prev => {
          const next = Math.max(0, prev - 1);
          if (next <= 0) {
            setTimeout(() => {
              checkHighScore(score);
              setGameState('VICTORY');
              if (currentLevel === unlockedLevels) setUnlockedLevels(prevL => Math.min(prevL + 1, levelConfigs.length));
            }, 100);
          }
          return next;
        });
        lastTimeRef.current = time;
      }
    }

    if (time - lastSpawnTimeRef.current > spawnRate) {
      spawnTetromino();
      lastSpawnTimeRef.current = time;
      setScore(prev => prev + 10);
    }

    const player = playerRef.current;
    const isMoving = keysRef.current.has('ArrowLeft') || keysRef.current.has('a') || keysRef.current.has('A') || 
                     keysRef.current.has('ArrowRight') || keysRef.current.has('d') || keysRef.current.has('D') ||
                     keysRef.current.has('ArrowUp') || keysRef.current.has(' ') || keysRef.current.has('w') || keysRef.current.has('W');
    
    if (isMoving) lastMovementTimeRef.current = time;

    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a') || keysRef.current.has('A')) player.vx = -PLAYER_SPEED;
    else if (keysRef.current.has('ArrowRight') || keysRef.current.has('d') || keysRef.current.has('D')) player.vx = PLAYER_SPEED;
    else player.vx = 0;

    const nextX = player.x + player.vx;
    let canMoveX = true;
    if (nextX < 0 || nextX + player.width > CANVAS_WIDTH) canMoveX = false;
    else {
      for (const sb of staticBlocksRef.current) {
        if (nextX < sb.x + GRID_SIZE && nextX + player.width > sb.x && 
            player.y + 4 < sb.y + GRID_SIZE && player.y + player.height - 4 > sb.y) {
          canMoveX = false;
          break;
        }
      }
    }
    if (canMoveX) player.x = nextX;

    if ((keysRef.current.has('ArrowUp') || keysRef.current.has(' ') || keysRef.current.has('w') || keysRef.current.has('W')) && !player.isJumping) {
      player.vy = JUMP_FORCE;
      player.isJumping = true;
    }

    player.vy += GRAVITY;
    const nextY = player.y + player.vy;
    let canMoveY = true;
    if (nextY + player.height > CANVAS_HEIGHT) {
      player.y = CANVAS_HEIGHT - player.height;
      player.vy = 0;
      player.isJumping = false;
      canMoveY = false;
    } else {
      for (const sb of staticBlocksRef.current) {
        if (player.x < sb.x + GRID_SIZE && player.x + player.width > sb.x && 
            nextY < sb.y + GRID_SIZE && nextY + player.height > sb.y) {
          if (player.vy > 0) {
            player.y = sb.y - player.height;
            player.vy = 0;
            player.isJumping = false;
          } else {
            player.y = sb.y + GRID_SIZE;
            player.vy = 0;
          }
          canMoveY = false;
          break;
        }
      }
    }
    if (canMoveY) player.y = nextY;

    const nextFalling: Tetromino[] = [];
    let shouldCheckLines = false;
    for (const block of fallingBlocksRef.current) {
      block.pos.y += fallSpeed;
      let settled = false;
      for (let row = 0; row < block.shape.length; row++) {
        for (let col = 0; col < block.shape[row].length; col++) {
          if (block.shape[row][col]) {
            const bx = block.pos.x + col * GRID_SIZE;
            const by = block.pos.y + row * GRID_SIZE;
            if (player.x + 10 < bx + GRID_SIZE && player.x + player.width - 10 > bx && 
                player.y + 10 < by + GRID_SIZE && player.y + player.height - 10 > by) {
              checkHighScore(score);
              setGameState('GAMEOVER');
            }
            if (by + GRID_SIZE >= CANVAS_HEIGHT) settled = true;
          }
        }
      }

      if (!settled) {
        for (const sb of staticBlocksRef.current) {
          for (let row = 0; row < block.shape.length; row++) {
            for (let col = 0; col < block.shape[row].length; col++) {
              if (block.shape[row][col]) {
                const bx = block.pos.x + col * GRID_SIZE;
                const by = block.pos.y + row * GRID_SIZE;
                if (bx < sb.x + GRID_SIZE && bx + GRID_SIZE > sb.x && 
                    by + GRID_SIZE >= sb.y && by < sb.y + GRID_SIZE) settled = true;
              }
            }
          }
        }
      }

      if (settled) {
        const snappedY = Math.round(block.pos.y / GRID_SIZE) * GRID_SIZE;
        for (let row = 0; row < block.shape.length; row++) {
          for (let col = 0; col < block.shape[row].length; col++) {
            if (block.shape[row][col]) {
              staticBlocksRef.current.push({ x: block.pos.x + col * GRID_SIZE, y: snappedY + row * GRID_SIZE, color: block.color });
            }
          }
        }
        shouldCheckLines = true;
      } else nextFalling.push(block);
    }
    fallingBlocksRef.current = nextFalling;
    if (shouldCheckLines) checkLines();

    if (player.y < -GRID_SIZE * 2) {
      checkHighScore(score);
      setGameState('GAMEOVER');
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    if (isEmergencyFlash) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = isClearing ? '#334155' : '#0f172a';
    }
    
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = '#1e293b';
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke(); }
    
    staticBlocksRef.current.forEach(b => { 
      ctx.fillStyle = b.color; 
      ctx.fillRect(b.x + 1, b.y + 1, GRID_SIZE - 2, GRID_SIZE - 2); 
    });
    
    fallingBlocksRef.current.forEach(block => {
      ctx.fillStyle = block.color;
      block.shape.forEach((row, rIdx) => {
        row.forEach((cell, cIdx) => {
          if (cell) ctx.fillRect(block.pos.x + cIdx * GRID_SIZE + 1, block.pos.y + rIdx * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        });
      });
    });
    
    const p = playerRef.current;
    ctx.fillStyle = currentSkin.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.width, p.height);
    // Adiciona um detalhe de olho
    ctx.fillStyle = '#000';
    ctx.fillRect(Math.round(p.x) + 18, Math.round(p.y) + 8, 4, 4);

    if (inactivityTime > 3000) {
      const alpha = ((inactivityTime - 3000) / 2000) * 0.3;
      ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  };

  const handleMobileInput = (key: string, isDown: boolean) => {
    if (isDown) keysRef.current.add(key);
    else keysRef.current.delete(key);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    requestRef.current = requestAnimationFrame(update);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, difficulty, isClearing, score, isEmergencyFlash, currentSkin]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-white select-none font-sans overflow-hidden touch-none">
      {gameState === 'REGISTER' && (
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-5xl font-black text-cyan-400 italic text-center leading-tight">SOBREVIVA AO<br/>TETRIS</h1>
          <form onSubmit={handleRegister} className="flex flex-col gap-4 items-center">
            <input type="text" maxLength={12} value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="bg-slate-800 border-2 border-cyan-500/30 rounded-xl px-6 py-4 text-2xl font-black text-center" placeholder="SEU NOME" autoFocus />
            <button className="px-12 py-4 bg-cyan-500 rounded-xl font-black uppercase">Entrar</button>
          </form>
        </div>
      )}

      {gameState !== 'REGISTER' && (
        <div className="relative border-4 border-slate-800 rounded-xl shadow-2xl bg-slate-950 overflow-hidden" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
          {gameState === 'PLAYING' && (
            <>
              <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block" />
              <button 
                onClick={() => setGameState('IDLE')} 
                className="absolute top-4 left-4 z-20 bg-slate-900/80 hover:bg-red-500 text-white p-2 rounded-lg transition-colors border border-slate-700 shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>

              <div className="absolute top-4 right-4 bg-slate-900/90 px-4 py-2 rounded-lg text-2xl font-mono border border-slate-700 text-cyan-400 tabular-nums z-10">
                {score.toString().padStart(6, '0')}
              </div>
              
              {currentLevel && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-yellow-500 px-4 py-1 rounded-full font-black text-yellow-950 z-10">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
              )}

              {isMobile && (
                <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-end p-6">
                  <div className="flex justify-between items-end w-full">
                    <div className="flex gap-4 pointer-events-auto">
                      <button onPointerDown={() => handleMobileInput('ArrowLeft', true)} onPointerUp={() => handleMobileInput('ArrowLeft', false)} className="w-20 h-20 bg-slate-800/60 rounded-2xl flex items-center justify-center border-2 border-slate-600"><svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M15 19l-7-7 7-7" /></svg></button>
                      <button onPointerDown={() => handleMobileInput('ArrowRight', true)} onPointerUp={() => handleMobileInput('ArrowRight', false)} className="w-20 h-20 bg-slate-800/60 rounded-2xl flex items-center justify-center border-2 border-slate-600"><svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M9 5l7 7-7 7" /></svg></button>
                    </div>
                    <div className="pointer-events-auto">
                      <button onPointerDown={() => handleMobileInput(' ', true)} onPointerUp={() => handleMobileInput(' ', false)} className="w-24 h-24 bg-yellow-500/40 rounded-full flex items-center justify-center border-4 border-yellow-500/60"><span className="text-white font-black text-xl italic uppercase">PULO</span></button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {gameState === 'IDLE' && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-4 p-6 pt-12">
              {/* Botão Vestiário Pequeno no Topo */}
              <button 
                onClick={() => setGameState('LOCKER')} 
                className="absolute top-6 left-6 flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-purple-500/40 hover:bg-purple-900/20 transition-all scale-90"
              >
                <div className="w-6 h-6 rounded flex items-center justify-center shadow-inner" style={{ backgroundColor: currentSkin.color }}>
                  <div className="w-1.5 h-1.5 bg-black rounded-full ml-2 -mt-1"></div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">Vestiário</span>
              </button>

              <div className="flex items-center gap-4 mb-2">
                <div className="w-16 h-16 rounded-xl border-2 border-cyan-500/50 flex items-center justify-center overflow-hidden" style={{ backgroundColor: currentSkin.color }}>
                  <div className="w-4 h-4 bg-black rounded-full ml-4 -mt-4"></div>
                </div>
                <div>
                  <h2 className="text-3xl font-black italic text-cyan-400 uppercase">{playerName}</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mestre Escalador</p>
                </div>
              </div>
              
              <div className="w-full max-w-xs mb-2">
                <div className="bg-slate-800 p-4 rounded-xl border border-cyan-500/30 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Recorde Global</span>
                  <p className="text-3xl font-black text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{highScore.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 w-64 items-center">
                <button 
                  onClick={() => setGameState('TREINAMENTO_MENU')} 
                  className="group relative w-full h-24 overflow-hidden rounded-lg transition-all hover:scale-105 active:scale-95 shadow-xl"
                >
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1 p-1 bg-slate-700">
                    <div className="invisible"></div>
                    <div className="bg-purple-600 rounded border-t-2 border-l-2 border-purple-400"></div>
                    <div className="invisible"></div>
                    <div className="bg-purple-600 rounded border-t-2 border-l-2 border-purple-400"></div>
                    <div className="bg-purple-600 rounded border-t-2 border-l-2 border-purple-400"></div>
                    <div className="bg-purple-600 rounded border-t-2 border-l-2 border-purple-400"></div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-2">
                    <span className="text-white font-black uppercase text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">Treinamento</span>
                  </div>
                </button>

                <button onClick={() => setGameState('MAPA')} className="w-full py-5 bg-cyan-500 rounded-xl font-black uppercase shadow-[0_4px_0_0_#0891b2] active:translate-y-1 transition-all text-xl">Aventura</button>
              </div>
            </div>
          )}

          {gameState === 'LOCKER' && (
            <div className="absolute inset-0 bg-slate-900 flex flex-col p-6 overflow-hidden">
               <button onClick={() => setGameState('IDLE')} className="self-start bg-slate-800 px-4 py-2 rounded-full text-xs font-bold uppercase mb-6 flex items-center gap-2 border border-slate-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Voltar
              </button>
              
              <h2 className="text-3xl font-black text-white italic uppercase mb-8">Vestiário</h2>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  {SKINS.map((skin) => (
                    <button 
                      key={skin.id}
                      onClick={() => selectSkin(skin)}
                      className={`relative flex flex-col items-center p-4 rounded-2xl border-4 transition-all ${currentSkin.id === skin.id ? 'border-cyan-500 bg-cyan-500/10 scale-105' : 'border-slate-800 bg-slate-800 hover:border-slate-700'}`}
                    >
                      <div className="w-16 h-16 rounded-lg mb-3 shadow-lg flex items-center justify-center" style={{ backgroundColor: skin.color }}>
                         <div className="w-4 h-4 bg-black rounded-full ml-4 -mt-4"></div>
                      </div>
                      <span className="font-black uppercase text-xs text-center">{skin.name}</span>
                      {currentSkin.id === skin.id && (
                        <div className="absolute -top-2 -right-2 bg-cyan-500 text-slate-950 p-1 rounded-full">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 p-4 bg-slate-800 rounded-2xl border border-slate-700 flex items-center gap-4">
                 <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: currentSkin.color }}></div>
                 <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Equipado:</p>
                    <p className="font-black uppercase">{currentSkin.name}</p>
                 </div>
              </div>
            </div>
          )}

          {gameState === 'MAPA' && (
            <div className="absolute inset-0 bg-blue-600 flex flex-col items-center p-8 overflow-y-auto">
              <button onClick={() => setGameState('IDLE')} className="absolute top-4 left-4 bg-white/20 p-2 px-4 rounded-full text-xs font-bold uppercase hover:bg-white/40">Voltar</button>
              <h2 className="text-3xl font-black mb-8 uppercase italic text-white">Fases</h2>
              <div className="flex flex-wrap justify-center gap-8">
                {levelConfigs.map((cfg, i) => (
                  <button key={i} disabled={i + 1 > unlockedLevels} onClick={() => resetGame(difficulty, i + 1)} className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black shadow-xl transition-transform active:scale-90 ${i + 1 <= unlockedLevels ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-400 opacity-50 grayscale'}`}>
                    {i + 1 > unlockedLevels ? '🔒' : i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {gameState === 'TREINAMENTO_MENU' && (
            <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center p-8 gap-4">
              <h2 className="text-2xl font-black text-cyan-400 uppercase mb-4">Dificuldade</h2>
              {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLevel[]).map(lv => (
                <button key={lv} onClick={() => resetGame(lv)} className={`w-full py-4 rounded-xl font-black uppercase text-white shadow-lg transition-transform active:scale-95 ${DIFFICULTY_CONFIG[lv].color}`}>
                  {DIFFICULTY_CONFIG[lv].label}
                </button>
              ))}
              <button onClick={() => setGameState('IDLE')} className="mt-4 text-slate-500 font-bold uppercase text-sm hover:text-white">Cancelar</button>
            </div>
          )}

          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 z-50">
              <h2 className="text-6xl font-black mb-4 text-red-600 italic uppercase">FALHA</h2>
              <p className="text-white/70 font-bold mb-4">Você foi esmagado pela precisão dos blocos.</p>
              <p className="text-4xl font-black text-white mb-10">{score.toLocaleString()}</p>
              <button onClick={() => setGameState('IDLE')} className="px-12 py-4 bg-white text-black font-black rounded-xl uppercase hover:scale-105 transition-transform">Menu</button>
            </div>
          )}

          {gameState === 'VICTORY' && (
            <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-center p-6 z-50">
              <h2 className="text-6xl font-black mb-4 text-white italic uppercase">VITÓRIA!</h2>
              <p className="text-4xl font-black text-white mb-10">{score.toLocaleString()}</p>
              <button onClick={() => setGameState('MAPA')} className="px-12 py-4 bg-white text-emerald-700 font-black rounded-xl uppercase hover:scale-105 transition-transform">Próxima Fase</button>
            </div>
          )}
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
