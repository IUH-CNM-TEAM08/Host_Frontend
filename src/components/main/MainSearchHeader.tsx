import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface MainSearchHeaderProps {
  placeholder?: string;
  rightIcon?: IconName;
  onPressSearch?: () => void;
  onPressRight?: () => void;
}

export default function MainSearchHeader({
  placeholder = 'Tìm kiếm...',
  rightIcon = 'scan-outline',
  onPressSearch,
  onPressRight,
}: MainSearchHeaderProps) {
  return (
    <View className="bg-white px-4 pt-4 pb-3 flex-row items-center justify-between border-b border-gray-100 z-10 shadow-sm">
      <TouchableOpacity
        onPress={onPressSearch}
        activeOpacity={0.7}
        className="flex-row items-center flex-1 bg-gray-100 rounded-full px-4 py-2 mr-3 border border-gray-200"
      >
        <Ionicons name="search-outline" size={18} color="#6b7280" />
        <Text className="text-gray-400 ml-2">{placeholder}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPressRight}
        activeOpacity={0.7}
        className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
      >
        <Ionicons name={rightIcon} size={20} color="#374151" />
      </TouchableOpacity>
    </View>
  );
}
