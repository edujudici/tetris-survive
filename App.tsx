
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GRID_SIZE, COLUMNS, CANVAS_WIDTH, CANVAS_HEIGHT, GRAVITY, JUMP_FORCE, PLAYER_SPEED, DIFFICULTY_CONFIG, DifficultyLevel } from './constants';
import { Position, Tetromino, TetrominoType, Player, COLORS, SHAPES } from './types';

const DEFAULT_SKIN = { id: 'classic', color: '#4ade80', name: 'Clássico' };

const levelConfigs = [
  { timeLimit: 120, baseSpawn: 2000, baseSpeed: 2.5, label: "Vale dos Blocos" },
  { timeLimit: 120, baseSpawn: 1600, baseSpeed: 3.5, label: "Ruínas de Neon" },
  { timeLimit: 120, baseSpawn: 1300, baseSpeed: 4.5, label: "Pico Radioativo" },
  { timeLimit: 120, baseSpawn: 1000, baseSpeed: 5.5, label: "Abismo Digital" },
  { timeLimit: 120, baseSpawn: 700, baseSpeed: 7.0, label: "O Confronto Final" }
];

const TetrisPieceButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  // Representação de uma peça "T" invertida para o botão
  const color = COLORS.T;
  const blocks = [
    [0, 1, 0],
    [1, 1, 1]
  ];

  return (
    <button 
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center p-2 transition-transform hover:scale-105 active:scale-95 focus:outline-none"
    >
      <div className="flex flex-col gap-1">
        {blocks.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1 justify-center">
            {row.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                className={`w-10 h-10 rounded-sm shadow-[inset_-4px_-4px_0px_rgba(0,0,0,0.3),inset_4px_4px_0px_rgba(255,255,255,0.2)] transition-colors duration-300 ${
                  cell ? '' : 'opacity-0'
                }`}
                style={{ backgroundColor: cell ? color : 'transparent' }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-black text-xs uppercase tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] group-hover:text-cyan-200 transition-colors">
          Treinamento
        </span>
      </div>
    </button>
  );
};

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'REGISTER' | 'TUTORIAL' | 'IDLE' | 'TREINAMENTO_MENU' | 'MAPA' | 'PLAYING' | 'GAMEOVER' | 'VICTORY'>('REGISTER');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('MEDIO');
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [unlockedLevels, setUnlockedLevels] = useState<number>(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [playerName, setPlayerName] = useState<string>('');
  const [tutorialStep, setTutorialStep] = useState(0);
  
  const [highScore, setHighScore] = useState<number>(() => Number(localStorage.getItem('tetris_high_score')) || 0);
  const [highScoreDifficulty, setHighScoreDifficulty] = useState<string>(() => localStorage.getItem('tetris_high_diff') || '-');

  const playerRef = useRef<Player>({ x: (CANVAS_WIDTH / 2) - 15, y: CANVAS_HEIGHT - 45, width: 28, height: 35, vx: 0, vy: 0, isJumping: false });
  const staticBlocksRef = useRef<{x: number, y: number, color: string}[]>([]);
  const fallingBlocksRef = useRef<Tetromino[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>(undefined);
  const lastSpawnTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const savedName = localStorage.getItem('tetris_player_name');
    if (savedName) {
      setPlayerName(savedName);
      setGameState('IDLE');
    }
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim().length >= 2) {
      localStorage.setItem('tetris_player_name', playerName.trim());
      setGameState('TUTORIAL');
    }
  };

  const getDifficultySigla = (diff: DifficultyLevel) => {
    switch(diff) {
      case 'FACIL': return 'F';
      case 'MEDIO': return 'M';
      case 'DIFICIL': return 'D';
      case 'HARD': return 'H';
      default: return '?';
    }
  };

  const checkHighScore = useCallback((finalScore: number) => {
    if (finalScore > highScore) {
      const sigla = getDifficultySigla(difficulty);
      setHighScore(finalScore);
      setHighScoreDifficulty(sigla);
      localStorage.setItem('tetris_high_score', finalScore.toString());
      localStorage.setItem('tetris_high_diff', sigla);
    }
  }, [highScore, difficulty]);

  const spawnTetromino = useCallback(() => {
    const types: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z', 'TRIO'];
    const type = types[Math.floor(Math.random() * types.length)];
    const shape = SHAPES[type];
    const pieceWidth = shape[0].length;
    const randomCol = Math.floor(Math.random() * (COLUMNS - pieceWidth + 1));
    const newBlock: Tetromino = { type, pos: { x: randomCol * GRID_SIZE, y: -GRID_SIZE * 4 }, shape, color: COLORS[type] };
    fallingBlocksRef.current.push(newBlock);
  }, []);

  const resetGame = (level: DifficultyLevel, advLevel: number | null = null, isTut = false) => {
    setDifficulty(level);
    setCurrentLevel(advLevel);
    playerRef.current = { x: (CANVAS_WIDTH / 2) - 14, y: CANVAS_HEIGHT - 45, width: 28, height: 35, vx: 0, vy: 0, isJumping: false };
    staticBlocksRef.current = [];
    fallingBlocksRef.current = [];
    setScore(0);
    setTimeLeft(advLevel ? levelConfigs[advLevel - 1].timeLimit : 0);
    setGameState(isTut ? 'TUTORIAL' : 'PLAYING');
    lastSpawnTimeRef.current = performance.now();
    lastTimeRef.current = performance.now();
  };

  const update = (time: number) => {
    if (gameState !== 'PLAYING' && gameState !== 'TUTORIAL') return;
    
    let spawnRate = DIFFICULTY_CONFIG[difficulty].spawnRate;
    let fallSpeed = DIFFICULTY_CONFIG[difficulty].fallSpeed;

    if (currentLevel !== null && gameState === 'PLAYING') {
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

    if (gameState === 'TUTORIAL') {
      spawnRate = 4000;
      fallSpeed = 1.5;
      if (score >= 100) {
         setTimeout(() => setGameState('IDLE'), 100);
      }
    } else if (currentLevel !== null) {
      const cfg = levelConfigs[currentLevel - 1];
      const diffMod = DIFFICULTY_CONFIG[difficulty];
      const spawnRatio = diffMod.spawnRate / 1500;
      const speedRatio = diffMod.fallSpeed / 3.0;
      spawnRate = cfg.baseSpawn * spawnRatio;
      fallSpeed = cfg.baseSpeed * speedRatio;
    }

    if (time - lastSpawnTimeRef.current > spawnRate) {
      spawnTetromino();
      lastSpawnTimeRef.current = time;
      setScore(prev => prev + 10);
    }

    const player = playerRef.current;
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) {
        player.vx = -PLAYER_SPEED;
        if (gameState === 'TUTORIAL' && tutorialStep === 0) setTutorialStep(1);
    }
    else if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) {
        player.vx = PLAYER_SPEED;
        if (gameState === 'TUTORIAL' && tutorialStep === 0) setTutorialStep(1);
    }
    else player.vx = 0;

    if ((keysRef.current.has('ArrowUp') || keysRef.current.has(' ')) && !player.isJumping) {
      player.vy = JUMP_FORCE;
      player.isJumping = true;
      if (gameState === 'TUTORIAL' && tutorialStep === 1) setTutorialStep(2);
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > CANVAS_WIDTH) player.x = CANVAS_WIDTH - player.width;
    if (player.y + player.height > CANVAS_HEIGHT) {
      player.y = CANVAS_HEIGHT - player.height;
      player.vy = 0;
      player.isJumping = false;
    }

    const nextFalling: Tetromino[] = [];
    for (const block of fallingBlocksRef.current) {
      block.pos.y += fallSpeed;
      let settled = false;
      for (let row = 0; row < block.shape.length; row++) {
        for (let col = 0; col < block.shape[row].length; col++) {
          if (block.shape[row][col]) {
            const by = block.pos.y + (row + 1) * GRID_SIZE;
            if (by >= CANVAS_HEIGHT) settled = true;
            const bx = block.pos.x + col * GRID_SIZE;
            const bby = block.pos.y + row * GRID_SIZE;
            if (player.x < bx + GRID_SIZE && player.x + player.width > bx && player.y < bby + GRID_SIZE && player.y + player.height > bby) {
               if (gameState !== 'TUTORIAL') {
                 checkHighScore(score);
                 setGameState('GAMEOVER');
               }
            }
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
                if (bx < sb.x + GRID_SIZE && bx + GRID_SIZE > sb.x && by + GRID_SIZE >= sb.y && by < sb.y + GRID_SIZE) settled = true;
              }
            }
          }
        }
      }
      if (settled) {
        const snappedY = Math.floor(block.pos.y / GRID_SIZE) * GRID_SIZE;
        for (let row = 0; row < block.shape.length; row++) {
          for (let col = 0; col < block.shape[row].length; col++) {
            if (block.shape[row][col]) staticBlocksRef.current.push({ x: block.pos.x + col * GRID_SIZE, y: snappedY + row * GRID_SIZE, color: block.color });
          }
        }
        if (gameState === 'TUTORIAL' && tutorialStep === 2) setTutorialStep(3);
      } else nextFalling.push(block);
    }
    fallingBlocksRef.current = nextFalling;

    for (const sb of staticBlocksRef.current) {
      if (player.x < sb.x + GRID_SIZE && player.x + player.width > sb.x) {
        if (player.y + player.height >= sb.y && player.y + player.height <= sb.y + 10 && player.vy >= 0) {
          player.y = sb.y - player.height;
          player.vy = 0;
          player.isJumping = false;
        }
      }
    }
    
    if (staticBlocksRef.current.some(b => b.y <= 0)) {
        staticBlocksRef.current = [];
        setScore(prev => prev + 100);
        setIsClearing(true);
        setTimeout(() => setIsClearing(false), 500);
    }

    if (player.y < -GRID_SIZE * 5) {
      checkHighScore(score);
      setGameState('GAMEOVER');
    }
    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = isClearing ? '#1e293b' : '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = '#1e293b';
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, CANVAS_HEIGHT); ctx.stroke(); }
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(CANVAS_WIDTH, y + 0.5); ctx.stroke(); }
    staticBlocksRef.current.forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(b.x + 1, b.y + 1, GRID_SIZE - 2, GRID_SIZE - 2); });
    fallingBlocksRef.current.forEach(block => {
      ctx.fillStyle = block.color;
      for (let row = 0; row < block.shape.length; row++) {
        for (let col = 0; col < block.shape[row].length; col++) {
          if (block.shape[row][col]) ctx.fillRect(Math.round(block.pos.x + col * GRID_SIZE) + 1, Math.round(block.pos.y + row * GRID_SIZE) + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        }
      }
    });
    const p = playerRef.current;
    ctx.fillStyle = DEFAULT_SKIN.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.width, p.height);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(Math.round(p.x + p.width * 0.2), Math.round(p.y + p.height * 0.2), 4, 4);
    ctx.fillRect(Math.round(p.x + p.width * 0.6), Math.round(p.y + p.height * 0.2), 4, 4);
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
  }, [gameState, difficulty, isClearing, score, tutorialStep]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-white select-none font-sans overflow-hidden">
      {gameState === 'REGISTER' && (
        <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
           <h1 className="text-5xl font-black text-cyan-400 italic tracking-tighter drop-shadow-lg">BEM-VINDO</h1>
           <form onSubmit={handleRegister} className="flex flex-col gap-4 items-center">
              <label className="text-xs font-bold uppercase tracking-[0.4em] text-white/50">Insira seu Codinome</label>
              <input 
                type="text" 
                maxLength={12}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-slate-800 border-2 border-cyan-500/30 rounded-xl px-6 py-4 text-2xl font-black text-center text-white focus:outline-none focus:border-cyan-400 transition-all shadow-xl"
                placeholder="NOME"
                autoFocus
              />
              <button className="mt-4 px-12 py-4 bg-cyan-500 hover:bg-cyan-400 rounded-xl font-black uppercase tracking-widest shadow-[0_4px_0_0_#0891b2] active:translate-y-1 transition-all">Iniciar</button>
           </form>
        </div>
      )}

      {(gameState !== 'REGISTER') && (
        <>
          <div className="flex flex-col items-center mb-6 text-center">
            <h1 className="text-4xl font-black text-white italic tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]">
              <span className="text-cyan-400">SOBREVIVA</span> AO TETRIS
            </h1>
          </div>
          
          <div className="relative border-4 border-slate-800 rounded-xl shadow-2xl bg-slate-950 overflow-hidden" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
            {(gameState === 'PLAYING' || gameState === 'TUTORIAL') && (
              <>
                <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block" />
                {gameState === 'TUTORIAL' && (
                  <div className="absolute inset-x-0 top-20 flex flex-col items-center pointer-events-none px-10">
                    <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl border-2 border-cyan-500/50 text-center animate-bounce">
                      <p className="text-xl font-black uppercase italic text-cyan-400">Tutorial de Campo</p>
                      <p className="text-sm font-bold mt-2">
                        {tutorialStep === 0 && "Use A e D para se mover horizontalmente"}
                        {tutorialStep === 1 && "Pressione ESPAÇO para pular"}
                        {tutorialStep === 2 && "Não deixe os blocos te esmagarem!"}
                        {tutorialStep === 3 && "Suba nos blocos para sobreviver!"}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {gameState === 'IDLE' && (
              <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-6">
                <div className="text-center mb-2">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">Operador Ativo</p>
                  <p className="text-2xl font-black text-white italic uppercase tracking-tighter">{playerName}</p>
                </div>

                <div className="bg-slate-800/80 p-4 rounded-2xl border-2 border-cyan-500/30 flex flex-col items-center shadow-lg shadow-cyan-500/10">
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-1">Recorde Global</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tabular-nums">{highScore.toLocaleString()}</span>
                    <span className="text-lg font-black text-cyan-500 bg-cyan-500/10 px-2 rounded">{highScoreDifficulty}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-6 items-center mt-4">
                  <TetrisPieceButton onClick={() => setGameState('TREINAMENTO_MENU')} />
                  <button onClick={() => setGameState('MAPA')} className="px-8 py-4 bg-gradient-to-b from-pink-400 to-purple-600 rounded-xl font-black text-white shadow-[0_4px_0_0_#9333ea] hover:translate-y-1 active:translate-y-2 transition-all w-[220px] uppercase">Aventura</button>
                </div>
              </div>
            )}

            {gameState === 'TREINAMENTO_MENU' && (
              <div className="absolute inset-0 bg-slate-900/98 flex flex-col items-center justify-center gap-3 p-6">
                <h2 className="text-xl font-black mb-4 uppercase tracking-widest text-cyan-400 border-b-2 border-cyan-400/30 pb-1">Dificuldade Livre</h2>
                {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLevel[]).map((level) => (
                   <button key={level} onClick={() => resetGame(level)} className={`w-[220px] h-12 rounded-xl font-black uppercase tracking-widest transition-all ${DIFFICULTY_CONFIG[level].color} shadow-lg hover:scale-105 active:scale-95 text-white`}>
                     {DIFFICULTY_CONFIG[level].label}
                   </button>
                ))}
                <button onClick={() => setGameState('IDLE')} className="mt-4 text-slate-400 font-bold uppercase text-xs hover:text-white transition-colors">← Voltar</button>
              </div>
            )}

            {gameState === 'MAPA' && (
              <div className="absolute inset-0 bg-blue-600 flex flex-col items-center p-8 overflow-y-auto">
                <button onClick={() => setGameState('IDLE')} className="absolute top-4 left-4 text-white font-bold bg-white/20 p-2 px-4 rounded-full text-xs uppercase z-20 hover:bg-white/40">VOLTAR</button>
                <div className="flex flex-col items-center mb-8">
                  <h2 className="text-3xl font-black text-white drop-shadow-md uppercase tracking-tighter mb-4">Aventura</h2>
                  <div className="bg-blue-800/50 p-1 rounded-xl flex gap-1 border border-white/20">
                    {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLevel[]).map((level) => (
                      <button key={level} onClick={() => setDifficulty(level)} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${difficulty === level ? 'bg-white text-blue-800 scale-105 shadow-md' : 'text-white/60 hover:text-white'}`}>{getDifficultySigla(level)}</button>
                    ))}
                  </div>
                </div>
                <div className="relative w-full flex flex-col items-center gap-16 py-10">
                  <div className="absolute w-2 bg-white/30 h-full left-1/2 -translate-x-1/2 top-0 border-dashed border-2" />
                  {levelConfigs.map((cfg, i) => {
                    const lvl = i + 1;
                    const isUnlocked = lvl <= unlockedLevels;
                    return (
                      <button key={lvl} disabled={!isUnlocked} onClick={() => resetGame(difficulty, lvl)} className={`relative z-10 w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-black shadow-xl transition-transform active:scale-90 ${isUnlocked ? 'bg-yellow-400 border-yellow-200 text-yellow-800 animate-bounce' : 'bg-slate-400 border-slate-300 text-slate-600 grayscale opacity-60'}`}>
                        {isUnlocked ? lvl : '🔒'}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-white uppercase whitespace-nowrap">{cfg.label}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {gameState === 'GAMEOVER' && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center p-6 z-50">
                <h2 className="text-5xl font-black mb-4 text-red-500 tracking-tighter uppercase italic">Esmagado!</h2>
                <div className="mb-6"><p className="text-white/60 text-sm font-bold uppercase tracking-widest">Sua Pontuação</p><p className="text-3xl font-black text-white">{score.toLocaleString()}</p></div>
                <button onClick={() => setGameState(currentLevel ? 'MAPA' : 'TREINAMENTO_MENU')} className="px-10 py-4 bg-cyan-500 text-white font-black rounded-xl hover:bg-cyan-400 active:scale-95">Tentar Denovo</button>
                <button onClick={() => setGameState('IDLE')} className="mt-6 text-slate-400 font-bold uppercase text-xs hover:text-white transition-colors">Menu Principal</button>
              </div>
            )}

            {gameState === 'VICTORY' && (
              <div className="absolute inset-0 bg-emerald-500 flex flex-col items-center justify-center text-center p-6 z-50">
                <h2 className="text-5xl font-black mb-4 text-white drop-shadow-lg animate-pulse uppercase italic">Vitória!</h2>
                <div className="mb-6"><p className="text-emerald-900/60 text-sm font-bold uppercase tracking-widest">Pontuação Final</p><p className="text-3xl font-black text-white">{score.toLocaleString()}</p></div>
                <button onClick={() => setGameState('MAPA')} className="px-10 py-4 bg-white text-emerald-600 font-black rounded-xl shadow-xl hover:scale-105 transition-transform">Continuar</button>
              </div>
            )}

            {(gameState === 'PLAYING' || gameState === 'TUTORIAL') && (
              <>
                <div className="absolute top-4 right-4 bg-slate-900/90 px-4 py-2 rounded-lg text-2xl font-mono border border-slate-700 text-cyan-400 z-10 tabular-nums">
                  {score.toString().padStart(6, '0')}
                </div>
                {currentLevel && (
                   <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
                      <div className="bg-yellow-500 px-6 py-2 rounded-full border-2 border-yellow-200 shadow-lg animate-pulse">
                         <span className="text-xl font-black text-yellow-950 tabular-nums">{formatTime(timeLeft)}</span>
                      </div>
                      <span className="text-[10px] font-black uppercase text-yellow-400 mt-1 tracking-widest bg-black/40 px-2 rounded">Sobreviva!</span>
                   </div>
                )}
                <button onClick={() => setGameState('IDLE')} className="absolute top-4 left-4 z-10 bg-slate-900/80 hover:bg-red-500 text-white p-2 rounded-lg transition-colors border border-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
              </>
            )}
          </div>

          <div className="mt-8 flex gap-8 text-slate-500 text-[10px] font-black tracking-widest uppercase">
            <div className="flex items-center gap-2"><kbd className="px-2 py-1 bg-slate-800 rounded border-b-2 border-slate-950 text-white">WASD</kbd><span>Mover</span></div>
            <div className="flex items-center gap-2"><kbd className="px-2 py-1 bg-slate-800 rounded border-b-2 border-slate-950 text-white">ESPAÇO</kbd><span>Pular</span></div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
