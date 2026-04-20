import React, { useEffect, useRef, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity,
    Alert, ActivityIndicator, Switch, Platform,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { conversationService } from '@/src/api/services/conversation.service';
import { messageService } from '@/src/api/services/message.service';
import ForwardMessageModal from '../chat/ForwardMessageModal';
import { useUser } from '@/src/contexts/user/UserContext';
import SocketService from '@/src/api/socketCompat';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { MessageType } from '@/src/models/Message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'react-native';

interface Props {
    visible: boolean;
    onClose: () => void;
    conversationId: string;
    groupName: string;
    avatarUrl?: string;
    isAdmin: boolean;
    requireApproval: boolean;
    onRequireApprovalToggled: (newVal: boolean) => void;
}

export default function GroupQRModal({
    visible, onClose, conversationId, groupName, avatarUrl, isAdmin, requireApproval, onRequireApprovalToggled,
}: Props) {
    const insets = useSafeAreaInsets();
    const { user } = useUser();
    const socketService = useRef(SocketService.getInstance()).current;
    
    const [inviteUrl, setInviteUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [togglingApproval, setTogglingApproval] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showAdminMenu, setShowAdminMenu] = useState(false);
    const [localRequireApproval, setLocalRequireApproval] = useState(requireApproval);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [loadingPending, setLoadingPending] = useState(false);
    
    let qrRef: any = null;

    const toWebJoinUrl = (rawUrl: string) => {
        const fallbackOrigin = 'http://localhost:8081';
        try {
            if (rawUrl.startsWith('zala://join/')) {
                const parts = rawUrl.split('/');
                if (parts.length >= 5) {
                    const conversationId = parts[3];
                    const code = parts[4];
                    return `${fallbackOrigin}/join?conversationId=${encodeURIComponent(conversationId)}&code=${encodeURIComponent(code)}`;
                }
            }

            const normalized = rawUrl.startsWith('zala://')
                ? rawUrl.replace('zala://', 'http://')
                : rawUrl;
            const url = new URL(normalized);
            if (url.pathname === '/join' && url.searchParams.get('conversationId') && url.searchParams.get('code')) {
                const origin = Platform.OS === 'web' && typeof window !== 'undefined'
                    ? window.location.origin
                    : fallbackOrigin;
                return `${origin}/join?conversationId=${encodeURIComponent(url.searchParams.get('conversationId') || '')}&code=${encodeURIComponent(url.searchParams.get('code') || '')}`;
            }
            return rawUrl;
        } catch {
            return rawUrl;
        }
    };

    const loadPendingRequests = async () => {
        if (!isAdmin) return;
        setLoadingPending(true);
        try {
            const res = await conversationService.getPendingJoinRequests(conversationId);
            setPendingRequests(res?.requests || []);
        } catch { setPendingRequests([]); }
        finally { setLoadingPending(false); }
    };

    useEffect(() => {
        if (!visible || !conversationId) return;
        // Keep state if already loaded (User's feedback)
        if (!inviteUrl) void loadInviteLink();
    }, [visible, conversationId]);

    useEffect(() => {
        setLocalRequireApproval(requireApproval);
    }, [requireApproval, visible]);

    // real-time join request
    useEffect(() => {
        if (!visible || !conversationId || !isAdmin) return;
        
        const onJoinRequest = (data: any) => {
            console.log('[GroupQRModal] onGroupJoinRequest received:', data);
            const incomingConversationId = String(data?.conversationId ?? '').trim();
            if (!incomingConversationId || incomingConversationId !== String(conversationId)) return;

            const incomingInviteId = String(data?.inviteId ?? '').trim();
            if (incomingInviteId) {
                setPendingRequests((prev) => {
                    const exists = prev.some((r) => String(r?._id ?? r?.id ?? '') === incomingInviteId);
                    if (exists) return prev;
                    return [
                        {
                            _id: incomingInviteId,
                            id: incomingInviteId,
                            user: {
                                id: String(data?.requesterId ?? '').trim(),
                                name: String(data?.requesterName ?? '').trim() || 'Người dùng',
                                avatar: String(data?.requesterAvatar ?? data?.requesterAvatarUrl ?? '').trim(),
                            },
                        },
                        ...prev,
                    ];
                });
            }

            void loadPendingRequests();
        };
        
        socketService.onGroupJoinRequest(onJoinRequest);
        return () => socketService.removeGroupJoinRequestListener(onJoinRequest);
    }, [visible, conversationId, isAdmin]);

    const loadInviteLink = async () => {
        setLoading(true);
        try {
            const res = await conversationService.getInviteLink(conversationId);
            if (res?.url) setInviteUrl(res.url);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    const handleCopyLink = async () => {
        if (!inviteUrl) return;
        const shareUrl = toWebJoinUrl(inviteUrl);
        try {
            // Using a simple fallback for Platform.OS
            if (Platform.OS === 'web') {
                await navigator.clipboard.writeText(shareUrl);
            } else {
                // Clipboard from react-native is deprecated but often usable.
                // We'll use a dynamic approach or just Alert for now if library is missing.
                const RNClipboard = require('react-native').Clipboard;
                RNClipboard.setString(shareUrl);
            }
            Alert.alert('Thành công', 'Đã sao chép liên kết vào bộ nhớ tạm.');
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể sao chép liên kết.');
        }
    };

    const handleForward = async (selectedIds: string[]) => {
        if (!inviteUrl || selectedIds.length === 0) return;
        const shareUrl = toWebJoinUrl(inviteUrl);
        try {
            for (const targetId of selectedIds) {
                // Chỉ gửi qua REST — backend message.service.sendMessage đã emit `message:new` / CHAT_NEW_MESSAGE.
                // Không gọi thêm socket `message:send` (sẽ tạo bản ghi trùng trong DB).
                await messageService.send({
                    conversationId: targetId,
                    senderId: user?.id,
                    content: `Tham gia nhóm qua link:\n${shareUrl}`,
                    type: 'TEXT' as any,
                });
            }
            Alert.alert('Thành công', `Đã chia sẻ link tới ${selectedIds.length} cuộc trò chuyện.`);
        } catch {
            Alert.alert('Lỗi', 'Không thể chia sẻ link.');
        } finally {
            setShowForwardModal(false);
        }
    };

    const handleSaveQR = async () => {
        if (!qrRef || !inviteUrl) return;
        try {
            qrRef.toDataURL(async (data: string) => {
                if (Platform.OS === 'web') {
                    const link = document.createElement('a');
                    link.download = `QR_Group_${groupName}.png`;
                    link.href = `data:image/png;base64,${data}`;
                    link.click();
                } else {
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert('Cần quyền', 'Vui lòng cấp quyền truy cập thư viện ảnh để lưu mã QR.');
                        return;
                    }
                    const filename = `${FileSystem.cacheDirectory}QR_Group_${conversationId}.png`;
                    await FileSystem.writeAsStringAsync(filename, data, { encoding: FileSystem.EncodingType.Base64 });
                    await MediaLibrary.createAssetAsync(filename);
                    Alert.alert('Thành công', 'Đã lưu mã QR vào thư viện ảnh.');
                }
            });
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể lưu mã QR.');
        }
    };

    const handleResetLink = async () => {
        if (!isAdmin) return;
        Alert.alert(
            'Reset link mời',
            'Link cũ sẽ mất hiệu lực. Tiếp tục?',
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Reset', style: 'destructive', onPress: async () => {
                        try {
                            const res = await conversationService.resetInviteLink(conversationId);
                            if (res?.url) setInviteUrl(res.url);
                        } catch { Alert.alert('Lỗi', 'Không thể reset link.'); }
                    },
                },
            ]
        );
    };

    const handleToggleApproval = async () => {
        if (!isAdmin || togglingApproval) return;
        setTogglingApproval(true);
        try {
            const res = await conversationService.toggleRequireApproval(conversationId);
            if (res?.success) {
                const next = Boolean(res?.data?.settings?.isReviewNewParticipant ?? !localRequireApproval);
                setLocalRequireApproval(next);
                onRequireApprovalToggled(next);
                if (next) {
                    void loadPendingRequests();
                } else {
                    setPendingRequests([]);
                }
            }
        } catch { Alert.alert('Lỗi', 'Không thể thay đổi cài đặt.'); }
        finally { setTogglingApproval(false); }
    };


    // Load pending khi mở admin menu
    useEffect(() => {
        if (showAdminMenu && isAdmin && localRequireApproval) void loadPendingRequests();
    }, [showAdminMenu, isAdmin, localRequireApproval]);

    const handleApprove = async (inviteId: string, name: string) => {
        try {
            await conversationService.approveJoinRequest(inviteId);
            Alert.alert('Đã duyệt', `${name} đã được thêm vào nhóm`);
            setPendingRequests(prev => prev.filter(r => r._id !== inviteId));
        } catch { Alert.alert('Lỗi', 'Không thể duyệt yêu cầu'); }
    };

    const handleReject = async (inviteId: string, name: string) => {
        const performReject = async () => {
            try {
                const res = await conversationService.rejectJoinRequest(inviteId);
                if (res.success) {
                    setPendingRequests(prev => prev.filter(r => r._id !== inviteId));
                } else {
                    Alert.alert('Lỗi', res.message || 'Không thể từ chối yêu cầu');
                }
            } catch (e) {
                console.error('[GroupQRModal] reject error:', e);
                Alert.alert('Lỗi', 'Không thể từ chối yêu cầu');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Bạn có chắc muốn từ chối yêu cầu tham gia của ${name}?`)) {
                void performReject();
            }
        } else {
            Alert.alert('Từ chối', `Từ chối yêu cầu của ${name}?`, [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Từ chối', style: 'destructive', onPress: performReject },
            ]);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 bg-white">
                {/* Blue Header */}
                <View 
                    style={{ paddingTop: Math.max(insets.top, 20) }}
                    className="bg-sky-500 pb-2 flex-row items-center px-4"
                >
                    <TouchableOpacity onPress={onClose} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="flex-1 text-white text-[18px] font-semibold ml-2">Link nhóm</Text>
                    {isAdmin && (
                        <TouchableOpacity onPress={() => setShowAdminMenu(!showAdminMenu)} className="p-2">
                            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Main Content */}
                <ScrollView className="flex-1">
                    <View className="items-center py-8 px-6">
                        {/* Avatar & Title */}
                        <View className="bg-gray-100 w-24 h-24 rounded-full items-center justify-center mb-4">
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} className="w-24 h-24 rounded-full" />
                            ) : (
                                <Ionicons name="people" size={48} color="#94a3b8" />
                            )}
                        </View>
                        
                        <Text className="text-[20px] font-bold text-gray-900 mb-2">{groupName}</Text>
                        <Text className="text-[14px] text-gray-500 text-center leading-5 mb-8">
                            Mời mọi người tham gia nhóm bằng mã QR hoặc link dưới đây:
                        </Text>

                        {/* QR Box */}
                        <View className="bg-white p-6 rounded-[20px] shadow-lg mb-8" style={{ elevation: 5 }}>
                            {loading ? (
                                <View style={{ width: 200, height: 200, justifyContent: 'center', alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color="#0EA5E9" />
                                </View>
                            ) : inviteUrl ? (
                                <QRCode
                                    value={inviteUrl}
                                    size={200}
                                    getRef={(c) => (qrRef = c)}
                                    logo={require('../../../resources/assets/zala.png')} // Zala logo
                                    logoSize={50}
                                    logoBackgroundColor="white"
                                    logoBorderRadius={10}
                                />
                            ) : (
                                <View style={{ width: 200, height: 200, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text className="text-gray-400">Không tìm thấy link mời</Text>
                                </View>
                            )}
                        </View>

                        {/* Invite Link pill */}
                        {inviteUrl && (
                            <View className="bg-sky-50 px-6 py-2 rounded-full mb-12">
                                <Text className="text-sky-600 font-medium text-[15px]">{inviteUrl.replace(/^https?:\/\//, '')}</Text>
                            </View>
                        )}

                        {/* Actions Row */}
                        <View className="flex-row justify-around w-full mt-4">
                            <TouchableOpacity onPress={handleCopyLink} className="items-center w-1/3">
                                <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-2">
                                    <Ionicons name="copy-outline" size={24} color="#4b5563" />
                                </View>
                                <Text className="text-[12px] text-gray-600 text-center">Sao chép link</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setShowForwardModal(true)} className="items-center w-1/3">
                                <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-2">
                                    <Ionicons name="paper-plane-outline" size={24} color="#4b5563" />
                                </View>
                                <Text className="text-[12px] text-gray-600 text-center">Chia sẻ link</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleSaveQR} className="items-center w-1/3">
                                <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-2">
                                    <Ionicons name="download-outline" size={24} color="#4b5563" />
                                </View>
                                <Text className="text-[12px] text-gray-600 text-center">Lưu mã QR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>

                {/* Admin Menu Modal */}
                <Modal visible={showAdminMenu} transparent animationType="fade" onRequestClose={() => setShowAdminMenu(false)}>
                    <TouchableOpacity 
                        className="flex-1 bg-black/20" 
                        onPress={() => setShowAdminMenu(false)}
                        activeOpacity={1}
                    >
                        <View className="bg-white rounded-xl mx-4 mt-20 p-4 shadow-xl" style={{ maxHeight: '80%' }}>
                            <Text className="text-gray-900 font-bold mb-4">Cài đặt link nhóm</Text>
                            
                            <TouchableOpacity onPress={handleResetLink} className="flex-row items-center py-3 border-b border-gray-100">
                                <Ionicons name="refresh-outline" size={20} color="#dc2626" />
                                <Text className="ml-3 text-red-600 font-medium">Reset link mời</Text>
                            </TouchableOpacity>

                            <View className="flex-row items-center py-3 border-b border-gray-100">
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-medium">Duyệt thành viên mới</Text>
                                    <Text className="text-[12px] text-gray-500">Phải được Admin duyệt mới vào được</Text>
                                </View>
                                <Switch
                                    value={localRequireApproval}
                                    onValueChange={() => void handleToggleApproval()}
                                    disabled={togglingApproval}
                                    thumbColor={localRequireApproval ? '#0EA5E9' : '#f3f4f6'}
                                    trackColor={{ false: '#D1D5DB', true: '#BAE6FD' }}
                                />
                            </View>

                            {/* Danh sách yêu cầu chờ duyệt */}
                            {localRequireApproval && (
                                <View className="mt-3">
                                    <Text className="text-gray-900 font-bold mb-2">
                                        Yêu cầu chờ duyệt ({pendingRequests.length})
                                    </Text>
                                    {loadingPending ? (
                                        <ActivityIndicator size="small" color="#0EA5E9" />
                                    ) : pendingRequests.length === 0 ? (
                                        <Text className="text-gray-400 text-[13px] py-2">Không có yêu cầu nào</Text>
                                    ) : (
                                        <ScrollView style={{ maxHeight: 250 }}>
                                            {pendingRequests.map((req: any) => {
                                                const inviteId = String(req._id ?? req.id ?? '');
                                                const name = req.user?.name || req.invitee?.name || 'Người dùng';
                                                const avatar = req.user?.avatar || req.invitee?.avatarUrl;
                                                return (
                                                <View key={inviteId} className="flex-row items-center py-3 border-b border-gray-50">
                                                    <View className="w-10 h-10 rounded-full bg-sky-100 items-center justify-center mr-3">
                                                        {avatar ? (
                                                            <Image source={{ uri: avatar }} className="w-10 h-10 rounded-full" />
                                                        ) : (
                                                            <Ionicons name="person" size={20} color="#0EA5E9" />
                                                        )}
                                                    </View>
                                                    <View className="flex-1">
                                                        <Text className="text-gray-900 font-medium text-[14px]">{name}</Text>
                                                        <Text className="text-gray-400 text-[11px]">Đang chờ duyệt</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => handleApprove(inviteId, name)}
                                                        className="bg-sky-500 px-3 py-1.5 rounded-lg mr-2"
                                                    >
                                                        <Text className="text-white text-[12px] font-semibold">Duyệt</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleReject(inviteId, name)}
                                                        className="bg-gray-200 px-3 py-1.5 rounded-lg"
                                                    >
                                                        <Text className="text-gray-600 text-[12px] font-semibold">Từ chối</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            );})}
                                        </ScrollView>
                                    )}
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Forward Modal */}
                {showForwardModal && (
                    <ForwardMessageModal 
                        onClose={() => setShowForwardModal(false)}
                        onForward={handleForward}
                        // Manual message object simulation since we don't have a specific message id
                        message={{ content: inviteUrl || '', type: MessageType.TEXT } as any}
                    />
                )}
            </View>
        </Modal>
    );
}
