import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const TABS = [
  { id: 'message', label: 'Nhắn tin' },
  { id: 'call', label: 'Gọi thoại' },
  { id: 'menu', label: 'Menu, chatbot' },
  { id: 'content', label: 'Nội dung' },
  { id: 'group', label: 'Quản lý nhóm' },
];

const TAB_CONTENT: Record<string, { description: string; chat: { sender: 'oa' | 'user'; msg: string; imgs?: boolean }[] }> = {
  message: {
    description: 'Nhắn tin hai chiều với khách hàng từng có tương tác với Zala OA. Hình thức tin nhắn đa dạng nhằm phục vụ linh hoạt nhiều mục đích giao tiếp.',
    chat: [
      { sender: 'oa', msg: 'Chào mừng đến với Zala OA! Chúng tôi có thể giúp gì?' },
      { sender: 'user', msg: 'Tôi muốn xem sản phẩm mới nhất.' },
      { sender: 'oa', msg: 'Đây là bộ sưu tập mới của chúng tôi!', imgs: true },
    ],
  },
  call: {
    description: 'Tính năng gọi thoại cho phép doanh nghiệp liên hệ trực tiếp với khách hàng qua Zala, tạo trải nghiệm hỗ trợ nhanh chóng và chuyên nghiệp.',
    chat: [
      { sender: 'oa', msg: '📞 Cuộc gọi thoại từ Zala OA' },
      { sender: 'user', msg: 'Xin chào! Tôi cần hỗ trợ kỹ thuật.' },
      { sender: 'oa', msg: 'Chúng tôi đã ghi nhận yêu cầu của bạn.' },
    ],
  },
  menu: {
    description: 'Thiết lập menu phong phú và chatbot thông minh giúp tự động hóa tiếp nhận và xử lý yêu cầu từ khách hàng 24/7.',
    chat: [
      { sender: 'oa', msg: '🤖 Xin chào! Bạn muốn biết thông tin gì?' },
      { sender: 'user', msg: '1. Sản phẩm  2. Khuyến mãi  3. Liên hệ' },
      { sender: 'oa', msg: 'Vui lòng chọn mục bạn cần hỗ trợ.' },
    ],
  },
  content: {
    description: 'Tạo và phân phối nội dung phong phú đến người theo dõi OA: bài viết, hình ảnh, video và nhiều định dạng khác.',
    chat: [
      { sender: 'oa', msg: '📰 Tin tức mới nhất từ chúng tôi!', imgs: true },
      { sender: 'user', msg: 'Cảm ơn, rất hữu ích!' },
      { sender: 'oa', msg: 'Cảm ơn bạn đã theo dõi Zala OA của chúng tôi!' },
    ],
  },
  group: {
    description: 'Tạo và quản lý các nhóm khách hàng, phân loại theo nhu cầu để gửi thông tin phù hợp và cá nhân hóa trải nghiệm.',
    chat: [
      { sender: 'oa', msg: '👥 Nhóm VIP của bạn đã được tạo!' },
      { sender: 'user', msg: 'Làm sao để thêm thành viên?' },
      { sender: 'oa', msg: 'Bạn có thể mời qua link hoặc QR code.' },
    ],
  },
};

export default function InteractiveFeaturesSection() {
  const [activeTab, setActiveTab] = useState('message');
  const content = TAB_CONTENT[activeTab];

  return (
    <View className="bg-white py-10 border-t border-gray-100">
      <Text className="text-xl font-black text-center text-gray-900 uppercase px-6 mb-6">
        TÍNH NĂNG TƯƠNG TÁC TỐI ƯU
      </Text>

      {/* Tabs */}
      <View className="flex-row flex-wrap mx-4 mb-6 gap-1">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-full ${activeTab === tab.id ? 'bg-purple-700' : 'bg-gray-100'}`}
          >
            <Text className={`text-[11px] font-semibold ${activeTab === tab.id ? 'text-white' : 'text-gray-600'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="px-6 gap-6">
        <Text className="text-sm text-gray-700 leading-6">{content.description}</Text>
        <TouchableOpacity className="flex-row items-center gap-1">
          <Text className="text-purple-700 text-sm font-semibold">Xem thêm</Text>
          <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
        </TouchableOpacity>

        {/* QR */}
        <View className="items-center self-start gap-2">
          <View className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-300 items-center justify-center">
            <View className="w-14 h-14">
              {[0,1,2,3].map(r => (
                <View key={r} className="flex-row gap-0.5 mb-0.5">
                  {[0,1,2,3].map(c => (
                    <View key={c} className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: (r+c)%2===0 ? '#111' : '#ddd' }} />
                  ))}
                </View>
              ))}
            </View>
          </View>
          <Text className="text-[10px] text-gray-500 text-center">Quét QR để trải nghiệm{'\n'}tính năng</Text>
        </View>

        {/* Phone mockup */}
        <View className="items-center">
          <View className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden"
            style={{ width: width * 0.85, height: 300 }}>
            <View className="bg-purple-700 px-4 py-3 flex-row items-center gap-2">
              <Ionicons name="arrow-back" size={16} color="white" />
              <View className="w-7 h-7 bg-white rounded-full items-center justify-center">
                <Text className="text-purple-700 font-black text-[10px]">Z</Text>
              </View>
              <View>
                <Text className="text-white text-xs font-bold">Zala OA</Text>
                <Text className="text-purple-200 text-[9px]">Official Account</Text>
              </View>
            </View>
            <View className="flex-1 p-3 gap-2 bg-gray-50">
              {content.chat.map((msg, i) => (
                <View key={i} className={`flex-row ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'oa' && (
                    <View className="w-6 h-6 rounded-full bg-purple-700 mr-1 items-center justify-center self-end">
                      <Text className="text-white text-[8px] font-bold">Z</Text>
                    </View>
                  )}
                  <View>
                    <View className={`rounded-xl px-3 py-2 max-w-[75%] ${
                      msg.sender === 'user' ? 'bg-purple-700 rounded-tr-none' : 'bg-white rounded-tl-none shadow-sm'
                    }`}>
                      <Text className={`text-[10px] leading-4 ${msg.sender === 'user' ? 'text-white' : 'text-gray-800'}`}>
                        {msg.msg}
                      </Text>
                    </View>
                    {msg.imgs && (
                      <View className="flex-row gap-1 mt-1">
                        {[0,1,2].map(j => (
                          <View key={j} className="w-12 h-9 bg-purple-100 rounded-md border border-purple-200 items-center justify-center">
                            <Ionicons name="image" size={12} color="#7C3AED" />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
            <View className="bg-white border-t border-gray-200 flex-row items-center px-3 py-2 gap-2">
              <View className="flex-1 bg-gray-100 rounded-full h-6" />
              <Ionicons name="send" size={14} color="#7C3AED" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
