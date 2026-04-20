import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, SafeAreaView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { conversationService } from '@/src/api/services/conversation.service';
import { Conversation } from '@/src/models/Conversation';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from '@/src/components/ui/Toast';

export default function JoinGroupScreen() {
    const { conversationId, code } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [groupInfo, setGroupInfo] = useState<Conversation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{
        visible: boolean;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        message: '',
        type: 'info'
    });

    useEffect(() => {
        if (!conversationId) {
            setError('Không tìm thấy thông tin nhóm');
            setLoading(false);
            return;
        }

        const fetchInfo = async () => {
            try {
                // Sử dụng getConversationById để lấy thông tin sơ bộ
                // BE hỗ trợ trả về thông tin cơ bản cho cả người chưa là thành viên nếu truyền conversationId
                    const res = await conversationService.getConversationById(conversationId as string, undefined, true);
                if (res.success && res.conversation) {
                    setGroupInfo(res.conversation);
                } else {
                    setError(res.message || 'Không thể lấy thông tin nhóm');
                }
            } catch (err) {
                setError('Đã có lỗi xảy ra khi tải thông tin nhóm');
            } finally {
                setLoading(false);
            }
        };

        fetchInfo();
    }, [conversationId]);

    const handleJoin = async () => {
        console.log('[JoinScreen] handleJoin button clicked');
        if (!groupInfo || joining) {
            console.log('[JoinScreen] Already joining or groupInfo missing', { joining, groupInfo: !!groupInfo });
            return;
        }

        setJoining(true);
        try {
            const cid = Array.isArray(conversationId) ? conversationId[0] : conversationId;
            const inviteCode = Array.isArray(code) ? code[0] : code;
            if (!cid || !inviteCode) {
                setToast({
                    visible: true,
                    message: 'Thiếu mã mời hoặc ID nhóm. Hãy mở lại link mời.',
                    type: 'error',
                });
                setJoining(false);
                return;
            }
            const payload = { conversationId: String(cid), code: String(inviteCode) };
            console.log('[JoinScreen] Calling joinByUrl with:', payload);

            const res = await conversationService.joinByUrl(payload);
            console.log('[JoinScreen] API Response received:', res);

            if (res && res.success) {
                const isAlready = res.alreadyMember || res.data?.alreadyMember;
                const pendingApproval = res.pendingApproval || res.data?.pendingApproval;
                console.log('[JoinScreen] Join successful', { isAlready, pendingApproval });

                if (isAlready) {
                    setToast({
                        visible: true,
                        message: 'Bạn đã là thành viên của nhóm này rồi.',
                        type: 'info'
                    });
                    setTimeout(() => router.replace('/(main)'), 1500);
                } else if (pendingApproval) {
                    setToast({
                        visible: true,
                        message: 'Yêu cầu vào nhóm đang chờ duyệt',
                        type: 'success'
                    });
                    setTimeout(() => router.replace('/(main)'), 2000);
                } else {
                    setToast({
                        visible: true,
                        message: 'Bạn đã tham gia nhóm thành công.',
                        type: 'success'
                    });
                    setTimeout(() => router.replace('/(main)'), 1500);
                }
            } else {
                const errorMsg = res?.message || 'Không thể tham gia nhóm';
                console.error('[JoinScreen] API Success false:', res);
                setToast({
                    visible: true,
                    message: errorMsg,
                    type: 'error'
                });
            }
        } catch (err: any) {
            console.error('[JoinScreen] Exception in handleJoin:', err);
            const backendMsg = err.response?.data?.message || err.message || 'Đã có lỗi xảy ra';
            setToast({
                visible: true,
                message: backendMsg,
                type: 'error'
            });
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#6d28d9" />
                <Text style={styles.loadingText}>Đang kiểm tra thông tin nhóm...</Text>
            </View>
        );
    }

    if (error || !groupInfo) {
        return (
            <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                <Text style={styles.errorText}>{error || 'Link không hợp lệ hoặc đã hết hạn'}</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(main)')}>
                    <Text style={styles.backButtonText}>Quay lại trang chủ</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const memberCount = groupInfo.participantIds?.length || 0;
    const requiresApproval = Boolean(groupInfo.settings?.isReviewNewParticipant);

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={['#f3f4f6', '#ffffff']}
                style={StyleSheet.absoluteFill}
            />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={{ uri: groupInfo.avatarUrl || 'https://via.placeholder.com/150' }}
                            style={styles.avatar}
                        />
                        <View style={styles.badge}>
                            <Ionicons name="people" size={12} color="#fff" />
                        </View>
                    </View>

                    <Text style={styles.groupName}>{groupInfo.name}</Text>
                    <Text style={styles.memberInfo}>{memberCount} thành viên</Text>

                    <View style={styles.divider} />

                    <View style={styles.featureRow}>
                        <View style={styles.iconBox}>
                            <Ionicons name="shield-checkmark-outline" size={20} color="#6d28d9" />
                        </View>
                        <Text style={styles.featureText}>Nhóm an toàn & bảo mật</Text>
                    </View>

                    <View style={styles.featureRow}>
                        <View style={styles.iconBox}>
                            <Ionicons name="notifications-outline" size={20} color="#6d28d9" />
                        </View>
                        <Text style={styles.featureText}>Luôn cập nhật tin nhắn mới nhất</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    style={[styles.joinBtn, joining && styles.disabledBtn]} 
                    onPress={handleJoin}
                    disabled={joining}
                >
                    {joining ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.joinBtnText}>{requiresApproval ? 'Xin vào nhóm' : 'Tham gia nhóm'}</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                        </>
                    )}
                </TouchableOpacity>

                <Text style={styles.hint}>
                    {requiresApproval
                        ? 'Yêu cầu của bạn sẽ được gửi đến quản trị viên để duyệt.'
                        : 'Khi tham gia, bạn có thể xem các tin nhắn và thành viên của nhóm này.'}
                </Text>
            </View>

            <Toast 
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={() => setToast(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        color: '#6b7280',
        fontSize: 15,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: '#374151',
        textAlign: 'center',
        fontWeight: '500',
    },
    backButton: {
        marginTop: 24,
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#6d28d9',
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontWeight: '600',
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 10,
        alignItems: 'flex-end',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    card: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        marginBottom: 32,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f3f4f6',
    },
    badge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#6d28d9',
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 3,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 4,
    },
    memberInfo: {
        fontSize: 15,
        color: '#6b7280',
        marginBottom: 20,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: '#f3f4f6',
        marginVertical: 20,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 16,
        width: '100%',
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    featureText: {
        fontSize: 14,
        color: '#4b5563',
        fontWeight: '500',
    },
    joinBtn: {
        width: '100%',
        height: 56,
        backgroundColor: '#6d28d9',
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6d28d9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    joinBtnText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    disabledBtn: {
        opacity: 0.7,
    },
    hint: {
        marginTop: 20,
        fontSize: 13,
        color: '#9ca3af',
        textAlign: 'center',
        lineHeight: 18,
    }
});
