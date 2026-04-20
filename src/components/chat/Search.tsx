import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { messageService as MessageService } from '@/src/api/services/message.service';
import SocketService from '@/src/api/socketCompat';
import { mapApiMessageToModel } from '@/src/models/mappers';
import { Message, MessageType } from '@/src/models/Message';
import { ParticipantInfo } from '@/src/models/Conversation';

interface SearchProps {
    isVisible: boolean;
    onClose: () => void;
    conversationId: string;
    /** Để lọc kết quả theo người gửi */
    participantInfo?: ParticipantInfo[];
}

type TabType = 'messages' | 'files' | 'media';

function formatTime(dateStr?: string | Date): string {
    if (!dateStr) return '';
    const d = new Date(dateStr as string);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExt(name: string): string {
    return (name.split('.').pop() ?? '').toLowerCase();
}

function getFileIcon(ext: string): keyof typeof Ionicons.glyphMap {
    switch (ext) {
        case 'pdf': return 'document-text-outline';
        case 'docx': case 'doc': return 'document-outline';
        case 'xlsx': case 'xls': return 'grid-outline';
        case 'zip': case 'rar': return 'folder-outline';
        default: return 'document-outline';
    }
}

/**
 * Màu khớp ChatArea / panel Info (light).
 * Không dùng useColorScheme(): OS/trình duyệt dark trong khi app chat vẫn light → panel Tìm kiếm bị lệch.
 * Khi toàn app có dark mode thật, nối theme chung vào đây.
 */
function useSearchTheme() {
    return useMemo(
        () => ({
            bg: '#ffffff',
            surface: '#f3f4f6',
            surfaceElevated: '#ffffff',
            border: '#e5e7eb',
            text: '#111827',
            textSecondary: '#6b7280',
            textMuted: '#9ca3af',
            tint: '#6d28d9',
            overlay: 'rgba(0,0,0,0.45)',
            rowActive: '#ede9fe',
        }),
        [],
    );
}

export default function Search({ isVisible, onClose, conversationId, participantInfo = [] }: SearchProps) {
    const c = useSearchTheme();
    const insets = useSafeAreaInsets();
    const mobileTopInset = Platform.OS === 'web' ? 0 : Math.max(insets.top, 8);
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('messages');
    const [allMessages, setAllMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    /** null = tất cả người gửi */
    const [senderFilterId, setSenderFilterId] = useState<string | null>(null);
    const [senderPickerOpen, setSenderPickerOpen] = useState(false);

    // Load tất cả messages 1 lần khi mở
    useEffect(() => {
        if (!isVisible || !conversationId) return;
        setLoading(true);
        MessageService.getMessages(conversationId, 0, 500).then(res => {
            if (res.success) {
                setAllMessages(res.messages.filter((m: any) => !m.isDeletedForEveryone));
            }
        }).finally(() => setLoading(false));
    }, [isVisible, conversationId]);

    useEffect(() => {
        if (!isVisible || !conversationId) return;
        const socket = SocketService.getInstance();
        const handleDeletedForEveryone = (payload: any) => {
            const messageId = String(
                payload?.messageId ?? payload?.id ?? payload?._id ?? payload?.message?._id ?? payload?.message?.id ?? ''
            );
            if (!messageId) return;
            const conversationIdFromPayload = String(
                payload?.conversationId ?? payload?.message?.conversationId ?? ''
            );
            if (conversationIdFromPayload && conversationIdFromPayload !== conversationId) return;
            setAllMessages((prev) => prev.filter((m) => String(m.id ?? m._id) !== messageId));
        };

        const handleNewMessage = (raw: any) => {
            const payload = raw?.message && typeof raw.message === 'object' ? raw.message : raw;
            if (!payload || String(payload?.conversationId) !== conversationId) return;
            const messageId = String(payload?.id ?? payload?._id ?? payload?.messageId ?? '');
            if (!messageId) return;
            if (payload?.isDeletedForEveryone) return;
            const mapped = mapApiMessageToModel(payload);
            setAllMessages((prev) => {
                if (prev.some((m) => String(m.id ?? m._id) === messageId)) return prev;
                return [...prev, mapped];
            });
        };

        socket.onMessageDeletedForEveryone(handleDeletedForEveryone);
        socket.onNewMessage(handleNewMessage);
        return () => {
            socket.removeMessageDeletedForEveryoneListener(handleDeletedForEveryone);
            socket.removeMessageListener(handleNewMessage);
        };
    }, [isVisible, conversationId]);

    // Reset khi đóng
    useEffect(() => {
        if (!isVisible) {
            setSearchText('');
            setActiveTab('messages');
            setSenderFilterId(null);
            setSenderPickerOpen(false);
        }
    }, [isVisible]);

    const q = searchText.trim().toLowerCase();

    const messagesInScope = useMemo(
        () =>
            allMessages.filter(
                (m) =>
                    senderFilterId == null || String(m.senderId) === String(senderFilterId),
            ),
        [allMessages, senderFilterId],
    );

    // Lọc tin nhắn text
    const filteredMessages = messagesInScope.filter(
        (m) =>
            m.type === MessageType.TEXT &&
            (q === '' || (m.content || '').toLowerCase().includes(q)),
    );

    // Lọc ảnh/video
    const mediaItems: { uri: string; date: string }[] = [];
    for (const m of messagesInScope) {
        if (m.type === MessageType.IMAGE || m.type === MessageType.VIDEO) {
            const meta = m.metadata as any;
            const url = meta?.cdnUrl ?? meta?.url ?? meta?.imageUrl;
            if (url && (q === '' || url.toLowerCase().includes(q)))
                mediaItems.push({ uri: url, date: formatTime(m.sentAt) });
        }
        if (m.type === MessageType.MEDIA_ALBUM && Array.isArray(m.mediaItems)) {
            for (const item of m.mediaItems) {
                const u = item.cdnUrl || (item as any).url;
                if (u && (q === '' || u.toLowerCase().includes(q)))
                    mediaItems.push({ uri: u, date: formatTime(m.sentAt) });
            }
        }
    }

    // Lọc file
    const fileItems: { name: string; size: string; ext: string; date: string; url?: string }[] = [];
    for (const m of messagesInScope) {
        if (m.type === MessageType.FILE) {
            const meta = m.metadata as any;
            const name = meta?.fileName ?? m.content ?? 'file';
            if (q === '' || name.toLowerCase().includes(q))
                fileItems.push({
                    name,
                    size: formatSize(meta?.fileSize),
                    ext: getExt(name),
                    date: formatTime(m.sentAt),
                    url: meta?.cdnUrl ?? meta?.url,
                });
        }
    }

    const senderLabel = (id: string) => {
        const p = participantInfo.find((x) => String(x.id) === String(id));
        return (p?.nickname || p?.name || 'Thành viên').trim();
    };

    if (!isVisible) return null;

    const TABS: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { key: 'messages', label: 'Tin nhắn', icon: 'chatbubble-outline' },
        { key: 'media',    label: 'Ảnh/Video', icon: 'image-outline' },
        { key: 'files',    label: 'File',       icon: 'document-outline' },
    ];

    const senderSummaryLabel =
        senderFilterId == null ? 'Tất cả' : senderLabel(senderFilterId);

    const selectSender = (id: string | null) => {
        setSenderFilterId(id);
        setSenderPickerOpen(false);
    };

    return (
        <View
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: c.bg,
                zIndex: 50,
                paddingTop: mobileTopInset,
            }}
        >
            {/* Header */}
            <View
                style={{
                    height: 56,
                    paddingHorizontal: 16,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <View
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: c.surface,
                        borderRadius: 999,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                    }}
                >
                    <Ionicons name="search-outline" size={18} color={c.textSecondary} />
                    <TextInput
                        style={{ flex: 1, marginLeft: 8, fontSize: 16, color: c.text, paddingVertical: 0 }}
                        placeholder="Tìm kiếm..."
                        placeholderTextColor={c.textMuted}
                        value={searchText}
                        onChangeText={setSearchText}
                        autoFocus
                    />
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={18} color={c.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: c.tint, fontWeight: '600', fontSize: 16 }}>Đóng</Text>
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View
                style={{
                    flexDirection: 'row',
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                    backgroundColor: c.bg,
                }}
            >
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'row',
                            gap: 4,
                            paddingVertical: 12,
                            borderBottomWidth: activeTab === tab.key ? 2 : 0,
                            borderBottomColor: c.tint,
                        }}
                    >
                        <Ionicons
                            name={tab.icon}
                            size={15}
                            color={activeTab === tab.key ? c.tint : c.textMuted}
                        />
                        <Text
                            style={{
                                color: activeTab === tab.key ? c.tint : c.textSecondary,
                                fontSize: 13,
                                fontWeight: activeTab === tab.key ? '600' : '400',
                            }}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {participantInfo.length > 0 && (
                <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, paddingBottom: 8 }}>
                    <Text
                        style={{
                            fontSize: 11,
                            color: c.textSecondary,
                            paddingHorizontal: 16,
                            paddingTop: 10,
                            paddingBottom: 6,
                            fontWeight: '600',
                            letterSpacing: 0.6,
                            textTransform: 'uppercase',
                        }}
                    >
                        Lọc theo người gửi
                    </Text>
                    <TouchableOpacity
                        onPress={() => setSenderPickerOpen(true)}
                        activeOpacity={0.7}
                        style={{
                            marginHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: c.border,
                            backgroundColor: c.surfaceElevated,
                        }}
                    >
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 12, color: c.textSecondary, marginBottom: 2 }}>Người gửi</Text>
                            <Text style={{ fontSize: 15, color: c.text, fontWeight: '500' }} numberOfLines={1}>
                                {senderSummaryLabel}
                            </Text>
                        </View>
                        <Ionicons name="chevron-down" size={22} color={c.textSecondary} />
                    </TouchableOpacity>
                </View>
            )}

            <Modal
                visible={senderPickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setSenderPickerOpen(false)}
            >
                <View style={styles.modalRoot}>
                    <Pressable style={[styles.modalBackdrop, { backgroundColor: c.overlay }]} onPress={() => setSenderPickerOpen(false)} />
                    <View
                        style={[styles.modalCard, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <Text style={[styles.modalTitle, { color: c.text, borderBottomColor: c.border }]}>Chọn người gửi</Text>
                        <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                            <TouchableOpacity
                                style={[
                                    styles.modalRow,
                                    senderFilterId == null && { backgroundColor: c.rowActive },
                                ]}
                                onPress={() => selectSender(null)}
                            >
                                <Text style={{ flex: 1, fontSize: 16, color: c.text }}>Tất cả</Text>
                                {senderFilterId == null && (
                                    <Ionicons name="checkmark" size={20} color={c.tint} />
                                )}
                            </TouchableOpacity>
                            {participantInfo.map((p) => {
                                const id = String(p.id);
                                const selected = senderFilterId === id;
                                const label = p.nickname || p.name || 'Thành viên';
                                return (
                                    <TouchableOpacity
                                        key={id}
                                        style={[styles.modalRow, selected && { backgroundColor: c.rowActive }]}
                                        onPress={() => selectSender(id)}
                                    >
                                        <Text style={{ flex: 1, fontSize: 16, color: c.text }} numberOfLines={1}>
                                            {label}
                                        </Text>
                                        {selected && <Ionicons name="checkmark" size={20} color={c.tint} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Content */}
            {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={c.tint} />
                    <Text style={{ color: c.textMuted, marginTop: 8, fontSize: 14 }}>Đang tải...</Text>
                </View>
            ) : (
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                    {/* ── Tab: Tin nhắn ── */}
                    {activeTab === 'messages' && (
                        filteredMessages.length === 0 ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
                                <Ionicons name="chatbubble-outline" size={40} color={c.textMuted} />
                                <Text style={{ color: c.textMuted, marginTop: 12, fontSize: 14 }}>
                                    {q ? 'Không tìm thấy tin nhắn' : 'Nhập từ khóa để tìm kiếm'}
                                </Text>
                            </View>
                        ) : (
                            filteredMessages.map((m, i) => (
                                <View
                                    key={m.id || i}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'flex-start',
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                        borderBottomColor: c.border,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            backgroundColor: c.surface,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 12,
                                            marginTop: 2,
                                        }}
                                    >
                                        <Ionicons name="chatbubble-outline" size={16} color={c.tint} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: c.textSecondary, fontSize: 11, marginBottom: 2 }} numberOfLines={1}>
                                            {senderLabel(m.senderId)}
                                        </Text>
                                        <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={2}>
                                            {m.content}
                                        </Text>
                                        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>
                                            {formatTime(m.sentAt)}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )
                    )}

                    {/* ── Tab: Ảnh/Video ── */}
                    {activeTab === 'media' && (
                        mediaItems.length === 0 ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
                                <Ionicons name="image-outline" size={40} color={c.textMuted} />
                                <Text style={{ color: c.textMuted, marginTop: 12, fontSize: 14 }}>Chưa có ảnh/video nào</Text>
                            </View>
                        ) : (
                            <View className="flex-row flex-wrap p-1">
                                {mediaItems.map((item, i) => (
                                    <TouchableOpacity key={i} style={{ width: '33.33%', padding: 2 }}>
                                        <Image
                                            source={{ uri: item.uri }}
                                            style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }}
                                            resizeMode="cover"
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )
                    )}

                    {/* ── Tab: File ── */}
                    {activeTab === 'files' && (
                        fileItems.length === 0 ? (
                            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
                                <Ionicons name="document-outline" size={40} color={c.textMuted} />
                                <Text style={{ color: c.textMuted, marginTop: 12, fontSize: 14 }}>Chưa có file nào</Text>
                            </View>
                        ) : (
                            fileItems.map((file, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 16,
                                        paddingVertical: 12,
                                        borderBottomWidth: StyleSheet.hairlineWidth,
                                        borderBottomColor: c.border,
                                    }}
                                    onPress={() => file.url && Linking.openURL(file.url)}
                                >
                                    <View
                                        style={{
                                            width: 40,
                                            height: 40,
                                            backgroundColor: c.surface,
                                            borderRadius: 12,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 12,
                                        }}
                                    >
                                        <Ionicons name={getFileIcon(file.ext)} size={20} color={c.tint} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: c.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                                            {file.name}
                                        </Text>
                                        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                                            {[file.size, file.date].filter(Boolean).join(' • ')}
                                        </Text>
                                    </View>
                                    <Ionicons name="download-outline" size={20} color={c.tint} />
                                </TouchableOpacity>
                            ))
                        )
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
        justifyContent: 'center',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalCard: {
        marginHorizontal: 24,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
        zIndex: 1,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    modalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
});