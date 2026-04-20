import { del, get, post, put } from './http';

export const presenceService = {
  getUser: <T = unknown>(userId: string) => get<T>(`/api/presence/user/${encodeURIComponent(userId)}`),
  getOnline: <T = unknown>() => get<T>('/api/presence/online'),
  getAllUsers: <T = unknown>(userIds: string[]) => post<T>('/api/presence/all', { userIds }),
  getSessions: <T = unknown>(userId: string) => get<T>(`/api/presence/sessions/${encodeURIComponent(userId)}`),
  update: <T = unknown>(userId: string, status: string) => post<T>('/api/presence/update', { userId, status }),
  heartbeat: <T = unknown>(userId: string) => post<T>('/api/presence/heartbeat', { userId }),
};

export const blockSettingService = {
  status: <T = unknown>(blockerId: string, blockedId: string) =>
    get<T>('/api/block-settings/status', { blockerId, blockedId }),
  upsert: <T = unknown>(body: {
    conversationId: string;
    blockerId: string;
    blockedId: string;
    messageBlocked?: boolean;
    callBlocked?: boolean;
  }) =>
    put<T>('/api/block-settings', body),
  clear: (conversationId: string, blockerId: string, blockedId: string) =>
    del('/api/block-settings', { conversationId, blockerId, blockedId }),
  isMessageAllowed: <T = unknown>(senderId: string, receiverId: string) =>
    get<T>('/api/block-settings/message-allowed', { senderId, receiverId }),
  isCallAllowed: <T = unknown>(callerId: string, receiverId: string) =>
    get<T>('/api/block-settings/call-allowed', { callerId, receiverId }),
};

export const callService = {
  initiate: <T = unknown>(conversationId: string, initiatorId: string, type: string) =>
    post<T>('/api/calls/initiate', { conversationId, initiatorId, type }),
  join: <T = unknown>(callId: string, userId: string) =>
    post<T>(`/api/calls/${encodeURIComponent(callId)}/join`, { userId }),
  end: <T = unknown>(callId: string, userId?: string) =>
    post<T>(`/api/calls/${encodeURIComponent(callId)}/end`, userId ? { userId } : undefined),
  missed: <T = unknown>(callId: string, userId?: string) =>
    post<T>(`/api/calls/${encodeURIComponent(callId)}/missed`, userId ? { userId } : undefined),
  getConversationHistory: <T = unknown>(conversationId: string) =>
    get<T>(`/api/calls/conversation/${encodeURIComponent(conversationId)}`),
  getPresence: <T = unknown>(userId: string) => get<T>(`/api/calls/presence/${encodeURIComponent(userId)}`),
};
