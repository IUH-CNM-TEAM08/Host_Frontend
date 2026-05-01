import { post } from './http';

export const internalService = {
  kickSession: <T = unknown>(userId: string, reason?: string) => post<T>('/api/internal/session/kick', { userId, reason }),

  broadcastChatMessage: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/internal/conversation/chat-message', body),
  syncConversationToUser: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/internal/conversation/sync-user', body),
  broadcastPrivateSettings: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/internal/conversation/private-settings', body),

  broadcastDueReminder: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/internal/reminder/due', body),

  pushFriendshipWs: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/internal/notification/push-friendship-ws', body),
  pushSocialWs: <T = unknown>(body: Record<string, unknown>) =>
    post<T>('/api/internal/notification/push-social-ws', body),
};
