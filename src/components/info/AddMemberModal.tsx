import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import GroupQRModal from './GroupQRModal';
import { Share, Alert, ActivityIndicator } from 'react-native';
import SocketService from '@/src/api/socketCompat';

interface AddMemberModalProps {
    visible: boolean;
    onClose: () => void;
    selectChat: Conversation | null;
  onInviteSuccessToast?: (message: string) => void;
}

interface InviteErrorInfo {
  message: string;
  status: number;
  url: string;
}

const normalizeText = (value: unknown): string => {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const parseInviteErrorInfo = (error: any): InviteErrorInfo => {
  const data = error?.response?.data;
  const candidates = [
    data?.message,
    data?.error,
    data?.data?.message,
    data?.data?.error,
    Array.isArray(data?.details) ? data.details[0] : '',
    error?.message,
  ];
  const message = String(candidates.find((item) => typeof item === 'string' && item.trim().length > 0) || '').trim();
  const status = Number(error?.response?.status ?? data?.statusCode ?? 0);
  const url = String(error?.config?.url ?? '');
  return { message, status, url };
};

const isGroupInviteApiUrl = (url: string): boolean => {
  return /\/api\/group-invites\/?(\?|$)/i.test(String(url || '').trim());
};

const getInviteErrorMessage = (error: any): string => {
  return parseInviteErrorInfo(error).message;
};

const isStrangerInviteBlocked = (message: string): boolean => {
  const raw = String(message || '').trim();
  const normalized = normalizeText(raw);
  return (
    /chặn người lạ mời vào nhóm/i.test(raw) ||
    /đã bật tính năng chặn người lạ mời vào nhóm/i.test(raw) ||
    normalized.includes('chan nguoi la moi vao nhom') ||
    normalized.includes('bat tinh nang chan nguoi la moi vao nhom') ||
    normalized.includes('block stranger group invite')
  );
};

const shouldTreatAsBlockedInvite = (error: any, isFriend: boolean): boolean => {
  const { message, status, url } = parseInviteErrorInfo(error);
  if (isStrangerInviteBlocked(message)) return true;
  return status === 400 && isGroupInviteApiUrl(url) && !isFriend;
};

const buildBlockedInviteMessage = (displayName: string): string => {
  const safeName = String(displayName || 'người này').trim() || 'người này';
  return `Hiện tại, ${safeName} đã chặn người lạ mời vào nhóm.\nVui lòng kết bạn để mời ${safeName} vào nhóm.`;
};

export default function AddMemberModal ({ visible, onClose, selectChat, onInviteSuccessToast }: AddMemberModalProps) {
    const { width: viewportWidth } = useWindowDimensions();
    const isDesktop = viewportWidth >= 768;
    const blockedNoticeWidth = Math.max(
      280,
      Math.min(isDesktop ? 420 : 360, viewportWidth - (isDesktop ? 80 : 24)),
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const { user } = useUser();
    const [contacts, setContacts] = useState<User[]>([]);
    const [externalResults, setExternalResults] = useState<User[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [loadingLink, setLoadingLink] = useState(false);
    const [blockedInviteNotice, setBlockedInviteNotice] = useState<{ visible: boolean; message: string }>({
      visible: false,
      message: '',
    });
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
    const loadAcceptedFriends = useCallback(async () => {
      if (!visible) return;
      try {
        const response = await FriendRequestService.getAllAcceptedFriendRequests("");
        setFriendRequests(response.friendRequests || []);
      } catch (error) {
        setFriendRequests([]);
        console.error('Error fetching friend requests:', error);
      }
    }, [visible]);

    useEffect(() => {
      void loadAcceptedFriends();
    }, [loadAcceptedFriends]);

    useEffect(() => {
      if (!visible) return;
      const socket = SocketService.getInstance();
      const refreshFriendTag = () => {
        void loadAcceptedFriends();
      };
      socket.onFriendRequestAccepted(refreshFriendTag);
      socket.onDeleteFriendRequest(refreshFriendTag);
      socket.onFriendRequest(refreshFriendTag);
      return () => {
        socket.removeFriendRequestAcceptedListener(refreshFriendTag);
        socket.removeFriendRequestActionListener(refreshFriendTag);
        socket.removeFriendRequestListener(refreshFriendTag);
      };
    }, [loadAcceptedFriends, visible]);
    
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
        setExternalResults([]);
        setIsSearchingUsers(false);
        setBlockedInviteNotice({ visible: false, message: '' });
      }
    }, [visible]);

    const existingParticipantIdSet = useMemo(() => {
      const ids = Array.isArray(selectChat?.participantIds)
        ? selectChat.participantIds.map((id) => String(id))
        : [];
      return new Set(ids);
    }, [selectChat?.participantIds]);

    const friendIdSet = useMemo(() => {
      return new Set(contacts.map((u) => String(u.id)));
    }, [contacts]);

    useEffect(() => {
      if (!visible) return;
      const keyword = searchQuery.trim();
      if (keyword.length < 2) {
        setExternalResults([]);
        setIsSearchingUsers(false);
        return;
      }

      const timer = setTimeout(async () => {
        setIsSearchingUsers(true);
        try {
          const res = await UserService.search(keyword);
          const users = Array.isArray(res?.users) ? res.users : [];
          const next = users.filter((u) => {
            const id = String(u?.id ?? '');
            if (!id) return false;
            if (id === String(user?.id ?? '')) return false;
            if (existingParticipantIdSet.has(id)) return false;
            return true;
          });
          setExternalResults(next);
        } catch {
          setExternalResults([]);
        } finally {
          setIsSearchingUsers(false);
        }
      }, 450);

      return () => clearTimeout(timer);
    }, [existingParticipantIdSet, searchQuery, user?.id, visible]);
  
    const toggleUserSelection = (userId: string) => {
      setSelectedUsers(prev =>
        prev.includes(userId)
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    };

    const mergedUsers = useMemo(() => {
      const merged = new Map<string, User>();
      contacts.forEach((u) => {
        const id = String(u?.id ?? '');
        if (!id || existingParticipantIdSet.has(id)) return;
        merged.set(id, u);
      });
      externalResults.forEach((u) => {
        const id = String(u?.id ?? '');
        if (!id || existingParticipantIdSet.has(id)) return;
        if (id === String(user?.id ?? '')) return;
        if (!merged.has(id)) merged.set(id, u);
      });
      return Array.from(merged.values());
    }, [contacts, existingParticipantIdSet, externalResults, user?.id]);

    const filteredUsers = useMemo(() => {
      const keyword = searchQuery.trim().toLowerCase();
      if (!keyword) return mergedUsers;
      return mergedUsers.filter((u) => {
        const name = String(u?.name ?? '').toLowerCase();
        const phone = String((u as any)?.phone ?? '').toLowerCase();
        return name.includes(keyword) || phone.includes(keyword);
      });
    }, [mergedUsers, searchQuery]);

    const userLabelById = useMemo(() => {
      const byId = new Map<string, string>();
      mergedUsers.forEach((u) => {
        byId.set(String(u.id), String(u.name ?? 'Người dùng'));
      });
      return byId;
    }, [mergedUsers]);

    const checkGroupInviteAllowed = async (targetUserId: string): Promise<boolean> => {
      try {
        const res: any = await UserService.getGroupInviteAllowed<any>(targetUserId);
        const payload = res?.data ?? res;
        if (typeof payload?.allowed === 'boolean') {
          return Boolean(payload.allowed);
        }
        return true;
      } catch {
        // Giữ backward-compatible: nếu API check lỗi, vẫn fallback theo luồng cũ.
        return true;
      }
    };

    const handleAddMembers = async () => {
      try {
        if (!selectChat?.id) {
          console.error('Conversation ID is undefined');
          return;
        }
        let successCount = 0;
        let failCount = 0;
        const blockedNames: string[] = [];
        const otherErrors: string[] = [];
        for (const userId of selectedUsers) {
          const displayName = userLabelById.get(String(userId)) || 'người này';
          const isFriend = friendIdSet.has(String(userId));
          const inviteAllowed = await checkGroupInviteAllowed(userId);
          if (!inviteAllowed) {
            failCount++;
            blockedNames.push(displayName);
            continue;
          }
          try {
            const response = await ConversationService.sendGroupInvite(selectChat.id, userId);
            if (response.success) {
              successCount++;
            } else {
              failCount++;
              const msg = String(response?.message ?? '').trim();
              if (isStrangerInviteBlocked(msg) || (!msg && !isFriend)) {
                blockedNames.push(displayName);
              } else {
                otherErrors.push(msg || `Không thể gửi lời mời cho ${displayName}`);
              }
            }
          } catch (error) {
            failCount++;
            const msg = getInviteErrorMessage(error);
            if (shouldTreatAsBlockedInvite(error, isFriend)) {
              blockedNames.push(displayName);
            } else {
              otherErrors.push(msg || `Không thể gửi lời mời cho ${displayName}`);
            }
          }
        }

        if (successCount > 0) {
          const successMessage =
            `Đã gửi ${successCount} lời mời thành công` + (failCount > 0 ? `, ${failCount} lời mời thất bại` : '');
          if (onInviteSuccessToast) {
            onInviteSuccessToast(successMessage);
          } else {
            Alert.alert('Đã gửi lời mời', successMessage);
          }
          onClose();
          return;
        }

        if (blockedNames.length === 1) {
          setBlockedInviteNotice({
            visible: true,
            message: buildBlockedInviteMessage(blockedNames[0]),
          });
          return;
        }

        if (blockedNames.length > 1) {
          setBlockedInviteNotice({
            visible: true,
            message: 'Một số người đã chặn người lạ mời vào nhóm. Vui lòng kết bạn trước khi mời vào nhóm.',
          });
          return;
        }

        if (otherErrors.length > 0) {
          Alert.alert('Không gửi được lời mời', otherErrors[0]);
          return;
        }

        if (failCount > 0) {
          setBlockedInviteNotice({
            visible: true,
            message:
              'Hiện tại người dùng này có thể đã bật tính năng chặn người lạ mời vào nhóm. Vui lòng kết bạn trước khi mời vào nhóm.',
          });
          return;
        }

        Alert.alert('Không gửi được lời mời', 'Không gửi được lời mời nào');
      }
      catch (error) {
        console.error('Error sending invites:', error);
        const parsed = parseInviteErrorInfo(error);
        if (shouldTreatAsBlockedInvite(error, false)) {
          setBlockedInviteNotice({
            visible: true,
            message:
              'Hiện tại người dùng này đã chặn người lạ mời vào nhóm. Vui lòng kết bạn trước khi gửi lời mời.',
          });
          return;
        }
        Alert.alert('Lỗi', parsed.message || 'Không gửi được lời mời.');
      }
    }

    const closeBlockedInviteNotice = () => {
      setBlockedInviteNotice({ visible: false, message: '' });
    };

    return (
      <>
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
                    placeholder="Tìm bạn bè hoặc người dùng"
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {isSearchingUsers && (
                    <ActivityIndicator size="small" color="#0068FF" />
                  )}
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
                  Danh sách người dùng
                </Text>

                {filteredUsers.length === 0 ? (
                  <View className="py-8 items-center">
                    <Text className="text-gray-400 italic">Không tìm thấy người dùng phù hợp</Text>
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
                      <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 999,
                            backgroundColor: friendIdSet.has(String(user.id)) ? '#d1fae5' : '#e2e8f0',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: friendIdSet.has(String(user.id)) ? '#047857' : '#475569',
                            }}
                          >
                            {friendIdSet.has(String(user.id)) ? 'Bạn bè' : 'Người lạ'}
                          </Text>
                        </View>
                      </View>
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

      <Modal
        visible={blockedInviteNotice.visible}
        transparent
        animationType="fade"
        onRequestClose={closeBlockedInviteNotice}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.35)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 12,
          }}
        >
          <View
            style={{
              width: blockedNoticeWidth,
              maxWidth: 420,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingHorizontal: 18,
              paddingVertical: 16,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.16,
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#EFF6FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                }}
              >
                <Ionicons name="information-circle" size={18} color="#2563EB" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Không thể mời vào nhóm</Text>
            </View>
            <Text style={{ fontSize: 14, lineHeight: 22, color: '#334155' }}>{blockedInviteNotice.message}</Text>
            <TouchableOpacity
              onPress={closeBlockedInviteNotice}
              activeOpacity={0.9}
              style={{
                marginTop: 16,
                backgroundColor: '#2563EB',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Đã hiểu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </>
    );
  };
