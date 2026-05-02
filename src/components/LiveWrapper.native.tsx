import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import axios from 'axios';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/src/contexts/user/UserContext';
import { URL_BE } from '@/src/constants/ApiConstant';
import * as Speech from 'expo-speech';
import DanmakuLayer, { DanmakuLayerRef } from './live/DanmakuLayer.native';
import GiftOverlay, { GiftOverlayRef } from './live/GiftOverlay.native';
import { STICKER_PACKS } from './chat/stickerAssets';
import { billingService } from '@/src/api/services/billing.service';
import { Image } from 'react-native';
import LiveRegulationsModal from './live/LiveRegulationsModal';
import VipPurchaseModal from './live/VipPurchaseModal';
import SocketService from '@/src/api/socketCompat';
import { useCallback } from 'react';

// Module-level variable lưu thời điểm bắt đầu live, không bị mất khi component remount
let _nativeLiveStartTime: number | null = null;
// Flag đánh dấu disconnect có chủ ý (end live / leave room) để không reconnect
let _intentionalDisconnect = false;

let LiveKitRoom: any;
let useRoomContext: any;
let VideoTrack: any;
let DataPacket_Kind: any = { RELIABLE: 0 };
let nativeLivekitAvailable = true;
try {
  const livekit = require('@livekit/react-native');
  const livekitClient = require('livekit-client');
  LiveKitRoom = livekit.LiveKitRoom;
  useRoomContext = livekit.useRoomContext;
  VideoTrack = livekit.VideoTrack;
  DataPacket_Kind = livekitClient.DataPacket_Kind ?? DataPacket_Kind;
} catch (err) {
  nativeLivekitAvailable = false;
  console.warn('Expo Go không hỗ trợ LiveKit native module. Cần dùng dev client hoặc bare workflow.', err);
}

const LIVEKIT_URL = 'wss://livestream-zala-8almwmwe.livekit.cloud';
const liveApi = axios.create({
  baseURL: URL_BE,
  timeout: 15000,
});
const LIVE_ACTIVE_ROOM_KEY = 'live_native_active_room_v1';

export default function LiveScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [initialMicOn, setInitialMicOn] = useState(false);
  const [initialCamOn, setInitialCamOn] = useState(false);
  const [preJoinCode, setPreJoinCode] = useState<string | null>(null);
  const [preJoinIsCreate, setPreJoinIsCreate] = useState(false);
  const [preJoinDisplayName, setPreJoinDisplayName] = useState('');
  const [preJoinThumbnailUrl, setPreJoinThumbnailUrl] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [participantDisplayName, setParticipantDisplayName] = useState('');
  const [preJoinCamOn, setPreJoinCamOn] = useState(false);
  const [preJoinMicOn, setPreJoinMicOn] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [canSubscribe, setCanSubscribe] = useState(true);
  const [currentRoomName, setCurrentRoomName] = useState('');
  const [showRegulations, setShowRegulations] = useState(false);
  const [showVipPurchase, setShowVipPurchase] = useState(false);
  const [vipTier, setVipTier] = useState<string>('VIP0');
  const [vipExpiry, setVipExpiry] = useState<string | null>(null);
  const [maxLiveMinutes, setMaxLiveMinutes] = useState<number>(5);
  const [roomEnded, setRoomEnded] = useState(false);
  const [roomEndedMessage, setRoomEndedMessage] = useState('Phiên live đã kết thúc.');
  const [roomReady, setRoomReady] = useState(false);
  const [roomReconnecting, setRoomReconnecting] = useState(false);

  const { user } = useUser();
  const [tempId] = useState('temp_id_' + Math.floor(Math.random() * 1000));
  const [tempName] = useState('UserDemo_' + Math.floor(Math.random() * 1000));
  const currentIdentity = user?.id || tempId;
  const currentName = (user as any)?.fullName || user?.name || tempName;

  // Fetch VIP status
  const fetchVipStatus = async () => {
    try {
      const res = await liveApi.get('/api/payment/vip-status', { params: { accountId: currentIdentity } });
      if (res.data?.success) {
        setVipTier(res.data.vipTier || 'VIP0');
        setVipExpiry(res.data.vipExpiryDate || null);
        if (res.data.tierInfo) {
          setMaxLiveMinutes(res.data.tierInfo.maxLiveMinutes);
        }
      }
    } catch (err) { console.warn('Lỗi lấy VIP status:', err); }
  };

  useEffect(() => { fetchVipStatus(); }, [currentIdentity]);

  // Listen to VIP upgrade via socket
  useEffect(() => {
    const socket = SocketService.getInstance();
    const handleVipUpgraded = (data: { vipTier: string; vipExpiryDate: string }) => {
      setVipTier(data.vipTier);
      setVipExpiry(data.vipExpiryDate);
      setShowVipPurchase(false);
      Alert.alert("🎉 Thành công", `Tài khoản của bạn đã được kích hoạt ${data.vipTier} thành công!`);
    };
    socket.onVipUpgraded(handleVipUpgraded);
    return () => socket.removeVipUpgradedListener(handleVipUpgraded);
  }, []);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const response = await liveApi.get('/api/live/rooms');
      setRooms(response.data.rooms || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách phòng:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    const restoreRoom = async () => {
      if (token) return;
      try {
        const raw = await AsyncStorage.getItem(LIVE_ACTIVE_ROOM_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed?.roomName || !parsed?.participantId) return;

        const response = await liveApi.get('/api/live/token', {
          params: {
            roomName: parsed.roomName,
            participantName: parsed.participantName || currentName,
            participantId: parsed.participantId,
          },
        });
        if (!response.data?.token) return;

        setToken(response.data.token);
        setIsHost(response.data.isHost);
        setCanSubscribe(response.data.canSubscribe);
        setCurrentRoomName(parsed.roomName);
      } catch (err) {
        console.warn('Không thể khôi phục phòng live:', err);
      }
    };
    restoreRoom();
  }, [token, currentName, currentIdentity]);

  const generateRoomCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segment = (len: number) => Array.from({length: len}).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment(3)}-${segment(4)}-${segment(3)}`;
  };

  const openPreJoin = (code: string, isCreate: boolean, displayName = '') => {
    setPreJoinCode(code);
    setPreJoinIsCreate(isCreate);
    setPreJoinDisplayName(displayName);
    if (!isCreate) setPreJoinThumbnailUrl('');
    setParticipantDisplayName(currentName);
    setPreJoinCamOn(false);
    setPreJoinMicOn(false);
  };

  const uploadThumbnail = async (uri: string) => {
    const formData = new FormData();
    const fileName = uri.split('/').pop() || `thumb-${Date.now()}.jpg`;
    formData.append('thumbnail', {
      uri,
      name: fileName,
      type: 'image/jpeg',
    } as any);

    const res = await fetch(`${URL_BE}/api/live/thumbnail`, {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (!res.ok || !data?.url) {
      throw new Error(data?.error || 'Upload thumbnail thất bại');
    }
    return data.url as string;
  };

  const handlePickThumbnail = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Quyền bị từ chối', 'Bạn cần cấp quyền thư viện để chọn ảnh thumbnail.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (result.canceled || !result.assets?.length) return;

      setUploadingThumbnail(true);
      const uploadedUrl = await uploadThumbnail(result.assets[0].uri);
      setPreJoinThumbnailUrl(uploadedUrl);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể tải thumbnail.');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const enterRoom = async () => {
    const normalizedName = (preJoinCode || '').trim();
    const displayName = participantDisplayName.trim() || currentName;
    if (!normalizedName) {
      Alert.alert('Thiếu thông tin', 'Bạn cần nhập hoặc tạo mã phòng trước khi vào.');
      return;
    }
    setIsJoiningRoom(true);
    try {
      const response = await liveApi.get('/api/live/token', {
        params: {
          roomName: normalizedName,
          participantName: displayName,
          participantId: currentIdentity,
          ...(preJoinIsCreate ? {
            requiresApproval,
            displayName: preJoinDisplayName || `Phòng live của ${currentName}`,
            ...(preJoinThumbnailUrl ? { thumbnailUrl: preJoinThumbnailUrl } : {}),
          } : {}),
        },
      });
      setToken(response.data.token);
      setIsHost(response.data.isHost);
      setCanSubscribe(response.data.canSubscribe);
      setCurrentRoomName(normalizedName);
      setInitialCamOn(preJoinCamOn);
      setInitialMicOn(preJoinMicOn);
      setPreJoinCode(null);
      setRoomEnded(false);
      setRoomEndedMessage('Phiên live đã kết thúc.');
      try {
        await AsyncStorage.setItem(
          LIVE_ACTIVE_ROOM_KEY,
          JSON.stringify({
            roomName: normalizedName,
            participantName: displayName,
            participantId: currentIdentity,
          })
        );
      } catch {}
      // Không reset ở đây, đã reset ở nút bấm lobby
    } catch (err) {
      console.error('Lỗi lấy token:', err);
      setError('Không thể kết nối đến Backend lấy Token. Kiểm tra lại IP hoặc Server.');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const deleteRoom = (name: string) => {
    Alert.alert('Xác nhận', `Bạn có chắc chắn muốn xóa phòng ${name} không?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try {
          const res = await liveApi.delete('/api/live/room', {
            params: { roomName: name, hostId: currentIdentity }
          });
          if (res.data.success) {
            Alert.alert('Thành công', 'Xóa phòng thành công');
            fetchRooms();
          }
        } catch (err) {
          Alert.alert('Lỗi', 'Không thể xóa phòng');
        }
      }}
    ]);
  };

  const handleTimeExpired = useCallback(() => {
    _nativeLiveStartTime = null;
    setToken(null);
    setRoomEnded(true);
    setRoomEndedMessage(`Phiên Live kết thúc do hết thời gian của gói ${vipTier}.`);
    setShowVipPurchase(true);
    AsyncStorage.removeItem(LIVE_ACTIVE_ROOM_KEY).catch(() => {});
    fetchRooms();
  }, [vipTier]);

  const handleRoomEnded = useCallback((message = 'Buổi live đã kết thúc. Cảm ơn bạn đã tham gia.') => {
    _nativeLiveStartTime = null;
    setToken(null);
    setRoomEnded(true);
    setRoomEndedMessage(message);
    AsyncStorage.removeItem(LIVE_ACTIVE_ROOM_KEY).catch(() => {});
    // Delay fetchRooms để server kịp xóa phòng khỏi LiveKit
    setTimeout(() => fetchRooms(), 1500);
    setTimeout(() => fetchRooms(), 4000); // Lần 2 để chắc chắn
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Thử lại" onPress={() => setError(null)} />
      </View>
    );
  }

  if (roomEnded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 36 }}>📺</Text>
        </View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 }}>Buổi live đã kết thúc</Text>
        <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>{roomEndedMessage}</Text>
        <TouchableOpacity
          style={{ backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' }}
          onPress={() => {
            setRoomEnded(false);
            setJoinCode('');
            setNewRoomName('');
            setCurrentRoomName('');
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>← Quay về danh sách phòng</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (token) {
    if (!nativeLivekitAvailable) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>LiveKit native module không được hỗ trợ trong Expo Go.</Text>
          <Text style={styles.infoText}>Bạn cần chạy app bằng Development Build hoặc cấu hình Bare workflow để dùng live stream native.</Text>
        </View>
      );
    }

    return (
      <>
        <Stack.Screen options={{ title: 'Phòng Live Stream' }} />
        <LiveKitRoom 
          serverUrl={LIVEKIT_URL} 
          token={token} 
          connect={true}
          video={isHost}
          // Viewer cần subscribe audio của host để nghe voice.
          audio={isHost}
          onConnected={() => {
            setRoomReady(true);
            setRoomReconnecting(false);
          }}
          onDisconnected={() => {
            console.log('Native disconnected, intentional:', _intentionalDisconnect);
            if (_intentionalDisconnect) {
              // Disconnect có chủ ý → không reconnect, reset flag
              _intentionalDisconnect = false;
              setRoomReady(false);
              setRoomReconnecting(false);
            } else {
              // Kiểm tra xem phòng còn tồn tại không
              // Delay 1.5s để server kịp xử lý xóa phòng
              setRoomReady(false);
              setTimeout(async () => {
                try {
                  const res = await liveApi.get('/api/live/rooms');
                  const exists = (res.data?.rooms || []).some((r: any) => r?.name === currentRoomName);
                  if (!exists) {
                    // Phòng đã bị xóa → host đã kết thúc live
                    handleRoomEnded('Buổi live đã kết thúc. Cảm ơn bạn đã tham gia.');
                  } else {
                    // Phòng vẫn tồn tại → mất mạng thật, cho phép reconnect
                    setRoomReconnecting(true);
                  }
                } catch {
                  // Không thể kiểm tra → coi như phòng đã đóng
                  handleRoomEnded('Kết nối phòng live đã đóng.');
                }
              }, 1500);
            }
          }}
        >
          <RoomView 
            roomName={currentRoomName} 
            isHost={isHost} 
            canSubscribe={canSubscribe} 
            identity={currentIdentity}
            initialCamOn={initialCamOn}
            initialMicOn={initialMicOn}
            roomReconnecting={roomReconnecting}
            vipTier={vipTier} 
            maxLiveMinutesFromDb={maxLiveMinutes}
            onUpgradeVip={() => setShowVipPurchase(true)}
            onTimeExpired={handleTimeExpired} 
            onLeaveRoom={() => {
              _nativeLiveStartTime = null;
              setToken(null);
              setCurrentRoomName('');
              AsyncStorage.removeItem(LIVE_ACTIVE_ROOM_KEY).catch(() => {});
              fetchRooms();
            }}
            onRoomEnded={handleRoomEnded}
          />
        </LiveKitRoom>
      </>
    );
  }

  if (preJoinCode !== null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <Stack.Screen options={{ title: 'Chuẩn bị tham gia' }} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 32, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 20 }}>Chuẩn bị tham gia</Text>

          {/* Info box */}
          {!preJoinIsCreate ? (
            <View style={{ backgroundColor: '#f1f5f9', borderRadius: 12, padding: 14, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#7c3aed' }}>
              <Text style={{ color: '#1e293b', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>Bạn đang vào xem live</Text>
              <Text style={{ color: '#64748b', fontSize: 13, lineHeight: 20 }}>Nếu đây không phải chủ phòng thì bạn chỉ xem và bình luận, không bật camera/micro.</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#ede9fe', borderRadius: 12, padding: 14, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#7c3aed' }}>
              <Text style={{ color: '#5b21b6', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>🎥 Bạn đang tạo phòng live</Text>
              <Text style={{ color: '#6d28d9', fontSize: 13, lineHeight: 20 }}>Mã phòng: <Text style={{ fontWeight: '700' }}>{preJoinCode}</Text></Text>
            </View>
          )}

          {/* Display name */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Tên hiển thị</Text>
          <TextInput
            style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827', marginBottom: 16 }}
            placeholder="Nhập tên hiển thị..."
            placeholderTextColor="#9ca3af"
            value={participantDisplayName}
            onChangeText={setParticipantDisplayName}
          />

          {/* Host options */}
          {preJoinIsCreate && (
            <>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Thiết lập phòng</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: preJoinCamOn ? '#7c3aed' : '#d1d5db', backgroundColor: preJoinCamOn ? '#ede9fe' : '#fff', alignItems: 'center' }}
                  onPress={() => setPreJoinCamOn(!preJoinCamOn)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 2 }}>{preJoinCamOn ? '📷' : '📷'}</Text>
                  <Text style={{ color: preJoinCamOn ? '#7c3aed' : '#6b7280', fontSize: 12, fontWeight: '600' }}>{preJoinCamOn ? 'Cam: Bật' : 'Cam: Tắt'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: preJoinMicOn ? '#7c3aed' : '#d1d5db', backgroundColor: preJoinMicOn ? '#ede9fe' : '#fff', alignItems: 'center' }}
                  onPress={() => setPreJoinMicOn(!preJoinMicOn)}
                >
                  <Text style={{ fontSize: 20, marginBottom: 2 }}>🎤</Text>
                  <Text style={{ color: preJoinMicOn ? '#7c3aed' : '#6b7280', fontSize: 12, fontWeight: '600' }}>{preJoinMicOn ? 'Mic: Bật' : 'Mic: Tắt'}</Text>
                </TouchableOpacity>
              </View>
              {!preJoinCamOn && (
                <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Thumbnail khi tắt cam</Text>
                  {preJoinThumbnailUrl ? (
                    <Image source={{ uri: preJoinThumbnailUrl }} style={{ width: '100%', height: 140, borderRadius: 8, marginBottom: 8 }} resizeMode="cover" />
                  ) : (
                    <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Chưa có thumbnail.</Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#7c3aed', alignItems: 'center', opacity: (uploadingThumbnail || isJoiningRoom) ? 0.6 : 1 }}
                      disabled={uploadingThumbnail || isJoiningRoom}
                      onPress={handlePickThumbnail}
                    >
                      <Text style={{ color: '#7c3aed', fontSize: 13, fontWeight: '600' }}>{uploadingThumbnail ? 'Đang tải...' : (preJoinThumbnailUrl ? 'Đổi ảnh' : '+ Tải ảnh')}</Text>
                    </TouchableOpacity>
                    {!!preJoinThumbnailUrl && (
                      <TouchableOpacity
                        style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' }}
                        disabled={uploadingThumbnail || isJoiningRoom}
                        onPress={() => setPreJoinThumbnailUrl('')}
                      >
                        <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>Xóa</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              style={{ paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#fff', alignItems: 'center' }}
              onPress={() => setPreJoinCode(null)}
              disabled={isJoiningRoom}
            >
              <Text style={{ color: '#374151', fontSize: 15, fontWeight: '600' }}>Huỷ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#7c3aed', alignItems: 'center', opacity: isJoiningRoom ? 0.75 : 1 }}
              onPress={enterRoom}
              disabled={isJoiningRoom}
            >
              {isJoiningRoom ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Vào phòng</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Live Streams' }} />
      <ScrollView style={styles.lobbyContainer} contentContainerStyle={styles.lobbyContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Zala Live</Text>
          <Text style={styles.heroSubtitle}>Phát trực tiếp và kết nối cộng đồng theo thời gian thực.</Text>
        </View>

        <View style={styles.vipSection}>
          <View style={styles.vipBadgeRow}>
            <Text style={[
              styles.vipBadge,
              { backgroundColor: vipTier === 'VIP2' ? '#ef4444' : vipTier === 'VIP1' ? '#f59e0b' : '#6b7280' }
            ]}>
              {vipTier === 'VIP2' ? '💎' : vipTier === 'VIP1' ? '👑' : '⭐'} {vipTier}
            </Text>
            {vipExpiry ? (
              <Text style={styles.vipExpiryText}>Hết hạn: {new Date(vipExpiry).toLocaleDateString('vi-VN')}</Text>
            ) : null}
          </View>
          <View style={styles.vipActions}>
            <TouchableOpacity style={styles.regulationsBtn} onPress={() => setShowRegulations(true)}>
              <Text style={styles.regulationsBtnText}>📋 Quy định</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => setShowVipPurchase(true)}>
              <Text style={styles.upgradeBtnText}>👑 Nâng cấp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.joinCard}>
          <Text style={styles.joinTitle}>Tham gia phòng</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập mã phòng (vd: abc-defg-hij)"
            placeholderTextColor="#9ca3af"
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <View style={styles.joinActionRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, isJoiningRoom && { opacity: 0.75 }]}
              disabled={isJoiningRoom}
              onPress={() => {
                _nativeLiveStartTime = Date.now();
                if (!joinCode.trim()) {
                  Alert.alert('Thiếu mã phòng', 'Bạn cần nhập mã phòng để tham gia.');
                  return;
                }
                openPreJoin(joinCode.trim(), false);
              }}
            >
              <Text style={styles.primaryBtnText}>Tham gia</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.joinCard}>
          <Text style={styles.joinTitle}>Tạo phòng mới</Text>
          <TextInput
            style={styles.input}
            placeholder="Tên phòng (tuỳ chọn)..."
            placeholderTextColor="#9ca3af"
            value={newRoomName}
            onChangeText={setNewRoomName}
          />
          <TouchableOpacity style={styles.toggleRow} onPress={() => setRequiresApproval(!requiresApproval)}>
            <View style={[styles.checkbox, requiresApproval && styles.checkboxActive]}>
              {requiresApproval && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.toggleText}>Duyệt người vào</Text>
          </TouchableOpacity>
          <View style={styles.joinActionRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => {
              const code = generateRoomCode();
              openPreJoin(code, true, newRoomName.trim());
            }}>
              <Text style={styles.secondaryBtnText}>Tạo mã & chuẩn bị</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Phòng đang live ({rooms.length})</Text>
          <TouchableOpacity onPress={fetchRooms} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>{loadingRooms ? 'Đang tải...' : 'Làm mới'}</Text>
          </TouchableOpacity>
        </View>

        {loadingRooms ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#6d28d9" />
            <Text style={styles.loadingText}>Đang tải danh sách phòng...</Text>
          </View>
        ) : rooms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa có phòng nào đang live</Text>
            <Text style={styles.emptyText}>Bạn có thể tạo phòng mới ở mục "Tạo phòng mới" phía trên.</Text>
          </View>
        ) : (
          rooms.map((room: any) => {
            const meta = room.metadata ? JSON.parse(room.metadata) : {};
            const isRoomHost = meta.hostId === currentIdentity || meta.hostName === currentName;
            const displayName = meta.displayName || room.name;
            const roomCode = meta.roomCode || room.name;
            const thumbnailUrl = meta.thumbnailUrl || '';
            return (
              <View key={room.name} style={styles.roomItem}>
                {thumbnailUrl ? (
                  <Image source={{ uri: thumbnailUrl }} style={styles.roomThumbnail} resizeMode="cover" />
                ) : (
                  <View style={styles.roomThumbnailFallback}>
                    <Text style={styles.roomThumbnailFallbackText}>LIVE</Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.roomTitleRow}>
                    <Text style={styles.roomName} numberOfLines={1}>{displayName}</Text>
                    {isRoomHost && (
                      <View style={styles.hostBadge}>
                        <Text style={styles.hostBadgeText}>HOST</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.roomCode}>Mã phòng: {roomCode}</Text>
                  <View style={styles.roomInfoRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.roomInfo}>LIVE · {room.numParticipants || 0} người tham gia</Text>
                  </View>
                </View>
                <View style={styles.roomActions}>
                  {isRoomHost && (
                    <TouchableOpacity style={[styles.actionPill, styles.deletePill]} onPress={() => deleteRoom(room.name)}>
                      <Text style={styles.actionPillText}>Xóa</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionPill, styles.joinPill, isJoiningRoom && { opacity: 0.65 }]}
                    disabled={isJoiningRoom}
                    onPress={() => {
                      _nativeLiveStartTime = Date.now();
                      openPreJoin(roomCode, false);
                    }}
                  >
                    <Text style={styles.actionPillText}>Tham gia</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modals */}
      <LiveRegulationsModal visible={showRegulations} onClose={() => setShowRegulations(false)} />
      <VipPurchaseModal
        visible={showVipPurchase}
        onClose={() => { setShowVipPurchase(false); fetchVipStatus(); }}
        accountId={currentIdentity}
        currentTier={vipTier}
      />
    </>
  );
}

// Component RoomView nằm TRONG <LiveKitRoom>
const STICKERS = [
  // --- VIP Category ---
  { id: 'rose', name: 'Hoa hồng', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/2558/2558542.png' },
  { id: 'diamond', name: 'Kim cương', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/2950/2950098.png' },
  { id: 'heart_gold', name: 'Tim vàng', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/833/833472.png' },
  { id: 'rocket', name: 'Tên lửa', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/1356/1356479.png' },
  { id: 'crown', name: 'Vương miện', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/694/694431.png' },
  { id: 'supercar', name: 'Siêu xe', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/741/741407.png' },
  
  // --- Pets Category ---
  ...Object.entries(STICKER_PACKS.pets).map(([id, url]) => ({
    id, name: id.replace(/_/g, ' '), category: 'Pets', url
  })),
  
  // --- Christmas Category ---
  ...Object.entries(STICKER_PACKS.christmas).map(([id, url]) => ({
    id, name: id.replace(/_/g, ' '), category: 'Christmas', url
  })),

  // --- Home Category ---
  ...Object.entries(STICKER_PACKS.home).map(([id, url]) => ({
    id, name: id.replace(/_/g, ' '), category: 'Home', url
  })),
];

const STICKER_CATEGORIES = [
  { id: 'VIP', icon: '✨' },
  { id: 'Pets', icon: '🐾' },
  { id: 'Christmas', icon: '🎄' },
  { id: 'Home', icon: '🏠' },
];

function RoomView({ roomName, isHost, canSubscribe, identity, initialMicOn, initialCamOn, roomReconnecting, vipTier, onTimeExpired, maxLiveMinutesFromDb, onUpgradeVip, onLeaveRoom, onRoomEnded }: { 
  roomName: string; isHost: boolean; canSubscribe: boolean; identity: string; initialMicOn?: boolean; initialCamOn?: boolean; roomReconnecting?: boolean; vipTier: string; onTimeExpired: () => void; maxLiveMinutesFromDb?: number; onUpgradeVip?: () => void; onLeaveRoom: () => void; onRoomEnded: (message?: string) => void;
}) {
  const room = useRoomContext();
  const localParticipant = room.localParticipant;
  const isLeavingRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const [trackVersion, setTrackVersion] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
  const [isEndingLive, setIsEndingLive] = useState(false);
   const [comments, setComments] = useState<Array<{ id: string; author: string; text: string; time: string }>>([]);
  const [newComment, setNewComment] = useState('');
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [sendAsDanmaku, setSendAsDanmaku] = useState(true);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isGiftEnabled, setIsGiftEnabled] = useState(true);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeGiftCategory, setActiveGiftCategory] = useState('VIP');
  const [selectedGiftSticker, setSelectedGiftSticker] = useState<any | null>(null);
  const [giftMessage, setGiftMessage] = useState('');
  const [lastTtsMessage, setLastTtsMessage] = useState<string | null>(null);
  const [showCommentPanel, setShowCommentPanel] = useState(true);
  const [showHostTools, setShowHostTools] = useState(false);
  const [dbGifts, setDbGifts] = useState<any[]>([]);
  const [topDonors, setTopDonors] = useState<{name: string; amount: number; stickerName: string}[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const danmakuRef = useRef<DanmakuLayerRef>(null);
  const giftRef = useRef<GiftOverlayRef>(null);

// Load gifts
useEffect(() => {
  billingService.getActiveGifts()
    .then(res => {
      const data = (res as any)?.data?.data || (res as any)?.data || [];
      const gifts = data.map((g: any) => ({
        id: g._id,
        name: g.name,
        price: g.price,
        category: 'VIP',
        url: g.iconUrl
      }));
      setDbGifts(gifts);
    })
    .catch(err => {
      console.warn("Could not load gifts", err);
    });
}, []);


// ── VIP Timer (timestamp-based) ──
const VIP_LIMITS: Record<string, number> = { VIP0: 300, VIP1: 1800, VIP2: -1 };

const dbLimitSeconds =
  maxLiveMinutesFromDb !== undefined
    ? (maxLiveMinutesFromDb === -1 ? -1 : maxLiveMinutesFromDb * 60)
    : undefined;

const maxSeconds = dbLimitSeconds ?? (VIP_LIMITS[vipTier] ?? 300);

const [liveElapsed, setLiveElapsed] = useState(() => {
  return _nativeLiveStartTime
    ? Math.floor((Date.now() - _nativeLiveStartTime) / 1000)
    : 0;
});

const [showTimeWarning, setShowTimeWarning] = useState(false);

const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
const warningShownRef = useRef(false);
const expiredRef = useRef(false);

// Timer chạy liên tục theo isHost
useEffect(() => {
  if (isHost && maxSeconds > 0) {
    const startTime = _nativeLiveStartTime || Date.now();
    warningShownRef.current = false;
    expiredRef.current = false;

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setLiveElapsed(elapsed);

      if (!warningShownRef.current && elapsed >= maxSeconds - 60 && elapsed < maxSeconds) {
        warningShownRef.current = true;
        setShowTimeWarning(true);
        // Bỏ Alert popup - chỉ hiện badge timer trên video
      }

      if (!expiredRef.current && elapsed >= maxSeconds) {
        expiredRef.current = true;

        if (timerRef.current) clearInterval(timerRef.current);

        _nativeLiveStartTime = null;

        Alert.alert(
          '⏰ Hết thời gian live',
          `Gói ${vipTier} chỉ cho phép live ${Math.floor(maxSeconds / 60)} phút.`,
          [{ text: 'Nâng cấp', onPress: onTimeExpired }]
        );
      }
    }, 1000);
  } else {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, [isHost, maxSeconds, vipTier, onTimeExpired]);

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

useEffect(() => {
  if (!isHost) return;
  const applyInitialMedia = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(Boolean(initialMicOn));
      await localParticipant.setCameraEnabled(Boolean(initialCamOn));
      setIsPublishing(Boolean(initialCamOn));
    } catch (err) {
      console.warn('Không thể áp dụng cấu hình cam/mic ban đầu:', err);
    }
  };
  applyInitialMedia();
}, [isHost, initialCamOn, initialMicOn, localParticipant]);

useEffect(() => {
  const bumpTracks = () => setTrackVersion((v) => v + 1);
  const updateCount = () => {
    // Tổng người tham gia = remote + bản thân (local)
    setViewerCount(room.remoteParticipants.size + (isHost ? 0 : 1));
  };
  room.on('participantConnected', bumpTracks);
  room.on('participantDisconnected', bumpTracks);
  room.on('trackSubscribed', bumpTracks);
  room.on('trackUnsubscribed', bumpTracks);
  room.on('trackPublished', bumpTracks);
  room.on('trackUnpublished', bumpTracks);
  room.on('participantConnected', updateCount);
  room.on('participantDisconnected', updateCount);
  bumpTracks();
  updateCount();
  return () => {
    room.off('participantConnected', bumpTracks);
    room.off('participantDisconnected', bumpTracks);
    room.off('trackSubscribed', bumpTracks);
    room.off('trackUnsubscribed', bumpTracks);
    room.off('trackPublished', bumpTracks);
    room.off('trackUnpublished', bumpTracks);
    room.off('participantConnected', updateCount);
    room.off('participantDisconnected', updateCount);
  };
}, [room, isHost]);

useEffect(() => {
  const handleRoomDisconnect = async (reason?: number) => {
    if (isLeavingRef.current) return;
    if (isHost) return;
    
    console.log('Room disconnected, reason:', reason);
    
    // DisconnectReason values from LiveKit:
    // 0 = UNKNOWN_REASON, 1 = CLIENT_INITIATED, 2 = DUPLICATE_IDENTITY,
    // 3 = SERVER_SHUTDOWN, 4 = PARTICIPANT_REMOVED, 5 = ROOM_DELETED,
    // 6 = STATE_MISMATCH, 7 = JOIN_FAILURE
    // If server explicitly shut down or room was deleted, exit immediately
    if (reason === 3 || reason === 4 || reason === 5) {
      onRoomEnded('Buổi live đã kết thúc. Cảm ơn bạn đã tham gia.');
      return;
    }

    // For other reasons (network issues etc), wait a bit then check if room still exists
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const res = await liveApi.get('/api/live/rooms');
      const exists = (res.data?.rooms || []).some((r: any) => r?.name === roomName);
      if (!exists) {
        onRoomEnded('Buổi live đã kết thúc. Cảm ơn bạn đã tham gia.');
      }
    } catch {
      onRoomEnded('Kết nối phòng live đã đóng.');
    }
  };

  room.on('disconnected', handleRoomDisconnect);
  return () => {
    room.off('disconnected', handleRoomDisconnect);
  };
}, [room, isHost, roomName, onRoomEnded]);

  const cleanName = (name: string) => {
    if (!name) return 'Bạn xem';
    let cleaned = name.replace(/^Phòng\s+[\d:]+\s+-\s+/i, '');
    cleaned = cleaned.replace(/^Phòng\s+[\d:]+/i, '');
    cleaned = cleaned.replace(/^uid_[\w\d]+/i, '');
    cleaned = cleaned.replace(/^Khách_[\w\d]+/i, '');
    return cleaned.trim() || 'Bạn xem';
  };

  // Update waiting participants based on room participants changes
  useEffect(() => {
    const updateWaiting = () => {
      const wp = [];
      for (const p of room.remoteParticipants.values()) {
        try {
          if (p.metadata) {
            const meta = JSON.parse(p.metadata);
            if (meta.status === 'waiting') wp.push(p);
          }
        } catch { }
      }
      setWaitingParticipants(wp);
    };
    room.on('participantMetadataChanged', updateWaiting);
    room.on('participantConnected', updateWaiting);
    room.on('participantDisconnected', updateWaiting);
    updateWaiting();
    
    return () => {
      room.off('participantMetadataChanged', updateWaiting);
      room.off('participantConnected', updateWaiting);
      room.off('participantDisconnected', updateWaiting);
    };
  }, [room]);

  useEffect(() => {
    const handleData = (payload: Uint8Array, participant?: any, kind?: any, topic?: string) => {
      if (topic && topic !== 'chat') return;
      try {
        const rawText = new TextDecoder().decode(payload);
        // Try parse JSON first (web sends JSON wrapped messages)
        let cleanText = rawText;
        let isDanmaku = false;
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed.message === 'string') {
            const msg = parsed.message;
            isDanmaku = msg.startsWith('[D]') || msg.startsWith('\u200B[D]');
            cleanText = isDanmaku ? msg.replace(/^(\u200B)?\[D\]/, '') : msg;
          } else {
            isDanmaku = rawText.startsWith('\u200B[D]');
            cleanText = isDanmaku ? rawText.replace('\u200B[D]', '') : rawText;
          }
        } catch {
          isDanmaku = rawText.startsWith('\u200B[D]');
          cleanText = isDanmaku ? rawText.replace('\u200B[D]', '') : rawText;
        }

        const msgId = `${Date.now()}-${Math.random()}`;
        setComments(prev => [
          ...prev,
          {
            id: msgId,
            author: participant?.name || participant?.identity || 'Khách',
            text: cleanText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);

        if (isDanmaku && danmakuEnabled && danmakuRef.current) {
          danmakuRef.current.addMessage({
            id: msgId,
            text: cleanText,
            isSelf: participant?.identity === localParticipant?.identity,
          });
        }
      } catch (error) {
        console.error('Lỗi khi nhận dữ liệu chat:', error);
      }
    };

    room.on('dataReceived', handleData);

    const handleGiftData = (payload: Uint8Array, participant?: any, kind?: any, topic?: string) => {
      if (topic !== 'gift') return;
      try {
        const text = new TextDecoder().decode(payload);
        const parsed = JSON.parse(text);
        if (parsed?.type === 'gift') {
          // Track top donors
          setTopDonors(prev => {
            const existing = prev.find(d => d.name === parsed.fromName);
            const price = parsed.price || 0;
            if (existing) {
              return prev
                .map(d => d.name === parsed.fromName ? { ...d, amount: d.amount + price, stickerName: parsed.stickerName } : d)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);
            } else {
              return [...prev, { name: parsed.fromName, amount: price, stickerName: parsed.stickerName }]
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);
            }
          });

          // 1. Luôn xử lý âm thanh (nếu loa đang bật)
          if (isHost || isTtsEnabled) {
            const msg = parsed.message ? ` với lời nhắn ${parsed.message}` : '';
            const ttsText = `Cảm ơn ${parsed.fromName} đã tặng bạn món quà ${parsed.stickerName}${msg}!`;
            setLastTtsMessage(ttsText);
            setTimeout(() => setLastTtsMessage(prev => prev === ttsText ? null : prev), 5000);
            
            Speech.speak(ttsText, {
              language: 'vi-VN',
              rate: 1.0,
            });
          }

          // 2. Chỉ hiển thị hình ảnh nếu nút "Hiện chữ Donate" đang bật
          if (isGiftEnabled && giftRef.current) {
            giftRef.current.showGift({
              id: `gift-${Date.now()}`,
              senderName: parsed.fromName,
              stickerUrl: parsed.stickerUrl,
              stickerName: parsed.stickerName,
              message: parsed.message,
            });
          }
        }
      } catch (error) {
        console.error('Lỗi khi nhận quà:', error);
      }
    };
    room.on('dataReceived', handleGiftData);

    return () => { 
      room.off('dataReceived', handleData); 
      room.off('dataReceived', handleGiftData);
    };
  }, [room, isHost, isTtsEnabled, isGiftEnabled]);

  const approveUser = async (participantIdentity: string) => {
    await liveApi.post('/api/live/approve', {
      roomName, participantIdentity
    });
  };

  const kickUser = async (participantIdentity: string) => {
    await liveApi.post('/api/live/kick', {
      roomName,
      hostId: identity,
      participantIdentity,
    });
  };

  const handleEndLive = async () => {
    if (!isHost || isEndingLive) return;
    Alert.alert('Xác nhận', 'Bạn có chắc chắn muốn kết thúc buổi live?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Kết thúc',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsEndingLive(true);
            const res = await liveApi.delete('/api/live/room', {
              params: { roomName, hostId: identity },
            });
            const ok = res.data?.success !== false;
            if (!ok) {
              Alert.alert('Lỗi', res.data?.error || 'Không thể kết thúc live.');
              setIsEndingLive(false);
              return;
            }
            // Đánh dấu disconnect có chủ ý để không trigger reconnect
            intentionalDisconnectRef.current = true;
            _intentionalDisconnect = true;
            // Gọi onRoomEnded TRƯỜC khi disconnect để UI chuyển ngay
            onRoomEnded('Buổi live đã kết thúc. Cảm ơn bạn đã tham gia.');
            try { room.disconnect(); } catch {}
          } catch (err: any) {
            Alert.alert('Lỗi', err?.response?.data?.message || 'Không thể kết thúc live.');
            setIsEndingLive(false);
          }
        },
      },
    ]);
  };

  const handleLeaveRoom = async () => {
    if (isEndingLive) return;
    const title = isHost ? 'Rời phòng live?' : 'Rời phòng xem live?';
    const msg = isHost
      ? 'Bạn sẽ rời phòng, người xem vẫn có thể ở lại cho đến khi phòng kết thúc.'
      : 'Bạn sẽ thoát khỏi phòng live hiện tại.';
    Alert.alert(title, msg, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Rời phòng',
        style: 'destructive',
        onPress: async () => {
          intentionalDisconnectRef.current = true;
          _intentionalDisconnect = true;
          isLeavingRef.current = true;
          try {
            room.disconnect();
          } catch {}
          onLeaveRoom();
        },
      },
    ]);
  };

  const copyLink = async () => {
    const link = `${URL_BE}/live?room=${encodeURIComponent(roomName)}`;
    const message = `Hãy tham gia phòng Live Stream trên Zala!\n\n🔗 Link tham gia nhanh: ${link}\n\n📌 Hoặc nhập tên phòng:\n"${roomName}"`;
    await Clipboard.setStringAsync(message);
    alert('Đã copy tin nhắn mời tham gia phòng!');
  };

  const sendGift = async (sticker: typeof STICKERS[0]) => {
    try {
      // 1. Find host identity
      let hostIdentity = '';
      try {
        const meta = room.metadata ? JSON.parse(room.metadata) : {};
        hostIdentity = meta.hostId || '';
      } catch {}
      
      if (!hostIdentity) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin chủ phòng!');
        return;
      }

      // 2. API Donate
      try {
        await billingService.donate(hostIdentity, sticker.id, roomName);
      } catch (err: any) {
        Alert.alert('Lỗi', err?.response?.data?.message || 'Lỗi khi tặng quà, có thể bạn không đủ xu.');
        return;
      }

      // 3. Broadcast
      const giftData = {
        type: 'gift',
        stickerId: sticker.id,
        stickerName: sticker.name,
        stickerUrl: sticker.url,
        price: sticker.price || 0,
        message: giftMessage || '',
        fromName: cleanName(localParticipant.name || localParticipant.identity),
        ts: Date.now(),
      };
      const payload = new TextEncoder().encode(JSON.stringify(giftData));
      await localParticipant.publishData(payload, { topic: 'gift', kind: DataPacket_Kind.RELIABLE });
      
      // Local display - Chỉ hiện nếu nút "Hiện chữ Donate" đang bật
      if (isGiftEnabled && giftRef.current) {
        giftRef.current.showGift({
          id: `gift-${Date.now()}`,
          senderName: 'Bạn',
          stickerUrl: sticker.url,
          stickerName: sticker.name,
          message: giftMessage || '',
        });
      }
      setShowStickerPicker(false);
      setGiftMessage('');
      setSelectedGiftSticker(null);
    } catch (error) {
      console.error('Lỗi gửi quà:', error);
    }
  };

  const isApproved = localParticipant.permissions?.canSubscribe ?? canSubscribe;

  const handleSendComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;

    try {
      // Gửi JSON format giống Web để cả 2 phía đọc được (tránh web crash khi JSON.parse)
      const messageText = sendAsDanmaku ? `[D]${trimmed}` : trimmed;
      const chatPayload = {
        id: `${Date.now()}-${Math.random()}`,
        message: messageText,
        timestamp: Date.now(),
        ignoreLegacy: false,
      };
      const payload = new TextEncoder().encode(JSON.stringify(chatPayload));
      await localParticipant.publishData(payload, { topic: 'chat', kind: DataPacket_Kind.RELIABLE });
      setNewComment('');

      // Hiện ngay bình luận của bản thân (optimistic)
      const msgId = `self-${Date.now()}`;
      setComments(prev => [
        ...prev,
        {
          id: msgId,
          author: localParticipant.name || 'Bạn',
          text: trimmed,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (sendAsDanmaku && danmakuEnabled && danmakuRef.current) {
        danmakuRef.current.addMessage({
          id: msgId,
          text: trimmed,
          isSelf: true,
        });
      }
    } catch (error) {
      console.error('Không gửi được bình luận:', error);
      Alert.alert('Lỗi', 'Không thể gửi bình luận. Vui lòng thử lại.');
    }
  };

  if (!isApproved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#fff', fontSize: 18, marginTop: 20 }}>Vui lòng chờ chủ phòng duyệt...</Text>
      </View>
    );
  }

  // Track hiển thị:
  // - Host: ưu tiên screen_share, fallback camera local.
  // - Viewer: lấy video đã subscribe từ remote publications (robust cho web↔native).
  const cameraPublication = localParticipant.getTrackPublication?.('camera');
  const cameraTrack = cameraPublication?.videoTrack;
  const screenPublication = localParticipant.getTrackPublication?.('screen_share');
  const screenTrack = screenPublication?.videoTrack;

  const remoteTrackRef = (() => {
    void trackVersion;
    const participants = Array.from(room.remoteParticipants.values()) as any[];
    let hostIdentity = '';
    let hostName = '';
    try {
      const meta = room.metadata ? JSON.parse(room.metadata) : {};
      hostIdentity = String(meta.hostId || meta.hostIdentity || '').trim();
      hostName = String(meta.hostName || '').trim();
    } catch {}

    const getVideoPublications = (p: any) => {
      const publications: any[] = Array.from(p?.trackPublications?.values?.() || []);
      return publications.filter((pub: any) => pub?.kind === 'video');
    };

    const hasSourcePublication = (p: any, source: 'camera' | 'screen_share') => {
      const pubs = getVideoPublications(p);
      return pubs.some((pub: any) => pub?.source === source && (pub?.track || pub?.videoTrack || pub?.trackSid || pub?.isSubscribed !== false));
    };

    const pickSourceForParticipant = (p: any): 'camera' | 'screen_share' | null => {
      if (hasSourcePublication(p, 'screen_share')) return 'screen_share';
      if (hasSourcePublication(p, 'camera')) return 'camera';
      const fallbackVideoPub = getVideoPublications(p).find((pub: any) => pub?.source);
      return (fallbackVideoPub?.source as 'camera' | 'screen_share' | undefined) ?? null;
    };

    const isHostParticipant = (p: any) => {
      const identity = String(p?.identity || '').trim();
      const name = String(p?.name || '').trim();
      if (hostIdentity && identity === hostIdentity) return true;
      if (!hostIdentity && hostName && name === hostName) return true;
      try {
        const pMeta = p?.metadata ? JSON.parse(p.metadata) : {};
        if (pMeta?.isHost === true) return true;
        if (String(pMeta?.role || '').toLowerCase() === 'host') return true;
      } catch {}
      return false;
    };

    // Viewer chỉ render video của host để đồng bộ luồng web <-> mobile.
    let hostParticipant = participants.find((p: any) => isHostParticipant(p));
    // Fallback an toàn theo luồng thực tế: nếu metadata host chưa đồng bộ, chọn participant đang publish camera/screen.
    if (!hostParticipant) {
      hostParticipant = participants.find((p: any) => hasSourcePublication(p, 'camera') || hasSourcePublication(p, 'screen_share'));
    }
    // Fallback an toàn: nếu chỉ có 1 remote participant thì đó gần như chắc chắn là host.
    if (!hostParticipant && participants.length === 1) {
      hostParticipant = participants[0];
    }

    if (!hostParticipant) return null;

    {
      const participant = hostParticipant;
      const source = pickSourceForParticipant(participant);
      if (source) {
        const publication = participant.getTrackPublication?.(source);
        return { participant, source, publication };
      }
    }
    return null;
  })();

  const toggleCamera = async () => {
    if (isPublishing) {
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setMicrophoneEnabled(false);
      setIsPublishing(false);
    } else {
      await localParticipant.setCameraEnabled(true);
      await localParticipant.setMicrophoneEnabled(true);
      setIsPublishing(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
    >
      {/* ===== VIDEO AREA ===== */}
      <View style={styles.videoContainer}>
        {isHost && isPublishing && (screenTrack || cameraTrack) ? (
          <VideoTrack
            trackRef={{ participant: localParticipant, source: screenTrack ? 'screen_share' : 'camera', publication: screenTrack ? screenPublication : cameraPublication }}
            style={styles.video}
          />
        ) : !isHost && remoteTrackRef ? (
          <VideoTrack
            trackRef={remoteTrackRef}
            style={styles.video}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>⏳</Text>
            <Text style={styles.text}>{isHost ? 'Chưa phát live' : 'Đang chờ host phát video...'}</Text>
            {!isHost && <Text style={[styles.text, { fontSize: 13, color: '#94a3b8', marginTop: 6 }]}>Hãy giữ kết nối, live stream sẽ sớm bắt đầu</Text>}
          </View>
        )}

        {/* Danmaku + Gift */}
        <DanmakuLayer ref={danmakuRef} enabled={danmakuEnabled} />
        <GiftOverlay ref={giftRef} />

        {/* Top-left: reconnecting badge */}
        {roomReconnecting && (
          <View style={styles.connectionBadge}>
            <Text style={styles.connectionBadgeText}>↻ Đang kết nối lại...</Text>
          </View>
        )}

        {/* Top-left: viewer count */}
        <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' }} />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>LIVE</Text>
          <Text style={{ color: '#fff', fontSize: 12 }}>• {viewerCount} người xem</Text>
        </View>

        {/* Top-right: VIP Timer */}
        {isHost && maxSeconds > 0 && (
          <View style={{
            position: 'absolute', top: 12, right: 12,
            backgroundColor: showTimeWarning ? 'rgba(239,68,68,0.9)' : 'rgba(0,0,0,0.55)',
            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
          }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>⏱️ {formatTime(Math.max(0, maxSeconds - liveElapsed))}</Text>
          </View>
        )}

        {/* Bottom overlay controls on video */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          {/* Host: cam/mic + end live buttons */}
          {isHost && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: isPublishing ? '#ef4444' : '#16a34a', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}
                onPress={toggleCamera}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{isPublishing ? '📷 Tắt cam/mic' : '📷 Phát Live'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.85)', opacity: isEndingLive ? 0.7 : 1 }}
                disabled={isEndingLive}
                onPress={handleEndLive}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{isEndingLive ? '⏹...' : '⏹ Kết thúc'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ===== CONTROL BAR (below video) ===== */}
      <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#1e293b', alignItems: 'center' }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b', alignItems: 'center' }}
          onPress={copyLink}
        >
          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>🔗 Chia sẻ phòng</Text>
        </TouchableOpacity>
        {isHost && (
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: showHostTools ? '#7c3aed' : '#334155', backgroundColor: showHostTools ? '#ede9fe' : '#1e293b', alignItems: 'center' }}
            onPress={() => setShowHostTools(!showHostTools)}
          >
            <Text style={{ color: showHostTools ? '#7c3aed' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>⚙️ Công cụ</Text>
          </TouchableOpacity>
        )}
        {!isHost && (
          <TouchableOpacity
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#dc2626', alignItems: 'center' }}
            onPress={handleLeaveRoom}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>← Rời phòng</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ===== HOST TOOLS PANEL ===== */}
      {isHost && showHostTools && (
        <View style={{ backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#1e293b' }}>
          <TouchableOpacity
            style={[styles.optionChip, danmakuEnabled && styles.optionChipActive]}
            onPress={() => setDanmakuEnabled(!danmakuEnabled)}
          >
            <Text style={[styles.optionChipText, danmakuEnabled && styles.optionChipTextActive]}>{danmakuEnabled ? 'Chữ chạy: Bật' : 'Chữ chạy: Tắt'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionChip, isTtsEnabled && styles.optionChipActive]}
            onPress={() => setIsTtsEnabled(!isTtsEnabled)}
          >
            <Text style={[styles.optionChipText, isTtsEnabled && styles.optionChipTextActive]}>{isTtsEnabled ? 'Loa donate: Bật' : 'Loa donate: Tắt'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionChip, isGiftEnabled && styles.optionChipActive]}
            onPress={() => setIsGiftEnabled(!isGiftEnabled)}
          >
            <Text style={[styles.optionChipText, isGiftEnabled && styles.optionChipTextActive]}>{isGiftEnabled ? 'Hiệu ứng quà: Bật' : 'Hiệu ứng quà: Tắt'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ===== APPROVAL LIST (Host) ===== */}
      {isHost && waitingParticipants.length > 0 && (
        <View style={styles.approvalList}>
          <Text style={styles.approvalTitle}>Yêu cầu tham gia ({waitingParticipants.length}):</Text>
          <ScrollView style={{ maxHeight: 160 }}>
            {waitingParticipants.map(p => (
              <View key={p.identity} style={styles.waitingItem}>
                <Text style={styles.waitingName}>{p.identity}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveUser(p.identity)}>
                    <Text style={styles.approveText}>Duyệt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.approveBtn, { backgroundColor: '#ef4444' }]} onPress={() => kickUser(p.identity)}>
                    <Text style={styles.approveText}>Từ chối</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ===== TOP DONATE PANEL ===== */}
      {topDonors.length > 0 && (
        <View style={{ backgroundColor: '#1e1b4b', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#312e81' }}>
          <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '700', marginBottom: 6 }}>🏆 Top Donate</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {topDonors.slice(0, 5).map((donor, i) => (
                <View key={donor.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(124,58,237,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '800' }}>#{i + 1}</Text>
                  <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '600' }}>{donor.name}</Text>
                  {donor.amount > 0 && <Text style={{ color: '#a78bfa', fontSize: 10 }}>{donor.amount}★</Text>}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* ===== COMMENT SECTION ===== */}
      <View style={[styles.commentSection, { maxHeight: showCommentPanel ? (showStickerPicker ? 380 : 260) : 60 }]}>
        <TouchableOpacity style={styles.commentTitleRow} onPress={() => setShowCommentPanel(!showCommentPanel)}>
          <Text style={styles.commentTitle}>💬 Bình luận ({comments.length})</Text>
          <Text style={styles.collapseBtnText}>{showCommentPanel ? '▼' : '▲'}</Text>
        </TouchableOpacity>
        {showCommentPanel && (
          <ScrollView style={styles.commentList} ref={r => { if (r && comments.length > 0) r.scrollToEnd({ animated: false }); }}>
            {comments.length === 0 ? (
              <Text style={styles.commentEmpty}>Chưa có bình luận nào.</Text>
            ) : comments.map(c => (
              <View key={c.id} style={styles.commentItem}>
                <Text style={styles.commentAuthor}>{c.author}: <Text style={styles.commentText}>{c.text}</Text></Text>
              </View>
            ))}
          </ScrollView>
        )}
        {/* ===== GIFT PICKER ===== */}
        {showStickerPicker && (
          <View style={styles.giftPanel}>
            {!selectedGiftSticker ? (
              <>
                <View style={styles.giftCategoryRow}>
                  {STICKER_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setActiveGiftCategory(cat.id)}
                      style={[styles.giftCategoryBtn, activeGiftCategory === cat.id && styles.giftCategoryBtnActive]}
                    >
                      <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {(dbGifts.length > 0 ? dbGifts : STICKERS).filter(s => s.category === activeGiftCategory).map(s => (
                    <TouchableOpacity key={s.id} onPress={() => setSelectedGiftSticker(s)} style={styles.giftItemBtn}>
                      <Image
                        source={typeof s.url === 'string' ? { uri: s.url } : s.url}
                        style={{ width: 40, height: 40 }}
                      />
                      {s.price && <Text style={styles.giftPrice}>{s.price}</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Image
                      source={typeof selectedGiftSticker.url === 'string' ? { uri: selectedGiftSticker.url } : selectedGiftSticker.url}
                      style={{ width: 30, height: 30 }}
                    />
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Tặng {selectedGiftSticker.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedGiftSticker(null)}>
                    <Text style={{ color: '#9ca3af', fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={{ backgroundColor: '#374151', color: '#fff', padding: 8, borderRadius: 8, fontSize: 12 }}
                  value={giftMessage}
                  onChangeText={setGiftMessage}
                  placeholder="Nhập lời nhắn..."
                  placeholderTextColor="#9ca3af"
                  autoFocus
                />
                <TouchableOpacity
                  style={{ backgroundColor: '#7c3aed', padding: 10, borderRadius: 8, alignItems: 'center' }}
                  onPress={() => sendGift(selectedGiftSticker)}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Gửi ngay</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={styles.commentInputRow}>
          <TouchableOpacity
            style={[styles.roundBtn, sendAsDanmaku && styles.roundBtnActive]}
            onPress={() => setSendAsDanmaku(!sendAsDanmaku)}
          >
            <Text style={styles.roundBtnText}>{sendAsDanmaku ? 'D' : 'C'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roundBtn, showStickerPicker && styles.roundBtnActive]}
            onPress={() => setShowStickerPicker(!showStickerPicker)}
          >
            <Text style={styles.roundBtnText}>🎁</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.commentInput}
            placeholder={sendAsDanmaku ? 'Chữ chạy...' : 'Bình luận...'}
            placeholderTextColor="#9ca3af"
            value={newComment}
            onChangeText={setNewComment}
          />
          <TouchableOpacity style={styles.commentSendBtn} onPress={handleSendComment}>
            <Text style={styles.commentSendText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  videoContainer: { height: '45%', minHeight: 200, backgroundColor: '#111' },
  video: { flex: 1, width: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  connectionBadge: { position: 'absolute', top: 12, left: 12, zIndex: 10, backgroundColor: 'rgba(15,23,42,0.86)', borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  connectionBadgeText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  controls: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#0f172a', flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#1f2937' },
  controlBtn: { flexGrow: 1, minWidth: 112, minHeight: 44, borderRadius: 12, backgroundColor: '#6d28d9', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  controlBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  hostToolsWrap: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4 },
  hostToolsToggle: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  hostToolsToggleText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  hostOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#0f172a', paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4 },
  optionChip: { borderRadius: 999, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1f2937', paddingHorizontal: 10, paddingVertical: 6 },
  optionChipActive: { borderColor: '#7c3aed', backgroundColor: '#ede9fe' },
  optionChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  optionChipTextActive: { color: '#5b21b6' },
  text: { color: '#fff', marginTop: 10, fontSize: 16 },
  errorText: { color: 'red', textAlign: 'center', fontSize: 16, marginBottom: 10 },
  infoText: { color: '#374151', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  lobbyContainer: { flex: 1, backgroundColor: '#f3f4f6' },
  lobbyContent: { padding: 16, paddingBottom: 28, gap: 12 },
  heroCard: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#ddd6fe', padding: 16, shadowColor: '#7c3aed', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  heroTitle: { color: '#5b21b6', fontSize: 20, fontWeight: '800' },
  heroSubtitle: { color: '#6b7280', fontSize: 13, marginTop: 4 },
  joinCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, gap: 10 },
  preJoinCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ddd6fe', padding: 16, gap: 10, shadowColor: '#7c3aed', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  preJoinCodeText: { color: '#4b5563', textAlign: 'left', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  thumbnailSection: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f8fafc', padding: 10, gap: 8 },
  thumbnailLabel: { color: '#111827', fontSize: 13, fontWeight: '700' },
  thumbnailHint: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  thumbnailPreview: { width: '100%', height: 120, borderRadius: 10, backgroundColor: '#e2e8f0' },
  joinTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  joinActionRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#6d28d9', justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryBtn: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14 },
  secondaryBtnText: { color: '#374151', fontWeight: '600', fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxActive: { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  toggleText: { fontSize: 14, color: '#4b5563' },
  input: { flex: 1, height: 48, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: '#d1d5db' },
  button: { backgroundColor: '#6d28d9', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 12, height: 48 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  headerRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginBottom: 4 },
  subtitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  refreshBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#e5e7eb', borderRadius: 6 },
  refreshText: { fontSize: 14, color: '#4b5563', fontWeight: '500' },
  roomList: { flex: 1, width: '100%' },
  roomItem: { backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', gap: 10 },
  roomThumbnail: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#e2e8f0' },
  roomThumbnailFallback: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
  roomThumbnailFallbackText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomName: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111827' },
  hostBadge: { backgroundColor: '#7c3aed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  hostBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  roomCode: { fontSize: 12, color: '#64748b' },
  roomInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  roomInfo: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  roomActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionPill: { minHeight: 36, borderRadius: 999, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  joinPill: { backgroundColor: '#10b981' },
  deletePill: { backgroundColor: '#ef4444' },
  actionPillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  loadingCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: '#475569', fontSize: 14, fontWeight: '500' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 16 },
  emptyTitle: { color: '#111827', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: '#6b7280', fontSize: 14, lineHeight: 20 },
  commentSection: { backgroundColor: '#0b1220', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#1f2937' },
  commentTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  commentTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  collapseBtn: { borderRadius: 999, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1f2937', paddingHorizontal: 12, paddingVertical: 6 },
  collapseBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  commentList: { maxHeight: 180, marginBottom: 12 },
  commentEmpty: { color: '#94a3b8', fontSize: 14 },
  commentItem: { marginBottom: 10, padding: 10, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#1f2937' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { color: '#f8fafc', fontWeight: '700' },
  commentTime: { color: '#94a3b8', fontSize: 12 },
  commentText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  roundBtnActive: { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  roundBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  commentInput: { flex: 1, backgroundColor: '#1f2937', color: '#f8fafc', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  commentSendBtn: { backgroundColor: '#6d28d9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  commentSendText: { color: '#fff', fontWeight: '700' },
  giftPanel: { backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1f2937', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14, gap: 10 },
  giftCategoryRow: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  giftCategoryBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937' },
  giftCategoryBtnActive: { borderColor: '#7c3aed', backgroundColor: '#ede9fe' },
  giftItemBtn: { backgroundColor: '#374151', padding: 6, borderRadius: 10, alignItems: 'center', minWidth: 56 },
  giftPrice: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold' },
  approvalList: { position: 'absolute', bottom: 100, left: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 12, width: 250, zIndex: 10 },
  approvalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  waitingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  waitingName: { color: '#e5e7eb', flex: 1, fontSize: 14 },
  approveBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  approveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  // VIP styles
  vipSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  vipBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vipBadge: { color: '#fff', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  vipExpiryText: { color: '#6b7280', fontSize: 11 },
  vipActions: { flexDirection: 'row', gap: 8 },
  regulationsBtn: { backgroundColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  regulationsBtnText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  upgradeBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  upgradeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
