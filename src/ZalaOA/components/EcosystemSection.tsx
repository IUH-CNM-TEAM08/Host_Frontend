import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

const { width } = Dimensions.get('window');

const PRODUCTS = [
  { brand: 'Zala', sub: 'Business\nSolutions', color: '#7C3AED', bgColor: '#F3E8FF' },
  { brand: 'Zala', sub: 'MiniApp', color: '#7C3AED', bgColor: '#EDE9FE' },
  { brand: 'Zala', sub: 'Ads', color: '#7C3AED', bgColor: '#F3E8FF' },
];

export default function EcosystemSection() {
  const router = useRouter();
  const pathname = usePathname();
  const handleTaoOA = () => {
    const isAuthContext = pathname.startsWith('/(auth)') || !pathname.startsWith('/(main)');
    router.push((isAuthContext ? '/(auth)/xacthuc' : '/(main)/xacthuc') as any);
  };
  return (
    <View className="bg-white py-10 px-6 border-t border-gray-100">
      <Text className="text-xl font-black text-center text-gray-900 uppercase leading-tight mb-8">
        NỀN TẢNG ĐỂ KẾT NỐI CÁC SẢN PHẨM{'\n'}TRONG hệ sinh thái Zala
      </Text>

      {/* Product cards */}
      <View className="flex-row gap-3 mb-8">
        {PRODUCTS.map((p) => (
          <TouchableOpacity
            key={p.sub}
            className="flex-1 rounded-2xl border border-gray-200 items-center justify-center py-6 px-2 shadow-sm"
            style={{ backgroundColor: p.bgColor }}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center gap-1">
              <Text className="text-2xl font-black" style={{ color: p.color }}>Zala</Text>
              <Text className="text-[10px] font-bold leading-tight" style={{ color: p.color }}>{p.sub}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* CTA Banner */}
      <View className="rounded-2xl overflow-hidden flex-row items-center px-5 py-6 gap-4" style={{ backgroundColor: '#F3E8FF' }}>
        <View className="flex-1">
          <Text className="text-base font-black text-gray-900 leading-6 mb-4">
            Tạo Zala Official Account và kết nối với người dùng Zala ngay!
          </Text>
          <TouchableOpacity
            className="bg-purple-700 rounded-lg px-4 py-2.5 self-start"
            onPress={handleTaoOA}
          >
            <Text className="text-white text-sm font-bold">Tạo Official Account ngay</Text>
          </TouchableOpacity>
        </View>

        {/* Right illustration */}
        <View style={{ width: width * 0.35 }}>
          <View className="relative">
            <View className="absolute w-8 h-8 rounded-full bg-orange-300 border-2 border-white items-center justify-center" style={{ top: -8, left: 10 }}>
              <Text className="text-white text-[10px] font-bold">A</Text>
            </View>
            <View className="absolute w-7 h-7 rounded-full bg-green-400 border-2 border-white items-center justify-center" style={{ top: 4, right: 0 }}>
              <Text className="text-white text-[8px] font-bold">B</Text>
            </View>
            <View className="absolute w-6 h-6 rounded-full bg-pink-400 border-2 border-white items-center justify-center" style={{ bottom: 0, left: 0 }}>
              <Text className="text-white text-[7px] font-bold">C</Text>
            </View>

            {/* Main OA card */}
            <View className="bg-purple-700 rounded-xl p-3 mx-4 mt-4">
              <View className="flex-row items-center gap-1 mb-2">
                <View className="w-4 h-4 bg-white rounded-sm items-center justify-center">
                  <Text className="text-purple-700 text-[6px] font-black">Z</Text>
                </View>
                <View>
                  <Text className="text-white text-[7px] font-bold leading-tight">Zala</Text>
                  <Text className="text-white text-[5px] leading-tight">Official Account</Text>
                </View>
              </View>
              <Text className="text-white text-[7px]">6.486 người quan tâm</Text>
            </View>

            <View className="bg-white rounded-lg p-2 mx-2 shadow-md mt-1">
              <View className="flex-row items-center gap-1">
                <View className="w-5 h-5 rounded-full bg-gray-200 items-center justify-center">
                  <Text className="text-gray-600 text-[7px] font-bold">N</Text>
                </View>
                <View>
                  <Text className="text-[8px] font-bold text-gray-800">Nguyễn Văn Duy</Text>
                  <Text className="text-[7px] text-gray-500">Admin</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

    </View>
  );
}
