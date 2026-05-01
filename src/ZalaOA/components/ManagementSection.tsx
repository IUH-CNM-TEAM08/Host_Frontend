import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const FEATURES = [
  'Vận hành Zala OA linh hoạt với công cụ OA Manager phiên bản web và phiên bản trên Zala App.',
  'Quản lý thông tin khách hàng tại MiniCRM.',
  'Quản lý hiệu quả tương tác và vận hành với dashboard thống kê và báo cáo chi tiết.',
  'Phân quyền quản lý với nhiều vai trò khác nhau.',
];

export default function ManagementSection() {
  return (
    <View className="bg-white py-10 px-6 border-t border-gray-100">
      <View className="flex-col gap-8">
        {/* Text content */}
        <View className="flex-1">
          <Text className="text-xl font-black text-gray-900 uppercase mb-6 leading-tight">
            TÍNH NĂNG QUẢN LÝ HIỆU QUẢ
          </Text>
          <View className="gap-4">
            {FEATURES.map((feature, i) => (
              <View key={i} className="flex-row items-start gap-3">
                <View className="w-5 h-5 rounded-full bg-purple-700 items-center justify-center mt-0.5 shrink-0">
                  <Ionicons name="checkmark" size={12} color="white" />
                </View>
                <Text className="text-sm text-gray-700 leading-6 flex-1">{feature}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity className="flex-row items-center gap-1 mt-6">
            <Text className="text-purple-700 text-sm font-semibold">Xem thêm</Text>
            <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        {/* CRM Illustration */}
        <View className="items-center">
          <View
            className="rounded-2xl border border-purple-100 p-4 items-center justify-center"
            style={{ width: width * 0.85, height: 220, backgroundColor: '#F5F3FF' }}
          >
            <View className="w-full h-full bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header bar */}
              <View className="bg-purple-700 px-3 py-2 flex-row items-center gap-2">
                <View className="flex-row gap-1">
                  <View className="w-2 h-2 rounded-full bg-red-400" />
                  <View className="w-2 h-2 rounded-full bg-yellow-400" />
                  <View className="w-2 h-2 rounded-full bg-green-400" />
                </View>
                <Text className="text-white text-[10px] font-bold ml-1">OA Manager - CRM Dashboard</Text>
              </View>

              {/* Stats row */}
              <View className="flex-row px-3 py-2 gap-2 bg-gray-50 border-b border-gray-100">
                {[
                  { label: 'Khách hàng', value: '12,847', color: '#7C3AED' },
                  { label: 'Tương tác', value: '4,293', color: '#10b981' },
                  { label: 'Doanh thu', value: '98.5M', color: '#f59e0b' },
                ].map((s) => (
                  <View key={s.label} className="flex-1 items-center">
                    <Text className="text-[11px] font-black" style={{ color: s.color }}>{s.value}</Text>
                    <Text className="text-[8px] text-gray-500">{s.label}</Text>
                  </View>
                ))}
              </View>

              {/* Chart area */}
              <View className="flex-row px-3 py-2 gap-2 flex-1">
                <View className="flex-1 justify-end flex-row items-end gap-1">
                  {[40,65,45,80,55,90,70,60,85,50,75,95].map((h, i) => (
                    <View key={i} className="flex-1 rounded-t-sm" style={{
                      height: h * 0.8,
                      backgroundColor: i % 3 === 0 ? '#7C3AED' : i % 3 === 1 ? '#A78BFA' : '#DDD6FE',
                    }} />
                  ))}
                </View>
              </View>

              {/* User list */}
              <View className="border-t border-gray-100 px-3 py-1">
                {['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C'].map((name) => (
                  <View key={name} className="flex-row items-center py-1 gap-2">
                    <View className="w-4 h-4 rounded-full bg-purple-100 items-center justify-center">
                      <Text className="text-purple-700 text-[7px] font-bold">{name[0]}</Text>
                    </View>
                    <Text className="text-[9px] text-gray-700 flex-1">{name}</Text>
                    <View className="bg-green-100 rounded px-1">
                      <Text className="text-green-600 text-[7px]">Active</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className="mt-3 flex-row items-center gap-2">
            <Text className="text-4xl font-black text-purple-200 opacity-60">CRM</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
