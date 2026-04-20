import React, { useCallback, useEffect, useRef, useState } from 'react';
import {Alert, FlatList, Image, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {FontAwesome, Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import { friendshipService } from '@/src/api/services/friendship.service';
import { Conversation } from "@/src/models/Conversation";
import { useUser } from '@/src/contexts/user/UserContext';
import { userService as UserService } from '@/src/api/services/user.service';
import SocketService from '@/src/api/socketCompat';
import { Message, MessageType } from '@/src/models/Message';
import { mapApiConversationToModel, mapApiMessageToModel, unwrapData } from '@/src/models/mappers';
import { Link, useFocusEffect } from 'expo-router';
import QRScanner from '../ui/QRScanner';
import { useMobileHeader } from '@/src/contexts/MobileHeaderContext';
import GroupInvitesModal from './GroupInvitesModal';

/** Ghim lên trước, trong cùng nhóm ghim sắp theo tin nhắn mới nhất */
function compareInboxConversationOrder(
    a: Conversation,
    b: Conversation,
    externalPinned?: Record<string, boolean>,
): number {
    const pinA = externalPinned?.[String(a.id)] ?? Boolean((a as any).pinned) ? 1 : 0;
    const pinB = externalPinned?.[String(b.id)] ?? Boolean((b as any).pinned) ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    const ta = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt as string).getTime() : 0;
    const tb = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt as string).getTime() : 0;
    return tb - ta;
}

interface ConversationsProps {
    selectedChat: Conversation | null;
    onSelectChat: (chat: Conversation) => void;
    newSelectedChat?: Conversation | null;
    onMuteStateChange?: (handler: (conversationId: string, muted: boolean) => void) => void;
    externalMuteStates?: Record<string, boolean>;
    onMuteChange?: (conversationId: string, muted: boolean) => void;
    externalPinnedStates?: Record<string, boolean>;
    reloadSignal?: number;
    /** Callback khi user chọn Zala Bot chat */
    onOpenBotChat?: () => void;
    /** Zala Bot đang active */
    botChatActive?: boolean;
}

export default function Conversations({
    selectedChat,
    onSelectChat,
    newSelectedChat,
    externalMuteStates,
    externalPinnedStates,
    reloadSignal,
    onOpenBotChat,
    botChatActive = false,
}: ConversationsProps) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useUser();
    const [participantAvatars, setParticipantAvatars] = useState<Record<string, string>>({});
    const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
    const [participantOnlineStatus, setParticipantOnlineStatus] = useState<Record<string, boolean>>({});
    const participantNamesRef = useRef<Record<string, string>>({});
    const participantAvatarsRef = useRef<Record<string, string>>({});
    const userInfoInFlightRef = useRef<Map<string, Promise<any>>>(new Map());
    const conversationsRef = useRef<Conversation[]>([]);
    const socketService = useRef(SocketService.getInstance()).current;
    const externalPinnedStatesRef = useRef(externalPinnedStates);
    const lastFetchTime = useRef<number>(0);
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // Local state — fallback khi chạy trên web
    const [showQRScannerLocal, setShowQRScannerLocal] = useState(false);
    const [searchQueryLocal, setSearchQueryLocal] = useState('');
    // Luôn gọi hook vô điều kiện (Rules of Hooks)
    const mobileHeaderCtx = useMobileHeader();
    const isNative = Platform.OS !== 'web';
    // Trên mobile: dùng state từ shared header ở layout
    // Trên web: dùng local state (context trả về default no-op values)
    const searchQuery = isNative ? mobileHeaderCtx.searchQuery : searchQueryLocal;
    const setSearchQuery = isNative ? mobileHeaderCtx.setSearchQuery : setSearchQueryLocal;
    const showQRScanner = isNative ? mobileHeaderCtx.showQRScanner : showQRScannerLocal;
    const setShowQRScanner = isNative ? mobileHeaderCtx.setShowQRScanner : setShowQRScannerLocal;
    const [hiddenConversations, setHiddenConversations] = useState<Conversation[]>([]);
    const [strangerConversations, setStrangerConversations] = useState<Conversation[]>([]);
    /** Kết quả tìm trong các cuộc đã gỡ khỏi sách chính (sau xóa lịch sử), merge khi ô tìm có nội dung */
    const [removedSearchExtra, setRemovedSearchExtra] = useState<Conversation[]>([]);
    const removedSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [showPendingInboxModal, setShowPendingInboxModal] = useState(false);
    const [unlockPin, setUnlockPin] = useState('');
    const [unlockLoading, setUnlockLoading] = useState(false);
    const [pendingHiddenConversation, setPendingHiddenConversation] = useState<Conversation | null>(null);
    /** Đếm tin chưa đọc theo hội thoại */
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    /** Trạng thái mute theo conversationId — key: convId, value: true=muted */
    const [muteStates, setMuteStates] = useState<Record<string, boolean>>({});
    /** Trạng thái quan hệ theo conversationId */
    const [friendFlags, setFriendFlags] = useState<Record<string, boolean>>({});
    const insets = useSafeAreaInsets();

    useEffect(() => {
        externalPinnedStatesRef.current = externalPinnedStates;
    }, [externalPinnedStates]);

    useEffect(() => {
        participantNamesRef.current = participantNames;
    }, [participantNames]);

    useEffect(() => {
        participantAvatarsRef.current = participantAvatars;
    }, [participantAvatars]);

    // Group Invites State
    const [groupInvitesCount, setGroupInvitesCount] = useState(0);
    const [showGroupInvitesModal, setShowGroupInvitesModal] = useState(false);

    // Fetch conversations
    const fetchConversations = async (force = false) => {
        if (!user?.id) return;
        
        const now = Date.now();
        const cooldown = 1000;
        
        if (!force && (now - lastFetchTime.current < cooldown)) {
            // Nếu gọi quá nhanh mà không force, đặt lịch fetch sau đó
            if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
            fetchTimeoutRef.current = setTimeout(() => fetchConversations(true), cooldown);
            return;
        }

        if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
            fetchTimeoutRef.current = null;
        }
        
        console.log("[Conversations] Fetching conversations from server... (force=" + force + ")");
        lastFetchTime.current = now;
        setLoading(true);
        try {
            const response = await ConversationService.getConversations();
            if (!response.success) {
                setError(
                    response.message || "Failed to fetch conversations"
                );
                return;
            }

            const convs = Array.isArray(response.conversations) ? response.conversations : [];
            setError(null);
            setConversations(convs);

            const onlineStatus: Record<string, boolean> = {};
            convs.forEach((conv: Conversation) => {
                if (!Array.isArray(conv.participantInfo)) return;
                conv.participantInfo.forEach((p: any) => {
                    if (p.id === user?.id) return;
                    if (p.isOnline !== undefined) onlineStatus[p.id] = p.isOnline;
                });
            });
            if (Object.keys(onlineStatus).length > 0) {
                setParticipantOnlineStatus((prev) => ({ ...prev, ...onlineStatus }));
            }

            // Load mute status
            const mutes: Record<string, boolean> = {};
            convs.forEach((conv: Conversation) => {
                const me = conv.participantInfo?.find(p => p.id === user?.id);
                mutes[conv.id] = (me as any)?.muted ?? false;
            });
            setMuteStates(mutes);

            // Enrich chạy nền để màn hình hiện nhanh hơn.
            void fetchMissingParticipantInfo(convs);
            void (async () => {
                const relationEntries = await Promise.all(
                    convs.map(async (conv: Conversation) => {
                        if (conv.isGroup || conv.participantIds.length < 2 || !user?.id) {
                            return [conv.id, false] as const;
                        }
                        const otherId = conv.participantIds.find((id) => id !== user.id);
                        if (!otherId) return [conv.id, false] as const;
                        try {
                            const statusRes: any = await friendshipService.getStatus<any>(otherId);
                            const payload = statusRes?.data ?? statusRes;
                            return [conv.id, String(payload?.status || '').toUpperCase() === 'ACCEPTED'] as const;
                        } catch {
                            return [conv.id, false] as const;
                        }
                    })
                );
                setFriendFlags(Object.fromEntries(relationEntries));
            })();

        } catch (error) {
            console.error("Fetch conversations error:", error);
            setError(
                error instanceof Error ? error.message : "An unknown error occurred"
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchConversationsRef = useRef(fetchConversations);
    fetchConversationsRef.current = fetchConversations;

    /** Fetch thông tin user (tên + avatar) cho participants của hidden/stranger conversations.
     *  Ưu tiên lấy từ participantInfo đã embed trong response, chỉ gọi API cho các ID còn thiếu. */
    const fetchMissingParticipantInfo = async (convList: Conversation[]) => {
        const newNames: Record<string, string> = {};
        const newAvatars: Record<string, string> = {};

        // Bước 1: Lấy tên sẵn có từ participantInfo (đã có trong response, không tốn API)
        const needApiIds = new Set<string>();
        convList.forEach((conv) => {
            conv.participantIds.forEach((id) => {
                if (id === user?.id) return;
                const info = conv.participantInfo?.find((p) => p.id === id);
                if (info?.name) {
                    newNames[id] = info.name;
                    if (info.avatar) newAvatars[id] = info.avatar;
                } else if (participantNamesRef.current[id]) {
                    newNames[id] = participantNamesRef.current[id];
                    if (participantAvatarsRef.current[id]) {
                        newAvatars[id] = participantAvatarsRef.current[id];
                    }
                } else {
                    needApiIds.add(id);
                }
            });
        });

        // Bước 2: Gọi API cho những ID chưa có tên
        if (needApiIds.size > 0) {
            await Promise.all(
                [...needApiIds].map(async (id) => {
                    try {
                        let pending = userInfoInFlightRef.current.get(id);
                        if (!pending) {
                            pending = UserService.getUserById(id).finally(() => {
                                userInfoInFlightRef.current.delete(id);
                            });
                            userInfoInFlightRef.current.set(id, pending);
                        }
                        const r: any = await pending;
                        if (r?.success && r?.user) {
                            const uid = r.user.id || r.user._id || id;
                            newNames[uid] = r.user.name || r.user.displayName || 'Unknown';
                            newAvatars[uid] = r.user.avatarURL || '';
                            return;
                        }
                        newNames[id] = 'Người dùng';
                    } catch {
                        newNames[id] = 'Người dùng';
                    }
                })
            );
        }

        if (Object.keys(newNames).length > 0) {
            setParticipantNames((prev) => ({ ...prev, ...newNames }));
            setParticipantAvatars((prev) => ({ ...prev, ...newAvatars }));
        }
    };

    const fetchHiddenConversations = async () => {
        if (!user?.id) return;
        try {
            const res: any = await ConversationService.getHiddenConversations<any>(user.id);
            const root = unwrapData<any>(res);
            const rows = Array.isArray(root) ? root : Array.isArray(root?.items) ? root.items : [];
            const mapped = rows.map(mapApiConversationToModel);
            setHiddenConversations(mapped);
            // Fetch tên/avatar cho participants của hidden conversations
            await fetchMissingParticipantInfo(mapped);
        } catch {
            setHiddenConversations([]);
        }
    };

    const fetchStrangerConversations = async () => {
        if (!user?.id) return;
        try {
            const res: any = await ConversationService.getStrangerConversations<any>(user.id);
            const root = unwrapData<any>(res);
            const rows = Array.isArray(root) ? root : Array.isArray(root?.items) ? root.items : [];
            const mapped = rows.map(mapApiConversationToModel);
            setStrangerConversations(mapped);
            // Fetch tên/avatar cho participants của stranger conversations
            await fetchMissingParticipantInfo(mapped);
        } catch {
            setStrangerConversations([]);
        }
    };

    useEffect(() => {
        if (!user?.id) {
            setRemovedSearchExtra([]);
            return;
        }
        const inboxUserId = user.id;
        const raw = searchQuery.trim();
        if (!raw) {
            setRemovedSearchExtra([]);
            return;
        }
        if (removedSearchDebounceRef.current) clearTimeout(removedSearchDebounceRef.current);
        removedSearchDebounceRef.current = setTimeout(() => {
            void (async () => {
                try {
                    const res = await ConversationService.searchRemovedFromInboxForUser(inboxUserId, raw);
                    if (res.success && Array.isArray(res.conversations)) {
                        setRemovedSearchExtra(res.conversations);
                        await fetchMissingParticipantInfo(res.conversations);
                    } else {
                        setRemovedSearchExtra([]);
                    }
                } catch {
                    setRemovedSearchExtra([]);
                }
            })();
        }, 320);
        return () => {
            if (removedSearchDebounceRef.current) clearTimeout(removedSearchDebounceRef.current);
        };
    }, [searchQuery, user?.id]);

    useEffect(() => {
        if (reloadSignal !== 0) {
            fetchConversations();
            fetchHiddenConversations();
            fetchStrangerConversations();
        }
    }, [reloadSignal]);

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);
    useFocusEffect(
        useCallback(() => {
            fetchConversations();
            fetchHiddenConversations();
            fetchStrangerConversations();
        }, [user?.id, showQRScanner, reloadSignal])
    );

    const fetchGroupInvitesCount = async () => {
        try {
            const res = await ConversationService.getMyGroupInvites();
            if (res.success && res.invites) {
                setGroupInvitesCount(res.invites.length);
            }
        } catch (error) {
            console.error("Fetch group invites count error:", error);
        }
    };

    // load conversations when socket add participant
    useEffect(() => {
        const handleAddParticipant = (updatedConversation: Conversation) => {
            fetchConversations();
        };
        const handleGroupInviteReceived = () => fetchGroupInvitesCount();
        const handleGroupInviteAccepted = () => {
            fetchGroupInvitesCount();
            fetchConversations();
        };

        const handleConversationUpdated = (updatedConv: any) => {
            console.log("[Conversations] Received conversation-updated:", updatedConv);
            const mapped = mapApiConversationToModel(updatedConv);
            setConversations((prev) =>
                prev.map((c) => (String(c.id) === String(mapped.id) ? mapped : c))
            );
        };

        console.log("Socket listener added for conversation events", conversations);
        const socketService = SocketService.getInstance();
        socketService.onParticipantsAddedServer(handleAddParticipant);
        socketService.onConversationUpdated(handleConversationUpdated);
        socketService.onGroupInviteReceived?.(handleGroupInviteReceived);
        socketService.onGroupInviteAccepted?.(handleGroupInviteAccepted);

        return () => {
            socketService.removeParticipantsAddedServer(handleAddParticipant);
            socketService.removeConversationUpdatedListener(handleConversationUpdated);
            socketService.removeGroupInviteReceivedListener?.(handleGroupInviteReceived);
            socketService.removeGroupInviteAcceptedListener?.(handleGroupInviteAccepted);
        };
    }, [socketService]);

    /** Realtime: bị đá / xóa khỏi nhóm — gỡ khỏi danh sách + đồng bộ */
    useEffect(() => {
        if (!user?.id) return;
        const socket = SocketService.getInstance();
        const onRemoved = (data: { conversationId: string; removedParticipants: string[] }) => {
            const cid = String(data?.conversationId ?? '');
            if (!cid || !Array.isArray(data?.removedParticipants)) return;
            const myId = String(user.id);
            if (data.removedParticipants.some((id) => String(id) === myId)) {
                setConversations((prev) => prev.filter((c) => String(c.id) !== cid));
                setUnreadCounts((prev) => {
                    const next = { ...prev };
                    delete next[cid];
                    return next;
                });
            }
            void fetchConversationsRef.current(true);
        };
        socket.onParticipantsRemoved(onRemoved);
        return () => socket.removeParticipantsRemovedListener(onRemoved);
    }, [user?.id]);

    /** Bị kick — server emit group:kicked_from chỉ tới notif room; đảm bảo gỡ hội thoại khỏi list ngay */
    useEffect(() => {
        if (!user?.id) return;
        const socket = SocketService.getInstance();
        const onKicked = (data: { conversationId?: string }) => {
            const cid = String(data?.conversationId ?? '');
            if (!cid) return;
            setConversations((prev) => prev.filter((c) => String(c.id) !== cid));
            setUnreadCounts((prev) => {
                const next = { ...prev };
                delete next[cid];
                return next;
            });
            void fetchConversationsRef.current(true);
        };
        const onBanned = (data: { conversationId?: string }) => {
            const cid = String(data?.conversationId ?? '');
            if (!cid) return;
            setConversations((prev) => prev.filter((c) => String(c.id) !== cid));
            setUnreadCounts((prev) => {
                const next = { ...prev };
                delete next[cid];
                return next;
            });
            void fetchConversationsRef.current(true);
        };
        socket.onGroupKickedFrom(onKicked);
        socket.onGroupBannedFrom(onBanned);
        return () => {
            socket.removeGroupKickedFromListener(onKicked);
            socket.removeGroupBannedFromListener(onBanned);
        };
    }, [user?.id]);

    useEffect(() => {
        const handleConversationUpdated = (payload: any) => {
            if (!payload?.id && !payload?._id) return;
            const conversationId = String(payload?.id ?? payload?._id);
            setConversations((prev) =>
                prev.map((conversation) =>
                    String(conversation.id) === conversationId
                        ? { ...conversation, ...mapApiConversationToModel(payload) }
                        : conversation
                )
            );
        };

        const socketService = SocketService.getInstance();
        socketService.onConversationUpdated(handleConversationUpdated);
        return () => {
            socketService.removeConversationUpdatedListener(handleConversationUpdated);
        };
    }, [socketService]);

    useEffect(() => {
        const socketService = SocketService.getInstance();
        const handleConversationDeleted = (data: { conversationId: string }) => {
            const id = String(data?.conversationId ?? '');
            if (!id) return;
            setConversations((prev) => prev.filter((c) => String(c.id) !== id));
            setHiddenConversations((prev) => prev.filter((c) => String(c.id) !== id));
            setStrangerConversations((prev) => prev.filter((c) => String(c.id) !== id));
            setUnreadCounts((prev) => {
                const next = { ...prev };
                for (const k of Object.keys(next)) {
                    if (String(k) === id) delete next[k];
                }
                return next;
            });
            void fetchConversations(true);
            void fetchHiddenConversations();
            void fetchStrangerConversations();
        };
        socketService.onConversationDeleted(handleConversationDeleted);
        return () => {
            socketService.removeConversationDeletedListener(handleConversationDeleted);
        };
    }, [socketService]);

    // Real-time: cập nhật trạng thái online qua socket presence:update
    useEffect(() => {
        const handlePresence = (data: { userId: string; status: 'online' | 'offline'; lastSeen: string }) => {
            setParticipantOnlineStatus((prev) => ({
                ...prev,
                [data.userId]: data.status === 'online',
            }));
        };
        socketService.onPresenceUpdate(handlePresence);
        return () => {
            socketService.removePresenceUpdateListener(handlePresence);
        };
    }, []);

    // Lắng nghe message:seen để cập nhật trạng thái "đã xem" ngay lập tức trên UI danh sách
    useEffect(() => {
        const handleRead = (data: { conversationId: string; messageId: string; userId: string }) => {
            setConversations((prev) =>
                prev.map((conv) => {
                    if (String(conv.id) === String(data.conversationId) && conv.lastMessage?.id === data.messageId) {
                        const currentReadBy = conv.lastMessage.readBy || [];
                        if (!currentReadBy.includes(data.userId)) {
                            return {
                                ...conv,
                                lastMessage: {
                                    ...conv.lastMessage,
                                    readBy: [...currentReadBy, data.userId],
                                } as Message,
                            };
                        }
                    }
                    return conv;
                })
            );
        };
        socketService.onMessageRead(handleRead);
        return () => socketService.removeMessageReadListener(handleRead);
    }, [socketService]);

    // Update readBy field when conversation is selected

    useEffect(() => {
        const myUserId = user?.id;
        setConversations((prev) =>
            prev.map((conv) => {
                if (conv.id == selectedChat?.id) {
                    const readBy = conv.lastMessage?.readBy || [];
                    const nextReadBy = myUserId
                        ? Array.from(new Set([...readBy, myUserId]))
                        : readBy;
                    return {
                        ...conv,
                        lastMessage: {
                            ...conv.lastMessage,
                            readBy: nextReadBy,
                        } as Message,
                    };
                }
                return conv;
            })
        );
    }, [selectedChat?.id, user?.id]);

    // Mở đúng hội thoại → xóa badge đếm local (đã xem)
    useEffect(() => {
        if (!selectedChat?.id) return;
        setUnreadCounts((prev) => {
            if (prev[selectedChat.id] == null) return prev;
            const next = { ...prev };
            delete next[selectedChat.id];
            return next;
        });
    }, [selectedChat?.id]);

    useEffect(() => {
        console.log("Socket listener added for new messages");
        const handleNewMessage = (raw: Message | Record<string, unknown>) => {
            const message = mapApiMessageToModel(raw as any);
            const myUserId = user?.id;

            const existsInList = conversationsRef.current.some(
                (c) => String(c.id) === String(message.conversationId)
            );

            if (!existsInList) {
                console.log("[Conversations] New message from UNKNOWN conversation:", message.conversationId, ". Fetching all to update list...");
                fetchConversations(true); // Force fetch because we know we are missing one
                fetchStrangerConversations();
                return;
            }

            const isOtherChat =
                message.conversationId &&
                message.conversationId !== selectedChat?.id;
            const fromSomeoneElse = myUserId && message.senderId !== myUserId;
            if (isOtherChat && fromSomeoneElse) {
                const cid = message.conversationId as string;
                setUnreadCounts((prev) => ({
                    ...prev,
                    [cid]: (prev[cid] || 0) + 1,
                }));
            }

            setConversations((prev) =>
                prev
                    .map((conversation) => {
                        if (String(conversation.id) !== String(message.conversationId)) {
                            return conversation;
                        }
                        const readBy = (selectedChat?.id === conversation.id && myUserId)
                            ? Array.from(new Set([...(message.readBy || []), myUserId]))
                            : (message.readBy || []);

                        return {
                            ...conversation,
                            lastMessage: {
                                ...message,
                                readBy,
                            } as Message,
                        };
                    })
                    .sort((a, b) =>
                        compareInboxConversationOrder(a, b, externalPinnedStatesRef.current),
                    )
            );

            // Đồng bộ realtime cho danh sách stranger/pending.
            // Khi user hiện tại reply, lastMessage.senderId đổi thành chính mình => tự thoát pending ngay.
            setStrangerConversations((prev) =>
                prev.map((conversation) => {
                    if (String(conversation.id) !== String(message.conversationId)) {
                        return conversation;
                    }
                    return {
                        ...conversation,
                        lastMessage: {
                            ...message,
                            readBy: message.readBy || [],
                        } as Message,
                    };
                })
            );
        };
        socketService.onNewMessage(handleNewMessage);
        return () => {
            socketService.removeMessageListener(handleNewMessage);
        };
    }, [selectedChat?.id, socketService, user?.id]);

    useEffect(() => {
        const handleDeletedForEveryone = (payload: any) => {
            const messageId = String(
                payload?.messageId ?? payload?.id ?? payload?._id ?? payload?.message?._id ?? payload?.message?.id ?? ''
            );
            const conversationId = String(
                payload?.conversationId ?? payload?.message?.conversationId ?? ''
            );
            if (!messageId) return;

            const updateConversationItem = (conversation: Conversation) => {
                if (conversationId && String(conversation.id) !== conversationId) return conversation;
                if (!conversation.lastMessage) return conversation;
                const lastMessageId = String(conversation.lastMessage.id ?? conversation.lastMessage._id ?? '');
                if (lastMessageId !== messageId) return conversation;
                return {
                    ...conversation,
                    lastMessage: {
                        ...conversation.lastMessage,
                        isDeletedForEveryone: true,
                        content: 'Tin nhắn đã được thu hồi',
                    } as Message,
                };
            };

            setConversations((prev) => prev.map(updateConversationItem));
            setStrangerConversations((prev) => prev.map(updateConversationItem));
            setHiddenConversations((prev) => prev.map(updateConversationItem));
        };

        socketService.onMessageDeletedForEveryone(handleDeletedForEveryone);
        return () => {
            socketService.removeMessageDeletedForEveryoneListener(handleDeletedForEveryone);
        };
    }, [socketService]);

    useEffect(() => {
        const onNicknameUpdated = (payload: { conversationId?: string }) => {
            if (!payload?.conversationId) return;
            void fetchConversations();
        };
        socketService.onConversationNicknameUpdated(onNicknameUpdated as any);
        return () => socketService.removeConversationNicknameUpdatedListener(onNicknameUpdated as any);
    }, [socketService, user?.id]);

    // Realtime friendship updates (accept/deny/recall/request) -> refresh list + tag bạn bè/người lạ
    useEffect(() => {
        const handleFriendshipChanged = () => {
            void fetchConversations();
            void fetchStrangerConversations();
        };
        socketService.onFriendRequest(handleFriendshipChanged);
        socketService.onFriendRequestAccepted(handleFriendshipChanged);
        socketService.onDeleteFriendRequest(handleFriendshipChanged);
        return () => {
            socketService.removeFriendRequestListener(handleFriendshipChanged);
            socketService.removeFriendRequestAcceptedListener(handleFriendshipChanged);
            socketService.removeFriendRequestActionListener(handleFriendshipChanged);
        };
    }, [socketService, user?.id]);

    // Realtime group join approval (when user is approved by admin via QR/Link)
    useEffect(() => {
        const handleGroupApproved = (data: { conversationId: string; groupName: string }) => {
            console.log('[Conversations] group:join_approved received:', data);
            // Re-fetch conversation list to show the new group
            void fetchConversations(true);
        };
        
        socketService.onGroupJoinApproved(handleGroupApproved);
        return () => socketService.removeGroupJoinApprovedListener(handleGroupApproved);
    }, [socketService, user?.id]);

    const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isReadByMe = (conversation: Conversation) => {
        if (selectedChat?.id && selectedChat.id == conversation.id) {
            return true;
        }
        const lm = conversation.lastMessage;
        if (!lm) return true;
        // Tin cuối do mình gửi — không hiển thị badge chưa đọc phía mình
        if (lm.senderId === user?.id) return true;
        if (lm.readBy && lm.readBy.includes(user?.id || '')) return true;
        return false;
    };

    const getUnreadBadgeCount = (conversation: Conversation) => {
        const n = unreadCounts[conversation.id];
        if (n != null && n > 0) return n;
        if (!isReadByMe(conversation)) return 1;
        return 0;
    };

    /** Preview dòng 2 trong list — text hoặc nhãn theo loại (ảnh/file không có content). */
    const lastMessagePreviewLabel = (conversation: Conversation): string => {
        const lm = conversation.lastMessage;
        if (!lm) return "No messages yet";
        if (lm.isDeletedForEveryone) return "Tin nhắn đã được thu hồi";

        const typeNorm = String(lm.type ?? '').toLowerCase();
        // Tin hệ thống: content đã là câu thông báo đầy đủ — không gắn "Bạn:" / tên người gửi
        if (typeNorm === MessageType.SYSTEM) {
            const t = String(lm.content ?? '').trim();
            return t || 'Thông báo';
        }

        let prefix = "";
        if (lm.senderId === user?.id) {
            prefix = "Bạn: ";
        } else if (conversation.isGroup) {
            const senderName = participantNames[lm.senderId] || 'Thành viên';
            // Lấy từ đầu đến dấu cách đầu tiên để hiển thị tên ngắn gọn (vd: "Trần Quốc Bảo" -> "Bảo", hoặc để nguyên cũng được)
            const shortName = senderName.split(' ').pop() || senderName;
            prefix = `${shortName}: `;
        }

        // Bình chọn: content là JSON — không hiển thị raw trong list
        if (typeNorm === MessageType.VOTE) {
            let label = 'Cuộc bình chọn';
            try {
                const parsed = JSON.parse(String(lm.content || '{}')) as { question?: string };
                const q = String(parsed?.question ?? '').trim();
                if (q) {
                    label = q.length > 80 ? `${q.slice(0, 77)}…` : `Bình chọn: ${q}`;
                }
            } catch {
                /* giữ Cuộc bình chọn */
            }
            return prefix + label;
        }

        let contentText = "";
        if (lm.content != null && String(lm.content).trim()) {
            contentText = String(lm.content).trim();
        } else {
            switch (lm.type) {
                case MessageType.IMAGE:
                    contentText = "Ảnh"; break;
                case MessageType.VIDEO:
                    contentText = "Video"; break;
                case MessageType.FILE: {
                    const name = (lm.metadata as { fileName?: string } | undefined)?.fileName;
                    contentText = name ? `Tệp: ${name}` : "Tệp đính kèm"; break;
                }
                case MessageType.AUDIO:
                    contentText = "Ghi âm"; break;
                case MessageType.CALL:
                    contentText = "Cuộc gọi"; break;
                case MessageType.VOTE:
                    contentText = "Bình chọn"; break;
                case MessageType.MEDIA_ALBUM:
                    contentText = "Album ảnh/video"; break;
                default:
                    contentText = "Tin nhắn"; break;
            }
        }
        return prefix + contentText;
    };

    const getConversationName = (conversation: Conversation) => {
        if (!conversation.isGroup) {
            const me = conversation.participantInfo?.find((p) => p.id === user?.id);
            const myNickname = String(me?.nickname ?? "").trim();
            if (myNickname) return myNickname;
        }
        if (conversation.name) {
            return conversation.name;
        }

        if (conversation.isGroup) {
            // Lấy tên của 2 người đầu tiên trong nhóm
            const otherParticipants = conversation.participantIds
                .filter(id => id !== user?.id)
                .slice(0, 2);
            const names = otherParticipants.map(id => participantNames[id] || 'Unknown');
            return names.join(', ');
        }

        // Trong chat riêng tư, lấy tên của người còn lại
        const otherParticipantId = conversation.participantIds.find(id => id !== user?.id);
        return otherParticipantId ? participantNames[otherParticipantId] || 'Unknown' : 'Unknown';
    };

    const normalizeText = (x: string) => x.trim().toLowerCase();
    const q = normalizeText(searchQuery);
    const inboxConversations = !q
        ? conversations
        : (() => {
              const base = conversations.filter((conversation) => {
                  const convName = normalizeText(getConversationName(conversation));
                  const lastLabel = normalizeText(lastMessagePreviewLabel(conversation));
                  return convName.includes(q) || lastLabel.includes(q);
              });
              const idSet = new Set(base.map((c) => String(c.id)));
              const merged = [...base];
              for (const c of removedSearchExtra) {
                  if (!idSet.has(String(c.id))) {
                      merged.push(c);
                      idSet.add(String(c.id));
                  }
              }
              return merged;
          })();
    const hiddenSearchResults = !q
        ? []
        : hiddenConversations.filter((conversation) => {
            const convName = normalizeText(getConversationName(conversation));
            return convName.includes(q);
        });

    const hiddenPendingConversations = hiddenConversations.slice().sort((a, b) => {
        const at = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt as string).getTime() : 0;
        const bt = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt as string).getTime() : 0;
        return bt - at;
    });
    const strangerConversationIds = new Set(
        strangerConversations.map((c) => String(c.id))
    );
    const strangerPendingConversations = strangerConversations
        .filter((c) => String(c.lastMessage?.senderId ?? "") !== String(user?.id ?? ""))
        .slice()
        .sort((a, b) => {
            const at = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt as string).getTime() : 0;
            const bt = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt as string).getTime() : 0;
            return bt - at;
        });
    const pendingInboxConversations = [...hiddenPendingConversations, ...strangerPendingConversations]
        .sort((a, b) => {
            const at = a.lastMessage?.sentAt ? new Date(a.lastMessage.sentAt as string).getTime() : 0;
            const bt = b.lastMessage?.sentAt ? new Date(b.lastMessage.sentAt as string).getTime() : 0;
            return bt - at;
        });
    const pendingStrangerIds = new Set(
        strangerPendingConversations.map((c) => String(c.id))
    );
    const visibleInboxConversations = inboxConversations.filter(
        (c) => !pendingStrangerIds.has(String(c.id))
    );

    const sortedInboxConversations = visibleInboxConversations
        .slice()
        .sort((a, b) => compareInboxConversationOrder(a, b, externalPinnedStates));

    const openHiddenConversation = (conversation: Conversation) => {
        setPendingHiddenConversation(conversation);
        setUnlockPin('');
        setShowUnlockModal(true);
    };

    const handleUnlockHiddenConversation = async () => {
        if (!pendingHiddenConversation?.id || !user?.id || unlockLoading) return;
        const pin = unlockPin.trim();
        if (!/^\d{4,6}$/.test(pin)) {
            Alert.alert('PIN không hợp lệ', 'PIN phải là 4-6 chữ số.');
            return;
        }
        setUnlockLoading(true);
        try {
            const res: any = await ConversationService.unlock(pendingHiddenConversation.id, user.id, pin);
            if (res?.success === false) {
                Alert.alert('Sai PIN', res?.message || 'Không thể mở hội thoại.');
                return;
            }
            setShowUnlockModal(false);
            const detail = await ConversationService.getConversationById(pendingHiddenConversation.id, user.id);
            if (detail?.success && detail?.conversation) {
                onSelectChat({
                    ...detail.conversation,
                    isHiddenSession: true,
                });
            }
        } catch (e: any) {
            Alert.alert('Sai PIN', e?.message || 'Không thể mở hội thoại.');
        } finally {
            setUnlockLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text>Loading...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View className="flex-1 items-center justify-center">
                <Text className="text-red-500">Error: {error}</Text>
            </View>
        );
    }

    return (
		<View
			className="flex-1 border-r border-gray-200 px-3 bg-white"
			style={{ flex: 1, minHeight: 0 }}
		>
			{/* Search Bar — chỉ hiển trên web; mobile dùng header chung từ _layout */}
			{Platform.OS === 'web' && (
				<View className="py-4 justify-between flex-row items-center">
					<View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2 h-12 flex-1 mr-4 border border-gray-200">
						<Ionicons name="search-outline" size={20} color="#6b7280" />
						<TextInput
							className="flex-1 ml-2 text-base"
							style={{
                                minWidth: 0,
                                flexShrink: 1,
                                paddingVertical: 0,
                                lineHeight: 20,
                                textAlignVertical: 'center',
                            }}
                            placeholder="Tìm kiếm cuộc trò chuyện..."
                            placeholderTextColor="#9ca3af"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
						/>
					</View>
					<TouchableOpacity 
						className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center border border-gray-200 shadow-sm active:bg-gray-200"
						onPress={() => setShowQRScanner(true)}
						accessibilityLabel="Quét mã QR"
					>
						<Ionicons name="scan-outline" size={24} color="#6d28d9" />
					</TouchableOpacity>
				</View>
			)}
			{/* FlatList: trên native ScrollView trong flex thường không nhận chiều cao — FlatList cuộn ổn định hơn */}
			<FlatList
				data={sortedInboxConversations}
				keyExtractor={(item) => String(item.id)}
				style={{ flex: 1 }}
				className="flex-1"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator
				contentContainerStyle={{
					paddingBottom: Platform.OS === 'web' ? 24 : 60 + insets.bottom,
				}}
				ListHeaderComponent={
					<View>
						{pendingInboxConversations.length > 0 && (
							<TouchableOpacity
								className="mb-2 p-3 rounded-2xl border bg-amber-50 border-amber-200 flex-row items-center"
								onPress={() => setShowPendingInboxModal(true)}
							>
								<View className="w-10 h-10 rounded-xl bg-amber-100 items-center justify-center">
									<Ionicons name="mail-unread-outline" size={20} color="#b45309" />
								</View>
								<View className="flex-1 ml-3">
									<Text className="text-amber-900 font-semibold">
										Có người muốn nhắn tin bạn
									</Text>
									<Text className="text-amber-700 text-xs mt-0.5">
										{pendingInboxConversations.length} đoạn chat đang chờ
									</Text>
								</View>
								<View className="bg-amber-600 min-w-[22px] h-[22px] px-1 rounded-full items-center justify-center">
									<Text className="text-white text-xs font-bold">
										{pendingInboxConversations.length > 99 ? '99+' : String(pendingInboxConversations.length)}
									</Text>
								</View>
							</TouchableOpacity>
						)}

						<TouchableOpacity
							onPress={onOpenBotChat}
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								padding: 12,
								borderRadius: 16,
								marginBottom: 6,
								backgroundColor: botChatActive ? '#ede9fe' : '#faf5ff',
								borderWidth: 1,
								borderColor: botChatActive ? '#c4b5fd' : '#ede9fe',
							}}
						>
							{botChatActive && (
								<View style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2, backgroundColor: '#6d28d9' }} />
							)}
							<View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#6d28d9', alignItems: 'center', justifyContent: 'center' }}>
								<Ionicons name="logo-gitlab" size={24} color="#fff" />
							</View>
							<View style={{ flex: 1, marginLeft: 12 }}>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
									<Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>Zala Bot</Text>
									<View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#6d28d9' }}>
										<Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>AI</Text>
									</View>
								</View>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
									<View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
									<Text style={{ fontSize: 12, color: '#7c3aed' }} numberOfLines={1}>
										Trợ lý AI luôn sẵn sàng giúp bạn
									</Text>
								</View>
							</View>
							<Ionicons name="sparkles" size={16} color="#a78bfa" />
						</TouchableOpacity>

						<View style={{ height: 1, backgroundColor: '#f3f4f6', marginBottom: 6, marginHorizontal: 4 }} />
					</View>
				}
				ListFooterComponent={
					hiddenSearchResults.length > 0 ? (
						<View className="px-1 pt-2">
							<Text className="text-gray-400 text-[11px] uppercase tracking-widest mb-1">
								Hội thoại đã ẩn
							</Text>
							{hiddenSearchResults.map((conversation) => (
								<TouchableOpacity
									key={`hidden-${conversation.id}`}
									className="flex-row items-center p-3 rounded-2xl border mb-1 bg-amber-50 border-amber-200"
									onPress={() => openHiddenConversation(conversation)}
								>
									<View className="w-11 h-11 rounded-2xl bg-amber-100 items-center justify-center">
										<Ionicons name="lock-closed" size={20} color="#b45309" />
									</View>
									<View className="flex-1 ml-3">
										<Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>
											{getConversationName(conversation)}
										</Text>
										<Text className="text-sm text-amber-700" numberOfLines={1}>
											Hội thoại ẩn - Nhấn để nhập PIN mở lại
										</Text>
									</View>
									<Ionicons name="chevron-forward" size={16} color="#b45309" />
								</TouchableOpacity>
							))}
						</View>
					) : null
				}
				renderItem={({ item: conversation }) => {
					const badgeCount = getUnreadBadgeCount(conversation);
					const isMuted = externalMuteStates?.[conversation.id] ?? muteStates[conversation.id] ?? false;
					const isPinned = externalPinnedStates?.[conversation.id] ?? Boolean(conversation.pinned);
					const isPrivate = !conversation.isGroup && conversation.participantIds.length <= 2;
					const isFriend = Boolean(friendFlags[conversation.id]);
					return (
						<TouchableOpacity
							className={`flex-row items-center p-3 rounded-2xl border mb-1 ${
								selectedChat?.id === conversation.id
									? 'bg-gray-50 border-gray-300'
									: 'bg-white/80 border-transparent'
							}`}
							onPress={() => {
								onSelectChat(conversation);
								console.log('Selected chat: ', conversation);
							}}
						>
							<View className="relative">
								{selectedChat?.id === conversation.id && (
									<View className="absolute -left-2 top-2 h-8 w-1 rounded-full bg-gray-400" />
								)}
								<Image
									source={{
										uri:
											!conversation.isGroup && conversation.participantIds.length < 3
												? participantAvatars[conversation.participantIds.find((id) => id !== user?.id) || ''] ||
												  conversation.avatarUrl
												: conversation.avatarUrl,
										headers: {
											Accept: 'image/*',
										},
										cache: 'force-cache',
									}}
									className="w-11 h-11 rounded-2xl"
								/>
								{!conversation.isGroup &&
									conversation.participantIds.length > 0 &&
									participantOnlineStatus[conversation.participantIds.find((id) => id !== user?.id) || ''] && (
										<View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
									)}
							</View>
							<View className="flex-1 ml-3">
								<View className="flex-row justify-between items-center">
									<View className="flex-row items-center flex-1 mr-2">
										<Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>
											{getConversationName(conversation)}
										</Text>
										{isPrivate && (
											<View
												className={`ml-2 px-2 py-0.5 rounded-full ${
													isFriend ? 'bg-emerald-100' : 'bg-slate-100'
												}`}
											>
												<Text
													className={`text-[10px] font-semibold ${
														isFriend ? 'text-emerald-700' : 'text-slate-600'
													}`}
												>
													{isFriend ? 'Bạn bè' : 'Người lạ'}
												</Text>
											</View>
										)}
										{isPinned && (
											<Ionicons name="bookmark" size={13} color="#d97706" style={{ marginLeft: 4 }} />
										)}
										{isMuted && (
											<Ionicons name="notifications-off-outline" size={13} color="#9ca3af" style={{ marginLeft: 4 }} />
										)}
									</View>
									{conversation.lastMessage?.sentAt && (
										<Text
											className={
												isReadByMe(conversation)
													? 'text-xs text-gray-500'
													: 'text-xs font-semibold text-gray-500'
											}
										>
											{formatTime(conversation.lastMessage.sentAt as string)}
										</Text>
									)}
								</View>
								<View className="flex-row justify-between items-center">
									<Text
										className={
											isReadByMe(conversation)
												? 'text-sm text-gray-500 flex-1 mr-2'
												: 'text-sm text-gray-500 font-bold flex-1 mr-2'
										}
										numberOfLines={1}
									>
										{lastMessagePreviewLabel(conversation)}
									</Text>
									{badgeCount > 0 && (
										<View className="bg-blue-600 min-w-[22px] h-[22px] px-1 rounded-full items-center justify-center">
											<Text className="text-white text-xs font-bold">
												{badgeCount > 99 ? '99+' : String(badgeCount)}
											</Text>
										</View>
									)}
								</View>
							</View>
						</TouchableOpacity>
					);
				}}
			/>
            {
                showQRScanner && (
                    <Modal
                        animationType="slide"
                        transparent={true}
                        visible={showQRScanner}
                        onRequestClose={() => {
                            setShowQRScanner(!showQRScanner);
                        }}
                    >
                        <View className="flex-1">
                            <View>
                                <TouchableOpacity className="absolute top-12 left-8 z-50 w-12 h-12 bg-white rounded-full items-center justify-center shadow-lg"
                                    onPress={() => {
                                        setShowQRScanner(!showQRScanner);
                                    }}
                                >
                                    <Ionicons name="close" size={24} color="black" />
                                </TouchableOpacity>
                            </View>
                            <QRScanner setShowQRScanner={setShowQRScanner} />
                        </View>
                    </Modal>
                )
            }
            <Modal
                transparent
                animationType="fade"
                visible={showUnlockModal}
                onRequestClose={() => setShowUnlockModal(false)}
            >
                <View className="flex-1 bg-black/40 items-center justify-center px-5">
                    <View className="w-full max-w-md bg-white rounded-2xl overflow-hidden">
                        <View className="px-5 py-4 border-b border-gray-100">
                            <Text className="text-lg font-semibold text-gray-900">Mở hội thoại ẩn</Text>
                            <Text className="text-sm text-gray-500 mt-1">
                                Nhập OTP/PIN để mở tạm hội thoại và chat bình thường.
                            </Text>
                        </View>
                        <View className="px-5 py-4">
                            <TextInput
                                value={unlockPin}
                                onChangeText={setUnlockPin}
                                placeholder="Nhập PIN (4-6 số)"
                                placeholderTextColor="#9ca3af"
                                secureTextEntry
                                keyboardType="number-pad"
                                maxLength={6}
                                className="h-12 px-3 rounded-xl border border-gray-300 text-gray-900"
                            />
                        </View>
                        <View className="flex-row px-5 pb-4">
                            <TouchableOpacity
                                className="flex-1 h-12 rounded-xl bg-gray-100 items-center justify-center mr-2"
                                onPress={() => setShowUnlockModal(false)}
                            >
                                <Text className="text-gray-800 font-semibold">Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 h-12 rounded-xl bg-blue-600 items-center justify-center"
                                style={{ opacity: unlockLoading ? 0.6 : 1 }}
                                disabled={unlockLoading}
                                onPress={handleUnlockHiddenConversation}
                            >
                                <Text className="text-white font-semibold">
                                    {unlockLoading ? 'Đang mở...' : 'Mở lại'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                animationType="fade"
                visible={showPendingInboxModal}
                onRequestClose={() => setShowPendingInboxModal(false)}
            >
                <View className="flex-1 bg-black/40 items-center justify-center px-5">
                    <View className="w-full max-w-lg bg-white rounded-2xl overflow-hidden">
                        <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
                            <View>
                                <Text className="text-lg font-semibold text-gray-900">Tin nhắn chờ</Text>
                                <Text className="text-sm text-gray-500 mt-1">
                                    Danh sách đoạn chat ẩn/người lạ đang nhắn cho bạn.
                                </Text>
                            </View>
                            <TouchableOpacity
                                className="w-8 h-8 rounded-lg bg-gray-100 items-center justify-center"
                                onPress={() => setShowPendingInboxModal(false)}
                            >
                                <Ionicons name="close" size={18} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="max-h-[420px]">
                            {pendingInboxConversations.length === 0 ? (
                                <View className="px-5 py-6">
                                    <Text className="text-gray-500 text-center">Chưa có đoạn chat chờ.</Text>
                                </View>
                            ) : (
                                pendingInboxConversations.map((conversation) => (
                                    <TouchableOpacity
                                        key={`pending-${conversation.id}`}
                                        className="px-5 py-4 border-b border-gray-100 flex-row items-center"
                                        onPress={async () => {
                                            setShowPendingInboxModal(false);
                                            const isStranger = strangerConversationIds.has(String(conversation.id));
                                            if (isStranger) {
                                                const detail = await ConversationService.getConversationById(conversation.id, user?.id);
                                                if (detail?.success && detail?.conversation) {
                                                    onSelectChat(detail.conversation);
                                                }
                                                return;
                                            }
                                            openHiddenConversation(conversation);
                                        }}
                                    >
                                        <View
                                            className={`w-10 h-10 rounded-xl items-center justify-center ${strangerConversationIds.has(String(conversation.id))
                                                    ? "bg-blue-100"
                                                    : "bg-amber-100"
                                                }`}
                                        >
                                            <Ionicons
                                                name={
                                                    strangerConversationIds.has(String(conversation.id))
                                                        ? "person-outline"
                                                        : "lock-closed"
                                                }
                                                size={18}
                                                color={
                                                    strangerConversationIds.has(String(conversation.id))
                                                        ? "#1d4ed8"
                                                        : "#b45309"
                                                }
                                            />
                                        </View>
                                        <View className="flex-1 ml-3">
                                            <Text className="text-gray-900 font-semibold" numberOfLines={1}>
                                                {getConversationName(conversation)}
                                            </Text>
                                            <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={1}>
                                                {lastMessagePreviewLabel(conversation)}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <GroupInvitesModal
                visible={showGroupInvitesModal}
                onClose={() => setShowGroupInvitesModal(false)}
                onSuccess={() => {
                    setShowGroupInvitesModal(false);
                    fetchConversations();
                    fetchGroupInvitesCount();
                }}
            />
        </View>
    );
}