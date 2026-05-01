// @ts-nocheck
/**
 * WallpaperPicker — Modal chọn ảnh nền chat.
 * Tách từ ChatArea.tsx, giữ nguyên logic + UI.
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  ImageBackground,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CHAT_BACKGROUNDS } from "../ChatArea.tsx";

type WallpaperPickerProps = {
  visible: boolean;
  currentBgId: string;
  onSelect: (bgId: string) => void;
  onClose: () => void;
};

export default function WallpaperPicker({
  visible,
  currentBgId,
  onSelect,
  onClose,
}: WallpaperPickerProps) {
  const { width: viewportWidth } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: Platform.OS === "web" ? "center" : "flex-end",
            alignItems: Platform.OS === "web" ? "center" : "stretch",
          }}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: Platform.OS === "web" ? 24 : 0,
                borderBottomRightRadius: Platform.OS === "web" ? 24 : 0,
                paddingTop: 12,
                paddingBottom: 36,
                paddingHorizontal: 20,
                width: Platform.OS === "web" ? "92%" : "100%",
                maxWidth: Platform.OS === "web" ? 980 : undefined,
                maxHeight: Platform.OS === "web" ? "84%" : "80%",
              }}
            >
              {/* Handle bar */}
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: "#e5e7eb",
                  borderRadius: 2,
                  alignSelf: "center",
                  marginBottom: 16,
                }}
              />

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "700",
                    color: "#111827",
                  }}
                >
                  Chọn ảnh nền
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close-circle" size={26} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 12,
                    justifyContent: "space-between",
                  }}
                >
                  {CHAT_BACKGROUNDS.map((bg) => {
                    const isActive = bg.id === currentBgId;
                    const bgFill = String((bg as any)["value"] ?? "#f9fafb");
                    const useThreeCols =
                      Platform.OS === "web" && viewportWidth >= 1300;
                    const cardWidth = useThreeCols ? "31.6%" : "48.2%";
                    return (
                      <TouchableOpacity
                        key={bg.id}
                        onPress={() => onSelect(bg.id)}
                        style={{
                          width: cardWidth,
                          aspectRatio: 16 / 9,
                          minHeight: 96,
                          borderRadius: 14,
                          overflow: "hidden",
                          borderWidth: isActive ? 2.5 : 1.5,
                          borderColor: isActive ? "#6d28d9" : "#e5e7eb",
                        }}
                      >
                        {bg.type === "image" ? (
                          <ImageBackground
                            source={{ uri: bgFill }}
                            resizeMode="cover"
                            style={{
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            imageStyle={{ borderRadius: 12 }}
                          >
                            <View
                              style={{
                                position: "absolute",
                                bottom: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: "rgba(0,0,0,0.35)",
                                paddingVertical: 6,
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#fff",
                                  fontSize: 13,
                                  fontWeight: "600",
                                }}
                              >
                                {bg.label}
                              </Text>
                            </View>
                            {isActive && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  right: 8,
                                  backgroundColor: "#6d28d9",
                                  borderRadius: 12,
                                  width: 24,
                                  height: 24,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color="#fff"
                                />
                              </View>
                            )}
                          </ImageBackground>
                        ) : (
                          <View
                            style={{
                              flex: 1,
                              backgroundColor: bgFill,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#374151",
                                fontSize: 13,
                                fontWeight: "600",
                                marginBottom: isActive ? 4 : 0,
                              }}
                            >
                              {bg.label}
                            </Text>
                            {isActive && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  right: 8,
                                  backgroundColor: "#6d28d9",
                                  borderRadius: 12,
                                  width: 24,
                                  height: 24,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Ionicons
                                  name="checkmark"
                                  size={14}
                                  color="#fff"
                                />
                              </View>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
