import React, { useState } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const STEPS = [
  { num: 1, title: 'Tạo và xác thực Zala OA', desc: 'Tạo Zala OA từ tài khoản Zala và tiến hành xác thực.' },
  { num: 2, title: 'Thiết lập Zala OA', desc: 'Thiết lập các tính năng cơ bản trên Zala OA.' },
  { num: 3, title: 'Thu hút tương tác', desc: 'Quảng bá Zala OA và thu hút người dùng tương tác.', active: true },
  { num: 4, title: 'Vận hành & tối ưu', desc: 'Theo dõi báo cáo vận hành, tối ưu hiệu quả.' },
  { num: 5, title: 'Đăng ký gói dịch vụ trải nghiệm tính năng nâng cao', desc: 'Lựa chọn gói dịch vụ phù hợp để tiếp cận các tính năng nâng cao và sử dụng.' },
];

const MOCK_USERS = ['Nguyễn Ngọc Trung', 'Trần Quang Chiến', 'Cao Hồng Nam', 'Lê Thanh Hoàn Mai', 'Trần Trọng Kha', 'Nguyễn Ánh Khang'];
const MOCK_USERS_RIGHT = ['Trần Trọng Nghĩa', 'Lê Thanh Nhã', 'Trần Thanh Tâm', 'Nguyễn Ngọc Dương', 'Lê Ánh Ngọc'];

export default function StepsSection() {
  const [activeStep, setActiveStep] = useState(3);

  return (
    <LinearGradient colors={['#2E1065', '#5B21B6', '#4C1D95']} className="py-10 px-6">
      {/* Decorative dots */}
      <View className="absolute inset-0 opacity-10">
        {[...Array(8)].map((_, i) => (
          <View key={i} className="absolute w-2 h-2 rounded-full bg-white"
            style={{ left: (i * 47) % (width - 20), top: (i * 73) % 400 }} />
        ))}
      </View>

      <Text className="text-xl font-black text-white text-center uppercase mb-8 leading-tight">
        05 BƯỚC TRONG HÀNH TRÌNH VỚI Zala OA
      </Text>

      <View className="flex-col gap-6">
        {/* Steps list */}
        <View className="gap-0">
          {STEPS.map((step, idx) => (
            <View key={step.num} className="flex-row items-start gap-3">
              <View className="items-center" style={{ width: 40 }}>
                <View className={`w-9 h-9 rounded-full items-center justify-center border-2 ${
                  step.active ? 'bg-white border-white' : activeStep === step.num ? 'bg-purple-600 border-purple-400' : 'bg-transparent border-purple-400'
                }`}>
                  <Text className={`text-sm font-black ${step.active ? 'text-purple-700' : 'text-white'}`}>
                    {step.num}
                  </Text>
                </View>
                {idx < STEPS.length - 1 && <View className="w-0.5 bg-purple-400 opacity-50" style={{ height: 36 }} />}
              </View>
              <View className="flex-1 pb-6">
                <Text className="text-white font-bold text-sm mb-1">{step.title}</Text>
                <Text className="text-purple-200 text-xs leading-5">{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Mock dialog */}
        <View className="items-center">
          <View className="bg-white rounded-2xl overflow-hidden shadow-2xl" style={{ width: width * 0.85 }}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <Text className="text-sm font-bold text-gray-800">Mời quan tâm OA</Text>
              <Ionicons name="close" size={16} color="#666" />
            </View>
            <View className="flex-row p-3 gap-3">
              {/* Left */}
              <View className="flex-1">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-[10px] text-gray-500 font-semibold">Danh sách bạn bè nhớ (0)</Text>
                  <Text className="text-[10px] text-purple-700">Chọn tất cả</Text>
                </View>
                <View className="bg-gray-100 rounded-lg px-2 py-1 flex-row items-center mb-2">
                  <Ionicons name="search" size={10} color="#999" />
                  <Text className="text-[9px] text-gray-400 ml-1">Tìm kiếm người dùng</Text>
                </View>
                {MOCK_USERS.map((name) => (
                  <View key={name} className="flex-row items-center py-1.5 gap-2">
                    <View className="w-5 h-5 rounded-full bg-purple-100 items-center justify-center">
                      <Text className="text-purple-700 text-[7px] font-bold">{name[0]}</Text>
                    </View>
                    <Text className="text-[9px] text-gray-700 flex-1" numberOfLines={1}>{name}</Text>
                  </View>
                ))}
              </View>
              <View className="w-px bg-gray-200" />
              {/* Right */}
              <View className="flex-1">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-[10px] text-gray-500 font-semibold">Danh sách đã chọn 5/100 ⓘ</Text>
                </View>
                <View className="bg-gray-100 rounded-lg px-2 py-1 flex-row items-center mb-2">
                  <Ionicons name="search" size={10} color="#999" />
                  <Text className="text-[9px] text-gray-400 ml-1">Tìm kiếm người dùng</Text>
                </View>
                {MOCK_USERS_RIGHT.map((name) => (
                  <View key={name} className="flex-row items-center py-1.5 gap-2">
                    <View className="w-5 h-5 rounded-full bg-purple-100 items-center justify-center">
                      <Text className="text-purple-700 text-[7px] font-bold">{name[0]}</Text>
                    </View>
                    <Text className="text-[9px] text-gray-700 flex-1" numberOfLines={1}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View className="flex-row justify-end gap-2 px-4 py-3 border-t border-gray-100">
              <View className="border border-gray-300 rounded-lg px-4 py-1.5">
                <Text className="text-[11px] text-gray-600 font-semibold">Hủy</Text>
              </View>
              <View className="bg-purple-700 rounded-lg px-4 py-1.5">
                <Text className="text-[11px] text-white font-semibold">Gửi</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}
