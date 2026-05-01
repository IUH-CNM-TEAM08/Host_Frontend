import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NavBar from './components/NavBar';
import AnnouncementBanner from './components/AnnouncementBanner';

const FEATURES = [
  {
    icon: 'chatbubbles-outline' as const,
    title: 'Nhắn tin & Chatbot',
    desc: 'Nhắn tin hai chiều, chatbot tự động 24/7, menu tương tác thông minh giúp phục vụ khách hàng hiệu quả.',
  },
  {
    icon: 'call-outline' as const,
    title: 'Gọi thoại',
    desc: 'Liên hệ trực tiếp với khách hàng qua gọi thoại trên nền tảng Zala, tạo trải nghiệm hỗ trợ chuyên nghiệp.',
  },
  {
    icon: 'newspaper-outline' as const,
    title: 'Đăng bài & Nội dung',
    desc: 'Tạo bài viết, hình ảnh, video phong phú để tiếp cận người theo dõi OA của bạn một cách hiệu quả.',
  },
  {
    icon: 'people-outline' as const,
    title: 'Quản lý nhóm & Khách hàng',
    desc: 'Phân loại và quản lý nhóm khách hàng, gửi tin nhắn cá nhân hóa theo từng phân khúc.',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Thống kê & Báo cáo',
    desc: 'Dashboard chi tiết theo dõi lượng theo dõi, tương tác, hiệu quả chiến dịch theo thời gian thực.',
  },
  {
    icon: 'code-slash-outline' as const,
    title: 'API & Tích hợp',
    desc: 'Kết nối Zala OA với hệ thống CRM, ERP, website của doanh nghiệp qua API mạnh mẽ và linh hoạt.',
  },
  {
    icon: 'qr-code-outline' as const,
    title: 'QR Code & Mời quan tâm',
    desc: 'Tạo QR Code để khách hàng dễ dàng theo dõi OA, tích hợp vào ấn phẩm truyền thông.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    title: 'Xác thực & Uy tín',
    desc: 'Huy hiệu xác thực chính thức giúp khách hàng tin tưởng và nhận diện thương hiệu của bạn.',
  },
];

export default function TinhNangScreen() {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <AnnouncementBanner />
      <NavBar />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="bg-purple-50 px-6 py-8">
          <Text className="text-2xl font-black text-gray-900 leading-tight mb-2">
            Tính năng <Text className="text-purple-700">Zala OA</Text>
          </Text>
          <Text className="text-sm text-gray-600 leading-6">
            Bộ công cụ toàn diện giúp doanh nghiệp kết nối, tương tác và phát triển trên nền tảng Zala.
          </Text>
        </View>

        {/* Feature cards */}
        <View className="px-5 py-6 gap-4">
          {FEATURES.map((feat, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setActiveFeature(i)}
              activeOpacity={0.85}
              className={`flex-row items-start gap-4 p-4 rounded-2xl border-2 ${
                activeFeature === i ? 'border-purple-700 bg-purple-50' : 'border-gray-100 bg-white'
              }`}
              style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}
            >
              <View className={`w-12 h-12 rounded-xl items-center justify-center shrink-0 ${
                activeFeature === i ? 'bg-purple-700' : 'bg-purple-50'
              }`}>
                <Ionicons name={feat.icon} size={24} color={activeFeature === i ? '#fff' : '#7C3AED'} />
              </View>
              <View className="flex-1">
                <Text className={`font-bold text-sm mb-1 ${activeFeature === i ? 'text-purple-700' : 'text-gray-800'}`}>
                  {feat.title}
                </Text>
                <Text className="text-xs text-gray-500 leading-5">{feat.desc}</Text>
              </View>
              {activeFeature === i && (
                <Ionicons name="checkmark-circle" size={20} color="#7C3AED" style={{ marginTop: 2 }} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <View className="mx-5 mb-10 bg-purple-700 rounded-2xl px-6 py-6 items-center">
          <Text className="text-white font-black text-lg text-center mb-2">Trải nghiệm miễn phí</Text>
          <Text className="text-purple-200 text-xs text-center mb-4 leading-5">
            Tạo Zala OA ngay hôm nay và khám phá tất cả tính năng trong 30 ngày miễn phí
          </Text>
          <TouchableOpacity className="bg-white rounded-xl px-6 py-3">
            <Text className="text-purple-700 font-bold text-sm">Tạo Zala OA miễn phí</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
