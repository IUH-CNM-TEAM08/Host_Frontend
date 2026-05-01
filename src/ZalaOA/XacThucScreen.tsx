import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NavBar from './components/NavBar';
import AnnouncementBanner from './components/AnnouncementBanner';

const QR_VALUE = 'https://oa.zalo.me/home';

// QR chỉ render trên native, web dùng fallback
let QRCode: any = null;
if (Platform.OS !== 'web') {
  QRCode = require('react-native-qrcode-svg').default;
}

export default function XacThucScreen() {
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleConfirmVerified = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      setVerified(true);
    }, 1500);
  };

  const handleDangKy = () => {
    router.push('/(auth)/dangkyoa' as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <AnnouncementBanner />
      <NavBar />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="bg-purple-50 px-6 py-6 border-b border-purple-100">
          <TouchableOpacity
            className="flex-row items-center gap-2 mb-4"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color="#7C3AED" />
            <Text className="text-purple-700 text-sm font-medium">Quay lại</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-black text-gray-900">Xác thực tài khoản Zala</Text>
          <Text className="text-sm text-gray-600 mt-1 leading-5">
            Bước 1/3 — Xác thực Zala cá nhân trước khi tạo OA
          </Text>

          {/* Step bar */}
          <View className="flex-row items-center mt-4 gap-1">
            {['Xác thực', 'Thông tin OA', 'Xác nhận'].map((s, i) => (
              <View key={s} className="flex-row items-center flex-1">
                <View className={`w-6 h-6 rounded-full items-center justify-center ${i === 0 ? 'bg-purple-700' : 'bg-gray-200'}`}>
                  <Text className={`text-[10px] font-black ${i === 0 ? 'text-white' : 'text-gray-400'}`}>{i + 1}</Text>
                </View>
                {i < 2 && <View className={`flex-1 h-0.5 mx-1 ${i === 0 ? 'bg-purple-300' : 'bg-gray-200'}`} />}
              </View>
            ))}
          </View>
        </View>

        <View className="px-6 pt-6 gap-6">
          {/* Warning */}
          <View className="bg-amber-50 border border-amber-200 rounded-2xl flex-row items-start gap-3 px-4 py-4">
            <View className="w-8 h-8 bg-amber-400 rounded-full items-center justify-center shrink-0">
              <Ionicons name="alert" size={16} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-amber-800 mb-1">Yêu cầu xác thực</Text>
              <Text className="text-xs text-amber-700 leading-5">
                Bạn cần xác thực tài khoản Zala cá nhân để có thể tạo và quản lý Zala Official Account.
              </Text>
            </View>
          </View>

          {/* QR Section */}
          <View className="items-center">
            <Text className="text-base font-black text-gray-900 mb-4">
              Quét mã QR bằng ứng dụng Zala
            </Text>

            <View className="p-4 bg-white rounded-2xl shadow-lg border border-gray-100 items-center">
              {Platform.OS !== 'web' && QRCode ? (
                <QRCode
                  value={QR_VALUE}
                  size={200}
                  backgroundColor="white"
                  color="#111827"
                  logo={require('../../resources/assets/zala.png')}
                  logoSize={40}
                  logoBackgroundColor="white"
                  logoBorderRadius={20}
                  logoMargin={4}
                  quietZone={10}
                />
              ) : (
                // Web fallback: hiển thị QR mock đẹp
                <View className="items-center">
                  <View
                    className="bg-white rounded-xl border-2 border-gray-100 items-center justify-center"
                    style={{ width: 200, height: 200, padding: 12 }}
                  >
                    {/* QR pattern mock */}
                    <View className="w-full h-full">
                      {[...Array(7)].map((_, r) => (
                        <View key={r} className="flex-row flex-1">
                          {[...Array(7)].map((_, c) => {
                            const isCorner = (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2);
                            const isDot = (r === 3 && c % 2 === 0) || (c === 3 && r % 2 === 0) || Math.random() > 0.55;
                            return (
                              <View key={c} className="flex-1 m-0.5 rounded-sm"
                                style={{ backgroundColor: isCorner || isDot ? '#1a1a2e' : '#f3f4f6' }} />
                            );
                          })}
                        </View>
                      ))}
                    </View>
                    {/* Center logo */}
                    <View className="absolute w-12 h-12 bg-purple-700 rounded-xl items-center justify-center border-2 border-white">
                      <Text className="text-white font-black text-lg">Z</Text>
                    </View>
                  </View>
                  <Text className="text-[10px] text-gray-400 mt-2 text-center">
                    Mở app Zala → quét mã này
                  </Text>
                </View>
              )}
            </View>

            <Text className="text-xs text-gray-500 text-center mt-3 leading-5 px-4">
              Mở ứng dụng Zala trên điện thoại và quét mã QR này để xác thực
            </Text>
          </View>

          {/* Divider */}
          <View className="flex-row items-center gap-3">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-xs text-gray-400 font-medium">Hoặc xác thực thủ công</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Manual steps */}
          <View className="bg-gray-50 rounded-2xl px-5 py-5 gap-3">
            {[
              { step: 1, text: 'Mở ứng dụng Zala trên điện thoại' },
              { step: 2, text: 'Vào Cài đặt → Tài khoản và Bảo mật' },
              { step: 3, text: 'Chọn "Xác thực tài khoản" và làm theo hướng dẫn' },
            ].map((item) => (
              <View key={item.step} className="flex-row items-start gap-3">
                <View className="w-6 h-6 rounded-full bg-purple-700 items-center justify-center shrink-0 mt-0.5">
                  <Text className="text-white text-[10px] font-black">{item.step}</Text>
                </View>
                <Text className="flex-1 text-sm text-gray-700 leading-5">{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Confirm verified */}
          {!verified ? (
            <View className="gap-3">
              <TouchableOpacity
                className="bg-purple-700 rounded-2xl py-4 items-center flex-row justify-center gap-2"
                activeOpacity={0.85}
                onPress={handleConfirmVerified}
                disabled={checking}
              >
                {checking ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                )}
                <Text className="text-white font-bold text-base">
                  {checking ? 'Đang kiểm tra...' : 'Tôi đã xác thực xong'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="border-2 border-purple-700 rounded-2xl py-4 items-center"
                activeOpacity={0.85}
                onPress={handleDangKy}
              >
                <Text className="text-purple-700 font-bold text-base">Bỏ qua, đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-3">
              <View className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex-row items-center gap-3">
                <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center">
                  <Ionicons name="checkmark" size={22} color="white" />
                </View>
                <View className="flex-1">
                  <Text className="text-green-800 font-bold text-sm">Xác thực thành công!</Text>
                  <Text className="text-green-600 text-xs">Bạn có thể tạo Zala OA ngay bây giờ</Text>
                </View>
              </View>
              <TouchableOpacity
                className="bg-purple-700 rounded-2xl py-4 items-center"
                activeOpacity={0.85}
                onPress={handleDangKy}
              >
                <Text className="text-white font-bold text-base">Tiếp tục tạo Official Account →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
