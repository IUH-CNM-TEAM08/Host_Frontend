import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NavBar from './components/NavBar';
import AnnouncementBanner from './components/AnnouncementBanner';

const RESOURCES = [
  {
    category: 'Tài liệu kỹ thuật',
    icon: 'document-text-outline' as const,
    items: [
      { title: 'Hướng dẫn tích hợp API', desc: 'Tài liệu API đầy đủ cho nhà phát triển', tag: 'API Docs' },
      { title: 'SDK & Thư viện', desc: 'Bộ SDK hỗ trợ nhiều ngôn ngữ lập trình', tag: 'SDK' },
      { title: 'Webhook & Callback', desc: 'Hướng dẫn cài đặt webhook nhận sự kiện', tag: 'Dev' },
    ],
  },
  {
    category: 'Hướng dẫn sử dụng',
    icon: 'book-outline' as const,
    items: [
      { title: 'Bắt đầu với Zala OA', desc: 'Hướng dẫn từng bước tạo và thiết lập OA', tag: 'Beginner' },
      { title: 'Quản lý nội dung', desc: 'Cách đăng bài, lên lịch và quản lý nội dung', tag: 'Content' },
      { title: 'Tối ưu chiến dịch', desc: 'Chiến lược tăng follower và tương tác hiệu quả', tag: 'Marketing' },
    ],
  },
  {
    category: 'Video hướng dẫn',
    icon: 'play-circle-outline' as const,
    items: [
      { title: 'Series nhập môn Zala OA', desc: '10 video hướng dẫn cơ bản từ A-Z', tag: 'Video' },
      { title: 'Chatbot nâng cao', desc: 'Xây dựng chatbot thông minh cho OA', tag: 'Video' },
      { title: 'Case study thực tế', desc: 'Bài học từ các OA thành công trên Zala', tag: 'Case Study' },
    ],
  },
];

const TAG_COLORS: Record<string, string> = {
  'API Docs': 'bg-blue-100 text-blue-700',
  'SDK': 'bg-indigo-100 text-indigo-700',
  'Dev': 'bg-gray-100 text-gray-700',
  'Beginner': 'bg-green-100 text-green-700',
  'Content': 'bg-orange-100 text-orange-700',
  'Marketing': 'bg-pink-100 text-pink-700',
  'Video': 'bg-red-100 text-red-700',
  'Case Study': 'bg-yellow-100 text-yellow-700',
};

export default function TaiNguyenScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <AnnouncementBanner />
      <NavBar />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="bg-purple-50 px-6 py-8">
          <Text className="text-2xl font-black text-gray-900 leading-tight mb-2">
            Tài nguyên <Text className="text-purple-700">dành cho bạn</Text>
          </Text>
          <Text className="text-sm text-gray-600 leading-6">
            Tài liệu, hướng dẫn và công cụ giúp bạn khai thác tối đa tiềm năng của Zala Official Account.
          </Text>
        </View>

        {/* Resource sections */}
        <View className="px-5 py-6 gap-8">
          {RESOURCES.map((section) => (
            <View key={section.category}>
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
                  <Ionicons name={section.icon} size={18} color="#7C3AED" />
                </View>
                <Text className="text-base font-black text-gray-900">{section.category}</Text>
              </View>

              <View className="gap-3">
                {section.items.map((item) => (
                  <TouchableOpacity
                    key={item.title}
                    activeOpacity={0.8}
                    className="flex-row items-center bg-white border border-gray-100 rounded-2xl px-4 py-4 gap-3"
                    style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 }}
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-sm font-bold text-gray-800">{item.title}</Text>
                        <View className={`rounded-full px-2 py-0.5 ${TAG_COLORS[item.tag] || 'bg-gray-100 text-gray-600'}`}>
                          <Text className={`text-[9px] font-bold ${TAG_COLORS[item.tag]?.split(' ')[1] || 'text-gray-600'}`}>
                            {item.tag}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs text-gray-500 leading-4">{item.desc}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Community CTA */}
        <View className="mx-5 mb-10 bg-purple-700 rounded-2xl px-6 py-6">
          <View className="flex-row items-center gap-3 mb-3">
            <View className="w-10 h-10 bg-white/20 rounded-xl items-center justify-center">
              <Ionicons name="people" size={22} color="white" />
            </View>
            <Text className="text-white font-black text-base">Cộng đồng Zala OA</Text>
          </View>
          <Text className="text-purple-200 text-xs leading-5 mb-4">
            Tham gia cộng đồng hơn 10,000+ doanh nghiệp đang sử dụng Zala OA. Chia sẻ kinh nghiệm và học hỏi từ những người đi trước.
          </Text>
          <TouchableOpacity className="bg-white rounded-xl px-5 py-3 self-start">
            <Text className="text-purple-700 font-bold text-sm">Tham gia ngay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
