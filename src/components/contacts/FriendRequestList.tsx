import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { friendshipService as FriendRequestService } from '@/src/api/services/friendship.service';
import { userService as UserService } from '@/src/api/services/user.service';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import FriendRequest from '@/src/models/FriendRequest';
import { useUser } from '@/src/contexts/user/UserContext';
import SocketService from '@/src/api/socketCompat';
import { useRouter } from 'expo-router';

export default function FriendRequestList() {
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const { user } = useUser();
    const [friendAccepted, setFriendAccepted] = useState<FriendRequest[]>([]);
    const [friendSent, setFriendSent] = useState<FriendRequest[]>([]);
    const [senderNames, setSenderNames] = useState<Record<string, string>>({});
    const [senderAvatars, setSenderAvatars] = useState<Record<string, string>>({});
    const [startingChatUserId, setStartingChatUserId] = useState<string | null>(null);
    const router = useRouter();

    // Fetch sender info
    useEffect(() => {
        const fetchSenderInfo = async () => {
            const uniqueSenderIds = new Set<string>();
            requests.forEach(request => uniqueSenderIds.add(request.senderId));
            friendAccepted.forEach(request => uniqueSenderIds.add(request.senderId));
            friendSent.forEach(request => uniqueSenderIds.add(request.senderId));

            for (const senderId of uniqueSenderIds) {
                if (!senderNames[senderId] || !senderAvatars[senderId]) {
                    try {
                        const response = await UserService.getUserById(senderId);
                        if (response.success && response.user) {
                            setSenderNames(prev => ({
                                ...prev,
                                [senderId]: response.user?.name || 'Unknown'
                            }));
                            setSenderAvatars(prev => ({
                                ...prev,
                                [senderId]: response.user?.avatarURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(response.user?.name || 'User')}&background=0068FF&color=fff`
                            }));
                        }
                    } catch (error) {
                        console.error('Error fetching user:', error);
                    }
                }
            }
        };

        fetchSenderInfo();
    }, [requests, friendAccepted, friendSent]);

    useEffect(() => {
        loadFriendRequests();
        // Set up socket listeners
        const socketService = SocketService.getInstance();
        
        // Listen for new friend requests
        const handleNewFriendRequest = () => {
            void loadFriendRequests();
        };

        const handleDeleteFriendRequest = () => {
            void loadFriendRequests();
        };

        const handleAcceptedFriendRequest = () => {
            void loadFriendRequests();
        };

        socketService.onFriendRequest(handleNewFriendRequest);
        socketService.onDeleteFriendRequest(handleDeleteFriendRequest);
        socketService.onFriendRequestAccepted(handleAcceptedFriendRequest);
        
        // Cleanup socket listeners
        return () => {
            socketService.removeFriendRequestListener(handleNewFriendRequest);
            socketService.removeFriendRequestActionListener(handleDeleteFriendRequest);
            socketService.removeFriendRequestAcceptedListener(handleAcceptedFriendRequest);
        };
    }, [user]);

    const loadFriendRequests = async () => {
        try {
            setLoading(true);
            if (!user) {
                setError('Không tìm thấy thông tin người dùng');
                return;
            }

            const response = await FriendRequestService.getAllPendingFriendRequests(user.id || "");
            console.log(" Day la danh sach lời mời kết bạn", response);
            const responseAccepted = await FriendRequestService.getAllAcceptedFriendRequests(user?.id || "");
            const responseSent = await FriendRequestService.getAllPendingFriendRequestsBySenderId();
            if (response.success && responseAccepted.success && responseSent.success) {
                setRequests(response.friendRequests);
                setFriendAccepted(responseAccepted.friendRequests);
                setFriendSent(responseSent.friendRequests);
            } else {
                setError(response.message);
            }
        } catch (err) {
            setError('Lỗi khi tải danh sách lời mời kết bạn');
            console.error('Lỗi khi tải danh sách lời mời kết bạn:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        //reset
        setSearchResults([]);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            setIsSearching(true);
            const response = await UserService.getUserByPhone(query);
            console.log(response);
            if (response.success && response.users && response.users.length > 0) {
                const results = response.users.map(user => ({
                    id: user.id,
                    name: user.name,
                    phone: user.phone,
                    avatar: user.avatarURL === "default" ? 
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0068FF&color=fff` 
                        : user.avatarURL
                }));
                setSearchResults(results);
                // Tải lại danh sách yêu cầu kết bạn để cập nhật trạng thái nút
                await loadFriendRequests();
            } else {
                setSearchResults([]);
                Alert.alert('Thông báo', 'Không tìm thấy người dùng');
            }
        } catch (err) {
            Alert.alert('Lỗi', 'Không thể tìm kiếm người dùng');
            console.error('Lỗi khi tìm kiếm:', err);
        } finally {
            setIsSearching(false);
        }
    };

    // Gửi lời mời kết bạn
    const handleSendFriendRequest = async (receiverId: string) => {
        try {
            if (!user) {
                console.log('Không tìm thấy thông tin người dùng');
                return;
            }

            const newRequest = {
                senderId: user.id || '',
                receiverId: receiverId
            };

            const response = await FriendRequestService.createFriendRequest(newRequest);
            if (response.success && response.friendRequest) {
                // Tạo đối tượng FriendRequest từ response
                const friendRequest: FriendRequest = {
                    id: response.friendRequest._doc.id,
                    senderId: response.friendRequest._doc.senderId,
                    receiverId: response.friendRequest._doc.receiverId,
                    status: response.friendRequest._doc.status,
                    createAt: response.friendRequest._doc.createAt,
                    updateAt: response.friendRequest._doc.updateAt
                };
                
                // Cập nhật UI
                setFriendSent(prev => [...prev, friendRequest]);
            } else {
                console.log('Không thể gửi lời mời kết bạn');
            }

            console.log('Đã gửi lời mời kết bạn');
            setSearchQuery('');
            setSearchResults([]);
        } catch (err) {
            console.log('Lỗi khi gửi lời mời kết bạn:', err);
        }
    };

    // Từ chối lời mời kết bạn
    const handleDeclineRequest = async (requestId: string) => {
        try {
            const response = await FriendRequestService.declineFriendRequest(requestId);
            if (response.success) {
                console.log('Đã từ chối lời mời kết bạn');
                loadFriendRequests();
            } else {
                console.log('Không thể từ chối lời mời kết bạn');
            }
        } catch (err) {
            console.log('Lỗi khi từ chối lời mời kết bạn:', err);
        }
    };

    // Chấp nhận lời mời kết bạn
    const handleAcceptRequest = async (requestId: string) => {
        await loadFriendRequests();
        try {
            const response = await FriendRequestService.acceptFriendRequest(requestId);
            if (response.success) {
                console.log('Đã chấp nhận mời kết bạn');
                loadFriendRequests(); // Reload the list
            } else {
                console.log('Không thể chấp nhận lời mời kết bạn');
            }
        } catch (err) {
            console.log('Lỗi khi chấp nhận lời mời kết bạn:', err);
        }
    };

    // Hủy lời mời kết bạn
    const handleCancelRequest = async (requestId: string, receiverId: string) => {
        try {
            const response = await FriendRequestService.deleteFriendRequest(requestId);
            if (response.success) {
                loadFriendRequests();
            } else {
                console.log('Không thể hủy lời mời kết bạn');
            }
        } catch (err) {
            console.log('Lỗi khi hủy lời mời kết bạn:', err);
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
                    Alert.alert('Không thể nhắn tin', 'Người này đang tắt nhận tin nhắn từ người lạ.');
                    return;
                }
            } catch (privacyError) {
                // Fallback: nếu API privacy lỗi thì vẫn thử mở/tạo chat.
                console.warn('Privacy check failed, continue create chat:', privacyError);
            }
            await ConversationService.createPrivate(user.id, targetUserId);
            router.replace('/');
        } catch (err) {
            console.error('Lỗi khi bắt đầu cuộc trò chuyện:', err);
            Alert.alert('Lỗi', 'Không thể bắt đầu cuộc trò chuyện');
        } finally {
            setStartingChatUserId(null);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#0068FF" />
                <Text className="mt-2 text-gray-500">Đang tải...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View className="flex-1 items-center justify-center p-4">
                <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                <Text className="text-red-500 mt-2 text-center">{error}</Text>
                <TouchableOpacity
                    className="mt-4 bg-blue-500 px-4 py-2 rounded-full"
                    onPress={loadFriendRequests}
                >
                    <Text className="text-white font-medium">Thử lại</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1">
            {/* Search Section */}
            <View className="p-4 border-b border-gray-200">
                <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
                    <Ionicons name="search" size={20} color="#666" />
                    <TextInput
                        className="flex-1 ml-2 text-base text-gray-800"
                        placeholder="Tìm kiếm theo số điện thoại..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        keyboardType="phone-pad"
                    />
                    {isSearching && (
                        <ActivityIndicator size="small" color="#0068FF" />
                    )}
                </View>
            </View>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <View className="border-b border-gray-200">
                    <Text className="px-4 py-2 text-sm font-semibold text-gray-500">Kết quả tìm kiếm</Text>
                    {searchResults.map((result) => {
                        // Xem có phải là bạn bè không
                        const isFriend = friendAccepted.some(
                            request => request.senderId === result.id || request.receiverId === result.id
                        );
                        // Kiểm tra xem có yêu cầu kết bạn đã gửi không
                        const pendingRequestSent = friendSent.find(
                            request => request.receiverId === result.id
                        );
                        // Kiểm tra xem có yêu cầu kết bạn đã nhận không
                        const pendingRequestReceived = requests.find(
                            request => request.senderId === result.id
                        );
                        // Kiểm tra xem đã bị từ chối chưa
                        const isDeclined = friendSent.some(
                            request => request.receiverId === result.id && request.status === "declined"
                        );

                        if (result.id !== user?.id) {
                            return (
                                <View
                                    key={`search-result-${result.id}`}
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                                >
                                    <Image
                                        key={`search-image-${result.id}`}
                                        source={{ uri: result.avatar }}
                                        className="w-12 h-12 rounded-full"
                                    />
                                    <View key={`search-info-${result.id}`} style={{ flex: 1, marginLeft: 12 }}>
                                        <Text className="font-medium text-gray-900">
                                            {result.name}
                                        </Text>
                                        <Text className="text-sm text-gray-500">
                                            {result.phone}
                                        </Text>
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
                                                    {isFriend ? 'Bạn bè' : 'Người lạ'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    {isFriend ? (
                                        <View key={`search-friend-${result.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}>
                                                <Text style={{ color: '#374151', fontWeight: '500' }}>Bạn bè</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={{ backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                onPress={() => handleStartChat(result.id)}
                                                disabled={startingChatUserId === result.id}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '500' }}>
                                                    {startingChatUserId === result.id ? 'Đang...' : 'Nhắn tin'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : pendingRequestSent ? (
                                        pendingRequestSent.status === "declined" ? (
                                            <View key={`search-declined-${result.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}>
                                                    <Text style={{ color: '#dc2626', fontWeight: '500' }}>Đã từ chối</Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                    onPress={() => handleStartChat(result.id)}
                                                    disabled={startingChatUserId === result.id}
                                                >
                                                    <Text style={{ color: '#fff', fontWeight: '500' }}>
                                                        {startingChatUserId === result.id ? 'Đang...' : 'Nhắn tin'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                <TouchableOpacity
                                                    key={`search-cancel-${result.id}`}
                                                    style={{ backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                    onPress={() => handleCancelRequest(pendingRequestSent.id, result.id)}
                                                >
                                                    <Text style={{ color: '#fff', fontWeight: '500' }}>Hủy KB</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                    onPress={() => handleStartChat(result.id)}
                                                    disabled={startingChatUserId === result.id}
                                                >
                                                    <Text style={{ color: '#fff', fontWeight: '500' }}>
                                                        {startingChatUserId === result.id ? 'Đang...' : 'Nhắn tin'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        )
                                    ) : pendingRequestReceived ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <TouchableOpacity
                                                key={`search-accept-${result.id}`}
                                                style={{ backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                onPress={() => handleAcceptRequest(pendingRequestReceived.id)}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '500' }}>Đồng ý</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                key={`search-decline-${result.id}`}
                                                style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                onPress={() => handleDeclineRequest(pendingRequestReceived.id)}
                                            >
                                                <Text style={{ color: '#374151', fontWeight: '500' }}>Từ chối</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={{ backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                onPress={() => handleStartChat(result.id)}
                                                disabled={startingChatUserId === result.id}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '500' }}>
                                                    {startingChatUserId === result.id ? 'Đang...' : 'Nhắn tin'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <TouchableOpacity
                                                key={`search-add-${result.id}`}
                                                style={{ backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                onPress={() => handleSendFriendRequest(result.id)}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '500' }}>Kết bạn</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={{ backgroundColor: '#6366f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 }}
                                                onPress={() => handleStartChat(result.id)}
                                                disabled={startingChatUserId === result.id}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: '500' }}>
                                                    {startingChatUserId === result.id ? 'Đang...' : 'Nhắn tin'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        }
                        return null;
                    })}
                </View>
            )}

            {/* Friend Requests List */}
            <ScrollView className="flex-1">
                <Text className="px-4 py-2 text-sm font-semibold text-gray-500">Lời mời kết bạn</Text>
                {requests.length === 0 ? (
                    <View key="no-requests" className="items-center justify-center p-4">
                        <Ionicons name="people-outline" size={48} color="#666" />
                        <Text className="text-gray-500 mt-2">Không có lời mời kết bạn nào</Text>
                    </View>
                ) : (
                    requests.map((request) => (
                        <View
                            key={`request-${request.id}`}
                            className="flex-row items-center p-4 border-b border-gray-100"
                        >
                            <Image
                                key={`request-image-${request.id}`}
                                source={{ uri: senderAvatars[request.senderId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderNames[request.senderId] || 'User')}&background=0068FF&color=fff` }}
                                className="w-12 h-12 rounded-full"
                                onError={(e) => {
                                    console.log('Avatar load error:', e.nativeEvent.error);
                                    // Fallback to ui-avatars if the original avatar fails to load
                                    const fallbackURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderNames[request.senderId] || 'User')}&background=0068FF&color=fff`;
                                    if (senderAvatars[request.senderId] !== fallbackURL) {
                                        setSenderAvatars(prev => ({
                                            ...prev,
                                            [request.senderId]: fallbackURL
                                        }));
                                    }
                                }}
                            />
                            <View key={`request-info-${request.id}`} className="flex-1 ml-3">
                                <Text className="font-medium text-gray-900">
                                    {senderNames[request.senderId] || 'Loading...'}
                                </Text>
                                <Text className="text-sm text-gray-500">
                                    {new Date(request.createAt).toLocaleString()}
                                </Text>
                            </View>
                            <View key={`request-actions-${request.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {request.status !== "declined" ? (
                                    <>
                                        <TouchableOpacity
                                            key={`request-accept-${request.id}`}
                                            style={{ backgroundColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}
                                            onPress={() => handleAcceptRequest(request.id)}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '500' }}>Đồng ý</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            key={`request-decline-${request.id}`}
                                            style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}
                                            onPress={() => handleDeclineRequest(request.id)}
                                        >
                                            <Text style={{ color: '#374151', fontWeight: '500' }}>Từ chối</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            key={`request-chat-${request.id}`}
                                            style={{ backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}
                                            onPress={() => handleStartChat(request.senderId)}
                                            disabled={startingChatUserId === request.senderId}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '500' }}>
                                                {startingChatUserId === request.senderId ? 'Đang...' : 'Nhắn tin'}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
                                            <Text style={{ color: '#dc2626', fontWeight: '500' }}>Đã từ chối</Text>
                                        </View>
                                        <TouchableOpacity
                                            key={`request-chat-declined-${request.id}`}
                                            style={{ backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}
                                            onPress={() => handleStartChat(request.senderId)}
                                            disabled={startingChatUserId === request.senderId}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '500' }}>
                                                {startingChatUserId === request.senderId ? 'Đang...' : 'Nhắn tin'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
} 