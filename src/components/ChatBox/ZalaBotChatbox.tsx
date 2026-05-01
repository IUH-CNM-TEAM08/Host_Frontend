import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@/src/contexts/user/UserContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { askZalaBot } from "./Chatbox";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BotMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  ts: number;
}

interface Props {
  onBackPress?: () => void;
}

// Regex detect trigger
const ZALABOT_RE = /^@ZalaBot\b\s*/i;

function isZalaBotCall(text: string) {
  return ZALABOT_RE.test(text.trim());
}
function stripZalaBotPrefix(text: string) {
  return text.trim().replace(ZALABOT_RE, "").trim();
}

// ─── Typing dots animation ─────────────────────────────────────────────────────
function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 280, easing: Easing.out(Easing.sin), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 280, easing: Easing.in(Easing.sin), useNativeDriver: true }),
          Animated.delay(400),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 140);
    const a3 = anim(dot3, 280);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = { width: 7, height: 7, borderRadius: 4, backgroundColor: "#6d28d9", marginHorizontal: 2 };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View key={i} style={[dotStyle, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
}

// ─── Quick suggestion chips ────────────────────────────────────────────────────
const SUGGESTIONS = [
  "@ZalaBot Tổng quan hệ thống của tôi",
  "@ZalaBot Tôi có bao nhiêu bạn bè?",
  "@ZalaBot Có lịch hẹn nào sắp tới không?",
  "@ZalaBot Tin nhắn ghim quan trọng gần đây là gì?",
  "@ZalaBot Tôi có bao nhiêu hội thoại nhóm và cá nhân?",
  "@ZalaBot Có thông báo chưa đọc nào quan trọng không?",
  "@ZalaBot Tóm tắt hoạt động chat gần đây của tôi",
  "@ZalaBot Bài đăng gần đây của tôi gồm những gì?",
  "@ZalaBot Tôi đang có bao nhiêu lời mời kết bạn chờ xử lý?",
  "@ZalaBot Nhắc tôi các đầu việc quan trọng từ lịch hẹn",
  "@ZalaBot Hội thoại nào gần đây hoạt động nhiều nhất?",
  "@ZalaBot Gợi ý việc nên làm tiếp theo trong hệ thống",
];

// ─── Main component ────────────────────────────────────────────────────────────
const STORAGE_KEY = "zala_bot_messages";

export default function ZalaBotChatbox({ onBackPress }: Props) {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // ── Load messages from storage ──
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setMessages(JSON.parse(raw) as BotMessage[]); return; } catch {}
      }
      // First time — bot sends greeting
      const greeting: BotMessage = {
        id: "bot-greeting",
        role: "bot",
        text: `Xin chào **${user?.name ?? "bạn"}**! Tôi là **ZalaBot** — trợ lý AI tổng quan hệ thống.\n\nTôi hỗ trợ các câu hỏi trong phạm vi dữ liệu tài khoản của bạn: **bạn bè, hội thoại, tin nhắn ghim, lịch hẹn, thông báo, bài đăng**.\n\n💡 Cách dùng: Gõ **@ZalaBot** + câu hỏi.\nVí dụ: _@ZalaBot Tổng quan hệ thống của tôi_`,
        ts: Date.now(),
      };
      setMessages([greeting]);
    }).catch(() => {});
  }, []);

  // ── Persist messages ──
  useEffect(() => {
    if (messages.length === 0) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  // ── Auto-scroll ──
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInputText("");
    setShowSuggestions(false);

    const userMsg: BotMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // ── Chỉ gọi AI khi có @ZalaBot prefix ──
    if (isZalaBotCall(trimmed)) {
      const question = stripZalaBotPrefix(trimmed);
      if (!question) {
        const hint: BotMessage = {
          id: `b-${Date.now()}`,
          role: "bot",
          text: "Bạn quên gõ câu hỏi rồi 😄 Ví dụ: **@ZalaBot Tôi có bao nhiêu bạn bè?**",
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, hint]);
        setIsTyping(false);
        return;
      }
      const reply = await askZalaBot(question);
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "bot", text: reply, ts: Date.now() }]);
      setIsTyping(false);
    } else {
      // Không có @ZalaBot → gợi ý cách dùng
      setTimeout(() => {
        const hint: BotMessage = {
          id: `b-${Date.now()}`,
          role: "bot",
          text: `💡 Để tôi trả lời, hãy gõ **@ZalaBot** trước câu hỏi nhé!\n\nVí dụ: _@ZalaBot ${trimmed}_`,
          ts: Date.now(),
        };
        setMessages((prev) => [...prev, hint]);
        setIsTyping(false);
      }, 400);
    }
  }, []);

  const clearChat = useCallback(() => {
    const greeting: BotMessage = {
      id: `bot-greeting-${Date.now()}`,
      role: "bot",
      text: "Cuộc trò chuyện mới bắt đầu! Tôi có thể giúp gì cho bạn? 😊",
      ts: Date.now(),
    };
    setMessages([greeting]);
    setShowSuggestions(true);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f9fafb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top > 0 ? insets.top : 12,
          paddingBottom: 12,
          paddingHorizontal: 14,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
          gap: 10,
        }}
      >
        {onBackPress && (
          <TouchableOpacity onPress={onBackPress} style={{ padding: 4 }}>
            <Ionicons name="chevron-back" size={22} color="#6d28d9" />
          </TouchableOpacity>
        )}

        {/* Bot avatar */}
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "#ede9fe",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="logo-gitlab" size={24} color="#6d28d9" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#1f2937" }}>Zala Bot</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#10b981" }} />
            <Text style={{ fontSize: 12, color: "#6b7280" }}>Luôn online • Trợ lý AI</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={clearChat}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: "#f3f4f6",
          }}
        >
          <Ionicons name="refresh-outline" size={15} color="#6b7280" />
          <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>Mới</Text>
        </TouchableOpacity>
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={{
              flexDirection: "row",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 10,
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            {/* Bot avatar */}
            {msg.role === "bot" && (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#ede9fe",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ionicons name="logo-gitlab" size={18} color="#6d28d9" />
              </View>
            )}

            {/* Bubble */}
            <View
              style={{
                maxWidth: "78%",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: msg.role === "user" ? 18 : 18,
                borderBottomRightRadius: msg.role === "user" ? 4 : 18,
                borderBottomLeftRadius: msg.role === "bot" ? 4 : 18,
                backgroundColor: msg.role === "user" ? "#6d28d9" : "#fff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 14.5,
                  lineHeight: 21,
                  color: msg.role === "user" ? "#fff" : "#1f2937",
                }}
              >
                {/* Render bold **text** manually */}
                {msg.text.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
                  i % 2 === 1 ? (
                    <Text key={i} style={{ fontWeight: "700" }}>
                      {part}
                    </Text>
                  ) : (
                    <Text key={i}>{part}</Text>
                  )
                )}
              </Text>
              <Text
                style={{
                  fontSize: 10,
                  color: msg.role === "user" ? "rgba(255,255,255,0.65)" : "#9ca3af",
                  marginTop: 4,
                  textAlign: "right",
                }}
              >
                {new Date(msg.ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>

            {/* User avatar */}
            {msg.role === "user" && (
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: "#6d28d9",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>
                  {(user?.name ?? "U").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: "#ede9fe",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="logo-gitlab" size={18} color="#6d28d9" />
            </View>
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 18,
                borderBottomLeftRadius: 4,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <TypingDots />
            </View>
          </View>
        )}

        {/* Quick suggestions */}
        {showSuggestions && messages.length <= 2 && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 11, color: "#9ca3af", fontWeight: "600", marginBottom: 8, textAlign: "center" }}>
              GỢI Ý NHANH
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => sendMessage(s)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: "#ede9fe",
                    borderWidth: 1,
                    borderColor: "#ddd6fe",
                  }}
                >
                  <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "600" }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Input bar ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 6 : 12,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
          gap: 10,
        }}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Nhắn tin với Zala Bot..."
          placeholderTextColor="#9ca3af"
          style={{
            flex: 1,
            minHeight: 42,
            maxHeight: 120,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 21,
            backgroundColor: "#f3f4f6",
            fontSize: 14,
            color: "#1f2937",
          }}
          multiline
          onSubmitEditing={() => sendMessage(inputText)}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || isTyping}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: inputText.trim() && !isTyping ? "#6d28d9" : "#e5e7eb",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() && !isTyping ? "#fff" : "#9ca3af"}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
