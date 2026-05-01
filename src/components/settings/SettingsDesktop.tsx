import React, {useState} from 'react';
import {ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useUser} from '@/src/contexts/user/UserContext';
import {router} from 'expo-router';
import ChangePasswordModal from './ChangePasswordModal';
import TwoFactorAuthModal from './TwoFactorAuthModal';
import DeviceAccessModalDesktop from './DeviceAccessModalDesktop';
import MessageBackupSettings from './MessageBackupSettings';
import LanguageSwitcher from './LanguageSwitcher';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

type Category = 'security' | 'devices' | 'notifications' | 'language';

interface NavItem {
    key: Category;
    icon: string;
    labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
    { key: 'security',      icon: 'shield-checkmark-outline', labelKey: 'settings.security' },
    { key: 'devices',       icon: 'phone-portrait-outline',   labelKey: 'settings.devices' },
    { key: 'notifications', icon: 'notifications-outline',    labelKey: 'settings.notifications' },
    { key: 'language',      icon: 'language-outline',         labelKey: 'settings.language' },
];

export default function SettingsDesktop() {
    const {logout} = useUser();
    const {t} = useTranslation();
    const [activeCategory, setActiveCategory] = useState<Category>('security');
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showTwoFactorAuth, setShowTwoFactorAuth] = useState(false);
    const [showDeviceAccess, setShowDeviceAccess] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            router.replace('/(auth)');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const categoryTitle: Record<Category, string> = {
        security:      t('settings.security'),
        devices:       t('settings.devices'),
        notifications: t('settings.notifications'),
        language:      t('settings.language'),
    };

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="bg-white border-b border-gray-200">
                <View className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <View className="py-6">
                        <Text className="text-2xl font-bold text-gray-900">{t('settings.title')}</Text>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 24 }}>
                <View className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <View className="flex flex-col md:flex-row gap-8">

                        {/* Sidebar Navigation */}
                        <View className="w-full md:w-64 bg-white rounded-lg shadow-sm p-4 h-fit">
                            <Text className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
                                {t('settings.category')}
                            </Text>
                            <View className="space-y-1">
                                {NAV_ITEMS.map((item) => {
                                    const isActive = activeCategory === item.key;
                                    return (
                                        <TouchableOpacity
                                            key={item.key}
                                            className={`flex-row items-center p-3 rounded-md ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                            onPress={() => setActiveCategory(item.key)}
                                        >
                                            <Ionicons
                                                name={item.icon as any}
                                                size={20}
                                                color={isActive ? '#3B82F6' : '#6B7280'}
                                            />
                                            <Text className={`ml-3 ${isActive ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                                                {t(item.labelKey)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Main Content */}
                        <View className="flex-1">
                            <View className="bg-white rounded-lg shadow-sm p-6">
                                <Text className="text-xl font-semibold text-gray-900 mb-6">
                                    {categoryTitle[activeCategory]}
                                </Text>

                                <View className="space-y-6">
                                    {/* ── Security ─────────────────────────────── */}
                                    {activeCategory === 'security' && (
                                        <>
                                            {/* Password */}
                                            <View className="border-b border-gray-200 pb-6">
                                                <View className="flex-row justify-between items-center mb-4">
                                                    <View>
                                                        <Text className="text-lg font-medium text-gray-900">
                                                            {t('settings.changePassword')}
                                                        </Text>
                                                        <Text className="text-sm text-gray-500">
                                                            {t('settings.changePasswordDesc')}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        className="px-4 py-2 bg-blue-50 rounded-md"
                                                        onPress={() => setShowChangePassword(true)}
                                                    >
                                                        <Text className="text-blue-700 font-medium">
                                                            {t('settings.changePassword')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* 2FA */}
                                            <View className="border-b border-gray-200 pb-6">
                                                <View className="flex-row justify-between items-center mb-4">
                                                    <View>
                                                        <Text className="text-lg font-medium text-gray-900">
                                                            {t('settings.twoFactorFull')}
                                                        </Text>
                                                        <Text className="text-sm text-gray-500">
                                                            {t('settings.twoFactorDesc')}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        className="px-4 py-2 bg-blue-50 rounded-md"
                                                        onPress={() => setShowTwoFactorAuth(true)}
                                                    >
                                                        <Text className="text-blue-700 font-medium">
                                                            {t('settings.setup')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <MessageBackupSettings />
                                        </>
                                    )}

                                    {/* ── Devices ──────────────────────────────── */}
                                    {activeCategory === 'devices' && (
                                        <View className="border-b border-gray-200 pb-6">
                                            <View className="flex-row justify-between items-center mb-4">
                                                <View>
                                                    <Text className="text-lg font-medium text-gray-900">
                                                        {t('settings.manageDevices')}
                                                    </Text>
                                                    <Text className="text-sm text-gray-500">
                                                        {t('settings.manageDevicesDesc')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    className="px-4 py-2 bg-blue-50 rounded-md"
                                                    onPress={() => setShowDeviceAccess(true)}
                                                >
                                                    <Text className="text-blue-700 font-medium">
                                                        {t('settings.manage')}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {/* ── Notifications ────────────────────────── */}
                                    {activeCategory === 'notifications' && (
                                        <View className="border-b border-gray-200 pb-6">
                                            <Text className="text-sm text-gray-500">
                                                {t('settings.notificationsNotReady')}
                                            </Text>
                                        </View>
                                    )}

                                    {/* ── Language ─────────────────────────────── */}
                                    {activeCategory === 'language' && (
                                        <View className="border-b border-gray-200 pb-6">
                                            <LanguageSwitcher />
                                        </View>
                                    )}

                                    {/* ── Logout ───────────────────────────────── */}
                                    <View>
                                        <View className="flex-row justify-between items-center">
                                            <View>
                                                <Text className="text-lg font-medium text-gray-900">
                                                    {t('settings.logout')}
                                                </Text>
                                                <Text className="text-sm text-gray-500">
                                                    {t('settings.logoutDesc')}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                className="px-4 py-2 bg-red-50 rounded-md"
                                                onPress={handleLogout}
                                            >
                                                <Text className="text-red-700 font-medium">
                                                    {t('settings.logout')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
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

            <DeviceAccessModalDesktop
                visible={showDeviceAccess}
                onClose={() => setShowDeviceAccess(false)}
            />
        </View>
    );
}