import { del, get, post, put } from './http';
import { mapApiUserToUser, unwrapArray, unwrapData } from '@/src/models/mappers';
import { User } from '@/src/models/User';

const normalizeDateOfBirth = (raw: unknown): string | undefined => {
  if (raw === null || raw === undefined) return undefined;
  const value = String(raw).trim();
  if (!value) return undefined;

  // dd/mm/yyyy -> yyyy-mm-dd
  const ddMmYyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMmYyyy) {
    const [, dd, mm, yyyy] = ddMmYyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  // yyyy-mm-dd
  const yyyyMmDd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDd) return value;

  // timestamp number
  if (/^\d+$/.test(value)) {
    const timestamp = Number(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString().slice(0, 10);
    }
  }

  // fallback parseable date string
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return undefined;
};

const normalizeLegacyUpdatePayload = (body: Partial<User>): Record<string, unknown> => ({
  displayName: body.name ?? body.displayName,
  bio: (body as any).bio,
  gender: body.gender,
  dateOfBirth: normalizeDateOfBirth(body.dob ?? body.dateOfBirth),
  avatarUrl: body.avatarURL ?? body.avatarUrl,
  coverUrl: body.coverURL ?? body.coverUrl,
});

export const userService = {
  getMe: <T = unknown>() => get<T>('/users/me'),
  updateMe: <T = unknown>(body: unknown) => put<T>('/users/me', body),
  deleteMe: () => del('/users/me'),

  searchUsers: <T = unknown>(keyword: string) => get<T>('/users/search', { keyword }),
  searchUsersSimple: <T = unknown>(keyword: string) => get<T>('/users/search/simple', { keyword }),

  getUserSummary: <T = unknown>(userId: string) => get<T>(`/users/${encodeURIComponent(userId)}/summary`),
  getProfileSummary: <T = unknown>(userId: string) => get<T>(`/users/${encodeURIComponent(userId)}/profile-summary`),
  getMessageAllowed: <T = unknown>(targetUserId: string) =>
    get<T>(`/users/${encodeURIComponent(targetUserId)}/privacy/message-allowed`),

  getStrangerMessagePrivacy: <T = unknown>() => get<T>('/users/me/privacy/stranger-message'),
  updateStrangerMessagePrivacy: <T = unknown>(allow: boolean) =>
    put<T>('/users/me/privacy/stranger-message', { allowStrangerMessage: allow }),
  getStrangerCallPrivacy: <T = unknown>() => get<T>('/users/me/privacy/stranger-call'),
  updateStrangerCallPrivacy: <T = unknown>(allow: boolean) =>
    put<T>('/users/me/privacy/stranger-call', { allowStrangerCall: allow }),
  getStrangerGroupInvitePrivacy: <T = unknown>() => get<T>('/users/me/privacy/stranger-group-invite'),
  updateStrangerGroupInvitePrivacy: <T = unknown>(allow: boolean) =>
    put<T>('/users/me/privacy/stranger-group-invite', { allowStrangerGroupInvite: allow }),
  getCallAllowed: <T = unknown>(targetUserId: string) =>
    get<T>(`/users/${encodeURIComponent(targetUserId)}/privacy/call-allowed`),
  getGroupInviteAllowed: <T = unknown>(targetUserId: string) =>
    get<T>(`/users/${encodeURIComponent(targetUserId)}/privacy/group-invite-allowed`),

  getProfileViewPrivacy: <T = unknown>() => get<T>('/users/me/privacy/profile-view'),
  updateProfileViewPrivacy: <T = unknown>(privacy: boolean) => put<T>('/users/me/privacy/profile-view', { privacy }),

  blockUser: (userId: string) => post(`/users/me/block/${encodeURIComponent(userId)}`),
  unblockUser: (userId: string) => del(`/users/me/block/${encodeURIComponent(userId)}`),

  assistantChat: <T = unknown>(message: string) => post<T>('/users/assistant/chat', { message }),
  systemGuideChat: <T = unknown>(message: string) => post<T>('/users/assistant/system-guide/chat', { message }),
  moderateContent: <T = unknown>(content: string) => post<T>('/users/content/moderate', { content }),

  adminListAccounts: <T = unknown>(page = 0, size = 20) => get<T>('/users/admin/accounts', { page, size }),
  adminLockAccount: <T = unknown>(accountId: string) => put<T>(`/users/admin/accounts/${encodeURIComponent(accountId)}/lock`),
  adminUnlockAccount: <T = unknown>(accountId: string) => put<T>(`/users/admin/accounts/${encodeURIComponent(accountId)}/unlock`),
  adminRestoreAccount: <T = unknown>(accountId: string) => put<T>(`/users/admin/accounts/${encodeURIComponent(accountId)}/restore`),

  // Legacy adapters (for older FE contexts/components)
  me: async () => {
    const res: any = await userService.getMe<any>();
    const raw = unwrapData<any>(res);
    const user = mapApiUserToUser(raw);
    return { success: res?.success ?? true, message: res?.message, user, data: user };
  },

  update: async (body: Partial<User>) => {
    const res: any = await userService.updateMe<any>(normalizeLegacyUpdatePayload(body));
    const raw = unwrapData<any>(res);
    const user = mapApiUserToUser(raw);
    return { success: res?.success ?? true, message: res?.message, user, data: user };
  },

  getUserById: async (userId: string) => {
    const res: any = await userService.getUserSummary<any>(userId);
    const raw = unwrapData<any>(res);
    const user = mapApiUserToUser(raw);
    return { success: res?.success ?? true, message: res?.message, user, data: user };
  },

  getUserByPhone: async (keyword: string) => {
    const res: any = await userService.searchUsers<any>(keyword);
    const users = unwrapArray<any>(res).map(mapApiUserToUser);
    return { success: res?.success ?? true, message: res?.message, users, data: users };
  },

  search: async (keyword: string) => {
    const res: any = await userService.searchUsers<any>(keyword);
    const users = unwrapArray<any>(res).map(mapApiUserToUser);
    return { success: res?.success ?? true, message: res?.message, users, data: users };
  },
};
