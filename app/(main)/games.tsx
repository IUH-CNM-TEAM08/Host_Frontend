import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';
import BombermanGame from '@/src/games/bomberman/BombermanGame';
import BombermanGameWeb from '@/src/games/bomberman/BombermanGame.web';

type Screen = 'hub' | 'tictactoe' | 'game2048' | 'memory' | 'bomberman';

// ══════════════════════════════════════════════
// ── GAME HUB
// ══════════════════════════════════════════════
const GAMES = [
  {
    id: 'tictactoe' as Screen,
    name: 'Tic Tac Toe',
    desc: 'Nối 3 ô liên tiếp để thắng',
    icon: 'grid-outline' as const,
    bg: '#6366F1',
    light: '#EEF2FF',
    tag: '2 người chơi',
  },
  {
    id: 'game2048' as Screen,
    name: '2048',
    desc: 'Ghép ô số để đạt 2048',
    icon: 'calculator-outline' as const,
    bg: '#F59E0B',
    light: '#FFFBEB',
    tag: '1 người chơi',
  },
  {
    id: 'memory' as Screen,
    name: 'Memory Cards',
    desc: 'Lật thẻ tìm cặp nhanh nhất',
    icon: 'layers-outline' as const,
    bg: '#10B981',
    light: '#ECFDF5',
    tag: '1 người chơi',
  },
  {
    id: 'bomberman' as Screen,
    name: 'Bomberman',
    desc: 'Đặt bom, né nổ, phá map như bản chuẩn',
    icon: 'flash-outline' as const,
    bg: '#7C3AED',
    light: '#F3E8FF',
    tag: '1 người chơi',
  },
];

const BM_TILE = 28;
const BM_COLS = 11;
const BM_ROWS = 11;
const BM_BOMB_TICKS = 18;
const BM_FLAME_TICKS = 4;

type BmTile = 0 | 1 | 2;
type BmPos = { x: number; y: number };
type BmBomb = { x: number; y: number; owner: 'player' | 'bot'; timer: number };
type BmFlame = { x: number; y: number; timer: number };

const BM_AVATARS = [
  require('@/resources/assets/game/Boom-Mobile-NV-1.jpg'),
  require('@/resources/assets/game/Boom-Mobile-NV-2.jpg'),
];

function createBmBoard(): BmTile[][] {
  const board: BmTile[][] = Array.from({ length: BM_ROWS }, (_, y) =>
    Array.from({ length: BM_COLS }, (_, x) => {
      if (x === 0 || y === 0 || x === BM_COLS - 1 || y === BM_ROWS - 1) return 1;
      if (x % 2 === 0 && y % 2 === 0) return 1;
      return Math.random() < 0.35 ? 2 : 0;
    }),
  );
  // clear spawn zones
  const clear = [
    [1, 1], [2, 1], [1, 2],
    [BM_COLS - 2, BM_ROWS - 2], [BM_COLS - 3, BM_ROWS - 2], [BM_COLS - 2, BM_ROWS - 3],
  ];
  clear.forEach(([x, y]) => {
    board[y][x] = 0;
  });
  return board;
}

function BombermanLite({ onBack }: { onBack: () => void }) {
  const boardRef = useRef<BmTile[][]>(createBmBoard());
  const [boardVersion, setBoardVersion] = useState(0);
  const [player, setPlayer] = useState<BmPos>({ x: 1, y: 1 });
  const [bot, setBot] = useState<BmPos>({ x: BM_COLS - 2, y: BM_ROWS - 2 });
  const [botAlive, setBotAlive] = useState(true);
  const [bombs, setBombs] = useState<BmBomb[]>([]);
  const [flames, setFlames] = useState<BmFlame[]>([]);
  const [status, setStatus] = useState<'playing' | 'win' | 'lose'>('playing');

  const restart = () => {
    boardRef.current = createBmBoard();
    setBoardVersion(v => v + 1);
    setPlayer({ x: 1, y: 1 });
    setBot({ x: BM_COLS - 2, y: BM_ROWS - 2 });
    setBotAlive(true);
    setBombs([]);
    setFlames([]);
    setStatus('playing');
  };

  const isBlocked = useCallback((x: number, y: number) => {
    if (x < 0 || y < 0 || x >= BM_COLS || y >= BM_ROWS) return true;
    if (boardRef.current[y][x] !== 0) return true;
    return bombs.some(b => b.x === x && b.y === y);
  }, [bombs]);

  const movePlayerBm = (dx: number, dy: number) => {
    if (status !== 'playing') return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!isBlocked(nx, ny)) setPlayer({ x: nx, y: ny });
  };

  const placeBombBm = (owner: 'player' | 'bot', pos: BmPos) => {
    setBombs(prev => {
      if (prev.some(b => b.owner === owner)) return prev;
      if (prev.some(b => b.x === pos.x && b.y === pos.y)) return prev;
      return [...prev, { x: pos.x, y: pos.y, owner, timer: BM_BOMB_TICKS }];
    });
  };

  const explodeBombBm = useCallback((bomb: BmBomb) => {
    const nextFlames: BmFlame[] = [{ x: bomb.x, y: bomb.y, timer: BM_FLAME_TICKS }];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    dirs.forEach(([dx, dy]) => {
      for (let i = 1; i <= 2; i++) {
        const nx = bomb.x + dx * i;
        const ny = bomb.y + dy * i;
        if (nx < 0 || ny < 0 || nx >= BM_COLS || ny >= BM_ROWS) break;
        const t = boardRef.current[ny][nx];
        if (t === 1) break;
        nextFlames.push({ x: nx, y: ny, timer: BM_FLAME_TICKS });
        if (t === 2) {
          boardRef.current[ny][nx] = 0;
          setBoardVersion(v => v + 1);
          break;
        }
      }
    });
    setFlames(prev => [...prev, ...nextFlames]);
  }, []);

  useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(() => {
      // bot simple AI
      if (botAlive && Math.random() < 0.55) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
        setBot(prev => {
          const nx = prev.x + dx;
          const ny = prev.y + dy;
          return isBlocked(nx, ny) ? prev : { x: nx, y: ny };
        });
      }
      if (botAlive && Math.random() < 0.08) {
        placeBombBm('bot', bot);
      }

      setBombs(prev => {
        const remaining: BmBomb[] = [];
        prev.forEach(b => {
          const next = { ...b, timer: b.timer - 1 };
          if (next.timer <= 0) explodeBombBm(b);
          else remaining.push(next);
        });
        return remaining;
      });

      setFlames(prev => prev.map(f => ({ ...f, timer: f.timer - 1 })).filter(f => f.timer > 0));
    }, 120);
    return () => clearInterval(id);
  }, [status, botAlive, bot, isBlocked, explodeBombBm]);

  useEffect(() => {
    const hitPlayer = flames.some(f => f.x === player.x && f.y === player.y);
    const hitBot = botAlive && flames.some(f => f.x === bot.x && f.y === bot.y);
    if (hitPlayer) setStatus('lose');
    if (hitBot) {
      setBotAlive(false);
      setStatus('win');
    }
  }, [flames, player, bot, botAlive]);

  const board = boardRef.current;
  void boardVersion;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <TouchableOpacity onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', flex: 1 }}>Bomberman Lite</Text>
        <TouchableOpacity onPress={restart} style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F3E8FF', borderRadius: 20 }}>
          <Text style={{ color: '#7C3AED', fontWeight: '600', fontSize: 13 }}>Chơi lại</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ width: BM_COLS * BM_TILE, height: BM_ROWS * BM_TILE, borderRadius: 12, overflow: 'hidden', backgroundColor: '#dbeafe' }}>
          {board.map((row, y) => (
            <View key={y} style={{ flexDirection: 'row' }}>
              {row.map((tile, x) => {
                const flame = flames.some(f => f.x === x && f.y === y);
                const bomb = bombs.find(b => b.x === x && b.y === y);
                const isPlayer = player.x === x && player.y === y;
                const isBot = botAlive && bot.x === x && bot.y === y;
                return (
                  <View
                    key={`${x}-${y}`}
                    style={{
                      width: BM_TILE,
                      height: BM_TILE,
                      backgroundColor: tile === 1 ? '#1e293b' : tile === 2 ? '#b45309' : '#dbeafe',
                      borderWidth: 0.5,
                      borderColor: '#cbd5e1',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {flame ? <Ionicons name="flame" size={16} color="#ef4444" /> : null}
                    {bomb ? <Ionicons name="radio-button-on" size={14} color="#111827" /> : null}
                    {!flame && isPlayer ? <Image source={BM_AVATARS[0]} style={{ width: 22, height: 22, borderRadius: 11 }} /> : null}
                    {!flame && isBot ? <Image source={BM_AVATARS[1]} style={{ width: 22, height: 22, borderRadius: 11 }} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ marginTop: 18, alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => movePlayerBm(0, -1)} style={arrowBtn}>
            <Ionicons name="chevron-up" size={26} color="#7C3AED" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => movePlayerBm(-1, 0)} style={arrowBtn}>
              <Ionicons name="chevron-back" size={26} color="#7C3AED" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => placeBombBm('player', player)} style={[arrowBtn, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="flash" size={24} color="#7C3AED" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => movePlayerBm(1, 0)} style={arrowBtn}>
              <Ionicons name="chevron-forward" size={26} color="#7C3AED" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => movePlayerBm(0, 1)} style={arrowBtn}>
            <Ionicons name="chevron-down" size={26} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {status !== 'playing' && (
          <View style={{ marginTop: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: status === 'win' ? '#dcfce7' : '#fee2e2' }}>
            <Text style={{ color: status === 'win' ? '#166534' : '#991b1b', fontWeight: '700' }}>
              {status === 'win' ? 'Bạn thắng!' : 'Bạn thua!'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function GameHub({ onPlay }: { onPlay: (id: Screen) => void }) {
  const { t } = useTranslation();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>{t('games.hubTitle')}</Text>
      <Text style={{ fontSize: 14, color: '#94A3B8', marginBottom: 24 }}>{t('games.hubSubtitle')}</Text>

      {GAMES.map(g => (
        <TouchableOpacity
          key={g.id}
          onPress={() => onPlay(g.id)}
          activeOpacity={0.85}
          style={{
            backgroundColor: 'white',
            borderRadius: 20,
            marginBottom: 16,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: g.light, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
              <Ionicons name={g.icon} size={28} color={g.bg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 3 }}>{g.name}</Text>
              <Text style={{ fontSize: 13, color: '#64748B' }}>{t(`games.${g.id}Desc`)}</Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: g.light, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                <Text style={{ fontSize: 11, color: g.bg, fontWeight: '600' }}>{t(`games.${g.id}Tag`)}</Text>
              </View>
            </View>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: g.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={16} color="white" />
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ══════════════════════════════════════════════
// ── TIC TAC TOE
// ══════════════════════════════════════════════
type Cell = 'X' | 'O' | null;

const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board: Cell[]): { winner: Cell; line: number[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line };
  }
  return null;
}

function TicTacToe({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [scores, setScores] = useState({ X: 0, O: 0 });

  const result = checkWinner(board);
  const isDraw = !result && board.every(Boolean);

  const handlePress = (i: number) => {
    if (board[i] || result) return;
    const next = [...board];
    next[i] = turn;
    setBoard(next);
    const w = checkWinner(next);
    if (w) setScores(s => ({ ...s, [w.winner!]: s[w.winner!] + 1 }));
    else setTurn(t => t === 'X' ? 'O' : 'X');
  };

  const reset = () => { setBoard(Array(9).fill(null)); setTurn('X'); };

  const CellBtn = ({ index }: { index: number }) => {
    const val = board[index];
    const isWin = result?.line.includes(index);
    return (
      <TouchableOpacity
        onPress={() => handlePress(index)}
        activeOpacity={0.7}
        style={{
          width: 90, height: 90, margin: 4,
          borderRadius: 16,
          backgroundColor: isWin ? (val === 'X' ? '#EEF2FF' : '#FFF0F0') : '#F8FAFC',
          borderWidth: 2,
          borderColor: isWin ? (val === 'X' ? '#6366F1' : '#EF4444') : '#E2E8F0',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {val && (
          <Text style={{
            fontSize: 40, fontWeight: '800',
            color: val === 'X' ? '#6366F1' : '#EF4444',
          }}>{val}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <TouchableOpacity onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', flex: 1 }}>Tic Tac Toe</Text>
        <TouchableOpacity onPress={reset} style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#EEF2FF', borderRadius: 20 }}>
          <Text style={{ color: '#6366F1', fontWeight: '600', fontSize: 13 }}>{t('games.playAgain')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {/* Scores */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 32 }}>
          {(['X', 'O'] as const).map(p => (
            <View key={p} style={{
              flex: 1, backgroundColor: turn === p && !result && !isDraw ? (p === 'X' ? '#EEF2FF' : '#FFF0F0') : 'white',
              borderRadius: 16, padding: 16, alignItems: 'center',
              borderWidth: 2,
              borderColor: turn === p && !result && !isDraw ? (p === 'X' ? '#6366F1' : '#EF4444') : '#F1F5F9',
              shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
            }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: p === 'X' ? '#6366F1' : '#EF4444' }}>{p}</Text>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#0F172A', marginTop: 4 }}>{scores[p]}</Text>
              {turn === p && !result && !isDraw && (
                <View style={{ marginTop: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: p === 'X' ? '#6366F1' : '#EF4444' }} />
              )}
            </View>
          ))}
        </View>

        {/* Status */}
        <View style={{ marginBottom: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: result ? (result.winner === 'X' ? '#6366F1' : '#EF4444') : isDraw ? '#64748B' : '#0F172A', textAlign: 'center' }}>
            {result ? `${t('games.winPrefix')} ${result.winner} ${t('games.winSuffix')}` : isDraw ? t('games.draw') : `${t('games.turnOf')} ${turn}`}
          </Text>
        </View>

        {/* Board */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 294, justifyContent: 'center', backgroundColor: 'white', borderRadius: 24, padding: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }}>
          {Array(9).fill(null).map((_, i) => <CellBtn key={i} index={i} />)}
        </View>

        {(result || isDraw) && (
          <TouchableOpacity onPress={reset} style={{ marginTop: 28, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#6366F1', borderRadius: 24 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{t('games.newRound')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════
// ── 2048
// ══════════════════════════════════════════════
const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  0:    { bg: '#E2E8F0', text: 'transparent' },
  2:    { bg: '#FEF3C7', text: '#92400E' },
  4:    { bg: '#FDE68A', text: '#92400E' },
  8:    { bg: '#FDBA74', text: '#7C2D12' },
  16:   { bg: '#FB923C', text: 'white' },
  32:   { bg: '#F97316', text: 'white' },
  64:   { bg: '#EF4444', text: 'white' },
  128:  { bg: '#FCD34D', text: '#78350F' },
  256:  { bg: '#FBBF24', text: '#78350F' },
  512:  { bg: '#F59E0B', text: 'white' },
  1024: { bg: '#D97706', text: 'white' },
  2048: { bg: '#B45309', text: 'white' },
};

function initGrid(): number[][] {
  const g = Array(4).fill(null).map(() => Array(4).fill(0));
  return addRandom(addRandom(g));
}

function addRandom(g: number[][]): number[][] {
  const empties: [number, number][] = [];
  g.forEach((row, r) => row.forEach((v, c) => { if (!v) empties.push([r, c]); }));
  if (!empties.length) return g;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const next = g.map(row => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRow(row: number[]): { row: number[]; score: number } {
  const filtered = row.filter(v => v);
  let score = 0;
  const merged: number[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i] * 2;
      merged.push(val);
      score += val;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i++;
    }
  }
  while (merged.length < 4) merged.push(0);
  return { row: merged, score };
}

function moveGrid(g: number[][], dir: 'up' | 'down' | 'left' | 'right'): { grid: number[][]; score: number; moved: boolean } {
  let grid = g.map(r => [...r]);
  let totalScore = 0;
  const orig = JSON.stringify(grid);

  const transpose = (m: number[][]) => m[0].map((_, i) => m.map(r => r[i]));
  const reverse = (m: number[][]) => m.map(r => [...r].reverse());

  if (dir === 'up')    grid = transpose(grid);
  if (dir === 'down')  grid = transpose(reverse(transpose(grid)));
  if (dir === 'right') grid = reverse(grid);

  grid = grid.map(row => {
    const { row: r, score } = slideRow(row);
    totalScore += score;
    return r;
  });

  if (dir === 'up')    grid = transpose(grid);
  if (dir === 'down')  { grid = transpose(grid); grid = reverse(transpose(grid)); }
  if (dir === 'right') grid = reverse(grid);

  return { grid, score: totalScore, moved: JSON.stringify(grid) !== orig };
}

function Game2048({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<number[][]>(initGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    setGrid(prev => {
      const { grid: next, score: s, moved } = moveGrid(prev, dir);
      if (!moved) return prev;
      const withNew = addRandom(next);
      setScore(sc => {
        const ns = sc + s;
        setBest(b => Math.max(b, ns));
        return ns;
      });
      if (withNew.some(r => r.some(v => v === 2048))) setWon(true);
      // check game over
      const canMove = ['up','down','left','right'].some(d =>
        moveGrid(withNew, d as any).moved
      );
      if (!canMove) setGameOver(true);
      return withNew;
    });
  }, []);

  // Keyboard events on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, 'up'|'down'|'left'|'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [move]);

  const reset = () => { setGrid(initGrid()); setScore(0); setGameOver(false); setWon(false); };

  const tileSize = 72;
  const tc = (v: number) => TILE_COLORS[v] || { bg: '#92400E', text: 'white' };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBEB' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#FEF3C7' }}>
        <TouchableOpacity onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', flex: 1 }}>2048</Text>
        <TouchableOpacity onPress={reset} style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FEF3C7', borderRadius: 20 }}>
          <Text style={{ color: '#D97706', fontWeight: '600', fontSize: 13 }}>{t('games.new')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {/* Score */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          {[[t('games.score'), score], [t('games.best'), best]].map(([label, val]) => (
            <View key={label as string} style={{ flex: 1, backgroundColor: '#F59E0B', borderRadius: 16, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
              <Text style={{ color: 'white', fontSize: 24, fontWeight: '800', marginTop: 4 }}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        <View style={{ backgroundColor: '#D97706', padding: 8, borderRadius: 20 }}>
          {grid.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {row.map((val, c) => {
                const style = tc(val);
                return (
                  <View key={c} style={{
                    width: tileSize, height: tileSize, margin: 4, borderRadius: 12,
                    backgroundColor: style.bg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {val > 0 && (
                      <Text style={{
                        color: style.text,
                        fontSize: val >= 1024 ? 18 : val >= 128 ? 22 : 26,
                        fontWeight: '800',
                      }}>{val}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* Arrow controls (always shown — hữu ích trên web lẫn mobile) */}
        <View style={{ marginTop: 28, alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => move('up')} style={arrowBtn}>
            <Ionicons name="chevron-up" size={26} color="#D97706" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => move('left')} style={arrowBtn}>
              <Ionicons name="chevron-back" size={26} color="#D97706" />
            </TouchableOpacity>
            <View style={{ width: 56, height: 56 }} />
            <TouchableOpacity onPress={() => move('right')} style={arrowBtn}>
              <Ionicons name="chevron-forward" size={26} color="#D97706" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => move('down')} style={arrowBtn}>
            <Ionicons name="chevron-down" size={26} color="#D97706" />
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' && (
          <Text style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>{t('games.keyboardHint')}</Text>
        )}
      </View>

      {(gameOver || won) && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 36, alignItems: 'center', marginHorizontal: 32 }}>
            <Text style={{ fontSize: 40 }}>{won ? '🏆' : '😵'}</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 12 }}>{won ? t('games.youWin') : t('games.gameOver')}</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 6 }}>{t('games.score')}: {score}</Text>
            <TouchableOpacity onPress={reset} style={{ marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#F59E0B', borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{t('games.playAgain')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const arrowBtn = {
  width: 56, height: 56, borderRadius: 16, backgroundColor: '#FEF3C7',
  alignItems: 'center' as const, justifyContent: 'center' as const,
  shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
};

// ══════════════════════════════════════════════
// ── MEMORY CARDS
// ══════════════════════════════════════════════
const ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  'heart','star','moon','sunny','flame','leaf','diamond','rocket',
];

interface Card { id: number; icon: keyof typeof Ionicons.glyphMap; color: string; matched: boolean; }

const COLORS = ['#EF4444','#F59E0B','#6366F1','#10B981','#EC4899','#14B8A6','#8B5CF6','#F97316'];

function initCards(): Card[] {
  const cards: Card[] = [...ICONS, ...ICONS].map((icon, i) => ({
    id: i,
    icon,
    color: COLORS[ICONS.indexOf(icon)],
    matched: false,
  }));
  return cards.sort(() => Math.random() - 0.5);
}

function MemoryCards({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [cards, setCards] = useState<Card[]>(initCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const handleFlip = (id: number) => {
    if (lockRef.current) return;
    const card = cards[id];
    if (card.matched || flipped.includes(id)) return;
    if (!running) setRunning(true);

    const next = [...flipped, id];
    setFlipped(next);

    if (next.length === 2) {
      setMoves(m => m + 1);
      lockRef.current = true;
      const [a, b] = next;
      if (cards[a].icon === cards[b].icon) {
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => i === a || i === b ? { ...c, matched: true } : c));
          setFlipped([]);
          lockRef.current = false;
          setCards(prev => {
            if (prev.every(c => c.matched || (c.id === a) || (c.id === b))) {
              const allMatched = prev.map((c, i) => i === a || i === b ? { ...c, matched: true } : c);
              if (allMatched.every(c => c.matched)) {
                setRunning(false);
                setDone(true);
              }
            }
            return prev;
          });
        }, 400);
      } else {
        setTimeout(() => { setFlipped([]); lockRef.current = false; }, 900);
      }
    }
  };

  const reset = () => {
    setCards(initCards());
    setFlipped([]);
    setMoves(0);
    setTime(0);
    setRunning(false);
    setDone(false);
    lockRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#F0FDF4' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#D1FAE5' }}>
        <TouchableOpacity onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', flex: 1 }}>Memory Cards</Text>
        <TouchableOpacity onPress={reset} style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#D1FAE5', borderRadius: 20 }}>
          <Text style={{ color: '#059669', fontWeight: '600', fontSize: 13 }}>{t('games.new')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%', maxWidth: 360 }}>
          {[[t('games.moves'), moves.toString()], [t('games.time'), fmt(time)]].map(([label, val]) => (
            <View key={label} style={{ flex: 1, backgroundColor: '#10B981', borderRadius: 16, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
              <Text style={{ color: 'white', fontSize: 22, fontWeight: '800', marginTop: 4 }}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Card grid — 4x4 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 316, justifyContent: 'center', gap: 8 }}>
          {cards.map((card, i) => {
            const visible = card.matched || flipped.includes(i);
            return (
              <TouchableOpacity
                key={i}
                onPress={() => handleFlip(i)}
                activeOpacity={0.8}
                style={{
                  width: 68, height: 68, borderRadius: 14,
                  backgroundColor: visible ? card.color : 'white',
                  borderWidth: 2,
                  borderColor: visible ? card.color : '#D1FAE5',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
                  opacity: card.matched ? 0.5 : 1,
                }}
              >
                {visible ? (
                  <Ionicons name={card.icon} size={28} color="white" />
                ) : (
                  <Text style={{ fontSize: 24 }}>?</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {done && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 36, alignItems: 'center', marginHorizontal: 32 }}>
            <Text style={{ fontSize: 44 }}>🎉</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 12 }}>{t('games.completed')}</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>{moves} {t('games.moves')} · {fmt(time)}</Text>
            <Text style={{ fontSize: 13, color: '#10B981', marginTop: 4, fontWeight: '600' }}>
              {moves <= 12 ? t('games.rankExcellent') : moves <= 18 ? t('games.rankGood') : t('games.rankDone')}
            </Text>
            <TouchableOpacity onPress={reset} style={{ marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#10B981', borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{t('games.playAgain')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════
// ── MAIN EXPORT
// ══════════════════════════════════════════════
export default function GamesScreen() {
  const [screen, setScreen] = useState<Screen>('hub');
  const { t } = useTranslation();

  if (screen === 'tictactoe') return <TicTacToe onBack={() => setScreen('hub')} />;
  if (screen === 'game2048')  return <Game2048  onBack={() => setScreen('hub')} />;
  if (screen === 'memory')    return <MemoryCards onBack={() => setScreen('hub')} />;
  if (screen === 'bomberman') {
    if (Platform.OS === 'web') return <BombermanGameWeb onBack={() => setScreen('hub')} />;
    return <BombermanGame onBack={() => setScreen('hub')} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <Ionicons name="game-controller-outline" size={24} color="#6366F1" style={{ marginRight: 10 }} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>{t('contacts.groups')}</Text>
      </View>
      <GameHub onPlay={setScreen} />
    </View>
  );
}
