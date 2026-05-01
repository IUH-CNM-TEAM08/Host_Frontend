import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Conversation, ParticipantInfo, Settings } from '@/src/models/Conversation';
import Search from './Search';
import HeaderInfo from '../info/HeaderInfo';
import ProfileInfo from '../info/ProfileInfo';
import ActionsInfo, { ActionsInfoHandle } from '../info/ActionsInfo';
import MediaInfo from '../info/MediaInfo';
import FilesInfo from '../info/FilesInfo';
import { Ionicons } from '@expo/vector-icons';
import GroupInfo from '../info/GroupInfo';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import { userService as UserService } from '@/src/api/services/user.service';
import { messageService as MessageService } from '@/src/api/services/message.service';
import { useUser } from '@/src/contexts/user/UserContext';
import { MessageType } from '@/src/models/Message';
import { User } from '@/src/models/User';
import { normalizeMessageType } from '@/src/models/mappers';
import SocketService from '@/src/api/socketCompat';
import * as ImagePicker from 'expo-image-picker';
import { uploadLocalGroupAvatar } from '@/src/utils/groupAvatarUpload';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';

export interface InfoProps {
    selectedChat: Conversation | null;
    onBackPress?: () => void;
    onMuteChange?: (conversationId: string, muted: boolean) => void;
    onDeleteChat?: (conversationId: string) => void;
    /** Sau khi chỉ xóa lịch sử tin (không gỡ hội thoại khỏi list) */
    onHistoryCleared?: () => void;
    onHideChat?: (conversationId: string) => void;
    onUnhideChat?: (conversationId: string) => void;
    onPinChange?: (conversationId: string, pinned: boolean) => void;
    onActionCompleted?: () => void;
    /** Đồng bộ conversation (danh sách + header) mà không đóng panel thông tin */
    onConversationMetaChanged?: () => void;
}

function formatSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string | Date): string {
    if (!dateStr) return '';
    const d = new Date(dateStr as string);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function getExt(name: string): string {
    return (name.split('.').pop() ?? '').toLowerCase();
}

function normalizeRole(role?: string): 'member' | 'admin' | 'mod' | 'owner' | 'moderator' {
    const r = String(role || 'member').toUpperCase();
    if (r === 'OWNER') return 'owner';
    if (r === 'ADMIN') return 'admin';
    if (r === 'MODERATOR' || r === 'MOD') return 'moderator';
    return 'member';
}

function roleLabelKey(role?: string): string {
    const r = String(role || '').toUpperCase();
    if (r === 'OWNER') return 'info.roleOwner';
    if (r === 'ADMIN') return 'info.roleAdmin';
    if (r === 'MODERATOR' || r === 'MOD') return 'info.roleModerator';
    return 'info.roleMember';
}

/** Gộp participant từ server với bản đã có — tránh mất tên/avatar khi API chỉ trả role + id */
function mergeParticipantInfo(prevList: ParticipantInfo[] | undefined, incoming: ParticipantInfo[]): ParticipantInfo[] {
    return incoming.map((p) => {
        const old = prevList?.find((x) => String(x.id) === String(p.id));
        const nameOk = p.name && String(p.name).trim().length > 0;
        return {
            ...p,
            id: String(p.id),
            name: nameOk ? p.name : old?.name || p.name || 'User',
            avatar: p.avatar || old?.avatar || '',
            nickname: p.nickname ?? old?.nickname,
            role: p.role ?? old?.role ?? 'member',
        };
    });
}

export default function Info({
    selectedChat,
    onBackPress,
    onMuteChange,
    onDeleteChat,
    onHistoryCleared,
    onHideChat,
    onUnhideChat,
    onPinChange,
    onActionCompleted,
    onConversationMetaChanged,
}: InfoProps) {
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [groupAvatarUploading, setGroupAvatarUploading] = useState(false);
    const [loadConversation, setLoadConversation] = useState<Conversation | null>(selectedChat);
    const { user } = useUser();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const topPad = Platform.OS !== 'web' ? insets.top : 0;

    // ── Người kia (1-on-1): tên thật + avatar thật ──────────────────
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    // ── Media & Files từ tin nhắn ────────────────────────────────────
    const [mediaItems, setMediaItems] = useState<Array<{ messageId: string; url: string }>>([]);
    const [sharedFiles, setSharedFiles] = useState<{messageId?: string; name:string;size:string;type:string;date:string;url?:string}[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [viewAllMode, setViewAllMode] = useState<'media' | 'files' | null>(null);
    const [ownerLeaveModalVisible, setOwnerLeaveModalVisible] = useState(false);
    const [ownerLeaveTargetUserId, setOwnerLeaveTargetUserId] = useState('');
    const [ownerLeaveSubmitting, setOwnerLeaveSubmitting] = useState(false);
    const socketService = SocketService.getInstance();
    const actionsInfoRef = useRef<ActionsInfoHandle | null>(null);

    const mediaUrls = useMemo(() => mediaItems.map((item) => item.url), [mediaItems]);

    // ── Fetch người kia (1-on-1) ─────────────────────────────────────
    useEffect(() => {
        if (!selectedChat || selectedChat.isGroup || !user?.id) {
            setOtherUser(null);
            return;
        }
        const ids = loadConversation?.participantIds?.length
            ? loadConversation.participantIds
            : selectedChat.participantIds;
        const otherId = ids.find((id) => id !== user.id);
        if (!otherId) return;

        setLoadingProfile(true);
        UserService.getUserById(otherId).then((res) => {
            if (res.success && res.user) setOtherUser(res.user);
        }).finally(() => setLoadingProfile(false));
    }, [selectedChat?.id, loadConversation?.participantIds, user?.id]);

    // ── Load conversation khi đổi chat ──────────────────────────────
    useEffect(() => {
        if (!selectedChat?.id) {
            setLoadConversation(null);
            return;
        }
        let cancelled = false;
        const loadConversationDetail = async () => {
            try {
                const detail = await ConversationService.getConversationById(selectedChat.id, user?.id);
                const base = detail?.success && detail?.conversation ? detail.conversation : selectedChat;
                const participantIds = Array.from(
                    new Set(
                        (base.participantIds?.length ? base.participantIds : selectedChat.participantIds) || []
                    )
                );
                const userRows = await Promise.all(
                    participantIds.map(async (id) => {
                        try {
                            const r = await UserService.getUserById(id);
                            return r.success && r.user ? [id, r.user] as const : null;
                        } catch {
                            return null;
                        }
                    })
                );
                const userMap = new Map(userRows.filter(Boolean) as ReadonlyArray<readonly [string, User]>);
                const enrichedParticipantInfo = participantIds.map((id) => {
                    const current = base.participantInfo?.find((p) => String(p.id) === String(id))
                        || selectedChat.participantInfo?.find((p) => String(p.id) === String(id));
                    const profile = userMap.get(id);
                    return {
                        id,
                        name: current?.name || profile?.name || t('chatArea.defaultUser'),
                        avatar: current?.avatar || profile?.avatarURL || profile?.avatarUrl || '',
                        nickname: current?.nickname,
                        role: normalizeRole(current?.role),
                    };
                });
                if (!cancelled) {
                    setLoadConversation({
                        ...selectedChat,
                        ...base,
                        participantIds,
                        participantInfo: enrichedParticipantInfo,
                    });
                }
            } catch {
                if (!cancelled) setLoadConversation(selectedChat);
            }
        };
        loadConversationDetail();
        return () => { cancelled = true; };
    }, [selectedChat?.id, user?.id]);

    // Đồng bộ selectedChat (ví dụ sau chuyển quyền / socket) nhưng KHÔNG ghi đè bằng payload thiếu tên
    useEffect(() => {
        if (!selectedChat) {
            setLoadConversation(null);
            return;
        }
        setLoadConversation((prev) => {
            if (!prev || prev.id !== selectedChat.id) {
                return selectedChat;
            }
            const incoming = selectedChat.participantInfo ?? [];
            if (incoming.length === 0) {
                return { ...prev, ...selectedChat, participantInfo: prev.participantInfo };
            }
            return {
                ...prev,
                ...selectedChat,
                participantIds: selectedChat.participantIds?.length
                    ? selectedChat.participantIds
                    : prev.participantIds,
                participantInfo: mergeParticipantInfo(prev.participantInfo, incoming),
            };
        });
    }, [selectedChat]);

    // Mobile mở Info thì ChatArea đã unmount (và rời room). Join lại để vẫn nhận event realtime của nhóm.
    useEffect(() => {
        if (Platform.OS === 'web') return;
        if (!selectedChat?.id) return;
        socketService.joinConversation(selectedChat.id);
        return () => {
            socketService.leaveConversation(selectedChat.id);
        };
    }, [selectedChat?.id, socketService]);

    // Đồng bộ role/settings participant realtime khi web cập nhật quyền (transfer admin, grant/revoke mod...).
    useEffect(() => {
        if (!selectedChat?.id || !selectedChat.isGroup) return;
        let active = true;
        const conversationId = String(selectedChat.id);
        const socket = SocketService.getInstance();

        const syncConversationMeta = async () => {
            try {
                const detail = await ConversationService.getConversationById(conversationId, user?.id);
                if (!active || !detail?.success || !detail?.conversation) return;
                const incoming = detail.conversation;
                setLoadConversation((prev) => {
                    if (!prev || String(prev.id) !== conversationId) return prev;
                    const incomingInfo = Array.isArray(incoming.participantInfo)
                        ? incoming.participantInfo
                        : [];
                    const mergedSettings: Settings | undefined =
                        prev.settings || incoming.settings
                            ? {
                                  ...(prev.settings as Settings | undefined),
                                  ...(incoming.settings as Partial<Settings> | undefined),
                              } as Settings
                            : undefined;
                    return {
                        ...prev,
                        ...incoming,
                        participantIds: incoming.participantIds?.length
                            ? incoming.participantIds
                            : prev.participantIds,
                        participantInfo:
                            incomingInfo.length > 0
                                ? mergeParticipantInfo(prev.participantInfo, incomingInfo)
                                : prev.participantInfo,
                        settings: mergedSettings,
                    };
                });
            } catch {
                // noop
            }
        };

        const handleConversationMetaChanged = (payload: any) => {
            if (String(payload?.conversationId ?? '') !== conversationId) return;
            void syncConversationMeta();
        };

        socket.onAdminTransferred(handleConversationMetaChanged);
        socket.onModGranted(handleConversationMetaChanged);
        socket.onModRevoked(handleConversationMetaChanged);
        socket.onParticipantsAddedServer(handleConversationMetaChanged);
        socket.onParticipantsRemoved(handleConversationMetaChanged);
        socket.onGroupSettingsUpdated(handleConversationMetaChanged);

        return () => {
            active = false;
            socket.removeAdminTransferredListener(handleConversationMetaChanged);
            socket.removeModGrantedListener(handleConversationMetaChanged);
            socket.removeModRevokedListener(handleConversationMetaChanged);
            socket.removeParticipantsAddedServer(handleConversationMetaChanged);
            socket.removeParticipantsRemovedListener(handleConversationMetaChanged);
            socket.removeGroupSettingsUpdatedListener(handleConversationMetaChanged);
        };
    }, [selectedChat?.id, selectedChat?.isGroup, user?.id]);

    // ── Fetch media & file ───────────────────────────────────────────
    const fetchSharedMedia = useCallback(async (conversationId: string) => {
        setLoadingMedia(true);
        try {
            const res = await MessageService.getMessages(conversationId, 0, 200);
            if (!res.success) return;

            const imgs: Array<{ messageId: string; url: string }> = [];
            const files: Array<{ messageId: string; name: string; size: string; type: string; date: string; url?: string }> = [];

            for (const m of res.messages) {
                if (m?.isDeletedForEveryone) continue;
                const messageId = String(m.id ?? m._id ?? '');
                if (!messageId) continue;
                const mt = normalizeMessageType(m.type);
                if (mt === MessageType.IMAGE || mt === MessageType.VIDEO) {
                    const meta = m.metadata as any;
                    const url = meta?.cdnUrl ?? meta?.url ?? meta?.imageUrl;
                    if (url) imgs.push({ messageId, url });
                }
                if (mt === MessageType.MEDIA_ALBUM && Array.isArray(m.mediaItems)) {
                    for (const item of m.mediaItems) {
                        const url = item?.cdnUrl || (item as any)?.url;
                        if (url) imgs.push({ messageId, url });
                    }
                }
                if (mt === MessageType.FILE) {
                    const meta = m.metadata as any;
                    const fileName = meta?.fileName ?? m.content ?? 'file';
                    files.push({
                        messageId,
                        name: fileName,
                        size: formatSize(meta?.fileSize),
                        type: getExt(fileName),
                        date: formatDate(m.sentAt as string),
                        url: meta?.cdnUrl,
                    });
                }
            }
            setMediaItems(imgs.reverse());
            setSharedFiles(files.reverse());
        } catch (e) {
            console.error('fetchSharedMedia error:', e);
        } finally {
            setLoadingMedia(false);
        }
    }, []);

    useEffect(() => {
        if (selectedChat) {
            setMediaItems([]);
            setSharedFiles([]);
            fetchSharedMedia(selectedChat.id);
        }
    }, [selectedChat?.id]);


    const isAdmin = React.useMemo(() => {
        if (!loadConversation || !user) return false;
        const role = loadConversation.participantInfo?.find(p => p.id === user.id)?.role;
        return role === 'admin' || role === 'owner';
    }, [loadConversation, user]);

    /** Giải tán nhóm — backend chỉ cho OWNER */
    const isGroupOwner = React.useMemo(() => {
        if (!loadConversation || !user) return false;
        const role = String(
            loadConversation.participantInfo?.find((p) => p.id === user.id)?.role ?? '',
        ).toUpperCase();
        return role === 'OWNER';
    }, [loadConversation, user]);

    /** Trùng logic backend updateGroup: admin/mod/owner hoặc khi cài đặt cho phép thành viên sửa metadata */
    const canEditGroupAvatar = React.useMemo(() => {
        if (!loadConversation || !user?.id) return false;
        const role = String(
            loadConversation.participantInfo?.find((p) => p.id === user.id)?.role ?? '',
        ).toUpperCase();
        const isElevated = ['OWNER', 'ADMIN', 'MODERATOR', 'MOD'].includes(role);
        const allowMember = loadConversation.settings?.isAllowMemberChangeMetadata ?? true;
        return isElevated || allowMember;
    }, [loadConversation, user?.id]);

    const ownerTransferCandidates = useMemo(() => {
        if (!loadConversation?.participantInfo?.length || !user?.id) return [] as ParticipantInfo[];
        return loadConversation.participantInfo.filter((p) => String(p.id) !== String(user.id));
    }, [loadConversation?.participantInfo, user?.id]);

    useEffect(() => {
        if (!ownerLeaveModalVisible) return;
        if (ownerTransferCandidates.length === 0) {
            setOwnerLeaveTargetUserId('');
            return;
        }
        const selectedStillExists = ownerTransferCandidates.some(
            (candidate) => String(candidate.id) === String(ownerLeaveTargetUserId),
        );
        if (!selectedStillExists) {
            setOwnerLeaveTargetUserId(String(ownerTransferCandidates[0].id));
        }
    }, [ownerLeaveModalVisible, ownerTransferCandidates, ownerLeaveTargetUserId]);

    const performLeaveGroup = useCallback(
        async (conversationId: string) => {
            try {
                const res = await ConversationService.leaveGroup(conversationId);
                if (res.success) {
                    onDeleteChat?.(conversationId);
                    onBackPress?.();
                    return { success: true, message: '' };
                }
                return { success: false, message: res.message || t('info.cannotLeaveGroup') };
            } catch (error) {
                console.error('Error leaving group:', error);
                return { success: false, message: t('info.cannotLeaveGroupRetry') };
            }
        },
        [onDeleteChat, onBackPress, t],
    );

    const handleOwnerLeavePress = useCallback(() => {
        if (!selectedChat?.id) return;
        if (ownerTransferCandidates.length === 0) {
            const msg = t('info.noMembersToTransfer');
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert(t('info.leaveGroup'), msg);
            }
            return;
        }
        setOwnerLeaveTargetUserId((prev) => {
            const existed = ownerTransferCandidates.some((candidate) => String(candidate.id) === String(prev));
            if (existed) return prev;
            return String(ownerTransferCandidates[0].id);
        });
        setOwnerLeaveModalVisible(true);
    }, [selectedChat?.id, ownerTransferCandidates, t]);

    const handleTransferAndLeave = useCallback(async () => {
        if (!selectedChat?.id || !ownerLeaveTargetUserId || ownerLeaveSubmitting) return;
        setOwnerLeaveSubmitting(true);
        try {
            const transferRes = await ConversationService.transferAdmin(selectedChat.id, ownerLeaveTargetUserId);
            if (!transferRes.success) {
                const msg = transferRes.message || t('info.cannotTransferOwner');
                if (Platform.OS === 'web') {
                    window.alert(msg);
                } else {
                    Alert.alert(t('common.error'), msg);
                }
                return;
            }

            const leaveRes = await performLeaveGroup(selectedChat.id);
            if (!leaveRes.success) {
                const msg = leaveRes.message || t('info.cannotLeaveGroup');
                if (Platform.OS === 'web') {
                    window.alert(`${t('info.transferredButNotLeft')}: ${msg}`);
                } else {
                    Alert.alert(t('common.error'), `${t('info.transferredButNotLeft')}: ${msg}`);
                }
                return;
            }

            setOwnerLeaveModalVisible(false);
        } finally {
            setOwnerLeaveSubmitting(false);
        }
    }, [selectedChat?.id, ownerLeaveTargetUserId, ownerLeaveSubmitting, performLeaveGroup, t]);

    const ownerLeaveActionDisabled = !ownerLeaveTargetUserId || ownerLeaveSubmitting;

    const handleGroupAvatarPress = useCallback(async () => {
        if (!selectedChat?.isGroup || !selectedChat.id || !canEditGroupAvatar) return;

        let localUri: string | null = null;

        if (Platform.OS === 'web') {
            localUri = await new Promise<string | null>((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: Event) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(file);
                };
                input.click();
            });
        } else {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert(t('info.permissionRequired'), t('contacts.galleryPermissionRequired'));
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'] as any,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9,
            });
            if (result.canceled) return;
            localUri = result.assets[0]?.uri ?? null;
        }

        if (!localUri) return;

        setGroupAvatarUploading(true);
        try {
            const url = await uploadLocalGroupAvatar(localUri);
            await ConversationService.updateGroup(selectedChat.id, { avatarUrl: url });
            setLoadConversation((prev) =>
                prev && prev.id === selectedChat.id ? { ...prev, avatarUrl: url } : prev,
            );
            onConversationMetaChanged?.();
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.message || t('info.cannotUpdateGroupAvatar'));
        } finally {
            setGroupAvatarUploading(false);
        }
    }, [selectedChat?.isGroup, selectedChat?.id, canEditGroupAvatar, onConversationMetaChanged, t]);

    const handleDisbandGroup = async () => {
        if (!selectedChat?.id) return;

        const runDisband = async () => {
            const res = await ConversationService.disbandGroup(selectedChat.id);
            if (!res.success) {
                const msg = res.message || t('info.cannotDisbandGroup');
                if (Platform.OS === 'web') {
                    window.alert(msg);
                } else {
                    Alert.alert(t('common.error'), msg);
                }
                return;
            }
            onDeleteChat?.(selectedChat.id);
        };

        try {
            // RN Web: Alert.alert nhiều nút thường không hoạt động — dùng confirm giống GroupInfo
            if (Platform.OS === 'web') {
                const ok = window.confirm(
                    t('info.disbandConfirmMessage'),
                );
                if (!ok) return;
                await runDisband();
                return;
            }

            Alert.alert(
                t('info.disbandGroup'),
                t('info.disbandConfirmMessage'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('info.disbandGroup'),
                        style: 'destructive',
                        onPress: () => {
                            void runDisband();
                        },
                    },
                ],
            );
        } catch (error: any) {
            console.error('Error disbanding group:', error);
            const msg = error?.message || t('info.cannotDisbandGroupRetry');
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert(t('common.error'), msg);
            }
        }
    };

    const handleLeaveGroup = () => {
        if (!selectedChat?.id) return;

        const runLeave = async () => {
            const cid = selectedChat!.id;
            const res = await performLeaveGroup(cid);
            if (!res.success) {
                if (Platform.OS === 'web') {
                    window.alert(res.message || t('info.cannotLeaveGroup'));
                } else {
                    Alert.alert(t('common.error'), res.message || t('info.cannotLeaveGroup'));
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(t('info.leaveGroupConfirmMessage'))) void runLeave();
            return;
        }

        Alert.alert(t('info.leaveGroup'), t('info.leaveGroupConfirmMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('info.leaveGroup'),
                style: 'destructive',
                onPress: () => void runLeave(),
            },
        ]);
    };

    // Lắng nghe socket: nhóm bị giải tán hoặc mình bị kick
    useEffect(() => {
        if (!selectedChat?.id || !selectedChat?.isGroup) return;
        const socket = SocketService.getInstance();

        const handleDeleted = (data: { conversationId: string }) => {
            if (data.conversationId === selectedChat.id) {
                onDeleteChat?.(selectedChat.id);
            }
        };
        const handleMemberOut = (data: { userId: string; groupId: string }) => {
            if (data.groupId === selectedChat.id && data.userId === user?.id) {
                onDeleteChat?.(selectedChat.id);
            }
        };
        socket.onConversationDeleted(handleDeleted);
        socket.onMemberOut(handleMemberOut);
        return () => {
            socket.removeConversationDeletedListener(handleDeleted);
            socket.removeMemberOutListener(handleMemberOut);
        };
    }, [selectedChat?.id, selectedChat?.isGroup, user?.id]);

    useEffect(() => {
        if (!selectedChat?.id) return;
        const socket = SocketService.getInstance();

        const handleNewMessage = (raw: any) => {
            const msg = raw?.message && typeof raw.message === 'object' ? raw.message : raw;
            if (String(msg?.conversationId) !== String(selectedChat.id)) return;
            const messageId = String(msg?.id ?? msg?._id ?? msg?.messageId ?? '');
            const metadata = msg?.metadata ?? {};
            const t = normalizeMessageType(msg?.type);

            if (t === MessageType.IMAGE || t === MessageType.VIDEO) {
                const url = metadata?.cdnUrl ?? metadata?.url ?? metadata?.imageUrl;
                if (url) {
                    setMediaItems((prev) => {
                        if (prev.some((item) => item.url === url && item.messageId === messageId)) return prev;
                        return [{ messageId, url }, ...prev];
                    });
                }
            }
            if (t === MessageType.MEDIA_ALBUM && Array.isArray(msg?.mediaItems)) {
                setMediaItems((prev) => {
                    const next = [...prev];
                    for (const item of msg.mediaItems) {
                        const url = item?.cdnUrl || item?.url;
                        if (url && !next.some((media) => media.url === url && media.messageId === messageId)) {
                            next.unshift({ messageId, url });
                        }
                    }
                    return next;
                });
            }
            if (t === MessageType.FILE) {
                const fileName = metadata?.fileName ?? msg?.content ?? 'file';
                const url = metadata?.cdnUrl ?? metadata?.url;
                setSharedFiles((prev) => {
                    if (prev.some((item) => item.messageId === messageId)) return prev;
                    return [{
                        messageId,
                        name: fileName,
                        size: formatSize(metadata?.fileSize),
                        type: getExt(fileName),
                        date: formatDate(msg?.sentAt),
                        url,
                    }, ...prev];
                });
            }
        };

        const handleDeletedForEveryone = (payload: any) => {
            const conversationId = String(payload?.conversationId ?? payload?.message?.conversationId ?? '');
            const messageId = String(payload?.messageId ?? payload?.id ?? payload?._id ?? payload?.message?._id ?? payload?.message?.id ?? '');
            if (!messageId) return;
            if (conversationId && conversationId !== String(selectedChat.id)) return;
            setSharedFiles((prev) => prev.filter((item) => item.messageId !== messageId));
            setMediaItems((prev) => prev.filter((item) => item.messageId !== messageId));
        };

        socket.onNewMessage(handleNewMessage);
        socket.onMessageDeletedForEveryone(handleDeletedForEveryone);
        return () => {
            socket.removeMessageListener(handleNewMessage);
            socket.removeMessageDeletedForEveryoneListener(handleDeletedForEveryone);
        };
    }, [selectedChat?.id, socketService]);

    const handleSearchPress = () => setIsSearchVisible(true);

    // ── Tên & avatar hiển thị ────────────────────────────────────────
    const displayName = selectedChat?.isGroup
        ? (loadConversation?.name || t('contacts.groupDefaultName'))
        : (otherUser?.name || loadConversation?.name || t('chatArea.defaultUser'));

    const displayAvatar = selectedChat?.isGroup
        ? loadConversation?.avatarUrl
        : (otherUser?.avatarURL || otherUser?.avatarUrl || loadConversation?.avatarUrl);

    const isOnline = selectedChat?.isGroup ? false : (otherUser?.isOnline ?? false);

    if (!selectedChat) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 rounded-2xl m-4">
                <View className="bg-white p-6 rounded-2xl shadow-sm items-center">
                    <Ionicons name="chatbubble-ellipses-outline" size={48} color="#6b7280" />
                    <Text className="text-gray-600 mt-4 text-center">
                        {t('chat.selectChatMobile')}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white" style={{ paddingTop: topPad }}>
            <View className="z-10">
                <HeaderInfo
                    selectedChat={selectedChat}
                    isGroup={selectedChat.isGroup}
                    onBackPress={onBackPress}
                />
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator contentContainerStyle={{ overflow: 'visible' }}>
                <ProfileInfo
                    avatar={displayAvatar}
                    name={displayName}
                    isGroup={selectedChat.isGroup}
                    memberCount={loadConversation?.participantIds?.length ?? 0}
                    isOnline={isOnline}
                    loading={(loadingProfile && !selectedChat.isGroup) || groupAvatarUploading}
                    canEdit={selectedChat.isGroup && canEditGroupAvatar}
                    onAvatarPress={
                        selectedChat.isGroup && canEditGroupAvatar ? handleGroupAvatarPress : undefined
                    }
                    onRenamePress={
                        selectedChat.isGroup && canEditGroupAvatar
                            ? () => actionsInfoRef.current?.openRenameModal()
                            : undefined
                    }
                />

                <ActionsInfo
                    ref={actionsInfoRef}
                    selectChat={loadConversation ?? selectedChat}
                    setLoadConversation={setLoadConversation}
                    onSearchPress={handleSearchPress}
                    otherUser={selectedChat.isGroup ? null : (otherUser ?? null)}
                    onMuteChange={onMuteChange}
                    onDeleteChat={onDeleteChat}
                    onHistoryCleared={onHistoryCleared}
                    onHideChat={onHideChat}
                    onUnhideChat={onUnhideChat}
                    onPinChange={onPinChange}
                    onActionCompleted={onActionCompleted}
                    onConversationMetaChanged={onConversationMetaChanged}
                />

                {selectedChat.isGroup && loadConversation && loadConversation.participantIds && (
                    <GroupInfo group={loadConversation} onParticipantsSynced={onConversationMetaChanged} />
                )}

                <MediaInfo images={mediaUrls} loading={loadingMedia} onViewAll={() => setViewAllMode('media')} />
                <FilesInfo files={sharedFiles} loading={loadingMedia} onViewAll={() => setViewAllMode('files')} />

                {selectedChat.isGroup && isGroupOwner && (
                    <View className="mb-2 mx-4 mt-2">
                        <TouchableOpacity
                            className="flex-row items-center justify-center py-3 rounded-2xl bg-red-50 active:bg-red-100"
                            onPress={handleDisbandGroup}
                        >
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            <Text className="text-red-500 font-semibold text-sm ml-2">{t('info.disbandGroup')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {selectedChat.isGroup && (!isAdmin || isGroupOwner) && (
                    <View className="mb-4 mx-4 mt-2">
                        <TouchableOpacity
                            className="flex-row items-center justify-center py-3 rounded-2xl bg-orange-50 active:bg-orange-100"
                            onPress={isGroupOwner ? handleOwnerLeavePress : handleLeaveGroup}
                        >
                            <Ionicons name="exit-outline" size={18} color="#f97316" />
                            <Text className="text-orange-500 font-semibold text-sm ml-2">{t('info.leaveGroup')}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <Search
                isVisible={isSearchVisible}
                onClose={() => setIsSearchVisible(false)}
                conversationId={selectedChat.id}
                participantInfo={
                    loadConversation?.participantInfo ?? selectedChat.participantInfo ?? []
                }
            />

            <Modal
                visible={ownerLeaveModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    if (!ownerLeaveSubmitting) setOwnerLeaveModalVisible(false);
                }}
            >
                <View className="flex-1 bg-black/40 items-center justify-center px-5">
                    <View className="w-full max-w-md bg-white rounded-2xl overflow-hidden">
                        <View className="px-5 py-4 border-b border-gray-100">
                            <Text className="text-lg font-semibold text-gray-900">{t('info.transferBeforeLeaveTitle')}</Text>
                            <Text className="text-sm text-gray-500 mt-1">
                                {t('info.transferBeforeLeaveDesc')}
                            </Text>
                        </View>

                        <ScrollView className="max-h-[320px]">
                            {ownerTransferCandidates.length === 0 ? (
                                <View className="px-5 py-6">
                                    <Text className="text-gray-500 text-center">
                                        {t('info.noTransferCandidates')}
                                    </Text>
                                </View>
                            ) : (
                                ownerTransferCandidates.map((member) => {
                                    const selected = String(ownerLeaveTargetUserId) === String(member.id);
                                    const label = t(roleLabelKey(member.role));
                                    return (
                                        <TouchableOpacity
                                            key={`owner-target-${member.id}`}
                                            className={`px-5 py-3 flex-row items-center border-b border-gray-100 ${selected ? 'bg-blue-50' : 'bg-white'}`}
                                            onPress={() => setOwnerLeaveTargetUserId(String(member.id))}
                                            disabled={ownerLeaveSubmitting}
                                        >
                                            <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 items-center justify-center">
                                                {member.avatar ? (
                                                    <Image
                                                        source={{ uri: member.avatar }}
                                                        className="w-full h-full"
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <Ionicons name="person" size={18} color="#9ca3af" />
                                                )}
                                            </View>
                                            <View className="flex-1 ml-3">
                                                <Text className="text-gray-900 font-medium" numberOfLines={1}>
                                                    {member.name || t('chatArea.defaultUser')}
                                                </Text>
                                                <Text className="text-xs text-gray-500 mt-0.5">{label}</Text>
                                            </View>
                                            <Ionicons
                                                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                                size={20}
                                                color={selected ? '#2563eb' : '#9ca3af'}
                                            />
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>

                        <View className="flex-row px-5 py-4 border-t border-gray-100">
                            <TouchableOpacity
                                className="flex-1 h-11 rounded-xl bg-gray-100 items-center justify-center mr-2"
                                onPress={() => setOwnerLeaveModalVisible(false)}
                                disabled={ownerLeaveSubmitting}
                            >
                                <Text className="text-gray-800 font-semibold">{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="rounded-xl items-center justify-center"
                                style={{
                                    flex: 1,
                                    height: 44,
                                    backgroundColor: ownerLeaveActionDisabled ? '#fb923c' : '#f97316',
                                    borderWidth: 1,
                                    borderColor: ownerLeaveActionDisabled ? '#fdba74' : '#f97316',
                                    opacity: ownerLeaveActionDisabled ? 0.7 : 1,
                                }}
                                disabled={ownerLeaveActionDisabled}
                                onPress={() => {
                                    void handleTransferAndLeave();
                                }}
                            >
                                {ownerLeaveSubmitting ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={{ color: '#ffffff', fontWeight: '600' }}>{t('info.transferAndLeave')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={viewAllMode !== null}
                animationType="slide"
                transparent
                onRequestClose={() => setViewAllMode(null)}
            >
                <View className="flex-1 bg-black/40 justify-end">
                    <View className="bg-white rounded-t-3xl max-h-[90%]">
                        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
                            <Text className="text-lg font-semibold text-gray-900">
                                {viewAllMode === 'media' ? t('info.allMedia') : t('info.allFiles')}
                            </Text>
                            <TouchableOpacity onPress={() => setViewAllMode(null)} className="px-3 py-1 rounded-lg bg-gray-100">
                                <Text className="text-sm text-gray-700">{t('common.close')}</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="px-4 pb-6">
                            {viewAllMode === 'media' ? (
                                mediaUrls.length === 0 ? (
                                    <Text className="text-gray-400 text-center py-6">{t('info.noMedia')}</Text>
                                ) : (
                                    <View className="flex-row flex-wrap -mx-1 mt-3">
                                        {mediaUrls.map((uri, index) => (
                                            <View key={index} className="w-1/3 p-1">
                                                <Image
                                                    source={{ uri }}
                                                    className="w-full aspect-square rounded-2xl border border-gray-200"
                                                    resizeMode="cover"
                                                />
                                            </View>
                                        ))}
                                    </View>
                                )
                            ) : (
                                sharedFiles.length === 0 ? (
                                    <Text className="text-gray-400 text-center py-6">{t('info.noFiles')}</Text>
                                ) : (
                                    <View className="space-y-3 mt-3">
                                        {sharedFiles.map((file, index) => (
                                            <View
                                                key={index}
                                                className="bg-slate-50 rounded-2xl p-4 flex-row items-center justify-between"
                                            >
                                                <View className="flex-1 pr-3">
                                                    <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
                                                        {file.name}
                                                    </Text>
                                                    <Text className="text-xs text-slate-500 mt-1">
                                                        {file.size}{file.size && file.date ? ' • ' : ''}{file.date}
                                                    </Text>
                                                </View>
                                                {file.url ? (
                                                    <TouchableOpacity
                                                        onPress={() => file.url && Linking.openURL(file.url).catch(() => {})}
                                                        className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center"
                                                    >
                                                        <Ionicons name="download-outline" size={20} color="#2563eb" />
                                                    </TouchableOpacity>
                                                ) : null}
                                            </View>
                                        ))}
                                    </View>
                                )
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}