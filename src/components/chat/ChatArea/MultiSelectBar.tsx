// @ts-nocheck
/**
 * MultiSelectBar — Thanh action bar khi chọn nhiều tin nhắn.
 * Tách từ ChatArea.tsx, giữ nguyên logic + UI.
 */
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

type MultiSelectBarProps = {
  selectedCount: number;
  canDeleteForMe: boolean;
  canForward: boolean;
  canRecall: boolean;
  bottomSafeOffset: number;
  onDeleteForMe: () => void;
  onForward: () => void;
  onRecall: () => void;
  onCancel: () => void;
};

export default function MultiSelectBar({
  selectedCount,
  canDeleteForMe,
  canForward,
  canRecall,
  bottomSafeOffset,
  onDeleteForMe,
  onForward,
  onRecall,
  onCancel,
}: MultiSelectBarProps) {
  return (
    <View
      className="border-t border-gray-200 p-3 bg-white"
      style={{ paddingBottom: bottomSafeOffset }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-700 font-medium">
          Đã chọn {selectedCount} tin nhắn
        </Text>
        <TouchableOpacity onPress={onCancel}>
          <Text className="text-blue-600 font-medium">Hủy</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          className={`px-3 py-2 rounded-lg ${canDeleteForMe ? "bg-gray-100" : "bg-gray-50"}`}
          disabled={!canDeleteForMe}
          onPress={onDeleteForMe}
        >
          <Text className={`${canDeleteForMe ? "text-gray-800" : "text-gray-400"}`}>
            Xóa phía tôi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="px-3 py-2 rounded-lg bg-blue-50"
          disabled={!canForward}
          onPress={onForward}
        >
          <Text className={`${canForward ? "text-blue-700" : "text-blue-300"}`}>
            Chuyển tiếp
          </Text>
        </TouchableOpacity>
        {canRecall && (
          <TouchableOpacity
            className="px-3 py-2 rounded-lg bg-red-50"
            onPress={onRecall}
          >
            <Text className="text-red-600">Thu hồi</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
