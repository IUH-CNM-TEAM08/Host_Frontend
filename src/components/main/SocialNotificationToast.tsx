/**
 * SocialNotificationToast
 * – Web:    toast slide từ PHẢI vào, top-right (position: fixed)
 * – Mobile: banner drop từ TOP xuống, tự dismiss sau 2.5s
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, Text, TouchableOpacity, View,
  StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SocketService from '@/src/api/socketCompat';
import { useUser } from '@/src/contexts/user/UserContext';

const { width: SW } = Dimensions.get('window');
const TOAST_W = Platform.OS === 'web' ? 320 : Math.min(SW - 32, 360);
const DISMISS_MS = 2500;

type NType = 'COMMENT' | 'REPLY' | 'NEW_POST' | 'CHAT_MESSAGE' | string;

interface ToastItem {
  id: string;
  type: NType;
  title: string;
  message: string;
}

function cfg(type: NType) {
  switch (type) {
    case 'COMMENT':      return { icon: 'chatbubble-ellipses'  as const, color: '#6d28d9', bg: '#ede9fe' };
    case 'REPLY':        return { icon: 'return-down-forward'  as const, color: '#2563eb', bg: '#dbeafe' };
    case 'NEW_POST':     return { icon: 'newspaper'            as const, color: '#059669', bg: '#d1fae5' };
    case 'CHAT_MESSAGE': return { icon: 'chatbox-ellipses'    as const, color: '#0f766e', bg: '#d1fae8' };
    case 'GROUP_INVITE': return { icon: 'people'              as const, color: '#7c3aed', bg: '#ede9fe' };
    case 'GROUP_JOIN_QUEUE': return { icon: 'hourglass-outline' as const, color: '#c2410c', bg: '#ffedd5' };
    case 'GROUP_JOIN_APPROVED': return { icon: 'checkmark-circle' as const, color: '#059669', bg: '#d1fae5' };
    case 'GROUP_JOIN_REJECTED': return { icon: 'close-circle' as const, color: '#b91c1c', bg: '#fee2e2' };
    case 'GROUP_KICKED': return { icon: 'exit-outline' as const, color: '#b45309', bg: '#fef3c7' };
    case 'GROUP_BANNED': return { icon: 'ban-outline' as const, color: '#b91c1c', bg: '#fee2e2' };
    case 'GROUP_UNBANNED': return { icon: 'checkmark-circle-outline' as const, color: '#059669', bg: '#d1fae5' };
    case 'GROUP_LEFT_SELF': return { icon: 'log-out-outline' as const, color: '#6b7280', bg: '#f3f4f6' };
    case 'GROUP_MEMBER_LEFT': return { icon: 'walk-outline' as const, color: '#0f766e', bg: '#d1fae5' };
    case 'GROUP_MEMBER_KICKED': return { icon: 'person-remove-outline' as const, color: '#b91c1c', bg: '#fee2e2' };
    default:             return { icon: 'notifications'        as const, color: '#f59e0b', bg: '#fef3c7' };
  }
}

// ──────────────────────────────── WEB TOAST ──────────────────────────────────
function WebToast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const slideX = useRef(new Animated.Value(TOAST_W + 40)).current;
  const { icon, color, bg } = cfg(item.type);

  useEffect(() => {
    Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 85, friction: 11 }).start();
    const t = setTimeout(dismiss, DISMISS_MS);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    Animated.timing(slideX, { toValue: TOAST_W + 40, duration: 270, useNativeDriver: true }).start(onDismiss);
  };

  return (
    <Animated.View style={[styles.webContainer, { transform: [{ translateX: slideX }] }]}>
      <View style={[styles.card, { borderColor: bg }]}>
        <View style={[styles.accent, { backgroundColor: color }]} />
        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          </View>
          <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
            <Ionicons name="close" size={13} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.progressTrack}>
          <ProgressFill duration={DISMISS_MS} color={color} />
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────── MOBILE BANNER ───────────────────────────────
function MobileBanner({ item, topOffset, onDismiss }: { item: ToastItem; topOffset: number; onDismiss: () => void }) {
  const slideY = useRef(new Animated.Value(-130)).current;
  const { icon, color, bg } = cfg(item.type);

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    const t = setTimeout(dismiss, DISMISS_MS);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    Animated.timing(slideY, { toValue: -130, duration: 270, useNativeDriver: true }).start(onDismiss);
  };

  return (
    <Animated.View
      style={[
        styles.mobileContainer,
        { top: topOffset, left: 16, right: 16, transform: [{ translateY: slideY }] },
      ]}
    >
      <View style={[styles.card, { borderColor: bg }]}>
        <View style={[styles.accent, { backgroundColor: color }]} />
        <View style={styles.body}>
          <View style={[styles.iconWrap, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          </View>
          <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
            <Ionicons name="close" size={13} color="#9ca3af" />
          </TouchableOpacity>
        </View>
        <View style={styles.progressTrack}>
          <ProgressFill duration={DISMISS_MS} color={color} />
        </View>
      </View>
    </Animated.View>
  );
}

function ProgressFill({ duration, color }: { duration: number; color: string }) {
  const w = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: 0, duration, useNativeDriver: false }).start();
  }, []);
  return <Animated.View style={[styles.progressFill, { backgroundColor: color, flex: w }]} />;
}

// ─────────────────────────────── MAIN EXPORT ─────────────────────────────────
export default function SocialNotificationToast() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [current, setCurrent] = useState<ToastItem | null>(null);
  /** Tránh 2 toast cho cùng 1 tin: BE emit cả `message:new` lẫn `chat:new-message` → onNewMessage gọi handler 2 lần */
  const recentChatMsgIdsRef = useRef<Set<string>>(new Set());
  const recentGroupInviteIdsRef = useRef<Set<string>>(new Set());
  const recentGroupJoinReqRef = useRef<Set<string>>(new Set());

  // consume queue
  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setCurrent(next);
    }
  }, [queue, current]);

  const push = (item: ToastItem) => setQueue(prev => [...prev, item]);

  // Socket listener for social notification and chat message events
  useEffect(() => {
    if (!user?.id) return;
    const socket = SocketService.getInstance();

    const notificationHandler = (raw: any) => {
      const type: NType = raw?.metadata?.type ?? raw?.type ?? '';
      if (!['COMMENT', 'REPLY', 'NEW_POST'].includes(type)) return;
      push({
        id: raw?._id ?? `t_${Date.now()}`,
        type,
        title: raw?.title ?? 'Thông báo',
        message: raw?.message ?? '',
      });
    };

    const chatMessageHandler = (raw: any) => {
      if (!raw) return;
      const myId = String(user?.id ?? '');
      const senderId = String(raw?.senderId ?? '');
      if (myId && senderId && senderId === myId) return;

      const msgType = String(raw?.type ?? '').toUpperCase();
      if (msgType === 'SYSTEM') return;

      const mid = String(raw?._id ?? raw?.id ?? '').trim();
      if (mid) {
        if (recentChatMsgIdsRef.current.has(mid)) return;
        recentChatMsgIdsRef.current.add(mid);
        setTimeout(() => recentChatMsgIdsRef.current.delete(mid), 5000);
      }

      const content = String(raw?.content ?? raw?.metadata?.text ?? 'Bạn có tin nhắn mới');
      push({
        id: mid || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: 'CHAT_MESSAGE',
        title: 'Tin nhắn mới',
        message: content,
      });
    };

    const conversationRenamedHandler = (raw: any) => {
      if (!raw?.conversationId || !raw?.newName) return;
      push({
        id: `rename_${raw.conversationId}_${Date.now()}`,
        type: 'CHAT_MESSAGE',
        title: 'Đổi tên nhóm',
        message: `Nhóm đã đổi tên thành "${raw.newName}"`,
      });
    };

    const groupInviteReceivedHandler = (raw: any) => {
      if (!raw) return;
      const id = String(raw.inviteId ?? '').trim();
      if (id) {
        if (recentGroupInviteIdsRef.current.has(id)) return;
        recentGroupInviteIdsRef.current.add(id);
        setTimeout(() => recentGroupInviteIdsRef.current.delete(id), 8000);
      }
      const inviter = String(raw.inviterName ?? 'Ai đó').trim() || 'Ai đó';
      const group = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      push({
        id: id || `ginv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: 'GROUP_INVITE',
        title: 'Lời mời tham gia nhóm',
        message: `${inviter} mời bạn vào «${group}»`,
      });
    };

    socket.onNotificationNew(notificationHandler);
    socket.onNewMessage(chatMessageHandler);
    socket.onConversationRenamed(conversationRenamedHandler);
    socket.onGroupInviteReceived(groupInviteReceivedHandler);

    const groupJoinRequestHandler = (raw: any) => {
      if (!raw?.conversationId || !raw?.requesterId) return;
      const key = `${raw.conversationId}_${raw.requesterId}`;
      if (recentGroupJoinReqRef.current.has(key)) return;
      recentGroupJoinReqRef.current.add(key);
      setTimeout(() => recentGroupJoinReqRef.current.delete(key), 5000);
      const who = String(raw.requesterName ?? '').trim() || 'Một thành viên';
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      push({
        id: `gjq_${key}_${Date.now()}`,
        type: 'GROUP_JOIN_QUEUE',
        title: 'Có người cần duyệt vào nhóm',
        message: `${who} xin tham gia «${g}». Mở Thông tin nhóm để duyệt hoặc từ chối.`,
      });
    };

    const groupJoinApprovedHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      push({
        id: `gja_${raw.conversationId}_${Date.now()}`,
        type: 'GROUP_JOIN_APPROVED',
        title: 'Đã được duyệt vào nhóm',
        message: `Bạn đã được thêm vào «${g}».`,
      });
    };

    const groupJoinRejectedHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      push({
        id: `gjx_${raw.conversationId}_${Date.now()}`,
        type: 'GROUP_JOIN_REJECTED',
        title: 'Yêu cầu vào nhóm bị từ chối',
        message: `Quản trị viên đã từ chối yêu cầu tham gia «${g}».`,
      });
    };

    const groupKickedHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      const actor = String(raw.actorName ?? '').trim();
      push({
        id: `gk_${raw.conversationId}_${Date.now()}`,
        type: 'GROUP_KICKED',
        title: 'Bạn đã bị kick khỏi nhóm',
        message: actor
          ? `${actor} đã xóa bạn khỏi «${g}».`
          : `Bạn không còn trong nhóm «${g}».`,
      });
    };

    const groupBannedHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      const actor = String(raw.actorName ?? '').trim();
      push({
        id: `gb_${raw.conversationId}_${Date.now()}`,
        type: 'GROUP_BANNED',
        title: 'Bạn đã bị chặn khỏi nhóm',
        message: actor
          ? `${actor} đã chặn bạn khỏi «${g}».`
          : `Bạn đã bị chặn khỏi «${g}».`,
      });
    };

    const groupUnbannedHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      const actor = String(raw.actorName ?? '').trim();
      push({
        id: `gub_${raw.conversationId}_${Date.now()}`,
        type: 'GROUP_UNBANNED',
        title: 'Bạn đã được bỏ chặn',
        message: actor
          ? `${actor} đã bỏ chặn bạn khỏi «${g}».`
          : `Bạn đã được bỏ chặn khỏi «${g}».`,
      });
    };

    const groupLeftSelfHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      push({
        id: `gls_${raw.conversationId}_${Date.now()}`,
        type: 'GROUP_LEFT_SELF',
        title: 'Bạn đã rời nhóm',
        message: `Bạn đã rời khỏi «${g}».`,
      });
    };

    const groupMemberLeftHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      const member = String(raw.memberName ?? 'Một thành viên').trim() || 'Một thành viên';
      push({
        id: `gml_${raw.conversationId}_${raw.memberId ?? 'm'}_${Date.now()}`,
        type: 'GROUP_MEMBER_LEFT',
        title: 'Thành viên đã rời nhóm',
        message: `${member} đã rời «${g}».`,
      });
    };

    const groupMemberKickedHandler = (raw: any) => {
      if (!raw?.conversationId) return;
      const g = String(raw.groupName ?? 'Nhóm').trim() || 'Nhóm';
      const member = String(raw.memberName ?? 'Một thành viên').trim() || 'Một thành viên';
      const actor = String(raw.actorName ?? 'Quản trị viên').trim() || 'Quản trị viên';
      push({
        id: `gmk_${raw.conversationId}_${raw.memberId ?? 'm'}_${Date.now()}`,
        type: 'GROUP_MEMBER_KICKED',
        title: 'Thành viên bị xóa khỏi nhóm',
        message: `${actor} đã xóa ${member} khỏi «${g}».`,
      });
    };

    socket.onGroupJoinRequest(groupJoinRequestHandler);
    socket.onGroupJoinApproved(groupJoinApprovedHandler);
    socket.onGroupJoinRejected(groupJoinRejectedHandler);
    socket.onGroupKickedFrom(groupKickedHandler);
    socket.onGroupBannedFrom(groupBannedHandler);
    socket.onGroupUnbannedFrom(groupUnbannedHandler);
    socket.onGroupLeftFrom(groupLeftSelfHandler);
    socket.onGroupMemberLeft(groupMemberLeftHandler);
    socket.onGroupMemberKicked(groupMemberKickedHandler);

    return () => {
      socket.removeNotificationNewListener(notificationHandler);
      socket.removeMessageListener(chatMessageHandler);
      socket.removeConversationRenamedListener(conversationRenamedHandler);
      socket.removeGroupInviteReceivedListener(groupInviteReceivedHandler);
      socket.removeGroupJoinRequestListener(groupJoinRequestHandler);
      socket.removeGroupJoinApprovedListener(groupJoinApprovedHandler);
      socket.removeGroupJoinRejectedListener(groupJoinRejectedHandler);
      socket.removeGroupKickedFromListener(groupKickedHandler);
      socket.removeGroupBannedFromListener(groupBannedHandler);
      socket.removeGroupUnbannedFromListener(groupUnbannedHandler);
      socket.removeGroupLeftFromListener(groupLeftSelfHandler);
      socket.removeGroupMemberLeftListener(groupMemberLeftHandler);
      socket.removeGroupMemberKickedListener(groupMemberKickedHandler);
    };
  }, [user?.id]);

  if (!current) return null;

  if (Platform.OS === 'web') {
    return (
      <WebToast
        key={current.id}
        item={current}
        onDismiss={() => setCurrent(null)}
      />
    );
  }

  return (
    <MobileBanner
      key={current.id}
      item={current}
      topOffset={insets.top + 8}
      onDismiss={() => setCurrent(null)}
    />
  );
}

// ──────────────────────────────── STYLES ─────────────────────────────────────
const styles = StyleSheet.create({
  webContainer: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 20,
    right: 20,
    width: TOAST_W,
    zIndex: 2147483647, // Max z-index
  },
  mobileContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 2147483647,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    borderWidth: 1,
  },
  accent: { height: 3 },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 1 },
  message: { fontSize: 12, color: '#4b5563', lineHeight: 16 },
  closeBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { height: 3, backgroundColor: '#f3f4f6', flexDirection: 'row' },
  progressFill: { height: '100%' },
});
