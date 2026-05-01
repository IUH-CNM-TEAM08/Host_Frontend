/**
 * Admin API service — uses the shared Axios instance (with JWT auto-attach).
 */
import { get, post, del, put } from './http';

// ─── Dashboard ───
export const adminService = {
  // Stats
  getStats: (params: { range?: string; month?: number; year?: number; week?: number } = {}) => 
    get<any>('/api/admin/stats/overview', params as any),

  getRealtimeStats: () => 
    get<any>('/api/admin/stats/realtime'),

  // Users
  getUsers: (params: { page?: number; size?: number; status?: string; role?: string; search?: string } = {}) =>
    get<any>('/api/admin/users', params as any),

  getUserDetail: (accountId: string) =>
    get<any>(`/api/admin/users/${accountId}`),

  lockAccount: (accountId: string, reason?: string) =>
    post<any>(`/api/admin/users/${accountId}/lock`, { reason }),

  unlockAccount: (accountId: string) =>
    post<any>(`/api/admin/users/${accountId}/unlock`),

  bulkLockUsers: (ids: string[], reason?: string) =>
    post<any>('/api/admin/users/bulk-lock', { ids, reason }),

  warnUser: (userId: string, message: string) =>
    post<any>(`/api/admin/users/${userId}/warn`, { message }),

  // Posts
  getPosts: (params: { page?: number; size?: number; visibility?: string; isDeleted?: string } = {}) =>
    get<any>('/api/admin/posts', params as any),

  deletePost: (postId: string) =>
    del<any>(`/api/admin/posts/${postId}`),

  bulkDeletePosts: (ids: string[]) =>
    post<any>('/api/admin/posts/bulk-delete', { ids }),

  getComments: (postId: string) =>
    get<any>(`/api/admin/posts/${postId}/comments`),

  deleteComment: (commentId: string) =>
    del<any>(`/api/admin/comments/${commentId}`),

  getReports: (params: { page?: number; size?: number; status?: string } = {}) =>
    get<any>('/api/admin/reports', params as any),

  updateReportStatus: (id: string, status: 'RESOLVED' | 'DISMISSED') =>
    put<any>(`/api/admin/reports/${id}/status`, { status }),

  getAdminLogs: (params: { page?: number; size?: number } = {}) =>
    get<any>('/api/admin/logs', params as any),

  // Conversations
  getConversations: (params: { page?: number; size?: number; type?: string } = {}) =>
    get<any>('/api/admin/conversations', params as any),

  disbandGroup: (id: string) =>
    del<any>(`/api/admin/conversations/${id}`),

  // Messages
  getMessages: (params: { page?: number; size?: number; type?: string } = {}) =>
    get<any>('/api/admin/messages', params as any),

  deleteMessage: (id: string) =>
    del<any>(`/api/admin/messages/${id}`),

  // Friendships
  getFriendships: (params: { page?: number; size?: number; status?: string } = {}) =>
    get<any>('/api/admin/friendships', params as any),

  removeFriendship: (id: string) =>
    del<any>(`/api/admin/friendships/${id}`),

  // Notifications
  getNotifications: (params: { page?: number; size?: number } = {}) =>
    get<any>('/api/admin/notifications', params as any),

  broadcastNotification: (data: { title: string; message: string }) =>
    post<any>('/api/admin/notifications/broadcast', data),

  deleteNotification: (id: string) =>
    del<any>(`/api/admin/notifications/${id}`),

  // Stickers
  getStickerPacks: () => get<any>('/api/admin/stickers/packs'),

  // Music
  getMusic: () => get<any>('/api/admin/music'),
  deleteMusic: (id: string) => del<any>(`/api/admin/music/${id}`),

  // Calls
  getCalls: (params: { page?: number; size?: number } = {}) =>
    get<any>('/api/admin/calls', params as any),

  // Official Accounts (OA)
  getOAs: (params: { page?: number; size?: number; status?: string; category?: string; search?: string } = {}) =>
    get<any>('/api/admin/oa', params as any),

  getOADetail: (id: string) =>
    get<any>(`/api/admin/oa/${id}`),

  approveOA: (id: string) =>
    put<any>(`/api/admin/oa/${id}/approve`),

  rejectOA: (id: string, reason?: string) =>
    put<any>(`/api/admin/oa/${id}/reject`, { reason }),

  suspendOA: (id: string) =>
    put<any>(`/api/admin/oa/${id}/suspend`),

  deleteOA: (id: string) =>
    del<any>(`/api/admin/oa/${id}`),

  // Withdrawal Requests
  getWithdrawals: (params: { page?: number; size?: number; status?: string } = {}) =>
    get<any>('/api/admin/withdrawals', params as any),

  approveWithdrawal: (id: string) =>
    put<any>(`/api/admin/withdrawals/${id}/approve`),

  rejectWithdrawal: (id: string, reason?: string) =>
    put<any>(`/api/admin/withdrawals/${id}/reject`, { reason }),

  // Reports
  getReports: (params: { page?: number; size?: number; status?: string } = {}) =>
    get<any>('/api/admin/reports', params as any),

  updateReportStatus: (id: string, status: 'RESOLVED' | 'DISMISSED') =>
    put<any>(`/api/admin/reports/${id}/status`, { status }),

  // Admin Logs
  getAdminLogs: (params: { page?: number; size?: number } = {}) =>
    get<any>('/api/admin/logs', params as any),
  // Billing & Gifts
  getBillingStats: () =>
    get<any>('/api/admin/billing/stats'),

  getTransactions: (params: { page?: number; limit?: number } = {}) =>
    get<any>('/api/admin/billing/transactions', params as any),

  manualCoinAdjust: (data: { userId: string; amount: number; reason: string }) =>
    post<any>('/api/admin/billing/manual', data),

  getGifts: () =>
    get<any>('/api/admin/billing/gifts'),

  createGift: (data: { name: string; price: number; iconUrl: string; animationUrl?: string; status?: string }) =>
    post<any>('/api/admin/billing/gifts', data),

  updateGift: (id: string, data: any) =>
    put<any>(`/api/admin/billing/gifts/${id}`, data),

  deleteGift: (id: string) =>
    del<any>(`/api/admin/billing/gifts/${id}`),
};
