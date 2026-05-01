import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NavBar from './components/NavBar';
import AnnouncementBanner from './components/AnnouncementBanner';

const FAQ = [
  { q: 'Zala OA là gì?', a: 'Zala Official Account (OA) là tài khoản chính thức của doanh nghiệp trên nền tảng Zala, giúp kết nối và tương tác với người dùng một cách chuyên nghiệp.' },
  { q: 'Làm thế nào để tạo Zala OA?', a: 'Bạn chỉ cần đăng ký tài khoản, xác thực thông tin doanh nghiệp và điền form đăng ký OA. Quy trình hoàn tất trong vòng 24-48 giờ làm việc.' },
  { q: 'Zala OA có mất phí không?', a: 'Zala OA có gói miễn phí và các gói trả phí với tính năng nâng cao. Bạn có thể dùng thử miễn phí 30 ngày trước khi quyết định nâng cấp.' },
  { q: 'Tôi có thể nhắn tin với bao nhiêu người?', a: 'Gói miễn phí hỗ trợ đến 100 tin nhắn/tháng. Các gói trả phí cho phép gửi không giới hạn theo từng gói dịch vụ bạn chọn.' },
  { q: 'Có hỗ trợ tích hợp API không?', a: 'Có, Zala OA cung cấp bộ API đầy đủ để tích hợp với hệ thống CRM, website và ứng dụng của doanh nghiệp.' },
];

const CONTACT_CHANNELS = [
  { icon: 'mail-outline' as const, label: 'Email hỗ trợ', value: 'support@zala.me', action: 'email' },
  { icon: 'chatbubble-outline' as const, label: 'Chat trực tuyến', value: 'Trả lời trong 5 phút', action: 'chat' },
  { icon: 'call-outline' as const, label: 'Hotline', value: '1900 xxxx', action: 'call' },
  { icon: 'logo-facebook' as const, label: 'Facebook', value: 'Zala Official Account', action: 'facebook' },
];

export default function HoTroScreen() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  return (
    <SafeAreaView className="flex-1 bg-white">
      <AnnouncementBanner />
      <NavBar />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View className="bg-purple-50 px-6 py-8">
          <Text className="text-2xl font-black text-gray-900 leading-tight mb-2">
            Trung tâm <Text className="text-purple-700">Hỗ trợ</Text>
          </Text>
          <Text className="text-sm text-gray-600 leading-6">
            Chúng tôi luôn sẵn sàng hỗ trợ bạn. Tìm câu trả lời hoặc liên hệ trực tiếp với đội ngũ của chúng tôi.
          </Text>
        </View>

        {/* Contact channels */}
        <View className="px-5 pt-6 pb-2">
          <Text className="text-base font-black text-gray-900 mb-4">Kênh liên hệ</Text>
          <View className="flex-row flex-wrap gap-3">
            {CONTACT_CHANNELS.map((ch) => (
              <TouchableOpacity
                key={ch.label}
                activeOpacity={0.8}
                className="bg-white border border-gray-100 rounded-2xl p-4 items-center"
                style={{ width: '47%', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}
              >
                <View className="w-11 h-11 bg-purple-100 rounded-xl items-center justify-center mb-2">
                  <Ionicons name={ch.icon} size={22} color="#7C3AED" />
                </View>
                <Text className="text-xs font-bold text-gray-700 text-center">{ch.label}</Text>
                <Text className="text-[10px] text-purple-700 font-semibold text-center mt-0.5">{ch.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQ */}
        <View className="px-5 py-6">
          <Text className="text-base font-black text-gray-900 mb-4">Câu hỏi thường gặp</Text>
          <View className="gap-3">
            {FAQ.map((faq, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                activeOpacity={0.8}
                className={`border rounded-2xl overflow-hidden ${openFaq === i ? 'border-purple-700' : 'border-gray-100'}`}
              >
                <View className={`flex-row items-center justify-between px-4 py-4 ${openFaq === i ? 'bg-purple-50' : 'bg-white'}`}>
                  <Text className={`flex-1 text-sm font-semibold pr-2 ${openFaq === i ? 'text-purple-700' : 'text-gray-800'}`}>
                    {faq.q}
                  </Text>
                  <Ionicons
                    name={openFaq === i ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={openFaq === i ? '#7C3AED' : '#9CA3AF'}
                  />
                </View>
                {openFaq === i && (
                  <View className="px-4 pb-4 bg-purple-50">
                    <Text className="text-xs text-gray-600 leading-5">{faq.a}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact form */}
        <View className="px-5 pb-10">
          <Text className="text-base font-black text-gray-900 mb-4">Gửi yêu cầu hỗ trợ</Text>
          <View className="bg-white border border-gray-100 rounded-2xl p-5 gap-4"
            style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <View>
              <Text className="text-xs font-semibold text-gray-600 mb-1.5">Họ và tên</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
                placeholder="Nhập họ và tên"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View>
              <Text className="text-xs font-semibold text-gray-600 mb-1.5">Email</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
                placeholder="Nhập địa chỉ email"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View>
              <Text className="text-xs font-semibold text-gray-600 mb-1.5">Nội dung</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800"
                placeholder="Mô tả vấn đề bạn gặp phải..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
                style={{ height: 100 }}
              />
            </View>
            <TouchableOpacity
              className={`rounded-xl py-3.5 items-center ${name && email && message ? 'bg-purple-700' : 'bg-gray-200'}`}
              disabled={!name || !email || !message}
              onPress={() => Alert.alert('Gửi thành công', 'Chúng tôi sẽ phản hồi trong vòng 24 giờ!')}
            >
              <Text className={`font-bold text-sm ${name && email && message ? 'text-white' : 'text-gray-400'}`}>
                Gửi yêu cầu
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
