import { useEffect, useRef, useCallback, useState } from 'react';
import { createGameState, MAP_TEMPLATES } from './engine/map';
import { updateGame, movePlayer, placeBomb } from './engine/game.web';
import { updateBot, resetBotStates } from './engine/ai.web';
import { render, invalidateMapCache, preloadSprites, getCanvasSize } from './renderer.web';
import { Direction, CHARACTERS, MAP_SIZES, type GameState } from './engine/types';

const CHARACTER_AVATARS = [
  require('@/resources/assets/game/Boom-Mobile-NV-1.jpg'),
  require('@/resources/assets/game/Boom-Mobile-NV-2.jpg'),
  require('@/resources/assets/game/Boom-Mobile-NV-3.jpg'),
  require('@/resources/assets/game/Boom-Mobile-NV-4.jpg'),
  require('@/resources/assets/game/Boom-Mobile-NV-5.jpg'),
  require('@/resources/assets/game/Boom-Mobile-NV-6.jpg'),
].map((m) => (typeof m === 'string' ? m : (m as any).uri ?? (m as any).default ?? ''));

const HUD_HEIGHT = 32;

export default function BombermanGameWeb({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const stateRef = useRef<GameState>(createGameState(3));
  const keysRef = useRef<Map<string, number>>(new Map());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const moveTimerRef = useRef<number>(0);
  const bombQueueRef = useRef(false);
  const [status, setStatus] = useState<GameState['status']>('menu');
  const [winner, setWinner] = useState<number | null>(null);
  const [botCount, setBotCount] = useState(3);
  const [selectedMap, setSelectedMap] = useState('classic');
  const [selectedChar, setSelectedChar] = useState(0);
  const [gameMode, setGameMode] = useState<'bot' | 'friends'>('bot');
  const [selectedSize, setSelectedSize] = useState('small');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gameWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { w: CANVAS_W, h: CANVAS_H } = getCanvasSize(stateRef.current);

  const botCountRef = useRef(botCount);
  const selectedMapRef = useRef(selectedMap);
  const selectedCharRef = useRef(selectedChar);
  const selectedSizeRef = useRef(selectedSize);
  botCountRef.current = botCount;
  selectedMapRef.current = selectedMap;
  selectedCharRef.current = selectedChar;
  selectedSizeRef.current = selectedSize;

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      gameWrapperRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const startGameRef = useRef<(bots: number, mapId: string, charId: number, sizeId?: string) => void>(null!);
  startGameRef.current = useCallback((bots: number, mapId: string, charId: number, sizeId?: string) => {
    resetBotStates();
    invalidateMapCache();
    stateRef.current = createGameState(bots, mapId, charId, sizeId || selectedSizeRef.current);
    stateRef.current.status = 'playing';
    lastTimeRef.current = 0;
    moveTimerRef.current = 0;
    ctxRef.current = null;
    keysRef.current.clear();
    setStatus('playing');
    setWinner(null);
  }, []);

  const gameLoop = useCallback((timestamp: number) => {
    if (!canvasRef.current) {
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    if (!ctxRef.current) ctxRef.current = canvasRef.current.getContext('2d');
    const dt = lastTimeRef.current === 0 ? 16 : Math.min(timestamp - lastTimeRef.current, 50);
    lastTimeRef.current = timestamp;
    const state = stateRef.current;
    if (state.status === 'playing') {
      const keys = keysRef.current;
      moveTimerRef.current += dt;
      if (moveTimerRef.current >= 80) {
        let dir: Direction | null = null;
        if (keys.has('arrowup') || keys.has('w')) dir = Direction.UP;
        else if (keys.has('arrowdown') || keys.has('s')) dir = Direction.DOWN;
        else if (keys.has('arrowleft') || keys.has('a')) dir = Direction.LEFT;
        else if (keys.has('arrowright') || keys.has('d')) dir = Direction.RIGHT;
        if (dir) {
          movePlayer(state, 0, dir);
          moveTimerRef.current = 0;
        }
      }
      if (bombQueueRef.current || keys.has(' ')) {
        placeBomb(state, 0);
        bombQueueRef.current = false;
      }
      for (const player of state.players) {
        if (player.isBot && player.alive) updateBot(state, player, dt);
      }
      updateGame(state, dt);
      if (state.status === 'gameover') {
        setStatus('gameover');
        setWinner(state.winner);
      }
    }
    if (ctxRef.current) render(ctxRef.current, state, timestamp);
    rafRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    keysRef.current.set(key, performance.now());
    const state = stateRef.current;
    const GAME_KEYS = ['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'p', 'f', 'r'];
    if (GAME_KEYS.includes(key)) e.preventDefault();
    if (key === 'f' && state.status !== 'menu') {
      toggleFullscreen();
      return;
    }
    if (key === 'p' && (state.status === 'playing' || state.status === 'paused')) {
      state.status = state.status === 'playing' ? 'paused' : 'playing';
      setStatus(state.status);
      return;
    }
    if (key === 'r' && state.status === 'gameover') {
      startGameRef.current(botCountRef.current, selectedMapRef.current, selectedCharRef.current, selectedSizeRef.current);
      return;
    }
    if (state.status === 'playing') {
      const keyDirMap: Record<string, Direction> = {
        w: Direction.UP,
        arrowup: Direction.UP,
        s: Direction.DOWN,
        arrowdown: Direction.DOWN,
        a: Direction.LEFT,
        arrowleft: Direction.LEFT,
        d: Direction.RIGHT,
        arrowright: Direction.RIGHT,
      };
      const dir = keyDirMap[key];
      if (dir) {
        movePlayer(state, 0, dir);
        moveTimerRef.current = 0;
      }
    }
    if (e.key === ' ' && state.status === 'playing') bombQueueRef.current = true;
  }, [toggleFullscreen]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase());
  }, []);

  useEffect(() => {
    preloadSprites(CHARACTER_AVATARS);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    rafRef.current = requestAnimationFrame(gameLoop);
    const onBlur = () => keysRef.current.clear();
    const onVisChange = () => {
      keysRef.current.clear();
      lastTimeRef.current = 0;
    };
    const onFocus = () => {
      keysRef.current.clear();
      lastTimeRef.current = 0;
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisChange);
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisChange);
      document.removeEventListener('fullscreenchange', onFsChange);
      ctxRef.current = null;
    };
  }, [handleKeyDown, handleKeyUp, gameLoop]);

  useEffect(() => {
    function handleResize() {
      if (!containerRef.current) return;
      const { w: cw, h: ch } = getCanvasSize(stateRef.current);
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;
      const totalH = ch + HUD_HEIGHT;
      const maxScale = isFullscreen ? 10 : 1.5;
      const s = Math.min(containerW / cw, containerH / totalH, maxScale);
      setScale(Math.max(0.3, s));
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [status, isFullscreen]);

  return (
    <div ref={gameWrapperRef} className={`flex flex-col items-center w-full select-none ${
      isFullscreen ? 'h-screen bg-black' : 'min-h-[calc(100vh-4rem)] bg-gray-100 dark:bg-[#0a0a0a]'
    }`}>
      <div className="w-full max-w-5xl flex items-center justify-between px-4 py-2">
        <button onClick={onBack} className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          Back
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Bomberman</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-500 font-mono">
            {status === 'playing' && 'WASD/Arrow + Space'}
            {status === 'paused' && 'Paused'}
            {status === 'gameover' && 'Press R to restart'}
          </span>
          {status !== 'menu' && (
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="flex-1 flex items-center justify-center w-full px-4 pb-4">
        <div className="relative" style={{ width: CANVAS_W * scale, height: (CANVAS_H + HUD_HEIGHT) * scale }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H + HUD_HEIGHT}
            className="block rounded-lg shadow-lg dark:shadow-none"
            style={{
              width: CANVAS_W * scale,
              height: (CANVAS_H + HUD_HEIGHT) * scale,
              imageRendering: 'pixelated',
            }}
          />

          {status === 'menu' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.95)',
                borderRadius: 12,
                overflowY: 'auto',
                padding: '16px 12px',
              }}
            >
              <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', margin: 0 }}>Bomberman</h2>
              <p style={{ color: '#6b7280', fontSize: 12, margin: '2px 0 12px' }}>Classic canvas version</p>

              <div style={{ width: '100%', maxWidth: 620, marginBottom: 12 }}>
                <label style={{ color: '#4b5563', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6, textAlign: 'center' }}>
                  Game Mode
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => setGameMode('bot')}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      background: gameMode === 'bot' ? '#2563eb' : '#e5e7eb',
                      color: gameMode === 'bot' ? '#fff' : '#4b5563',
                    }}
                  >
                    BOT
                  </button>
                  <button
                    onClick={() => setGameMode('friends')}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      background: gameMode === 'friends' ? '#059669' : '#e5e7eb',
                      color: gameMode === 'friends' ? '#fff' : '#4b5563',
                    }}
                  >
                    FRIENDS
                  </button>
                </div>
              </div>

              <div style={{ width: '100%', maxWidth: 620, marginBottom: 12 }}>
                <label style={{ color: '#4b5563', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6, textAlign: 'center' }}>
                  Character
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
                  {CHARACTERS.map((char, i) => (
                    <button
                      key={char.id}
                      onClick={() => setSelectedChar(i)}
                      style={{
                        border: selectedChar === i ? `2px solid ${char.color}` : '2px solid transparent',
                        borderRadius: 10,
                        background: selectedChar === i ? '#e5e7eb' : '#f3f4f6',
                        padding: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          overflow: 'hidden',
                          boxShadow: selectedChar === i ? `0 0 12px ${char.color}40` : 'none',
                        }}
                      >
                        <img
                          src={CHARACTER_AVATARS[i]}
                          alt={char.name}
                          loading="eager"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'top',
                            transform: 'scale(1.6)',
                            transformOrigin: '50% 35%',
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', maxWidth: 620, marginBottom: 12 }}>
                <label style={{ color: '#4b5563', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6, textAlign: 'center' }}>
                  Map
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                  {MAP_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedMap(tmpl.id)}
                      style={{
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        textAlign: 'left',
                        background: selectedMap === tmpl.id ? '#e5e7eb' : '#f3f4f6',
                        outline: selectedMap === tmpl.id ? '1px solid #d1d5db' : 'none',
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0, backgroundColor: tmpl.color }} />
                      <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{tmpl.name}</span>
                        <span style={{ fontSize: 10, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tmpl.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', maxWidth: 620, marginBottom: 12 }}>
                <label style={{ color: '#4b5563', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6, textAlign: 'center' }}>
                  Map Size
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
                  {MAP_SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setSelectedSize(size.id)}
                      style={{
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: 10,
                        height: 38,
                        fontWeight: 700,
                        fontSize: 12,
                        background: selectedSize === size.id ? '#f59e0b' : '#f3f4f6',
                        color: selectedSize === size.id ? '#fff' : '#4b5563',
                      }}
                    >
                      <div>{size.label}</div>
                      <span style={{ display: 'block', fontSize: 9, fontWeight: 500, opacity: 0.75 }}>{size.cols}x{size.rows}</span>
                    </button>
                  ))}
                </div>
              </div>

              {gameMode === 'bot' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ color: '#4b5563', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6, textAlign: 'center' }}>
                    Opponents
                  </label>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => setBotCount(n)}
                        style={{
                          border: 'none',
                          cursor: 'pointer',
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          fontWeight: 700,
                          fontSize: 14,
                          background: botCount === n ? '#2563eb' : '#e5e7eb',
                          color: botCount === n ? '#fff' : '#4b5563',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameMode === 'friends' && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: '#10b981' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.5 }}>COMING SOON</span>
                  </div>
                </div>
              )}

              <button
                onClick={() => gameMode === 'bot' && startGameRef.current(botCount, selectedMap, selectedChar, selectedSize)}
                disabled={gameMode === 'friends'}
                style={{
                  border: 'none',
                  cursor: gameMode === 'friends' ? 'not-allowed' : 'pointer',
                  width: 176,
                  height: 40,
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 13,
                  background: gameMode === 'friends' ? '#d1d5db' : '#2563eb',
                  color: gameMode === 'friends' ? '#6b7280' : '#fff',
                }}
              >
                {gameMode === 'friends' ? 'COMING SOON' : 'START GAME'}
              </button>
              <div style={{ marginTop: 12, color: '#9ca3af', fontSize: 10, textAlign: 'center' }}>
                <p style={{ margin: 0 }}>WASD/Arrow: move, Space: bomb, P: pause, F: fullscreen, R: restart</p>
              </div>
            </div>
          )}

          {status === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-black/70 rounded-lg">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4">Paused</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Press P to continue</p>
            </div>
          )}

          {status === 'gameover' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 dark:bg-black/80 rounded-lg">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Game Over</h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                {winner !== null ? (winner === 0 ? 'You Win!' : `Bot ${winner} Wins`) : 'Draw'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => startGameRef.current(botCount, selectedMap, selectedChar, selectedSize)}
                  className="h-11 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all active:scale-95"
                >
                  Play Again
                </button>
                <button
                  onClick={onBack}
                  className="h-11 px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-lg transition-all active:scale-95 flex items-center"
                >
                  Exit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
