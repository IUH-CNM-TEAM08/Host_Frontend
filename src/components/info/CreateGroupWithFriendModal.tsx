import React, { useEffect, useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { friendshipService } from '@/src/api/services/friendship.service';
import { userService } from '@/src/api/services/user.service';
import { conversationService } from '@/src/api/services/conversation.service';
import { User } from '@/src/models/User';

interface Props {
    visible: boolean;
    onClose: () => void;
    currentUser: any;
    preSelectedFriend: User | null;
    preSelectedFriendId: string | null;
    onCreated: () => void;
}

export default function CreateGroupWithFriendModal({
    visible, onClose, currentUser, preSelectedFriend, preSelectedFriendId, onCreated,
}: Props) {
    const [friends, setFriends] = useState<User[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!visible) return;
        // Pre-chọn người bạn bè hiện tại
        if (preSelectedFriendId) {
            setSelected([preSelectedFriendId]);
        }
        // Đặt tên nhóm mặc định
        if (preSelectedFriend?.name && currentUser?.name) {
            setGroupName(`Nhóm ${currentUser.name}, ${preSelectedFriend.name}`);
        }
        void loadFriends();
    }, [visible]);

    const loadFriends = async () => {
        setFetching(true);
        try {
            const res: any = await friendshipService.listAccepted();
            const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
            // rows có thể là friendship objects hoặc user objects
            const friendUsers: User[] = [];
            for (const row of rows) {
                // Nếu là friendship object thì có senderId/receiverId
                const peerId = row.senderId === currentUser?.id
                    ? row.receiverId
                    : row.senderId ?? row.id;
                if (!peerId || peerId === currentUser?.id) continue;
                // Nếu row đã có name thì dùng luôn
                if (row.name) {
                    friendUsers.push({ id: peerId, name: row.name, avatarURL: row.avatarURL ?? '' } as User);
                } else {
                    const userRes: any = await userService.getUserById(peerId);
                    if (userRes?.user) friendUsers.push(userRes.user);
                }
            }
            setFriends(friendUsers.filter(u => u.id !== preSelectedFriendId));
        } catch {
            setFriends([]);
        } finally {
            setFetching(false);
        }
    };

    const toggleSelect = (id: string) => {
        if (id === preSelectedFriendId) return; // không bỏ chọn người kia
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleCreate = async () => {
        let name = groupName.trim();
        // Nếu không nhập tên → tự tạo từ tên thành viên
        if (!name) {
            const memberNames = selected
                .slice(0, 3)
                .map(id => {
                    if (id === preSelectedFriendId && preSelectedFriend?.name) return preSelectedFriend.name;
                    const friend = friends.find(f => f.id === id);
                    return friend?.name || '';
                })
                .filter(Boolean);
            const myName = currentUser?.name || 'Bạn';
            const allNames = [myName, ...memberNames];
            name = allNames.slice(0, 3).join(', ');
            if (selected.length + 1 > 3) name += '...';
        }
        // >= 3 người: creator + selected (ít nhất 2)
        if (selected.length < 2) {
            Alert.alert('Cần thêm thành viên', 'Nhóm cần ít nhất 3 người (bao gồm bạn).\nHãy chọn thêm ít nhất 1 người nữa.');
            return;
        }
        setLoading(true);
        try {
            const res: any = await conversationService.createGroup({ name, userIds: selected });
            const convId = (res?.data ?? res)?.id ?? (res?.data ?? res)?._id;
            if (convId) {
                Alert.alert('✅ Đã tạo nhóm!', `Nhóm "${name}" đã được tạo thành công.`);
                onCreated();
            } else {
                Alert.alert('Lỗi', res?.message || 'Không thể tạo nhóm.');
            }
        } catch {
            Alert.alert('Lỗi', 'Không thể tạo nhóm. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const filtered = friends.filter(f =>
        f.name?.toLowerCase().includes(search.toLowerCase())
    );

    const memberCount = selected.length + 1; // +1 cho bản thân

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{
                    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
                    maxHeight: '90%', paddingBottom: 32,
                }}>
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 16, borderBottomWidth: 1, borderColor: '#f3f4f6',
                    }}>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>
                            Tạo nhóm mới
                        </Text>
                        <TouchableOpacity
                            disabled={loading || selected.length < 2}
                            onPress={() => void handleCreate()}
                            style={{
                                backgroundColor: selected.length >= 2 ? '#10B981' : '#E5E7EB',
                                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
                            }}
                        >
                            <Text style={{
                                color: selected.length >= 2 ? '#fff' : '#9CA3AF',
                                fontWeight: '700', fontSize: 14,
                            }}>
                                {loading ? 'Đang tạo...' : 'Tạo'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Group Name */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
                        <TextInput
                            value={groupName}
                            onChangeText={setGroupName}
                            placeholder="Tên nhóm..."
                            placeholderTextColor="#9CA3AF"
                            maxLength={50}
                            style={{
                                borderWidth: 1.5, borderColor: '#D1FAE5', borderRadius: 12,
                                padding: 11, fontSize: 15, color: '#111827', backgroundColor: '#F0FDF4',
                            }}
                        />
                        <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>
                            {memberCount} thành viên (cần ít nhất 3)
                        </Text>
                    </View>

                    {/* Pre-selected friend badge */}
                    {preSelectedFriend && (
                        <View style={{
                            marginHorizontal: 16, marginBottom: 8, padding: 10,
                            backgroundColor: '#F0FDF4', borderRadius: 12,
                            flexDirection: 'row', alignItems: 'center',
                        }}>
                            <View style={{
                                width: 36, height: 36, borderRadius: 18,
                                backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginRight: 10,
                            }}>
                                {preSelectedFriend.avatarURL
                                    ? <Image source={{ uri: preSelectedFriend.avatarURL }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                                    : <Ionicons name="person" size={18} color="#fff" />
                                }
                            </View>
                            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#065F46' }}>
                                {preSelectedFriend.name}
                            </Text>
                            <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>Đã chọn</Text>
                            </View>
                        </View>
                    )}

                    {/* Search */}
                    <View style={{
                        marginHorizontal: 16, marginBottom: 6,
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 10,
                    }}>
                        <Ionicons name="search" size={18} color="#9CA3AF" />
                        <TextInput
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Tìm bạn bè..."
                            placeholderTextColor="#9CA3AF"
                            style={{ flex: 1, paddingVertical: 8, marginLeft: 8, fontSize: 14, color: '#111827' }}
                        />
                    </View>

                    <Text style={{ marginHorizontal: 16, fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                        Chọn thêm thành viên ({selected.length - 1}/{friends.length} đã chọn)
                    </Text>

                    {/* Friends list */}
                    <ScrollView style={{ maxHeight: 320 }}>
                        {fetching ? (
                            <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 24 }} />
                        ) : filtered.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingTop: 24 }}>
                                <Ionicons name="people-outline" size={40} color="#D1D5DB" />
                                <Text style={{ color: '#9CA3AF', marginTop: 8 }}>Không tìm thấy bạn bè</Text>
                            </View>
                        ) : (
                            filtered.map(friend => {
                                const isSelected = selected.includes(friend.id);
                                return (
                                    <TouchableOpacity
                                        key={friend.id}
                                        onPress={() => toggleSelect(friend.id)}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center',
                                            paddingHorizontal: 16, paddingVertical: 10,
                                            borderBottomWidth: 1, borderColor: '#F9FAFB',
                                        }}
                                    >
                                        <View style={{ position: 'relative', marginRight: 12 }}>
                                            <View style={{
                                                width: 44, height: 44, borderRadius: 22,
                                                backgroundColor: '#E5E7EB', overflow: 'hidden',
                                                alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {friend.avatarURL
                                                    ? <Image source={{ uri: friend.avatarURL }} style={{ width: 44, height: 44 }} />
                                                    : <Ionicons name="person" size={22} color="#9CA3AF" />
                                                }
                                            </View>
                                        </View>
                                        <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: '#111827' }}>
                                            {friend.name}
                                        </Text>
                                        <View style={{
                                            width: 24, height: 24, borderRadius: 12,
                                            borderWidth: 2,
                                            borderColor: isSelected ? '#10B981' : '#D1D5DB',
                                            backgroundColor: isSelected ? '#10B981' : '#fff',
                                            alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}