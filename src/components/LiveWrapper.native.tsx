import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import axios from 'axios';
import { Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
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

export default function LiveScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [canSubscribe, setCanSubscribe] = useState(true);
  const [currentRoomName, setCurrentRoomName] = useState('');
  const [showRegulations, setShowRegulations] = useState(false);
  const [showVipPurchase, setShowVipPurchase] = useState(false);
  const [vipTier, setVipTier] = useState<string>('VIP0');
  const [vipExpiry, setVipExpiry] = useState<string | null>(null);
  const [maxLiveMinutes, setMaxLiveMinutes] = useState<number>(5);

  const { user } = useUser();
  const [tempId] = useState('temp_id_' + Math.floor(Math.random() * 1000));
  const [tempName] = useState('UserDemo_' + Math.floor(Math.random() * 1000));
  const currentIdentity = user?.id || tempId;
  const currentName = user?.fullName || tempName;

  // Fetch VIP status
  const fetchVipStatus = async () => {
    try {
      const res = await axios.get(`${URL_BE}/api/payment/vip-status`, { params: { accountId: currentIdentity } });
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
      const response = await axios.get('/api/live/rooms');
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

  const generateRoomCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segment = (len: number) => Array.from({length: len}).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    setRoomName(`${segment(3)}-${segment(4)}-${segment(3)}`);
  };

  const joinRoom = async (name: string) => {
    if (!name.trim()) return;
    try {
      const response = await axios.get('/api/live/token', {
        params: {
          roomName: name,
          participantName: currentName,
          participantId: currentIdentity,
          requiresApproval: requiresApproval
        },
      });
      setToken(response.data.token);
      setIsHost(response.data.isHost);
      setCanSubscribe(response.data.canSubscribe);
      setCurrentRoomName(name);
      // Không reset ở đây, đã reset ở nút bấm lobby
    } catch (err) {
      console.error('Lỗi lấy token:', err);
      setError('Không thể kết nối đến Backend lấy Token. Kiểm tra lại IP hoặc Server.');
    }
  };

  const deleteRoom = (name: string) => {
    Alert.alert('Xác nhận', `Bạn có chắc chắn muốn xóa phòng ${name} không?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => {
        try {
          const res = await axios.delete('/api/live/room', {
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
    setShowVipPurchase(true);
    fetchRooms();
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Thử lại" onPress={() => setError(null)} />
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
          audio={isHost}
          onDisconnected={() => {
            // Không setToken(null) ngay để tránh bay ra lobby
            console.log('Native disconnected...');
            fetchRooms();
          }}
        >
          <RoomView 
            roomName={currentRoomName} 
            isHost={isHost} 
            canSubscribe={canSubscribe} 
            vipTier={vipTier} 
            maxLiveMinutesFromDb={maxLiveMinutes}
            onUpgradeVip={() => setShowVipPurchase(true)}
            onTimeExpired={handleTimeExpired} 
          />
        </LiveKitRoom>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Live Streams' }} />
      <View style={styles.lobbyContainer}>
        {/* VIP Badge & Actions */}
        <View style={styles.vipSection}>
          <View style={styles.vipBadgeRow}>
            <Text style={[
              styles.vipBadge,
              { backgroundColor: vipTier === 'VIP2' ? '#ef4444' : vipTier === 'VIP1' ? '#f59e0b' : '#6b7280' }
            ]}>
              {vipTier === 'VIP2' ? '💎' : vipTier === 'VIP1' ? '👑' : '⭐'} {vipTier}
            </Text>
            {vipExpiry && (
              <Text style={styles.vipExpiryText}>
                HH: {new Date(vipExpiry).toLocaleDateString('vi-VN')}
              </Text>
            )}
          </View>
          <View style={styles.vipActions}>
            <TouchableOpacity style={styles.regulationsBtn} onPress={() => setShowRegulations(true)}>
              <Text style={styles.regulationsBtnText}>📋 Quy Định</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.upgradeBtn} onPress={() => setShowVipPurchase(true)}>
              <Text style={styles.upgradeBtnText}>👑 Nâng Cấp VIP</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.createSection}>
          <View style={styles.inputWrapper}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Nhập tên hoặc mã phòng để tham gia..."
                placeholderTextColor="#9ca3af"
                value={roomName}
                onChangeText={setRoomName}
              />
              <TouchableOpacity 
                style={{ backgroundColor: '#e5e7eb', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db' }}
                onPress={generateRoomCode}
              >
                <Text style={{ color: '#4b5563', fontWeight: '600', fontSize: 14 }}>Tạo mã</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.toggleRow} 
              onPress={() => setRequiresApproval(!requiresApproval)}
            >
              <View style={[styles.checkbox, requiresApproval && styles.checkboxActive]}>
                {requiresApproval && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.toggleText}>Duyệt người vào (Chỉ áp dụng khi tạo mới)</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={() => {
            _nativeLiveStartTime = Date.now(); // Reset timestamp
            joinRoom(roomName);
          }}>
            <Text style={styles.buttonText}>Tạo / Vào</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Các phòng đang Live:</Text>
          <TouchableOpacity onPress={fetchRooms} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>Làm mới</Text>
          </TouchableOpacity>
        </View>

        {loadingRooms ? (
          <ActivityIndicator size="large" color="#6d28d9" style={{ marginTop: 20 }} />
        ) : (
          <ScrollView style={styles.roomList}>
            {rooms.length === 0 ? (
              <Text style={styles.emptyText}>Hiện chưa có ai đang live.</Text>
            ) : (
              rooms.map((room: any) => {
                const meta = room.metadata ? JSON.parse(room.metadata) : {};
                const isRoomHost = meta.hostId === currentIdentity || meta.hostName === currentName;
                return (
                  <View key={room.name} style={styles.roomItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomInfo}>{room.numParticipants || 0} người tham gia</Text>
                    </View>
                    <View style={styles.roomActions}>
                      {isRoomHost && (
                        <TouchableOpacity 
                          style={[styles.joinBadge, { backgroundColor: '#ef4444', marginRight: 10 }]} 
                          onPress={() => deleteRoom(room.name)}
                        >
                          <Text style={styles.joinText}>Xóa</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.joinBadge} onPress={() => joinRoom(room.name)}>
                        <Text style={styles.joinText}>Tham gia</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>

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

function RoomView({ roomName, isHost, canSubscribe, vipTier, onTimeExpired, maxLiveMinutesFromDb, onUpgradeVip }: { 
  roomName: string, isHost: boolean, canSubscribe: boolean, vipTier: string, onTimeExpired: () => void, maxLiveMinutesFromDb?: number, onUpgradeVip?: () => void 
}) {
  const room = useRoomContext();
  const [isPublishing, setIsPublishing] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState<any[]>([]);
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
  const [dbGifts, setDbGifts] = useState<any[]>([]);
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
        Alert.alert('⚠️ Sắp hết giờ', `Bạn còn 1 phút live. Nâng cấp VIP để live lâu hơn!`);
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
        const isDanmaku = rawText.startsWith('\u200B[D]');
        const cleanText = isDanmaku ? rawText.replace('\u200B[D]', '') : rawText;

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

  const approveUser = async (identity: string) => {
    await axios.post('/api/live/approve', {
      roomName, participantIdentity: identity
    });
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

  const localParticipant = room.localParticipant;
  const isApproved = localParticipant.permissions?.canSubscribe ?? canSubscribe;

  const handleSendComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;

    try {
      const messageToSend = sendAsDanmaku ? `\u200B[D]${trimmed}` : trimmed;
      const payload = new TextEncoder().encode(messageToSend);
      await localParticipant.publishData(payload, { topic: 'chat', kind: DataPacket_Kind.RELIABLE });
      setNewComment('');
      
      // For self, if not using reliable broadcast update local UI
      if (sendAsDanmaku && danmakuEnabled && danmakuRef.current) {
         danmakuRef.current.addMessage({
            id: `self-${Date.now()}`,
            text: trimmed,
            isSelf: true,
         });
      }
    } catch (error) {
      console.error('Không gửi được bình luận:', error);
      const msgId = `${Date.now()}-${Math.random()}`;
      setComments(prev => [
        ...prev,
        {
          id: msgId,
          author: localParticipant.name || 'Khách',
          text: trimmed,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setNewComment('');
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

  // Lấy track camera của mình
  const cameraPublication = localParticipant.getTrackPublication('camera');
  const cameraTrack = cameraPublication?.videoTrack;

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
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        {cameraTrack && isPublishing ? (
          <VideoTrack trackRef={{ participant: localParticipant, source: 'camera' }} style={styles.video} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.text}>{isHost ? 'Chưa phát live' : 'Bạn đang xem live stream'}</Text>
            {!isHost && <Text style={[styles.text, { fontSize: 14, color: '#94a3b8', marginTop: 8 }]}>Chỉ xem và bình luận, không bật camera/mic.</Text>}
          </View>
        )}
        <DanmakuLayer ref={danmakuRef} enabled={danmakuEnabled} />
        <GiftOverlay ref={giftRef} />
        {/* VIP Timer Overlay - hiện luôn khi là host, kể cả tắt cam */}
        {isHost && maxSeconds > 0 && (
          <View style={{
            position: 'absolute', top: 10, right: 10,
            backgroundColor: showTimeWarning ? 'rgba(239,68,68,0.9)' : 'rgba(0,0,0,0.6)',
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6,
          }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
              ⏱️ {formatTime(maxSeconds - liveElapsed)} 
            </Text>
          </View>
        )}
        {showTimeWarning && (
          <View style={{
            position: 'absolute', top: 50, left: 20, right: 20,
            backgroundColor: 'rgba(239,68,68,0.95)', padding: 12, borderRadius: 12, alignItems: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
              ⚠️ Còn 1 phút! Nâng cấp VIP để live lâu hơn
            </Text>
            {onUpgradeVip && (
              <TouchableOpacity
                onPress={onUpgradeVip}
                style={{
                  marginTop: 8, backgroundColor: '#f59e0b', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>👑 Nâng cấp VIP</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      <View style={styles.controls}>
        <Button title="Chia sẻ phòng" onPress={copyLink} color="#6d28d9" />
        {isHost && (
          <>
            <View style={{ width: 10 }} />
            <Button
              title={isPublishing ? 'Tắt Live' : 'Phát Live'}
              onPress={toggleCamera}
              color={isPublishing ? 'red' : 'green'}
            />
            <TouchableOpacity 
              style={{ marginLeft: 10, backgroundColor: danmakuEnabled ? '#10b981' : '#374151', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 5 }}
              onPress={() => setDanmakuEnabled(!danmakuEnabled)}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{danmakuEnabled ? 'Hiện chữ' : 'Ẩn chữ'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ marginLeft: 10, backgroundColor: isTtsEnabled ? '#7c3aed' : '#374151', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 5 }}
              onPress={() => setIsTtsEnabled(!isTtsEnabled)}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{isTtsEnabled ? 'Loa: Tắt' : 'Loa: Bật'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ marginLeft: 10, backgroundColor: isGiftEnabled ? '#db2777' : '#374151', paddingHorizontal: 12, justifyContent: 'center', borderRadius: 5 }}
              onPress={() => setIsGiftEnabled(!isGiftEnabled)}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{isGiftEnabled ? '💬 Ẩn chữ' : '💬 Hiện chữ'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <View style={styles.commentSection}>
        <Text style={styles.commentTitle}>Bình luận</Text>
        <ScrollView style={styles.commentList}>
          {comments.length === 0 ? (
            <Text style={styles.commentEmpty}>Chưa có bình luận nào. Hãy tham gia thảo luận.</Text>
          ) : comments.map(c => (
            <View key={c.id} style={styles.commentItem}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{c.author}</Text>
                <Text style={styles.commentTime}>{c.time}</Text>
              </View>
              <Text style={styles.commentText}>{c.text}</Text>
            </View>
          ))}
        </ScrollView>
          <View style={styles.commentInputRow}>
            <TouchableOpacity 
              style={{ width: 40, height: 40, backgroundColor: sendAsDanmaku ? '#6d28d9' : '#1f2937', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}
              onPress={() => setSendAsDanmaku(!sendAsDanmaku)}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{sendAsDanmaku ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            
            <View style={{ position: 'relative' }}>
              <TouchableOpacity 
                style={{ width: 40, height: 40, backgroundColor: '#1f2937', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginLeft: 4 }}
                onPress={() => setShowStickerPicker(!showStickerPicker)}
              >
                <Text style={{ fontSize: 18 }}>🎁</Text>
              </TouchableOpacity>
              {showStickerPicker && (
                <View style={{ position: 'absolute', bottom: 50, left: 0, backgroundColor: '#1f2937', padding: 12, borderRadius: 15, elevation: 5, zIndex: 100, width: selectedGiftSticker ? 200 : 250 }}>
                  {!selectedGiftSticker ? (
                    <>
                      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 6, marginBottom: 8, gap: 15 }}>
                        {STICKER_CATEGORIES.map(cat => (
                          <TouchableOpacity 
                            key={cat.id} 
                            onPress={() => setActiveGiftCategory(cat.id)}
                            style={{ padding: 4, borderBottomWidth: activeGiftCategory === cat.id ? 2 : 0, borderBottomColor: '#7c3aed' }}
                          >
                            <Text style={{ fontSize: 18, opacity: activeGiftCategory === cat.id ? 1 : 0.5 }}>{cat.icon}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {(dbGifts.length > 0 ? dbGifts : STICKERS).filter(s => s.category === activeGiftCategory).map(s => (
                          <TouchableOpacity key={s.id} onPress={() => setSelectedGiftSticker(s)} style={{ backgroundColor: '#374151', padding: 5, borderRadius: 8, alignItems: 'center' }}>
                            <Image 
                              source={typeof s.url === 'string' ? { uri: s.url } : s.url} 
                              style={{ width: 40, height: 40 }} 
                            />
                            {s.price && <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: 'bold' }}>{s.price}</Text>}
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
                          <Text style={{ color: '#9ca3af' }}>✕</Text>
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
                        style={{ backgroundColor: '#7c3aed', padding: 8, borderRadius: 8, alignItems: 'center' }}
                        onPress={() => sendGift(selectedGiftSticker, giftMessage)}
                      >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Gửi ngay</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>

            <TextInput
            style={styles.commentInput}
            placeholder={sendAsDanmaku ? "Nhập chữ chạy..." : "Bình luận..."}
            placeholderTextColor="#9ca3af"
            value={newComment}
            onChangeText={setNewComment}
          />
          <TouchableOpacity style={styles.commentSendBtn} onPress={handleSendComment}>
            <Text style={styles.commentSendText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isHost && waitingParticipants.length > 0 && (
        <View style={styles.approvalList}>
          <Text style={styles.approvalTitle}>Yêu cầu tham gia:</Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {waitingParticipants.map(p => (
              <View key={p.identity} style={styles.waitingItem}>
                <Text style={styles.waitingName}>{p.identity}</Text>
                <TouchableOpacity style={styles.approveBtn} onPress={() => approveUser(p.identity)}>
                  <Text style={styles.approveText}>Duyệt</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* TTS Debug Overlay */}
      {lastTtsMessage && (
        <View style={{ 
          position: 'absolute', top: 60, left: 20, right: 20,
          backgroundColor: 'rgba(0,0,0,0.85)', padding: 10, borderRadius: 12,
          borderWidth: 1, borderColor: '#10b981', alignItems: 'center',
          zIndex: 9999
        }}>
          <Text style={{ color: '#10b981', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
            DEBUG TTS: <Text style={{ color: '#fff', fontWeight: 'normal' }}>{lastTtsMessage}</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  videoContainer: { flex: 1, backgroundColor: '#111' },
  video: { flex: 1, width: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: { padding: 20, paddingBottom: 40, backgroundColor: '#222', flexDirection: 'row', justifyContent: 'center' },
  text: { color: '#fff', marginTop: 10, fontSize: 16 },
  errorText: { color: 'red', textAlign: 'center', fontSize: 16, marginBottom: 10 },
  infoText: { color: '#374151', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  lobbyContainer: { flex: 1, backgroundColor: '#f3f4f6', padding: 20 },
  createSection: { flexDirection: 'row', width: '100%', marginBottom: 30, gap: 10 },
  inputWrapper: { flex: 1, gap: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  checkboxActive: { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  toggleText: { fontSize: 14, color: '#4b5563' },
  input: { flex: 1, height: 48, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, borderColor: '#d1d5db' },
  button: { backgroundColor: '#6d28d9', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 8, height: 48 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  headerRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  subtitle: { fontSize: 18, fontWeight: '600', color: '#374151' },
  refreshBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#e5e7eb', borderRadius: 6 },
  refreshText: { fontSize: 14, color: '#4b5563', fontWeight: '500' },
  roomList: { flex: 1, width: '100%' },
  roomItem: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  roomName: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  roomInfo: { fontSize: 14, color: '#6b7280' },
  joinBadge: { backgroundColor: '#10b981', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
  joinText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  roomActions: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#6b7280', fontSize: 16, marginTop: 40 },
  commentSection: { backgroundColor: '#111827', padding: 14, borderTopWidth: 1, borderTopColor: '#1f2937' },
  commentTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  commentList: { maxHeight: 180, marginBottom: 12 },
  commentEmpty: { color: '#94a3b8', fontSize: 14 },
  commentItem: { marginBottom: 10, padding: 10, backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#1f2937' },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { color: '#f8fafc', fontWeight: '700' },
  commentTime: { color: '#94a3b8', fontSize: 12 },
  commentText: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commentInput: { flex: 1, backgroundColor: '#1f2937', color: '#f8fafc', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  commentSendBtn: { backgroundColor: '#6d28d9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  commentSendText: { color: '#fff', fontWeight: '700' },
  approvalList: { position: 'absolute', bottom: 100, left: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 12, width: 250, zIndex: 10 },
  approvalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  waitingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  waitingName: { color: '#e5e7eb', flex: 1, fontSize: 14 },
  approveBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  approveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  // VIP styles
  vipSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  vipBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vipBadge: { color: '#fff', fontSize: 13, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  vipExpiryText: { color: '#6b7280', fontSize: 11 },
  vipActions: { flexDirection: 'row', gap: 8 },
  regulationsBtn: { backgroundColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  regulationsBtnText: { color: '#374151', fontSize: 12, fontWeight: '600' },
  upgradeBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  upgradeBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
