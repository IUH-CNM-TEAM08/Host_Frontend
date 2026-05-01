import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    ScrollView,
    TouchableOpacity,
    Modal,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CreateGroup from './CreateGroup';
import { conversationService as ConversationService } from '@/src/api/services/conversation.service';
import { Conversation } from '@/src/models/Conversation';
import SocketService from '@/src/api/socketCompat';
import { useUser } from '@/src/contexts/user/UserContext';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';

interface GroupListProps {
    onGroupPress?: (group: Conversation) => void;
}

export default function GroupList({ onGroupPress }: GroupListProps = {}) {
    const router = useRouter();
    const { user } = useUser();
    const { t } = useTranslation();
    const [isCreateGroupVisible, setIsCreateGroupVisible] = useState(false);
    const [showJoinByUrl, setShowJoinByUrl] = useState(false);
    const [joinUrl, setJoinUrl] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);
    const [groups, setGroups] = useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchGroups = async () => {
        try {
            const response = await ConversationService.getConversations();
            const groupOnly = response.conversations.filter(
                g => g.isGroup || g.type === 'group' || g.type === 'GROUP'
            );
            setGroups(groupOnly);
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    useEffect(() => {
        const socket = SocketService.getInstance();

        const onJoinApproved = () => {
            void fetchGroups();
        };

        const onParticipantsAdded = (payload: { participantIds?: string[] }) => {
            const joinedIds = Array.isArray(payload?.participantIds)
                ? payload.participantIds.map((id) => String(id))
                : [];
            if (user?.id && joinedIds.length > 0 && !joinedIds.includes(String(user.id))) return;
            void fetchGroups();
        };

        socket.onGroupJoinApproved(onJoinApproved);
        socket.onParticipantsAddedServer(onParticipantsAdded);

        return () => {
            socket.removeGroupJoinApprovedListener(onJoinApproved);
            socket.removeParticipantsAddedServer(onParticipantsAdded);
        };
    }, [user?.id]);

    // Lọc theo searchQuery
    const filteredGroups = searchQuery.trim()
        ? groups.filter(g => g.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : groups;

    const extractJoinParams = (input: string): { conversationId?: string; code?: string } | null => {
        const raw = String(input || '').trim();
        if (!raw) return null;

        const tryRead = (candidate: string) => {
            const params = new URLSearchParams(candidate);
            const conversationId = (params.get('conversationId') || params.get('id') || '').trim();
            const code = (params.get('code') || '').trim();
            if (conversationId && code) return { conversationId, code };
            return null;
        };

        // URL đầy đủ: https://.../join?conversationId=...&code=...
        try {
            const parsed = new URL(raw);
            const fromSearch = tryRead(parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search);
            if (fromSearch) return fromSearch;

            // fallback dạng /join/<conversationId>?code=...
            const maybeIdFromJoinPath = parsed.pathname.includes('/join/')
                ? parsed.pathname.split('/join/')[1]?.split('/')[0]?.trim()
                : '';
            const maybeCodeFromSearch = (new URLSearchParams(parsed.search).get('code') || '').trim();
            if (maybeIdFromJoinPath && maybeCodeFromSearch) {
                return { conversationId: maybeIdFromJoinPath, code: maybeCodeFromSearch };
            }

            // support /group/<codeOrId>
            const maybeAnyIdFromGroupPath = parsed.pathname.includes('/group/')
                ? parsed.pathname.split('/group/')[1]?.split('/')[0]?.trim()
                : '';
            if (maybeAnyIdFromGroupPath) {
                // Nếu là UUID thì coi là conversationId, nếu không thì coi là code
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maybeAnyIdFromGroupPath);
                return isUuid ? { conversationId: maybeAnyIdFromGroupPath } : { code: maybeAnyIdFromGroupPath };
            }
        } catch {
            // noop: có thể người dùng chỉ paste query string hoặc mã thuần
        }

        // Query string thuần: conversationId=...&code=...
        const fromQuery = tryRead(raw.startsWith('?') ? raw.slice(1) : raw);
        if (fromQuery) return fromQuery;

        // Nếu chỉ là một chuỗi ngắn (invite code) hoặc UUID thuần
        if (raw.length >= 8 && !raw.includes(' ') && !raw.includes('/')) {
             const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
             return isUuid ? { conversationId: raw } : { code: raw };
        }

        return null;
    };

    const handleJoinByUrl = async () => {
        if (!joinUrl.trim()) {
            Alert.alert(t('common.error'), t('contacts.joinLinkRequired'));
            return;
        }
        setJoinLoading(true);
        try {
            const params = extractJoinParams(joinUrl.trim());
            if (!params?.conversationId && !params?.code) {
                Alert.alert(t('common.error'), t('contacts.invalidJoinLink'));
                return;
            }

            setShowJoinByUrl(false);
            setJoinUrl('');
            router.push({
                pathname: '/(main)/join',
                params: {
                    conversationId: params.conversationId || '',
                    code: params.code || '',
                },
            } as any);
        } catch (e: any) {
            const msg =
                e?.response?.data?.message ||
                e?.response?.data?.error ||
                e?.message ||
                t('contacts.cannotJoinGroup');
            Alert.alert(t('common.error'), String(msg));
        } finally {
            setJoinLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-white">
            {/* Search Bar */}
            <View className="px-4 py-2 border-b border-gray-200">
                <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
                    <Ionicons name="search" size={20} color="#666" />
                    <TextInput
                        className="flex-1 ml-2 text-base text-gray-800"
                        placeholder={t('contacts.search') + '...'}
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
                className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-blue-50"
                onPress={() => setIsCreateGroupVisible(true)}
            >
                <View className="w-12 h-12 rounded-full bg-blue-500 items-center justify-center">
                    <Ionicons name="add" size={24} color="white" />
                </View>
                <Text className="ml-3 text-blue-500 font-medium">{t('contacts.createNewGroup')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-green-50"
                onPress={() => setShowJoinByUrl(true)}
            >
                <View className="w-12 h-12 rounded-full bg-green-500 items-center justify-center">
                    <Ionicons name="link-outline" size={22} color="white" />
                </View>
                <Text className="ml-3 text-green-600 font-medium">{t('contacts.joinGroupByLink')}</Text>
            </TouchableOpacity>

            {/* Groups List */}
            <ScrollView className="flex-1">
                {filteredGroups.length === 0 && (
                    <View className="flex-1 items-center justify-center py-10">
                        <Ionicons name="people-outline" size={48} color="#ccc" />
                        <Text className="text-gray-400 mt-2">{t('contacts.noGroupsFound')}</Text>
                    </View>
                )}
                {filteredGroups.map((group, index) => (
                    <TouchableOpacity
                        key={group.id || `group-${index}`}
                        className="flex-row items-center px-4 py-3 border-b border-gray-100"
                        onPress={() => onGroupPress?.(group)}
                    >
                        <Image
                            source={{ uri: group.avatarUrl || 'https://ui-avatars.com/api/?name=Group&background=3B82F6&color=fff' }}
                            resizeMode="cover"
                            className="w-12 h-12 rounded-full"
                        />
                        <View className="flex-1 ml-3">
                            <Text className="text-base font-medium text-gray-800">
                                {group.name || t('contacts.unnamedGroup')}
                            </Text>
                            <Text className="text-sm text-gray-500">
                                {(group.participantIds?.length ?? 0)} {t('contacts.members')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Create Group Modal */}
            <CreateGroup
                visible={isCreateGroupVisible}
                onClose={() => {
                    setIsCreateGroupVisible(false);
                    fetchGroups();
                }}
                onCreated={() => {
                    setIsCreateGroupVisible(false);
                    void fetchGroups();
                    router.replace({ pathname: '/', params: { createdGroup: '1' } } as any);
                }}
            />

            {/* Join by URL Modal */}
            <Modal visible={showJoinByUrl} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 6 }}>
                            {t('contacts.joinGroupByLink')}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                            {t('contacts.enterJoinLink')}
                        </Text>
                        <TextInput
                            style={{
                                borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
                                paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
                                color: '#111827', backgroundColor: '#F9FAFB', marginBottom: 16,
                            }}
                            placeholder={t('contacts.joinLinkPlaceholder')}
                            placeholderTextColor="#9CA3AF"
                            value={joinUrl}
                            onChangeText={setJoinUrl}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => { setShowJoinByUrl(false); setJoinUrl(''); }}
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' }}
                            >
                                <Text style={{ color: '#374151', fontWeight: '600' }}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleJoinByUrl}
                                disabled={joinLoading}
                                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center' }}
                            >
                                {joinLoading
                                    ? <ActivityIndicator size="small" color="white" />
                                    : <Text style={{ color: 'white', fontWeight: '600' }}>{t('common.confirm')}</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}