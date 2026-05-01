import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, Dimensions, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface XacThucZaloModalProps {
  visible: boolean;
  onClose: () => void;
  onDangKy?: () => void;
}

export default function XacThucZaloModal({ visible, onClose, onDangKy }: XacThucZaloModalProps) {
  const router = useRouter();
  const QR_VALUE = 'https://oa.zalo.me/home';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 items-center justify-center px-4" onPress={onClose}>
        <Pressable
          className="bg-white rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: Math.min(width * 0.9, 400) }}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
            <Text className="text-base font-bold text-gray-900">Xác thực Zalo cá nhân</Text>
            <TouchableOpacity onPress={onClose} className="w-7 h-7 items-center justify-center rounded-full bg-gray-100">
              <Ionicons name="close" size={16} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Warning */}
            <View className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-lg flex-row items-start gap-3 px-3 py-3">
              <View className="w-5 h-5 bg-red-500 rounded-full items-center justify-center mt-0.5 shrink-0">
                <Ionicons name="alert" size={11} color="white" />
              </View>
              <Text className="flex-1 text-xs text-red-700 leading-5">
                Bạn cần thực hiện xác thực Zalo cá nhân để có thể tạo và quản lý Zala Official Account
              </Text>
            </View>

            {/* QR Code */}
            <View className="items-center mt-6 mb-4">
              <View className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                <QRCode
                  value={QR_VALUE}
                  size={180}
                  backgroundColor="white"
                  color="#111827"
                  logo={require('../../../resources/assets/zala.png')}
                  logoSize={36}
                  logoBackgroundColor="white"
                  logoBorderRadius={18}
                  logoMargin={4}
                  quietZone={8}
                />
              </View>
            </View>

            <Text className="text-xs text-gray-600 text-center px-8 leading-5 mb-5">
              Quét mã QR bằng ứng dụng Zala trên điện thoại để thực hiện xác thực
            </Text>

            <View className="flex-row items-center mx-6 mb-4 gap-3">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-xs text-gray-400">Hoặc</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            <View className="mx-5 mb-4">
              <Text className="text-xs text-gray-600 text-center leading-6">
                Mở ứng dụng Zala cá nhân, vào mục:{'\n'}
                <Text className="font-semibold text-gray-800">
                  Cài đặt {'>'} Tài khoản và Bảo mật {'>'} Xác thực tài khoản
                </Text>
              </Text>
            </View>

            <View className="mx-5 mb-5">
              <Text className="text-xs text-gray-600 text-center leading-5">
                Sau khi xác thực thành công,{' '}
                <Text className="text-purple-700 font-semibold underline" onPress={onClose}>
                  nhấn vào đây
                </Text>
                {' '}để đăng nhập lại.
              </Text>
            </View>

            {/* Đăng ký button */}
            <TouchableOpacity
              className="mx-5 bg-purple-700 rounded-xl py-3.5 items-center shadow-sm"
              activeOpacity={0.85}
              onPress={() => {
                onClose();
                if (onDangKy) {
                  onDangKy();
                } else {
                  router.push('/(auth)/dangkyoa' as any);
                }
              }}
            >
              <Text className="text-white font-bold text-sm">Đăng ký</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
