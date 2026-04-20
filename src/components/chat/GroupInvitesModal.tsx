import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';

interface GroupInvitesModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void; // Called when an invite is accepted so we can refresh the list
}

export default function GroupInvitesModal({ visible, onClose, onSuccess }: GroupInvitesModalProps) {
    const [invites, setInvites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Decline Reason Modal State
    const [declineModalVisible, setDeclineModalVisible] = useState(false);
    const [declineInviteId, setDeclineInviteId] = useState<string | null>(null);
    const [declineReason, setDeclineReason] = useState('Tôi không muốn tham gia lúc này');

    useEffect(() => {
        if (visible) {
            fetchInvites();
        }
    }, [visible]);

    const fetchInvites = async () => {
        setLoading(true);
        try {
            const res = await ConversationService.getMyGroupInvites();
            if (res.success && res.invites) {
                setInvites(res.invites);
            }
        } catch (error) {
            console.error('Error fetching group invites:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (inviteId: string) => {
        if (actionLoading) return;
        setActionLoading(inviteId);
        try {
            const res = await ConversationService.acceptGroupInvite(inviteId);
            if (res.success) {
                if (res.pendingAdminApproval) {
                    setInvites(prev =>
                        prev.map(inv =>
                            inv._id === inviteId ? { ...inv, awaitingAdminApproval: true } : inv,
                        ),
                    );
                    Alert.alert('Đã gửi yêu cầu', 'Nhóm đang bật phê duyệt. Bạn sẽ được thêm khi quản trị viên duyệt.');
                } else {
                    setInvites(prev => prev.filter(inv => inv._id !== inviteId));
                    onSuccess?.();
                }
            } else {
                Alert.alert('Lỗi', res.message || 'Không thể chấp nhận lời mời');
            }
        } catch (error: any) {
            const msg =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                'Có lỗi xảy ra';
            if (/bị chặn khỏi nhóm/i.test(String(msg))) {
                Alert.alert('Thông báo', 'Bạn đã bị chặn khỏi nhóm này. Không thể tham gia nhóm.');
            } else {
                Alert.alert('Lỗi', String(msg));
            }
        } finally {
            setActionLoading(null);
        }
    };

    const openDeclineModal = (inviteId: string) => {
        setDeclineInviteId(inviteId);
        setDeclineReason('Tôi không muốn tham gia lúc này');
        setDeclineModalVisible(true);
    };

    const handleDeclineSubmit = async () => {
        if (!declineInviteId || actionLoading) return;
        setActionLoading(declineInviteId);
        setDeclineModalVisible(false);
        try {
            const res = await ConversationService.declineGroupInvite(declineInviteId, declineReason);
            if (res.success) {
                setInvites(prev => prev.filter(inv => inv._id !== declineInviteId));
            } else {
                Alert.alert('Lỗi', res.message || 'Không thể từ chối lời mời');
            }
        } catch (error) {
            Alert.alert('Lỗi', 'Có lỗi xảy ra');
        } finally {
            setActionLoading(null);
            setDeclineInviteId(null);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-3xl h-[80%] overflow-hidden">
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200">
                        <Text className="text-xl font-bold text-gray-900">Lời mời vào nhóm</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
                            <Ionicons name="close" size={24} color="#4b5563" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#3b82f6" />
                        </View>
                    ) : invites.length === 0 ? (
                        <View className="flex-1 justify-center items-center p-6">
                            <Ionicons name="mail-open-outline" size={64} color="#d1d5db" />
                            <Text className="text-gray-500 mt-4 text-center">Bạn không có lời mời nào đang chờ</Text>
                        </View>
                    ) : (
                        <ScrollView className="flex-1 p-4">
                            {invites.map((invite) => (
                                <View key={invite._id} className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm">
                                    <View className="flex-row items-center">
                                        <Image
                                            source={{ uri: invite.group?.avatarUrl || 'https://placehold.co/400' }}
                                            className="w-14 h-14 rounded-full border border-gray-200"
                                        />
                                        <View className="flex-1 ml-3">
                                            <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
                                                {invite.group?.name || 'Nhóm'}
                                            </Text>
                                            <Text className="text-sm text-gray-500 mt-1">
                                                {invite.group?.memberCount || 0} thành viên
                                            </Text>
                                            {invite.awaitingAdminApproval && (
                                                <Text className="text-xs text-amber-600 mt-1 font-semibold">
                                                    Đã đồng ý — đang chờ quản trị viên duyệt
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    
                                    <View className="mt-4 pt-3 border-t border-gray-100 flex-row gap-2">
                                        {invite.awaitingAdminApproval ? (
                                            <TouchableOpacity
                                                className="flex-1 py-2.5 rounded-xl bg-gray-100 items-center"
                                                onPress={() => openDeclineModal(invite._id)}
                                                disabled={actionLoading === invite._id}
                                            >
                                                <Text className="text-gray-700 font-semibold">Huỷ yêu cầu</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <>
                                                <TouchableOpacity
                                                    className="flex-1 py-2.5 rounded-xl bg-gray-100 items-center"
                                                    onPress={() => openDeclineModal(invite._id)}
                                                    disabled={actionLoading === invite._id}
                                                >
                                                    <Text className="text-gray-700 font-semibold">Từ chối</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    className="flex-1 py-2.5 rounded-xl bg-blue-500 items-center flex-row justify-center"
                                                    onPress={() => handleAccept(invite._id)}
                                                    disabled={actionLoading === invite._id}
                                                >
                                                    {actionLoading === invite._id ? (
                                                        <ActivityIndicator size="small" color="#ffffff" />
                                                    ) : (
                                                        <Text className="text-white font-semibold">Tham gia</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Decline Reason Overlay (Instead of nested Modal) */}
            {declineModalVisible && (
                <View className="absolute inset-0 z-50 flex-1 bg-black/60 justify-center items-center px-4" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, elevation: 10 }}>
                    <View className="bg-white w-full rounded-2xl p-5">
                        <Text className="text-lg font-bold text-gray-900 mb-2">Từ chối lời mời</Text>
                        <Text className="text-gray-500 mb-4">Bạn có muốn gửi kèm lý do cho người mời không?</Text>
                        
                        <TextInput
                            className="border border-gray-300 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
                            placeholder="Nhập lý do..."
                            value={declineReason}
                            onChangeText={setDeclineReason}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                        
                        <View className="flex-row gap-3 mt-5">
                            <TouchableOpacity
                                className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
                                onPress={() => {
                                    setDeclineModalVisible(false);
                                    setActionLoading(null);
                                }}
                            >
                                <Text className="text-gray-700 font-semibold">Hủy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 py-3 rounded-xl bg-red-500 items-center"
                                onPress={handleDeclineSubmit}
                            >
                                <Text className="text-white font-semibold">Từ chối</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
        </Modal>
    );
}
