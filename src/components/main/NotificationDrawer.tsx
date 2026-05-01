import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal,
  ActivityIndicator, Platform, Pressable, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications, AppNotification } from '@/src/contexts/NotificationContext';
import { useRouter } from 'expo-router';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function getIcon(type?: string): { name: any; color: string; bg: string } {
  switch (type) {
    case 'COMMENT': return { name: 'chatbubble-ellipses', color: '#6d28d9', bg: '#ede9fe' };
    case 'REPLY':   return { name: 'return-down-forward', color: '#2563eb', bg: '#dbeafe' };
    case 'NEW_POST': return { name: 'newspaper', color: '#059669', bg: '#d1fae5' };
    case 'MENTION': return { name: 'at', color: '#dc2626', bg: '#fee2e2' };
    case 'GROUP_INVITE': return { name: 'people', color: '#7c3aed', bg: '#ede9fe' };
    case 'GROUP_INVITE_DECLINED': return { name: 'close-circle', color: '#b91c1c', bg: '#fee2e2' };
    case 'GROUP_KICKED': return { name: 'exit-outline', color: '#b45309', bg: '#fef3c7' };
    case 'GROUP_BANNED': return { name: 'ban-outline', color: '#b91c1c', bg: '#fee2e2' };
    case 'GROUP_LEFT_SELF': return { name: 'log-out-outline', color: '#6b7280', bg: '#f3f4f6' };
    default:        return { name: 'notifications', color: '#f59e0b', bg: '#fef3c7' };
  }
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function NotifItem({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const { name, color, bg } = getIcon(item.metadata?.type);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.item, !item.isRead && styles.itemUnread]}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={name} size={18} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        {item.title ? (
          <Text style={styles.itemTitle}>{item.title}</Text>
        ) : null}
        <Text style={styles.itemMsg} numberOfLines={2}>{item.message ?? ''}</Text>
        <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={styles.dot} />}
    </TouchableOpacity>
  );
}

export default function NotificationDrawer({ visible, onClose }: Props) {
  const { notifications, unreadCount, loading, markAllRead, markOneRead, fetchNotifications } = useNotifications();
  const router = useRouter();
  /** Đếm từ từng item — tránh mất nút "Đọc tất cả" khi unreadCount từ API lệch */
  const hasUnread =
    unreadCount > 0 || notifications.some((n) => !n.isRead);

  // ── Web draggable state ──
  const [pos, setPos] = useState({ x: -1, y: -1 }); // -1 = use default position
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    dragging: false, startX: 0, startY: 0, origX: 0, origY: 0,
  });

  // Reset position when drawer is hidden then shown again
  useEffect(() => {
    if (!visible) setPos({ x: -1, y: -1 });
  }, [visible]);

  // Web drag handlers (attached to document)
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    };

    const handleMouseUp = () => {
      dragRef.current.dragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [visible]);

  const onHeaderMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    const nativeEvent = e.nativeEvent ?? e;
    const currentX = pos.x === -1 ? (window.innerWidth - 340 - 88) : pos.x;
    const currentY = pos.y === -1 ? 70 : pos.y;
    dragRef.current = {
      dragging: true,
      startX: nativeEvent.clientX ?? nativeEvent.pageX,
      startY: nativeEvent.clientY ?? nativeEvent.pageY,
      origX: currentX,
      origY: currentY,
    };
    // If no custom position yet, initialize it
    if (pos.x === -1) {
      setPos({ x: currentX, y: currentY });
    }
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  };

  const handlePress = async (item: AppNotification) => {
    if (!item.isRead) await markOneRead(item._id);
    const postId = item.metadata?.postId;
    const convId = (item.metadata as any)?.conversationId;
    if (postId) {
      onClose();
      router.push('/(main)/timeline' as any);
    } else if (convId) {
      onClose();
      // Navigate to chat with this conversation
    }
  };

  const isWeb = Platform.OS === 'web';

  const content = (
    <View style={[styles.panel, isWeb && styles.panelWeb]}>
      {/* Header — draggable on web */}
      <View
        style={styles.header}
        // @ts-ignore — web-only mouse event
        onMouseDown={isWeb ? onHeaderMouseDown : undefined}
      >
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                if (hasUnread) void markAllRead();
              }}
              disabled={!hasUnread}
              style={[styles.readAllBtn, !hasUnread && styles.readAllBtnDisabled]}
            >
              <Ionicons name="checkmark-done-outline" size={14} color={hasUnread ? '#6d28d9' : '#9ca3af'} />
              <Text style={[styles.readAllText, !hasUnread && styles.readAllTextDisabled]}>
                Đọc tất cả
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#6d28d9" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="notifications-off-outline" size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>Không có thông báo</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n._id}
          renderItem={({ item }) => <NotifItem item={item} onPress={() => handlePress(item)} />}
          onRefresh={fetchNotifications}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );

  if (isWeb) {
    // Web: floating panel — draggable
    if (!visible) return null;

    const webStyle: any = pos.x !== -1
      ? { position: 'fixed' as any, top: pos.y, left: pos.x, right: 'auto', zIndex: 999 }
      : styles.webOverlay;

    if (pos.x !== -1) {
      // Custom dragged position — no overlay backdrop
      return (
        <View style={webStyle}>
          {content}
        </View>
      );
    }

    return (
      <Pressable style={styles.webOverlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          {content}
        </Pressable>
      </Pressable>
    );
  }

  // Mobile: slide-up Modal
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.mobileOverlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          {content}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: 520,
    width: '100%',
  },
  panelWeb: {
    borderRadius: 16,
    width: 340,
    maxHeight: 480,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    cursor: Platform.OS === 'web' ? 'grab' : undefined,
  } as any,
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  readAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ede9fe', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  readAllText: { fontSize: 12, color: '#6d28d9', fontWeight: '600' },
  readAllBtnDisabled: { backgroundColor: '#f3f4f6' },
  readAllTextDisabled: { color: '#9ca3af' },
  closeBtn: { padding: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f9fafb',
  },
  itemUnread: { backgroundColor: '#faf5ff' },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  itemTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 2 },
  itemMsg: { fontSize: 13, color: '#374151', lineHeight: 18 },
  itemTime: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#6d28d9', marginLeft: 8,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, minHeight: 160 },
  emptyText: { color: '#9ca3af', fontSize: 14, marginTop: 10 },
  mobileOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  webOverlay: {
    position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999,
    alignItems: 'flex-end',
    paddingTop: 70, paddingRight: 88,
  },
});
