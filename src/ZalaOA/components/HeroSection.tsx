import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HeroSection() {
  const router = useRouter();
  const pathname = usePathname();

  const handleTaoOA = () => {
    const isAuthContext = pathname.startsWith('/(auth)') || !pathname.startsWith('/(main)');
    const route = isAuthContext ? '/(auth)/xacthuc' : '/(main)/xacthuc';
    router.push(route as any);
  };

  return (
    <LinearGradient colors={['#F3E8FF', '#EDE9FE', '#FAF5FF']} className="w-full pb-10">
      <View className="items-center px-6 pt-10 pb-6">
        <Text className="text-2xl font-black text-center text-gray-900 leading-tight">
          KẾT NỐI VÀ TƯƠNG TÁC VỚI{' '}
          <Text className="text-purple-700">NGƯỜI DÙNG ZALA</Text>
        </Text>
        <Text className="text-sm text-gray-600 text-center mt-3 leading-6">
          Zala Official Account là tài khoản chính thức của doanh nghiệp trên nền tảng Zala.{'\n'}
          Cung cấp giải pháp giúp doanh nghiệp kết nối và tương tác với người dùng Zala.
        </Text>
        <TouchableOpacity className="bg-purple-700 rounded-lg px-8 py-3 mt-6 shadow-lg" onPress={handleTaoOA}>
          <Text className="text-white font-bold text-base">Tạo Official Account</Text>
        </TouchableOpacity>
      </View>

      <View className="items-center px-4 mt-2">
        <View className="relative w-full" style={{ height: 280 }}>
          {/* Left phone card */}
          <View className="absolute bg-white rounded-2xl shadow-xl overflow-hidden" style={{ left: 0, top: 20, width: width * 0.38, height: 240 }}>
            <View className="bg-purple-700 px-3 py-2 flex-row items-center gap-2">
              <View className="w-5 h-5 bg-white rounded-full items-center justify-center">
                <Text className="text-purple-700 text-[8px] font-black">Z</Text>
              </View>
              <Text className="text-white text-[10px] font-bold">Zala OA</Text>
            </View>
            <View className="p-2 gap-2">
              <View className="bg-purple-700 rounded-xl rounded-tl-none px-2 py-1 self-start max-w-[90%]">
                <Text className="text-white text-[9px]">Chào mừng bạn đến với Zala OA. Bạn cần hỗ trợ gì không?</Text>
              </View>
              <View className="bg-gray-100 rounded-xl rounded-tr-none px-2 py-1 self-end max-w-[90%]">
                <Text className="text-gray-800 text-[9px]">Tôi muốn biết thêm thông tin</Text>
              </View>
              <View className="bg-purple-700 rounded-xl rounded-tl-none px-2 py-1 self-start max-w-[90%]">
                <Text className="text-white text-[9px]">Chúng tôi sẽ hỗ trợ bạn ngay!</Text>
              </View>
              <View className="bg-gray-200 rounded-lg w-16 h-10 self-start items-center justify-center">
                <Ionicons name="image" size={14} color="#999" />
              </View>
            </View>
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex-row items-center px-2 py-1 gap-2">
              <Ionicons name="add-circle-outline" size={16} color="#7C3AED" />
              <View className="flex-1 bg-gray-100 rounded-full h-5" />
              <Ionicons name="send" size={14} color="#7C3AED" />
            </View>
          </View>

          {/* Floating buttons */}
          <View className="absolute bg-white rounded-full shadow-lg w-10 h-10 items-center justify-center" style={{ left: width * 0.36, top: 60 }}>
            <Ionicons name="call" size={18} color="#7C3AED" />
          </View>
          <View className="absolute bg-white rounded-full shadow-lg w-10 h-10 items-center justify-center" style={{ left: width * 0.36, top: 115 }}>
            <Ionicons name="chatbubble" size={18} color="#7C3AED" />
          </View>
          <View className="absolute bg-white rounded-full shadow-lg w-10 h-10 items-center justify-center" style={{ left: width * 0.36, top: 170 }}>
            <Ionicons name="image" size={18} color="#7C3AED" />
          </View>

          {/* Right dashboard card */}
          <View className="absolute bg-white rounded-2xl shadow-xl overflow-hidden" style={{ right: 0, top: 0, width: width * 0.5, height: 260 }}>
            <View className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex-row items-center justify-between">
              <Text className="text-[9px] font-bold text-gray-700">Zala OA Manager</Text>
              <View className="flex-row gap-1">
                <View className="w-2 h-2 rounded-full bg-red-400" />
                <View className="w-2 h-2 rounded-full bg-yellow-400" />
                <View className="w-2 h-2 rounded-full bg-green-400" />
              </View>
            </View>
            <View className="flex-row px-2 py-2 gap-1">
              {[{ label: 'Theo dõi', value: '4,937' }, { label: 'Tin nhắn', value: '12,381' }, { label: 'Đã gửi', value: '36,012' }].map((stat) => (
                <View key={stat.label} className="flex-1 bg-purple-50 rounded-lg p-1 items-center">
                  <Text className="text-purple-700 text-[10px] font-black">{stat.value}</Text>
                  <Text className="text-gray-500 text-[7px]">{stat.label}</Text>
                </View>
              ))}
            </View>
            {['Nhung Liz', 'Nguyên Duy', 'Nhóm VIP', 'Khách lẻ', 'Phan Thanh'].map((name) => (
              <View key={name} className="flex-row items-center px-2 py-1 border-b border-gray-50">
                <View className="w-6 h-6 rounded-full bg-purple-100 mr-2 items-center justify-center">
                  <Text className="text-purple-700 text-[8px] font-bold">{name[0]}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[9px] font-semibold text-gray-800">{name}</Text>
                  <Text className="text-[8px] text-gray-400">Đang hoạt động</Text>
                </View>
                <View className="w-2 h-2 rounded-full bg-red-500" />
              </View>
            ))}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}
