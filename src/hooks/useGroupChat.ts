/**
 * useGroupChat — Custom hook tách toàn bộ logic group chat ra khỏi ChatArea.
 *
 * Bao gồm:
 * 1. allowMessaging guard (admin lock chat)
 * 2. Lắng nghe socket settings_updated
 * 3. Xác định role hiện tại (admin/mod/member)
 * 4. canSendMessage computed (kết hợp allowMessaging + role)
 * 5. Group member display name map
 * 6. Group pinned messages qua REST + socket
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Conversation } from '@/src/models/Conversation';
import { User } from '@/src/models/User';
import SocketService from '@/src/api/socketCompat';
import { conversationService } from '@/src/api/services/conversation.service';

type GroupRole = 'admin' | 'mod' | 'member' | 'owner';

function normalizeRole(role?: string): GroupRole {
  const r = String(role || 'member').toUpperCase();
  if (r === 'OWNER') return 'owner';
  if (r === 'ADMIN') return 'admin';
  if (r === 'MODERATOR' || r === 'MOD') return 'mod';
  return 'member';
}

export interface UseGroupChatResult {
  /** Có phải group không */
  isGroup: boolean;
  /** Role hiện tại của user trong group */
  myRole: GroupRole;
  /** User có phải admin/owner không */
  isAdmin: boolean;
  /** User có phải admin hoặc mod không */
  isAdminOrMod: boolean;
  /** Admin đã khóa chat chưa? (chỉ admin/mod được nhắn) */
  isAllowMessaging: boolean;
  /** User có thể gửi tin nhắn không (kết hợp allowMessaging + role) */
  canSendMessage: boolean;
  /** Thông báo khi bị khóa chat */
  lockedChatMessage: string | null;
  /** Toggle allowMessaging (chỉ admin) */
  toggleAllowMessaging: () => Promise<void>;
  /** Quyền thay đổi thông tin nhóm (metadata) */
  isAllowMemberChangeMetadata: boolean;
  /** Quyền ghim tin nhắn/ghi chú/bình chọn */
  isAllowMemberPin: boolean;
  /** Quyền tạo mới ghi chú/nhắc hẹn */
  isAllowMemberCreateNote: boolean;
  /** Quyền tạo mới bình chọn */
  isAllowMemberCreatePoll: boolean;
  /** Cho phép phó nhóm kiểm duyệt/quản lý thành viên */
  isAllowModManage: boolean;
  /** Map userId → tên hiển thị trong group */
  memberDisplayNames: Record<string, string>;
}

export function useGroupChat(
  selectedChat: Conversation | null,
  user: User | null,
): UseGroupChatResult {
  const socketService = SocketService.getInstance();
  const isGroup = selectedChat?.isGroup ?? false;

  // ── Role ──
  const myRole = useMemo<GroupRole>(() => {
    if (!isGroup || !user?.id || !selectedChat?.participantInfo) return 'member';
    const me = selectedChat.participantInfo.find(p => p.id === user.id);
    return normalizeRole(me?.role);
  }, [isGroup, user?.id, selectedChat?.participantInfo]);

  const isAdmin = myRole === 'admin' || myRole === 'owner';
  const isAdminOrMod = isAdmin || myRole === 'mod';

  // ── allowMessaging ──
  const [isAllowMessaging, setIsAllowMessaging] = useState<boolean>(true);
  const [isAllowMemberChangeMetadata, setIsAllowMemberChangeMetadata] = useState<boolean>(true);
  const [isAllowMemberPin, setIsAllowMemberPin] = useState<boolean>(true);
  const [isAllowMemberCreateNote, setIsAllowMemberCreateNote] = useState<boolean>(true);
  const [isAllowMemberCreatePoll, setIsAllowMemberCreatePoll] = useState<boolean>(true);
  const [isAllowModManage, setIsAllowModManage] = useState<boolean>(true);

  // Sync từ selectedChat khi đổi
  useEffect(() => {
    if (isGroup && selectedChat) {
      const s = (selectedChat as any).settings;
      setIsAllowMessaging(s?.isAllowMessaging ?? true);
      setIsAllowMemberChangeMetadata(s?.isAllowMemberChangeMetadata ?? true);
      setIsAllowMemberPin(s?.isAllowMemberPin ?? true);
      setIsAllowMemberCreateNote(s?.isAllowMemberCreateNote ?? true);
      setIsAllowMemberCreatePoll(s?.isAllowMemberCreatePoll ?? true);
      setIsAllowModManage(s?.isAllowModManage ?? true);
    } else {
      setIsAllowMessaging(true);
      setIsAllowMemberChangeMetadata(true);
      setIsAllowMemberPin(true);
      setIsAllowMemberCreateNote(true);
      setIsAllowMemberCreatePoll(true);
      setIsAllowModManage(true);
    }
  }, [isGroup, selectedChat?.id, (selectedChat as any)?.settings]);

  // Socket listener: settings_updated
  useEffect(() => {
    if (!isGroup || !selectedChat?.id) return;
    const handler = (data: { conversationId: string; settings: Record<string, any> }) => {
      if (data.conversationId !== selectedChat.id) return;
      if (data.settings) {
        if (data.settings.isAllowMessaging !== undefined) setIsAllowMessaging(Boolean(data.settings.isAllowMessaging));
        if (data.settings.isAllowMemberChangeMetadata !== undefined) setIsAllowMemberChangeMetadata(Boolean(data.settings.isAllowMemberChangeMetadata));
        if (data.settings.isAllowMemberPin !== undefined) setIsAllowMemberPin(Boolean(data.settings.isAllowMemberPin));
        if (data.settings.isAllowMemberCreateNote !== undefined) setIsAllowMemberCreateNote(Boolean(data.settings.isAllowMemberCreateNote));
        if (data.settings.isAllowMemberCreatePoll !== undefined) setIsAllowMemberCreatePoll(Boolean(data.settings.isAllowMemberCreatePoll));
        if (data.settings.isAllowModManage !== undefined) setIsAllowModManage(Boolean(data.settings.isAllowModManage));
      }
    };
    socketService.onGroupSettingsUpdated(handler);
    return () => socketService.removeGroupSettingsUpdatedListener(handler as any);
  }, [isGroup, selectedChat?.id]);

  // canSendMessage: nếu allowMessaging = false → chỉ admin/mod được gửi
  const canSendMessage = useMemo(() => {
    if (!isGroup) return true; // 1-1 → luôn OK (block xử lý riêng)
    if (isAllowMessaging) return true; // admin cho phép → ai cũng gửi
    return isAdminOrMod; // bị khóa → chỉ admin/mod
  }, [isGroup, isAllowMessaging, isAdminOrMod]);

  const lockedChatMessage = useMemo(() => {
    if (!isGroup || canSendMessage) return null;
    return 'Quản trị viên đã tắt quyền nhắn tin. Chỉ admin và phó nhóm mới có thể gửi tin nhắn.';
  }, [isGroup, canSendMessage]);

  // Toggle allowMessaging (admin only)
  const toggleAllowMessaging = useCallback(async () => {
    if (!selectedChat?.id || !isAdmin) return;
    const prev = isAllowMessaging;
    setIsAllowMessaging(!prev);
    try {
      await conversationService.updateAllowMessaging(selectedChat.id);
    } catch {
      setIsAllowMessaging(prev); // rollback
    }
  }, [selectedChat?.id, isAdmin, isAllowMessaging]);

  // ── Member display names ──
  const memberDisplayNames = useMemo<Record<string, string>>(() => {
    if (!isGroup || !selectedChat?.participantInfo) return {};
    const map: Record<string, string> = {};
    for (const p of selectedChat.participantInfo) {
      if (p.id) {
        map[p.id] = p.nickname || p.displayName || p.name || 'Thành viên';
      }
    }
    return map;
  }, [isGroup, selectedChat?.participantInfo]);

  return {
    isGroup,
    myRole,
    isAdmin,
    isAdminOrMod,
    isAllowMessaging,
    canSendMessage,
    lockedChatMessage,
    toggleAllowMessaging,
    isAllowMemberChangeMetadata,
    isAllowMemberPin,
    isAllowMemberCreateNote,
    isAllowMemberCreatePoll,
    isAllowModManage,
    memberDisplayNames,
  };
}
