import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@/src/contexts/user/UserContext";
import { useTranslation } from "@/src/contexts/i18n/I18nContext";

type DiscoveryItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
};

const items: DiscoveryItem[] = [
  {
    id: "news",
    title: "Trang tin tổng hợp",
    icon: "newspaper-outline",
    iconColor: "#d45757",
  },
  {
    id: "games",
    title: "Game Center",
    subtitle: "Tam Quốc Đông Khởi, Tiên Nghịch",
    icon: "game-controller-outline",
    iconColor: "#4aa8ff",
  },
  {
    id: "life-services",
    title: "Dịch vụ đời sống",
    subtitle: "Nạp điện thoại, Trả hóa đơn, ...",
    icon: "calendar-clear-outline",
    iconColor: "#e2a539",
  },
  {
    id: "finance",
    title: "Tiện ích tài chính",
    subtitle: "Vay nhanh, Thẻ hoàn tiền, VN-Index, ...",
    icon: "apps-outline",
    iconColor: "#f07c59",
  },
  {
    id: "jobs",
    title: "Tìm việc",
    subtitle: "Tuyển dụng và tìm việc làm gần bạn",
    icon: "briefcase-outline",
    iconColor: "#568de8",
  },
  {
    id: "assistant",
    title: "Trợ lý Công Dân Số",
    subtitle: "AI hỏi đáp thủ tục hành chính công",
    icon: "sparkles-outline",
    iconColor: "#4e99f3",
  },
  {
    id: "mini-app",
    title: "Mini App",
    icon: "cube-outline",
    iconColor: "#43a5ff",
  },
];

function DiscoveryRow({ item }: { item: DiscoveryItem }) {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useTranslation();
  
  const handlePress = () => {
    if (item.id === "jobs") {
      Alert.alert(
        t('discovery.permissionTitle'),
        t('discovery.permissionMessage'),
        [
          {
            text: t('common.no'),
            style: "cancel",
            onPress: () => router.push("/(main)/findwork")
          },
          {
            text: t('common.yes'),
            onPress: () => router.push(`/(main)/findwork?grant=1&name=${encodeURIComponent(user?.fullName || '')}&phone=${encodeURIComponent(user?.phoneNumber || '')}`)
          }
        ]
      );
    }
  };

  return (
    <Pressable onPress={handlePress} className="bg-white flex-row items-center px-4 py-3 active:bg-gray-100">
      <View className="w-7 items-center justify-center mr-3">
        <Ionicons name={item.icon} size={18} color={item.iconColor} />
      </View>

      <View className="flex-1">
        <Text className="text-[21px] leading-6 text-[#1f1f1f] font-normal">{item.title}</Text>
        {item.subtitle ? (
          <Text className="text-[16px] leading-5 text-[#8a8a8a] mt-0.5">{item.subtitle}</Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#b8b8b8" />
    </Pressable>
  );
}

export default function DiscoveryScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-[#e9e9e9]">

      <ScrollView bounces={false} className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        <Pressable className="bg-white mt-2 px-4 py-3.5 flex-row items-center border-y border-[#e7e7e7] active:bg-gray-100">
          <View className="w-7 items-center justify-center mr-3">
            <Ionicons name="videocam" size={18} color="#ef5252" />
          </View>

          <View className="flex-1">
            <Text className="text-[20px] leading-6 text-[#1f1f1f] font-normal">Zalo Video</Text>
            <Text className="text-[15px] leading-5 text-[#8a8a8a] mt-0.5">
              {t('discovery.videoHighlight')}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#b8b8b8" />
        </Pressable>

        <View className="h-3 bg-[#e9e9e9]" />

        <View className="bg-white border-y border-[#e7e7e7]">
          {items.map((item, idx) => (
            <View key={item.id}>
              <DiscoveryRow item={item} />
              {idx < items.length - 1 ? <View className="h-px bg-[#ebebeb] ml-14" /> : null}
            </View>
          ))}
        </View>

        <View className="h-16" />
      </ScrollView>

      <View className="h-10 bg-[#e9e9e9]" />
    </View>
  );
}
