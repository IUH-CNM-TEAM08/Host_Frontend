// @ts-nocheck
/**
 * MessageOptionsSheet — Context menu khi long-press tin nhắn.
 * Tách từ ChatArea.tsx, giữ nguyên logic + UI.
 */
import React from "react";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message, MessageType } from "@/src/models/Message";

type MessageOptionsSheetProps = {
  visible: boolean;
  message: Message | null;
  currentUserId: string;
  senderAvatar: string;
  senderLabel: string;
  isSelectedMessagePinned: boolean;
  canPin: boolean;
  canEdit: boolean;
  hasAppointment: boolean;
  hasRecalledContent: boolean;
  recalledContent: string | null;
  onClose: () => void;
  onReply: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onEdit: (msg: Message) => void;
  onMultiSelect: (msg: Message) => void;
  onPin: (msg: Message) => void;
  onUnpin: (msg: Message) => void;
  onDeleteForMe: (msg: Message) => void;
  onRecall: (msg: Message) => void;
  onPrefillRecalled: (msg: Message) => void;
  onEditAppointment: (msg: Message) => void;
  onCancelAppointment: (msg: Message) => void;
};

export default function MessageOptionsSheet({
  visible,
  message,
  currentUserId,
  senderAvatar,
  senderLabel,
  isSelectedMessagePinned,
  canPin,
  canEdit,
  hasAppointment,
  hasRecalledContent,
  recalledContent,
  onClose,
  onReply,
  onForward,
  onEdit,
  onMultiSelect,
  onPin,
  onUnpin,
  onDeleteForMe,
  onRecall,
  onPrefillRecalled,
  onEditAppointment,
  onCancelAppointment,
}: MessageOptionsSheetProps) {
  if (!visible || !message) return null;

  const isSender = message.senderId === currentUserId;

  const getDisplayContent = () => {
    if (message.isDeletedForEveryone) {
      return recalledContent || "Tin nhắn đã được thu hồi";
    }
    if (message.type === MessageType.VOTE) {
      try {
        const data = JSON.parse(message.content);
        return `[Bình chọn] ${data.question}`;
      } catch {
        return message.content;
      }
    }
    return message.content;
  };

  return (
    <View className="absolute inset-0 bg-black/30 items-center justify-center">
      <View className="bg-white rounded-2xl w-[90%] max-w-md overflow-hidden shadow-lg">
        {/* Header */}
        <View className="p-4 border-b border-gray-100">
          <View className="flex-row items-center">
            <Image
              source={{ uri: senderAvatar }}
              className="w-10 h-10 rounded-full"
              resizeMode="cover"
            />
            <View className="ml-3 flex-1">
              <Text className="text-gray-800 font-medium">{senderLabel}</Text>
              <Text className="text-gray-500 text-sm">
                {new Date(message.sentAt).toLocaleString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </Text>
            </View>
          </View>
          <View className="mt-3 bg-gray-50 rounded-lg p-3">
            <Text className="text-gray-800">{getDisplayContent()}</Text>
          </View>
        </View>

        {/* Actions */}
        <View className="divide-y divide-gray-100">
          {/* Reply */}
          <TouchableOpacity
            className="flex-row items-center p-4 active:bg-gray-50"
            onPress={() => onReply(message)}
          >
            <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
              <Ionicons name="return-up-back" size={20} color="#3B82F6" />
            </View>
            <Text className="ml-3 text-gray-800">Trả lời</Text>
          </TouchableOpacity>

          {/* Prefill recalled */}
          {message.isDeletedForEveryone && hasRecalledContent && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => onPrefillRecalled(message)}
            >
              <View className="w-8 h-8 rounded-full bg-violet-50 items-center justify-center">
                <Ionicons name="copy-outline" size={20} color="#7c3aed" />
              </View>
              <Text className="ml-3 text-gray-800">
                Sao chép lên ô nhập để gửi lại
              </Text>
            </TouchableOpacity>
          )}

          {/* Edit */}
          {canEdit && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => onEdit(message)}
            >
              <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                <Ionicons name="create-outline" size={20} color="#D97706" />
              </View>
              <Text className="ml-3 text-gray-800">Chỉnh sửa</Text>
            </TouchableOpacity>
          )}

          {/* Edit appointment */}
          {isSender && hasAppointment && !message.isDeletedForEveryone && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => onEditAppointment(message)}
            >
              <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                <Ionicons name="calendar-outline" size={20} color="#2563eb" />
              </View>
              <Text className="ml-3 text-gray-800">Đổi lịch hẹn</Text>
            </TouchableOpacity>
          )}

          {/* Cancel appointment */}
          {isSender && hasAppointment && !message.isDeletedForEveryone && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => {
                Alert.alert("Hủy lịch hẹn", "Bạn chắc chắn muốn hủy lịch hẹn này?", [
                  { text: "Không", style: "cancel" },
                  { text: "Hủy lịch", style: "destructive", onPress: () => onCancelAppointment(message) },
                ]);
              }}
            >
              <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                <Ionicons name="close-circle-outline" size={20} color="#dc2626" />
              </View>
              <Text className="ml-3 text-red-500">Hủy lịch hẹn</Text>
            </TouchableOpacity>
          )}

          {/* Forward */}
          <TouchableOpacity
            className="flex-row items-center p-4 active:bg-gray-50"
            onPress={() => onForward(message)}
          >
            <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
              <Ionicons name="arrow-redo" size={20} color="#3B82F6" />
            </View>
            <Text className="ml-3 text-gray-800">Chuyển tiếp</Text>
          </TouchableOpacity>

          {/* Multi-select */}
          <TouchableOpacity
            className="flex-row items-center p-4 active:bg-gray-50"
            onPress={() => onMultiSelect(message)}
          >
            <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
              <Ionicons name="checkmark-done-outline" size={20} color="#4F46E5" />
            </View>
            <Text className="ml-3 text-gray-800">Chọn nhiều</Text>
          </TouchableOpacity>

          {/* Pin */}
          {!message.isDeletedForEveryone && !isSelectedMessagePinned && canPin && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => onPin(message)}
            >
              <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                <Image
                  source={{ uri: "https://res-zalo.zadn.vn/upload/media/2023/8/23/ic_pin_1692773653119_121326.png" }}
                  style={{ width: 18, height: 18 }}
                  resizeMode="contain"
                />
              </View>
              <Text className="ml-3 text-gray-800">Ghim tin nhắn</Text>
            </TouchableOpacity>
          )}

          {/* Unpin */}
          {!message.isDeletedForEveryone && isSelectedMessagePinned && canPin && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => onUnpin(message)}
            >
              <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                <Image
                  source={{ uri: "https://res-zalo.zadn.vn/upload/media/2023/8/23/ic_pin_1692773653119_121326.png" }}
                  style={{ width: 18, height: 18, opacity: 0.6 }}
                  resizeMode="contain"
                />
              </View>
              <Text className="ml-3 text-gray-800">Bỏ ghim</Text>
            </TouchableOpacity>
          )}

          {/* Delete for me */}
          {!message.isDeletedForEveryone && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => onDeleteForMe(message)}
            >
              <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                <Ionicons name="eye-off-outline" size={20} color="#6b7280" />
              </View>
              <Text className="ml-3 text-gray-800">Xóa phía tôi</Text>
            </TouchableOpacity>
          )}

          {/* Recall */}
          {isSender && !message.isDeletedForEveryone && (
            <TouchableOpacity
              className="flex-row items-center p-4 active:bg-gray-50"
              onPress={() => onRecall(message)}
            >
              <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                <Ionicons name="trash" size={20} color="#EF4444" />
              </View>
              <Text className="ml-3 text-red-500">Thu hồi (xóa cho mọi người)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Close button */}
        <TouchableOpacity
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
          onPress={onClose}
        >
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
