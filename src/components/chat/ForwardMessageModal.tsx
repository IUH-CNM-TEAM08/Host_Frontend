import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/src/models/Message';
import { MessageType } from '@/src/models/Message';
import { conversationService } from '@/src/api/services/conversation.service';
import { Conversation } from '@/src/models/Conversation';
import { useUser } from '@/src/contexts/user/UserContext';
import { userService } from '@/src/api/services/user.service';

interface ForwardMessageModalProps {
    message?: Message;
    messages?: Message[];
    onClose: () => void;
    onForward: (selectedConversations: string[]) => void;
}

type ParticipantProfile = {
    name?: string;
    avatar?: string;
};

const DEFAULT_PRIVATE_NAME = 'Người dùng';

const getLastMessagePreviewLabel = (conversation: Conversation): string => {
    const lm = conversation.lastMessage;
    if (!lm) return 'Chưa có tin nhắn';
    if (lm.isDeletedForEveryone) return 'Tin nhắn đã được thu hồi';

    const text = String(lm.content ?? '').trim();
    if (text) return text;

    switch (lm.type) {
        case MessageType.IMAGE:
            return 'Ảnh';
        case MessageType.VIDEO:
            return 'Video';
        case MessageType.FILE:
            return 'Tệp đính kèm';
        case MessageType.AUDIO:
            return 'Ghi âm';
        case MessageType.CALL:
            return 'Cuộc gọi';
        case MessageType.VOTE:
            return 'Bình chọn';
        case MessageType.MEDIA_ALBUM:
            return 'Album ảnh/video';
        default:
            return 'Tin nhắn';
    }
};

const resolveConversationName = (
    conversation: Conversation,
    myUserId: string | undefined,
    participantProfiles: Record<string, ParticipantProfile>
): string => {
    if (!conversation.isGroup) {
        const me = conversation.participantInfo?.find((p) => p.id === myUserId);
        const myNickname = String(me?.nickname ?? '').trim();
        if (myNickname) return myNickname;

        const otherId = conversation.participantIds.find((id) => id !== myUserId);
        const other = conversation.participantInfo?.find((p) => p.id === otherId);
        const otherName = String(other?.name ?? '').trim();
        if (otherName) return otherName;

        const profileName = String(
            (otherId ? participantProfiles[otherId]?.name : '') ?? ''
        ).trim();
        if (profileName) return profileName;

        if (conversation.name && conversation.name !== DEFAULT_PRIVATE_NAME) {
            return conversation.name;
        }

        return DEFAULT_PRIVATE_NAME;
    }

    if (conversation.name) return conversation.name;

    if (conversation.isGroup) {
        const memberNames = conversation.participantIds
            .filter((id) => id !== myUserId)
            .map((id) => {
                const info = (conversation.participantInfo ?? []).find((p) => p.id === id);
                return String(info?.name ?? participantProfiles[id]?.name ?? '').trim();
            })
            .filter(Boolean)
            .slice(0, 2);
        if (memberNames.length > 0) return memberNames.join(', ');
        return 'Nhóm chat';
    }

    return DEFAULT_PRIVATE_NAME;
};

const resolveConversationAvatar = (
    conversation: Conversation,
    myUserId: string | undefined,
    displayName: string,
    participantProfiles: Record<string, ParticipantProfile>
): string => {
    if (conversation.isGroup) {
        if (conversation.avatarUrl) return conversation.avatarUrl;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'Group')}&background=0068FF&color=fff`;
    }

    const otherId = conversation.participantIds.find((id) => id !== myUserId);
    const other = conversation.participantInfo?.find((p) => p.id === otherId);
    const avatar =
        other?.avatar ||
        (otherId ? participantProfiles[otherId]?.avatar : undefined) ||
        conversation.avatarUrl;
    if (avatar) return avatar;

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || 'User')}&background=0068FF&color=fff`;
};

export default function ForwardMessageModal({ message, messages = [], onClose, onForward }: ForwardMessageModalProps) {
    const { user } = useUser();
    const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [participantProfiles, setParticipantProfiles] = useState<Record<string, ParticipantProfile>>({});
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [conversationsError, setConversationsError] = useState<string | null>(null);
    const resolvedMessages = messages.length > 0 ? messages : message ? [message] : [];

    useEffect(() => {
        let isMounted = true;

        const loadConversations = async () => {
            setLoadingConversations(true);
            try {
                const res = await conversationService.getConversations();
                if (!isMounted) return;

                if (res?.success === false) {
                    setConversations([]);
                    setConversationsError(res?.message || 'Không thể tải danh sách cuộc trò chuyện');
                    return;
                }

                const loadedConversations = Array.isArray(res?.conversations) ? res.conversations : [];
                setConversations(loadedConversations);

                const missingParticipantIds = new Set<string>();
                loadedConversations.forEach((conversation) => {
                    conversation.participantIds.forEach((participantId) => {
                        if (participantId === user?.id) return;
                        const info = conversation.participantInfo?.find((p) => p.id === participantId);
                        const hasName = Boolean(String(info?.name ?? '').trim());
                        const hasAvatar = Boolean(String(info?.avatar ?? '').trim());
                        if (!hasName || !hasAvatar) {
                            missingParticipantIds.add(participantId);
                        }
                    });
                });

                if (missingParticipantIds.size > 0) {
                    const profileEntries: Record<string, ParticipantProfile> = {};
                    await Promise.allSettled(
                        [...missingParticipantIds].map(async (participantId) => {
                            const userRes = await userService.getUserById(participantId);
                            if (!userRes?.success || !userRes?.user) return;

                            profileEntries[participantId] = {
                                name:
                                    userRes.user.name ||
                                    userRes.user.displayName ||
                                    undefined,
                                avatar:
                                    userRes.user.avatarURL ||
                                    userRes.user.avatarUrl ||
                                    undefined,
                            };
                        })
                    );

                    if (isMounted && Object.keys(profileEntries).length > 0) {
                        setParticipantProfiles((prev) => ({ ...prev, ...profileEntries }));
                    }
                }

                setConversationsError(null);
            } catch {
                if (!isMounted) return;
                setConversations([]);
                setConversationsError('Không thể tải danh sách cuộc trò chuyện');
            } finally {
                if (isMounted) setLoadingConversations(false);
            }
        };

        void loadConversations();
        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    const viewConversations = useMemo(
        () => conversations.filter((conversation) => Boolean(conversation?.id)),
        [conversations]
    );

    const toggleConversation = (conversationId: string) => {
        setSelectedConversations(prev => {
            if (prev.includes(conversationId)) {
                return prev.filter(id => id !== conversationId);
            } else {
                return [...prev, conversationId];
            }
        });
    };

    const modalCard = (
        <View
            className="bg-white rounded-2xl overflow-hidden shadow-lg"
            style={{ width: '92%', maxWidth: 560, maxHeight: '88%' }}
        >
                {/* Header */}
                <View className="p-4 border-b border-gray-200 flex-row items-center justify-between">
                    <Text className="text-lg font-semibold text-gray-900">Chuyển tiếp tin nhắn</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Tin nhắn được chọn */}
                <View className="p-4 border-b border-gray-200">
                    <View className="bg-gray-50 rounded-lg p-3">
                        <Text className="text-gray-800">
                            {resolvedMessages.length > 1
                                ? `${resolvedMessages.length} tin nhắn đã chọn`
                                : (resolvedMessages[0]?.content || "Tin nhắn")}
                        </Text>
                    </View>
                </View>

                {/* Danh sách cuộc trò chuyện */}
                <ScrollView className="max-h-[60vh]">
                    {loadingConversations ? (
                        <View className="p-4 items-center">
                            <ActivityIndicator size="small" color="#3B82F6" />
                            <Text className="text-gray-500 mt-2">Đang tải danh sách hội thoại...</Text>
                        </View>
                    ) : conversationsError ? (
                        <View className="p-4">
                            <Text className="text-red-500">{conversationsError}</Text>
                        </View>
                    ) : viewConversations.length === 0 ? (
                        <View className="p-4">
                            <Text className="text-gray-500">Chưa có cuộc trò chuyện để chuyển tiếp.</Text>
                        </View>
                    ) : (
                        viewConversations.map((conversation) => {
                            const displayName = resolveConversationName(
                                conversation,
                                user?.id,
                                participantProfiles
                            );
                            const avatar = resolveConversationAvatar(
                                conversation,
                                user?.id,
                                displayName,
                                participantProfiles
                            );
                            const preview = getLastMessagePreviewLabel(conversation);

                            return (
                                <TouchableOpacity
                                    key={conversation.id}
                                    className="flex-row items-center p-4 border-b border-gray-100"
                                    onPress={() => toggleConversation(conversation.id)}
                                >
                                    <View className="relative">
                                        <Image
                                            source={{ uri: avatar }}
                                            className="w-12 h-12 rounded-full"
                                        />
                                        {conversation.isGroup && (
                                            <View className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
                                                <Ionicons name="people" size={12} color="white" />
                                            </View>
                                        )}
                                    </View>
                                    <View className="ml-3 flex-1">
                                        <Text className="text-gray-900 font-medium">{displayName}</Text>
                                        <Text className="text-gray-500 text-sm" numberOfLines={1}>
                                            {preview}
                                        </Text>
                                    </View>
                                    <View
                                        className="w-6 h-6 rounded-full border-2 border-blue-500 items-center justify-center"
                                        style={{
                                            backgroundColor: selectedConversations.includes(conversation.id)
                                                ? '#3B82F6'
                                                : 'transparent',
                                        }}
                                    >
                                        {selectedConversations.includes(conversation.id) && (
                                            <Ionicons name="checkmark" size={16} color="white" />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>

                {/* Footer */}
                <View className="p-4 border-t border-gray-200 flex-row justify-between items-center">
                    <Text className="text-gray-500">
                        Đã chọn: {selectedConversations.length}
                    </Text>
                    <TouchableOpacity
                        className={`px-4 py-2 rounded-lg ${selectedConversations.length > 0 ? 'bg-blue-500' : 'bg-gray-200'}`}
                        onPress={() => onForward(selectedConversations)}
                        disabled={selectedConversations.length === 0}
                    >
                        <Text className={`font-medium ${selectedConversations.length > 0 ? 'text-white' : 'text-gray-500'}`}>
                            Chuyển tiếp
                        </Text>
                    </TouchableOpacity>
                </View>
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <Modal
                visible
                transparent
                animationType="fade"
                onRequestClose={onClose}
            >
                <View className="flex-1 bg-black/50 items-center justify-center px-4">
                    <TouchableOpacity
                        className="absolute inset-0"
                        activeOpacity={1}
                        onPress={onClose}
                    />
                    {modalCard}
                </View>
            </Modal>
        );
    }

    return (
        <View className="absolute inset-0 bg-black/50 items-center justify-center">
            {modalCard}
        </View>
    );
} 