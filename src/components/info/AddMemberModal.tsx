import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import { User } from '@/src/models/User';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import { Conversation } from '@/src/models/Conversation';
import { useUser } from '@/src/contexts/user/UserContext';
import { friendshipService as FriendRequestService } from '@/src/api/services/friendship.service';
import { userService as UserService } from '@/src/api/services/user.service';
import FriendRequest from '@/src/models/FriendRequest';
import SocketService from '@/src/api/socketCompat';
import GroupQRModal from './GroupQRModal';
import { Share, Alert, ActivityIndicator } from 'react-native';

interface AddMemberModalProps {
    visible: boolean;
    onClose: () => void;
    selectChat: Conversation | null;
}

export default function AddMemberModal ({ visible, onClose, selectChat}: AddMemberModalProps) {
    const isDesktop = useWindowDimensions().width >= 768;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const { user } = useUser();
    const [MOCK_USERS, setContacts] = useState<User[]>([]);
    const [showQRModal, setShowQRModal] = useState(false);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [loadingLink, setLoadingLink] = useState(false);
    const [requireApproval, setRequireApproval] = useState<boolean>(
      selectChat?.settings?.isReviewNewParticipant ?? false,
    );

    const myRole = selectChat?.participantInfo?.find(p => p.id === user?.id)?.role;
    const isAdmin = myRole === 'admin' || myRole === 'owner';

    useEffect(() => {
      setRequireApproval(selectChat?.settings?.isReviewNewParticipant ?? false);
    }, [selectChat?.id, selectChat?.settings?.isReviewNewParticipant, visible]);

    const handleShareLink = async () => {
        if (!selectChat?.id || loadingLink) return;
        setLoadingLink(true);
        try {
            const res = await ConversationService.getInviteLink(selectChat.id);
            if (res?.url) {
                setInviteUrl(res.url);
                await Share.share({
                    message: `Tham gia nhóm "${selectChat.name}" trên Zala!\nLink: ${res.url}`,
                    url: res.url,
                });
            } else {
                Alert.alert('Lỗi', 'Không thể lấy link mời.');
            }
        } catch {
            Alert.alert('Lỗi', 'Có lỗi xảy ra khi chia sẻ link.');
        } finally {
            setLoadingLink(false);
        }
    };
    useEffect(() => {
        const fetchFriendRequests = async () => {
          if (!visible) return;
          try {
            const response = await FriendRequestService.getAllAcceptedFriendRequests("");
            setFriendRequests(response.friendRequests || []);
          } catch (error) {
            setFriendRequests([]);
            console.error('Error fetching friend requests:', error);
          }
        };

        fetchFriendRequests();
    }, [visible]);
    
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
        
                    const uniqueIds = Array.from(new Set(ids));
                    const contactsList = [] as User[];
                    if(!selectChat?.id) {
                        console.error('Conversation ID is undefined');
                        return;
                    }
                    const inforConversation = await ConversationService.getConversationById(selectChat.id);
                    const activeParticipantIds = new Set(inforConversation.conversation?.participantIds || []);
                    for (const id of uniqueIds) {
                        try {
                            const response = await UserService.getUserById(id);
                        if (response.success && !activeParticipantIds.has(id)) {
                                contactsList.push(response.user as User);
                            }
                        } catch (err) {
                            console.log(`Bỏ qua user ${id} do lỗi fetch:`, err);
                        }
                    }
                    setContacts(contactsList);
                } catch (error) {
                    setContacts([]);
                    console.error('Error fetching contacts:', error);
                }
            };
            if (!visible || !selectChat?.id) {
                return;
            }
            if (Array.isArray(friendRequests) && friendRequests.length > 0) {
                fetchContacts();
            } else {
                setContacts([]);
            }
    }, [friendRequests, selectChat?.id, user?.id, visible]);

    useEffect(() => {
      if (!visible) {
        setSelectedUsers([]);
        setSearchQuery('');
      }
    }, [visible]);
  
    const toggleUserSelection = (userId: string) => {
      setSelectedUsers(prev =>
        prev.includes(userId)
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    };
  
    const filteredUsers = MOCK_USERS.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddMembers = async () => {
      try {
        if (!selectChat?.id) {
          console.error('Conversation ID is undefined');
          return;
        }
        let successCount = 0;
        let failCount = 0;
        for (const userId of selectedUsers) {
           const response = await ConversationService.sendGroupInvite(selectChat.id, userId);
           if (response.success) {
               successCount++;
           } else {
               failCount++;
           }
        }
        
        if (successCount > 0) {
            alert(`Đã gửi ${successCount} lời mời thành công` + (failCount > 0 ? `, ${failCount} lời mời thất bại` : ''));
        } else {
            alert('Không gửi được lời mời nào');
        }
      }
      catch (error) {
        console.error('Error sending invites:', error);
      }
      onClose();
    }
  
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/30 items-center">
          {/* Container cho desktop */}
          <View style={[
            {
              width: isDesktop ? 400 : '100%',
              height: isDesktop ? 480 : '100%',
              borderRadius: isDesktop ? 16 : 0,
              overflow: 'hidden',
              marginTop: isDesktop ? 100 : 0
            }
          ]}>
            {/* Content container */}
            <View style={[
              {
                flex: 1,
                backgroundColor: 'white',
                marginTop: isDesktop ? 0 : 64,
                borderTopLeftRadius: isDesktop ? 0 : 24,
                borderTopRightRadius: isDesktop ? 0 : 24
              }
            ]}>
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
                <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
                <Text className="text-lg font-semibold">Mời bạn bè</Text>
                <TouchableOpacity
                  className={`py-1 px-3 rounded-lg ${selectedUsers.length > 0 ? 'bg-blue-500' : 'bg-gray-200'}`}
                  disabled={selectedUsers.length === 0}
                  onPress={handleAddMembers}
                >
                  <Text className={selectedUsers.length > 0 ? 'text-white' : 'text-gray-500'}>
                    Gửi lời mời ({selectedUsers.length})
                  </Text>
                </TouchableOpacity>
              </View>
  
              {/* Search Bar */}
              <View className="px-4 py-2 border-b border-gray-200">
                <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
                  <Ionicons name="search" size={20} color="#666" />
                  <TextInput
                    className="flex-1 ml-2 text-base"
                    placeholder="Tìm kiếm bạn bè"
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
              </View>
  
              {/* User List */}
              <ScrollView className="flex-1 px-4">
                {/* Section: Invitation Methods */}
                <View className="py-2 border-b border-gray-100 mb-2">
                  <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-1">
                    Phương thức mời khác
                  </Text>
                  
                  <View className="flex-row gap-3">
                    <TouchableOpacity 
                      onPress={handleShareLink}
                      disabled={loadingLink}
                      className="flex-1 bg-indigo-50 rounded-2xl p-4 flex-row items-center justify-center border border-indigo-100 active:bg-indigo-100"
                    >
                      {loadingLink ? (
                        <ActivityIndicator size="small" color="#6366F1" />
                      ) : (
                        <>
                          <Ionicons name="link-outline" size={20} color="#6366F1" />
                          <Text className="ml-2 font-bold text-indigo-600 text-[14px]">Link mời</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => setShowQRModal(true)}
                      className="flex-1 bg-violet-50 rounded-2xl p-4 flex-row items-center justify-center border border-violet-100 active:bg-violet-100"
                    >
                      <Ionicons name="qr-code-outline" size={20} color="#8B5CF6" />
                      <Text className="ml-2 font-bold text-violet-600 text-[14px]">Mã QR</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-wider mb-1 mt-2">
                  Danh sách bạn bè
                </Text>

                {filteredUsers.length === 0 ? (
                  <View className="py-8 items-center">
                    <Text className="text-gray-400 italic">Không tìm thấy bạn bè phù hợp</Text>
                  </View>
                ) : (
                  filteredUsers.map(user => (
                  <TouchableOpacity
                    key={user.id}
                    className="flex-row items-center py-3 hover:bg-gray-50 active:bg-gray-100"
                    onPress={() => toggleUserSelection(user.id)}
                  >
                    <View className="relative">
                      <Image
                        source={{ uri: user.avatarURL || 'https://placehold.co/400' }}
                        className="w-12 h-12 rounded-full"
                      />
                      {user.isOnline && (
                        <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                      )}
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-[15px] font-medium text-gray-900">{user.name}</Text>
                    </View>
                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center
                      ${selectedUsers.includes(user.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-300'}`}
                    >
                      {selectedUsers.includes(user.id) && (
                        <Ionicons name="checkmark" size={16} color="white" />
                      )}
                    </View>
                  </TouchableOpacity>
                )))}
                {/* Padding bottom for better scrolling */}
                <View className="h-4" />
              </ScrollView>
            </View>
          </View>
        </View>

        {selectChat?.id && (
          <GroupQRModal
            visible={showQRModal}
            onClose={() => setShowQRModal(false)}
            conversationId={selectChat.id}
            groupName={selectChat.name ?? 'Nhóm'}
            avatarUrl={selectChat?.avatarUrl}
            isAdmin={isAdmin}
            requireApproval={requireApproval}
            onRequireApprovalToggled={(newVal) => {
              setRequireApproval(newVal);
            }}
          />
        )}
      </Modal>
    );
  };
