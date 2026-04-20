import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View, Switch, Alert, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '@/src/models/Conversation';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';

interface GroupManagementModalProps {
    visible: boolean;
    onClose: () => void;
    selectChat: Conversation | null;
}

export default function GroupManagementModal({ visible, onClose, selectChat }: GroupManagementModalProps) {
    const isDesktop = useWindowDimensions().width >= 768;
    
    // Local state for toggles, initialized from selectChat.settings
    const [settings, setSettings] = useState({
        isAllowMessaging: true,
        isAllowMemberChangeMetadata: true,
        isAllowMemberPin: true,
        isAllowMemberCreateNote: true,
        isAllowMemberCreatePoll: true,
        isAllowModManage: true,
    });
    const [loading, setLoading] = useState(false);

    // Chỉ sync khi modal mở lần đầu (visible chuyển từ false → true)
    useEffect(() => {
        if (visible && selectChat?.settings) {
            setSettings({
                isAllowMessaging: selectChat.settings.isAllowMessaging ?? true,
                isAllowMemberChangeMetadata: selectChat.settings.isAllowMemberChangeMetadata ?? true,
                isAllowMemberPin: selectChat.settings.isAllowMemberPin ?? true,
                isAllowMemberCreateNote: selectChat.settings.isAllowMemberCreateNote ?? true,
                isAllowMemberCreatePoll: selectChat.settings.isAllowMemberCreatePoll ?? true,
                isAllowModManage: selectChat.settings.isAllowModManage ?? true,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, selectChat?.id]);

    const handleToggle = async (key: keyof typeof settings) => {
        if (!selectChat?.id || loading) return;
        
        const nextValue = !settings[key];
        const prevSettings = { ...settings };
        
        // Optimistic update
        setSettings(prev => ({ ...prev, [key]: nextValue }));
        setLoading(true);

        try {
            const res = await ConversationService.updateGroupSettings(selectChat.id, {
                [key]: nextValue
            });
            if (!res.success) {
                throw new Error(res.message || 'Cập nhật thất bại');
            }
            // Cập nhật selectChat.settings để tránh useEffect revert
            if (selectChat.settings) {
                (selectChat.settings as any)[key] = nextValue;
            }
        } catch (error: any) {
            Alert.alert('Lỗi', error.message || 'Không thể cập nhật cài đặt');
            setSettings(prevSettings); // Rollback
        } finally {
            setLoading(false);
        }
    };

    const SettingRow = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
        <View className="flex-row items-center justify-between py-4 border-b border-gray-50">
            <Text className="text-[15px] font-medium text-gray-800 flex-1 mr-4">{label}</Text>
            <Switch
                trackColor={{ false: "#e5e7eb", true: "#3b82f6" }}
                thumbColor={Platform.OS === 'ios' ? undefined : "#fff"}
                ios_backgroundColor="#e5e7eb"
                onValueChange={onToggle}
                value={value}
                disabled={loading}
            />
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/30 items-center">
                <View style={{
                    width: isDesktop ? 450 : '100%',
                    height: isDesktop ? 550 : '100%',
                    borderRadius: isDesktop ? 16 : 0,
                    overflow: 'hidden',
                    marginTop: isDesktop ? 100 : 0
                }}>
                    <View style={{
                        flex: 1,
                        backgroundColor: 'white',
                        marginTop: isDesktop ? 0 : 64,
                        borderTopLeftRadius: isDesktop ? 0 : 24,
                        borderTopRightRadius: isDesktop ? 0 : 24
                    }}>
                        {/* Header */}
                        <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
                            <TouchableOpacity onPress={onClose} className="p-1">
                                <Ionicons name="chevron-back" size={24} color="#1f2937" />
                            </TouchableOpacity>
                            <Text className="text-lg font-bold text-gray-900 ml-2">Quản lý nhóm</Text>
                        </View>

                        <ScrollView className="flex-1 px-5 pt-4">
                            <Text className="text-sm font-semibold text-gray-500 mb-2">Cho phép các thành viên trong nhóm:</Text>
                            
                            <SettingRow
                                label="Thay đổi tên & ảnh đại diện của nhóm"
                                value={settings.isAllowMemberChangeMetadata}
                                onToggle={() => handleToggle('isAllowMemberChangeMetadata')}
                            />
                            
                            <SettingRow
                                label="Ghim tin nhắn, ghi chú, bình chọn lên đầu hội thoại"
                                value={settings.isAllowMemberPin}
                                onToggle={() => handleToggle('isAllowMemberPin')}
                            />
                            
                            <SettingRow
                                label="Tạo mới ghi chú, nhắc hẹn"
                                value={settings.isAllowMemberCreateNote}
                                onToggle={() => handleToggle('isAllowMemberCreateNote')}
                            />
                            
                            <SettingRow
                                label="Tạo mới bình chọn"
                                value={settings.isAllowMemberCreatePoll}
                                onToggle={() => handleToggle('isAllowMemberCreatePoll')}
                            />
                            
                            <SettingRow
                                label="Gửi tin nhắn"
                                value={settings.isAllowMessaging}
                                onToggle={() => handleToggle('isAllowMessaging')}
                            />

                            <View className="mt-6 mb-2">
                                <Text className="text-sm font-semibold text-gray-500">Quyền Phó nhóm:</Text>
                            </View>

                            <SettingRow
                                label="Cho phép Phó nhóm kiểm duyệt, quản lý thành viên"
                                value={settings.isAllowModManage}
                                onToggle={() => handleToggle('isAllowModManage')}
                            />

                            {/* Info text or footer can go here */}
                            <View className="py-6">
                                <Text className="text-xs text-gray-400 text-center">
                                    Các thay đổi sẽ có hiệu lực ngay lập tức với tất cả thành viên.
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
