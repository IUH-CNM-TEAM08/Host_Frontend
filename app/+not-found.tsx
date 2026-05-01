import { useRouter } from 'expo-router';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/src/contexts/user/UserContext';

export default function NotFoundPage() {
  const router = useRouter();
  const { user } = useUser();

  const handleGoHome = () => {
    if (user?.role === 'ADMIN') {
      router.replace('/admin');
    } else if (user) {
      router.replace('/(main)');
    } else {
      router.replace('/(auth)');
    }
  };

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
      {/* Animated glowing orb background */}
      {Platform.OS === 'web' && (
        <View
          style={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: 250,
            backgroundColor: 'rgba(139,92,246,0.08)',
            top: '50%',
            left: '50%',
            transform: [{ translateX: -250 }, { translateY: -250 }],
          }}
        />
      )}

      {/* Icon */}
      <View
        style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: '#ede9fe',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <Ionicons name="shield-half-outline" size={48} color="#7C3AED" />
      </View>

      {/* Error code */}
      <Text
        style={{
          fontSize: Platform.OS === 'web' ? 96 : 72,
          fontWeight: '900',
          color: '#7C3AED',
          letterSpacing: -4,
          lineHeight: Platform.OS === 'web' ? 96 : 72,
          marginBottom: 8,
          opacity: 0.15,
          position: 'absolute',
          top: Platform.OS === 'web' ? '20%' : '15%',
        }}
      >
        404
      </Text>

      {/* Title */}
      <Text
        style={{
          fontSize: 26,
          fontWeight: '800',
          color: '#1f2937',
          textAlign: 'center',
          marginBottom: 12,
          letterSpacing: -0.5,
        }}
      >
        Trang không tồn tại
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          fontSize: 15,
          color: '#6b7280',
          textAlign: 'center',
          lineHeight: 22,
          maxWidth: 320,
          marginBottom: 36,
        }}
      >
        Bạn không có quyền truy cập trang này, hoặc trang này không tồn tại.
      </Text>

      {/* Divider */}
      <View
        style={{
          width: 48,
          height: 3,
          borderRadius: 2,
          backgroundColor: '#7C3AED',
          marginBottom: 36,
          opacity: 0.4,
        }}
      />

      {/* Go Home Button */}
      <TouchableOpacity
        onPress={handleGoHome}
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
          marginBottom: 16,
        }}
      >
        <Ionicons name="home-outline" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
          Về trang chủ
        </Text>
      </TouchableOpacity>

      {/* Go Back */}
      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 10,
        }}
      >
        <Ionicons name="arrow-back-outline" size={16} color="#9ca3af" />
        <Text style={{ color: '#9ca3af', fontSize: 14, fontWeight: '500' }}>
          Quay lại trang trước
        </Text>
      </TouchableOpacity>
    </View>
  );
}
