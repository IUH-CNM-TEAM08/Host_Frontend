/**
 * MessageReaction.tsx — Zalo-style reactions
 *
 * Web:    Picker pill nổi gần bubble (floating, không modal)
 * Mobile: Picker Modal hiện GIỮA màn hình khi nhấn ❤
 * Cả hai: Dùng chung bộ icon FontAwesome màu sắc (❤ 😊 😮 😢 👍 +)
 */

import React from 'react';
import {
  View, Text, TouchableOpacity, Modal,
  Pressable, Platform, useWindowDimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { Shadows } from '@/src/styles/Shadow';

// ─── Dữ liệu emoji ────────────────────────────────────────────────────────────

export const REACTIONS = [
  { id: 'heart',  icon: 'heart'     as const, color: '#e31b23', emoji: '❤️' },
  { id: 'haha',   icon: 'smile-o'   as const, color: '#FFD93B', emoji: '😂' },
  { id: 'wow',    icon: 'meh-o'     as const, color: '#FFD93B', emoji: '😮' },
  { id: 'sad',    icon: 'frown-o'   as const, color: '#FFD93B', emoji: '😢' },
  { id: 'angry',  icon: 'frown-o'   as const, color: '#F97316', emoji: '😡' },
  { id: 'like',   icon: 'thumbs-up' as const, color: '#FFB800', emoji: '👍' },
] as const;

const ID_TO_EMOJI: Record<string, string> = Object.fromEntries(
  REACTIONS.map(r => [r.id, r.emoji])
);
const EMOJI_TO_ID: Record<string, string> = Object.fromEntries(
  REACTIONS.map(r => [r.emoji, r.id])
);

function normalizeEmoji(raw: string): string {
  return ID_TO_EMOJI[raw] ?? raw;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReactionEntry = { userId: string; emoji: string; reactedAt?: string };

interface Props {
  messageId: string;
  conversationId: string;
  isVisible: boolean;
  onToggle: () => void;
  isSender: boolean;
  currentUserId: string;
  reactions: ReactionEntry[];
  onReact: (messageId: string, conversationId: string, emoji: string) => void;
  onUnreact: (messageId: string, conversationId: string, emoji: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function groupReactions(reactions: ReactionEntry[]) {
  const map: Record<string, number> = {};
  for (const r of reactions) {
    const key = normalizeEmoji(r.emoji);
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([emoji, count]) => ({ emoji, count, id: EMOJI_TO_ID[emoji] ?? emoji }))
    .sort((a, b) => b.count - a.count);
}

function myCount(reactions: ReactionEntry[], userId: string, rawEmoji: string): number {
  const norm = normalizeEmoji(rawEmoji);
  return reactions.filter(r => r.userId === userId && normalizeEmoji(r.emoji) === norm).length;
}

function myTotalCount(reactions: ReactionEntry[], userId: string): number {
  return reactions.filter(r => r.userId === userId).length;
}

function myTopEmoji(reactions: ReactionEntry[], userId: string): string | null {
  const mine = reactions.filter(r => r.userId === userId);
  if (mine.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const r of mine) {
    const key = normalizeEmoji(r.emoji);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── ReactionSummary — bên ngoài bubble ──────────────────────────────────────

interface ReactionSummaryProps {
  reactions: ReactionEntry[];
  currentUserId: string;
  isSender: boolean;
  messageId: string;
  conversationId: string;
  onReact: (messageId: string, conversationId: string, emoji: string) => void;
  onUnreact: (messageId: string, conversationId: string, emoji: string) => void;
}

export function ReactionSummary({
  reactions, currentUserId, isSender,
  messageId, conversationId, onReact, onUnreact,
}: ReactionSummaryProps) {
  const grouped = groupReactions(reactions);
  if (grouped.length === 0) return null;
  return (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', marginTop: 4,
      justifyContent: isSender ? 'flex-start' : 'flex-end',
      gap: 4, paddingHorizontal: 4,
    }}>
      {grouped.map(({ emoji, count, id }) => {
        const mine = myCount(reactions, currentUserId, emoji);
        const isMe = mine > 0;
        return (
          <TouchableOpacity
            key={id} activeOpacity={0.75}
            onPress={() => {
              if (isMe) onUnreact(messageId, conversationId, emoji);
              else onReact(messageId, conversationId, emoji);
            }}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: isMe ? '#dbeafe' : '#f3f4f6',
              borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3,
              borderWidth: 1, borderColor: isMe ? '#93c5fd' : '#e5e7eb',
            }}
          >
            <Text style={{ fontSize: 13 }}>{emoji}</Text>
            <Text style={{
              fontSize: 11, color: isMe ? '#1d4ed8' : '#6b7280',
              marginLeft: 3, fontWeight: isMe ? '700' : '400',
            }}>{count}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Shared: Pill nội dung icon ───────────────────────────────────────────────

function ReactionIcons({
  reactions, currentUserId,
  onPickEmoji, onClose, size = 22,
}: {
  reactions: ReactionEntry[];
  currentUserId: string;
  onPickEmoji: (r: typeof REACTIONS[number]) => void;
  onClose: () => void;
  size?: number;
}) {
  return (
    <>
      {REACTIONS.map((r) => {
        const cnt = myCount(reactions, currentUserId, r.emoji);
        const active = cnt > 0;
        return (
          <TouchableOpacity
            key={r.id}
            onPress={() => onPickEmoji(r)}
            activeOpacity={0.7}
            style={{
              marginHorizontal: 3,
              padding: 5,
              borderRadius: 999,
              backgroundColor: active ? '#dbeafe' : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              transform: [{ scale: active ? 1.1 : 1 }],
              borderWidth: active ? 1 : 0,
              borderColor: active ? '#93c5fd' : 'transparent',
            }}
          >
            <FontAwesome name={r.icon} size={size} color={r.color} />
            {cnt > 0 && (
              <View style={{
                position: 'absolute', top: 0, right: 0,
                backgroundColor: '#ef4444', borderRadius: 8,
                minWidth: 13, height: 13,
                alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: 2, borderWidth: 1, borderColor: '#fff',
              }}>
                <Text style={{ color: '#fff', fontSize: 7, fontWeight: '700' }}>{cnt}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onClose}
        style={{
          marginHorizontal: 3, padding: 5, borderRadius: 999,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <FontAwesome name="plus" size={14} color="#9ca3af" />
      </TouchableOpacity>
    </>
  );
}

// ─── Component chính ──────────────────────────────────────────────────────────

export default function MessageReaction({
  messageId, conversationId,
  isVisible, onToggle,
  isSender, currentUserId,
  reactions, onReact, onUnreact,
}: Props) {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const pickerMaxWidth = Math.min(width - 16, 292);
  const topEmoji = myTopEmoji(reactions, currentUserId);
  const totalMine = myTotalCount(reactions, currentUserId);

  const handlePickEmoji = (r: typeof REACTIONS[number]) => {
    onReact(messageId, conversationId, r.emoji);
    onToggle();
  };

  // ── Trigger button ─────────────────────────────────────────────────────────
  const triggerBtn = (
    <TouchableOpacity
      onPress={onToggle}
      style={{
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: topEmoji ? '#fff' : '#f3f4f6',
        borderWidth: 1.5,
        borderColor: topEmoji ? '#93c5fd' : '#e5e7eb',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {topEmoji ? (
        <Text style={{ fontSize: 12, lineHeight: 16 }}>{topEmoji}</Text>
      ) : (
        <FontAwesome name="heart" size={10} color="#d1d5db" />
      )}
    </TouchableOpacity>
  );

  // ══════════════════════════════════════════════════════════════════
  // WEB — Picker pill nổi gần bubble (không dùng Modal)
  // ══════════════════════════════════════════════════════════════════
  if (isWeb) {
    return (
      <View style={{
        position: 'absolute',
        bottom: -12,
        ...(isSender ? { left: -12 } : { right: -12 }),
        zIndex: 10,
      }}>
        {triggerBtn}

        {/* Badge */}
        {totalMine > 1 && (
          <View style={{
            position: 'absolute', top: -5, right: -6,
            backgroundColor: '#3b82f6', borderRadius: 8,
            minWidth: 14, height: 14,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 2,
          }}>
            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{totalMine}</Text>
          </View>
        )}

        {/* Floating picker pill — hiện phía trên nút */}
        {isVisible && (
          <View style={[
            {
              position: 'absolute',
              bottom: 30,
              backgroundColor: '#fff',
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 4,
              flexDirection: 'row',
              alignItems: 'center',
              width: pickerMaxWidth,
              maxWidth: pickerMaxWidth,
              justifyContent: 'space-between',
              ...(isSender ? { right: 0 } : { left: 0 }),
            },
            Shadows.lg,
          ]}>
            <ReactionIcons
              reactions={reactions}
              currentUserId={currentUserId}
              onPickEmoji={handlePickEmoji}
              onClose={onToggle}
              size={20}
            />
          </View>
        )}
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // MOBILE — Trigger ở góc bubble + Modal giữa màn hình
  // ══════════════════════════════════════════════════════════════════
  return (
    <View style={{
      position: 'absolute',
      bottom: -12,
      ...(isSender ? { left: -12 } : { right: -12 }),
      zIndex: 10,
    }}>
      {triggerBtn}

      {/* Badge */}
      {totalMine > 1 && (
        <View style={{
          position: 'absolute', top: -5, right: -6,
          backgroundColor: '#3b82f6', borderRadius: 8,
          minWidth: 14, height: 14,
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 2,
        }}>
          <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{totalMine}</Text>
        </View>
      )}

      {/* Modal giữa màn hình cho mobile */}
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={onToggle}
        statusBarTranslucent
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.3)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={onToggle}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                borderRadius: 999,
                paddingVertical: 10,
                paddingHorizontal: 8,
              },
              Shadows.lg,
            ]}>
              <ReactionIcons
                reactions={reactions}
                currentUserId={currentUserId}
                onPickEmoji={handlePickEmoji}
                onClose={onToggle}
                size={26}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}