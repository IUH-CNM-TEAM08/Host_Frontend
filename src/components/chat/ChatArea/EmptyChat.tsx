// @ts-nocheck
/**
 * EmptyChat — Màn hình khi chưa chọn cuộc trò chuyện nào.
 * Tách từ ChatArea.tsx, giữ nguyên logic + UI.
 */
import React from "react";
import { View, Text, ActivityIndicator, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type EmptyChatProps = {
  displayName: string;
};

export default function EmptyChat({ displayName }: EmptyChatProps) {
  const { width: viewportWidth } = useWindowDimensions();

  return (
    <View
      className="flex-1 items-center justify-center px-8"
      style={{ backgroundColor: "#fafafa" }}
    >
      <View
        className="items-center justify-center rounded-full mb-6"
        style={{
          width: 112,
          height: 112,
          backgroundColor: "#ede9fe",
        }}
      >
        <Ionicons name="chatbubbles" size={52} color="#6d28d9" />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: "#111827",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Chào mừng đến Zala
      </Text>
      {displayName ? (
        <Text
          style={{
            fontSize: 15,
            color: "#6b7280",
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Xin chào, {displayName}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: 15,
          color: "#6b7280",
          textAlign: "center",
          lineHeight: 22,
          maxWidth: 360,
        }}
      >
        {viewportWidth >= 768
          ? "Chọn một cuộc trò chuyện trong danh sách bên trái để xem tin nhắn và tiếp tục trò chuyện."
          : "Chọn một cuộc trò chuyện trong danh sách để xem tin nhắn và tiếp tục trò chuyện."}
      </Text>
    </View>
  );
}
