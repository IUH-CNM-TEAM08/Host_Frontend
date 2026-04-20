import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, Image, TouchableOpacity, Pressable, Alert, Modal, TextInput, Platform, StyleSheet, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Conversation, ParticipantInfo } from "@/src/models/Conversation";
import { useUser } from "@/src/contexts/user/UserContext";
import { conversationService as ConversationService } from "@/src/api/services/conversation.service";
import SocketService from "@/src/api/socketCompat";

/** Web: Alert.alert thường không hiện → user nhấn Xóa nhưng không có xác nhận và không gọi API */
function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void | Promise<void>,
) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      void Promise.resolve(onConfirm());
    }
    return;
  }
  Alert.alert(title, message, [
    { text: "Hủy", style: "cancel" },
    {
      text: confirmLabel,
      style: "destructive",
      onPress: () => {
        void Promise.resolve(onConfirm());
      },
    },
  ]);
}

function showErrorAlert(title: string, detail: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${title}\n${detail}`);
    return;
  }
  Alert.alert(title, detail);
}

interface GroupInfoProps {
  group: Conversation;
  /** Gọi sau khi đồng bộ danh sách thành viên từ server (cập nhật selectedChat / loadConversation ở cha) */
  onParticipantsSynced?: () => void;
}

interface BlockedMemberInfo {
  id: string;
  userId?: string;
  name?: string;
  displayName?: string;
  avatar?: string;
  avatarUrl?: string;
}

interface PendingJoinRequestInfo {
  _id?: string;
  id?: string;
  user?: {
    id?: string;
    name?: string;
    avatar?: string;
  };
  invitee?: {
    id?: string;
    name?: string;
    avatarUrl?: string;
  };
}

interface MemberMenuProps {
  visible: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  isModerator?: boolean;
  memberId: string;
  menuAnchorY?: number;
  onViewProfile?: (memberId: string) => void;
  onRemoveMember?: (memberId: string) => void;
  onBanMember?: (memberId: string) => void;
  onAddAdmin?: (memberId: string) => void;
  onAddMod?: (memberId: string) => void;
  onRevokeMod?: (memberId: string) => void;
  onRemoveAdmin?: (memberId: string) => void;
  onSetNickname?: (memberId: string) => void;
}

const MemberMenu = ({
  visible,
  onClose,
  isAdmin = false,
  isModerator = false,
  memberId,
  menuAnchorY = 120,
  onViewProfile,
  onRemoveMember,
  onBanMember,
  onAddAdmin,
  onAddMod,
  onRevokeMod,
  onRemoveAdmin,
  onSetNickname,
}: MemberMenuProps) => {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.menuModalRoot}>
        <Pressable style={styles.menuBackdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng menu" />
        <View
          style={[
            styles.menuPanel,
            {
              top: menuAnchorY,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
        onPress={() => { onViewProfile?.(memberId); onClose(); }}>
        <Ionicons name="person-circle-outline" size={18} color="#2563EB" />
        <Text style={{ marginLeft: 8, fontSize: 14, color: '#374151' }}>Xem trang cá nhân</Text>
      </TouchableOpacity>
      <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />

      {/* Đặt biệt danh — ai cũng có thể đặt */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
        onPress={() => { onSetNickname?.(memberId); onClose(); }}>
        <Ionicons name="create-outline" size={18} color="#6366F1" />
        <Text style={{ marginLeft: 8, fontSize: 14, color: '#374151' }}>Đặt biệt danh</Text>
      </TouchableOpacity>
      <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />

      {!isAdmin && !isModerator && (
        <>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
            onPress={() => { onAddAdmin?.(memberId); onClose(); }}>
            <Ionicons name="shield-outline" size={18} color="#3B82F6" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#374151' }}>Chuyển quyền quản trị viên</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
            onPress={() => { onAddMod?.(memberId); onClose(); }}>
            <Ionicons name="shield-half-outline" size={18} color="#3B82F6" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#374151' }}>Thêm làm phó nhóm</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
            onPress={() => { onRemoveMember?.(memberId); onClose(); }}>
            <Ionicons name="exit-outline" size={18} color="#EF4444" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#EF4444' }}>Xóa khỏi nhóm</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
            onPress={() => { onBanMember?.(memberId); onClose(); }}>
            <Ionicons name="ban-outline" size={18} color="#DC2626" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#DC2626' }}>Chặn khỏi nhóm</Text>
          </TouchableOpacity>
        </>
      )}
      {isModerator && onRevokeMod && (
        <>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
            onPress={() => { onRevokeMod?.(memberId); onClose(); }}>
            <Ionicons name="shield-half-outline" size={18} color="#EF4444" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#EF4444' }}>Bỏ chức phó nhóm</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
        </>
      )}
      {isAdmin && (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
          onPress={() => { onRemoveAdmin?.(memberId); onClose(); }}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={{ marginLeft: 8, fontSize: 14, color: '#EF4444' }}>Xóa tư cách quản trị viên</Text>
        </TouchableOpacity>
      )}
      {!isAdmin && isModerator && (
        <>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
            onPress={() => { onRemoveMember?.(memberId); onClose(); }}>
            <Ionicons name="exit-outline" size={18} color="#EF4444" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#EF4444' }}>Xóa khỏi nhóm</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
            onPress={() => { onBanMember?.(memberId); onClose(); }}>
            <Ionicons name="ban-outline" size={18} color="#DC2626" />
            <Text style={{ marginLeft: 8, fontSize: 14, color: '#DC2626' }}>Chặn khỏi nhóm</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  menuModalRoot: {
    flex: 1,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuPanel: {
    position: 'absolute',
    right: 16,
    minWidth: 240,
    maxWidth: 280,
    zIndex: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 30,
  },
});

export default function GroupInfo({ group, onParticipantsSynced }: GroupInfoProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [members, setMembers] = useState<ParticipantInfo[]>(group.participantInfo || []);
  const [groupSettings, setGroupSettings] = useState<Record<string, any>>(group.settings || {});
  const [openMenuForMember, setOpenMenuForMember] = useState<string | null>(null);
  const [menuAnchorY, setMenuAnchorY] = useState(120);
  const { user } = useUser();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const menuTriggerRefs = useRef<Record<string, View | null>>({});
  const onParticipantsSyncedRef = useRef(onParticipantsSynced);
  onParticipantsSyncedRef.current = onParticipantsSynced;

  // ── Nickname modal state ─────────────────────────────────────
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameTarget, setNicknameTarget] = useState<ParticipantInfo | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingJoinRequestInfo[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [blockedMembers, setBlockedMembers] = useState<BlockedMemberInfo[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const router = useRouter();

  // ── Re-sync khi prop group thay đổi ──────────────────────────
  useEffect(() => {
    setMembers(group.participantInfo || []);
  }, [group.participantInfo]);
  useEffect(() => {
    setGroupSettings(group.settings || {});
  }, [group.settings]);

  const myRole = members.find(p => p.id === user?.id)?.role?.toUpperCase() ?? 'MEMBER';
  const isAdmin = ['ADMIN', 'OWNER'].includes(myRole);
  const isMod = myRole === 'MOD' || myRole === 'MODERATOR';
  const requireApproval = groupSettings?.isReviewNewParticipant ?? false;

  // ── Load pending join requests (chỉ admin) ──────────────────
  const loadPendingRequests = useCallback(async () => {
    console.log('[GroupInfo] loadPendingRequests called', { isAdmin, requireApproval, groupId: group.id, myRole });
    if (!isAdmin || !requireApproval) { setPendingRequests([]); return; }
    setLoadingPending(true);
    try {
      const res = await ConversationService.getPendingJoinRequests(group.id);
      console.log('[GroupInfo] getPendingJoinRequests response:', JSON.stringify(res));
      setPendingRequests(res?.requests || []);
    } catch (err) { console.error('[GroupInfo] getPendingJoinRequests error:', err); setPendingRequests([]); }
    finally { setLoadingPending(false); }
  }, [group.id, isAdmin, requireApproval]);

  // ── Load blocked members (admin/mod) ─────────────────────────
  const loadBlockedMembers = useCallback(async () => {
    if (!isAdmin && !isMod) {
      setBlockedMembers([]);
      return;
    }
    setLoadingBlocked(true);
    try {
      const res = await ConversationService.getBlockedParticipants(group.id);
      const list = Array.isArray(res?.blockedUsers) ? res.blockedUsers : [];
      setBlockedMembers(list as BlockedMemberInfo[]);
    } catch (err) {
      console.error('[GroupInfo] getBlockedParticipants error:', err);
      setBlockedMembers([]);
    } finally {
      setLoadingBlocked(false);
    }
  }, [group.id, isAdmin, isMod]);

  // ── Fetch lại participants từ server ─────────────────────────
  const refreshParticipants = useCallback(async () => {
    try {
      const res = await ConversationService.getConversationById(group.id);
      if (res.success && res.conversation) {
        const list = res.conversation.participantInfo ?? [];
        setMembers((prev) =>
          list.map((p) => {
            const old = prev.find((x) => String(x.id) === String(p.id));
            const nameOk = p.name && String(p.name).trim().length > 0;
            return {
              ...p,
              name: nameOk ? p.name : old?.name || p.name || 'Người dùng',
              avatar: p.avatar || old?.avatar || '',
              nickname: p.nickname ?? old?.nickname,
            };
          }),
        );
        onParticipantsSyncedRef.current?.();
      }
    } catch (e) {
      console.error('[GroupInfo] refresh participants error:', e);
    }
  }, [group.id]);

  // ── Socket real-time: thêm / xóa thành viên /admin / mod ────
  useEffect(() => {
    const socket = SocketService.getInstance();

    const onAdded = (data: any) => {
      if (data?.conversationId === group.id) refreshParticipants();
    };
    const onRemoved = (data: any) => {
      if (data?.conversationId === group.id) {
        const removedIds: string[] = (data?.removedParticipants ?? []).map((id: string) => String(id));
        setMembers((prev) =>
          prev.filter((m) => !removedIds.some((rid) => rid === String(m.id))),
        );
      }
    };
    const onAdminTransferred = (data: any) => {
      if (data?.conversationId === group.id) refreshParticipants();
    };
    const onModGranted = (data: any) => {
      if (data?.conversationId === group.id) refreshParticipants();
    };
    const onModRevoked = (data: any) => {
      if (data?.conversationId === group.id) refreshParticipants();
    };
    const onNicknameUpdated = (data: any) => {
      if (data?.conversationId !== group.id) return;
      setMembers(prev =>
        prev.map(m =>
          m.id === data.targetUserId
            ? { ...m, nickname: data.nickname || undefined }
            : m
        )
      );
    };

    const onJoinRequest = (data: any) => {
      console.log('[GroupInfo] onGroupJoinRequest received:', data);
      const incomingConversationId = String(data?.conversationId ?? '').trim();
      if (!incomingConversationId || incomingConversationId !== String(group.id)) return;

      const incomingInviteId = String(data?.inviteId ?? '').trim();
      const requesterName = String(data?.requesterName ?? '').trim() || 'Người dùng';
      const requesterId = String(data?.requesterId ?? '').trim();
      const requesterAvatar =
        String(data?.requesterAvatar ?? data?.requesterAvatarUrl ?? '').trim();

      // Cập nhật tức thì để cảm giác realtime tốt hơn, sau đó fetch lại để đồng bộ chuẩn.
      if (incomingInviteId) {
        setPendingRequests((prev) => {
          const exists = prev.some(
            (r) => String(r._id ?? r.id ?? '') === incomingInviteId,
          );
          if (exists) return prev;
          return [
            {
              _id: incomingInviteId,
              id: incomingInviteId,
              user: {
                id: requesterId,
                name: requesterName,
                avatar: requesterAvatar,
              },
            },
            ...prev,
          ];
        });
      }

      void loadPendingRequests();
    };
    const onGroupSettingsUpdated = (data: any) => {
      if (data?.conversationId !== group.id) return;
      setGroupSettings(prev => ({ ...prev, ...(data?.settings || {}) }));
    };
    const onParticipantBanned = (data: any) => {
      if (data?.conversationId !== group.id) return;
      void loadBlockedMembers();
    };
    const onParticipantUnbanned = (data: any) => {
      if (data?.conversationId !== group.id) return;
      void loadBlockedMembers();
    };

    socket.onParticipantsAddedServer(onAdded);
    socket.onParticipantsRemoved(onRemoved);
    socket.onAdminTransferred(onAdminTransferred);
    socket.onModGranted(onModGranted);
    socket.onModRevoked(onModRevoked);
    socket.onNicknameUpdated(onNicknameUpdated);
    socket.onGroupJoinRequest(onJoinRequest);
    socket.onGroupSettingsUpdated(onGroupSettingsUpdated);
    socket.onParticipantBanned(onParticipantBanned);
    socket.onParticipantUnbanned(onParticipantUnbanned);

    return () => {
      socket.removeParticipantsAddedServer(onAdded);
      socket.removeParticipantsRemovedListener(onRemoved);
      socket.removeAdminTransferredListener(onAdminTransferred);
      socket.removeModGrantedListener(onModGranted);
      socket.removeModRevokedListener(onModRevoked);
      socket.removeNicknameUpdatedListener(onNicknameUpdated);
      socket.removeGroupJoinRequestListener(onJoinRequest);
      socket.removeGroupSettingsUpdatedListener(onGroupSettingsUpdated);
      socket.removeParticipantBannedListener(onParticipantBanned);
      socket.removeParticipantUnbannedListener(onParticipantUnbanned);
    };
  }, [group.id, refreshParticipants, loadPendingRequests, loadBlockedMembers]);

  // ── Actions ───────────────────────────────────────────────────
  const handleRemoveMember = (memberId: string) => {
    confirmDestructive(
      "Xóa thành viên",
      "Bạn có chắc muốn xóa thành viên này?",
      "Xóa",
      async () => {
        const res = await ConversationService.removeParticipants(group.id, [memberId]);
        if (res.success) {
          setMembers((prev) => prev.filter((m) => m.id !== memberId));
        } else {
          showErrorAlert("Lỗi", res.message || "Không thể xóa thành viên");
        }
      },
    );
  };

  const handleBanMember = (memberId: string) => {
    confirmDestructive(
      'Chặn thành viên',
      'Người này sẽ bị xóa khỏi nhóm và không thể tham gia lại bằng link/QR/lời mời.',
      'Chặn',
      async () => {
        const res = await ConversationService.banParticipant(group.id, memberId);
        if (res.success) {
          setMembers((prev) => prev.filter((m) => m.id !== memberId));
          void loadBlockedMembers();
          return;
        }
        showErrorAlert('Lỗi', res.message || 'Không thể chặn thành viên');
      },
    );
  };

  const handleUnbanMember = (memberId: string) => {
    confirmDestructive(
      'Bỏ chặn thành viên',
      'Sau khi bỏ chặn, người này có thể tham gia lại nhóm qua link/QR/lời mời như bình thường.',
      'Bỏ chặn',
      async () => {
        const res = await ConversationService.unbanParticipant(group.id, memberId);
        if (res.success) {
          setBlockedMembers((prev) => prev.filter((m) => String(m.id || m.userId) !== String(memberId)));
          return;
        }
        showErrorAlert('Lỗi', res.message || 'Không thể bỏ chặn thành viên');
      },
    );
  };

  const handleAddAdmin = async (memberId: string) => {
    // Optimistic: hạ tất cả admin/owner xuống member, nâng memberId lên owner
    setMembers(prev => prev.map(m => {
      const r = String(m.role).toUpperCase();
      if (r === 'OWNER' || r === 'ADMIN') return { ...m, role: 'member' as const };
      if (m.id === memberId) return { ...m, role: 'owner' as const };
      return m;
    }));
    const res = await ConversationService.transferAdmin(group.id, memberId);
    if (!res.success) showErrorAlert('Lỗi', res.message || 'Không thể chuyển admin');
    refreshParticipants();
  };

  const handleAddMod = async (memberId: string) => {
    // Optimistic: nâng lên moderator ngay
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, role: 'moderator' as const } : m
    ));
    const res = await ConversationService.grantModRole(group.id, memberId);
    if (!res.success) showErrorAlert('Lỗi', res.message || 'Không thể cấp phó nhóm');
    refreshParticipants();
  };

  const handleRevokeMod = async (memberId: string) => {
    const previous = members;
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: 'member' as const } : m)),
    );
    const res = await ConversationService.revokeModRole(group.id, memberId);
    if (!res.success) {
      setMembers(previous);
      showErrorAlert('Lỗi', res.message || 'Không thể hạ chức phó nhóm');
      return;
    }
    await refreshParticipants();
  };

  const handleRemoveAdmin = (memberId: string) => {
    confirmDestructive(
      "Hạ quyền",
      "Hạ quản trị viên này xuống thành viên thường?",
      "Xác nhận",
      async () => {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: "member" as const } : m)),
        );
        const res = await ConversationService.revokeModRole(group.id, memberId);
        if (!res.success) showErrorAlert("Lỗi", res.message || "Không thể hạ quyền");
        refreshParticipants();
      },
    );
  };

  // ── Nickname ──────────────────────────────────────────────────
  const openNicknameEditor = (member: ParticipantInfo) => {
    setNicknameTarget(member);
    setNicknameInput(member.nickname || '');
    setNicknameModalVisible(true);
  };

  const submitNickname = async () => {
    if (!nicknameTarget || !group?.id || nicknameSaving) return;
    setNicknameSaving(true);
    const cleaned = nicknameInput.trim();
    try {
      const res = await ConversationService.setGroupNickname(
        group.id,
        nicknameTarget.id,
        cleaned || null,
      );
      if (!res.success) {
        Alert.alert('Lỗi', res.message || 'Không thể cập nhật biệt danh.');
        return;
      }
      // Cập nhật local state ngay
      setMembers(prev =>
        prev.map(m =>
          m.id === nicknameTarget.id ? { ...m, nickname: cleaned || undefined } : m
        )
      );
      setNicknameModalVisible(false);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật biệt danh.');
    } finally {
      setNicknameSaving(false);
    }
  };


  // ── Load pending join requests (chỉ admin) ──────────────────

  /** Tải yêu cầu chờ duyệt khi có quyền — không phụ thuộc mở/đóng section (tránh mất số liệu khi đóng/mở lại panel). */
  useEffect(() => {
    if (isAdmin && requireApproval) void loadPendingRequests();
  }, [isAdmin, requireApproval, loadPendingRequests, group.id]);

  useEffect(() => {
    if (isAdmin || isMod) void loadBlockedMembers();
  }, [isAdmin, isMod, loadBlockedMembers, group.id]);

  /** Fallback one-shot khi mở panel: tránh hụt realtime nhưng không poll liên tục. */
  useEffect(() => {
    if (!showDetail) return;
    const timer = setTimeout(() => {
      if (isAdmin && requireApproval) void loadPendingRequests();
      if (isAdmin || isMod) void loadBlockedMembers();
    }, 900);
    return () => clearTimeout(timer);
  }, [showDetail, isAdmin, isMod, requireApproval, loadPendingRequests, loadBlockedMembers]);

  const handleApproveRequest = async (inviteId: string, name: string) => {
    try {
      await ConversationService.approveJoinRequest(inviteId);
      Alert.alert('Đã duyệt', `${name} đã được thêm vào nhóm`);
      setPendingRequests(prev => prev.filter(r => String(r._id ?? r.id ?? '') !== String(inviteId)));
      refreshParticipants();
    } catch { Alert.alert('Lỗi', 'Không thể duyệt yêu cầu'); }
  };

  const handleRejectRequest = async (inviteId: string, name: string) => {
    const performReject = async () => {
      try {
        const res = await ConversationService.rejectJoinRequest(inviteId);
        if (res.success) {
          setPendingRequests(prev => prev.filter(r => String(r._id ?? r.id ?? '') !== String(inviteId)));
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể từ chối yêu cầu');
        }
      } catch (e) {
        console.error('[GroupInfo] reject error:', e);
        Alert.alert('Lỗi', 'Không thể từ chối yêu cầu');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Bạn có chắc muốn từ chối yêu cầu tham gia của ${name}?`)) {
        void performReject();
      }
    } else {
      Alert.alert('Từ chối', `Từ chối yêu cầu của ${name}?`, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Từ chối', style: 'destructive', onPress: performReject },
      ]);
    }
  };

  const isOwner = myRole === 'OWNER';
  const isAllowModManage = groupSettings?.isAllowModManage ?? true;

  // Xác định target member role
  const getTargetRole = (member: ParticipantInfo) => String(member.role).toUpperCase();

  // Ai được thấy "..." cho ai?
  // OWNER → thấy cho tất cả (trừ chính mình)
  // MOD → chỉ thấy cho MEMBER thường (nếu isAllowModManage = true)
  // ADMIN → thấy cho MOD + MEMBER (trừ OWNER)
  const canShowMenuFor = (member: ParticipantInfo) => {
    if (member.id === user?.id) return false; // bản thân
    const targetRole = getTargetRole(member);
    if (isOwner) return true; // owner thấy tất cả
    if (isAdmin && !isOwner) return !['OWNER'].includes(targetRole); // admin thấy trừ owner
    if (isMod && isAllowModManage) return targetRole === 'MEMBER'; // mod chỉ thấy member (khi được phép)
    return false;
  };

  const handleOpenMemberProfile = useCallback((memberId: string) => {
    const targetId = String(memberId || '').trim();
    if (!targetId) return;
    router.push({ pathname: '/profileUser', params: { userId: targetId } } as any);
  }, [router]);

  const owners   = members.filter(m => String(m.role).toUpperCase() === 'OWNER');
  const admins   = members.filter(m => String(m.role).toUpperCase() === 'ADMIN');
  const mods     = members.filter(m => ['MOD','MODERATOR'].includes(String(m.role).toUpperCase()));
  const normalMembers = members.filter(m => !['OWNER','ADMIN','MOD','MODERATOR'].includes(String(m.role).toUpperCase()));

  // ── Avatar helper: ưu tiên URL thực, fallback về initials ────
  const getInitials = (name: string) => {
    const parts = (name || '').trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name || 'U').slice(0, 2).toUpperCase();
  };

  const getRoleBg = (role: string) => {
    const r = role.toUpperCase();
    if (r === 'OWNER') return ['#FEF3C7', '#F59E0B'];
    if (r === 'ADMIN') return ['#DBEAFE', '#3B82F6'];
    if (r === 'MOD' || r === 'MODERATOR') return ['#D1FAE5', '#10B981'];
    return ['#F3F4F6', '#9CA3AF'];
  };

  const AvatarView = ({ member, size = 44 }: { member: ParticipantInfo; size?: number }) => {
    const [imgError, setImgError] = useState(false);
    const hasUrl = member.avatar && member.avatar !== 'default' && !imgError;
    const [bg, border] = getRoleBg(member.role ?? '');
    const initials = getInitials(member.name || member.nickname || '');
    if (hasUrl) {
      return (
        <Image
          source={{ uri: member.avatar }}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: border }}
          onError={() => setImgError(true)}
        />
      );
    }
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bg, borderWidth: 2, borderColor: border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: size * 0.36, fontWeight: '700', color: border }}>{initials}</Text>
      </View>
    );
  };

  /** Render một thành viên (dùng chung cho admin/member) */
  const renderMember = (member: ParticipantInfo, index: number, isAdminMember: boolean) => {
    const isMyself = member.id === user?.id;
    const [, roleBorder] = getRoleBg(member.role ?? '');

    return (
      <View
        key={member.id}
        style={{
          position: 'relative',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginBottom: 4,
          borderRadius: 12,
          backgroundColor: isMyself ? '#EEF2FF' : '#FAFAFA',
          borderWidth: 1,
          borderColor: isMyself ? '#C7D2FE' : '#F3F4F6',
          overflow: 'visible',
          zIndex: openMenuForMember === member.id ? 999 : 0,
        }}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => handleOpenMemberProfile(member.id)}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, overflow: 'visible' }}
        >
          <AvatarView member={member} size={44} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>
                {member.nickname || member.name}
              </Text>
              {member.nickname ? (
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>({member.name})</Text>
              ) : null}
              {isMyself && (
                <View style={{ marginLeft: 6, backgroundColor: '#6366F1', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>Bạn</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              {(() => {
                const r = String(member.role ?? '').toUpperCase();
                if (r === 'OWNER') return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Ionicons name="star" size={11} color="#D97706" />
                    <Text style={{ fontSize: 11, color: '#D97706', marginLeft: 3, fontWeight: '700' }}>Trưởng nhóm</Text>
                  </View>
                );
                if (r === 'ADMIN') return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Ionicons name="shield-checkmark" size={11} color="#2563EB" />
                    <Text style={{ fontSize: 11, color: '#2563EB', marginLeft: 3, fontWeight: '600' }}>Quản trị viên</Text>
                  </View>
                );
                if (r === 'MOD' || r === 'MODERATOR') return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Ionicons name="shield-half-outline" size={11} color="#059669" />
                    <Text style={{ fontSize: 11, color: '#059669', marginLeft: 3, fontWeight: '600' }}>Phó nhóm</Text>
                  </View>
                );
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Thành viên</Text>
                  </View>
                );
              })()}
            </View>
          </View>
        </TouchableOpacity>

        {/* Nút hành động */}
        {isMyself ? (
          <TouchableOpacity
            style={{
              width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF2FF',
              alignItems: 'center', justifyContent: 'center',
            }}
            onPress={() => openNicknameEditor(member)}>
            <Ionicons name="create-outline" size={17} color="#6366F1" />
          </TouchableOpacity>
        ) : (isAdmin || isMod) ? (
          <View style={{ position: 'relative', overflow: 'visible' }}>
            <View
              collapsable={false}
              ref={(node) => {
                if (node) menuTriggerRefs.current[member.id] = node;
                else delete menuTriggerRefs.current[member.id];
              }}
            >
            <TouchableOpacity
              style={{
                width: 32, height: 32, borderRadius: 10, backgroundColor: '#F9FAFB',
                alignItems: 'center', justifyContent: 'center',
              }}
              onPress={() => {
                if (openMenuForMember === member.id) {
                  setOpenMenuForMember(null);
                  return;
                }
                const el = menuTriggerRefs.current[member.id];
                /** Chiều cao ước lượng menu (đủ để quyết định lật lên trên khi gần đáy màn hình) */
                const estMenuH = 300;
                const gap = 6;
                const topMin = insets.top + 8;
                const bottomLimit = windowHeight - insets.bottom - 16;
                const openMenu = () => setOpenMenuForMember(member.id);
                if (el && typeof el.measureInWindow === 'function') {
                  el.measureInWindow((_x, winY, _w, winH) => {
                    let top = winY + winH + gap;
                    if (top + estMenuH > bottomLimit) {
                      top = Math.max(topMin, winY - estMenuH - gap);
                    }
                    setMenuAnchorY(top);
                    openMenu();
                  });
                } else {
                  setMenuAnchorY(topMin + 80);
                  openMenu();
                }
              }}>
              <Ionicons name="ellipsis-horizontal" size={19} color="#6B7280" />
            </TouchableOpacity>
            </View>
            <MemberMenu
              visible={openMenuForMember === member.id}
              onClose={() => setOpenMenuForMember(null)}
              isAdmin={['ADMIN','OWNER'].includes(String(member.role).toUpperCase())}
              isModerator={['MOD','MODERATOR'].includes(String(member.role).toUpperCase())}
              memberId={member.id}
              menuAnchorY={menuAnchorY}
              onViewProfile={handleOpenMemberProfile}
              onRemoveMember={(isAdmin || isMod) ? handleRemoveMember : undefined}
              onBanMember={(isAdmin || isMod) ? handleBanMember : undefined}
              onAddAdmin={isAdmin ? handleAddAdmin : undefined}
              onAddMod={isAdmin ? handleAddMod : undefined}
              onRevokeMod={isAdmin ? handleRevokeMod : undefined}
              onRemoveAdmin={isAdmin ? handleRemoveAdmin : undefined}
              onSetNickname={isAdmin ? () => openNicknameEditor(member) : undefined}
            />
          </View>
        ) : null}
      </View>
    );
  };
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 4, borderBottomColor: '#E5E7EB', overflow: 'visible' }}>
      {/* Header */}
      <TouchableOpacity
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
        onPress={() => setShowDetail(!showDetail)}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#1e293b' }}>
          Thành viên nhóm ({members.length})
        </Text>
        <Ionicons name={showDetail ? 'chevron-up' : 'chevron-down'} size={18} color="#3B82F6" />
      </TouchableOpacity>

      {showDetail && (
        <View style={{ marginTop: 4 }}>
          {/* Yêu cầu chờ duyệt — chỉ khi bật duyệt thành viên mới + admin/owner */}
          {requireApproval && isAdmin && (
            <View
              style={{
                marginBottom: 12,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>⏳</Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: '#D97706',
                    fontWeight: '800',
                    letterSpacing: 0.5,
                  }}
                >
                  YÊU CẦU CHỜ DUYỆT ({pendingRequests.length})
                </Text>
              </View>
              {loadingPending ? (
                <ActivityIndicator size="small" color="#D97706" />
              ) : pendingRequests.length === 0 ? (
                <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Không có yêu cầu nào</Text>
              ) : (
                pendingRequests.map((req) => {
                  const inviteId = String(req.id ?? req._id ?? '');
                  const u = req.user;
                  const displayName = u?.name || req.invitee?.name || 'Người dùng';
                  const avatar = u?.avatar || req.invitee?.avatarUrl || '';
                  return (
                    <View
                      key={inviteId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F9FAFB',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#FEF3C7',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                          overflow: 'hidden',
                        }}
                      >
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={{ width: 40, height: 40 }} />
                        ) : (
                          <Ionicons name="person" size={20} color="#D97706" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{displayName}</Text>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Đang chờ duyệt</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => void handleApproveRequest(inviteId, displayName)}
                        style={{
                          backgroundColor: '#0EA5E9',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Duyệt</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void handleRejectRequest(inviteId, displayName)}
                        style={{
                          backgroundColor: '#E5E7EB',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: '#4B5563', fontSize: 12, fontWeight: '600' }}>Từ chối</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Danh sách đã chặn — admin/mod có thể bỏ chặn */}
          {(isAdmin || isMod) && (
            <View
              style={{
                marginBottom: 12,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="ban-outline" size={14} color="#DC2626" style={{ marginRight: 6 }} />
                <Text
                  style={{
                    fontSize: 10,
                    color: '#DC2626',
                    fontWeight: '800',
                    letterSpacing: 0.5,
                  }}
                >
                  DANH SÁCH BỊ CHẶN ({blockedMembers.length})
                </Text>
              </View>
              {loadingBlocked ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : blockedMembers.length === 0 ? (
                <Text style={{ fontSize: 13, color: '#9CA3AF' }}>Chưa có thành viên nào bị chặn</Text>
              ) : (
                blockedMembers.map((bm) => {
                  const blockedId = String(bm.id || bm.userId || '');
                  const displayName =
                    String(bm.name || bm.displayName || 'Người dùng').trim() || 'Người dùng';
                  const avatar = String(bm.avatar || bm.avatarUrl || '').trim();
                  return (
                    <View
                      key={blockedId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: '#F9FAFB',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: '#FEE2E2',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                          overflow: 'hidden',
                        }}
                      >
                        {avatar ? (
                          <Image source={{ uri: avatar }} style={{ width: 40, height: 40 }} />
                        ) : (
                          <Ionicons name="person" size={20} color="#B91C1C" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{displayName}</Text>
                        <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Đã bị chặn khỏi nhóm</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleUnbanMember(blockedId)}
                        style={{
                          backgroundColor: '#DCFCE7',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: '#166534', fontSize: 12, fontWeight: '700' }}>Bỏ chặn</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* Trưởng nhóm */}
          {owners.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginHorizontal: 8 }}>
                  <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '800', letterSpacing: 0.5 }}>⭐ TRƯỞNG NHÓM</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
              </View>
              {owners.map((member, index) => renderMember(member, index, true))}
            </View>
          )}

          {/* Quản trị viên */}
          {admins.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginHorizontal: 8 }}>
                  <Ionicons name="shield-checkmark" size={10} color="#2563EB" />
                  <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '800', letterSpacing: 0.5, marginLeft: 3 }}>QUẢN TRỊ VIÊN ({admins.length})</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
              </View>
              {admins.map((member, index) => renderMember(member, index, true))}
            </View>
          )}

          {/* Phó nhóm */}
          {mods.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginHorizontal: 8 }}>
                  <Ionicons name="shield-half-outline" size={10} color="#059669" />
                  <Text style={{ fontSize: 10, color: '#059669', fontWeight: '800', letterSpacing: 0.5, marginLeft: 3 }}>PHÓ NHÓM ({mods.length})</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
              </View>
              {mods.map((member, index) => renderMember(member, index, true))}
            </View>
          )}

          {/* Thành viên thường */}
          {normalMembers.length > 0 && (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginHorizontal: 8 }}>
                  <Ionicons name="people-outline" size={10} color="#6B7280" />
                  <Text style={{ fontSize: 10, color: '#6B7280', fontWeight: '700', letterSpacing: 0.5, marginLeft: 3 }}>THÀNH VIÊN ({normalMembers.length})</Text>
                </View>
                <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
              </View>
              {normalMembers.map((member, index) => renderMember(member, index, false))}
            </View>
          )}
        </View>
      )}

      {/* ── Nickname Edit Modal ── */}
      <Modal
        visible={nicknameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNicknameModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '85%', maxWidth: 380, overflow: 'hidden' }}>
            <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Đặt biệt danh</Text>
              <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                Đổi biệt danh cho {nicknameTarget?.name || 'thành viên'}
              </Text>
            </View>
            <View style={{ padding: 16 }}>
              <TextInput
                style={{
                  borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 10,
                  fontSize: 15, color: '#111827',
                }}
                value={nicknameInput}
                onChangeText={setNicknameInput}
                placeholder="Nhập biệt danh (để trống để xoá)"
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>
            <View style={{ flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setNicknameModalVisible(false)}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center',
                }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitNickname}
                disabled={nicknameSaving}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center',
                  opacity: nicknameSaving ? 0.6 : 1,
                }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>
                  {nicknameSaving ? 'Đang lưu...' : 'Lưu'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
