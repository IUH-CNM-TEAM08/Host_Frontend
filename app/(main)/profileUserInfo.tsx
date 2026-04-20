import React from "react";
import {ImageSourcePropType, ScrollView, Switch, Text, TouchableOpacity, View} from "react-native";
import {Ionicons} from '@expo/vector-icons';
import CoverImage from "@/src/components/profile/CoverImage";
import AvatarImage from "@/src/components/profile/AvatarImage";
import ProfileInfoItem from "@/src/components/profile/ProfileInfoItem";
import ModalHeader from "@/src/components/profile/ModelHeader";
import {User} from "@/src/models/User";
import {formatDate} from "@/src/utils/DateTime";

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

const genders: Record<Gender, string> = {
    "male": "Nam",
    "female": "Nữ",
    "other": "Khác"
};

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
    const rawGender = String(user?.gender ?? '').toLowerCase();
    const userGender = (rawGender === 'male' || rawGender === 'female' || rawGender === 'other'
        ? rawGender
        : 'other') as Gender;

    const displayName = user?.name || user?.displayName || 'Người dùng';
    const rawDob = user?.dob || user?.dateOfBirth;
    const dob = rawDob ? formatDate(rawDob) : 'Chưa cập nhật';
    const gender = genders[userGender] || 'Chưa cập nhật';
    const phone = user?.phone || user?.phoneNumber || 'Chưa cập nhật';

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
            ? 'Gửi lời mời kết bạn'
            : friendshipStatus === 'pending_sent'
                ? 'Thu hồi lời mời'
                : 'Đã là bạn bè';

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
        <View className="flex-1 bg-white">
            <ModalHeader
                title={readOnly ? 'Thông tin cá nhân' : 'Thông tin tài khoản'}
                onRightPress={onClose}
                rightIconName="close"
            />

            <ScrollView className="flex-1 bg-gray-100 pb-16">
                <View className="items-center mb-2 mt-4 bg-white p-2">
                    <CoverImage customSource={cover} onPickImage={onPickCover} editable={!readOnly}/>
                    <AvatarImage customSource={avatar} onPickImage={onPickAvatar} editable={!readOnly}/>

                    <Text className="text-xl font-bold">{displayName}</Text>
                </View>

                <View className="mt-2 bg-white p-4">
                    <Text className="text-base font-bold text-gray-800 mb-4">Thông tin cá nhân</Text>

                    <ProfileInfoItem label="Giới tính" value={gender}/>
                    <ProfileInfoItem label="Ngày sinh" value={dob}/>
                    <ProfileInfoItem label="Điện thoại" value={phone}/>

                    <View className="mb-2">
                        <Text className="text-xs text-gray-500 mt-2">
                            Chỉ bạn bè có lưu số của bạn trong danh bạ mới xem được số này
                        </Text>
                    </View>
                </View>

                {!readOnly && (
                    <View className="mt-2 bg-white p-4">
                        <Text className="text-base font-bold text-gray-800 mb-4">Quyền riêng tư tin nhắn</Text>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-medium text-gray-800">
                                    Nhận tin nhắn từ người lạ
                                </Text>
                                <Text className="text-xs text-gray-500 mt-1">
                                    Tắt mục này thì người lạ không thể bắt đầu chat với bạn.
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
                        <View className="flex-row items-center justify-between mt-4">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-medium text-gray-800">
                                    Nhận cuộc gọi từ người lạ
                                </Text>
                                <Text className="text-xs text-gray-500 mt-1">
                                    Tắt mục này thì người lạ không thể gọi điện cho bạn.
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
                        <View className="flex-row items-center justify-between mt-4">
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-medium text-gray-800">
                                    Cho phép người lạ mời vào nhóm
                                </Text>
                                <Text className="text-xs text-gray-500 mt-1">
                                    Tắt mục này thì người lạ không thể mời bạn vào nhóm.
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
                        <Text className="text-white font-medium ml-2">Cập nhật</Text>
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
                                    {friendActionLoading ? 'Đang xử lý...' : 'Đồng ý kết bạn'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onRejectFriendRequest}
                                disabled={friendActionLoading || !onRejectFriendRequest}
                                className="flex-1 py-3 rounded-lg bg-gray-200 items-center"
                                style={{ opacity: friendActionLoading ? 0.7 : 1 }}
                            >
                                <Text className="text-gray-700 font-semibold">Từ chối</Text>
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
                                {friendActionLoading ? 'Đang xử lý...' : friendPrimaryLabel}
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
                            {chatActionLoading ? 'Đang mở...' : 'Nhắn tin'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}