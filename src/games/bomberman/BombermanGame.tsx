import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updateBot } from './engine/ai';
import { movePlayer, placeBomb, updateGame } from './engine/game';
import { createGameState } from './engine/map';
import { Direction, TileType, type GameState } from './engine/types';

const TILE = 28;
const AVATARS = [
  require('@/resources/assets/game/Boom-Mobile-NV-1.jpg'),
  require('@/resources/assets/game/Boom-Mobile-NV-2.jpg'),
];

export default function BombermanGame({ onBack }: { onBack: () => void }) {
  const stateRef = useRef<GameState>(createGameState(1));
  const [, forceRender] = useState(0);

  const tick = () => forceRender((v) => v + 1);

  useEffect(() => {
    const id = setInterval(() => {
      if (stateRef.current.status !== 'playing') return;
      for (const player of stateRef.current.players) {
        if (player.isBot && player.alive) {
          updateBot(stateRef.current, player, 120);
        }
      }
      updateGame(stateRef.current, 120);
      tick();
    }, 120);
    return () => clearInterval(id);
  }, []);

  const state = stateRef.current;

  const move = (d: Direction) => {
    if (state.status !== 'playing') return;
    movePlayer(state, 0, d);
    tick();
  };

  const plant = () => {
    if (state.status !== 'playing') return;
    placeBomb(state, 0);
    tick();
  };

  const restart = () => {
    stateRef.current = createGameState(1);
    tick();
  };

  const board = useMemo(() => state.map, [state]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
        <TouchableOpacity onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', flex: 1 }}>Bomberman</Text>
        <TouchableOpacity onPress={restart} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F3E8FF', borderRadius: 16 }}>
          <Text style={{ color: '#7C3AED', fontWeight: '700' }}>Restart</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <View style={{ width: state.cols * TILE, height: state.rows * TILE, borderRadius: 10, overflow: 'hidden' }}>
          {board.map((row, y) => (
            <View key={y} style={{ flexDirection: 'row' }}>
              {row.map((tile, x) => {
                const bomb = state.bombs.find((b) => b.x === x && b.y === y);
                const exp = state.explosions.find((e) => e.x === x && e.y === y);
                const p = state.players.find((pl) => pl.alive && pl.x === x && pl.y === y);
                return (
                  <View
                    key={`${x}-${y}`}
                    style={{
                      width: TILE, height: TILE, borderWidth: 0.5, borderColor: '#cbd5e1',
                      backgroundColor: tile === TileType.WALL ? '#1e293b' : tile === TileType.BREAKABLE ? '#b45309' : '#dbeafe',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {exp ? <Ionicons name="flame" size={15} color="#ef4444" /> : null}
                    {!exp && bomb ? <Ionicons name="radio-button-on" size={13} color="#111827" /> : null}
                    {!exp && p ? <Image source={AVATARS[p.id]} style={{ width: 22, height: 22, borderRadius: 11 }} /> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16, alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => move(Direction.UP)} style={ctrlBtn}><Ionicons name="chevron-up" size={26} color="#7C3AED" /></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => move(Direction.LEFT)} style={ctrlBtn}><Ionicons name="chevron-back" size={26} color="#7C3AED" /></TouchableOpacity>
            <TouchableOpacity onPress={plant} style={[ctrlBtn, { backgroundColor: '#ede9fe' }]}><Ionicons name="flash" size={23} color="#7C3AED" /></TouchableOpacity>
            <TouchableOpacity onPress={() => move(Direction.RIGHT)} style={ctrlBtn}><Ionicons name="chevron-forward" size={26} color="#7C3AED" /></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => move(Direction.DOWN)} style={ctrlBtn}><Ionicons name="chevron-down" size={26} color="#7C3AED" /></TouchableOpacity>
        </View>

        {state.status === 'gameover' && (
          <View style={{ marginTop: 12, backgroundColor: state.winner === 0 ? '#dcfce7' : '#fee2e2', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ fontWeight: '700', color: state.winner === 0 ? '#166534' : '#991b1b' }}>
              {state.winner === 0 ? 'Bạn thắng!' : 'Bot thắng!'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const ctrlBtn = {
  width: 56, height: 56, borderRadius: 16, backgroundColor: '#F3E8FF',
  alignItems: 'center' as const, justifyContent: 'center' as const,
};
