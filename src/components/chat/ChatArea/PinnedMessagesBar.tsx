// @ts-nocheck
/**
 * PinnedMessagesBar — Floating bar + expanded modal ghim & nhắc hẹn + Pin Limit modal.
 * Tách từ ChatArea.tsx, giữ nguyên logic + UI.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Modal,
  Image,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message } from "@/src/models/Message";

type Reminder = {
  _id?: string;
  id?: string;
  remindAt: string;
  title?: string;
};

type PinnedMessagesBarProps = {
  pinnedMessages: Message[];
  displayedPinnedMessages: Message[];
  upcomingReminders: Reminder[];
  showMessageOptions: boolean;
  canEditPin: boolean;
  // Callbacks
  onDeleteReminder: (id: string) => void;
  onUnpinFromPanel: (msg: Message) => void;
  onMovePinUp: (index: number) => void;
  onMovePinDown: (index: number) => void;
  onSavePinOrder: () => void;
  onScrollToMessage: (msgId: string) => void;
  onReplacePin: (msg: Message) => void;
  // Helpers
  getSenderDisplayLabel: (senderId: string) => string;
  getPinnedPreview: (msg: Message) => string;
  // Pin Limit Modal
  showPinLimitModal: boolean;
  pendingPinMessage: Message | null;
  onClosePinLimit: () => void;
};

export default function PinnedMessagesBar({
  pinnedMessages,
  displayedPinnedMessages,
  upcomingReminders,
  showMessageOptions,
  canEditPin,
  onDeleteReminder,
  onUnpinFromPanel,
  onMovePinUp,
  onMovePinDown,
  onSavePinOrder,
  onScrollToMessage,
  onReplacePin,
  getSenderDisplayLabel,
  getPinnedPreview,
  showPinLimitModal,
  pendingPinMessage,
  onClosePinLimit,
}: PinnedMessagesBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [pinEditMode, setPinEditMode] = useState(false);

  const hasContent = pinnedMessages.length > 0 || upcomingReminders.length > 0;

  if (!hasContent) return null;

  const MONTH_NAMES = [
    "THG 1", "THG 2", "THG 3", "THG 4", "THG 5", "THG 6",
    "THG 7", "THG 8", "THG 9", "THG 10", "THG 11", "THG 12",
  ];

  return (
    <>
      {/* Floating trigger bar */}
      {!showMessageOptions && !showModal && (
        <View
          style={{
            position: "absolute",
            top: Platform.OS === "web" ? 70 : 90,
            left: 0,
            right: 0,
            zIndex: 30,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowModal(true)}
            style={{
              backgroundColor: "#fff",
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
              height: 48,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name="notifications-outline" size={18} color="#6B7280" />
              <View>
                <Text style={{ color: "#111827", fontWeight: "700", fontSize: 13 }}>
                  Ghim & Nhắc hẹn
                </Text>
                <Text style={{ color: "#6B7280", fontSize: 11 }}>
                  {displayedPinnedMessages.length > 0
                    ? `${displayedPinnedMessages.length} ghim`
                    : ""}
                  {displayedPinnedMessages.length > 0 && upcomingReminders.length > 0
                    ? ", "
                    : ""}
                  {upcomingReminders.length > 0
                    ? `${upcomingReminders.length} nhắc hẹn`
                    : ""}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ color: "#0068FF", fontSize: 12, fontWeight: "500" }}>
                Xem tất cả
              </Text>
              <Ionicons name="chevron-forward" size={12} color="#0068FF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Expanded modal */}
      {showModal && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
          }}
        >
          <TouchableWithoutFeedback
            onPress={() => {
              setShowModal(false);
              setPinEditMode(false);
            }}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} />
          </TouchableWithoutFeedback>

          <View
            style={{
              position: "absolute",
              top: Platform.OS === "web" ? 70 : 90,
              left: 0,
              right: 0,
              paddingHorizontal: 12,
            }}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ width: "100%" }}>
                {/* Reminders section */}
                {upcomingReminders.length > 0 && (
                  <View
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 12,
                      marginBottom: 10,
                      overflow: "hidden",
                      shadowColor: "#000",
                      shadowOpacity: 0.1,
                      shadowRadius: 10,
                      elevation: 6,
                      borderWidth: 1,
                      borderColor: "#F1F5F9",
                    }}
                  >
                    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
                        Nhắc hẹn sắp tới
                      </Text>
                    </View>
                    <View>
                      {upcomingReminders.map((reminder) => {
                        const rid = reminder._id ?? reminder.id;
                        const dateObj = new Date(reminder.remindAt);
                        const monthLabel = MONTH_NAMES[dateObj.getMonth()];
                        const dayNum = dateObj.getDate();
                        const timeStr = `${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;

                        return (
                          <View
                            key={rid}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 16,
                              paddingVertical: 14,
                              borderTopWidth: 1,
                              borderTopColor: "#F8FAFC",
                            }}
                          >
                            <View
                              style={{
                                width: 44,
                                height: 48,
                                borderRadius: 10,
                                backgroundColor: "#FFF5F5",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                                borderWidth: 0.5,
                                borderColor: "#FEE2E2",
                              }}
                            >
                              <Text style={{ fontSize: 9, fontWeight: "800", color: "#EF4444" }}>
                                {monthLabel}
                              </Text>
                              <Text style={{ fontSize: 20, fontWeight: "900", color: "#1F2937" }}>
                                {dayNum}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}
                                numberOfLines={1}
                              >
                                {reminder.title || "Lịch hẹn"}
                              </Text>
                              <Text style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
                                Hôm nay (lúc {timeStr})
                              </Text>
                            </View>
                            <TouchableOpacity onPress={() => onDeleteReminder(rid!)} style={{ padding: 6 }}>
                              <Ionicons name="trash-outline" size={20} color="#D1D5DB" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Pinned messages section */}
                <View
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    borderTopLeftRadius: upcomingReminders.length === 0 ? 0 : 12,
                    overflow: "hidden",
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    elevation: 6,
                    borderWidth: 1,
                    borderColor: "#F1F5F9",
                  }}
                >
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
                      Danh sách ghim
                    </Text>
                  </View>
                  <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                    {displayedPinnedMessages.length > 0 ? (
                      displayedPinnedMessages.map((pinnedMsg) => {
                        const pinIndex = pinnedMessages.findIndex((m) => m.id === pinnedMsg.id);
                        return (
                          <TouchableOpacity
                            key={pinnedMsg.id}
                            activeOpacity={0.7}
                            onPress={() => onScrollToMessage(pinnedMsg.id)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingHorizontal: 16,
                              paddingVertical: 14,
                              borderTopWidth: 1,
                              borderTopColor: "#F8FAFC",
                            }}
                          >
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: "#EFF6FF",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 14,
                              }}
                            >
                              <Ionicons name="chatbubble-outline" size={18} color="#0068FF" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }} numberOfLines={1}>
                                {getPinnedPreview(pinnedMsg)}
                              </Text>
                              <Text style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
                                Tin nhắn của {getSenderDisplayLabel(pinnedMsg.senderId)}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              {pinEditMode && canEditPin ? (
                                <>
                                  <TouchableOpacity
                                    onPress={() => onUnpinFromPanel(pinnedMsg)}
                                    style={{ padding: 4 }}
                                  >
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => onMovePinUp(pinIndex)}
                                    disabled={pinIndex <= 0}
                                    style={{ padding: 4 }}
                                  >
                                    <Ionicons
                                      name="arrow-up-circle"
                                      size={22}
                                      color={pinIndex <= 0 ? "#CBD5E1" : "#0068FF"}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => onMovePinDown(pinIndex)}
                                    disabled={pinIndex >= pinnedMessages.length - 1}
                                    style={{ padding: 4 }}
                                  >
                                    <Ionicons
                                      name="arrow-down-circle"
                                      size={22}
                                      color={pinIndex >= pinnedMessages.length - 1 ? "#CBD5E1" : "#0068FF"}
                                    />
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={{ padding: 24, alignItems: "center" }}>
                        <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                          Chưa có tin nhắn nào được ghim
                        </Text>
                      </View>
                    )}
                  </ScrollView>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderTopWidth: 1,
                      borderTopColor: "#F1F5F9",
                    }}
                  >
                    {canEditPin && (
                      <TouchableOpacity
                        onPress={() => {
                          if (pinEditMode) void onSavePinOrder();
                          else setPinEditMode(true);
                        }}
                        style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                      >
                        <Ionicons
                          name={pinEditMode ? "checkmark-circle" : "create-outline"}
                          size={18}
                          color={pinEditMode ? "#10B981" : "#475569"}
                        />
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: pinEditMode ? "#10B981" : "#475569",
                          }}
                        >
                          {pinEditMode ? "Xong" : "Chỉnh sửa"}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        setShowModal(false);
                        setPinEditMode(false);
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#64748B" }}>
                        Thu gọn
                      </Text>
                      <Ionicons name="chevron-up" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      )}

      {/* Pin Limit Modal */}
      <Modal
        visible={showPinLimitModal}
        transparent
        animationType="fade"
        onRequestClose={onClosePinLimit}
      >
        <TouchableWithoutFeedback onPress={onClosePinLimit}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <View className="bg-white rounded-2xl w-[85%] max-w-sm overflow-hidden p-5">
                <Text className="text-lg font-bold text-gray-900 text-center mb-2">
                  Đã đạt giới hạn ghim
                </Text>
                <Text className="text-gray-600 text-center mb-4 leading-5">
                  Bạn chỉ có thể ghim tối đa 3 tin nhắn. Vui lòng chọn 1 tin
                  nhắn để bỏ ghim trước khi ghim tin mới.
                </Text>

                <View className="bg-gray-50 rounded-xl max-h-[220px] mb-4">
                  <ScrollView
                    bounces={false}
                    contentContainerStyle={{ paddingVertical: 4 }}
                  >
                    {pinnedMessages.map((msg, index) => {
                      const isOldest = index === 0;
                      return (
                        <View
                          key={msg.id}
                          className="flex-row items-center border-b border-gray-200 px-3 py-3"
                        >
                          <View className="flex-1 mr-2">
                            <View className="flex-row items-center space-x-2 mb-1">
                              <Image
                                source={{
                                  uri: "https://res-zalo.zadn.vn/upload/media/2023/8/23/ic_pin_1692773653119_121326.png",
                                }}
                                style={{ width: 12, height: 12 }}
                                resizeMode="contain"
                              />
                              <Text
                                className="text-gray-800 font-medium text-sm"
                                numberOfLines={1}
                              >
                                {getSenderDisplayLabel(msg.senderId)}
                                : {getPinnedPreview(msg)}
                              </Text>
                            </View>
                            {isOldest && (
                              <Text className="text-xs text-orange-500 font-medium">
                                Ghim cũ nhất
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => onReplacePin(msg)}
                            className="bg-red-50 p-2 rounded-full"
                          >
                            <Ionicons name="remove" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>

                <TouchableOpacity
                  className="bg-gray-100 py-3 rounded-xl items-center"
                  onPress={onClosePinLimit}
                >
                  <Text className="text-gray-700 font-semibold">Hủy</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
