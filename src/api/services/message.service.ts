import type { AxiosRequestConfig } from 'axios';
import { del, get, post, put } from './http';
import { mapApiMessageToModel, unwrapArray, unwrapData } from '@/src/models/mappers';
import { callService } from './communication.service';
import { UserStorage } from '@/src/storage/UserStorage';

export const messageService = {
  send: <T = unknown>(body: Record<string, unknown>) => post<T>('/api/messages', body),

  listByConversation: <T = unknown>(conversationId: string, page = 0, size = 50, userId?: string) =>
    get<T>(`/api/messages/conversation/${encodeURIComponent(conversationId)}`, { page, size, userId }),

  clearHistory: (conversationId: string, userId: string) =>
    del(`/api/messages/conversation/${encodeURIComponent(conversationId)}/history`, { userId }),

  search: <T = unknown>(conversationId: string, query: string, userId?: string, senderId?: string) =>
    get<T>('/api/messages/search', { conversationId, query, userId, senderId }),

  react: <T = unknown>(messageId: string, userId: string, emoji: string) =>
    post<T>(`/api/messages/${encodeURIComponent(messageId)}/react`, { userId, emoji }),
  removeReaction: (messageId: string, userId: string) =>
    del(`/api/messages/${encodeURIComponent(messageId)}/react`, { userId }),

  /** Thu hồi — xóa cho mọi người (backend yêu cầu JWT, chỉ người gửi) */
  deleteMessage: async (messageId: string) => {
    const res: any = await del<any>(`/api/messages/${encodeURIComponent(messageId)}`);
    if (res === '' || res === undefined || res === null) {
      return { success: true, statusMessage: 'Đã thu hồi tin nhắn' };
    }
    return res;
  },

  /** Xóa phía tôi — chỉ ẩn với tài khoản hiện tại */
  deleteMessageForMe: async (messageId: string) => {
    const res: any = await del<any>(
      `/api/messages/${encodeURIComponent(messageId)}/for-me`
    );
    if (res === '' || res === undefined || res === null) {
      return { success: true, statusMessage: 'Đã xóa trên thiết bị của bạn' };
    }
    return res;
  },

  pin: <T = unknown>(messageId: string) => post<T>(`/api/messages/${encodeURIComponent(messageId)}/pin`),
  unpin: <T = unknown>(messageId: string) => del<T>(`/api/messages/${encodeURIComponent(messageId)}/pin`),
  getPinned: <T = unknown>(conversationId: string) =>
    get<T>(`/api/messages/conversation/${encodeURIComponent(conversationId)}/pinned`),
  reorderPinned: <T = unknown>(conversationId: string, messageIds: string[]) =>
    put<T>(`/api/messages/conversation/${encodeURIComponent(conversationId)}/pinned/order`, { messageIds }),

  getReadReceipts: <T = unknown>(conversationId: string, messageId: string) =>
    get<T>(`/api/messages/conversation/${encodeURIComponent(conversationId)}/read-receipts/${encodeURIComponent(messageId)}`),

  forward: <T = unknown>(messageId: string, targetConversationId: string, senderId?: string) =>
    post<T>(
      `/api/messages/${encodeURIComponent(messageId)}/forward`,
      senderId
        ? { targetConversationId, senderId }
        : { targetConversationId },
    ),

  edit: <T = unknown>(messageId: string, content: string, editorId?: string) =>
    put<T>(`/api/messages/${encodeURIComponent(messageId)}`, { content, editorId }),

  markRead: <T = unknown>(conversationId: string, userId: string, messageId: string) =>
    put<T>('/api/messages/read', undefined, { conversationId, userId, messageId }),
  markDelivered: <T = unknown>(conversationId: string, userId: string, messageId: string) =>
    put<T>('/api/messages/delivered', undefined, { conversationId, userId, messageId }),

  upload: <T = unknown>(fileFormData: FormData) => post<T>('/api/messages/upload', fileFormData),
  exportBackup: (userId: string) => get<ArrayBuffer>('/api/messages/backup/export', { userId }, { responseType: 'arraybuffer' }),
  importBackup: <T = unknown>(userId: string, fileFormData: FormData, config?: AxiosRequestConfig) =>
    post<T>('/api/messages/backup/import', fileFormData, { userId }, { ...config, headers: { ...(config?.headers ?? {}), 'Content-Type': 'multipart/form-data' } }),

  // Legacy adapters (for older FE components)
  getMessages: async (conversationId: string, page = 0, size = 50, userId?: string) => {
    const res: any = await messageService.listByConversation<any>(conversationId, page, size, userId);
    const root = unwrapData<any>(res);
    const rows = Array.isArray(root?.messages) ? root.messages : unwrapArray<any>(res);
    const messages = rows.map(mapApiMessageToModel);
    const total = Number.isFinite(Number(root?.total)) ? Number(root.total) : messages.length;
    const currentPage = Number.isFinite(Number(root?.page)) ? Number(root.page) : page;
    const currentSize = Number.isFinite(Number(root?.size)) ? Number(root.size) : size;
    const hasMore = (currentPage + 1) * currentSize < total;

    return {
      success: res?.success ?? true,
      statusMessage: res?.message ?? 'Success',
      messages,
      total,
      page: currentPage,
      size: currentSize,
      hasMore,
      isNewer: false,
      data: messages,
    };
  },

  makeACall: async (conversationId: string, type = 'VIDEO') => {
    const currentUser = await UserStorage.getUser();
    const initiatorId = currentUser?._id ?? currentUser?.id ?? '';
    const res: any = await callService.initiate<any>(conversationId, initiatorId, type);
    const data = unwrapData<any>(res) as {
      session?: unknown;
      messageId?: string;
    };
    return { success: res?.success ?? true, message: res?.message, data };
  },

  joinCall: async (callId: string) => {
    const currentUser = await UserStorage.getUser();
    const userId = currentUser?._id ?? currentUser?.id ?? '';
    const res: any = await callService.join<any>(callId, userId);
    return { success: res?.success ?? true, message: res?.message, data: unwrapData<any>(res) };
  },

  endCall: async (callId: string) => {
    const currentUser = await UserStorage.getUser();
    const userId = currentUser?._id ?? currentUser?.id ?? '';
    const res: any = await callService.end<any>(callId, userId);
    return { success: res?.success ?? true, message: res?.message, data: unwrapData<any>(res) };
  },

  rejectCall: async (callId: string) => {
    const currentUser = await UserStorage.getUser();
    const userId = currentUser?._id ?? currentUser?.id ?? '';
    const res: any = await callService.missed<any>(callId, userId);
    return { success: res?.success ?? true, message: res?.message, data: unwrapData<any>(res) };
  },
};
