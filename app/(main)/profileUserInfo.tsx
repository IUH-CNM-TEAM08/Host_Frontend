import React, {useState, useEffect} from "react";
import {ImageSourcePropType, ScrollView, Switch, Text, TouchableOpacity, View} from "react-native";
import {Ionicons} from '@expo/vector-icons';
import CoverImage from "@/src/components/profile/CoverImage";
import AvatarImage from "@/src/components/profile/AvatarImage";
import ProfileInfoItem from "@/src/components/profile/ProfileInfoItem";
import ModalHeader from "@/src/components/profile/ModelHeader";
import {User} from "@/src/models/User";
import {formatDate} from "@/src/utils/DateTime";
import {useTranslation} from "@/src/contexts/i18n/I18nContext";
import {useRouter} from "expo-router";
import axios from 'axios';
import { URL_BE } from '@/src/constants/ApiConstant';
import VipPurchaseModal from '@/src/components/live/VipPurchaseModal';
import LiveRegulationsModal from '@/src/components/live/LiveRegulationsModal';
import SocketService from '@/src/api/socketCompat';
import { Alert } from 'react-native';

type ProfileInfoProps = {
    user: Partial<User> | null;
    avatar: ImageSourcePropType;
    cover: ImageSourcePropType;
    onPickAvatar: () => Promise<void>;
    onPickCover: () => Promise<void>;
    onEditPress: () => void;
    onClose: () => void;
    readOnly?: boolean;
    allowStrangerMessage?: boolean;
    onToggleAllowStrangerMessage?: (next: boolean) => void;
    allowStrangerCall?: boolean;
    onToggleAllowStrangerCall?: (next: boolean) => void;
    allowStrangerGroupInvite?: boolean;
    onToggleAllowStrangerGroupInvite?: (next: boolean) => void;
    strangerPrivacyLoading?: boolean;
    friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
    friendActionLoading?: boolean;
    chatActionLoading?: boolean;
    onSendFriendRequest?: () => void;
    onRecallFriendRequest?: () => void;
    onAcceptFriendRequest?: () => void;
    onRejectFriendRequest?: () => void;
    onStartChat?: () => void;
};

type Gender = 'male' | 'female' | 'other';

export default function ProfileUserInfo({
                                            user,
                                            avatar,
                                            cover,
                                            onPickAvatar,
                                            onPickCover,
                                            onEditPress,
                                            onClose,
                                            readOnly = false,
                                            allowStrangerMessage = true,
                                            onToggleAllowStrangerMessage,
                                            allowStrangerCall = true,
                                            onToggleAllowStrangerCall,
                                            allowStrangerGroupInvite = true,
                                            onToggleAllowStrangerGroupInvite,
                                            strangerPrivacyLoading = false,
                                            friendshipStatus = 'none',
                                            friendActionLoading = false,
                                            chatActionLoading = false,
                                            onSendFriendRequest,
                                            onRecallFriendRequest,
                                            onAcceptFriendRequest,
                                            onRejectFriendRequest,
                                            onStartChat,
                                        }: ProfileInfoProps) {
    const {t} = useTranslation();
    const router = useRouter();

    const genders: Record<Gender, string> = {
        male:   t('gender.male'),
        female: t('gender.female'),
        other:  t('gender.other'),
    };

    const rawGender = String(user?.gender ?? '').toLowerCase();
    const userGender = (rawGender === 'male' || rawGender === 'female' || rawGender === 'other'
        ? rawGender
        : 'other') as Gender;

    const displayName = user?.name || user?.displayName || t('profile.defaultName');
    const rawDob = user?.dob || user?.dateOfBirth;
    const dob = rawDob ? formatDate(rawDob) : t('profile.notUpdated');
    const gender = genders[userGender] || t('profile.notUpdated');
    const phone = user?.phone || user?.phoneNumber || t('profile.notUpdated');

    // VIP state
    const [showVipModal, setShowVipModal] = useState(false);
    const [showRegulationsModal, setShowRegulationsModal] = useState(false);
    const [vipTier, setVipTier] = useState(user?.vipTier || 'VIP0');
    const [vipExpiry, setVipExpiry] = useState<string | null>(user?.vipExpiryDate || null);
    const accountId = user?.id || user?.accountId || '';

    useEffect(() => {
        if (!accountId || readOnly) return;
        
        // Initial fetch
        axios.get(`${URL_BE}/api/payment/vip-status`, { params: { accountId } })
            .then(res => {
                if (res.data?.success) {
                    setVipTier(res.data.vipTier || 'VIP0');
                    setVipExpiry(res.data.vipExpiryDate || null);
                }
            }).catch(() => {});

        // Listen to realtime socket updates
        const socket = SocketService.getInstance();
        const handleVipUpgraded = (data: { vipTier: string; vipExpiryDate: string }) => {
            setVipTier(data.vipTier);
            setVipExpiry(data.vipExpiryDate);
            setShowVipModal(false);
            Alert.alert("🎉 Thành công", `Tài khoản của bạn đã được kích hoạt ${data.vipTier} thành công!`);
        };
        socket.onVipUpgraded(handleVipUpgraded);

        return () => {
            socket.removeVipUpgradedListener(handleVipUpgraded);
        };
    }, [accountId, readOnly]);

    const isReadOnlyActionVisible =
        readOnly &&
        Boolean(
            onStartChat ||
            onSendFriendRequest ||
            onRecallFriendRequest ||
            onAcceptFriendRequest ||
            onRejectFriendRequest
        );

    const friendPrimaryAction =
        friendshipStatus === 'none'
            ? onSendFriendRequest
            : friendshipStatus === 'pending_sent'
                ? onRecallFriendRequest
                : undefined;

    const friendPrimaryLabel =
        friendshipStatus === 'none'
            ? t('contacts.sendRequest')
            : friendshipStatus === 'pending_sent'
                ? t('contacts.recallRequest')
                : t('contacts.alreadyFriend');

    const friendPrimaryStyle =
        friendshipStatus === 'pending_sent'
            ? 'bg-orange-100'
            : friendshipStatus === 'accepted'
                ? 'bg-emerald-100'
                : 'bg-blue-500';

    const friendPrimaryTextStyle =
        friendshipStatus === 'pending_sent'
            ? 'text-orange-700'
            : friendshipStatus === 'accepted'
                ? 'text-emerald-700'
                : 'text-white';

    return (
    <>
        <View className="flex-1 bg-white">
            <ModalHeader
                title={readOnly ? t('profile.titleReadOnly') : t('profile.title')}
                onRightPress={onClose}
                rightIconName="close"
            />

            <ScrollView
                className="flex-1 bg-gray-100"
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: readOnly ? 16 : 96 }}
            >
                <View className="items-center mb-2 mt-4 bg-white p-2">
                    <CoverImage customSource={cover} onPickImage={onPickCover} editable={!readOnly}/>
                    <AvatarImage customSource={avatar} onPickImage={onPickAvatar} editable={!readOnly}/>
                    <Text className="text-xl font-bold">{displayName}</Text>
                </View>

                <View className="mt-2 bg-white p-4">
                    <Text className="text-base font-bold text-gray-800 mb-4">{t('profile.personalInfo')}</Text>
                    <ProfileInfoItem label={t('profile.gender')} value={gender}/>
                    <ProfileInfoItem label={t('profile.dateOfBirth')} value={dob}/>
                    <ProfileInfoItem label={t('profile.phone')} value={phone}/>
                    <View className="mb-2">
                        <Text className="text-xs text-gray-500 mt-2">
                            {t('profile.phonePrivacyNote')}
                        </Text>
                    </View>
                </View>

                {/* VIP Section */}
                {!readOnly && (
                    <View className="mt-2 bg-white p-4">
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="ribbon-outline" size={14} color="#7c3aed" />
                            </View>
                            <Text className="text-base font-bold text-gray-800">Hạng VIP Live Stream</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{
                                    color: '#6d28d9', fontSize: 12, fontWeight: '800',
                                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: 'hidden',
                                    borderWidth: 1, borderColor: '#ddd6fe', backgroundColor: '#f5f3ff',
                                }}>
                                    {vipTier}
                                </Text>
                                {vipExpiry && (
                                    <Text className="text-xs text-gray-500">
                                        HH: {new Date(vipExpiry).toLocaleDateString('vi-VN')}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowVipModal(true)}
                                style={{
                                    backgroundColor: '#7c3aed',
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 10,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <Ionicons name="sparkles-outline" size={13} color="#fff" />
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Nâng Cấp</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {!readOnly && (
                    <View className="mt-2 bg-white p-4">
                        <TouchableOpacity 
                            onPress={() => {
                                onClose();
                                setTimeout(() => {
                                    router.push('/(main)/wallet' as any);
                                }, 150);
                            }}
                            className="flex-row items-center justify-between py-2 border-b border-gray-100"
                        >
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#ede9fe' }}>
                                    <Ionicons name="wallet-outline" size={18} color="#7c3aed" />
                                </View>
                                <Text className="text-base font-medium text-gray-800">Ví của tôi / Nạp Xu</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>
                )}

                {!readOnly && (
                    <View className="mt-2 bg-white p-4">
                        <Text className="text-base font-bold text-gray-800 mb-4">{t('profile.privacyMessage')}</Text>

                        {/* Stranger message */}
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-medium text-gray-800">
                                    {t('profile.allowStrangerMessage')}
                                </Text>
                                <Text className="text-xs text-gray-500 mt-1">
                                    {t('profile.allowStrangerMessageDesc')}
                                </Text>
                            </View>
                            <Switch
                                value={allowStrangerMessage}
                                disabled={strangerPrivacyLoading || !onToggleAllowStrangerMessage}
                                onValueChange={(value) => onToggleAllowStrangerMessage?.(value)}
                                trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                                thumbColor={allowStrangerMessage ? "#2563eb" : "#9ca3af"}
                            />
                        </View>

                        {/* Stranger call */}
                        <View className="flex-row items-center justify-between mt-4">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-medium text-gray-800">
                                    {t('profile.allowStrangerCall')}
                                </Text>
                                <Text className="text-xs text-gray-500 mt-1">
                                    {t('profile.allowStrangerCallDesc')}
                                </Text>
                            </View>
                            <Switch
                                value={allowStrangerCall}
                                disabled={strangerPrivacyLoading || !onToggleAllowStrangerCall}
                                onValueChange={(value) => onToggleAllowStrangerCall?.(value)}
                                trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                                thumbColor={allowStrangerCall ? "#2563eb" : "#9ca3af"}
                            />
                        </View>

                        {/* Stranger group invite */}
                        <View className="flex-row items-center justify-between mt-4">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-medium text-gray-800">
                                    {t('profile.allowStrangerGroup')}
                                </Text>
                                <Text className="text-xs text-gray-500 mt-1">
                                    {t('profile.allowStrangerGroupDesc')}
                                </Text>
                            </View>
                            <Switch
                                value={allowStrangerGroupInvite}
                                disabled={strangerPrivacyLoading || !onToggleAllowStrangerGroupInvite}
                                onValueChange={(value) => onToggleAllowStrangerGroupInvite?.(value)}
                                trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                                thumbColor={allowStrangerGroupInvite ? "#2563eb" : "#9ca3af"}
                            />
                        </View>
                    </View>
                )}
            </ScrollView>

            {!readOnly && (
                <View className="absolute bottom-0 w-full p-3 bg-white border-t border-gray-200">
                    <TouchableOpacity
                        onPress={onEditPress}
                        className="w-full self-center bg-blue-400 py-3 rounded-lg flex-row justify-center items-center"
                    >
                        <Ionicons name="pencil-outline" size={18} color="white"/>
                        <Text className="text-white font-medium ml-2">{t('common.update')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isReadOnlyActionVisible && (
                <View className="absolute bottom-0 w-full p-3 bg-white border-t border-gray-200">
                    {friendshipStatus === 'pending_received' ? (
                        <View className="flex-row mb-2">
                            <TouchableOpacity
                                onPress={onAcceptFriendRequest}
                                disabled={friendActionLoading || !onAcceptFriendRequest}
                                className="flex-1 py-3 rounded-lg bg-blue-500 items-center mr-2"
                                style={{ opacity: friendActionLoading ? 0.7 : 1 }}
                            >
                                <Text className="text-white font-semibold">
                                    {friendActionLoading ? t('common.processing') : t('contacts.acceptRequest')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onRejectFriendRequest}
                                disabled={friendActionLoading || !onRejectFriendRequest}
                                className="flex-1 py-3 rounded-lg bg-gray-200 items-center"
                                style={{ opacity: friendActionLoading ? 0.7 : 1 }}
                            >
                                <Text className="text-gray-700 font-semibold">{t('contacts.rejectRequest')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={friendPrimaryAction}
                            disabled={friendActionLoading || !friendPrimaryAction || friendshipStatus === 'accepted'}
                            className={`w-full py-3 rounded-lg items-center mb-2 ${friendPrimaryStyle}`}
                            style={{ opacity: friendActionLoading ? 0.7 : 1 }}
                        >
                            <Text className={`font-semibold ${friendPrimaryTextStyle}`}>
                                {friendActionLoading ? t('common.processing') : friendPrimaryLabel}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        onPress={onStartChat}
                        disabled={chatActionLoading || !onStartChat}
                        className="w-full py-3 rounded-lg bg-indigo-500 flex-row items-center justify-center"
                        style={{ opacity: chatActionLoading ? 0.7 : 1 }}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="white" />
                        <Text className="text-white font-semibold ml-2">
                            {chatActionLoading ? t('chat.opening') : t('contacts.sendMessage')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>

        {/* VIP Purchase Modal */}
        {!readOnly && (
            <VipPurchaseModal
                visible={showVipModal}
                onClose={() => { setShowVipModal(false); }}
                accountId={accountId}
                currentTier={vipTier}
            />
        )}
            {showRegulationsModal && (
                <LiveRegulationsModal 
                    visible={showRegulationsModal} 
                    onClose={() => setShowRegulationsModal(false)} 
                />
            )}
        </>
    );
}