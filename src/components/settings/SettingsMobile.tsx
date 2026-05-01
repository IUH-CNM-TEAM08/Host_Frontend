import React, {useState} from 'react';
import {ScrollView, Text, TouchableOpacity, View} from "react-native";
import {Ionicons} from "@expo/vector-icons";
import {useUser} from '@/src/contexts/user/UserContext';
import {router} from 'expo-router';
import ChangePasswordModal from './ChangePasswordModal';
import TwoFactorAuthModal from './TwoFactorAuthModal';
import DeviceAccessModal from './DeviceAccessModal';
import MessageBackupSettings from './MessageBackupSettings';
import ProfileModal from '@/app/(main)/profileUser';
import LanguageSwitcher from './LanguageSwitcher';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

export default function SettingsMobile() {
    const {logout} = useUser();
    const {t} = useTranslation();
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showTwoFactorAuth, setShowTwoFactorAuth] = useState(false);
    const [showDeviceAccess, setShowDeviceAccess] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showLanguage, setShowLanguage] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            router.replace('/(auth)');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Header */}
            <View className="border-b border-gray-200">
                <View className="flex-row items-center p-4">
                    <Text className="text-xl font-semibold">{t('settings.title')}</Text>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator
                contentContainerStyle={{ paddingBottom: 24 }}
            >
                {/* Account Section */}
                <View className="p-4 space-y-4">
                    <Text className="text-lg font-semibold text-gray-800">{t('settings.account')}</Text>
                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
                        onPress={() => setShowAccountModal(true)}
                    >
                        <View className="flex-row items-center space-x-3">
                            <Ionicons name="person-circle-outline" size={24} color="#4B5563"/>
                            <Text className="text-base text-gray-700">{t('settings.accountInfo')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF"/>
                    </TouchableOpacity>
                </View>

                {/* Security Section */}
                <View className="p-4 space-y-4">
                    <Text className="text-lg font-semibold text-gray-800">{t('settings.security')}</Text>

                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
                        onPress={() => setShowChangePassword(true)}
                    >
                        <View className="flex-row items-center space-x-3">
                            <Ionicons name="lock-closed-outline" size={24} color="#4B5563"/>
                            <Text className="text-base text-gray-700">{t('settings.changePassword')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF"/>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
                        onPress={() => setShowTwoFactorAuth(true)}
                    >
                        <View className="flex-row items-center space-x-3">
                            <Ionicons name="shield-checkmark-outline" size={24} color="#4B5563"/>
                            <Text className="text-base text-gray-700">{t('settings.twoFactor')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF"/>
                    </TouchableOpacity>

                    <MessageBackupSettings />
                </View>

                {/* Access Section */}
                <View className="p-4 space-y-4">
                    <Text className="text-lg font-semibold text-gray-800">{t('settings.access')}</Text>

                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
                        onPress={() => setShowDeviceAccess(true)}
                    >
                        <View className="flex-row items-center space-x-3">
                            <Ionicons name="phone-portrait-outline" size={24} color="#4B5563"/>
                            <Text className="text-base text-gray-700">{t('settings.manageDevices')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF"/>
                    </TouchableOpacity>
                </View>

                {/* Language Section */}
                <View className="p-4 space-y-4">
                    <TouchableOpacity
                        className="flex-row items-center justify-between"
                        onPress={() => setShowLanguage(prev => !prev)}
                        activeOpacity={0.7}
                    >
                        <View className="flex-row items-center space-x-3">
                            <Ionicons name="language-outline" size={24} color="#4B5563"/>
                            <Text className="text-lg font-semibold text-gray-800">{t('settings.language')}</Text>
                        </View>
                        <Ionicons
                            name={showLanguage ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#9CA3AF"
                        />
                    </TouchableOpacity>

                    {showLanguage && (
                        <View className="mt-2">
                            <LanguageSwitcher />
                        </View>
                    )}
                </View>

                {/* Logout */}
                <View className="p-4 space-y-4">
                    <TouchableOpacity
                        className="flex-row items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
                        onPress={handleLogout}
                    >
                        <View className="flex-row items-center space-x-3">
                            <Ionicons name="log-out-outline" size={24} color="#EF4444"/>
                            <Text className="text-base text-red-500">{t('settings.logout')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF"/>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <ChangePasswordModal
                visible={showChangePassword}
                onClose={() => setShowChangePassword(false)}
            />

            <TwoFactorAuthModal
                visible={showTwoFactorAuth}
                onClose={() => setShowTwoFactorAuth(false)}
            />

            <DeviceAccessModal
                visible={showDeviceAccess}
                onClose={() => setShowDeviceAccess(false)}
            />

            <ProfileModal
                visible={showAccountModal}
                onClose={() => setShowAccountModal(false)}
            />
        </View>
    );
}
