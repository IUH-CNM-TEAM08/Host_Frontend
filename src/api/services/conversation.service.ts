import { del, get, patch, post, put } from './http';
import { mapApiConversationToModel, unwrapData } from '@/src/models/mappers';
import { Conversation } from '@/src/models/Conversation';
import { UserStorage } from '@/src/storage/UserStorage';
import SocketService from '@/src/api/socketCompat';

export const conversationService = {
  createPrivate: <T = unknown>(userId1: string, userId2: string) =>
    post<T>('/api/conversations/private', { userId1, userId2 }),
  createGroup: <T = unknown>(payload: { name: string; memberIds: string[]; avatarUrl?: string }) => {
    const raw = typeof payload.avatarUrl === 'string' ? payload.avatarUrl.trim() : '';
    const safeAvatar =
      raw && (raw.startsWith('http://') || raw.startsWith('https://')) ? raw : undefined;
    const body: Record<string, unknown> = {
      name: payload.name,
      memberIds: payload.memberIds,
      userIds: payload.memberIds,
    };
    if (safeAvatar) body.avatarUrl = safeAvatar;
    return post<T>('/api/conversations/group', body);
  },

  getUserConversations: <T = unknown>(userId: string) =>
    get<T>(`/api/conversations/user/${encodeURIComponent(userId)}`),
  getConversations: async () => {
    const currentUser = await UserStorage.getUser();
    const userId = currentUser?.id;
    if (!userId) {
      return { success: false, message: 'Không tìm thấy user hiện tại', conversations: [] as Conversation[] };
    }

    const res: any = await conversationService.getUserConversations<any>(userId);
    const root = unwrapData<any>(res);
    const rows = Array.isArray(root) ? root : Array.isArray(root?.items) ? root.items : [];
    const conversations = rows.map(mapApiConversationToModel);
    return { success: res?.success ?? true, message: res?.message, conversations, data: conversations };
  },
  getHiddenConversations: <T = unknown>(userId: string) =>
    get<T>(`/api/conversations/user/${encodeURIComponent(userId)}/hidden`),
  getStrangerConversations: <T = unknown>(userId: string) =>
    get<T>(`/api/conversations/user/${encodeURIComponent(userId)}/strangers`),
  /** Cuộc đã gỡ khỏi sách chính (vd. sau xóa lịch sử), không phải ẩn PIN — dùng khi tìm kiếm */
  searchRemovedFromInboxForUser: async (userId: string, query: string) => {
    const q = query.trim();
    if (!q) return { success: true, conversations: [] as Conversation[] };
    const res: any = await get<any>(`/api/conversations/user/${encodeURIComponent(userId)}/search-removed`, { q });
    const root = unwrapData<any>(res);
    const rows = Array.isArray(root) ? root : Array.isArray(root?.items) ? root.items : [];
    const conversations = rows.map(mapApiConversationToModel);
    return { success: res?.success ?? true, conversations };
  },
  getById: <T = unknown>(conversationId: string, query?: Record<string, unknown>) =>
    get<T>(`/api/conversations/${encodeURIComponent(conversationId)}`, query),

  removeFromList: (conversationId: string, userId: string) =>
    del(`/api/conversations/${encodeURIComponent(conversationId)}/list`, { userId }),

  updateGroup: <T = unknown>(conversationId: string, body: Record<string, unknown>) =>
    put<T>(`/api/conversations/group/${encodeURIComponent(conversationId)}`, body),

  updatePrivatePreferences: <T = unknown>(conversationId: string, userId: string, body: Record<string, unknown>) =>
    patch<T>(`/api/conversations/${encodeURIComponent(conversationId)}/private-preferences`, body, { userId }),

  getParticipants: <T = unknown>(conversationId: string) =>
    get<T>(`/api/conversations/${encodeURIComponent(conversationId)}/participants`),
  addParticipant: <T = unknown>(conversationId: string, userId: string) =>
    post<T>(`/api/conversations/${encodeURIComponent(conversationId)}/participants`, { userId }),
  removeParticipant: (conversationId: string, userId: string) =>
    del(`/api/conversations/${encodeURIComponent(conversationId)}/participants/${encodeURIComponent(userId)}`),

  pin: <T = unknown>(conversationId: string) => post<T>(`/api/conversations/${encodeURIComponent(conversationId)}/pin`),
  unpin: (conversationId: string) => del(`/api/conversations/${encodeURIComponent(conversationId)}/pin`),

  mute: <T = unknown>(conversationId: string, userId: string) =>
    post<T>(`/api/conversations/${encodeURIComponent(conversationId)}/mute`, undefined, { userId }),
  unmute: (conversationId: string, userId: string) =>
    del(`/api/conversations/${encodeURIComponent(conversationId)}/mute`, { userId }),

  hide: <T = unknown>(conversationId: string, userId: string, pin: string, confirmPin: string) =>
    post<T>(`/api/conversations/${encodeURIComponent(conversationId)}/hide`, { pin, confirmPin }, { userId }),
  unlock: <T = unknown>(conversationId: string, userId: string, pin: string) =>
    post<T>(`/api/conversations/${encodeURIComponent(conversationId)}/unlock`, { pin }, { userId }),
  unhide: <T = unknown>(conversationId: string, userId: string, pin: string) =>
    post<T>(`/api/conversations/${encodeURIComponent(conversationId)}/unhide`, { pin }, { userId }),

  // Legacy adapters (for older FE components)
  getConversationById: async (conversationId: string, userId?: string, allowPreview?: boolean) => {
    const query: Record<string, unknown> = {};
    if (userId) query.userId = userId;
    if (allowPreview) query.preview = '1';
    const res: any = await conversationService.getById<any>(conversationId, Object.keys(query).length ? query : undefined);
    const conversation = mapApiConversationToModel(unwrapData<any>(res));
    return { success: res?.success ?? true, message: res?.message, conversation, data: conversation };
  },

  createConversation: async (payload: Conversation) => {
    const isGroup = payload.isGroup || payload.type === 'group' || payload.type === 'GROUP';
    const res: any = isGroup
      ? await conversationService.createGroup<any>({
          name: payload.name,
          memberIds: payload.participantIds,
          avatarUrl:
            typeof payload.avatarUrl === 'string' ? payload.avatarUrl : undefined,
        })
      : await conversationService.createPrivate<any>(payload.participantIds[0] || '', payload.participantIds[1] || '');

    const conversation = mapApiConversationToModel(unwrapData<any>(res));
    return { success: res?.success ?? true, message: res?.message, conversation, data: conversation };
  },

  addParticipants: async (conversationId: string, userIds: string[]) => {
    const results = await Promise.all(
      userIds.map((id) => conversationService.addParticipant<any>(conversationId, id))
    );
    const ok = results.every((r: any) => r?.success !== false);
    return { success: ok, message: ok ? 'Success' : 'Add participants failed' };
  },

  removeParticipants: async (conversationId: string, userIds: string[]) => {
    const results = await Promise.all(
      userIds.map((id) => conversationService.removeParticipant(conversationId, id))
    );
    const ok = results.every((r: any) => r?.success !== false);
    return { success: ok, message: ok ? 'Success' : 'Remove participants failed' };
  },

  deleteConversation: async (conversationId: string, userId = '') => {
    const res: any = await conversationService.removeFromList(conversationId, userId);
    if (res === '' || res === undefined || res === null) {
      return { success: true, message: 'Deleted' };
    }
    return { success: res?.success ?? true, message: res?.message, data: unwrapData<any>(res) };
  },

  /**
   * Chuyển quyền admin → REST trước (có persistence), socket emit để broadcast ngay.
   */
  transferAdmin: async (conversationId: string, toUserId: string) => {
    try {
      await put(`/api/conversations/${encodeURIComponent(conversationId)}/transfer-admin`, { toUserId });
      // Vẫn emit socket để broadcast realtime ngay lập tức
      SocketService.getInstance().transferAdmin({ conversationId, toUserId });
      return { success: true, message: 'Đã chuyển quyền admin' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi chuyển admin' };
    }
  },

  /**
   * Cấp quyền phó nhóm → REST + socket.
   */
  grantModRole: async (conversationId: string, toUserId: string) => {
    try {
      await put(`/api/conversations/${encodeURIComponent(conversationId)}/grant-mod`, { toUserId });
      SocketService.getInstance().grantMod({ conversationId, toUserId });
      return { success: true, message: 'Đã cấp quyền phó nhóm' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi cấp quyền mod' };
    }
  },

  revokeModRole: async (conversationId: string, userId: string) => {
    try {
      await patch(`/api/conversations/${encodeURIComponent(conversationId)}/revoke-mod`, { userId });
      return { success: true, message: 'Đã hạ chức phó nhóm' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi hạ chức phó nhóm' };
    }
  },

  

  /**
   * Tham gia nhóm bằng URL link → REST.
   */
  joinGroupByUrl: async (url: string) => {
    const res: any = await post<any>('/api/conversations/join-by-url', { url });
    const conversation = mapApiConversationToModel(unwrapData<any>(res));
    return { success: res?.success ?? true, message: res?.message, conversation, data: conversation };
  },

  /**
   * Rời nhóm — REST giống bị kick (removedFromList + socket realtime); sau đó rời phòng socket.
   */
  leaveGroup: async (groupId: string) => {
    try {
      const currentUser = await UserStorage.getUser();
      const uid = currentUser?.id;
      if (!uid) return { success: false, message: 'Không tìm thấy user hiện tại' };
      await conversationService.removeParticipant(groupId, uid);
      try {
        SocketService.getInstance().leaveConversation(groupId);
      } catch {
        /* noop */
      }
      return { success: true, message: 'Đã rời nhóm' };
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Lỗi rời nhóm';
      return { success: false, message: String(msg) };
    }
  },

  /**
   * Giải tán nhóm (chỉ OWNER) → REST (đánh dấu + tin SYSTEM); socket chỉ bổ sung nếu cần.
   */
  disbandGroup: async (conversationId: string) => {
    try {
      await del(`/api/conversations/${encodeURIComponent(conversationId)}/disband`);
      return { success: true, message: 'Đã giải tán nhóm' };
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        'Lỗi giải tán nhóm';
      return { success: false, message: String(msg) };
    }
  },

  /**
   * Chặn thành viên khỏi nhóm
   */
  banParticipant: async (conversationId: string, targetUserId: string | string[]) => {
    try {
      const ids = Array.isArray(targetUserId) ? targetUserId : [targetUserId];
      const normalizedIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
      await post(`/api/conversations/${encodeURIComponent(conversationId)}/ban`, {
        targetUserId: normalizedIds[0],
        targetUserIds: normalizedIds,
      });
      return { success: true, message: 'Đã chặn thành viên' };
    } catch (e: any) {
      return {
        success: false,
        message:
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Lỗi chặn thành viên',
      };
    }
  },

  /**
   * Lấy danh sách user đã bị chặn khỏi nhóm
   */
  getBlockedParticipants: async (conversationId: string) => {
    try {
      const res: any = await get(`/api/conversations/${encodeURIComponent(conversationId)}/blocked`);
      const data = res?.data ?? res;
      const blockedUsers = Array.isArray(data?.blockedUsers)
        ? data.blockedUsers
        : Array.isArray(data)
          ? data
          : [];
      return { success: res?.success ?? true, blockedUsers, message: res?.message };
    } catch (e: any) {
      return {
        success: false,
        blockedUsers: [],
        message:
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Không thể tải danh sách chặn',
      };
    }
  },

  /**
   * Bỏ chặn thành viên khỏi nhóm
   */
  unbanParticipant: async (conversationId: string, targetUserId: string | string[]) => {
    try {
      const ids = Array.isArray(targetUserId) ? targetUserId : [targetUserId];
      const normalizedIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
      await post(`/api/conversations/${encodeURIComponent(conversationId)}/unban`, {
        targetUserId: normalizedIds[0],
        targetUserIds: normalizedIds,
      });
      return { success: true, message: 'Đã bỏ chặn thành viên' };
    } catch (e: any) {
      return {
        success: false,
        message:
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          'Không thể bỏ chặn thành viên',
      };
    }
  },

  /**
   * Phê duyệt/Từ chối yêu cầu tham gia
   */
  handleJoinRequest: async (conversationId: string, requesterId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await post(`/api/conversations/${encodeURIComponent(conversationId)}/join-request`, { requesterId, action });
      return { success: true, message: action === 'APPROVE' ? 'Đã duyệt' : 'Đã từ chối' };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi xử lý yêu cầu' };
    }
  },

  /**
   * Bật/tắt quyền nhắn tin trong nhóm (chỉ admin).
   */
  updateAllowMessaging: async (conversationId: string) => {
    try {
      const res: any = await patch<any>(`/api/conversations/${encodeURIComponent(conversationId)}/allow-messaging`, {});
      return { success: res?.success ?? true, message: res?.message, data: res };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi cập nhật cài đặt' };
    }
  },

  /**
   * Ghim tin nhắn trong nhóm → REST + socket broadcast.
   */
  pinMessage: async (conversationId: string, messageId: string) => {
    try {
      const res: any = await post<any>(`/api/conversations/${encodeURIComponent(conversationId)}/pin-message`, { messageId });
      return { success: res?.success ?? true, message: res?.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi ghim tin nhắn' };
    }
  },

  /**
   * Bỏ ghim tin nhắn trong nhóm.
   */
  unpinMessage: async (conversationId: string, messageId: string) => {
    try {
      const res: any = await del(`/api/conversations/${encodeURIComponent(conversationId)}/pin-message`, { messageId });
      return { success: res?.success ?? true, message: res?.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi bỏ ghim' };
    }
  },

  /**
   * Đặt/xoá biệt danh thành viên trong group.
   * - Admin/Owner: đặt cho bất kỳ ai
   * - Mod/Member: chỉ đặt cho bản thân
   */
  setGroupNickname: async (conversationId: string, targetUserId: string, nickname: string | null) => {
    try {
      const res: any = await patch(`/api/conversations/${encodeURIComponent(conversationId)}/nickname`, {
        targetUserId,
        nickname,
      });
      return { success: res?.success ?? true, message: res?.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Lỗi đặt biệt danh' };
    }
  },

  // ─── Group Invite ─────────────────────────────────────────────────────────
  /** Gửi lời mời vào nhóm */
  sendGroupInvite: async (conversationId: string, inviteeId: string) => {
    const res: any = await post('/api/group-invites', { conversationId, inviteeId });
    const data = res?.data ?? res;
    let msg = typeof res?.message === 'string' ? res.message.trim() : '';
    if (!msg || msg === 'Created' || msg === 'Success') {
      const nested =
        data && typeof data === 'object' && typeof (data as { message?: string }).message === 'string'
          ? String((data as { message: string }).message).trim()
          : '';
      if (nested) msg = nested;
    }
    if (!msg || msg === 'Created' || msg === 'Success') {
      msg = 'Đã gửi lời mời tham gia nhóm.';
    }
    return { success: res?.success !== false, data, message: msg };
  },

  /** Lấy danh sách lời mời đang chờ của mình */
  getMyGroupInvites: async () => {
    const res: any = await get('/api/group-invites/mine');
    const data = res?.data ?? res;
    return { success: res?.success ?? true, invites: data?.invites ?? [] };
  },

  /** Chấp nhận lời mời */
  acceptGroupInvite: async (inviteId: string) => {
    const res: any = await post(`/api/group-invites/${encodeURIComponent(inviteId)}/accept`);
    const d = res?.data ?? res;
    return {
      success: res?.success !== false,
      conversationId: d?.conversationId,
      message: res?.message,
      pendingAdminApproval: Boolean(d?.pendingAdminApproval),
    };
  },

  /** Từ chối lời mời */
  declineGroupInvite: async (inviteId: string, reason?: string) => {
    const res: any = await post(`/api/group-invites/${encodeURIComponent(inviteId)}/decline`, { reason });
    return { success: res?.success ?? true, message: res?.message };
  },

  // ─── Invite Link / QR ────────────────────────────────────────────────────
  /** Lấy hoặc tạo invite link cho nhóm */
  getInviteLink: async (conversationId: string) => {
    const res: any = await get(`/api/conversations/${encodeURIComponent(conversationId)}/invite-link`);
    return { success: res?.success ?? true, url: (res?.data ?? res)?.url as string | undefined, message: res?.message };
  },

  /** Reset invite link (chỉ admin) */
  resetInviteLink: async (conversationId: string) => {
    const res: any = await post(`/api/conversations/${encodeURIComponent(conversationId)}/invite-link/reset`);
    return { success: res?.success ?? true, url: (res?.data ?? res)?.url as string | undefined, message: res?.message };
  },

  /**
   * Join nhóm: chuỗi URL đầy đủ, hoặc `{ conversationId, code }` (màn /join từ query).
   * Không bọc object trong `{ url: ... }` — backend cần `conversationId` + `code` ở root body.
   */
  joinByUrl: async (urlOrParams: string | { conversationId: string; code: string }) => {
    const body =
      typeof urlOrParams === 'string'
        ? { url: urlOrParams }
        : {
            conversationId: urlOrParams.conversationId,
            code: urlOrParams.code,
          };
    const res: any = await post('/api/conversations/join-by-url', body);
    const data = res?.data ?? res;
    return {
      success: res?.success !== false,
      data,
      message: res?.message,
      pendingApproval: Boolean(data?.pendingApproval),
      alreadyMember: Boolean(data?.alreadyMember),
    };
  },

  /** Bật/tắt duyệt thành viên mới */
  toggleRequireApproval: async (conversationId: string) => {
    const res: any = await patch(`/api/conversations/${encodeURIComponent(conversationId)}/require-approval`);
    return { success: res?.success ?? true, data: res?.data ?? res, message: res?.message };
  },

  /** Admin/Mod: yêu cầu tham gia nhóm đang chờ */
  getPendingJoinRequests: async (conversationId: string) => {
    const res: any = await get(`/api/conversations/${encodeURIComponent(conversationId)}/join-requests`);
    const raw = unwrapData<any>(res);
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.requests)
        ? raw.requests
        : Array.isArray(raw?.items)
          ? raw.items
          : [];
    const requests = list.map((r: any) => {
      const invitee = r?.invitee ?? {};
      const normalizedUser = r?.user ?? {
        id: invitee?.id,
        name: invitee?.name ?? invitee?.displayName ?? 'Người dùng',
        avatar: invitee?.avatar ?? invitee?.avatarUrl ?? '',
      };
      return {
        ...r,
        _id: r?._id ?? r?.id,
        id: r?.id ?? r?._id,
        user: normalizedUser,
      };
    });
    return { success: res?.success !== false, requests };
  },

  approveJoinRequest: async (inviteId: string) => {
    const res: any = await post(`/api/group-invites/${encodeURIComponent(inviteId)}/approve`, {});
    return { success: res?.success !== false, message: res?.message };
  },

  rejectJoinRequest: async (inviteId: string) => {
    const res: any = await post(`/api/group-invites/${encodeURIComponent(inviteId)}/reject`, {});
    return { success: res?.success !== false, message: res?.message };
  },
};
