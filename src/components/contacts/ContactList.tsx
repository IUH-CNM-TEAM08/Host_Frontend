import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { friendshipService as FriendRequestService } from '@/src/api/services/friendship.service';
import FriendRequest from '@/src/models/FriendRequest';
import { AuthStorage } from '@/src/storage/AuthStorage';
import { useUser } from '@/src/contexts/user/UserContext';
import { userService as UserService } from '@/src/api/services/user.service';
import { User } from '@/src/models/User';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import { useRouter } from 'expo-router';
import SocketService from '@/src/api/socketCompat';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';

interface FriendInfo extends User {
    friendRequestDate: Date;
}

export default function ContactList() {
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [friends, setFriends] = useState<FriendInfo[]>([]);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);
    const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());
    const { user } = useUser();
    const router = useRouter();
    const { t } = useTranslation();

    useEffect(() => {
        loadFriendRequests();
    }, [user]);

    useEffect(() => {
        if (!user?.id) return;
        const socketService = SocketService.getInstance();
        const handleFriendshipChanged = () => {
            void loadFriendRequests();
        };
        socketService.onFriendRequest(handleFriendshipChanged);
        socketService.onFriendRequestAccepted(handleFriendshipChanged);
        socketService.onDeleteFriendRequest(handleFriendshipChanged);
        return () => {
            socketService.removeFriendRequestListener(handleFriendshipChanged);
            socketService.removeFriendRequestAcceptedListener(handleFriendshipChanged);
            socketService.removeFriendRequestActionListener(handleFriendshipChanged);
        };
    }, [user?.id]);

    const loadFriendRequests = async () => {
        try {
            setLoading(true);
            if (!user) {
                setError(t('contacts.userNotFoundId'));
                return;
            }

            const response = await FriendRequestService.getAllAcceptedFriendRequests(user.id || "");
            const outgoingRes = await FriendRequestService.getAllPendingFriendRequestsBySenderId();
            if (response.success) {
                setFriendRequests(response.friendRequests);
                if (outgoingRes.success) {
                    const pendingOutgoing = outgoingRes.friendRequests.filter(
                        (r) => String(r.status).toLowerCase() === 'pending'
                    );
                    setSentRequestIds(new Set(pendingOutgoing.map((r) => r.receiverId)));
                }
                // Tạo mảng tạm để lưu thông tin bạn bè
                const tempFriends: FriendInfo[] = [];
                for(const request of response.friendRequests) {
                    const friendId = request.senderId === user.id ? request.receiverId : request.senderId;
                    const friend = await UserService.getUserById(friendId);
                    if(friend.success && friend.user) {
                        tempFriends.push({
                            ...friend.user,
                            friendRequestDate: request.createAt
                        } as FriendInfo);
                    }
                }
                // Cập nhật state friends một lần duy nhất
                setFriends(tempFriends);
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError(t('contacts.loadFriendsError'));
            console.error('Lỗi khi tải danh sách bạn bè:', err);
        } finally {
            setLoading(false);
        }
    };

    

    console.log('friendRequests', friendRequests);
    const filteredFriends = friends.filter(friend =>
        friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (friend.phone || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSearchUsers = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            setIsSearching(true);
            const response = await UserService.getUserByPhone(query.trim());
            if (response.success) {
                setSearchResults((response.users || []).filter((u) => u.id !== user?.id));
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error('Lỗi khi tìm người dùng:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleStartChat = async (targetUserId: string) => {
        if (!user?.id) return;
        try {
            setStartingChatUserId(targetUserId);
            try {
                const privacyRes: any = await UserService.getMessageAllowed<any>(targetUserId);
                const payload = privacyRes?.data ?? privacyRes;
                if (payload?.allowed === false) {
                    Alert.alert(t('chat.cannotOpen'), t('chat.strangerMessageOff'));
                    return;
                }
            } catch (privacyError) {
                // Fallback: nếu API privacy lỗi thì vẫn cho mở/tạo đoạn chat để tránh "bấm không chạy".
                console.warn('Privacy check failed, continue create chat:', privacyError);
            }
            const createdRes: any = await ConversationService.createPrivate(user.id, targetUserId);
            const createdConv = createdRes?.data ?? createdRes?.conversation ?? createdRes;
            const conversationId = createdConv?._id ?? createdConv?.id ?? '';

            if (conversationId) {
                router.replace({
                    pathname: '/(main)',
                    params: { conversationId } as any,
                } as any);
            } else {
                router.replace('/');
            }
        } catch (err) {
            console.error('Lỗi khi bắt đầu cuộc trò chuyện:', err);
            Alert.alert(t('common.error'), t('chat.cannotOpen'));
        } finally {
            setStartingChatUserId(null);
        }
    };

    const handleSendFriendRequest = async (receiverId: string) => {
        try {
            if (!user?.id) return;
            const response = await FriendRequestService.createFriendRequest({
                senderId: user.id,
                receiverId,
            });
            if (response.success) {
                setSentRequestIds(prev => new Set(prev).add(receiverId));
            } else {
                Alert.alert(t('common.error'), response.message || t('contacts.cannotSendRequest'));
            }
        } catch (err: any) {
            console.error('Lỗi khi gửi lời mời kết bạn:', err);
            const msg = err?.response?.data?.message || t('contacts.cannotSendRequest');
            Alert.alert(t('common.error'), msg);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <Text>{t('common.loading')}</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View className="flex-1 justify-center items-center">
                <Text className="text-red-500">{error}</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            {/* Search Bar */}
            <View className="px-4 py-2 border-b border-gray-200">
                <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
                    <Ionicons name="search" size={20} color="#666" />
                    <TextInput
                        className="flex-1 ml-2 text-base text-gray-800"
                        placeholder={t('contacts.search') + '...'}
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={handleSearchUsers}
                    />
                    {isSearching && (
                        <ActivityIndicator size="small" color="#0068FF" />
                    )}
                </View>
            </View>

            {searchQuery.trim().length >= 2 && (
                <View className="border-b border-gray-200">
                    <Text className="px-4 py-2 text-sm font-semibold text-gray-500">{t('contacts.search')}</Text>
                    {searchResults.length === 0 ? (
                        <View className="px-4 pb-3">
                            <Text className="text-sm text-gray-500">{t('contacts.noMatchingUsers')}</Text>
                        </View>
                    ) : (
                        searchResults.map((result) => {
                            const isFriend = friendRequests.some(
                                (request) =>
                                    request.senderId === result.id || request.receiverId === result.id
                            );
                            return (
                                <View
                                    key={`search-result-${result.id}`}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                                >
                                <Image
                                    source={{
                                        uri: result.avatarURL === "default"
                                            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name || 'User')}&background=0068FF&color=fff`
                                            : result.avatarURL
                                    }}
                                    className="w-12 h-12 rounded-full"
                                />
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text className="font-medium text-gray-900">{result.name}</Text>
                                    <Text className="text-sm text-gray-500">{result.phone || ''}</Text>
                                    <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                                        <View
                                            style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 2,
                                                borderRadius: 999,
                                                backgroundColor: isFriend ? '#d1fae5' : '#e2e8f0',
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: '600',
                                                    color: isFriend ? '#047857' : '#475569',
                                                }}
                                            >
                                                {isFriend ? t('contacts.alreadyFriend') : t('contacts.searchResult')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {isFriend ? (
                                        <View style={{ backgroundColor: '#d1fae5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                                            <Text style={{ color: '#047857', fontWeight: '500', fontSize: 13 }}>{t('contacts.alreadyFriend')}</Text>
                                        </View>
                                    ) : sentRequestIds.has(result.id) ? (
                                        <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                                            <Text style={{ color: '#4338ca', fontWeight: '500', fontSize: 13 }}>{t('contacts.requestSent')}</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={{ backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                            onPress={() => handleSendFriendRequest(result.id)}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '500' }}>{t('contacts.addFriend')}</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={{ backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                        onPress={() => handleStartChat(result.id)}
                                        disabled={startingChatUserId === result.id}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: '500' }}>
                                            {startingChatUserId === result.id ? t('common.loading') : t('contacts.sendMessage')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            );
                        })
                    )}
                </View>
            )}

            {/* Friend List */}
            <ScrollView className="flex-1">
                {filteredFriends.length === 0 ? (
                    <View className="flex-1 justify-center items-center p-4">
                        <Ionicons name="people-outline" size={48} color="#666" />
                        <Text className="text-gray-500 mt-2">{t('contacts.noFriendsFound')}</Text>
                    </View>
                ) : (
                    filteredFriends.map((friend) => (
                        <View key={friend.id} className="border-b border-gray-100">
                            <View className="flex-row items-center px-4 py-3">
                                <Image
                                    source={{ 
                                        uri: friend.avatarURL === "default" ? 
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.name)}&background=0068FF&color=fff` 
                                            : friend.avatarURL
                                    }}
                                    className="w-12 h-12 rounded-full"
                                />
                                <View className="flex-1 ml-3">
                                    <Text className="text-base font-medium text-gray-800">
                                        {friend.name}
                                    </Text>
                                    <Text className="text-sm text-gray-500">
                                        {friend.phone}
                                    </Text>
                                    <Text className="text-xs text-gray-400">
                                        {friend.email}
                                    </Text>
                                    <Text className="text-xs text-gray-400 mt-1">
                                        {t('contacts.friendSince')}: {new Date(friend.friendRequestDate).toLocaleDateString('vi-VN')}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, flexShrink: 0 }}
                                    onPress={() => handleStartChat(friend.id)}
                                    disabled={startingChatUserId === friend.id}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '500' }}>
                                        {startingChatUserId === friend.id ? t('common.loading') : t('contacts.sendMessage')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
} 