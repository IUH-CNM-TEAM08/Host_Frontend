import { del, get, post, put } from './http';

export const notificationService = {
  create: <T = unknown>(body: Record<string, unknown>) => post<T>('/api/notifications', body),
  list: <T = unknown>(userId: string, page = 0, size = 20) =>
    get<T>('/api/notifications', { userId, page, size }),
  countUnread: <T = unknown>(userId: string) => get<T>('/api/notifications/count', { userId }),
  markAllRead: <T = unknown>(userId: string) => put<T>('/api/notifications/read-all', undefined, { userId }),
  markRead: <T = unknown>(notificationId: string, userId: string) =>
    put<T>(`/api/notifications/${encodeURIComponent(notificationId)}/read`, undefined, { userId }),
  delete: (notificationId: string) => del(`/api/notifications/${encodeURIComponent(notificationId)}`),

  pushFriendshipWs: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/notifications/internal/friendship-ws', body),
  pushSocialWs: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/notifications/internal/social-ws', body),
};
