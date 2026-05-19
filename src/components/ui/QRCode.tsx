import React, {useCallback, useEffect, useRef, useState} from "react";
import {ActivityIndicator, Platform, Text, TouchableOpacity, View, StyleSheet, Dimensions} from "react-native";
import {useRouter} from "expo-router";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Ionicons} from "@expo/vector-icons";
import QRCodeDisplay from "@/src/components/ui/QRCodeDisplay";
import QRScanner from "@/src/components/ui/QRScanner";
import {authService} from "@/src/api/services/auth.service";
import {AuthStorage} from "@/src/storage/AuthStorage";
import {UserStorage} from "@/src/storage/UserStorage";
import {userService} from "@/src/api/services/user.service";
import SocketService from "@/src/api/socketCompat";

const QR_TTL_SECONDS = 120; // Phải khớp với QR_CODE_TTL_SECONDS ở backend
const POLL_INTERVAL_MS = 2000;

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export default function QrCode() {
    const [showScanner, setShowScanner] = useState(false);
    const [loading, setLoading] = useState(false);

    // QR state
    const [qrId, setQrId] = useState<string | null>(null);
    const [qrValue, setQrValue] = useState<string>("");
    const [secondsLeft, setSecondsLeft] = useState(QR_TTL_SECONDS);
    const [qrStatus, setQrStatus] = useState<'PENDING' | 'SCANNED' | 'COMPLETED' | 'EXPIRED'>('PENDING');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Refs
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    const router = useRouter();
    const insets = useSafeAreaInsets();

    // ── Tạo mã QR mới ──────────────────────────────────────────────────────
    const generateQR = useCallback(async () => {
        try {
            setErrorMsg(null);
            setQrStatus('PENDING');
            setSecondsLeft(QR_TTL_SECONDS);
            setLoading(true);

            const res: any = await authService.generateQr();
            const data = res?.data ?? res;
            const newQrId = data?.qrId;

            if (!newQrId) {
                setErrorMsg('Không thể tạo mã QR. Vui lòng thử lại.');
                setLoading(false);
                return;
            }

            setQrId(newQrId);
            // Mobile sẽ quét chuỗi này → extractLoginQrId() sẽ nhận ra
            setQrValue(`ZALA_QR:${newQrId}`);
            setLoading(false);

            // Bắt đầu polling + countdown
            startPolling(newQrId);
            startCountdown();
        } catch (err: any) {
            console.error('[QR] generateQR error:', err);
            setErrorMsg(err?.message || 'Lỗi tạo mã QR');
            setLoading(false);
        }
    }, []);

    // ── Polling checkQrStatus ───────────────────────────────────────────────
    const startPolling = useCallback((id: string) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            if (!mountedRef.current) return;
            try {
                const res: any = await authService.checkQrStatus(id);
                const data = res?.data ?? res;
                const status = data?.status;

                if (!mountedRef.current) return;

                if (status === 'SCANNED') {
                    setQrStatus('SCANNED');
                }

                if (status === 'COMPLETED') {
                    // Login thành công! Backend đã xóa QR key khỏi Redis
                    setQrStatus('COMPLETED');
                    stopPolling();
                    stopCountdown();

                    // Lưu token
                    const accessToken = data?.accessToken;
                    const refreshToken = data?.refreshToken;

                    if (accessToken && refreshToken) {
                        await AuthStorage.saveTokens(accessToken, refreshToken);

                        // Lấy user info
                        try {
                            const me: any = await userService.me();
                            if (me?.success && me?.user) {
                                await UserStorage.saveUser(me.user);
                            }
                        } catch { /* best effort */ }

                        // Kết nối socket
                        SocketService.getInstance().connect(accessToken);

                        // Redirect vào app
                        router.replace("/(main)");
                    } else {
                        setErrorMsg('Đăng nhập QR thành công nhưng không nhận được token.');
                    }
                }
            } catch (err: any) {
                // QR hết hạn hoặc bị xóa → ngừng polling
                if (err?.response?.status === 404 || err?.response?.status === 400) {
                    if (mountedRef.current) {
                        setQrStatus('EXPIRED');
                        stopPolling();
                        stopCountdown();
                    }
                }
            }
        }, POLL_INTERVAL_MS);
    }, []);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    // ── Countdown ───────────────────────────────────────────────────────────
    const startCountdown = useCallback(() => {
        stopCountdown();
        setSecondsLeft(QR_TTL_SECONDS);
        countdownRef.current = setInterval(() => {
            if (!mountedRef.current) return;
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    stopCountdown();
                    stopPolling();
                    setQrStatus('EXPIRED');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const stopCountdown = useCallback(() => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    }, []);

    // ── Format mm:ss ────────────────────────────────────────────────────────
    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // ── Lifecycle ───────────────────────────────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;
        if (Platform.OS === 'web') {
            generateQR();
        }
        return () => {
            mountedRef.current = false;
            stopPolling();
            stopCountdown();
        };
    }, []);

    const handleClose = () => {
        stopPolling();
        stopCountdown();
        router.back();
    };

    // ── Status messages ─────────────────────────────────────────────────────
    const getStatusConfig = () => {
        switch (qrStatus) {
            case 'SCANNED':
                return {icon: 'phone-portrait-outline' as const, color: '#f59e0b', text: 'Đã quét — xác nhận trên điện thoại'};
            case 'COMPLETED':
                return {icon: 'checkmark-circle' as const, color: '#10b981', text: 'Đăng nhập thành công!'};
            case 'EXPIRED':
                return {icon: 'time-outline' as const, color: '#ef4444', text: 'Mã QR đã hết hạn'};
            default:
                return {icon: 'qr-code-outline' as const, color: '#6d28d9', text: 'Quét mã bằng Zala trên điện thoại'};
        }
    };

    const statusConfig = getStatusConfig();

    return (
        <View style={[s.container, {paddingTop: insets.top}]}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={handleClose} style={s.headerBtn}>
                    <Ionicons name="arrow-back" size={24} color="#374151"/>
                </TouchableOpacity>
                <Text style={s.headerTitle}>
                    {Platform.OS === 'web' ? "Đăng nhập bằng QR" : "Quét mã QR"}
                </Text>
                <TouchableOpacity onPress={() => setShowScanner(!showScanner)} style={s.headerBtn}>
                    <Ionicons
                        name={Platform.OS === 'web' ? "qr-code-outline" : "scan-outline"}
                        size={24}
                        color="#374151"
                    />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={s.center}>
                    <ActivityIndicator size="large" color="#6d28d9"/>
                    <Text style={s.loadingText}>Đang tạo mã QR...</Text>
                </View>
            ) : Platform.OS === "web" ? (
                <View style={s.webContent}>
                    {/* Status badge */}
                    <View style={[s.statusBadge, {backgroundColor: statusConfig.color + '15', borderColor: statusConfig.color + '30'}]}>
                        <Ionicons name={statusConfig.icon} size={18} color={statusConfig.color}/>
                        <Text style={[s.statusText, {color: statusConfig.color}]}>{statusConfig.text}</Text>
                    </View>

                    {/* QR Card */}
                    <View style={s.qrCard}>
                        {qrStatus === 'EXPIRED' || errorMsg ? (
                            <View style={s.expiredOverlay}>
                                <Ionicons name="refresh-circle" size={56} color="#6d28d9"/>
                                <Text style={s.expiredTitle}>{errorMsg || 'Mã QR đã hết hạn'}</Text>
                                <Text style={s.expiredSub}>Bấm bên dưới để tạo mã mới</Text>
                            </View>
                        ) : qrStatus === 'COMPLETED' ? (
                            <View style={s.successOverlay}>
                                <Ionicons name="checkmark-circle" size={64} color="#10b981"/>
                                <Text style={s.successText}>Đăng nhập thành công!</Text>
                                <Text style={s.successSub}>Đang chuyển hướng...</Text>
                            </View>
                        ) : qrValue ? (
                            <View style={[s.qrWrapper, qrStatus === 'SCANNED' && s.qrScanned]}>
                                <QRCodeDisplay
                                    value={qrValue}
                                    size={Math.min(SCREEN_WIDTH * 0.55, 240)}
                                    color={qrStatus === 'SCANNED' ? '#92400e' : '#111827'}
                                    backgroundColor="#ffffff"
                                />
                                {qrStatus === 'SCANNED' && (
                                    <View style={s.scannedBadge}>
                                        <ActivityIndicator size="small" color="#f59e0b"/>
                                        <Text style={s.scannedText}>Chờ xác nhận...</Text>
                                    </View>
                                )}
                            </View>
                        ) : null}
                    </View>

                    {/* Timer */}
                    {qrStatus !== 'EXPIRED' && qrStatus !== 'COMPLETED' && (
                        <View style={s.timerRow}>
                            <Ionicons name="time-outline" size={16} color={secondsLeft <= 15 ? '#ef4444' : '#6b7280'}/>
                            <Text style={[s.timerText, secondsLeft <= 15 && s.timerDanger]}>
                                Hết hạn sau {formatTime(secondsLeft)}
                            </Text>
                        </View>
                    )}

                    {/* Refresh button */}
                    {(qrStatus === 'EXPIRED' || errorMsg) && (
                        <TouchableOpacity style={s.refreshBtn} onPress={generateQR} activeOpacity={0.8}>
                            <Ionicons name="refresh" size={18} color="#fff"/>
                            <Text style={s.refreshBtnText}>Tạo mã QR mới</Text>
                        </TouchableOpacity>
                    )}

                    {/* Instructions */}
                    {qrStatus === 'PENDING' && (
                        <View style={s.instructions}>
                            <Text style={s.instructionTitle}>Hướng dẫn:</Text>
                            {[
                                'Mở ứng dụng Zala trên điện thoại',
                                'Vào mục Quét mã QR',
                                'Hướng camera vào mã QR trên màn hình',
                                'Xác nhận đăng nhập trên điện thoại',
                            ].map((step, i) => (
                                <View key={i} style={s.stepRow}>
                                    <View style={s.stepNumber}>
                                        <Text style={s.stepNumberText}>{i + 1}</Text>
                                    </View>
                                    <Text style={s.stepText}>{step}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ) : (
                // Mobile: Hiện camera quét QR
                <QRScanner/>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: {flex: 1, backgroundColor: '#ffffff'},
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
        backgroundColor: '#ffffff',
    },
    headerBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12},
    headerTitle: {fontSize: 17, fontWeight: '700', color: '#111827'},

    center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
    loadingText: {marginTop: 16, fontSize: 15, color: '#6b7280'},

    webContent: {flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24},

    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 999, borderWidth: 1, marginBottom: 24,
    },
    statusText: {fontSize: 13, fontWeight: '600'},

    qrCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20, borderWidth: 2, borderColor: '#e5e7eb',
        padding: 20, alignItems: 'center', justifyContent: 'center',
        minHeight: 280, minWidth: 280,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: {width: 0, height: 6},
        elevation: 4,
    },
    qrWrapper: {alignItems: 'center', justifyContent: 'center'},
    qrScanned: {opacity: 0.5},

    scannedBadge: {
        position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 999, borderWidth: 1, borderColor: '#fbbf24',
    },
    scannedText: {fontSize: 13, fontWeight: '700', color: '#92400e'},

    expiredOverlay: {alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20},
    expiredTitle: {fontSize: 15, fontWeight: '700', color: '#374151', textAlign: 'center'},
    expiredSub: {fontSize: 13, color: '#6b7280'},

    successOverlay: {alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20},
    successText: {fontSize: 17, fontWeight: '700', color: '#059669'},
    successSub: {fontSize: 13, color: '#6b7280'},

    timerRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16},
    timerText: {fontSize: 14, fontWeight: '600', color: '#6b7280'},
    timerDanger: {color: '#ef4444'},

    refreshBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#6d28d9', paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: 14, marginTop: 20,
    },
    refreshBtnText: {color: '#fff', fontSize: 15, fontWeight: '700'},

    instructions: {marginTop: 32, width: '100%', maxWidth: 360},
    instructionTitle: {fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12},
    stepRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10},
    stepNumber: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center',
    },
    stepNumberText: {fontSize: 12, fontWeight: '700', color: '#6d28d9'},
    stepText: {fontSize: 13, color: '#4b5563', flex: 1},
});
