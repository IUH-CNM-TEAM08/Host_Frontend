import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';

type NavItem = {
  label: string;
  authRoute?: string;
  mainRoute?: string;
  hasDropdown?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Trang chủ', authRoute: '/(auth)/zalaoa', mainRoute: '/(main)/zalaoa' },
  { label: 'Tính năng', authRoute: '/(auth)/tinhnang', mainRoute: '/(main)/tinhnang', hasDropdown: true },
  { label: 'Chính sách', authRoute: '/(auth)/chinhsach', mainRoute: '/(main)/chinhsach' },
  { label: 'Bảng giá', authRoute: '/(auth)/banggia', mainRoute: '/(main)/banggia' },
  { label: 'Tài nguyên', authRoute: '/(auth)/tainguyen', mainRoute: '/(main)/tainguyen', hasDropdown: true },
  { label: 'Hỗ trợ', authRoute: '/(auth)/hotro', mainRoute: '/(main)/hotro' },
];

export default function NavBar() {
  const [activeNav, setActiveNav] = useState('Trang chủ');
  const router = useRouter();
  const pathname = usePathname();

  // Xác định đang ở auth hay main context
  const isAuthContext = pathname.startsWith('/(auth)') || pathname.includes('/auth/') ||
    ['/(auth)/zalaoa','/(auth)/chinhsach','/(auth)/banggia','/(auth)/dangkyoa',
     '/(auth)/tinhnang','/(auth)/tainguyen','/(auth)/hotro'].some(r => pathname === r.replace('/(auth)', ''));

  const getRoute = (item: NavItem) => {
    if (!item.authRoute && !item.mainRoute) return null;
    return isAuthContext ? item.authRoute : item.mainRoute;
  };

  const handlePress = (item: NavItem) => {
    setActiveNav(item.label);
    const route = getRoute(item);
    if (route) {
      router.push(route as any);
    }
  };

  return (
    <View className="bg-white border-b border-gray-100 shadow-sm">
      <View className="flex-row items-center justify-between px-4 py-3">
        {/* Logo */}
        <TouchableOpacity
          className="flex-row items-center gap-1"
          onPress={() => {
            setActiveNav('Trang chủ');
            const route = isAuthContext ? '/(auth)/zalaoa' : '/(main)/zalaoa';
            router.push(route as any);
          }}
        >
          <View className="bg-purple-700 rounded-md px-2 py-1">
            <Text className="text-white font-black text-lg">Zala</Text>
          </View>
          <View className="ml-1">
            <Text className="text-purple-700 text-[9px] font-bold leading-tight">Official</Text>
            <Text className="text-purple-700 text-[9px] font-bold leading-tight">Account</Text>
          </View>
        </TouchableOpacity>

        {/* Nav items */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1 mx-2">
          <View className="flex-row items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => handlePress(item)}
                className="flex-row items-center px-2 py-1"
              >
                <Text
                  className={`text-xs font-medium ${
                    activeNav === item.label ? 'text-purple-700' : 'text-gray-700'
                  }`}
                  style={activeNav === item.label
                    ? { borderBottomWidth: 2, borderBottomColor: '#7C3AED', paddingBottom: 2 }
                    : {}}
                >
                  {item.label}
                </Text>
                {item.hasDropdown && (
                  <Ionicons
                    name="chevron-down"
                    size={10}
                    color={activeNav === item.label ? '#7C3AED' : '#666'}
                    style={{ marginLeft: 2 }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* CTA Button */}
        <TouchableOpacity className="bg-purple-700 rounded-md px-3 py-2">
          <Text className="text-white text-[10px] font-bold">Danh sách OA của tôi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
