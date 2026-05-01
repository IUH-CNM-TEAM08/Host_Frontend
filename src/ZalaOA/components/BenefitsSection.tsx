import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BENEFITS = [
  { icon: 'information-circle-outline' as const, title: 'An toàn thông tin theo\ntiêu chuẩn quốc tế' },
  { icon: 'shield-checkmark-outline' as const, title: 'Chứng nhận xác thực giúp\nđảm bảo uy tín doanh nghiệp' },
  { icon: 'cash-outline' as const, title: 'Chi phí hợp lý và minh bạch\ncho từng dịch vụ' },
  { icon: 'flash-outline' as const, title: 'Tối ưu trải nghiệm khách hàng với đa\ndạng tính năng tương tác' },
  { icon: 'rocket-outline' as const, title: 'Tối ưu hiệu quả vận hành với\ncông cụ quản lý mạnh mẽ' },
  { icon: 'git-network-outline' as const, title: 'Dễ dàng kết nối với hệ thống,\nnền tảng của doanh nghiệp\nhoặc bên thứ ba' },
  { icon: 'apps-outline' as const, title: 'Tiếp cận hệ sinh thái đa dạng giải\npháp của Zala' },
];

export default function BenefitsSection() {
  return (
    <View className="bg-white py-10 px-6">
      <Text className="text-xl font-black text-center text-gray-900 uppercase leading-tight mb-8">
        Zala Official Account MANG LẠI GÌ{'\n'}CHO DOANH NGHIỆP?
      </Text>
      <View className="flex-row flex-wrap justify-center gap-y-8 gap-x-4">
        {BENEFITS.map((item) => (
          <View key={item.icon} className="items-center" style={{ width: '28%' }}>
            <View className="w-16 h-16 rounded-full border-2 border-purple-700 items-center justify-center mb-3 bg-purple-50">
              <Ionicons name={item.icon} size={28} color="#7C3AED" />
            </View>
            <Text className="text-xs text-gray-600 text-center leading-5">{item.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
