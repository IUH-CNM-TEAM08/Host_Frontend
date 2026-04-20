import React, { useEffect, useState } from 'react';
import { Alert, Platform, View, Text, TouchableOpacity, Switch, Modal, TextInput, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AddMemberModal from './AddMemberModal';
import GroupQRModal from './GroupQRModal';
import { Conversation, ParticipantInfo } from '@/src/models/Conversation';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import { messageService as MessageService } from '@/src/api/services/message.service';
import { blockSettingService } from '@/src/api/services/communication.service';
import { friendshipService } from '@/src/api/services/friendship.service';
import { userService as UserService } from '@/src/api/services/user.service';
import { reminderService } from '@/src/api/services/reminder.service';
import { useUser } from '@/src/contexts/user/UserContext';
import { User } from '@/src/models/User';
import SocketService from '@/src/api/socketCompat';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import GroupManagementModal from './GroupManagementModal';
import CreateGroup from '../contacts/CreateGroup';
import Toast from '@/src/components/ui/Toast';

/** Gộp participant từ API với bản đang có — tránh mất tên/avatar khi GET chỉ trả id/role (giống Info.tsx). */
function mergeParticipantRows(
    prev: ParticipantInfo[] | undefined,
    incoming: ParticipantInfo[],
): ParticipantInfo[] {
    return incoming.map((p) => {
        const old = prev?.find((x) => String(x.id) === String(p.id));
        const nameOk = p.name && String(p.name).trim().length > 0;
        return {
            ...p,
            id: String(p.id),
            name: nameOk ? p.name! : old?.name || p.name || 'Người dùng',
            avatar: p.avatar || old?.avatar || '',
            nickname: p.nickname ?? old?.nickname,
            role: p.role ?? old?.role,
        };
    });
}

interface ActionsInfoProps {
    selectChat: Conversation | null;
    setLoadConversation: React.Dispatch<React.SetStateAction<Conversation | null>>;
    onSearchPress: () => void;
    otherUser?: User | null;
    onMuteChange?: (conversationId: string, muted: boolean) => void;
    onDeleteChat?: (conversationId: string) => void;
    onHistoryCleared?: () => void;
    onHideChat?: (conversationId: string) => void;
    onUnhideChat?: (conversationId: string) => void;
    onPinChange?: (conversationId: string, pinned: boolean) => void;
    onActionCompleted?: () => void;
    onCreateGroupPress?: () => void;
    setIsUploadingAvatar?: (uploading: boolean) => void;
}

interface RowItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress?: () => void;
    right?: React.ReactNode;
    iconColor?: string;
    danger?: boolean;
}

function ActionRow({ icon, label, onPress, right, iconColor = '#0068ff', danger }: RowItem) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={onPress ? 0.6 : 1}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 13,
                backgroundColor: 'white',
            }}
        >
            <View style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: danger ? '#FEF2F2' : '#EFF6FF',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 12,
            }}>
                <Ionicons name={icon} size={18} color={danger ? '#ef4444' : iconColor} />
            </View>
            <Text style={{
                flex: 1, fontSize: 14, fontWeight: '500',
                color: danger ? '#ef4444' : '#111827',
            }}>
                {label}
            </Text>
            {right ?? (onPress && (
                <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            ))}
        </TouchableOpacity>
    );
}

export interface ActionsInfoHandle {
    openRenameModal: () => void;
    triggerChangeAvatar: () => void;
    amGroupAdmin: boolean;
}

const ActionsInfoRender: React.ForwardRefRenderFunction<ActionsInfoHandle, ActionsInfoProps> = (props, ref) => {
    const {
        selectChat,
        setLoadConversation,
        onSearchPress,
        otherUser,
        onMuteChange,
        onDeleteChat,
        onHistoryCleared,
        onHideChat,
        onUnhideChat,
        onPinChange,
        onActionCompleted,
        onCreateGroupPress,
        setIsUploadingAvatar,
    } = props;
    const [addMemberVisible, setAddMemberVisible] = useState(false);
    const [muteOn, setMuteOn] = useState(false);
    const [muteLoading, setMuteLoading] = useState(false);
    const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
    const [deleteChatLoading, setDeleteChatLoading] = useState(false);
    const [showHideChatModal, setShowHideChatModal] = useState(false);
    const [hidePin, setHidePin] = useState('');
    const [hidePinConfirm, setHidePinConfirm] = useState('');
    const [hideChatLoading, setHideChatLoading] = useState(false);
    const [showUnhideModal, setShowUnhideModal] = useState(false);
    const [unhidePin, setUnhidePin] = useState('');
    const [unhideLoading, setUnhideLoading] = useState(false);
    const [showAppointmentModal, setShowAppointmentModal] = useState(false);
    const [showNicknameModal, setShowNicknameModal] = useState(false);
    const [appointmentTitle, setAppointmentTitle] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [appointmentPickerDate, setAppointmentPickerDate] = useState(new Date());
    const [appointmentSaving, setAppointmentSaving] = useState(false);
    const [nicknameInput, setNicknameInput] = useState('');
    const [nicknameSaving, setNicknameSaving] = useState(false);
    const [conversationPinned, setConversationPinned] = useState(false);
    const [pinLoading, setPinLoading] = useState(false);
    const [myMessageBlocked, setMyMessageBlocked] = useState(false);
    const [myCallBlocked, setMyCallBlocked] = useState(false);
    const [peerMessageBlocked, setPeerMessageBlocked] = useState(false);
    const [peerCallBlocked, setPeerCallBlocked] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    const [friendshipId, setFriendshipId] = useState<string | null>(null);
    const [friendshipAccepted, setFriendshipAccepted] = useState(false);
    const [userBlocked, setUserBlocked] = useState(false);
    const [userBlockLoading, setUserBlockLoading] = useState(false);
    // ── Group-specific state ──
    const [allowMessaging, setAllowMessaging] = useState<boolean>(true);
    const [allowMessagingLoading, setAllowMessagingLoading] = useState(false);
    const [showPinnedMessages, setShowPinnedMessages] = useState(false);
    const [showRenameGroupModal, setShowRenameGroupModal] = useState(false);
    const [renameGroupInput, setRenameGroupInput] = useState('');
    const [renameGroupLoading, setRenameGroupLoading] = useState(false);
    // ── Group Invite state (1-1 chat) ──
    const [showInviteToGroupModal, setShowInviteToGroupModal] = useState(false);
    const [myAdminGroups, setMyAdminGroups] = useState<any[]>([]);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteSentGroupId, setInviteSentGroupId] = useState<string | null>(null);
    const [inviteSentToast, setInviteSentToast] = useState({ visible: false, message: '' });
    const [showCreateGroupWithModal, setShowCreateGroupWithModal] = useState(false);
    // ── QR / Invite Link ──
    const [showQRModal, setShowQRModal] = useState(false);
    const [groupManagementVisible, setGroupManagementVisible] = useState(false);
    const [requireApproval, setRequireApproval] = useState(
        selectChat?.settings?.isReviewNewParticipant ?? false
    );
    const applyTwoWayBlock = false;
    const router = useRouter();
    const { user } = useUser();
    const socketService = React.useRef(SocketService.getInstance()).current;

    useEffect(() => {
        const me = selectChat?.participantInfo?.find(p => p.id === user?.id);
        setMuteOn((me as any)?.muted ?? false);
    }, [selectChat?.id, user?.id]);

    useEffect(() => {
        const pinnedFromConversation = (selectChat as any)?.pinned;
        setConversationPinned(Boolean(pinnedFromConversation));
        // Sync allowMessaging from group settings
        if (selectChat?.isGroup) {
            setAllowMessaging(selectChat.settings?.isAllowMessaging ?? true);
        }
    }, [selectChat?.id, (selectChat as any)?.pinned, selectChat?.settings?.isAllowMessaging]);

    useEffect(() => {
        setRequireApproval(selectChat?.settings?.isReviewNewParticipant ?? false);
    }, [selectChat?.id, selectChat?.settings?.isReviewNewParticipant]);

    const fetchConversation = async (id: string) => {
        try {
            const res = await ConversationService.getConversationById(id);
            const incoming = res.conversation;
            if (!incoming) return;
            setLoadConversation((prev) => {
                if (!prev || prev.id !== id) return incoming;
                const incP = incoming.participantInfo ?? [];
                if (incP.length === 0) {
                    return { ...prev, ...incoming, participantInfo: prev.participantInfo };
                }
                return {
                    ...prev,
                    ...incoming,
                    participantIds: incoming.participantIds?.length
                        ? incoming.participantIds
                        : prev.participantIds,
                    participantInfo: mergeParticipantRows(prev.participantInfo, incP),
                };
            });
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (addMemberVisible && selectChat?.id) fetchConversation(selectChat.id);
    }, [addMemberVisible]);

    const handleMuteToggle = async () => {
        if (!selectChat?.id || !user?.id || muteLoading) return;
        const next = !muteOn;
        setMuteOn(next);
        setMuteLoading(true);
        try {
            if (next) await ConversationService.mute(selectChat.id, user.id);
            else await ConversationService.unmute(selectChat.id, user.id);
            onMuteChange?.(selectChat.id, next);
        } catch (e) {
            setMuteOn(!next);
        } finally {
            setMuteLoading(false);
        }
    };

    const handleViewProfile = () => {
        const id = otherUser?.id;
        if (!id) { Alert.alert('Không tìm thấy thông tin người dùng'); return; }
        router.push({ pathname: '/profileUser', params: { userId: id } } as any);
    };

    const isGroup = selectChat?.isGroup ?? false;
    const isHiddenSession = !!selectChat?.isHiddenSession;
    const peerId = !isGroup
        ? (selectChat?.participantIds || []).find((id) => id !== user?.id)
        : undefined;

    const myRole = isGroup ? selectChat?.participantInfo?.find(p => p.id === user?.id)?.role : undefined;
    const roleNorm = String(myRole ?? '').toLowerCase();
    const amGroupAdmin = roleNorm === 'admin' || roleNorm === 'owner';
    const amGroupModerator = roleNorm === 'mod' || roleNorm === 'moderator';
    const canManageGroupSettings = amGroupAdmin || amGroupModerator;
    /** Chủ nhóm / quản trị (không gồm phó nhóm) — dùng cho quản lý nhóm, bỏ ghim */
    const isRealAdmin = amGroupAdmin;
    const allowMemberChangeMetadata = Boolean(selectChat?.settings?.isAllowMemberChangeMetadata ?? true);
    const canEditMetadata = canManageGroupSettings || allowMemberChangeMetadata;

    React.useImperativeHandle(
        ref,
        () => ({
            openRenameModal: () => {
                if (!isGroup || !canEditMetadata) return;
                setRenameGroupInput(selectChat?.name || '');
                setShowRenameGroupModal(true);
            },
            triggerChangeAvatar: () => {
                // Không dùng trong luồng hiện tại.
            },
            amGroupAdmin,
        }),
        [isGroup, canEditMetadata, selectChat?.name, amGroupAdmin],
    );

    const handleToggleAllowMessaging = async () => {
        if (!selectChat?.id || allowMessagingLoading || !canManageGroupSettings) return;

        const next = !allowMessaging;
        
        // Cập nhật UI ngay lập tức cho admin
        setAllowMessaging(next);
        setAllowMessagingLoading(true);
        try {
            await ConversationService.updateAllowMessaging(selectChat.id);
        } catch {
            setAllowMessaging(!next);
            Alert.alert('Lỗi', 'Không thể cập nhật cài đặt nhóm');
        } finally {
            setAllowMessagingLoading(false);
        }
    };

    
    // ── Realtime: Cập nhật cài đặt nhóm cho tất cả thành viên ──
    useEffect(() => {
        if (!selectChat?.id || !socketService) return;

        const handleSettingsUpdated = (payload: any) => {
            if (payload.conversationId !== selectChat.id) return;

            if (typeof payload.isAllowMessaging === 'boolean') {
                console.log('📢 Nhận được cập nhật quyền nhắn tin:', payload.isAllowMessaging); // để debug

                setAllowMessaging(payload.isAllowMessaging);

                // Đồng bộ lại object conversation
                setLoadConversation((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        settings: {
                            ...(prev.settings || {}),
                            isAllowMessaging: payload.isAllowMessaging,
                        },
                    };
                });
            }
        };

        // ✅ Sửa tên event cho khớp với backend
        socketService.onGroupSettingsUpdated?.(handleSettingsUpdated);

        return () => {
            socketService.removeGroupSettingsUpdatedListener?.(handleSettingsUpdated);
        };
    }, [selectChat?.id, socketService, setLoadConversation]);

    const handleRenameGroup = async () => {
        if (!selectChat?.id || renameGroupLoading || !canEditMetadata) return;
        const name = renameGroupInput.trim();
        if (!name) { Alert.alert('Thiếu thông tin', 'Tên nhóm không được để trống.'); return; }
        if (name === selectChat.name) { setShowRenameGroupModal(false); return; }
        setRenameGroupLoading(true);
        try {
            const res = await ConversationService.updateGroup(selectChat.id, { name });
            if (res?.success === false) {
                Alert.alert('Lỗi', res?.message || 'Không thể đổi tên nhóm.');
                return;
            }
            setLoadConversation(prev => prev ? { ...prev, name } : prev);
            setShowRenameGroupModal(false);
            onActionCompleted?.();
        } catch {
            Alert.alert('Lỗi', 'Không thể đổi tên nhóm. Vui lòng thử lại.');
        } finally {
            setRenameGroupLoading(false);
        }
    };

    /** Load danh sách nhóm mình là thành viên (không cần admin) để invite người kia - chuẩn Zalo */
    const loadAdminGroups = async () => {
        if (!user?.id) return;
        const peerId = selectChat?.participantIds?.find(id => id !== user.id);
        if (!peerId) {
            setMyAdminGroups([]);
            return;
        }

        try {
            const allConvRes: any = await ConversationService.getConversations();
            const allConvs: any[] = Array.isArray(allConvRes?.conversations)
                ? allConvRes.conversations
                : [];
            // Lọc: nhóm mà mình tham gia, và người kia vẫn chưa ở trong nhóm
            const myGroups = allConvs.filter(c => {
                const isGroupConv = Boolean(c?.isGroup) || String(c?.type || '').toUpperCase() === 'GROUP';
                if (!isGroupConv) return false;
                const participantIds: string[] = Array.isArray(c?.participantIds)
                    ? c.participantIds.map((id: string) => String(id))
                    : [];
                const peerAlreadyIn = participantIds.includes(String(peerId));
                return !peerAlreadyIn;
            });
            setMyAdminGroups(myGroups);
        } catch {
            setMyAdminGroups([]);
        }
    };

    const handleSendGroupInvite = async (groupId: string) => {
        const peerId = selectChat?.participantIds?.find(id => id !== user?.id);
        if (!peerId) {
            Alert.alert('Lỗi', 'Không tìm thấy người cần mời.');
            return;
        }
        if (inviteLoading) return;

        setInviteLoading(true);
        try {
            const res = await ConversationService.sendGroupInvite(groupId, peerId);
            if (res?.success) {
                setInviteSentGroupId(groupId);
                const message = res.message || 'Đã gửi lời mời tham gia nhóm.';
                setShowInviteToGroupModal(false);
                // Hiện toast sau khi đóng modal (tránh bị che / RN Modal nuốt overlay)
                setTimeout(() => setInviteSentToast({ visible: true, message }), 280);
            } else {
                Alert.alert('Lỗi', res?.message || 'Không thể gửi lời mời.');
            }
        } catch (error: any) {
            console.error('[ActionsInfo] sendGroupInvite error', error);
            Alert.alert('Lỗi', error?.message || 'Không gửi được lời mời.');
        } finally {
            setInviteLoading(false);
        }
    };

    const pinnedMessages = isGroup ? (selectChat?.pinMessages ?? []) : [];

    const isBlockSectionVisible = Boolean(!isGroup && selectChat?.id && user?.id && peerId);
    const actorDisplayName = String(user?.name ?? 'Người dùng').trim() || 'Người dùng';
    const peerDisplayName = String(otherUser?.name ?? 'đối phương').trim() || 'đối phương';

    const formatAppointmentTime = (iso: string) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    };
    const formatDateText = (date: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    };
    const formatTimeText = (date: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const parseAppointmentDateTime = (dateInput: string, timeInput: string): string | null => {
        const mDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateInput.trim());
        const mTime = /^(\d{2}):(\d{2})$/.exec(timeInput.trim());
        if (!mDate || !mTime) return null;
        const day = Number(mDate[1]);
        const month = Number(mDate[2]);
        const year = Number(mDate[3]);
        const hour = Number(mTime[1]);
        const minute = Number(mTime[2]);
        const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
        if (
            dt.getFullYear() !== year ||
            dt.getMonth() !== month - 1 ||
            dt.getDate() !== day ||
            dt.getHours() !== hour ||
            dt.getMinutes() !== minute
        ) return null;
        return dt.toISOString();
    };

    const openNicknameEditor = () => {
        if (!selectChat || selectChat.isGroup || !user?.id) return;
        const currentNickname = String(selectChat.participantInfo?.find((p) => p.id === user.id)?.nickname ?? '').trim();
        setNicknameInput(currentNickname);
        setShowNicknameModal(true);
    };

    const submitNicknameFromInfo = async () => {
        if (!selectChat?.id || !user?.id || selectChat.isGroup || nicknameSaving) return;
        setNicknameSaving(true);
        const cleaned = nicknameInput.trim();
        const previousNickname = String(selectChat.participantInfo?.find((p) => p.id === user.id)?.nickname ?? '').trim();
        const action: 'set' | 'update' | 'clear' =
            !previousNickname && cleaned ? 'set' : previousNickname && !cleaned ? 'clear' : 'update';
        try {
            socketService.updateConversationNickname({
                conversationId: selectChat.id,
                userId: user.id,
                newNickname: cleaned || null,
            });
            let content = `${actorDisplayName} đã đổi biệt danh từ "${previousNickname || '(trống)'}" thành "${cleaned || '(trống)'}" trong cuộc trò chuyện với ${peerDisplayName}.`;
            if (action === 'set') {
                content = `${actorDisplayName} đã đặt biệt danh của mình thành "${cleaned}" trong cuộc trò chuyện với ${peerDisplayName}.`;
            } else if (action === 'clear') {
                content = previousNickname
                    ? `${actorDisplayName} đã hủy biệt danh "${previousNickname}" trong cuộc trò chuyện với ${peerDisplayName}.`
                    : `${actorDisplayName} đã hủy biệt danh trong cuộc trò chuyện với ${peerDisplayName}.`;
            }
            await MessageService.send({
                conversationId: selectChat.id,
                senderId: user.id,
                content,
                type: 'SYSTEM',
            });
            setShowNicknameModal(false);
            onActionCompleted?.();
        } catch {
            Alert.alert('Lỗi', 'Không thể cập nhật biệt danh. Vui lòng thử lại.');
        } finally {
            setNicknameSaving(false);
        }
    };

    const submitAppointmentFromInfo = async () => {
        if (!selectChat?.id || !user?.id || selectChat.isGroup || appointmentSaving) return;
        const title = appointmentTitle.trim();
        if (!title) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề lịch hẹn.');
            return;
        }
        const remindAtIso = parseAppointmentDateTime(appointmentDate, appointmentTime);
        if (!remindAtIso) {
            Alert.alert('Sai định dạng', 'Ngày giờ phải đúng định dạng dd/mm/yyyy và HH:mm.');
            return;
        }
        const otherId = selectChat.participantIds.find((id) => id !== user.id);
        setAppointmentSaving(true);
        try {
            const myReminderRes: any = await reminderService.create({
                conversationId: selectChat.id,
                userId: user.id,
                title,
                remindAt: remindAtIso,
            });
            const peerReminderRes: any = otherId
                ? await reminderService.create({
                    conversationId: selectChat.id,
                    userId: otherId,
                    title,
                    remindAt: remindAtIso,
                })
                : null;
            const myReminderData = (myReminderRes as any)?.data ?? myReminderRes;
            const peerReminderData = (peerReminderRes as any)?.data ?? peerReminderRes;
            const content = `Lịch hẹn: ${title}\nThời gian: ${formatAppointmentTime(remindAtIso)}`;
            const created: any = await MessageService.send({
                conversationId: selectChat.id,
                senderId: user.id,
                content,
                type: 'TEXT',
                storyContext: {
                    kind: 'appointment',
                    title,
                    remindAt: remindAtIso,
                    creatorId: user.id,
                    myReminderId: myReminderData?._id ?? myReminderData?.id,
                    peerReminderId: peerReminderData?._id ?? peerReminderData?.id,
                },
            } as any);
            const createdData = (created as any)?.data ?? created;
            const createdMessageId = createdData?.id ?? createdData?._id;
            if (createdMessageId) {
                await MessageService.pin(createdMessageId).catch(() => {});
            }
            await MessageService.send({
                conversationId: selectChat.id,
                senderId: user.id,
                content: `${actorDisplayName} đã tạo lịch hẹn "${title}" với ${peerDisplayName} vào ${formatAppointmentTime(remindAtIso)}.`,
                type: 'SYSTEM',
            });
            setShowAppointmentModal(false);
            onActionCompleted?.();
        } catch {
            Alert.alert('Lỗi', 'Không thể tạo lịch hẹn. Vui lòng thử lại.');
        } finally {
            setAppointmentSaving(false);
        }
    };
    const handleDatePicked = (event: DateTimePickerEvent, picked?: Date) => {
        setShowDatePicker(false);
        if (event.type !== 'set' || !picked) return;
        const next = new Date(appointmentPickerDate);
        next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        setAppointmentPickerDate(next);
        setAppointmentDate(formatDateText(next));
    };
    const handleTimePicked = (event: DateTimePickerEvent, picked?: Date) => {
        setShowTimePicker(false);
        if (event.type !== 'set' || !picked) return;
        const next = new Date(appointmentPickerDate);
        next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        setAppointmentPickerDate(next);
        setAppointmentTime(formatTimeText(next));
    };

    const handleTogglePinConversation = async () => {
        if (!selectChat?.id || pinLoading) return;
        const next = !conversationPinned;
        setConversationPinned(next);
        setPinLoading(true);
        try {
            if (next) await ConversationService.pin(selectChat.id);
            else await ConversationService.unpin(selectChat.id);
            const refreshed = await ConversationService.getConversationById(selectChat.id, user?.id);
            if (refreshed?.success && refreshed?.conversation) {
                setLoadConversation(refreshed.conversation);
                onPinChange?.(selectChat.id, Boolean((refreshed.conversation as any)?.pinned));
            } else {
                onPinChange?.(selectChat.id, next);
            }
        } catch (e) {
            setConversationPinned(!next);
            Alert.alert('Không thể cập nhật ghim hội thoại', 'Vui lòng thử lại.');
        } finally {
            setPinLoading(false);
        }
    };

    const loadBlockStatus = React.useCallback(async () => {
        if (!isBlockSectionVisible || !selectChat?.id || !user?.id || !peerId) return;
        try {
            const [mineRes, peerRes] = await Promise.all([
                blockSettingService.status<any>(user.id, peerId),
                blockSettingService.status<any>(peerId, user.id),
            ]);
            const mine = (mineRes as any)?.data ?? mineRes;
            const peer = (peerRes as any)?.data ?? peerRes;
            setMyMessageBlocked(Boolean(mine?.messageBlocked));
            setMyCallBlocked(Boolean(mine?.callBlocked));
            setPeerMessageBlocked(Boolean(peer?.messageBlocked));
            setPeerCallBlocked(Boolean(peer?.callBlocked));
        } catch {}
    }, [isBlockSectionVisible, selectChat?.id, user?.id, peerId]);

    const loadFriendshipStatus = React.useCallback(async () => {
        if (!peerId) {
            setFriendshipAccepted(false);
            setFriendshipId(null);
            return;
        }
        try {
            const res: any = await friendshipService.getStatus<any>(peerId);
            const payload = res?.data ?? res;
            const status = String(payload?.status || '').toUpperCase();
            setFriendshipAccepted(status === 'ACCEPTED');
            setFriendshipId(payload?.friendship?.id ?? payload?.friendship?._id ?? null);
        } catch {
            setFriendshipAccepted(false);
            setFriendshipId(null);
        }
    }, [peerId]);

    useEffect(() => {
        void loadBlockStatus();
    }, [loadBlockStatus]);

    useEffect(() => {
        void loadFriendshipStatus();
    }, [loadFriendshipStatus]);

    useEffect(() => {
        const handleRealtime = (payload: any) => {
            if (!selectChat?.id || payload?.conversationId !== selectChat.id) return;
            void loadBlockStatus();
        };
        socketService.onBlockSettingUpdated(handleRealtime);
        const handleFriendshipRealtime = () => {
            void loadFriendshipStatus();
        };
        socketService.onFriendRequest(handleFriendshipRealtime);
        socketService.onFriendRequestAccepted(handleFriendshipRealtime);
        socketService.onDeleteFriendRequest(handleFriendshipRealtime);
        return () => {
            socketService.removeBlockSettingUpdatedListener(handleRealtime);
            socketService.removeFriendRequestListener(handleFriendshipRealtime);
            socketService.removeFriendRequestAcceptedListener(handleFriendshipRealtime);
            socketService.removeFriendRequestActionListener(handleFriendshipRealtime);
        };
    }, [socketService, selectChat?.id, loadBlockStatus, loadFriendshipStatus]);

    const upsertOneDirection = async (
        blockerId: string,
        blockedId: string,
        messageBlocked: boolean,
        callBlocked: boolean
    ) => {
        if (!selectChat?.id) return;
        if (!messageBlocked && !callBlocked) {
            await blockSettingService.clear(selectChat.id, blockerId, blockedId);
            return;
        }
        await blockSettingService.upsert({
            conversationId: selectChat.id,
            blockerId,
            blockedId,
            messageBlocked,
            callBlocked,
        });
    };

    const applyBlockPreset = async (preset: 'message' | 'call' | 'all' | 'none') => {
        if (!selectChat?.id || !user?.id || !peerId || blockLoading) return;
        setBlockLoading(true);
        try {
            let messageBlocked = false;
            let callBlocked = false;
            if (preset === 'message') {
                // toggle only message block
                messageBlocked = !myMessageBlocked;
                callBlocked = myCallBlocked;
            } else if (preset === 'call') {
                // toggle only call block
                messageBlocked = myMessageBlocked;
                callBlocked = !myCallBlocked;
            } else if (preset === 'all') {
                // toggle all
                const next = !(myMessageBlocked && myCallBlocked);
                messageBlocked = next;
                callBlocked = next;
            } else {
                messageBlocked = false;
                callBlocked = false;
            }
            await upsertOneDirection(user.id, peerId, messageBlocked, callBlocked);
            await loadBlockStatus();
        } catch {
            Alert.alert('Không thể cập nhật chặn', 'Vui lòng thử lại.');
        } finally {
            setBlockLoading(false);
        }
    };

    const handleUnfriend = async () => {
        if (!friendshipId || !friendshipAccepted) return;
        try {
            await friendshipService.unfriend(friendshipId);
            setFriendshipAccepted(false);
            setFriendshipId(null);
            Alert.alert('Thành công', 'Đã xóa bạn bè');
        } catch (e: any) {
            Alert.alert('Không thể xóa bạn', e?.response?.data?.message || 'Vui lòng thử lại.');
        }
    };

    const handleToggleUserBlock = async () => {
        if (!peerId || !user?.id || !selectChat?.id || userBlockLoading) return;
        setUserBlockLoading(true);
        try {
            const next = !userBlocked;
            if (next) {
                await UserService.blockUser(peerId);
                await upsertOneDirection(user.id, peerId, true, true);
                if (applyTwoWayBlock) {
                    await upsertOneDirection(peerId, user.id, true, true);
                }
                setMyMessageBlocked(true);
                setMyCallBlocked(true);
                if (applyTwoWayBlock) {
                    setPeerMessageBlocked(true);
                    setPeerCallBlocked(true);
                }
            } else {
                await UserService.unblockUser(peerId);
                await upsertOneDirection(user.id, peerId, false, false);
                if (applyTwoWayBlock) {
                    await upsertOneDirection(peerId, user.id, false, false);
                    setPeerMessageBlocked(false);
                    setPeerCallBlocked(false);
                }
                setMyMessageBlocked(false);
                setMyCallBlocked(false);
            }
            setUserBlocked(next);
            await loadBlockStatus();
        } catch (e: any) {
            Alert.alert('Không thể cập nhật chặn người dùng', e?.response?.data?.message || 'Vui lòng thử lại.');
        } finally {
            setUserBlockLoading(false);
        }
    };

    const handleDeleteChatConfirm = async () => {
        if (!selectChat?.id || !user?.id || deleteChatLoading) return;
        setDeleteChatLoading(true);
        try {
            await MessageService.clearHistory(selectChat.id, user.id);
            setShowDeleteChatModal(false);
            onHistoryCleared?.();
        } catch (e) {
            Alert.alert('Không thể xóa đoạn chat', 'Vui lòng thử lại.');
        } finally {
            setDeleteChatLoading(false);
        }
    };

    const handleHideChatConfirm = async () => {
        if (!selectChat?.id || !user?.id || hideChatLoading) return;
        const pin = hidePin.trim();
        const confirm = hidePinConfirm.trim();
        if (!/^\d{4,6}$/.test(pin)) {
            Alert.alert('PIN không hợp lệ', 'PIN phải là 4-6 chữ số.');
            return;
        }
        if (pin !== confirm) {
            Alert.alert('PIN không khớp', 'Vui lòng nhập lại PIN xác nhận.');
            return;
        }
        setHideChatLoading(true);
        try {
            const res: any = await ConversationService.hide(selectChat.id, user.id, pin, confirm);
            if (res?.success === false) {
                Alert.alert('Không thể ẩn hội thoại', res?.message || 'Vui lòng thử lại.');
                return;
            }
            setShowHideChatModal(false);
            setHidePin('');
            setHidePinConfirm('');
            onHideChat?.(selectChat.id);
        } catch (e) {
            Alert.alert('Không thể ẩn hội thoại', 'Vui lòng thử lại.');
        } finally {
            setHideChatLoading(false);
        }
    };

    const handleUnhideChatConfirm = async () => {
        if (!selectChat?.id || !user?.id || unhideLoading) return;
        const pin = unhidePin.trim();
        if (!/^\d{4,6}$/.test(pin)) {
            Alert.alert('OTP/PIN không hợp lệ', 'PIN phải là 4-6 chữ số.');
            return;
        }
        setUnhideLoading(true);
        try {
            const res: any = await ConversationService.unhide(selectChat.id, user.id, pin);
            if (res?.success === false) {
                Alert.alert('Không thể mở ẩn hội thoại', res?.message || 'Vui lòng thử lại.');
                return;
            }
            setShowUnhideModal(false);
            setUnhidePin('');
            onUnhideChat?.(selectChat.id);
        } catch (e) {
            Alert.alert('Không thể mở ẩn hội thoại', 'Vui lòng thử lại.');
        } finally {
            setUnhideLoading(false);
        }
    };

    const divider = (
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 }} />
    );

    return (
        <>
            <View style={{
                marginHorizontal: 12,
                marginBottom: 8,
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#f3f4f6',
            }}>
                {/* Tìm kiếm */}
                <ActionRow
                    icon="search-outline"
                    label="Tìm tin nhắn, ảnh, file"
                    onPress={onSearchPress}
                />
                {divider}

                {/* Tắt thông báo — có Switch */}
                <ActionRow
                    icon={muteOn ? 'notifications-off-outline' : 'notifications-outline'}
                    label="Tắt thông báo"
                    iconColor={muteOn ? '#ef4444' : '#0068ff'}
                    danger={muteOn}
                    right={
                        <Switch
                            value={muteOn}
                            onValueChange={handleMuteToggle}
                            disabled={muteLoading}
                            thumbColor={muteOn ? '#ef4444' : '#f3f4f6'}
                            trackColor={{ false: '#d1d5db', true: '#fca5a5' }}
                            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                        />
                    }
                />
                {divider}
                <ActionRow
                    icon={conversationPinned ? "bookmark" : "bookmark-outline"}
                    label={pinLoading ? "Đang cập nhật..." : (conversationPinned ? "Bỏ ghim hội thoại" : "Ghim hội thoại")}
                    iconColor={conversationPinned ? "#d97706" : "#0068ff"}
                    onPress={() => void handleTogglePinConversation()}
                />
                {divider}

                {/* Xem profile hoặc Thêm thành viên */}
                {isGroup ? (
                    <ActionRow
                        icon="person-add-outline"
                        label="Thêm thành viên"
                        onPress={() => setAddMemberVisible(true)}
                    />
                ) : (
                    <>
                        <ActionRow
                            icon="person-circle-outline"
                            label="Xem thông tin cá nhân"
                            onPress={handleViewProfile}
                        />
                        {/* Tạo nhóm với người này: chỉ render một lần */}
                        {divider}
                        <ActionRow
                            icon="people-outline"
                            label={`Tạo nhóm với ${otherUser?.name || 'bạn bè'}`}
                            iconColor="#10B981"
                            onPress={() => {
                                if (onCreateGroupPress) {
                                    onCreateGroupPress();
                                    return;
                                }
                                setShowCreateGroupWithModal(true);
                            }}
                        />

                        {/* Chỉ hiện Thêm vào nhóm khi là bạn bè */}
                        {friendshipAccepted && (
                            <>
                                {divider}
                                <ActionRow
                                    icon="person-add-outline"
                                    label={`Thêm ${otherUser?.name || 'bạn'} vào nhóm`}
                                    iconColor="#6366F1"
                                    onPress={() => {
                                        void loadAdminGroups();
                                        setInviteSentGroupId(null);
                                        setShowInviteToGroupModal(true);
                                    }}
                                />
                            </>
                        )}
                    </>
                )}

                {/* GROUP ONLY: Admin actions */}
                {isGroup && isRealAdmin && (
                    <>
                        {divider}
                        <ActionRow
                            icon="settings-outline"
                            label="Quản lý nhóm"
                            iconColor="#3b82f6"
                            onPress={() => setGroupManagementVisible(true)}
                        />
                    </>
                )}

                {isGroup && canEditMetadata && (
                    <>
                        {divider}
                        <ActionRow
                            icon="pencil-outline"
                            label="Đổi tên nhóm"
                            iconColor="#8B5CF6"
                            onPress={() => {
                                setRenameGroupInput(selectChat?.name || '');
                                setShowRenameGroupModal(true);
                            }}
                        />
                    </>
                )}

                {/* GROUP ONLY: Admin/mod settings */}
                {isGroup && canManageGroupSettings && (
                    <>
                        {divider}
                        <ActionRow
                            icon={allowMessaging ? 'chatbubble-ellipses-outline' : 'chatbubble-outline'}
                            label="Cho phép thành viên nhắn tin"
                            iconColor={allowMessaging ? '#0068ff' : '#ef4444'}
                            right={
                                <Switch
                                    value={allowMessaging}
                                    onValueChange={() => void handleToggleAllowMessaging()}
                                    disabled={allowMessagingLoading}
                                    thumbColor={allowMessaging ? '#0068ff' : '#f3f4f6'}
                                    trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                                    style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                                />
                            }
                        />
                        {divider}
                        <ActionRow
                            icon="qr-code-outline"
                            label="Mã QR & Link mời tham gia"
                            iconColor="#6366F1"
                            onPress={() => setShowQRModal(true)}
                        />
                    </>
                )}

                {/* GROUP ONLY: Danh sách tin nhắn đã ghim */}
                {isGroup && pinnedMessages.length > 0 && (
                    <>
                        {divider}
                        <ActionRow
                            icon="bookmark-outline"
                            label={`Tin nhắn đã ghim (${pinnedMessages.length})`}
                            onPress={() => setShowPinnedMessages(!showPinnedMessages)}
                            right={
                                <Ionicons
                                    name={showPinnedMessages ? 'chevron-up' : 'chevron-down'}
                                    size={16} color="#6B7280"
                                />
                            }
                        />
                        {showPinnedMessages && pinnedMessages.map((msg, idx) => {
                            const contentPreview = msg.type === 'IMAGE' ? '[Hình ảnh]'
                                : msg.type === 'VIDEO' ? '[Video]'
                                : msg.type === 'FILE' ? '[File]'
                                : msg.type === 'AUDIO' ? '[Ghi âm]'
                                : msg.type === 'MEDIA_ALBUM' ? '[Album]'
                                : String(msg.content || '[Tin nhắn]');
                            return (
                                <View key={msg.id ?? idx} style={{
                                    paddingHorizontal: 16, paddingVertical: 10,
                                    backgroundColor: '#F0F9FF',
                                    borderLeftWidth: 3, borderLeftColor: '#3B82F6',
                                    marginHorizontal: 16, marginBottom: 6, borderRadius: 10,
                                }}>
                                    <Text numberOfLines={2} style={{ fontSize: 13, color: '#374151', fontWeight: '500' }}>
                                        {contentPreview}
                                    </Text>
                                    {isRealAdmin && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 }}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    Alert.alert('Bỏ ghim', 'Bỏ ghim tin nhắn này?', [
                                                        { text: 'Hủy', style: 'cancel' },
                                                        {
                                                            text: 'Bỏ ghim', style: 'destructive',
                                                            onPress: async () => {
                                                                await ConversationService.unpinMessage(selectChat!.id, msg.id);
                                                                await fetchConversation(selectChat!.id);
                                                            },
                                                        },
                                                    ]);
                                                }}
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                            >
                                                <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
                                                <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '600' }}>Bỏ ghim</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </>
                )}
                {/* Mobile-only: Đặt lịch hẹn — cho cả 1-1 và group */}
                {Platform.OS !== 'web' && (
                    <>
                        {divider}
                        <ActionRow
                            icon="calendar-outline"
                            label="Đặt lịch hẹn"
                            onPress={() => {
                                const now = new Date();
                                setAppointmentTitle('');
                                setAppointmentDate(formatDateText(now));
                                setAppointmentTime(formatTimeText(now));
                                setAppointmentPickerDate(now);
                                setShowAppointmentModal(true);
                            }}
                        />
                    </>
                )}
                {/* Mobile-only: Đổi biệt danh — chỉ 1-1 */}
                {Platform.OS !== 'web' && !isGroup && (
                    <>
                        {divider}
                        <ActionRow
                            icon="create-outline"
                            label="Đổi biệt danh"
                            onPress={openNicknameEditor}
                        />
                    </>
                )}
                {isBlockSectionVisible && (
                    <>
                        {divider}
                        <View style={{ backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 12 }}>
                            {friendshipAccepted && (
                                <View style={{ marginBottom: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => void handleUnfriend()}
                                        style={{
                                            height: 36,
                                            borderRadius: 10,
                                            backgroundColor: '#FEE2E2',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#991B1B' }}>Xóa bạn</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>Chặn tương tác</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 10 }}>
                                <TouchableOpacity
                                    disabled={userBlockLoading}
                                    onPress={() => void handleToggleUserBlock()}
                                    style={{
                                        paddingHorizontal: 10,
                                        height: 34,
                                        borderRadius: 10,
                                        backgroundColor: userBlocked ? '#ECFDF5' : '#FEE2E2',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: userBlocked ? '#047857' : '#991B1B' }}>
                                        {userBlockLoading ? 'Đang xử lý...' : userBlocked ? 'Mở chặn người dùng' : 'Chặn người dùng'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                <TouchableOpacity
                                    disabled={blockLoading}
                                    onPress={() => void applyBlockPreset('message')}
                                    style={{
                                        paddingHorizontal: 10,
                                        height: 34,
                                        borderRadius: 10,
                                        backgroundColor: myMessageBlocked ? '#FECACA' : '#FEF2F2',
                                        borderWidth: myMessageBlocked ? 1.5 : 0,
                                        borderColor: myMessageBlocked ? '#991B1B' : 'transparent',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#b91c1c' }}>Chặn tin nhắn</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    disabled={blockLoading}
                                    onPress={() => void applyBlockPreset('call')}
                                    style={{
                                        paddingHorizontal: 10,
                                        height: 34,
                                        borderRadius: 10,
                                        backgroundColor: myCallBlocked ? '#FECACA' : '#FEF2F2',
                                        borderWidth: myCallBlocked ? 1.5 : 0,
                                        borderColor: myCallBlocked ? '#991B1B' : 'transparent',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#b91c1c' }}>Chặn cuộc gọi</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    disabled={blockLoading}
                                    onPress={() => void applyBlockPreset('all')}
                                    style={{
                                        paddingHorizontal: 10,
                                        height: 34,
                                        borderRadius: 10,
                                        backgroundColor: (myMessageBlocked && myCallBlocked) ? '#FCA5A5' : '#FEE2E2',
                                        borderWidth: (myMessageBlocked && myCallBlocked) ? 1.5 : 0,
                                        borderColor: (myMessageBlocked && myCallBlocked) ? '#7F1D1D' : 'transparent',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#991b1b' }}>Chặn tất cả</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    disabled={blockLoading}
                                    onPress={() => void applyBlockPreset('none')}
                                    style={{ paddingHorizontal: 10, height: 34, borderRadius: 10, backgroundColor: '#ECFDF5', justifyContent: 'center' }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#047857' }}>Mở chặn tất cả</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                                Bạn: tin nhắn {myMessageBlocked ? 'đang chặn' : 'được phép'} • gọi {myCallBlocked ? 'đang chặn' : 'được phép'}
                            </Text>
                            <Text style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>
                                Đối phương: tin nhắn {peerMessageBlocked ? 'đang chặn' : 'được phép'} • gọi {peerCallBlocked ? 'đang chặn' : 'được phép'}
                            </Text>
                        </View>
                    </>
                )}
                {divider}
                <ActionRow
                    icon="trash-outline"
                    label="Xóa tin nhắn"
                    danger
                    onPress={() => setShowDeleteChatModal(true)}
                />
                {divider}
                {isHiddenSession ? (
                    <ActionRow
                        icon="lock-open-outline"
                        label="Mở ẩn hội thoại"
                        onPress={() => setShowUnhideModal(true)}
                    />
                ) : (
                    <ActionRow
                        icon="lock-closed-outline"
                        label="Ẩn hội thoại"
                        onPress={() => setShowHideChatModal(true)}
                    />
                )}
            </View>

            {addMemberVisible && (
                <AddMemberModal
                    visible={addMemberVisible}
                    onClose={() => setAddMemberVisible(false)}
                    selectChat={selectChat}
                />
            )}

            {/* ── Modal Tạo Nhóm (đồng bộ logic tab Danh bạ) ── */}
            <CreateGroup
                visible={showCreateGroupWithModal}
                onClose={() => setShowCreateGroupWithModal(false)}
                initialSelectedIds={
                    selectChat?.participantIds?.find((id) => id !== user?.id)
                        ? [String(selectChat?.participantIds?.find((id) => id !== user?.id))]
                        : []
                }
                initialGroupName={
                    otherUser?.name && user?.name
                        ? `Nhóm ${user.name}, ${otherUser.name}`
                        : ''
                }
                onCreated={() => { setShowCreateGroupWithModal(false); onActionCompleted?.(); }}
            />

            {/* ── Modal QR Code Nhóm ── */}
            {isGroup && selectChat?.id && (
                <GroupQRModal
                    visible={showQRModal}
                    onClose={() => setShowQRModal(false)}
                    conversationId={selectChat.id}
                    groupName={selectChat.name ?? 'Nhóm'}
                    isAdmin={canManageGroupSettings}
                    requireApproval={requireApproval}
                    onRequireApprovalToggled={(val) => setRequireApproval(val)}
                />
            )}

            {isGroup && (
                <GroupManagementModal
                    visible={groupManagementVisible}
                    onClose={() => setGroupManagementVisible(false)}
                    selectChat={selectChat}
                />
            )}

            <Modal
                transparent
                animationType="fade"
                visible={showDeleteChatModal}
                onRequestClose={() => setShowDeleteChatModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
                    <View style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                                Xóa đoạn chat
                            </Text>
                            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                                Xóa lịch sử tin nhắn phía bạn (tin cũ hơn mốc xóa sẽ không còn hiển thị). Cuộc trò chuyện vẫn nằm trong danh sách — khác với Ẩn hội thoại (PIN). Tiếp tục?
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', padding: 14, gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowDeleteChatModal(false)}
                                style={{
                                    flex: 1,
                                    height: 46,
                                    borderRadius: 12,
                                    backgroundColor: '#f3f4f6',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ color: '#111827', fontWeight: '600' }}>Không</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={deleteChatLoading}
                                onPress={handleDeleteChatConfirm}
                                style={{
                                    flex: 1,
                                    height: 46,
                                    borderRadius: 12,
                                    backgroundColor: '#ef4444',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: deleteChatLoading ? 0.6 : 1,
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {deleteChatLoading ? 'Đang xóa...' : 'Xóa'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={showHideChatModal}
                onRequestClose={() => setShowHideChatModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
                    <View style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                                Ẩn hội thoại bằng PIN
                            </Text>
                            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                                Nhập PIN để ẩn hội thoại này. Bạn sẽ cần PIN để mở lại khi tìm kiếm.
                            </Text>
                        </View>
                        <View style={{ padding: 14, gap: 10 }}>
                            <TextInput
                                value={hidePin}
                                onChangeText={setHidePin}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={6}
                                placeholder="Nhập PIN (4-6 số)"
                                placeholderTextColor="#9ca3af"
                                style={{
                                    height: 46,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                    paddingHorizontal: 12,
                                    color: '#111827',
                                }}
                            />
                            <TextInput
                                value={hidePinConfirm}
                                onChangeText={setHidePinConfirm}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={6}
                                placeholder="Xác nhận PIN"
                                placeholderTextColor="#9ca3af"
                                style={{
                                    height: 46,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                    paddingHorizontal: 12,
                                    color: '#111827',
                                }}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', padding: 14, paddingTop: 0, gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowHideChatModal(false)}
                                style={{
                                    flex: 1,
                                    height: 46,
                                    borderRadius: 12,
                                    backgroundColor: '#f3f4f6',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ color: '#111827', fontWeight: '600' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={hideChatLoading}
                                onPress={handleHideChatConfirm}
                                style={{
                                    flex: 1,
                                    height: 46,
                                    borderRadius: 12,
                                    backgroundColor: '#2563eb',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: hideChatLoading ? 0.6 : 1,
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {hideChatLoading ? 'Đang ẩn...' : 'Ẩn hội thoại'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={showUnhideModal}
                onRequestClose={() => setShowUnhideModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
                    <View style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                                Mở ẩn hội thoại
                            </Text>
                            <Text style={{ fontSize: 14, color: '#4b5563', lineHeight: 20 }}>
                                Nhập OTP/PIN để đưa hội thoại này trở lại danh sách conversation.
                            </Text>
                        </View>
                        <View style={{ padding: 14, gap: 10 }}>
                            <TextInput
                                value={unhidePin}
                                onChangeText={setUnhidePin}
                                keyboardType="number-pad"
                                secureTextEntry
                                maxLength={6}
                                placeholder="Nhập OTP/PIN"
                                placeholderTextColor="#9ca3af"
                                style={{
                                    height: 46,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                    paddingHorizontal: 12,
                                    color: '#111827',
                                }}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', padding: 14, paddingTop: 0, gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowUnhideModal(false)}
                                style={{
                                    flex: 1,
                                    height: 46,
                                    borderRadius: 12,
                                    backgroundColor: '#f3f4f6',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text style={{ color: '#111827', fontWeight: '600' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={unhideLoading}
                                onPress={handleUnhideChatConfirm}
                                style={{
                                    flex: 1,
                                    height: 46,
                                    borderRadius: 12,
                                    backgroundColor: '#2563eb',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: unhideLoading ? 0.6 : 1,
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {unhideLoading ? 'Đang mở...' : 'Mở ẩn'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={showNicknameModal}
                onRequestClose={() => setShowNicknameModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
                    <View style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                                Đổi biệt danh
                            </Text>
                            <Text style={{ fontSize: 14, color: '#4b5563' }}>
                                Nhập biệt danh mới cho cuộc trò chuyện này.
                            </Text>
                        </View>
                        <View style={{ padding: 14 }}>
                            <TextInput
                                value={nicknameInput}
                                onChangeText={setNicknameInput}
                                placeholder="Nhập biệt danh"
                                placeholderTextColor="#9ca3af"
                                style={{
                                    height: 46,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#e5e7eb',
                                    paddingHorizontal: 12,
                                    color: '#111827',
                                }}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', padding: 14, paddingTop: 0, gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowNicknameModal(false)}
                                style={{
                                    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#f3f4f6',
                                    alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <Text style={{ color: '#111827', fontWeight: '600' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={nicknameSaving}
                                onPress={() => void submitNicknameFromInfo()}
                                style={{
                                    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#6d28d9',
                                    alignItems: 'center', justifyContent: 'center', opacity: nicknameSaving ? 0.6 : 1,
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {nicknameSaving ? 'Đang lưu...' : 'Lưu'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={showAppointmentModal}
                onRequestClose={() => setShowAppointmentModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
                    <View style={{ width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 16, overflow: 'hidden' }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
                                Tạo lịch hẹn
                            </Text>
                            <Text style={{ fontSize: 14, color: '#4b5563' }}>
                                Nhập tiêu đề, ngày (dd/mm/yyyy) và giờ (HH:mm).
                            </Text>
                        </View>
                        <View style={{ padding: 14, gap: 10 }}>
                            <TextInput
                                value={appointmentTitle}
                                onChangeText={setAppointmentTitle}
                                placeholder="Tiêu đề lịch hẹn"
                                placeholderTextColor="#9ca3af"
                                style={{
                                    height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
                                    paddingHorizontal: 12, color: '#111827',
                                }}
                            />
                            <TextInput
                                value={appointmentDate}
                                onChangeText={setAppointmentDate}
                                placeholder="dd/mm/yyyy"
                                placeholderTextColor="#9ca3af"
                                editable={Platform.OS === 'web'}
                                style={{
                                    height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
                                    paddingHorizontal: 12, color: '#111827',
                                }}
                            />
                            {Platform.OS !== 'web' && (
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    style={{
                                        marginTop: -4,
                                        height: 40,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: '#ddd6fe',
                                        backgroundColor: '#f5f3ff',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#5b21b6', fontWeight: '600' }}>Chọn ngày</Text>
                                </TouchableOpacity>
                            )}
                            <TextInput
                                value={appointmentTime}
                                onChangeText={setAppointmentTime}
                                placeholder="HH:mm"
                                placeholderTextColor="#9ca3af"
                                editable={Platform.OS === 'web'}
                                style={{
                                    height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
                                    paddingHorizontal: 12, color: '#111827',
                                }}
                            />
                            {Platform.OS !== 'web' && (
                                <TouchableOpacity
                                    onPress={() => setShowTimePicker(true)}
                                    style={{
                                        marginTop: -4,
                                        height: 40,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        borderColor: '#ddd6fe',
                                        backgroundColor: '#f5f3ff',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#5b21b6', fontWeight: '600' }}>Chọn giờ</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', padding: 14, paddingTop: 0, gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowAppointmentModal(false)}
                                style={{
                                    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#f3f4f6',
                                    alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <Text style={{ color: '#111827', fontWeight: '600' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={appointmentSaving}
                                onPress={() => void submitAppointmentFromInfo()}
                                style={{
                                    flex: 1, height: 46, borderRadius: 12, backgroundColor: '#6d28d9',
                                    alignItems: 'center', justifyContent: 'center', opacity: appointmentSaving ? 0.6 : 1,
                                }}
                            >
                                <Text style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {appointmentSaving ? 'Đang tạo...' : 'Tạo lịch'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {Platform.OS !== 'web' && showDatePicker && (
                <DateTimePicker
                    value={appointmentPickerDate}
                    mode="date"
                    display="default"
                    onChange={handleDatePicked}
                    minimumDate={new Date()}
                />
            )}
            {Platform.OS !== 'web' && showTimePicker && (
                <DateTimePicker
                    value={appointmentPickerDate}
                    mode="time"
                    display="default"
                    onChange={handleTimePicked}
                />
            )}

            {/* ── Modal Đổi Tên Nhóm ── */}
            <Modal visible={showRenameGroupModal} transparent animationType="fade" onRequestClose={() => setShowRenameGroupModal(false)}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowRenameGroupModal(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }}
                >
                    <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{
                        width: '88%', backgroundColor: '#fff', borderRadius: 20,
                        padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
                    }}>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 4 }}>Đổi tên nhóm</Text>
                        <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>Nhập tên mới cho nhóm</Text>
                        <TextInput
                            value={renameGroupInput}
                            onChangeText={setRenameGroupInput}
                            placeholder="Tên nhóm..."
                            placeholderTextColor="#9CA3AF"
                            maxLength={60}
                            style={{
                                borderWidth: 1.5, borderColor: '#8B5CF6', borderRadius: 12,
                                padding: 12, fontSize: 15, color: '#111827',
                                backgroundColor: '#faf5ff', marginBottom: 16,
                            }}
                        />
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setShowRenameGroupModal(false)}
                                style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Text style={{ color: '#374151', fontWeight: '600' }}>Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={renameGroupLoading}
                                onPress={() => void handleRenameGroup()}
                                style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center', opacity: renameGroupLoading ? 0.6 : 1 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: '700' }}>
                                    {renameGroupLoading ? 'Đang lưu...' : 'Lưu'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* ── Modal Chọn Nhóm Để Invite ── */}
            <Modal visible={showInviteToGroupModal} transparent animationType="fade" onRequestClose={() => setShowInviteToGroupModal(false)}>
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowInviteToGroupModal(false)}
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                >
                    <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{
                        width: '90%', maxHeight: '75%', backgroundColor: '#fff', borderRadius: 20,
                        overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 10,
                    }}>
                        {/* Header */}
                        <View style={{ padding: 18, borderBottomWidth: 1, borderColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={{ fontSize: 17, fontWeight: '700', color: '#1e293b' }}>Thêm vào nhóm</Text>
                                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Chọn nhóm bạn là thành viên</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowInviteToGroupModal(false)}
                                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="close" size={18} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 380 }}>
                            {myAdminGroups.length === 0 ? (
                                <View style={{ padding: 32, alignItems: 'center' }}>
                                    <Ionicons name="people-outline" size={48} color="#d1d5db" />
                                    <Text style={{ color: '#9CA3AF', marginTop: 12, textAlign: 'center' }}>
                                        Bạn chưa quản trị nhóm nào{'\n'}hoặc bạn bè đã vào hết rồi.
                                    </Text>
                                </View>
                            ) : (
                                myAdminGroups.map(group => {
                                    const sent = inviteSentGroupId === group.id;
                                    return (
                                        <TouchableOpacity
                                            key={group.id}
                                            disabled={sent || inviteLoading}
                                            onPress={() => void handleSendGroupInvite(group.id)}
                                            style={{
                                                flexDirection: 'row', alignItems: 'center',
                                                paddingHorizontal: 16, paddingVertical: 12,
                                                borderBottomWidth: 1, borderColor: '#f9fafb',
                                                opacity: sent ? 0.6 : 1,
                                            }}
                                        >
                                            <View style={{
                                                width: 46, height: 46, borderRadius: 14,
                                                backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                            }}>
                                                {group.avatarUrl
                                                    ? <Image source={{ uri: group.avatarUrl }} style={{ width: 46, height: 46, borderRadius: 14 }} />
                                                    : <Ionicons name="people" size={22} color="#6366F1" />
                                                }
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 15, fontWeight: '600', color: '#1e293b' }} numberOfLines={1}>{group.name || 'Nhóm'}</Text>
                                                <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                                                    {group.participantIds?.length ?? 0} thành viên
                                                </Text>
                                            </View>
                                            {sent
                                                ? <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                                    <Text style={{ fontSize: 12, color: '#059669', fontWeight: '600' }}>Đã mời</Text>
                                                </View>
                                                : <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                                    <Text style={{ fontSize: 12, color: '#6366F1', fontWeight: '600' }}>Mời</Text>
                                                </View>
                                            }
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
            <Toast
                visible={inviteSentToast.visible}
                message={inviteSentToast.message}
                type="success"
                onHide={() => setInviteSentToast((t) => ({ ...t, visible: false }))}
            />
        </>
    );
};

const ActionsInfo = React.forwardRef(ActionsInfoRender);

export default ActionsInfo;