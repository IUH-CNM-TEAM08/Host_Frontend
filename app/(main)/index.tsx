import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Conversations from '@/src/components/chat/Conversations';
import ChatArea from '@/src/components/chat/ChatArea';
import Info from '@/src/components/chat/Info';
import ZalaBotChatbox from '@/src/components/ChatBox/ZalaBotChatbox';
import Toast from '@/src/components/ui/Toast';
import CreateGroup from '@/src/components/contacts/CreateGroup';
import { Conversation } from '@/src/models/Conversation';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { useTabBar } from '@/src/contexts/TabBarContext';
import { Ionicons } from '@expo/vector-icons';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import SocketService from '@/src/api/socketCompat';
import { useUser } from '@/src/contexts/user/UserContext';
import { useMobileHeader } from '@/src/contexts/MobileHeaderContext';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

export default function MessagesScreen() {
    const router = useRouter();
    const searchParams = useGlobalSearchParams<{ createdGroup?: string; conversationId?: string }>();
    const { user } = useUser();
    const {t} = useTranslation();
    const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
    const [showInfo, setShowInfo] = useState(false);
    const [desktopInfoOpen, setDesktopInfoOpen] = useState(false);
    const [conversationReloadSignal, setConversationReloadSignal] = useState(0);
    /** Tăng sau khi xóa lịch sử (Info) để ChatArea refetch tin — không gỡ hội thoại khỏi list */
    const [messagesRefreshKey, setMessagesRefreshKey] = useState(0);
    const [muteStates, setMuteStates] = useState<Record<string, boolean>>({});
    const [pinnedStates, setPinnedStates] = useState<Record<string, boolean>>({});
    const [showBotChat, setShowBotChat] = useState(false);
    const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [groupCreatedToast, setGroupCreatedToast] = useState({ visible: false, message: '' });
    const selectedChatRef = useRef<Conversation | null>(null);
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    selectedChatRef.current = selectedChat;
    const { hideTabBar, showTabBar } = useTabBar();
    const { hideHeader, showHeader } = useMobileHeader();

    const initialSelectedIds: string[] = [];
    const initialGroupName = '';

    const handleMuteChange = React.useCallback((conversationId: string, muted: boolean) => {
        setMuteStates((prev) => ({ ...prev, [conversationId]: muted }));
    }, []);

    const handlePinChange = React.useCallback((conversationId: string, pinned: boolean) => {
        setPinnedStates((prev) => ({ ...prev, [conversationId]: pinned }));
        setSelectedChat((prev) => {
            if (!prev || prev.id !== conversationId) return prev;
            return { ...prev, pinned };
        });
    }, []);

    const handleBackPress = () => {
        if (showInfo) {
            setShowInfo(false);
            return;
        }
        setSelectedChat(null);
    };

    const handleInfoPress = () => {
        if (isDesktop) {
            setDesktopInfoOpen((prev) => !prev);
            return;
        }
        setShowInfo(true);
    };

    const handleHistoryCleared = React.useCallback(() => {
        const id = selectedChatRef.current?.id;
        // Xóa lịch sử = gỡ khỏi sách chính — đưa user ra khỏi màn chat trống, về danh sách (có thể tìm lại sau)
        setSelectedChat(null);
        setShowInfo(false);
        setDesktopInfoOpen(false);
        if (id) {
            setMuteStates((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setPinnedStates((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
        setConversationReloadSignal((prev) => prev + 1);
        setMessagesRefreshKey((prev) => prev + 1);
    }, []);

    /** Gỡ hội thoại khỏi danh sách (rời nhóm, giải tán, v.v.) — khác với chỉ xóa lịch sử */
    const handleDeleteChat = React.useCallback((conversationId: string) => {
        try {
            SocketService.getInstance().leaveConversation(conversationId);
        } catch {
            /* noop */
        }
        setSelectedChat(null);
        setShowInfo(false);
        setDesktopInfoOpen(false);
        setMuteStates((prev) => {
            const next = { ...prev };
            delete next[conversationId];
            return next;
        });
        setPinnedStates((prev) => {
            const next = { ...prev };
            delete next[conversationId];
            return next;
        });
        setConversationReloadSignal((prev) => prev + 1);
    }, []);

    const handleHideChat = React.useCallback((conversationId: string) => {
        setSelectedChat(null);
        setShowInfo(false);
        setDesktopInfoOpen(false);
        setMuteStates((prev) => {
            const next = { ...prev };
            delete next[conversationId];
            return next;
        });
        setConversationReloadSignal((prev) => prev + 1);
    }, []);

    const handleUnhideChat = React.useCallback((conversationId: string) => {
        setSelectedChat((prev) => {
            if (!prev || prev.id !== conversationId) return prev;
            return { ...prev, isHiddenSession: false };
        });
        setConversationReloadSignal((prev) => prev + 1);
    }, []);

    const syncSelectedConversationFromServer = React.useCallback(() => {
        setConversationReloadSignal((prev) => prev + 1);
        const id = selectedChat?.id;
        if (!id) return;
        void ConversationService.getConversationById(id, user?.id)
            .then((res: any) => {
                if (res?.success && res?.conversation) {
                    const conv = res.conversation;
                    setSelectedChat((prev) => (prev && prev.id === conv.id ? conv : prev));
                }
            })
            .catch(() => {});
    }, [selectedChat?.id, user?.id]);

    const handleInfoActionCompleted = React.useCallback(() => {
        syncSelectedConversationFromServer();
        setShowInfo(false);
    }, [syncSelectedConversationFromServer]);

    useEffect(() => {
        const socketService = SocketService.getInstance();
        const handleConversationRenamed = (payload: { conversationId?: string; newName?: string }) => {
            if (!payload?.conversationId || payload?.newName == null) return;
            const conversationId = String(payload.conversationId);
            const newName = String(payload.newName);
            setConversationReloadSignal((prev) => prev + 1);
            setSelectedChat((prev) =>
                prev && prev.id === conversationId ? { ...prev, name: newName } : prev
            );
        };

        const handleConversationUpdated = (payload: any) => {
            if (!payload?.id && !payload?._id) return;
            const conversationId = String(payload?.id ?? payload?._id);
            const payloadUserId = String(payload?.userId ?? '');
            const myUserId = String(user?.id ?? '');
            if (
                typeof payload?.aiEnabled === 'boolean' &&
                payloadUserId &&
                myUserId &&
                payloadUserId !== myUserId
            ) {
                return;
            }
            setConversationReloadSignal((prev) => prev + 1);
            setSelectedChat((prev) =>
                prev && prev.id === conversationId
                    ? {
                          ...prev,
                          name: payload.name ?? payload?.newName ?? prev.name,
                          avatarUrl: payload.avatarUrl ?? payload.avatarURL ?? prev.avatarUrl,
                          description: payload.description ?? prev.description,
                          aiEnabled:
                              typeof payload?.aiEnabled === 'boolean'
                                  ? Boolean(payload.aiEnabled)
                                  : prev.aiEnabled,
                      }
                    : prev
            );
        };

        const handleConversationDeleted = (data: { conversationId?: string }) => {
            const conversationId = String(data?.conversationId ?? '');
            if (!conversationId) return;
            if (selectedChatRef.current?.id === conversationId) {
                setShowInfo(false);
                setDesktopInfoOpen(false);
            }
            setSelectedChat((prev) => (prev?.id === conversationId ? null : prev));
            setMuteStates((prev) => {
                const next = { ...prev };
                delete next[conversationId];
                return next;
            });
            setPinnedStates((prev) => {
                const next = { ...prev };
                delete next[conversationId];
                return next;
            });
            setConversationReloadSignal((prev) => prev + 1);
        };

        const handleParticipantsRemoved = (data: { conversationId: string; removedParticipants: string[] }) => {
            const conversationId = String(data?.conversationId ?? '');
            const raw = data?.removedParticipants;
            if (!conversationId || !Array.isArray(raw) || raw.length === 0) return;

            const removed = raw.map((id) => String(id));
            const removeSet = new Set(removed);
            const myId = String(user?.id ?? '');
            const iWasRemoved = myId && removed.some((id) => id === myId);

            if (iWasRemoved) {
                try {
                    SocketService.getInstance().leaveConversation(conversationId);
                } catch {
                    /* noop */
                }
                setShowInfo(false);
                setDesktopInfoOpen(false);
                setSelectedChat((prev) => (prev?.id === conversationId ? null : prev));
                setMuteStates((prev) => {
                    const next = { ...prev };
                    delete next[conversationId];
                    return next;
                });
                setPinnedStates((prev) => {
                    const next = { ...prev };
                    delete next[conversationId];
                    return next;
                });
                setConversationReloadSignal((prev) => prev + 1);
                return;
            }

            // Người khác tự rời / bị kick — gỡ khỏi participantIds + participantInfo (header, GroupInfo realtime)
            setSelectedChat((prev) => {
                if (!prev || prev.id !== conversationId) return prev;
                const nextIds = (prev.participantIds ?? []).filter((id) => !removeSet.has(String(id)));
                const nextInfo = (prev.participantInfo ?? []).filter((p) => !removeSet.has(String(p.id)));
                return {
                    ...prev,
                    participantIds: nextIds,
                    participantInfo: nextInfo,
                };
            });
            setConversationReloadSignal((prev) => prev + 1);
        };

        /** Chỉ gửi tới phòng thông báo của người bị kick — đóng chat ngay kể cả không còn trong phòng hội thoại */
        const handleKickedFromGroup = (data: { conversationId?: string }) => {
            const conversationId = String(data?.conversationId ?? '');
            if (!conversationId) return;
            try {
                SocketService.getInstance().leaveConversation(conversationId);
            } catch {
                /* noop */
            }
            setShowInfo(false);
            setDesktopInfoOpen(false);
            setSelectedChat((prev) => (prev?.id === conversationId ? null : prev));
            setMuteStates((prev) => {
                const next = { ...prev };
                delete next[conversationId];
                return next;
            });
            setPinnedStates((prev) => {
                const next = { ...prev };
                delete next[conversationId];
                return next;
            });
            setConversationReloadSignal((prev) => prev + 1);
        };

        socketService.onConversationRenamed(handleConversationRenamed);
        socketService.onConversationUpdated(handleConversationUpdated);
        socketService.onConversationDeleted(handleConversationDeleted);
        socketService.onParticipantsRemoved(handleParticipantsRemoved);
        socketService.onGroupKickedFrom(handleKickedFromGroup);
        return () => {
            socketService.removeConversationRenamedListener(handleConversationRenamed);
            socketService.removeConversationUpdatedListener(handleConversationUpdated);
            socketService.removeConversationDeletedListener(handleConversationDeleted);
            socketService.removeParticipantsRemovedListener(handleParticipantsRemoved);
            socketService.removeGroupKickedFromListener(handleKickedFromGroup);
        };
    }, [user?.id]);

    // Ẩn tab bar VÀ header khi đang chat (mobile)
    useEffect(() => {
        if (!isDesktop && (selectedChat || showBotChat)) {
            hideTabBar();
            hideHeader();
            return () => {
                showTabBar();
                showHeader();
            };
        }
    }, [selectedChat, showBotChat, isDesktop]);

    useEffect(() => {
        if (String(searchParams.createdGroup) !== '1') return;
        setGroupCreatedToast({ visible: true, message: t('chat.groupCreated') });
        router.setParams({ createdGroup: undefined } as Record<string, undefined>);
    }, [searchParams.createdGroup, router]);

    // Khi bấm "Nhắn tin" từ Contacts/FriendRequests, truyền conversationId qua query
    // để main tự set đúng chat đang focus.
    useEffect(() => {
        const conversationId = String(searchParams.conversationId ?? '').trim();
        if (!conversationId) return;
        if (!user?.id) return;

        // Nếu đã đang focus đúng chat thì bỏ qua.
        if (selectedChat?.id && String(selectedChat.id) === conversationId) {
            router.setParams({ conversationId: undefined } as Record<string, undefined>);
            return;
        }

        void ConversationService.getConversationById(conversationId, user.id)
            .then((res: any) => {
                if (res?.success && res?.conversation) {
                    setSelectedChat(res.conversation);
                }
            })
            .catch(() => {})
            .finally(() => {
                // Dọn query để tránh trigger lại khi re-render
                router.setParams({ conversationId: undefined } as Record<string, undefined>);
            });
    }, [searchParams.conversationId, router, user?.id]);

    useEffect(() => {
        const socketService = SocketService.getInstance();
        const handleNewConversation = () => setConversationReloadSignal((prev) => prev + 1);
        socketService.onNewConversation(handleNewConversation);
        return () => {
            socketService.removeNewConversationListener(handleNewConversation);
        };
    }, []);

    useEffect(() => {
        const socketService = SocketService.getInstance();

        const handleGroupSettingsUpdated = (payload: any) => {
            const conversationId = String(payload?.conversationId ?? '').trim();
            if (!conversationId) return;

            const fromSettings =
                payload?.settings && typeof payload.settings === 'object'
                    ? payload.settings
                    : {};
            const nextSettings: Record<string, unknown> = {
                ...fromSettings,
            };

            if (
                typeof payload?.isAllowMessaging === 'boolean' &&
                typeof nextSettings.isAllowMessaging !== 'boolean'
            ) {
                nextSettings.isAllowMessaging = payload.isAllowMessaging;
            }

            if (Object.keys(nextSettings).length === 0) return;

            setSelectedChat((prev) => {
                if (!prev || String(prev.id) !== conversationId) return prev;
                return {
                    ...prev,
                    settings: {
                        ...(prev.settings || {}),
                        ...nextSettings,
                    },
                };
            });
        };

        socketService.onGroupSettingsUpdated(handleGroupSettingsUpdated);
        return () => {
            socketService.removeGroupSettingsUpdatedListener(handleGroupSettingsUpdated);
        };
    }, []);

    return (
        <>
            {isDesktop ? (
                <View className="flex-1 flex-row bg-white p-4 gap-3">
                    <View
                        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                        style={{
                            width: desktopInfoOpen ? 260 : 310,
                            minWidth: desktopInfoOpen ? 240 : 280,
                        }}
                    >
                        <Conversations
                            selectedChat={selectedChat}
                            onSelectChat={(chat) => {
                                setSelectedChat(chat);
                                setShowBotChat(false);
                            }}
                            externalMuteStates={muteStates}
                            externalPinnedStates={pinnedStates}
                            onMuteChange={handleMuteChange}
                            reloadSignal={conversationReloadSignal}
                            onOpenBotChat={() => {
                                setShowBotChat(true);
                                setSelectedChat(null);
                                setDesktopInfoOpen(false);
                            }}
                            botChatActive={showBotChat}
                        />
                    </View>

                    <View className="flex-1 bg-white rounded-[28px] border border-gray-200 shadow-sm overflow-hidden">
                        {showBotChat ? (
                            <ZalaBotChatbox />
                        ) : (
                            <ChatArea
                                selectedChat={selectedChat}
                                onInfoPress={handleInfoPress}
                                onRemovedFromConversation={handleDeleteChat}
                                onConversationMetaChanged={() =>
                                    setConversationReloadSignal((prev) => prev + 1)
                                }
                                messagesRefreshKey={messagesRefreshKey}
                                initialScrollMessageId={pendingMessageId || undefined}
                                onInitialScrollDone={() => setPendingMessageId(null)}
                            />
                        )}
                    </View>

                    {!desktopInfoOpen && (
                        <View className="w-12 rounded-2xl border border-gray-200 bg-white shadow-sm items-center justify-start py-3">
                            <TouchableOpacity
                                onPress={() => setDesktopInfoOpen(true)}
                                className="w-8 h-8 rounded-lg items-center justify-center bg-gray-100"
                                accessibilityLabel="Open info panel"
                            >
                                <Ionicons name="menu-outline" size={20} color="#6d28d9" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {desktopInfoOpen && selectedChat && (
                        <View className="flex-1 min-w-[280px] max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <Info
                                selectedChat={selectedChat}
                                onMuteChange={handleMuteChange}
                                onDeleteChat={handleDeleteChat}
                                onHistoryCleared={handleHistoryCleared}
                                onHideChat={handleHideChat}
                                onUnhideChat={handleUnhideChat}
                                onPinChange={handlePinChange}
                                onActionCompleted={handleInfoActionCompleted}
                                onConversationMetaChanged={syncSelectedConversationFromServer}
                            />
                        </View>
                    )}
                </View>
            ) : (
                <View className="flex-1 bg-white">
                    {!selectedChat && !showBotChat && (
                        <View className="flex-1" style={{ flex: 1, minHeight: 0 }}>
                            <View className="h-8" />
                            <View style={{ flex: 1, minHeight: 0 }}>
                                <Conversations
                                    selectedChat={selectedChat}
                                    onSelectChat={(chat) => {
                                        setSelectedChat(chat);
                                        setShowBotChat(false);
                                    }}
                                    externalMuteStates={muteStates}
                                    externalPinnedStates={pinnedStates}
                                    onMuteChange={handleMuteChange}
                                    reloadSignal={conversationReloadSignal}
                                    onOpenBotChat={() => {
                                        setShowBotChat(true);
                                        setSelectedChat(null);
                                    }}
                                    botChatActive={showBotChat}
                                />
                            </View>
                        </View>
                    )}

                    {(selectedChat || showBotChat) && !showInfo && (
                        <View className="flex-1">
                            {showBotChat ? (
                                <ZalaBotChatbox onBackPress={() => setShowBotChat(false)} />
                            ) : (
                                <ChatArea
                                    selectedChat={selectedChat}
                                    onBackPress={handleBackPress}
                                    onInfoPress={handleInfoPress}
                                    onRemovedFromConversation={handleDeleteChat}
                                    onConversationMetaChanged={() => {
                                        setConversationReloadSignal((prev) => prev + 1);
                                    }}
                                    messagesRefreshKey={messagesRefreshKey}
                                    initialScrollMessageId={pendingMessageId || undefined}
                                    onInitialScrollDone={() => setPendingMessageId(null)}
                                />
                            )}
                        </View>
                    )}

                    {selectedChat && showInfo && (
                        <View className="flex-1">
                            <Info
                                selectedChat={selectedChat}
                                onBackPress={handleBackPress}
                                onMuteChange={handleMuteChange}
                                onDeleteChat={handleDeleteChat}
                                onHistoryCleared={handleHistoryCleared}
                                onHideChat={handleHideChat}
                                onUnhideChat={handleUnhideChat}
                                onPinChange={handlePinChange}
                                onActionCompleted={handleInfoActionCompleted}
                                onConversationMetaChanged={syncSelectedConversationFromServer}
                            />
                        </View>
                    )}
                </View>
            )}

            <CreateGroup
                visible={showCreateGroupModal}
                onClose={() => setShowCreateGroupModal(false)}
                initialSelectedIds={initialSelectedIds}
                initialGroupName={initialGroupName}
                onCreated={() => {
                    setShowCreateGroupModal(false);
                    setConversationReloadSignal((prev) => prev + 1);
                    setGroupCreatedToast({ visible: true, message: t('chat.groupCreated') });
                }}
            />
            <Toast
                visible={groupCreatedToast.visible}
                message={groupCreatedToast.message}
                type="success"
                onHide={() => setGroupCreatedToast((t) => ({ ...t, visible: false }))}
            />
        </>
    );
}
