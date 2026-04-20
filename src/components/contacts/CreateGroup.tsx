import React, { useEffect, useState, useRef, useMemo } from 'react';
import ModalPortal from './ModalPortal';
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { friendshipService as FriendRequestService } from '@/src/api/services/friendship.service';
import { userService as UserService } from '@/src/api/services/user.service';
import { User } from '@/src/models/User';
import FriendRequest from '@/src/models/FriendRequest';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import { uploadLocalGroupAvatar } from '@/src/utils/groupAvatarUpload';
import { mapApiConversationToModel, unwrapData } from '@/src/models/mappers';
import Toast from '../ui/Toast';
import { useUser } from '@/src/contexts/user/UserContext';
import * as ImagePicker from 'expo-image-picker';
import SocketService from '@/src/api/socketCompat';

const extractApiErrorMessage = (error: unknown): string => {
    const fallback = 'Không thể tạo nhóm. Vui lòng thử lại.';
    const payload = (error as any)?.response?.data;
    if (!payload) return fallback;
    const firstDetail = Array.isArray(payload.errors) ? payload.errors[0]?.message : undefined;
    return firstDetail || payload.message || fallback;
};

interface CreateGroupProps {
    visible: boolean;
    onClose: () => void;
    initialSelectedIds?: string[];
    initialGroupName?: string;
    onCreated?: () => void;
}

export default function CreateGroup({ 
    visible, 
    onClose,
    initialSelectedIds = [],
    initialGroupName = '',
    onCreated,
}: CreateGroupProps) {
    const windowWidth = Dimensions.get('window').width; 
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [contacts, setContacts] = useState([] as User[]);
    const [friendRequests, setFriendRequests] = useState([] as FriendRequest[]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [selectedContactDetails, setSelectedContactDetails] = useState<Record<string, User>>({});
    const [groupAvatar, setGroupAvatar] = useState('');
    const [externalResults, setExternalResults] = useState<User[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [toast, setToast] = useState({
            visible: false,
            message: '',
            type: 'success' as 'success' | 'error' | 'warning' | 'info'
    });
    const [isCreating, setIsCreating] = useState(false);
    const { user } = useUser();
    const prevVisible = useRef(visible);

    const toggleContact = (contactId: string) => {
        setSelectedContacts(prev => {
            const isSelected = prev.includes(contactId);
            if (isSelected) {
                return prev.filter(id => id !== contactId);
            } else {
                // Nếu là người lạ (trong externalResults), lưu thông tin chi tiết để hiển thị avatar kịp thời
                const externalContact = externalResults.find(u => u.id === contactId);
                if (externalContact && !selectedContactDetails[contactId]) {
                    setSelectedContactDetails(prevDetails => ({
                        ...prevDetails,
                        [contactId]: externalContact
                    }));
                }
                return [...prev, contactId];
            }
        });
    };

    const pickImage = async () => {
        try {
            if (Platform.OS === 'web') {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (event: any) => {
                    const file = event.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            setGroupAvatar(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                    }
                };
                input.click();
            } else {
                Alert.alert(
                    'Chọn ảnh',
                    'Bạn có muốn chọn ảnh từ thư viện không?',
                    [
                        {
                            text: 'Không',
                            style: 'cancel',
                        },
                        {
                            text: 'Có',
                            onPress: async () => {
                                try {
                                    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

                                    if (!permissionResult.granted) {
                                        alert('Bạn cần cấp quyền truy cập thư viện ảnh để sử dụng tính năng này!');
                                        return;
                                    }

                                    const result = await ImagePicker.launchImageLibraryAsync({
                                        mediaTypes: ['images'] as any,
                                        allowsEditing: true,
                                        aspect: [1, 1],
                                        quality: 1,
                                    });

                                    if (!result.canceled) {
                                        console.log('Selected Image:', result.assets[0].uri);
                                        setGroupAvatar(result.assets[0].uri);
                                    }
                                } catch (error) {
                                    console.error('Error picking image:', error);
                                    alert('Đã xảy ra lỗi khi chọn ảnh. Vui lòng thử lại.');
                                }
                            },
                        },
                    ],
                    { cancelable: true }
                );
            }
        } catch (error) {
            console.error('Error picking image:', error);
            alert('Đã xảy ra lỗi khi chọn ảnh. Vui lòng thử lại.');
        }
    };

    useEffect(() => {
        if (visible && !prevVisible.current) {
            console.log('CreateGroup modal opened, initializing with:', { initialSelectedIds, initialGroupName });
            
            // Khởi tạo trạng thái
            setSelectedContacts([...initialSelectedIds]);
            setGroupName(initialGroupName || '');
            setGroupAvatar('');
            setSearchQuery('');
            setExternalResults([]);
            
            // Prefetch thông tin chi tiết cho các IDs đã chọn sẵn (Parallel)
            if (initialSelectedIds.length > 0) {
                Promise.all(initialSelectedIds.map(async (id) => {
                    if (!selectedContactDetails[id]) {
                        try {
                            const res = await UserService.getUserById(id);
                            if (res.success && res.user) {
                                setSelectedContactDetails(prev => ({ ...prev, [id]: res.user }));
                            }
                        } catch (err) {
                            console.error('Error prefetching user:', id, err);
                        }
                    }
                }));
            }
        }
        prevVisible.current = visible;
    }, [visible, initialSelectedIds, initialGroupName]);

    // Cleanup khi đóng modal (tùy chọn, ở đây ta chủ yếu reset khi mở)
    
    // Logic tìm kiếm với debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length >= 2) {
                setIsSearchingUsers(true);
                try {
                    // Sử dụng UserService.search (phiên bản legacy đã được map dữ liệu đúng)
                    const res = await UserService.search(searchQuery);
                    if (res.success && Array.isArray(res.users)) {
                        setExternalResults(res.users.filter(u => u.id !== user?.id));
                    }
                } catch (err) {
                    console.error('Search error:', err);
                } finally {
                    setIsSearchingUsers(false);
                }
            } else {
                setExternalResults([]);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, user?.id]);

    useEffect(() => {
        const fetchFriendRequests = async () => {
            try {
                const response = await FriendRequestService.getAllAcceptedFriendRequests("");
                setFriendRequests(response.friendRequests || []); 
            } catch (error) {
                setFriendRequests([]);
                console.error('Error fetching friend requests:', error);
            }
        };

        fetchFriendRequests();
    }, []);

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                const ids = [];
                for (const request of friendRequests) {
                    if (request.senderId !== user?.id) {
                        ids.push(request.senderId);
                    } else {
                        ids.push(request.receiverId);
                    }
                }
    
                const uniqueIds = Array.from(new Set(ids)); // Loại bỏ trùng lặp
                // Fetch song song (Parallel) thay vì sequential để tránh timeout
                const results = await Promise.all(uniqueIds.map(async (id) => {
                    try {
                        const response = await UserService.getUserById(id);
                        return response.success ? (response.user as User) : null;
                    } catch (error) {
                        console.error('Error fetching contact profile:', id, error);
                        return null;
                    }
                }));
                
                const contactsList = results.filter((u): u is User => u !== null);
                console.log('Fetched contacts:', contactsList.length);
                setContacts(contactsList);
            } catch (error) {
                setContacts([]);
                console.error('Error fetching contacts:', error);
            }
        };
    
        if (Array.isArray(friendRequests) && friendRequests.length > 0) {
            fetchContacts();
        }
    }, [friendRequests]);

    const handleCreateGroup = async () => {
        if (groupName.trim() === '' || selectedContacts.length === 0) {
            setToast({
                visible: true,
                message: 'Vui lòng nhập tên nhóm và chọn ít nhất 2 thành viên',
                type: 'error'
            });
            return;
        }
        if (selectedContacts.length < 1) { // Yêu cầu ít nhất 1 người khác + mình = 2 người (tối thiểu), nhưng thường nhóm là 3
             setToast({
                visible: true,
                message: 'Chọn ít nhất 2 thành viên khác',
                type: 'error'
            });
            return;
        }
        
        setIsCreating(true);
        try {
            const rawAvatar = (groupAvatar || '').trim();
            let avatarForApi: string | undefined;
            if (rawAvatar) {
                if (rawAvatar.startsWith('http://') || rawAvatar.startsWith('https://')) {
                    avatarForApi = rawAvatar;
                } else {
                    try {
                        avatarForApi = await uploadLocalGroupAvatar(rawAvatar);
                    } catch (uploadErr: any) {
                        const code = uploadErr?.code;
                        const msg = String(uploadErr?.message ?? '');
                        const isNetwork =
                            code === 'ERR_NETWORK' ||
                            msg.includes('Network Error') ||
                            msg.includes('Network request failed');
                        console.warn('[CreateGroup] Avatar upload failed:', uploadErr);
                        if (isNetwork) {
                            setToast({
                                visible: true,
                                message:
                                    'Không kết nối được máy chủ để tải ảnh (kiểm tra IP backend trên điện thoại). Tạo nhóm không ảnh đại diện.',
                                type: 'warning',
                            });
                        } else {
                            setToast({
                                visible: true,
                                message: 'Không tải được ảnh nhóm. Đang tạo nhóm không ảnh đại diện.',
                                type: 'warning',
                            });
                        }
                    }
                }
            }

            const res: any = await ConversationService.createGroup({
                name: groupName.trim(),
                memberIds: [...selectedContacts].filter((id) => id !== ''),
                ...(avatarForApi ? { avatarUrl: avatarForApi } : {}),
            });
            const conversation = mapApiConversationToModel(unwrapData<any>(res));
            const success = res?.success !== false && Boolean(conversation?.id);

            if (success) {
                const socketService = SocketService.getInstance();
                socketService.actionParticipantsAdded({
                    conversationId: conversation.id,
                    participantIds: conversation.participantIds,
                });
                
                if (onCreated) {
                    onCreated();
                } else {
                    onClose();
                }
            } else {
                setToast({
                    visible: true,
                    message: res?.message || "Tạo nhóm thất bại",
                    type: 'error'
                });
            }
        } catch (error) {
            console.error('Error creating group:', error);
            setToast({
                visible: true,
                message: extractApiErrorMessage(error),
                type: 'error'
            });
        } finally {
            setIsCreating(false);
        }
    };

    // Gộp danh sách hiển thị: Bạn bè (lọc local) + Kết quả tìm kiếm từ Server + Những người đã chọn
    const displayContacts = useMemo(() => {
        const localFilteredFriends = contacts.filter(c => 
            (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (c.phone || '').includes(searchQuery)
        );
        
        return Array.from(new Map([
            ...localFilteredFriends,
            ...externalResults,
            ...Object.values(selectedContactDetails)
        ].map(c => [c.id, c])).values());
    }, [contacts, externalResults, selectedContactDetails, searchQuery]);

    return (
        <ModalPortal
            visible={visible}
            onRequestClose={onClose}
            animationType="slide"
            transparent={true}
        >
            <View className={`flex-1 bg-black/30 items-center justify-center ${windowWidth > 768 ? '' : 'mt-12'}`}>
                <View className="w-full md:w-1/3 md:max-w-[90%] md:rounded-2xl md:max-h-[90%] h-full md:h-auto bg-white overflow-hidden">
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                        <Text className="text-lg font-semibold">Tạo nhóm</Text>
                        <TouchableOpacity 
                            className={`px-4 py-2 rounded-full ${selectedContacts.length > 0 && !isCreating ? 'bg-blue-500' : 'bg-gray-300'}`}
                            disabled={selectedContacts.length === 0 || isCreating}
                            onPress={handleCreateGroup}
                        >
                            {isCreating ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Text className="text-white font-medium">Tạo</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Group Info Section */}
                    <View className="px-4 py-4 border-b border-gray-200">
                        <View className="flex-row items-center">
                            {/* Avatar Selection */}
                            <TouchableOpacity className="relative" onPress={pickImage}>
                                <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center">
                                    {groupAvatar ? (
                                        <Image
                                            source={{ uri: groupAvatar }}
                                            resizeMode="cover"
                                            className="w-14 h-14 rounded-full"
                                        />
                                    ) : (
                                        <Ionicons name="camera" size={24} color="#666" />
                                    )}
                                </View>
                            </TouchableOpacity>
                            {/* Group Name Input */}
                            <View className="flex-1 ml-3">
                                <TextInput
                                    className="text-base border-b border-gray-200 pb-2"
                                    placeholder="Nhập tên nhóm..."
                                    value={groupName}
                                    onChangeText={setGroupName}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Search Bar */}
                    <View className="px-4 py-2 border-b border-gray-200">
                        <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-2">
                            <Ionicons name="search" size={20} color="#666" />
                            <TextInput
                                className="flex-1 ml-2 text-base"
                                placeholder="Nhập tên, số điện thoại..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#666"
                            />
                            {isSearchingUsers && <ActivityIndicator size="small" color="#0068ff" />}
                        </View>
                    </View>

                    {/* Selected Members Scroll (Thanh ngang hiển thị những người đã chọn) */}
                    {selectedContacts.length > 0 && (
                        <View className="py-2 border-b border-gray-100">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
                                {selectedContacts.map(id => {
                                    const contact = displayContacts.find(c => c.id === id);
                                    return (
                                        <View key={`selected-${id}`} className="mr-3 items-center">
                                            <View className="relative">
                                                <Image 
                                                    source={{ uri: contact?.avatarURL || 'https://placehold.co/400' }} 
                                                    className="w-10 h-10 rounded-full" 
                                                />
                                                <TouchableOpacity 
                                                    className="absolute -top-1 -right-1 bg-gray-400 rounded-full"
                                                    onPress={() => toggleContact(id)}
                                                >
                                                    <Ionicons name="close-circle" size={16} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Contacts List */}
                    <ScrollView className="flex-1">
                        {displayContacts.length === 0 && searchQuery ? (
                            <View className="p-10 items-center">
                                <Text className="text-gray-400 italic">Không tìm thấy người dùng</Text>
                            </View>
                        ) : (
                            displayContacts.map((contact, index) => (
                                <TouchableOpacity
                                    key={`${contact.id}-${index}`} 
                                    className="flex-row items-center px-4 py-3 border-b border-gray-100"
                                    onPress={() => toggleContact(contact.id)}
                                >
                                    <Image
                                        source={{ uri: contact.avatarURL || 'https://placehold.co/400' }}
                                        resizeMode="cover"
                                        className="w-12 h-12 rounded-full"
                                    />
                                    <View className="flex-1 ml-3">
                                        <Text className="text-base font-medium">{contact.name}</Text>
                                        {contact.phoneNumber && (
                                            <Text className="text-xs text-gray-500">{contact.phoneNumber}</Text>
                                        )}
                                    </View>
                                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selectedContacts.includes(contact.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-200'}`}>
                                        {selectedContacts.includes(contact.id) && (
                                            <Ionicons name="checkmark" size={16} color="white" />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </View>
            </View>
            <Toast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={() => setToast(prev => ({...prev, visible: false}))}
            />
        </ModalPortal>
    );
}