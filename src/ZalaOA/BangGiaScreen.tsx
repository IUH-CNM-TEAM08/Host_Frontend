import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AnnouncementBanner from './components/AnnouncementBanner';
import NavBar from './components/NavBar';

const PLANS = [
  {
    id: 'free',
    name: 'Miễn phí',
    price: '0',
    period: 'Mãi mãi',
    color: '#6b7280',
    bgColor: '#f9fafb',
    borderColor: '#e5e7eb',
    popular: false,
    features: [
      'Tạo 1 Zala OA',
      'Nhắn tin cơ bản',
      'Quản lý người theo dõi',
      'Thống kê cơ bản',
      'Hỗ trợ cộng đồng',
    ],
    disabled: ['API nâng cao', 'Chatbot tự động', 'Báo cáo chi tiết'],
  },
  {
    id: 'basic',
    name: 'Cơ bản',
    price: '299.000',
    period: 'tháng',
    color: '#7C3AED',
    bgColor: '#F3E8FF',
    borderColor: '#7C3AED',
    popular: false,
    features: [
      'Tạo 3 Zala OA',
      'Nhắn tin không giới hạn',
      'Chatbot tự động',
      'API tích hợp cơ bản',
      'Báo cáo & thống kê',
      'Hỗ trợ qua email',
    ],
    disabled: ['Quảng cáo Zalo Ads', 'Hỗ trợ 24/7'],
  },
  {
    id: 'pro',
    name: 'Chuyên nghiệp',
    price: '699.000',
    period: 'tháng',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#7c3aed',
    popular: true,
    features: [
      'Tạo không giới hạn OA',
      'Tất cả tính năng Cơ bản',
      'Quảng cáo Zalo Ads',
      'API nâng cao & Webhook',
      'MiniCRM tích hợp',
      'Báo cáo nâng cao',
      'Hỗ trợ 24/7',
      'Quản lý nhóm GMF',
    ],
    disabled: [],
  },
  {
    id: 'enterprise',
    name: 'Doanh nghiệp',
    price: 'Liên hệ',
    period: '',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#f59e0b',
    popular: false,
    features: [
      'Tất cả tính năng Pro',
      'Tùy chỉnh theo nhu cầu',
      'Tích hợp hệ thống riêng',
      'SLA cam kết 99.9%',
      'Đội ngũ hỗ trợ riêng',
      'Đào tạo & onboarding',
    ],
    disabled: [],
  },
];

export default function BangGiaScreen() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AnnouncementBanner />
      <NavBar />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient colors={['#F3E8FF', '#FAF5FF']} className="py-10 px-6 items-center">
          <Text className="text-2xl font-black text-gray-900 uppercase text-center mb-2">
            BẢNG GIÁ DỊCH VỤ
          </Text>
          <Text className="text-sm text-gray-600 text-center leading-6">
            Chọn gói phù hợp với quy mô doanh nghiệp của bạn
          </Text>

          {/* Billing toggle */}
          <View className="flex-row bg-gray-100 rounded-full p-1 mt-6">
            <TouchableOpacity
              className={`px-5 py-2 rounded-full ${billing === 'monthly' ? 'bg-white shadow-sm' : ''}`}
              onPress={() => setBilling('monthly')}
            >
              <Text className={`text-sm font-semibold ${billing === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Hàng tháng
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-5 py-2 rounded-full flex-row items-center gap-1 ${billing === 'yearly' ? 'bg-white shadow-sm' : ''}`}
              onPress={() => setBilling('yearly')}
            >
              <Text className={`text-sm font-semibold ${billing === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Hàng năm
              </Text>
              {billing === 'yearly' && (
                <View className="bg-green-100 px-1.5 py-0.5 rounded-full">
                  <Text className="text-[9px] text-green-700 font-bold">-20%</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Plan cards */}
        <View className="px-4 py-6 gap-4">
          {PLANS.map((plan) => (
            <View
              key={plan.id}
              className="rounded-2xl border-2 overflow-hidden"
              style={{
                borderColor: plan.popular ? plan.borderColor : '#e5e7eb',
                backgroundColor: plan.popular ? plan.bgColor : '#fff',
              }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <View className="bg-[#7c3aed] py-1.5 items-center">
                  <Text className="text-white text-xs font-bold tracking-wide">
                    ⭐ PHỔ BIẾN NHẤT
                  </Text>
                </View>
              )}

              <View className="p-5">
                {/* Plan header */}
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-base font-black" style={{ color: plan.color }}>
                    {plan.name}
                  </Text>
                </View>

                {/* Price */}
                <View className="flex-row items-end gap-1 mb-4">
                  {plan.price === 'Liên hệ' ? (
                    <Text className="text-2xl font-black text-gray-900">Liên hệ</Text>
                  ) : (
                    <>
                      <Text className="text-2xl font-black text-gray-900">
                        {billing === 'yearly'
                          ? plan.price === '0'
                            ? '0'
                            : Math.round(parseInt(plan.price.replace('.', '')) * 0.8 / 1000).toString() + '.000'
                          : plan.price}
                      </Text>
                      {plan.price !== '0' && (
                        <Text className="text-gray-500 text-sm mb-1">đ/{plan.period}</Text>
                      )}
                      {plan.price === '0' && (
                        <Text className="text-gray-500 text-sm mb-1">{plan.period}</Text>
                      )}
                    </>
                  )}
                </View>

                {/* CTA */}
                <TouchableOpacity
                  className="rounded-xl py-3 items-center mb-5"
                  style={{ backgroundColor: plan.color }}
                >
                  <Text className="text-white font-bold text-sm">
                    {plan.price === 'Liên hệ' ? 'Liên hệ tư vấn' : plan.price === '0' ? 'Bắt đầu miễn phí' : 'Chọn gói này'}
                  </Text>
                </TouchableOpacity>

                {/* Features */}
                <View className="gap-2.5">
                  {plan.features.map((f) => (
                    <View key={f} className="flex-row items-center gap-2">
                      <Ionicons name="checkmark-circle" size={16} color={plan.color} />
                      <Text className="text-sm text-gray-700 flex-1">{f}</Text>
                    </View>
                  ))}
                  {plan.disabled.map((f) => (
                    <View key={f} className="flex-row items-center gap-2 opacity-40">
                      <Ionicons name="close-circle" size={16} color="#9ca3af" />
                      <Text className="text-sm text-gray-400 flex-1 line-through">{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* FAQ */}
        <View className="px-5 py-6 border-t border-gray-100">
          <Text className="text-lg font-black text-gray-900 mb-4">Câu hỏi thường gặp</Text>
          {[
            { q: 'Tôi có thể đổi gói bất cứ lúc nào không?', a: 'Có, bạn có thể nâng cấp hoặc hạ gói bất cứ lúc nào. Phí sẽ được tính theo tỷ lệ tương ứng.' },
            { q: 'Có dùng thử miễn phí không?', a: 'Gói Cơ bản và Chuyên nghiệp có 14 ngày dùng thử miễn phí, không cần thẻ tín dụng.' },
            { q: 'Phương thức thanh toán nào được chấp nhận?', a: 'Chúng tôi chấp nhận chuyển khoản ngân hàng, thẻ tín dụng/ghi nợ và ví điện tử MoMo, ZaloPay.' },
          ].map((faq, i) => (
            <View key={i} className="mb-4 border-b border-gray-100 pb-4">
              <Text className="text-sm font-bold text-gray-800 mb-2">{faq.q}</Text>
              <Text className="text-sm text-gray-600 leading-5">{faq.a}</Text>
            </View>
          ))}
        </View>

        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
