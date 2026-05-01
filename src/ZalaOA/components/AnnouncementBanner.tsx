import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function AnnouncementBanner() {
  return (
    <View className="bg-purple-700 flex-row items-center justify-center px-4 py-2 flex-wrap gap-2">
      <Text className="text-white text-xs font-medium text-center">
        📢 1/6/2026, Zala Official Account triển khai 4 gói dịch vụ mới - tối ưu hiệu suất theo nhu cầu doanh nghiệp
      </Text>
      <TouchableOpacity className="bg-white rounded px-3 py-1 ml-2">
        <Text className="text-purple-700 text-xs font-bold">Xem chi tiết</Text>
      </TouchableOpacity>
    </View>
  );
}
