import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@/src/contexts/user/UserContext';

/** 404-style block page shown to non-admin users */
function AccessDeniedPage() {
  const router = useRouter();
  const { user } = useUser();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      {/* Big faded 404 */}
      <Text
        style={{
          fontSize: Platform.OS === 'web' ? 160 : 100,
          fontWeight: '900',
          color: '#7C3AED',
          letterSpacing: -6,
          lineHeight: Platform.OS === 'web' ? 160 : 100,
          marginBottom: 0,
          opacity: 0.08,
          position: 'absolute',
          top: Platform.OS === 'web' ? '18%' : '12%',
          userSelect: 'none',
        } as any}
      >
        404
      </Text>

      {/* Shield icon */}
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: '#ede9fe',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <Ionicons name="lock-closed-outline" size={44} color="#7C3AED" />
      </View>

      {/* Headline */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: '800',
          color: '#1f2937',
          textAlign: 'center',
          marginBottom: 10,
          letterSpacing: -0.5,
        }}
      >
        Truy cập bị từ chối
      </Text>

      {/* Sub */}
      <Text
        style={{
          fontSize: 15,
          color: '#6b7280',
          textAlign: 'center',
          lineHeight: 23,
          maxWidth: 300,
          marginBottom: 12,
        }}
      >
        Bạn không có quyền truy cập trang{' '}
        <Text style={{ fontWeight: '700', color: '#7C3AED' }}>/admin</Text>.
        {'\n'}Trang này chỉ dành cho quản trị viên.
      </Text>

      {/* Error badge */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#fef2f2',
          borderRadius: 20,
          paddingHorizontal: 14,
          paddingVertical: 6,
          marginBottom: 36,
          borderWidth: 1,
          borderColor: '#fecaca',
        }}
      >
        <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
        <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>
          Lỗi 403 — Forbidden
        </Text>
      </View>

      {/* Go Home Button */}
      <TouchableOpacity
        onPress={() => {
          if (user) router.replace('/(main)');
          else router.replace('/(auth)');
        }}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#7C3AED',
          paddingHorizontal: 28,
          paddingVertical: 14,
          borderRadius: 14,
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 6,
          marginBottom: 14,
        }}
      >
        <Ionicons name="home-outline" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
          Về trang chủ
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 }}
      >
        <Ionicons name="arrow-back-outline" size={16} color="#9ca3af" />
        <Text style={{ color: '#9ca3af', fontSize: 14, fontWeight: '500' }}>
          Quay lại trang trước
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminLayout() {
  const { user, isLoading } = useUser();

  // Still loading user session — show spinner
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f3ff' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  // Not authenticated or not ADMIN → show 403/404 page
  if (!user || user.role !== 'ADMIN') {
    return <AccessDeniedPage />;
  }

  // ADMIN — render admin stack normally
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
