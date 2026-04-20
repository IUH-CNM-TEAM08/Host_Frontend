import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { notificationService } from '@/src/api/services/notification.service';
import SocketService from '@/src/api/socketCompat';
import { useUser } from '@/src/contexts/user/UserContext';

export interface AppNotification {
  _id: string;
  userId: string;
  title?: string;
  message?: string;
  isRead: boolean;
  createdAt?: string;
  metadata?: {
    type?: 'COMMENT' | 'REPLY' | 'NEW_POST' | 'MENTION' | string;
    postId?: string;
    commentId?: string;
  };
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  fetchNotifications: async () => {},
  markAllRead: async () => {},
  markOneRead: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const socketService = useRef(SocketService.getInstance()).current;

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res: any = await notificationService.list(user.id, 0, 30);
      const raw = res?.data ?? res;
      const items: AppNotification[] = Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw)
        ? raw
        : [];
      setNotifications(items);
      const derivedUnread = items.filter((n) => !n.isRead).length;
      const apiUnread = typeof raw?.unreadCount === 'number' ? raw.unreadCount : undefined;
      setUnreadCount(apiUnread !== undefined ? Math.max(apiUnread, derivedUnread) : derivedUnread);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time: lắng nghe notification:new
  useEffect(() => {
    if (!user?.id) return;
    const handleNew = (notif: any) => {
      const n: AppNotification = {
        _id: notif?._id ?? notif?.id ?? String(Date.now()),
        userId: notif?.userId ?? user.id,
        title: notif?.title,
        message: notif?.message,
        isRead: false,
        createdAt: notif?.createdAt ?? new Date().toISOString(),
        metadata: notif?.metadata
          ? (typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata)
          : undefined,
      };
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((c) => c + 1);
    };
    socketService.onNotificationNew(handleNew);
    return () => socketService.removeNotificationNewListener(handleNew);
  }, [user?.id, socketService]);

  // Real-time: lắng nghe notification:deleted
  useEffect(() => {
    if (!user?.id) return;
    const handleDelete = (payload: { notificationId: string }) => {
      setNotifications((prev) => {
        const target = prev.find((n) => n._id === payload.notificationId);
        if (!target) return prev;
        if (!target.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n._id !== payload.notificationId);
      });
    };
    socketService.onNotificationDeleted(handleDelete);
    return () => socketService.removeNotificationDeletedListener(handleDelete);
  }, [user?.id, socketService]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    try {
      await notificationService.markAllRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, [user?.id]);

  const markOneRead = useCallback(async (id: string) => {
    if (!user?.id) return;
    try {
      await notificationService.markRead(id, user.id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, [user?.id]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, fetchNotifications, markAllRead, markOneRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
