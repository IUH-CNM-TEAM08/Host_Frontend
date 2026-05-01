import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get, post } from '@/src/api/services/http';
import SocketService from '@/src/api/socketCompat';
import { useUser } from '@/src/contexts/user/UserContext';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';

interface GroupInvite {
    id: string;
    _id?: string;
    conversationId: string;
    inviterId: string;
    /** Đã bấm đồng ý nhưng nhóm bật phê duyệt — chờ admin */
    awaitingAdminApproval?: boolean;
    group: {
        id: string;
        name: string;
        avatarUrl?: string;
        memberCount: number;
    };
    createdAt?: string;
}

interface GroupRequestListProps {
    /** Gọi lại khi chấp nhận → cha có thể mở chat */
    onAccepted?: (conversationId: string) => void;
}

export default function GroupRequestList({ onAccepted }: GroupRequestListProps = {}) {
    const { user } = useUser();
    const { t } = useTranslation();
    const [invites, setInvites] = useState<GroupInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Decline Reason Modal State
    const [declineModalVisible, setDeclineModalVisible] = useState(false);
    const [declineInviteId, setDeclineInviteId] = useState<string | null>(null);
    const [declineReason, setDeclineReason] = useState('');

    const fetchInvites = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = Boolean(opts?.silent);
        if (!silent) setLoading(true);
        try {
            const res: any = await get('/api/group-invites/mine');
            const data = res?.data ?? res;
            setInvites(
                (data?.invites ?? []).map((inv: any) => ({
                    id: inv._id ?? inv.id,
                    conversationId: String(inv.conversationId ?? ''),
                    inviterId: inv.inviterId,
                    awaitingAdminApproval: Boolean(inv.awaitingAdminApproval),
                    group: inv.group ?? { id: inv.conversationId, name: t('contacts.groupDefaultName'), memberCount: 0 },
                    createdAt: inv.createdAt,
                }))
            );
        } catch (e) {
            console.error('[GroupRequestList] fetchInvites error:', e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchInvites();
    }, [fetchInvites]);

    /** Realtime cho lời mời nhóm và yêu cầu chờ duyệt */
    useEffect(() => {
        const socket = SocketService.getInstance();
        const onInvite = () => void fetchInvites({ silent: true });
        const onJoinApproved = (payload: { inviteId?: string; conversationId?: string }) => {
            const inviteId = String(payload?.inviteId ?? '');
            const conversationId = String(payload?.conversationId ?? '');
            if (!inviteId && !conversationId) return;
            setInvites(prev => prev.filter(i => {
                if (inviteId && String(i.id) === inviteId) return false;
                if (conversationId && String(i.conversationId) === conversationId) return false;
                return true;
            }));
            onAccepted?.(conversationId);
            void fetchInvites({ silent: true });
        };
        const onJoinRejected = (payload: { conversationId?: string }) => {
            const conversationId = String(payload?.conversationId ?? '');
            if (!conversationId) return;
            setInvites(prev => prev.filter(i => String(i.conversationId) !== conversationId));
            void fetchInvites({ silent: true });
        };
        const onParticipantsAdded = (payload: { conversationId?: string; participantIds?: string[] }) => {
            const conversationId = String(payload?.conversationId ?? '');
            if (!conversationId) return;
            const joinedIds = Array.isArray(payload?.participantIds)
                ? payload.participantIds.map((id) => String(id))
                : [];
            if (user?.id && joinedIds.length > 0 && !joinedIds.includes(String(user.id))) return;
            setInvites(prev => prev.filter(i => String(i.conversationId) !== conversationId));
            onAccepted?.(conversationId);
            void fetchInvites({ silent: true });
        };

        socket.onGroupInviteReceived(onInvite);
        socket.onGroupJoinApproved(onJoinApproved);
        socket.onGroupJoinRejected(onJoinRejected);
        socket.onParticipantsAddedServer(onParticipantsAdded);
        return () => {
            socket.removeGroupInviteReceivedListener(onInvite);
            socket.removeGroupJoinApprovedListener(onJoinApproved);
            socket.removeGroupJoinRejectedListener(onJoinRejected);
            socket.removeParticipantsAddedServer(onParticipantsAdded);
        };
    }, [fetchInvites, onAccepted, user?.id]);

    const handleAccept = async (invite: GroupInvite) => {
        setActionLoading(invite.id);
        try {
            const raw: any = await post(`/api/group-invites/${invite.id}/accept`, {});
            const payload = raw?.data ?? raw;
            const pendingAdmin = Boolean(payload?.pendingAdminApproval);
            if (pendingAdmin) {
                setInvites(prev =>
                    prev.map(i => (i.id === invite.id ? { ...i, awaitingAdminApproval: true } : i)),
                );
                Alert.alert(t('contacts.requestSubmitted'), t('contacts.awaitAdminApproval'));
            } else {
                setInvites(prev => prev.filter(i => i.id !== invite.id));
                onAccepted?.(invite.conversationId);
                Alert.alert(
                    t('common.success'),
                    t('contacts.joinedGroup').replace('{name}', invite.group.name || ''),
                );
            }
        } catch (e: any) {
            const msg =
                e?.response?.data?.message ||
                e?.response?.data?.error ||
                e?.message ||
                t('contacts.cannotJoinGroup');
            if (/bị chặn khỏi nhóm/i.test(String(msg))) {
                Alert.alert(t('common.error'), t('contacts.blockedFromGroup'));
            } else {
                Alert.alert(t('common.error'), String(msg));
            }
        } finally {
            setActionLoading(null);
        }
    };

    const openDeclineModal = (inviteId: string) => {
        setDeclineInviteId(inviteId);
        setDeclineReason(t('contacts.defaultDeclineReason'));
        setDeclineModalVisible(true);
    };

    const handleDeclineSubmit = async () => {
        if (!declineInviteId || actionLoading) return;
        setActionLoading(declineInviteId);
        setDeclineModalVisible(false);
        try {
            await post(`/api/group-invites/${declineInviteId}/decline`, { reason: declineReason });
            setInvites(prev => prev.filter(i => i.id !== declineInviteId));
        } catch (e: any) {
            Alert.alert(t('common.error'), e?.message || t('contacts.cannotRejectInvite'));
        } finally {
            setActionLoading(null);
            setDeclineInviteId(null);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center py-10">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="text-gray-400 mt-3">{t('contacts.loadingInvites')}</Text>
            </View>
        );
    }

    if (invites.length === 0) {
        return (
            <View className="flex-1 items-center justify-center p-4 py-16">
                <Ionicons name="people-outline" size={56} color="#D1D5DB" />
                <Text className="text-gray-400 mt-3 text-base">{t('contacts.noGroupInvites')}</Text>
                <TouchableOpacity
                    onPress={() => void fetchInvites()}
                    className="mt-4 px-4 py-2 rounded-full border border-blue-200 bg-blue-50"
                >
                    <Text className="text-blue-500 text-sm">{t('contacts.refresh')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <ScrollView className="flex-1 bg-white">
                {invites.map((invite) => (
                    <View key={invite.id} className="p-4 border-b border-gray-100">
                        <View className="flex-row items-center">
                            <Image
                                source={{ uri: invite.group.avatarUrl || 'https://ui-avatars.com/api/?name=Group&background=3B82F6&color=fff' }}
                                className="w-14 h-14 rounded-full"
                            />
                            <View className="flex-1 ml-3">
                                <Text className="text-base font-semibold text-gray-800">
                                    {invite.group.name}
                                </Text>
                                <Text className="text-sm text-gray-500 mt-0.5">
                                    {invite.group.memberCount} {t('contacts.members')}
                                </Text>
                                {invite.awaitingAdminApproval && (
                                    <Text className="text-xs text-amber-600 mt-1 font-medium">
                                        {t('contacts.awaitingAdminApprovalStatus')}
                                    </Text>
                                )}
                                {invite.createdAt && (
                                    <Text className="text-xs text-gray-400 mt-0.5">
                                        {new Date(invite.createdAt).toLocaleDateString('vi-VN')}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View className="flex-row justify-end mt-3 gap-2">
                            {invite.awaitingAdminApproval ? (
                                <TouchableOpacity
                                    disabled={actionLoading === invite.id}
                                    onPress={() => openDeclineModal(invite.id)}
                                    className="bg-gray-100 px-5 py-2 rounded-full"
                                >
                                    {actionLoading === invite.id ? (
                                        <ActivityIndicator size="small" color="#6B7280" />
                                    ) : (
                                        <Text className="text-gray-600 font-medium">{t('contacts.cancelRequest')}</Text>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        disabled={actionLoading === invite.id}
                                        onPress={() => openDeclineModal(invite.id)}
                                        className="bg-gray-100 px-5 py-2 rounded-full"
                                    >
                                        {actionLoading === invite.id ? (
                                            <ActivityIndicator size="small" color="#6B7280" />
                                        ) : (
                                            <Text className="text-gray-600 font-medium">{t('contacts.rejectRequest')}</Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        disabled={actionLoading === invite.id}
                                        onPress={() => handleAccept(invite)}
                                        className="bg-blue-500 px-5 py-2 rounded-full"
                                    >
                                        {actionLoading === invite.id ? (
                                            <ActivityIndicator size="small" color="white" />
                                        ) : (
                                            <Text className="text-white font-medium">{t('contacts.joinGroup')}</Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Decline Reason Modal */}
            <Modal visible={declineModalVisible} animationType="fade" transparent>
                <View className="flex-1 bg-black/60 justify-center items-center px-4">
                    <View className="bg-white w-full rounded-2xl p-5">
                        <Text className="text-lg font-bold text-gray-900 mb-2">{t('contacts.rejectInviteTitle')}</Text>
                        <Text className="text-gray-500 mb-4">{t('contacts.rejectInviteMessage')}</Text>
                        
                        <TextInput
                            className="border border-gray-300 rounded-xl px-4 py-3 text-gray-900 bg-gray-50"
                            placeholder={t('contacts.enterReason')}
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
                                <Text className="text-gray-700 font-semibold">{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 py-3 rounded-xl bg-red-500 items-center"
                                onPress={handleDeclineSubmit}
                            >
                                <Text className="text-white font-semibold">{t('contacts.rejectRequest')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}