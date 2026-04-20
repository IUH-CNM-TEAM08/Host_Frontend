import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import SocketService from '@/src/api/socketCompat';
import { userService } from '@/src/api/services/user.service';
import { friendshipService } from '@/src/api/services/friendship.service';

interface FriendNotif {
  id: string;
  type: 'request' | 'accepted';
  userId: string;
  name: string;
  avatar: string;
  requestId?: string;
}

export default function FriendNotificationToast() {
  const [queue, setQueue] = useState<FriendNotif[]>([]);
  const [current, setCurrent] = useState<FriendNotif | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const router = useRouter();

  // Show next from queue
  useEffect(() => {
    if (!current && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      setCurrent(next);
    }
  }, [queue, current]);

  // Animate in/out
  useEffect(() => {
    if (!current) return;
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 11 }).start();
    const t = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(t);
  }, [current]);

  const dismiss = () => {
    Animated.timing(slideAnim, { toValue: -120, duration: 250, useNativeDriver: true }).start(() => {
      setCurrent(null);
      slideAnim.setValue(-120);
    });
  };

  const pushNotif = (notif: FriendNotif) => {
    setQueue(prev => [...prev, notif]);
  };

  // Socket listeners
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const socket = SocketService.getInstance();

    // Incoming friend request
    const handleRequest = async (raw: any) => {
      const senderId = raw?.senderId || raw?.requesterId || raw?._doc?.senderId;
      const requestId = raw?.id || raw?._id || raw?._doc?.id;
      if (!senderId) return;
      try {
        const res = await userService.getUserById(senderId);
        if (res.success && res.user) {
          pushNotif({
            id: `req-${Date.now()}`,
            type: 'request',
            userId: senderId,
            name: res.user.name,
            avatar: res.user.avatarURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(res.user.name)}&background=0068FF&color=fff`,
            requestId,
          });
        }
      } catch { /* silent */ }
    };

    // Friend request accepted
    const handleAccepted = async (raw: any) => {
      // Could be senderId = requester who just got accepted
      const acceptorId = raw?.receiverId || raw?.acceptorId || raw?.userId;
      if (!acceptorId) return;
      try {
        const res = await userService.getUserById(acceptorId);
        if (res.success && res.user) {
          pushNotif({
            id: `acc-${Date.now()}`,
            type: 'accepted',
            userId: acceptorId,
            name: res.user.name,
            avatar: res.user.avatarURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(res.user.name)}&background=10B981&color=fff`,
          });
        }
      } catch { /* silent */ }
    };

    socket.onFriendRequest(handleRequest);
    socket.onFriendRequestAccepted(handleAccepted);
    return () => {
      socket.removeFriendRequestListener(handleRequest);
      socket.removeFriendRequestAcceptedListener(handleAccepted);
    };
  }, []);

  const handleAccept = async () => {
    if (!current?.requestId) return;
    try {
      await friendshipService.acceptFriendRequest(current.requestId);
    } catch { /* silent */ }
    dismiss();
  };

  const goContacts = () => {
    router.replace('/(main)/contacts');
    dismiss();
  };

  if (!current) return null;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 16,
        right: 20,
        zIndex: 99999,
        transform: [{ translateY: slideAnim }],
        width: 320,
      }}
    >
      <View style={{
        backgroundColor: 'white',
        borderRadius: 18,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: current.type === 'accepted' ? '#D1FAE5' : '#EEF2FF',
      }}>
        {/* Accent top bar */}
        <View style={{ height: 3, backgroundColor: current.type === 'accepted' ? '#10B981' : '#6366F1' }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
          {/* Avatar */}
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: current.avatar }}
              style={{ width: 46, height: 46, borderRadius: 23 }}
            />
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 18, height: 18, borderRadius: 9,
              backgroundColor: current.type === 'accepted' ? '#10B981' : '#6366F1',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: 'white',
            }}>
              <Ionicons
                name={current.type === 'accepted' ? 'checkmark' : 'person-add'}
                size={9} color="white"
              />
            </View>
          </View>

          {/* Text */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>
              {current.name}
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
              {current.type === 'accepted'
                ? '✓ Đã chấp nhận lời mời kết bạn'
                : 'Gửi lời mời kết bạn cho bạn'}
            </Text>
          </View>

          {/* Close */}
          <TouchableOpacity onPress={dismiss}
            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={12} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Actions — only for incoming requests */}
        {current.type === 'request' && (
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <TouchableOpacity onPress={dismiss}
              style={{ flex: 1, paddingVertical: 11, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>Bỏ qua</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAccept}
              style={{ flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: '#EEF2FF' }}>
              <Text style={{ fontSize: 13, color: '#6366F1', fontWeight: '700' }}>Đồng ý</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goContacts}
              style={{ paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' }}>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
