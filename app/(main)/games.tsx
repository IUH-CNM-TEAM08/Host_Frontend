import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Screen = 'hub' | 'tictactoe' | 'game2048' | 'memory';

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
];

function GameHub({ onPlay }: { onPlay: (id: Screen) => void }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>Khu vui chơi</Text>
      <Text style={{ fontSize: 14, color: '#94A3B8', marginBottom: 24 }}>Chơi ngay, không cần đăng nhập</Text>

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
              <Text style={{ fontSize: 13, color: '#64748B' }}>{g.desc}</Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: g.light, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                <Text style={{ fontSize: 11, color: g.bg, fontWeight: '600' }}>{g.tag}</Text>
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
          <Text style={{ color: '#6366F1', fontWeight: '600', fontSize: 13 }}>Chơi lại</Text>
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
            {result ? `🎉 ${result.winner} thắng!` : isDraw ? 'Hoà! Chơi lại thôi 🤝' : `Lượt của ${turn}`}
          </Text>
        </View>

        {/* Board */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 294, justifyContent: 'center', backgroundColor: 'white', borderRadius: 24, padding: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }}>
          {Array(9).fill(null).map((_, i) => <CellBtn key={i} index={i} />)}
        </View>

        {(result || isDraw) && (
          <TouchableOpacity onPress={reset} style={{ marginTop: 28, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#6366F1', borderRadius: 24 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Ván mới</Text>
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
          <Text style={{ color: '#D97706', fontWeight: '600', fontSize: 13 }}>Mới</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        {/* Score */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          {[['Điểm', score], ['Cao nhất', best]].map(([label, val]) => (
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
          <Text style={{ marginTop: 12, fontSize: 12, color: '#94A3B8' }}>Hoặc dùng phím ← → ↑ ↓</Text>
        )}
      </View>

      {(gameOver || won) && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 36, alignItems: 'center', marginHorizontal: 32 }}>
            <Text style={{ fontSize: 40 }}>{won ? '🏆' : '😵'}</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 12 }}>{won ? 'Bạn thắng!' : 'Game Over'}</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 6 }}>Điểm: {score}</Text>
            <TouchableOpacity onPress={reset} style={{ marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#F59E0B', borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Chơi lại</Text>
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
          <Text style={{ color: '#059669', fontWeight: '600', fontSize: 13 }}>Mới</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%', maxWidth: 360 }}>
          {[['Lượt', moves.toString()], ['Thời gian', fmt(time)]].map(([label, val]) => (
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
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 12 }}>Hoàn thành!</Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>{moves} lượt · {fmt(time)}</Text>
            <Text style={{ fontSize: 13, color: '#10B981', marginTop: 4, fontWeight: '600' }}>
              {moves <= 12 ? '⭐⭐⭐ Xuất sắc!' : moves <= 18 ? '⭐⭐ Tốt!' : '⭐ Hoàn thành!'}
            </Text>
            <TouchableOpacity onPress={reset} style={{ marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#10B981', borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Chơi lại</Text>
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

  if (screen === 'tictactoe') return <TicTacToe onBack={() => setScreen('hub')} />;
  if (screen === 'game2048')  return <Game2048  onBack={() => setScreen('hub')} />;
  if (screen === 'memory')    return <MemoryCards onBack={() => setScreen('hub')} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
        <Ionicons name="game-controller-outline" size={24} color="#6366F1" style={{ marginRight: 10 }} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>Game</Text>
      </View>
      <GameHub onPlay={setScreen} />
    </View>
  );
}
