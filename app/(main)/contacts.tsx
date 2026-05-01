import React, { useState } from 'react';
import { View, TouchableOpacity, Text, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ContactList from '@/src/components/contacts/ContactList';
import FriendRequestList from '@/src/components/contacts/FriendRequestList';
import GroupList from '@/src/components/contacts/GroupList';
import GroupRequestList from '@/src/components/contacts/GroupRequestList';
import {useTranslation} from '@/src/contexts/i18n/I18nContext';

/** Khớp `_layout`: thanh tab mobile `height: 60 + insets.bottom` (absolute bottom) — cần chừa đáy để list cuộn hết. */
function useMobileTabBarBottomInset(): number {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isDesktopLayout = width > 768;
    if (isDesktopLayout) return 0;
    return 60 + insets.bottom;
}

export default function ContactsScreen() {
    const [activeTab, setActiveTab] = useState('contacts');
    const tabBarBottomInset = useMobileTabBarBottomInset();
    const {t} = useTranslation();

    const renderContent = () => {
        switch (activeTab) {
            case 'contacts':
                return <ContactList />;
            case 'requests':
                return <FriendRequestList />;
            case 'groups':
                return <GroupList />;
            case 'groupRequests':
                return <GroupRequestList />;
            default:
                return <ContactList />;
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Tab Bar */}
            <View className="border-b border-gray-200 bg-white">
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    className="px-2"
                >
                    <TouchableOpacity
                        className={`py-4 px-6 ${
                            activeTab === 'contacts' 
                            ? 'border-b-2 border-blue-500' 
                            : 'border-b-2 border-transparent'
                        }`}
                        onPress={() => setActiveTab('contacts')}
                    >
                        <Text 
                            className={`text-[16px] font-semibold ${
                                activeTab === 'contacts' ? 'text-blue-500' : 'text-gray-600'
                            }`}
                        >
                            {t('contacts.friends')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`py-4 px-6 ${
                            activeTab === 'requests' 
                            ? 'border-b-2 border-blue-500' 
                            : 'border-b-2 border-transparent'
                        }`}
                        onPress={() => setActiveTab('requests')}
                    >
                        <Text 
                            className={`text-[16px] font-semibold ${
                                activeTab === 'requests' ? 'text-blue-500' : 'text-gray-600'
                            }`}
                        >
                            {t('contacts.friendRequests')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`py-4 px-6 ${
                            activeTab === 'groups' 
                            ? 'border-b-2 border-blue-500' 
                            : 'border-b-2 border-transparent'
                        }`}
                        onPress={() => setActiveTab('groups')}
                    >
                        <Text 
                            className={`text-[16px] font-semibold ${
                                activeTab === 'groups' ? 'text-blue-500' : 'text-gray-600'
                            }`}
                        >
                            {t('contacts.groups')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className={`py-4 px-6 ${
                            activeTab === 'groupRequests' 
                            ? 'border-b-2 border-blue-500' 
                            : 'border-b-2 border-transparent'
                        }`}
                        onPress={() => setActiveTab('groupRequests')}
                    >
                        <Text 
                            className={`text-[16px] font-semibold ${
                                activeTab === 'groupRequests' ? 'text-blue-500' : 'text-gray-600'
                            }`}
                        >
                            {t('contacts.groupInviteRequests')}
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Content — paddingBottom để ScrollView/FlatList không chìm dưới tab bar cố định */}
            <View className="flex-1" style={{ minHeight: 0, paddingBottom: tabBarBottomInset }}>
                {renderContent()}
            </View>
        </View>
    );
}

