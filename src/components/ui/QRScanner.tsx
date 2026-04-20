import React, {useEffect, useRef, useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';
import {BarcodeScanningResult, CameraView, useCameraPermissions} from "expo-camera";
import {router} from 'expo-router';
import {conversationService as ConversationService} from '@/src/api/services/conversation.service';
import {authService} from '@/src/api/services/auth.service';
import * as ImagePicker from 'expo-image-picker';
// import { BarCodeScanner } from 'expo-barcode-scanner'; // Gỡ bỏ vì không tương thích SDK 51+
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Platform } from 'react-native';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QR_PREFIX = 'ZALA_QR:';

const extractLoginQrId = (rawData: string): string | null => {
    const value = rawData.trim();
    if (!value) return null;

    if (value.startsWith(QR_PREFIX)) {
        const qrId = value.slice(QR_PREFIX.length).trim();
        return UUID_PATTERN.test(qrId) ? qrId : null;
    }

    if (UUID_PATTERN.test(value)) return value;

    const likelyLoginPayload = /login|auth|zala:\/\/|qr/i.test(value);
    const queryMatch = value.match(/[?&](?:qrId|id)=([0-9a-fA-F-]{36})/);
    if (likelyLoginPayload && queryMatch?.[1] && UUID_PATTERN.test(queryMatch[1])) {
        return queryMatch[1];
    }

    try {
        const parsed = new URL(value);
        const qrIdFromQuery = parsed.searchParams.get('qrId') || parsed.searchParams.get('id');
        if (qrIdFromQuery && UUID_PATTERN.test(qrIdFromQuery)) {
            return qrIdFromQuery;
        }

        const normalizedPath = `${parsed.host}${parsed.pathname}`.replace(/^\/+|\/+$/g, '');
        const segments = normalizedPath.split('/').filter(Boolean);
        const candidate = segments[segments.length - 1];
        if (candidate && UUID_PATTERN.test(candidate) && /qr|login/i.test(normalizedPath)) {
            return candidate;
        }
    } catch {
        // Ignore malformed URLs and fallback to default scanner behavior.
    }

    return null;
};

const extractJoinInfo = (rawData: string): { conversationId: string; code: string } | null => {
    const value = rawData.trim();
    if (!value) return null;

    try {
        const parsed = new URL(value);
        // 1. Hỗ trợ query params: ?conversationId=...&code=...
        const conversationId = parsed.searchParams.get('conversationId');
        const code = parsed.searchParams.get('code');
        if (conversationId && code) {
            return { conversationId, code };
        }

        // 2. Hỗ trợ path-based: zala://join/ID/CODE hoặc http://.../join/ID/CODE
        const path = parsed.pathname.replace(/^\/+/, ''); // loại bỏ / đầu tiên
        const segments = path.split('/');
        
        // Trường hợp zala://join/ID/CODE -> host='join', pathname='/ID/CODE'
        if (parsed.host === 'join' && segments.length >= 2) {
            return { conversationId: segments[0], code: segments[1] };
        }
        
        // Trường hợp http://.../join/ID/CODE -> pathname='/join/ID/CODE'
        if (segments[0] === 'join' && segments.length >= 3) {
            return { conversationId: segments[1], code: segments[2] };
        }
    } catch (e) {
        // Nếu không phải URL hợp lệ, thử parse chuỗi thô
        if (value.startsWith('zala://join/')) {
            const parts = value.split('/');
            if (parts.length >= 5) {
                return { conversationId: parts[3], code: parts[4] };
            }
        }
    }
    return null;
};

const extractErrorMessage = (error: any): string => {
    return error?.response?.data?.message || error?.message || 'Không thể xác nhận đăng nhập bằng QR';
};

interface QrScannerProps {
    onScan?: (data: string) => void;
    onPermissionDenied?: () => void;
    showDefaultAlert?: boolean;
    frameSize?: number;
    frameColor?: string;
    frameThickness?: number;
    overlayMessage?: string;
    lockScanTime?: number;
    conversationId?: string;
    participantId?: string;
    setShowQRScanner?: (show: boolean) => void;
}

export default function QRScanner({
                                      onScan,
                                      onPermissionDenied,
                                      showDefaultAlert = true,
                                      frameSize = 250,
                                      frameColor = '#fff',
                                      frameThickness = 4,
                                      overlayMessage = "Di chuyển camera đến mã QR",
                                      lockScanTime = 1000,
                                      setShowQRScanner
                                  }: QrScannerProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const qrLock = useRef(false);
    const [isMounted, setIsMounted] = useState(false);

    const handleLoginQr = async (qrId: string) => {
        try {
            await authService.scanQr(qrId);
            await authService.verifyQr(qrId);
            Alert.alert('Thành công', 'Đã xác nhận đăng nhập cho phiên web.');
            setShowQRScanner && setShowQRScanner(false);
        } catch (error: any) {
            Alert.alert('Không thể xác nhận', extractErrorMessage(error));
        } finally {
            setTimeout(() => {
                qrLock.current = false;
            }, lockScanTime);
        }
    };

    useEffect(() => {
        setIsMounted(true);

        if (!permission || permission.status !== 'granted') {
            (async () => {
                const cameraPermission = await requestPermission();
                if (!cameraPermission.granted && onPermissionDenied) {
                    onPermissionDenied();
                }
            })();
        }

        return () => setIsMounted(false);
    }, [permission]);

    const handlePickImage = async () => {
        console.log("[QRScanner] handlePickImage started");
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
            });

            console.log("[QRScanner] ImagePicker result:", JSON.stringify(result));

            if (!result.canceled && result.assets[0].uri) {
                console.log("[QRScanner] Picking image successful, uri:", result.assets[0].uri);
                await decodeQRCode(result.assets[0].uri);
            } else {
                console.log("[QRScanner] Picking image canceled or no uri");
            }
        } catch (error: any) {
            console.error("[QRScanner] ImagePicker error:", error);
            Alert.alert('Lỗi', 'Không thể mở thư viện ảnh: ' + (error?.message || 'Lỗi không xác định'));
        }
    };

    const decodeQRCode = async (uri: string) => {
        console.log("[QRScanner] decodeQRCode start for uri:", uri);
        if (qrLock.current) {
            console.log("[QRScanner] Scanner is locked, skipping decode");
            return;
        }
        qrLock.current = true;

        let decodedData: string | null = null;

        try {
            if (Platform.OS === 'web') {
                console.log("[QRScanner] Web platform detected, using jsQR");
                // Tải jsQR động từ CDN cho Web
                await loadJSQR();
                const jsQR = (window as any).jsQR;
                if (!jsQR) {
                    throw new Error('jsQR library not available on window object');
                }

                console.log("[QRScanner] jsQR library loaded successfully");

                // Vẽ ảnh lên canvas để lấy data pixel
                const image = new Image();
                image.src = uri;
                await new Promise((resolve, reject) => {
                    image.onload = () => {
                        console.log("[QRScanner] Image loaded into HTML element, dims:", image.width, "x", image.height);
                        resolve(null);
                    };
                    image.onerror = (e) => {
                        console.error("[QRScanner] Image element failed to load source", e);
                        reject(new Error('Failed to load image element'));
                    };
                });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) throw new Error('Could not get canvas context');

                canvas.width = image.width;
                canvas.height = image.height;
                context.drawImage(image, 0, 0);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                console.log("[QRScanner] Canvas pixel data extracted, length:", imageData.data.length);

                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });
                
                if (code) {
                    console.log("[QRScanner] jsQR found code:", code.data);
                    decodedData = code.data;
                } else {
                    console.log("[QRScanner] jsQR did not find any code in image");
                }
            } else {
                console.log("[QRScanner] Native platform detected, skipping file scan (BarcodeScanner retired)");
                // Thư viện BarCodeScanner cũ đã bị gỡ bỏ trong Expo SDK mới.
                // Hiện tại CameraView của Expo chưa hỗ trợ quét trực tiếp từ file ảnh trên Native.
                // Chúng ta sẽ hiển thị thông báo thay vì gọi scanFromURLAsync gây sập App.
                Alert.alert(
                    'Tính năng hạn chế', 
                    'Quét mã QR từ thư viện ảnh hiện chỉ hỗ trợ trên phiên bản Web. Vui lòng quét trực tiếp bằng camera trên điện thoại.'
                );
            }

            if (decodedData) {
                console.log("[QRScanner] Successfully decoded data:", decodedData);
                handleBarcodeScanned({ data: decodedData } as BarcodeScanningResult);
            } else {
                console.warn("[QRScanner] No QR code found in the image.");
                Alert.alert('Không tìm thấy mã QR', 'Ảnh này không chứa mã QR hợp lệ hoặc quá mờ.');
                qrLock.current = false;
            }
        } catch (error: any) {
            console.error('[QRScanner] Decode process error detail:', error);
            Alert.alert('Lỗi xử lý', 'Có lỗi khi phân tích ảnh: ' + (error?.message || 'Lỗi không xác định'));
            qrLock.current = false;
        }
    };

    const loadJSQR = (): Promise<void> => {
        console.log("[QRScanner] loadJSQR start");
        return new Promise((resolve, reject) => {
            if ((window as any).jsQR) {
                console.log("[QRScanner] jsQR already exists on window");
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            script.async = true;
            script.onload = () => {
                console.log("[QRScanner] jsQR script loaded from CDN successfully");
                resolve();
            };
            script.onerror = (e) => {
                console.error("[QRScanner] Failed to load jsQR script from CDN:", e);
                reject(new Error('Failed to load jsQR from CDN. Vui lòng kiểm tra kết nối mạng.'));
            };
            document.head.appendChild(script);
        });
    };

    const handleBarcodeScanned = (result: BarcodeScanningResult) => {
        const {data} = result;

        if (!data) return;
        // Chặn scan trùng lặp nếu đang lock (nhưng nếu từ file upload thì lock đã được set ở decodeQRCode)
        if (qrLock.current && !result.target) {
             // target rỗng thường là trường hợp fix thủ công từ file upload, ta bỏ qua check lock ở đây 
             // vì lock đã được set ở decodeQRCode rồi.
        } else if (qrLock.current) {
            return;
        }

        qrLock.current = true;

        if (onScan) {
            onScan(data);
        }

        const loginQrId = extractLoginQrId(data);
        if (loginQrId) {
            const confirmLogin = () => {
                void handleLoginQr(loginQrId);
            };

            if (showDefaultAlert) {
                setTimeout(() => {
                    Alert.alert(
                        'Xác nhận đăng nhập Web',
                        'Bạn có muốn xác nhận đăng nhập cho phiên web này không?',
                        [
                            {
                                text: 'Hủy',
                                style: 'cancel',
                                onPress: () => (qrLock.current = false),
                            },
                            {
                                text: 'Xác nhận',
                                onPress: confirmLogin,
                            },
                        ]
                    );
                }, 300);
            } else {
                confirmLogin();
            }
            return;
        }

        const joinInfo = extractJoinInfo(data);
        if (joinInfo) {
            console.log("[QRScanner] Detected Join Info, redirecting to /join...", joinInfo);
            setShowQRScanner && setShowQRScanner(false);
            router.push({
                pathname: '/(main)/join',
                params: { 
                    conversationId: joinInfo.conversationId, 
                    code: joinInfo.code 
                }
            });
            setTimeout(() => { qrLock.current = false; }, lockScanTime);
            return;
        }

        if (showDefaultAlert) {
            setTimeout(() => {
                Alert.alert("QR Code", data, [
                    {text: "Thoát", onPress: () => (qrLock.current = false)},
                ]);
            }, 500);
        } else {
            setTimeout(() => {
                qrLock.current = false;
            }, lockScanTime);
        }
    };

    if (!permission) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>Đang kiểm tra quyền camera...</Text>
            </View>
        );
    }

    if (permission.status !== 'granted') {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>Vui lòng cấp quyền truy cập camera.</Text>
                <Text
                    style={styles.permissionButton}
                    onPress={requestPermission}
                >
                    Cấp quyền
                </Text>
            </View>
        );
    }

    if (!isMounted) {
        return (
            <View style={styles.permissionContainer}>
                <Text style={styles.permissionText}>Đang kết nối camera...</Text>
            </View>
        );
    }

    const CORNER_SIZE = frameSize / 8;

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"]
                }}
            />

            <View style={styles.overlay}>
                <Text style={styles.text}>{overlayMessage}</Text>
            </View>

            <View style={[
                styles.frame,
                {
                    width: frameSize,
                    height: frameSize,
                    marginLeft: -frameSize / 2,
                    marginTop: -frameSize / 2
                }
            ]}>
                <View style={[
                    styles.corner,
                    {
                        width: CORNER_SIZE,
                        height: CORNER_SIZE,
                        borderColor: frameColor,
                        borderTopWidth: frameThickness,
                        borderLeftWidth: frameThickness
                    },
                    styles.topLeft
                ]}/>
                <View style={[
                    styles.corner,
                    {
                        width: CORNER_SIZE,
                        height: CORNER_SIZE,
                        borderColor: frameColor,
                        borderTopWidth: frameThickness,
                        borderRightWidth: frameThickness
                    },
                    styles.topRight
                ]}/>
                <View style={[
                    styles.corner,
                    {
                        width: CORNER_SIZE,
                        height: CORNER_SIZE,
                        borderColor: frameColor,
                        borderBottomWidth: frameThickness,
                        borderLeftWidth: frameThickness
                    },
                    styles.bottomLeft
                ]}/>
                <View style={[
                    styles.corner,
                    {
                        width: CORNER_SIZE,
                        height: CORNER_SIZE,
                        borderColor: frameColor,
                        borderBottomWidth: frameThickness,
                        borderRightWidth: frameThickness
                    },
                    styles.bottomRight
                ]}/>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity 
                    style={styles.galleryButton}
                    onPress={handlePickImage}
                >
                    <Ionicons name="image-outline" size={28} color="#fff" />
                    <Text style={styles.buttonText}>Chọn từ ảnh</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f9f9f9',
    },
    permissionText: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
        marginBottom: 16,
    },
    permissionButton: {
        fontSize: 16,
        color: '#fff',
        backgroundColor: '#2196F3',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        overflow: 'hidden',
    },
    overlay: {
        position: 'absolute',
        top: 40,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 8,
        zIndex: 10,
    },
    text: {
        color: '#fff',
        fontSize: 16,
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 80,
        alignSelf: 'center',
        alignItems: 'center',
    },
    galleryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        marginLeft: 10,
        fontWeight: '500',
    },
    frame: {
        position: 'absolute',
        top: '50%',
        left: '50%',
    },
    corner: {
        position: 'absolute',
    },
    topLeft: {
        top: 0,
        left: 0,
    },
    topRight: {
        top: 0,
        right: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
    },
});
