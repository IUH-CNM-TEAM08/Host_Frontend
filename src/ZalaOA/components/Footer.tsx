import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Footer() {
  return (
    <View className="bg-purple-700 pt-8 pb-4">
      <View className="px-6 flex-row flex-wrap gap-y-6 gap-x-4 mb-6">
        {/* Logo column */}
        <View style={{ minWidth: 140 }}>
          <View className="flex-row items-center gap-1 mb-3">
            <View className="bg-white rounded-md px-2 py-1">
              <Text className="text-purple-700 font-black text-base">Zala</Text>
            </View>
            <View className="ml-1">
              <Text className="text-white text-[9px] font-bold leading-tight">Official</Text>
              <Text className="text-white text-[9px] font-bold leading-tight">Account</Text>
            </View>
          </View>
        </View>

        {/* Developer links */}
        <View style={{ minWidth: 180 }}>
          <Text className="text-white font-bold text-xs mb-3">Nhà phát triển</Text>
          <TouchableOpacity className="mb-2">
            <Text className="text-purple-200 text-xs">OA dành cho Cơ quan Hành chính công</Text>
          </TouchableOpacity>
        </View>

        {/* Contact info */}
        <View style={{ flex: 1, minWidth: 200 }}>
          <Text className="text-white font-bold text-xs mb-3">Thông tin liên hệ:</Text>
          <Text className="text-purple-200 text-xs mb-1 font-semibold">Công Ty Cổ Phần Tập Đoàn VNG</Text>
          <Text className="text-purple-200 text-xs mb-1 leading-5">
            Địa chỉ: Z06, Đường số 13, Phường Tân Thuận,{'\n'}Thành phố Hồ Chí Minh
          </Text>
          <Text className="text-purple-200 text-xs mb-1">Email: oa@zalo.me</Text>
          <Text className="text-purple-200 text-xs leading-5">
            GPDKKD: 0303490096 do sở KH & ĐT TP.HCM{'\n'}cấp ngày 09/09/2004.
          </Text>
        </View>

        {/* QR code */}
        <View style={{ minWidth: 120 }} className="items-center">
          <Text className="text-white font-bold text-xs mb-3">Quét QR để được tư vấn</Text>
          <View className="w-20 h-20 bg-white rounded-lg p-1.5 items-center justify-center">
            <View className="w-full h-full">
              {[0,1,2,3,4].map(row => (
                <View key={row} className="flex-row gap-px mb-px">
                  {[0,1,2,3,4].map(col => (
                    <View key={col} className="flex-1 aspect-square rounded-sm"
                      style={{ backgroundColor:
                        (row === 0 && col <= 1) || (row === 0 && col >= 3) ||
                        (row === 4 && col <= 1) || (row <= 1 && col === 0) ||
                        (row >= 3 && col === 0) || (row <= 1 && col === 4) ||
                        (row === 2 && col === 2) || Math.random() > 0.6
                          ? '#111827' : '#f3f4f6'
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View className="border-t border-purple-500 mx-6 mb-3" />
      <View className="items-center px-6">
        <Text className="text-purple-200 text-[11px] text-center">©2024 Zala Official Account</Text>
      </View>
    </View>
  );
}
