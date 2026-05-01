import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AnnouncementBanner from './components/AnnouncementBanner';
import NavBar from './components/NavBar';

const OA_TYPES = [
  { id: 'enterprise', label: 'Doanh nghiệp', icon: 'business-outline' as const },
  { id: 'personal', label: 'Cá nhân kinh doanh', icon: 'person-outline' as const },
  { id: 'gov', label: 'Cơ quan hành chính', icon: 'library-outline' as const },
];

const CATEGORIES = [
  'Bán lẻ & Thương mại',
  'Tài chính & Ngân hàng',
  'Y tế & Sức khỏe',
  'Giáo dục & Đào tạo',
  'Công nghệ & Phần mềm',
  'Ăn uống & Nhà hàng',
  'Du lịch & Khách sạn',
  'Khác',
];

export default function DangKyOAScreen() {
  const router = useRouter();
  const [oaType, setOaType] = useState('enterprise');
  const [oaName, setOaName] = useState('');
  const [category, setCategory] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const isValid = oaName.trim() && category && phone.trim() && email.trim() && agreed;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AnnouncementBanner />
      <NavBar />

      {/* Hero */}
      <View className="bg-purple-50 py-6 px-6">
        <TouchableOpacity
          className="flex-row items-center gap-2 mb-3"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color="#7C3AED" />
          <Text className="text-purple-700 text-sm font-medium">Quay lại</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-black text-gray-900">Tạo Zala Official Account</Text>
        <Text className="text-sm text-gray-600 mt-1 leading-5">
          Điền thông tin để tạo và xác thực tài khoản OA của bạn
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5 py-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step indicator */}
        <View className="flex-row items-center mb-8">
          {['Xác thực', 'Thông tin OA', 'Xác nhận'].map((step, i) => (
            <React.Fragment key={step}>
              <View className="items-center">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    i <= 1 ? 'bg-purple-700' : 'bg-gray-200'
                  }`}
                >
                  {i < 1 ? (
                    <Ionicons name="checkmark" size={14} color="white" />
                  ) : (
                    <Text className={`text-xs font-bold ${i <= 1 ? 'text-white' : 'text-gray-500'}`}>
                      {i + 1}
                    </Text>
                  )}
                </View>
                <Text className={`text-[10px] mt-1 ${i <= 1 ? 'text-purple-700 font-semibold' : 'text-gray-400'}`}>
                  {step}
                </Text>
              </View>
              {i < 2 && (
                <View className={`flex-1 h-0.5 mx-2 mb-4 ${i < 1 ? 'bg-purple-700' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Loại OA */}
        <Text className="text-sm font-bold text-gray-800 mb-3">
          Loại tài khoản OA <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row gap-2 mb-6">
          {OA_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              onPress={() => setOaType(type.id)}
              className={`flex-1 border-2 rounded-xl py-3 px-2 items-center gap-1 ${
                oaType === type.id
                  ? 'border-purple-700 bg-purple-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <Ionicons
                name={type.icon}
                size={20}
                color={oaType === type.id ? '#7C3AED' : '#9ca3af'}
              />
              <Text
                className={`text-[10px] font-semibold text-center leading-4 ${
                  oaType === type.id ? 'text-purple-700' : 'text-gray-500'
                }`}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tên OA */}
        <View className="mb-5">
          <Text className="text-sm font-bold text-gray-800 mb-2">
            Tên Official Account <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
            placeholder="Nhập tên OA (VD: Cửa hàng ABC)"
            placeholderTextColor="#9ca3af"
            value={oaName}
            onChangeText={setOaName}
            maxLength={60}
          />
          <Text className="text-[10px] text-gray-400 mt-1 text-right">{oaName.length}/60</Text>
        </View>

        {/* Lĩnh vực */}
        <View className="mb-5">
          <Text className="text-sm font-bold text-gray-800 mb-2">
            Lĩnh vực hoạt động <Text className="text-red-500">*</Text>
          </Text>
          <TouchableOpacity
            className="border border-gray-300 rounded-xl px-4 py-3 flex-row items-center justify-between bg-white"
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text className={`text-sm ${category ? 'text-gray-800' : 'text-gray-400'}`}>
              {category || 'Chọn lĩnh vực hoạt động'}
            </Text>
            <Ionicons
              name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#9ca3af"
            />
          </TouchableOpacity>
          {showCategoryPicker && (
            <View className="border border-gray-200 rounded-xl mt-1 bg-white shadow-sm overflow-hidden">
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  className={`px-4 py-3 border-b border-gray-50 flex-row items-center justify-between ${
                    category === cat ? 'bg-purple-50' : ''
                  }`}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text className={`text-sm ${category === cat ? 'text-purple-700 font-semibold' : 'text-gray-700'}`}>
                    {cat}
                  </Text>
                  {category === cat && <Ionicons name="checkmark" size={16} color="#7C3AED" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Số điện thoại */}
        <View className="mb-5">
          <Text className="text-sm font-bold text-gray-800 mb-2">
            Số điện thoại liên hệ <Text className="text-red-500">*</Text>
          </Text>
          <View className="flex-row items-center border border-gray-300 rounded-xl overflow-hidden bg-white">
            <View className="px-3 py-3 bg-gray-50 border-r border-gray-300">
              <Text className="text-sm text-gray-600 font-semibold">+84</Text>
            </View>
            <TextInput
              className="flex-1 px-4 py-3 text-sm text-gray-800"
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
        </View>

        {/* Email */}
        <View className="mb-5">
          <Text className="text-sm font-bold text-gray-800 mb-2">
            Email <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
            placeholder="Nhập địa chỉ email"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Website */}
        <View className="mb-6">
          <Text className="text-sm font-bold text-gray-800 mb-2">
            Website <Text className="text-gray-400 font-normal">(Không bắt buộc)</Text>
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 bg-white"
            placeholder="https://example.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            value={website}
            onChangeText={setWebsite}
          />
        </View>

        {/* Checkbox điều khoản */}
        <TouchableOpacity
          className="flex-row items-start gap-3 mb-8"
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View
            className={`w-5 h-5 rounded border-2 items-center justify-center mt-0.5 ${
              agreed ? 'bg-purple-700 border-purple-700' : 'border-gray-400 bg-white'
            }`}
          >
            {agreed && <Ionicons name="checkmark" size={12} color="white" />}
          </View>
          <Text className="flex-1 text-xs text-gray-600 leading-5">
            Tôi đồng ý với{' '}
            <Text className="text-purple-700 font-semibold">Điều khoản dịch vụ</Text>
            {' '}và{' '}
            <Text className="text-purple-700 font-semibold">Chính sách bảo mật</Text>
            {' '}của Zala Official Account.
          </Text>
        </TouchableOpacity>

        {/* Submit button */}
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center mb-10 ${
            isValid ? 'bg-purple-700 shadow-lg' : 'bg-gray-300'
          }`}
          disabled={!isValid}
          activeOpacity={0.85}
        >
          <Text className={`font-bold text-base ${isValid ? 'text-white' : 'text-gray-500'}`}>
            Tạo Official Account
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
