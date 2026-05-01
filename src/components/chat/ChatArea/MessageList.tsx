// @ts-nocheck
/**
 * MessageList — Render danh sách tin nhắn.
 * Tách từ ChatArea.tsx L4105-5103, giữ nguyên logic + UI.
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MessageType } from "@/src/models/Message";
import VoteMessageContent from "../VoteMessageContent";
import MediaAlbumMessage from "../MediaAlbumMessage";
import FileMessageContent from "../FileMessageContent";
import TranslatedText from "../TranslatedText";
import MessageReaction, { ReactionSummary } from "../MessageReaction";
import ChatNewer from "../../chat-area/ChatNewer";

type MessageListProps = {
  messages: any[];
  user: any;
  selectedChat: any;
  messageRefs: React.MutableRefObject<{ [key: string]: number }>;
  highlightedMessageId: string | null;
  activeReactionId: string | null;
  isMultiSelectMode: boolean;
  selectedMessageIds: string[];
  webMessageMaxWidth: number | string;
  mobileMessageMaxWidth: number | string;
  messageReactions: Record<string, any[]>;
  userLastReadMap: Record<string, any>;
  msgStatusMap: Record<string, string>;
  messageUsers: any;
  // Functions
  getSenderAvatar: (id: string) => string;
  getSenderDisplayLabel: (id: string) => string;
  scrollToMessage: (id: string) => void;
  toggleSelectMessage: (msg: any) => void;
  handleEnterMultiSelect: (msg: any) => void;
  openMessageOptions: (msg: any) => void;
  handleReactionToggle: (id: string) => void;
  handleReact: (msgId: string, emoji: string) => void;
  handleUnreact: (msgId: string, emoji: string) => void;
  handleRetryMessage: (msg: any) => void;
  getAttachmentByMessageId: (id: string) => any;
  setFullScreenImage: (uri: string | null) => void;
  getChatDateSeparatorLabel: (date: string) => string;
  isSameDayChat: (a: string, b: string) => boolean;
  normalizeSeenAvatarUrl: (url: string) => string;
  renderTextWithLinks: (text: string, isSender: boolean, msgId: string) => any;
  extractStickerKeyFromMessage: (content: string) => string | null;
  getStickerSourceByKey: (key: string) => any;
  formatAppointmentTime: (time: string) => string | null;
  setError: (msg: string) => void;
};

export default function MessageList(props: MessageListProps) {
  const {
    messages, user, selectedChat, messageRefs, highlightedMessageId,
    activeReactionId, isMultiSelectMode, selectedMessageIds,
    webMessageMaxWidth, mobileMessageMaxWidth, messageReactions,
    userLastReadMap, msgStatusMap, messageUsers,
    getSenderAvatar, getSenderDisplayLabel, scrollToMessage,
    toggleSelectMessage, handleEnterMultiSelect, openMessageOptions,
    handleReactionToggle, handleReact, handleUnreact, handleRetryMessage,
    getAttachmentByMessageId, setFullScreenImage, getChatDateSeparatorLabel,
    isSameDayChat, normalizeSeenAvatarUrl, renderTextWithLinks,
    extractStickerKeyFromMessage, getStickerSourceByKey, formatAppointmentTime,
    setError,
  } = props;

  // === PASTE CODE TỪ ChatArea.tsx DÒNG 4105 → 5103 VÀO ĐÂY ===
  // (Xóa dòng comment này sau khi paste)

  return (
    <>
      {messages.length === 0 && (
        <ChatNewer selectedChat={selectedChat} />
      )}

      {/* PASTE ĐOẠN {(() => { ... })()} VÀO ĐÂY */}
           {(() => {
                      // ID của tin cuối dạng bubble mình gửi (bỏ qua SYSTEM/đã xóa)
                      const lastSentMsgId = !selectedChat?.isGroup
                        ? [...messages]
                            .reverse()
                            .find(
                              (m) =>
                                m.senderId === user?.id &&
                                !m.isDeletedForEveryone &&
                                m.type !== MessageType.SYSTEM,
                            )?.id
                        : undefined;
                      const validMessages = messages.filter(Boolean);
                      return validMessages.map((msg, index) => {
                        const prevMsg = index > 0 ? validMessages[index - 1] : null;
                        const nextMsg =
                          index < validMessages.length - 1
                            ? validMessages[index + 1]
                            : null;
      
                        const isConsecutiveWithPrev =
                          prevMsg &&
                          prevMsg.senderId === msg.senderId &&
                          prevMsg.type !== MessageType.SYSTEM &&
                          msg.type !== MessageType.SYSTEM &&
                          new Date(msg.sentAt).getTime() -
                            new Date(prevMsg.sentAt).getTime() <
                            60000;
      
                        const isConsecutiveWithNext =
                          nextMsg &&
                          nextMsg.senderId === msg.senderId &&
                          nextMsg.type !== MessageType.SYSTEM &&
                          msg.type !== MessageType.SYSTEM &&
                          new Date(nextMsg.sentAt).getTime() -
                            new Date(msg.sentAt).getTime() <
                            60000;
                        // Store position for scrolling to messages
                        const onLayout = (event) => {
                          const layout = event.nativeEvent.layout;
                          messageRefs.current[msg.id] = layout.y;
                        };
      
                        // Check if this message is currently highlighted
                        const isHighlighted = msg.id === highlightedMessageId;
                        const isReactionOpen = activeReactionId === msg.id;
      
                        const repliedMessageId =
                          msg.repliedToId || msg.repliedTold || msg.parentMessageId;
                        const repliedToMessage = repliedMessageId
                          ? messages.find((m) => m.id === repliedMessageId)
                          : null;
                        const locationMeta = msg.metadata as {
                          kind?: string;
                          mapUrl?: string;
                          latitude?: number;
                          longitude?: number;
                        } | null;
                        const contentText = String(msg.content ?? "");
                        const mapUrlFromContent = contentText.match(
                          /https?:\/\/maps\.google\.com\/\?q=[^\s]+/i,
                        )?.[0];
                        const locationQuery =
                          (locationMeta?.mapUrl ?? mapUrlFromContent ?? "").split(
                            "?q=",
                          )[1] ?? "";
                        const isLocationMessage =
                          locationMeta?.kind === "location" ||
                          Boolean(mapUrlFromContent);
                        const appointmentContext = msg.storyContext as {
                          kind?: string;
                          title?: string;
                          remindAt?: string;
                        } | null;
                        const isAppointmentMessage =
                          appointmentContext?.kind === "appointment";
                        const stickerKey = extractStickerKeyFromMessage(msg.content);
                        const stickerSource = stickerKey
                          ? getStickerSourceByKey(stickerKey)
                          : undefined;
                        const appointmentWhen = appointmentContext?.remindAt
                          ? formatAppointmentTime(appointmentContext.remindAt)
                          : null;
      
                        const showDateSeparator =
                          !prevMsg ||
                          !isSameDayChat(msg.sentAt, prevMsg.sentAt);
      
                        // Special rendering for SYSTEM type messages (pinned messages)
                        if (msg.type === MessageType.SYSTEM) {
                          return (
                            <React.Fragment key={msg.id}>
                              {showDateSeparator && (
                                <View className="items-center my-8 flex-row justify-center">
                                  <View className="h-[1px] bg-gray-200 flex-1 mx-6" />
                                  <View className="bg-white px-5 py-2 rounded-full border border-gray-100 shadow-sm">
                                    <Text className="text-gray-400 text-[10px] font-extrabold uppercase tracking-[2px]">
                                      {getChatDateSeparatorLabel(msg.sentAt)}
                                    </Text>
                                  </View>
                                  <View className="h-[1px] bg-gray-200 flex-1 mx-6" />
                                </View>
                              )}
                              <View
                                className="flex-row justify-center mb-4"
                                onLayout={onLayout}
                              >
                                <View
                                  className={`bg-gray-100/70 rounded-full px-4 py-1.5 max-w-[85%] items-center ${
                                    isHighlighted
                                      ? "bg-yellow-100 border border-yellow-300"
                                      : ""
                                  }`}
                                >
                                  <Text className="text-gray-500 text-xs text-center leading-4 font-medium">
                                    {msg.content}
                                  </Text>
                                </View>
                              </View>
                            </React.Fragment>
                          );
                        }
      
                        // Regular message rendering
                        return (
                          <React.Fragment key={msg.id}>
                            {showDateSeparator && (
                              <View className="items-center my-8 flex-row justify-center">
                                <View className="h-[1px] bg-gray-200 flex-1 mx-6" />
                                <View className="bg-white px-5 py-2 rounded-full border border-gray-100 shadow-sm">
                                  <Text className="text-gray-400 text-[10px] font-extrabold uppercase tracking-[2px]">
                                    {getChatDateSeparatorLabel(msg.sentAt)}
                                  </Text>
                                </View>
                                <View className="h-[1px] bg-gray-200 flex-1 mx-6" />
                              </View>
                            )}
                          <View
                            className={`flex-row items-end ${isConsecutiveWithNext ? "mb-1" : "mb-4"} ${msg.senderId === user?.id ? "justify-end" : "justify-start"}`}
                            onLayout={onLayout}
                            style={{
                              position: "relative",
                              zIndex: isReactionOpen ? 999 : 1,
                              elevation: isReactionOpen ? 30 : 0,
                            }}
                          >
                            <View
                              className={`relative mt-2 flex flex-row ${msg.senderId === user?.id ? "items-end" : "items-start"}`}
                              style={{
                                overflow: "visible",
                                maxWidth:
                                  Platform.OS === "web"
                                    ? "70%"
                                    : mobileMessageMaxWidth,
                              }}
                            >
                              {msg.senderId !== user?.id && (
                                <Image
                                  source={{
                                    uri: getSenderAvatar(msg.senderId),
                                  }}
                                  className={`w-8 h-8 rounded-full mr-2 mt-3 ${isConsecutiveWithPrev ? "opacity-0" : ""}`}
                                  resizeMode="cover"
                                />
                              )}
      
                              <View
                                className={`flex-col mt-2 ${msg.senderId === user?.id ? "items-end" : "items-start"}`}
                                style={{
                                  overflow: "visible",
                                  maxWidth:
                                    Platform.OS === "web"
                                      ? webMessageMaxWidth
                                      : mobileMessageMaxWidth,
                                  minWidth: 0,
                                  flexShrink: 1,
                                }}
                              >
                                {/* Replied message reference */}
                                {repliedMessageId &&
                                  (() => {
                                    const isMine = msg.senderId === user?.id;
                                    const rType = repliedToMessage?.type;
                                    const replyIcon =
                                      rType === MessageType.IMAGE
                                        ? "image-outline"
                                        : rType === MessageType.MEDIA_ALBUM
                                          ? "images-outline"
                                          : rType === MessageType.VIDEO
                                            ? "videocam-outline"
                                            : rType === MessageType.AUDIO
                                              ? "mic-outline"
                                              : rType === MessageType.FILE
                                                ? "document-outline"
                                                : null;
                                    const replyLabel =
                                      rType === MessageType.IMAGE
                                        ? "Hình ảnh"
                                        : rType === MessageType.VIDEO
                                          ? "Video"
                                          : rType === MessageType.AUDIO
                                            ? "Tin nhắn thoại"
                                            : rType === MessageType.FILE
                                              ? ((repliedToMessage?.metadata as any)
                                                  ?.fileName ?? "File")
                                              : rType === MessageType.MEDIA_ALBUM
                                                ? "Album ảnh/video"
                                                : repliedToMessage?.content ||
                                                  "Tin nhắn đã bị xoá";
      
                                    return (
                                      <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => {
                                          void scrollToMessage(repliedMessageId);
                                        }}
                                        style={{
                                          backgroundColor: "rgba(109,40,217,0.12)",
                                          borderLeftWidth: 3,
                                          borderLeftColor: "#6d28d9",
                                          borderRadius: 8,
                                          marginBottom: 6,
                                          paddingHorizontal: 10,
                                          paddingVertical: 7,
                                          maxWidth:
                                            Platform.OS === "web"
                                              ? 260
                                              : mobileMessageMaxWidth - 12,
                                          minWidth:
                                            Platform.OS === "web" ? undefined : 170,
                                          flexDirection: "row",
                                          alignItems: "center",
                                          gap: 8,
                                        }}
                                      >
                                        {/* Thumbnail ảnh */}
                                        {(rType === MessageType.IMAGE ||
                                          rType === MessageType.MEDIA_ALBUM) && (
                                          <Image
                                            source={{
                                              uri:
                                                (repliedToMessage?.metadata as any)
                                                  ?.cdnUrl ??
                                                repliedToMessage?.mediaItems?.[0]
                                                  ?.cdnUrl ??
                                                "https://placehold.co/36x36/0068FF/fff",
                                            }}
                                            style={{
                                              width: 36,
                                              height: 36,
                                              borderRadius: 6,
                                              backgroundColor: "#D1D5DB",
                                            }}
                                            resizeMode="cover"
                                          />
                                        )}
                                        {/* Icon type */}
                                        {replyIcon &&
                                          rType !== MessageType.IMAGE &&
                                          rType !== MessageType.MEDIA_ALBUM && (
                                            <View
                                              style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 6,
                                                backgroundColor:
                                                  "rgba(109,40,217,0.16)",
                                                alignItems: "center",
                                                justifyContent: "center",
                                              }}
                                            >
                                              <Ionicons
                                                name={replyIcon as any}
                                                size={15}
                                                color="#6d28d9"
                                              />
                                            </View>
                                          )}
                                        <View
                                          style={{
                                            flex: 1,
                                            minWidth: 0,
                                            overflow: "hidden",
                                          }}
                                        >
                                          <Text
                                            numberOfLines={1}
                                            style={{
                                              fontSize: 11,
                                              color: "#6d28d9",
                                              fontWeight: "900",
                                              marginBottom: 2,
                                            }}
                                          >
                                            {getSenderDisplayLabel(
                                              repliedToMessage?.senderId ?? "",
                                            )}
                                          </Text>
                                          <View
                                            style={{
                                              flexDirection: "row",
                                              alignItems: "center",
                                              gap: 4,
                                            }}
                                          >
                                            {replyIcon &&
                                              rType !== MessageType.IMAGE &&
                                              rType !== MessageType.MEDIA_ALBUM && (
                                                <Ionicons
                                                  name={replyIcon as any}
                                                  size={11}
                                                  color="#7c3aed"
                                                />
                                              )}
                                            <Text
                                              numberOfLines={1}
                                              style={{
                                                fontSize: 12,
                                                flex: 1,
                                                color: "#1f2937",
                                                fontWeight: "800",
                                              }}
                                            >
                                              {replyLabel}
                                            </Text>
                                          </View>
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  })()}
      
                                {/* Message content */}
                                <View
                                  className="flex-row items-center relative"
                                  style={{
                                    overflow: "visible",
                                    maxWidth:
                                      Platform.OS === "web"
                                        ? webMessageMaxWidth
                                        : mobileMessageMaxWidth,
                                    minWidth: 0,
                                    flexShrink: 1,
                                  }}
                                >
                                  {msg.isDeletedForEveryone ? (
                                    <TouchableOpacity
                                      onLongPress={() =>
                                        isMultiSelectMode
                                          ? toggleSelectMessage(msg)
                                          : handleEnterMultiSelect(msg)
                                      }
                                      onPress={() =>
                                        isMultiSelectMode
                                          ? toggleSelectMessage(msg)
                                          : openMessageOptions(msg)
                                      }
                                      delayLongPress={200}
                                      activeOpacity={0.7}
                                    >
                                      <View
                                        className={`rounded-2xl p-2 ${
                                          msg.senderId === user?.id
                                            ? ""
                                            : isHighlighted
                                              ? "bg-yellow-50 border border-yellow-300"
                                              : "bg-gray-100"
                                        } ${isMultiSelectMode && selectedMessageIds.includes(msg.id) ? "border-2 border-blue-300" : ""}`}
                                        style={
                                          msg.senderId === user?.id
                                            ? {
                                                backgroundColor: isHighlighted
                                                  ? "#7c3aed"
                                                  : "#6d28d9",
                                              }
                                            : undefined
                                        }
                                      >
                                        {msg.senderId !== user?.id &&
                                          !isConsecutiveWithPrev && (
                                            <Text className="text-gray-500 text-xs mb-1">
                                              {getSenderDisplayLabel(msg.senderId)}
                                            </Text>
                                          )}
                                        <Text
                                          className={`italic ${
                                            msg.senderId === user?.id
                                              ? "text-white/90"
                                              : "text-gray-500"
                                          }`}
                                        >
                                          Tin nhắn đã được thu hồi
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  ) : msg.type === MessageType.VOTE ? (
                                    <TouchableOpacity
                                      onLongPress={() =>
                                        isMultiSelectMode
                                          ? toggleSelectMessage(msg)
                                          : handleEnterMultiSelect(msg)
                                      }
                                      onPress={() =>
                                        isMultiSelectMode
                                          ? toggleSelectMessage(msg)
                                          : openMessageOptions(msg)
                                      }
                                      delayLongPress={200}
                                      activeOpacity={0.7}
                                    >
                                      <View
                                        className={`rounded-2xl p-2 ${
                                          msg.senderId === user?.id
                                            ? ""
                                            : isHighlighted
                                              ? "bg-yellow-50 border border-yellow-300"
                                              : "bg-gray-100"
                                        } ${isMultiSelectMode && selectedMessageIds.includes(msg.id) ? "border-2 border-blue-300" : ""}`}
                                        style={
                                          msg.senderId === user?.id
                                            ? {
                                                backgroundColor: isHighlighted
                                                  ? "#7c3aed"
                                                  : "#6d28d9",
                                              }
                                            : undefined
                                        }
                                      >
                                        {msg.senderId !== user?.id &&
                                          !isConsecutiveWithPrev && (
                                            <Text className="text-gray-500 text-xs mb-1">
                                              {getSenderDisplayLabel(msg.senderId)}
                                            </Text>
                                          )}
      
                                        <TouchableWithoutFeedback
                                          onPress={(e) => {
                                            e.stopPropagation();
                                          }}
                                          onLongPress={() => openMessageOptions(msg)}
                                        >
                                          <View className="self-center w-full min-w-[300px] pointer-events-auto">
                                            <VoteMessageContent
                                              messageId={msg.id}
                                              voteData={msg.content}
                                              userId={user?.id || ""}
                                              conversationId={selectedChat.id}
                                              participants={
                                                selectedChat.participantInfo || []
                                              }
                                              userInfos={messageUsers}
                                            />
                                          </View>
                                        </TouchableWithoutFeedback>
                                      </View>
                                    </TouchableOpacity>
                                  ) : (
                                    <TouchableOpacity
                                      onLongPress={() =>
                                        isMultiSelectMode
                                          ? toggleSelectMessage(msg)
                                          : handleEnterMultiSelect(msg)
                                      }
                                      onPress={() =>
                                        isMultiSelectMode
                                          ? toggleSelectMessage(msg)
                                          : openMessageOptions(msg)
                                      }
                                      delayLongPress={200}
                                      activeOpacity={0.7}
                                    >
                                      <View
                                        className={`rounded-2xl p-2 ${
                                          msg.senderId === user?.id
                                            ? ""
                                            : isHighlighted
                                              ? "bg-yellow-50 border border-yellow-300"
                                              : "bg-gray-100"
                                        } ${isMultiSelectMode && selectedMessageIds.includes(msg.id) ? "border-2 border-blue-300" : ""}`}
                                        style={{
                                          overflow: "visible",
                                          maxWidth:
                                            Platform.OS === "web"
                                              ? webMessageMaxWidth
                                              : mobileMessageMaxWidth,
                                          ...(msg.senderId === user?.id
                                            ? {
                                                backgroundColor: isHighlighted
                                                  ? "#7c3aed"
                                                  : "#6d28d9",
                                              }
                                            : {}),
                                        }}
                                      >
                                        {msg.senderId !== user?.id &&
                                          !isConsecutiveWithPrev && (
                                            <Text className="text-gray-500 text-xs mb-1">
                                              {getSenderDisplayLabel(msg.senderId)}
                                            </Text>
                                          )}
      
                                        {msg.type === MessageType.TEXT ? (
                                          stickerSource ? (
                                            <Image
                                              source={stickerSource}
                                              style={{ width: 120, height: 120 }}
                                              resizeMode="contain"
                                            />
                                          ) : /^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i.test(String(msg.content ?? "").trim()) ? (
                                            /* GIPHY / URL ảnh — hiển thị ảnh thay vì text */
                                            <TouchableOpacity
                                              activeOpacity={0.85}
                                              onPress={() => setFullScreenImage(String(msg.content).trim())}
                                            >
                                              <Image
                                                source={{ uri: String(msg.content).trim() }}
                                                style={{ width: 150, height: 150, borderRadius: 8 }}
                                                resizeMode="contain"
                                              />
                                            </TouchableOpacity>
                                          ) : isAppointmentMessage ? (
                                            <View
                                              style={{ minWidth: 180, maxWidth: 260 }}
                                            >
                                              <View
                                                style={{
                                                  flexDirection: "row",
                                                  alignItems: "center",
                                                  marginBottom: 4,
                                                }}
                                              >
                                                <Ionicons
                                                  name="calendar"
                                                  size={16}
                                                  color={
                                                    msg.senderId === user?.id
                                                      ? "#FFFFFF"
                                                      : "#2563EB"
                                                  }
                                                />
                                                <Text
                                                  style={{
                                                    marginLeft: 6,
                                                    fontWeight: "700",
                                                    color:
                                                      msg.senderId === user?.id
                                                        ? "#FFFFFF"
                                                        : "#111827",
                                                  }}
                                                >
                                                  Lich hen
                                                </Text>
                                              </View>
                                              <Text
                                                className={
                                                  msg.senderId === user?.id
                                                    ? "text-white"
                                                    : "text-gray-900"
                                                }
                                              >
                                                {appointmentContext?.title ||
                                                  msg.content}
                                              </Text>
                                              {appointmentWhen && (
                                                <Text
                                                  style={{
                                                    fontSize: 12,
                                                    marginTop: 4,
                                                    color:
                                                      msg.senderId === user?.id
                                                        ? "#DBEAFE"
                                                        : "#2563EB",
                                                    fontWeight: "600",
                                                  }}
                                                >
                                                  {appointmentWhen}
                                                </Text>
                                              )}
                                            </View>
                                          ) : isLocationMessage ? (
                                            <TouchableOpacity
                                              onPress={() => {
                                                const mapUrl =
                                                  (locationMeta?.mapUrl ||
                                                    mapUrlFromContent) as
                                                    | string
                                                    | undefined;
                                                if (mapUrl) {
                                                  if (
                                                    Platform.OS === "web" &&
                                                    typeof window !== "undefined"
                                                  ) {
                                                    window.open(
                                                      mapUrl,
                                                      "_blank",
                                                      "noopener,noreferrer",
                                                    );
                                                    return;
                                                  }
                                                  Linking.openURL(mapUrl).catch(
                                                    () => {
                                                      setError(
                                                        "Không thể mở bản đồ.",
                                                      );
                                                    },
                                                  );
                                                }
                                              }}
                                              activeOpacity={0.85}
                                              style={{
                                                minWidth: 160,
                                                maxWidth: 240,
                                                paddingVertical: 2,
                                              }}
                                            >
                                              <View
                                                style={{
                                                  flexDirection: "row",
                                                  alignItems: "center",
                                                  marginBottom: 4,
                                                }}
                                              >
                                                <Ionicons
                                                  name="location"
                                                  size={16}
                                                  color={
                                                    msg.senderId === user?.id
                                                      ? "#FFFFFF"
                                                      : "#2563EB"
                                                  }
                                                />
                                                <Text
                                                  style={{
                                                    marginLeft: 6,
                                                    fontWeight: "700",
                                                    color:
                                                      msg.senderId === user?.id
                                                        ? "#FFFFFF"
                                                        : "#111827",
                                                  }}
                                                >
                                                  Vi tri hien tai
                                                </Text>
                                              </View>
                                              <Text
                                                style={{
                                                  fontSize: 12,
                                                  color:
                                                    msg.senderId === user?.id
                                                      ? "rgba(255,255,255,0.9)"
                                                      : "#4B5563",
                                                }}
                                                numberOfLines={1}
                                              >
                                                {locationMeta?.latitude != null &&
                                                locationMeta?.longitude != null
                                                  ? `${locationMeta.latitude.toFixed(5)},${locationMeta.longitude.toFixed(5)}`
                                                  : locationQuery ||
                                                    "Vi tri duoc chia se"}
                                              </Text>
                                              <Text
                                                style={{
                                                  fontSize: 12,
                                                  marginTop: 4,
                                                  color:
                                                    msg.senderId === user?.id
                                                      ? "#DBEAFE"
                                                      : "#2563EB",
                                                  fontWeight: "600",
                                                }}
                                              >
                                                Mo ban do
                                              </Text>
                                            </TouchableOpacity>
                                          ) : (
                                            <>
                                              <Text
                                                className={
                                                  msg.senderId === user?.id
                                                    ? "text-white"
                                                    : "text-gray-900"
                                                }
                                                style={{
                                                  flexShrink: 1,
                                                }}
                                              >
                                                {renderTextWithLinks(
                                                  String(msg.content ?? ""),
                                                  msg.senderId === user?.id,
                                                  msg.id,
                                                )}
                                              </Text>
                                              <TranslatedText
                                                content={msg.content}
                                                type={msg.type}
                                                isSender={msg.senderId === user?.id}
                                              />
                                            </>
                                          )
                                        ) : msg.type === MessageType.MEDIA_ALBUM &&
                                          msg.mediaItems &&
                                          msg.mediaItems.length > 0 ? (
                                          <MediaAlbumMessage
                                            items={msg.mediaItems}
                                            isSender={msg.senderId === user?.id}
                                          />
                                        ) : msg.type === MessageType.FILE ||
                                          msg.type === MessageType.AUDIO ||
                                          msg.type === MessageType.IMAGE ||
                                          msg.type === MessageType.VIDEO ? (
                                          <FileMessageContent
                                            messageId={msg.id}
                                            fileName={
                                              (
                                                msg.metadata as
                                                  | { fileName?: string }
                                                  | undefined
                                              )?.fileName ||
                                              msg.content ||
                                              (msg.type === MessageType.IMAGE
                                                ? "Ảnh"
                                                : msg.type === MessageType.VIDEO
                                                  ? "Video"
                                                  : msg.type === MessageType.AUDIO
                                                    ? "Ghi âm thoại"
                                                    : "Tệp")
                                            }
                                            isSender={msg.senderId === user?.id}
                                            getAttachment={getAttachmentByMessageId}
                                            onImagePress={setFullScreenImage}
                                            metadata={msg.metadata ?? undefined}
                                            mediaKind={
                                              msg.type === MessageType.IMAGE
                                                ? "image"
                                                : msg.type === MessageType.VIDEO
                                                  ? "video"
                                                  : "file"
                                            }
                                          />
                                        ) : (
                                          msg.type === MessageType.CALL && (
                                            <Text
                                              className={
                                                msg.senderId === user?.id
                                                  ? "text-white"
                                                  : "text-gray-900"
                                              }
                                            >
                                              {(() => {
                                                const ctx = (msg.storyContext ??
                                                  {}) as any;
                                                const isGroupCall =
                                                  Boolean(ctx?.isGroupCall) ||
                                                  Boolean(selectedChat?.isGroup);
                                                const actorName = getSenderDisplayLabel(
                                                  msg.senderId,
                                                );
                                                const d =
                                                  ctx?.durationText ||
                                                  (typeof ctx?.durationSeconds ===
                                                  "number"
                                                    ? `${ctx.durationSeconds}s`
                                                    : "");
      
                                                if (!isGroupCall) {
                                                  if (msg.content === "start")
                                                    return "📞 Cuộc gọi đang bắt đầu";
                                                  return d
                                                    ? `📴 Cuộc gọi đã kết thúc • ${d}`
                                                    : "📴 Cuộc gọi đã kết thúc";
                                                }
      
                                                if (msg.content === "start")
                                                  return "📞 Cuộc gọi nhóm đang bắt đầu";
                                                if (msg.content === "group_declined")
                                                  return `❌ ${actorName} đã từ chối tham gia gọi nhóm`;
                                                if (msg.content === "group_joined")
                                                  return `✅ ${actorName} đã tham gia gọi nhóm`;
                                                if (msg.content === "group_left")
                                                  return `↩️ ${actorName} đã rời cuộc gọi nhóm`;
                                                return d
                                                  ? `📴 Cuộc gọi nhóm đã kết thúc • ${d}`
                                                  : "📴 Cuộc gọi nhóm đã kết thúc";
                                              })()}
                                            </Text>
                                          )
                                        )}
                                        <MessageReaction
                                          messageId={msg.id}
                                          conversationId={selectedChat?.id ?? ""}
                                          isVisible={activeReactionId === msg.id}
                                          onToggle={() =>
                                            handleReactionToggle(msg.id)
                                          }
                                          isSender={msg.senderId === user?.id}
                                          currentUserId={user?.id ?? ""}
                                          reactions={messageReactions[msg.id] ?? []}
                                          onReact={handleReact}
                                          onUnreact={handleUnreact}
                                        />
                                      </View>
                                    </TouchableOpacity>
                                  )}
                                </View>
      
                                {/* ── Reaction summary — render bên NGOÀI bubble ── */}
                                <ReactionSummary
                                  reactions={messageReactions[msg.id] ?? []}
                                  currentUserId={user?.id ?? ""}
                                  isSender={msg.senderId === user?.id}
                                  messageId={msg.id}
                                  conversationId={selectedChat?.id ?? ""}
                                  onReact={handleReact}
                                  onUnreact={handleUnreact}
                                />
      
                                {msg.status === "PENDING" && (
                                  <Text className="text-[10px] text-gray-400 mt-1 italic text-right">
                                    Đang gửi...
                                  </Text>
                                )}
      
                                {msg.status === "FAILED" && (
                                  <TouchableOpacity
                                    onPress={() => handleRetryMessage(msg)}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      justifyContent: "flex-end",
                                      marginTop: 4,
                                      gap: 4,
                                    }}
                                  >
                                    <Ionicons
                                      name="alert-circle"
                                      size={14}
                                      color="#ef4444"
                                    />
                                    <Text className="text-[10px] text-red-500 font-medium">
                                      Lỗi kết nối. Thử lại
                                    </Text>
                                  </TouchableOpacity>
                                )}
      
                                {msg.editedAt && !msg.isDeletedForEveryone && (
                                  <Text className="text-[11px] text-gray-400 mt-1 italic">
                                    Đã sửa
                                  </Text>
                                )}
      
                                {/* Timestamp below message */}
                                {!isConsecutiveWithNext && (
                                  <Text className="text-[10px] text-gray-400 mt-[2px] mb-[-4px]">
                                    {new Date(msg.sentAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </Text>
                                )}
      
                                {/* Hiển thị avatar người đã xem tại tin nhắn cuối cùng họ đọc */}
                                {(() => {
                                  const readers = Object.entries(userLastReadMap)
                                    .filter(
                                      ([uid, data]) =>
                                        data.messageId === msg.id && uid !== user?.id,
                                    )
                                    .map(([uid, data]) => ({ userId: uid, ...data }));
      
                                  if (readers.length === 0) return null;
                                  return (
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        justifyContent:
                                          msg.senderId === user?.id
                                            ? "flex-end"
                                            : "flex-start",
                                        alignItems: "center",
                                        marginTop: 2,
                                        marginRight: 2,
                                        gap: 2,
                                      }}
                                    >
                                      {readers.map((r) => (
                                        <Image
                                          key={r.userId}
                                          source={{
                                            uri:
                                              normalizeSeenAvatarUrl(r.avatarUrl) ||
                                              `https://ui-avatars.com/api/?name=${encodeURIComponent(r.displayName || "User")}&background=6366f1&color=fff&size=80`,
                                          }}
                                          style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: 7,
                                            backgroundColor: "#e5e7eb",
                                            borderWidth: 1,
                                            borderColor: "#fff",
                                          }}
                                        />
                                      ))}
                                      {readers.length > 0 &&
                                        msg.senderId === user?.id &&
                                        readers.length ===
                                          (selectedChat?.participantIds?.length ||
                                            0) -
                                            1 && (
                                          <Text
                                            style={{
                                              fontSize: 9,
                                              color: "#9ca3af",
                                              marginLeft: 2,
                                            }}
                                          >
                                            Đã xem hết
                                          </Text>
                                        )}
                                    </View>
                                  );
                                })()}
      
                                {/* ── Status icon: chỉ hiện ở tin cuối mình gửi, chat 1-1, và không đang xử lý ── */}
                                {msg.senderId === user?.id &&
                                  msg.id === lastSentMsgId &&
                                  !selectedChat?.isGroup &&
                                  msg.status !== "PENDING" &&
                                  msg.status !== "FAILED" && (
                                    <View
                                      style={{
                                        flexDirection: "row",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        gap: 2,
                                        marginTop: 2,
                                      }}
                                    >
                                      {(() => {
                                        const status = msgStatusMap[msg.id] ?? "sent";
                                        // Nếu đã có avatar hiển thị tức là đã 'read', ta không cần hiện tick tím nữa cho đỡ rối
                                        const readers = Object.values(
                                          userLastReadMap,
                                        ).filter((v) => v.messageId === msg.id);
                                        if (status === "read" || readers.length > 0)
                                          return null;
      
                                        if (status === "delivered") {
                                          // Đã nhận: 2 tick xám
                                          return (
                                            <>
                                              <Ionicons
                                                name="checkmark"
                                                size={12}
                                                color="#9ca3af"
                                              />
                                              <Ionicons
                                                name="checkmark"
                                                size={12}
                                                color="#9ca3af"
                                                style={{ marginLeft: -6 }}
                                              />
                                              <Text
                                                style={{
                                                  fontSize: 10,
                                                  color: "#9ca3af",
                                                  marginLeft: 1,
                                                }}
                                              >
                                                Đã nhận
                                              </Text>
                                            </>
                                          );
                                        }
                                        // sent: 1 tick xám
                                        return (
                                          <>
                                            <Ionicons
                                              name="checkmark"
                                              size={12}
                                              color="#9ca3af"
                                            />
                                            <Text
                                              style={{
                                                fontSize: 10,
                                                color: "#9ca3af",
                                                marginLeft: 1,
                                              }}
                                            >
                                              Đã gửi
                                            </Text>
                                          </>
                                        );
                                      })()}
                                    </View>
                                  )}
                              </View>
      
                              {msg.senderId === user?.id && Platform.OS === "web" && (
                                <Image
                                  source={{
                                    uri: getSenderAvatar(msg.senderId),
                                  }}
                                  className={`w-8 h-8 rounded-full ml-2 mt-3 ${isConsecutiveWithPrev ? "opacity-0" : ""}`}
                                  resizeMode="cover"
                                />
                              )}
                            </View>
                          </View>
                          </React.Fragment>
                        );
                      });
                    })()}
    </>
  );
}
