import React from 'react';
import { ActivityIndicator, View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';

interface ProfileInfoProps {
    avatar?: string;
    name?: string;
    isGroup: boolean;
    memberCount?: number;
    isOnline?: boolean;
    loading?: boolean;
    canEdit?: boolean;
    onAvatarPress?: () => void;
    onRenamePress?: () => void;
}

export default function ProfileInfo({
    avatar,
    name,
    isGroup,
    memberCount,
    isOnline,
    loading,
    canEdit,
    onAvatarPress,
    onRenamePress
}: ProfileInfoProps) {
    const { t } = useTranslation();
    return (
        <View className="items-center pt-8 pb-6 border-b-4 border-gray-100">
            {/* Avatar */}
            <TouchableOpacity
                disabled={!canEdit || loading}
                onPress={onAvatarPress}
                activeOpacity={0.7}
                className="mb-4 relative"
            >
                <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                    {loading ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                    ) : (
                        <Image
                            source={{
                                uri: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=0068FF&color=fff&size=96`
                            }}
                            className="w-24 h-24 rounded-full"
                            resizeMode="cover"
                        />
                    )}
                </View>
                {/* Camera badge for editing */}
                {canEdit && !loading && (
                    <View className="absolute bottom-0 right-0 w-7 h-7 bg-white rounded-full items-center justify-center shadow-md border border-gray-200">
                        <Ionicons name="camera" size={16} color="#4B5563" />
                    </View>
                )}
                {/* Online dot */}
                {!isGroup && isOnline && !loading && (
                    <View className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-full bg-emerald-500 border-[2.5px] border-white" />
                )}
            </TouchableOpacity>

            {/* Name Container */}
            <View className="flex-row items-center justify-center px-4">
                {loading ? (
                    <View className="h-5 w-32 rounded-full bg-gray-200 mb-2" />
                ) : (
                    <>
                        <Text className="text-[18px] font-bold text-gray-900 mr-2" numberOfLines={1}>
                            {name || t('chatArea.defaultUser')}
                        </Text>
                        {canEdit && (
                            <TouchableOpacity
                                onPress={onRenamePress}
                                className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center active:bg-gray-200"
                            >
                                <Ionicons name="pencil" size={14} color="#4B5563" />
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            {/* Status */}
            <Text className="text-sm mt-1" style={{ color: isOnline && !isGroup ? '#10b981' : '#9ca3af' }}>
                {isGroup
                    ? `${memberCount || 0} ${t('contacts.members')}`
                    : isOnline ? t('info.activeStatus') : t('info.inactiveStatus')}
            </Text>
        </View>
    );
}
