// @ts-nocheck
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EmojiPicker from "./EmojiPicker";
import StickerPicker from "./StickerPicker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Shadows } from "@/src/styles/Shadow";
import { Message, MessageType } from "@/src/models/Message";
import { Conversation } from "@/src/models/Conversation";
import {
  mapApiConversationToModel,
  mapApiMessageToModel,
  unwrapData,
} from "@/src/models/mappers";
import { messageService as MessageService } from "@/src/api/services/message.service";
import { conversationService as ConversationService } from "@/src/api/services/conversation.service";
import { useUser } from "@/src/contexts/user/UserContext";
import { userService as UserService } from "@/src/api/services/user.service";
import { useActiveCallOptional } from "@/src/contexts/ActiveCallContext";
import SocketService from "@/src/api/socketCompat";
import ForwardMessageModal from "./ForwardMessageModal";
import VoiceRecorderSheet from "./VoiceRecorderSheet";

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { downloadSingleItem } from "@/src/utils/FileDownloadUtil";
import * as Location from "expo-location";
import { AttachmentService } from "@/src/api/attachmentCompat";
import { Attachment } from "@/src/models/Attachment";
import axios from "axios";
import FileMessageContent from "./FileMessageContent";
import MediaAlbumMessage from "./MediaAlbumMessage";
import ChatHeader from "../chat-area/ChatHeader";
import ChatNewer from "../chat-area/ChatNewer";
import AttachmentQueue, { PendingAsset } from "./AttachmentQueue";
import MessageReaction, { ReactionSummary } from "./MessageReaction";
import PollMessageContent from "./PollMessageContent";
import VoteMessageContent from "./VoteMessageContent";
import Toast from "@/src/components/ui/Toast";
import { blockSettingService } from "@/src/api/services/communication.service";
import { reminderService } from "@/src/api/services/reminder.service";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TranslatedText from "./TranslatedText";
import { useGroupChat } from "@/src/hooks/useGroupChat";
import {
  extractStickerKeyFromMessage,
  getStickerSourceByKey,
} from "./stickerAssets";
import { useTranslation } from "@/src/contexts/i18n/I18nContext";

// ── Preset nền đoạn chat (mở rộng cho 1-1 và group) ─────────────────────
type BgType = "color" | "gradient" | "image";
interface ChatBgPreset {
  id: string;
  label: string;
  type: BgType;
  /** Màu nền (color) hoặc URI ảnh */
  value: string;
  /** Màu preview cho gradient (tùy ý) */
  preview?: string;
}

export const CHAT_BACKGROUNDS: ChatBgPreset[] = [
  {
    id: "default",
    label: "Mặc định",
    type: "color",
    value: "#f9fafb",
    preview: "#f9fafb",
  },
  {
    id: "lavender",
    label: "Lavender",
    type: "color",
    value: "#ede9fe",
    preview: "#ede9fe",
  },
  {
    id: "mint",
    label: "Mint",
    type: "color",
    value: "#d1fae5",
    preview: "#d1fae5",
  },
  {
    id: "peach",
    label: "Đào",
    type: "color",
    value: "#ffedd5",
    preview: "#ffedd5",
  },
  {
    id: "rose",
    label: "Hồng phấn",
    type: "color",
    value: "#ffe4e6",
    preview: "#ffe4e6",
  },
  {
    id: "slate",
    label: "Slate",
    type: "color",
    value: "#e2e8f0",
    preview: "#e2e8f0",
  },
  {
    id: "ocean",
    label: "Ocean",
    type: "color",
    value: "#dbeafe",
    preview: "#dbeafe",
  },
  {
    id: "sunshine",
    label: "Nắng",
    type: "color",
    value: "#fef3c7",
    preview: "#fef3c7",
  },
  {
    id: "sky",
    label: "Bầu trời",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=60",
    preview: "#bfdbfe",
  },
  {
    id: "forest",
    label: "Rừng xanh",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=60",
    preview: "#6ee7b7",
  },
  {
    id: "galaxy",
    label: "Vũ trụ",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=800&q=60",
    preview: "#1e1b4b",
  },
  {
    id: "beach",
    label: "Biển xanh",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=60",
    preview: "#7dd3fc",
  },
  {
    id: "mountain",
    label: "Núi tuyết",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1464822759844-d150baec3e5d?auto=format&fit=crop&w=800&q=60",
    preview: "#cbd5e1",
  },
  {
    id: "desert",
    label: "Sa mạc",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=60",
    preview: "#fdba74",
  },
  {
    id: "rain",
    label: "Mưa đêm",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=800&q=60",
    preview: "#60a5fa",
  },
  {
    id: "city-night",
    label: "Thành phố",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=800&q=60",
    preview: "#64748b",
  },
  {
    id: "flowers",
    label: "Hoa cỏ",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=60",
    preview: "#f9a8d4",
  },
];

const BG_STORAGE_KEY = (conversationId: string) => `chat_bg_${conversationId}`;
const CHAT_HISTORY_PAGE_SIZE = 40;
const TOP_LOAD_OLDER_THRESHOLD = 40;
const BOT_AI_ID = "BotAi";
const BOT_AI_PROFILE = {
  id: BOT_AI_ID,
  name: "BotAi",
  avatarURL: "https://api.dicebear.com/7.x/bottts/png?seed=BotAi",
};

const TRAILING_URL_PUNCTUATION = /[),.;!?]+$/;

type TextChunk = {
  value: string;
  href?: string;
  isMention?: boolean;
};

function splitTextIntoChunks(
  text: string,
  memberNames: string[] = [],
): TextChunk[] {
  const input = String(text ?? "");
  if (!input) return [{ value: "" }];

  // 1. Tạo regex động từ memberNames để bắt chính xác các tên có khoảng trắng
  // Ưu tiên tên dài trước để tránh khớp substring
  const sortedNames = [...memberNames].sort((a, b) => b.length - a.length);
  const escapedNames = sortedNames.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  // Regex kết hợp URL, @all, các tên cụ thể, và fallback @[^\s]+
  const mentionPattern =
    escapedNames.length > 0
      ? `@(?:all|${escapedNames.join("|")}|[^\\s@]+)`
      : `@(?:all|[^\\s@]+)`;

  const matcher = new RegExp(
    `((?:https?://|www\\.|zala://)[^\\s]+|${mentionPattern})`,
    "gi",
  );

  const chunks: TextChunk[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(input)) !== null) {
    const matchStart = match.index;
    const rawMatch = match[0];

    if (matchStart > lastIndex) {
      chunks.push({ value: input.slice(lastIndex, matchStart) });
    }

    if (rawMatch.startsWith("@")) {
      chunks.push({
        value: rawMatch,
        isMention: true,
      });
    } else {
      const trailing = rawMatch.match(TRAILING_URL_PUNCTUATION)?.[0] ?? "";
      const cleanUrl = trailing
        ? rawMatch.slice(0, -trailing.length)
        : rawMatch;

      if (cleanUrl) {
        chunks.push({
          value: cleanUrl,
          href: /^https?:\/\//i.test(cleanUrl) || /^zala:\/\//i.test(cleanUrl)
            ? cleanUrl
            : `https://${cleanUrl}`,
        });
      }

      if (trailing) {
        chunks.push({ value: trailing });
      }
    }
    lastIndex = matcher.lastIndex;
  }

  if (lastIndex < input.length) {
    chunks.push({ value: input.slice(lastIndex) });
  }

  return chunks.length > 0 ? chunks : [{ value: input }];
}

const getPinnedPreview = (msg: Message) => {
  if (msg.type === MessageType.TEXT) return msg.content;
  if (msg.type === MessageType.VOTE) {
    return msg.metadata?.question
      ? `Bình chọn: ${msg.metadata.question}`
      : "Bình chọn";
  }
  if (msg.type === MessageType.IMAGE) return "[Hình ảnh]";
  if (msg.type === MessageType.MEDIA_ALBUM) return "[Album]";
  if (msg.type === MessageType.VIDEO) return "[Video]";
  if (msg.type === MessageType.FILE)
    return `[Tệp tin] ${msg.metadata?.fileName || ""}`.trim();
  if (msg.type === MessageType.SYSTEM) return msg.content;
  return "[Tin nhắn]";
};

export interface ChatAreaProps {
  selectedChat: Conversation | null;
  onBackPress?: () => void;
  onInfoPress?: () => void;
  onConversationMetaChanged?: () => void;
  /** Bị kick / tự rời nhóm — đóng chat (cùng handler với onDeleteChat ở parent) */
  onRemovedFromConversation?: (conversationId: string) => void;
  /** Tăng từ parent sau khi xóa lịch sử — refetch tin trong khung chat */
  messagesRefreshKey?: number;
  openScheduleRef?: React.MutableRefObject<(() => void) | null>;
  openNicknameRef?: React.MutableRefObject<(() => void) | null>;
  initialScrollMessageId?: string;
  onInitialScrollDone?: () => void;
}

async function readBufferFromAsset(
  fileAsset: DocumentPicker.DocumentPickerAsset,
): Promise<ArrayBuffer> {
  if (Platform.OS === "web") {
    const response = await fetch(fileAsset.uri);
    const blob = await response.blob();
    return await blob.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(fileAsset.uri, {
    encoding: "base64",
  });
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function normalizeSeenText(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (lower === "null" || lower === "undefined") return "";
  return normalized;
}

function normalizeSeenAvatarUrl(value: unknown): string {
  const normalized = normalizeSeenText(value);
  if (!normalized) return "";
  if (/^(https?:\/\/|data:|blob:|\/)/i.test(normalized)) return normalized;
  return "";
}

export default function ChatArea({
  selectedChat,
  onBackPress,
  onInfoPress,
  onConversationMetaChanged,
  onRemovedFromConversation,
  messagesRefreshKey,
  openScheduleRef,
  openNicknameRef,
  initialScrollMessageId,
  onInitialScrollDone,
}: ChatAreaProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const mobileBottomSafeOffset =
    Platform.OS === "web" ? 0 : Math.max(insets.bottom + 6, 12);
  const mobileMessageMaxWidth = Math.min(420, Math.floor(viewportWidth * 0.82));
  const webMessageMaxWidth = Math.min(620, Math.floor(viewportWidth * 0.68));
  /** Đẩy toàn bộ màn chat (kể cả thanh nhập) lên khi bàn phím hệ thống mở — tránh phụ thuộc KAV trong cây layout Expo. */
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e) => {
      const h = e?.endCoordinates?.height;
      setKeyboardInset(typeof h === "number" && h > 0 ? h : 0);
    };
    const onHide = () => setKeyboardInset(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);
  const { user } = useUser();
  const activeCallCtx = useActiveCallOptional();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagePage, setMessagePage] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [showLoadOlderButton, setShowLoadOlderButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingBotAi, setIsWaitingBotAi] = useState(false);
  const [showEnableAiModal, setShowEnableAiModal] = useState(false);
  const [pendingAiMessage, setPendingAiMessage] = useState("");
  const [enablingAi, setEnablingAi] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "warning" | "info">("warning");
  const [toastDuration, setToastDuration] = useState(2000);
  const [policyWarning, setPolicyWarning] = useState<string | null>(null);
  const [isNewer, setIsNewer] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [isModelChecked, setIsModelChecked] = useState(false);
  const [isModelImage, setIsModelImage] = useState(false);
  const [isModelEmoji, setIsModelEmoji] = useState(false);
  const [isModelSticker, setIsModelSticker] = useState(false);
  const [isModelGift, setIsModelGift] = useState(false);

  // ── GIPHY inline suggestions ──
  const [showGiphyInline, setShowGiphyInline] = useState(false);
  const [giphyInlineResults, setGiphyInlineResults] = useState<{id:string;preview:string;original:string}[]>([]);
  const [giphyInlineLoading, setGiphyInlineLoading] = useState(false);
  const GIPHY_KEY = "pWQXUVmyIAkQDvRczFcT2t3kPzjncYiO";

  const searchGiphyInline = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setGiphyInlineLoading(true);
    setShowGiphyInline(true);
    try {
      const url = `https://api.giphy.com/v1/stickers/search?q=${encodeURIComponent(q)}&api_key=${GIPHY_KEY}&limit=12&offset=0&rating=g&lang=en`;
      const data = await fetch(url).then(r => r.json());
      const items = Array.isArray(data?.data) ? data.data.map((item: any) => {
        const media = item?.images || {};
        const preview = media?.fixed_height_small?.url || media?.fixed_height?.url || media?.original?.url || "";
        const original = media?.original?.url || preview;
        if (!preview || !original) return null;
        return { id: String(item?.id || ""), preview, original };
      }).filter(Boolean) : [];
      setGiphyInlineResults(items);
    } catch {
      setGiphyInlineResults([]);
    } finally {
      setGiphyInlineLoading(false);
    }
  }, []);
  const scaleAnimation = useRef(new Animated.Value(0)).current;
  const socketService = useRef(SocketService.getInstance()).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const preserveScrollOffsetRef = useRef<number | null>(null);
  const prevMessagesLengthRef = useRef(0);
  /** Phân biệt đổi hội thoại vs chỉ refetch (user hydrate, v.v.) — tránh full-screen Loading */
  const prevJoinedConvIdRef = useRef<string | null>(null);
  const [inputHeight, setInputHeight] = useState(28);
  const [messageUsers, setMessageUsers] = useState<{ [key: string]: any }>({
    [BOT_AI_ID]: BOT_AI_PROFILE,
  });
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [participantReadStatus, setParticipantReadStatus] = useState<
    Record<string, string>
  >({});

  const filteredMembers = useMemo(() => {
    if (
      !showMentionSuggestions ||
      !selectedChat?.participantInfo ||
      !selectedChat?.isGroup
    )
      return [];

    // Luôn có @all ở đầu
    const allOption = { id: "all", name: "Tất cả mọi người", type: "all" };

    const query = (mentionQuery || "").toLowerCase();
    const members = selectedChat.participantInfo
      .filter((p) => p.id !== user?.id) // không nhắc chính mình
      .map((p) => {
        const userInfo = messageUsers[p.id];
        const name =
          p.nickname ||
          p.name ||
          userInfo?.name ||
          userInfo?.displayName ||
          "Người dùng";
        const avatar = p.avatar || userInfo?.avatarURL || userInfo?.avatarUrl;
        return { ...p, name, avatar, type: "user" };
      })
      .filter((p) => p.name.toLowerCase().includes(query))
      .slice(0, 5); // giới hạn 5 người theo yêu cầu

    return query === "" || "all".includes(query)
      ? [allOption, ...members]
      : members;
  }, [
    showMentionSuggestions,
    mentionQuery,
    selectedChat?.participantInfo,
    selectedChat?.isGroup,
    user?.id,
    messageUsers,
  ]);

  const handleTextChange = (text: string) => {
    setNewMessage(text);

    // Mention chỉ hoạt động trong group chat
    if (!selectedChat?.isGroup) {
      setShowMentionSuggestions(false);
      return;
    }

    // Logic tìm dấu @ gần nhất trước con trỏ
    const lastAtPos = text.lastIndexOf("@", cursorPosition);
    if (lastAtPos !== -1) {
      const textAfterAt = text.slice(lastAtPos + 1, cursorPosition);
      // Nếu không có dấu cách giữa @ và con trỏ -> đang gõ mention
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt);
        setShowMentionSuggestions(true);
        setMentionSelectedIndex(0); // Reset index khi gõ từ khóa mới
        return;
      }
    }
    setShowMentionSuggestions(false);
  };

  const onSelectMention = (item: any) => {
    const lastAtPos = newMessage.lastIndexOf("@", cursorPosition);
    if (lastAtPos !== -1) {
      const mentionText =
        item.id === "all" ? "all " : `${item.nickname || item.name} `;
      const before = newMessage.slice(0, lastAtPos + 1);
      const after = newMessage.slice(cursorPosition);
      setNewMessage(before + mentionText + after);
    }
    setShowMentionSuggestions(false);
  };
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [deleteMode, setDeleteMode] = useState<"me" | "everyone" | null>(null);
  const [showPinLimitModal, setShowPinLimitModal] = useState(false);
  const [pendingPinMessage, setPendingPinMessage] = useState<Message | null>(
    null,
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [messageToEdit, setMessageToEdit] = useState<Message | null>(null);
  const recalledContentCacheRef = useRef<Record<string, string>>({});
  const [editContent, setEditContent] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showAppointmentEditModal, setShowAppointmentEditModal] =
    useState(false);
  const [appointmentTargetMessage, setAppointmentTargetMessage] =
    useState<Message | null>(null);
  const [appointmentEditTitle, setAppointmentEditTitle] = useState("");
  const [appointmentEditDate, setAppointmentEditDate] = useState("");
  const [appointmentEditTime, setAppointmentEditTime] = useState("");
  const [forwardTargets, setForwardTargets] = useState<Message[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const lastTypingEmitRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<{
    name: string;
    avatar: string;
    isOnline: boolean;
  } | null>(null);
  // Lưu userId của người kia để filter presence update
  const otherUserIdRef = useRef<string | null>(null);

  // ── Trạng thái tin nhắn: sent / delivered / read ─────────────
  type MsgStatus = "sent" | "delivered" | "read";
  const [msgStatusMap, setMsgStatusMap] = useState<Record<string, MsgStatus>>(
    {},
  );

  // ── Avatar người đã xem — key = userId, value = { messageId, avatarUrl, displayName } ──
  const [userLastReadMap, setUserLastReadMap] = useState<
    Record<
      string,
      { messageId: string; avatarUrl: string; displayName: string }
    >
  >({});

  const upgradeMsgStatus = useCallback(
    (messageId: string, newStatus: MsgStatus) => {
      setMsgStatusMap((prev) => {
        const cur = prev[messageId];
        const rank: Record<MsgStatus, number> = {
          sent: 0,
          delivered: 1,
          read: 2,
        };
        if (cur && rank[cur] >= rank[newStatus]) return prev;
        return { ...prev, [messageId]: newStatus };
      });
    },
    [],
  );

  // Thêm vào danh sách state trong ChatArea
  const [fileUploading, setFileUploading] = useState(false);
  const [attachments, setAttachments] = useState<{ [key: string]: Attachment }>(
    {},
  );
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [peerMessageBlockedMe, setPeerMessageBlockedMe] = useState(false);
  const [peerCallBlockedMe, setPeerCallBlockedMe] = useState(false);
  // ── Wallpaper ──────────────────────────────────────────────────────────────
  const [chatBgId, setChatBgId] = useState<string>("default");
  const [showBgPicker, setShowBgPicker] = useState(false);
  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedMessageIds.includes(m.id)),
    [messages, selectedMessageIds],
  );
  const canMultiDeleteForMe = selectedMessages.length > 0;
  const canMultiForward = selectedMessages.length > 0;
  const canMultiRecall =
    selectedMessages.length > 0 &&
    selectedMessages.every(
      (m) => m.senderId === user?.id && !m.isDeletedForEveryone,
    );

  const sanitizeMessages = useCallback((rows: unknown[]): Message[] => {
    return rows.filter((row): row is Message => {
      if (!row || typeof row !== "object") return false;
      const candidate = row as Partial<Message>;
      return typeof candidate.id === "string" && candidate.id.length > 0;
    });
  }, []);

  // Add these to your state variables at the top of the component
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMessage, setUploadStatusMessage] = useState(
    "Preparing to upload...",
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showVoiceSheet, setShowVoiceSheet] = useState(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(
    Array.from({ length: 20 }, () => 6),
  );
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceWaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actorDisplayName =
    String((user as any)?.name ?? "Người dùng").trim() || "Người dùng";

  const isPolicyViolationPayload = (payload: any): boolean => {
    const code = String(payload?.code || "").toUpperCase();
    const reasonCode = String(payload?.reasonCode || "").toUpperCase();
    const message = String(payload?.message || "").toLowerCase();
    return (
      code === "CONTENT_POLICY_VIOLATION" ||
      reasonCode.includes("VIOLATION") ||
      reasonCode === "SCAN_ERROR" ||
      message.includes("vi pham")
    );
  };

  const getViolationDetail = (payload: any): string => {
    const reasonCode = String(payload?.reasonCode || "").toUpperCase();
    const labels = Array.isArray(payload?.labels)
      ? payload.labels.map((x: unknown) => String(x).toUpperCase())
      : [];
    const violations = Array.isArray(payload?.violations) ? payload.violations : [];
    const backendCount = Number(payload?.violationCount || 0);
    const merged = [reasonCode, ...labels];
    const reasons: string[] = [];
    if (merged.some((x) => x.includes("NSFW"))) reasons.push("nội dung nhạy cảm (18+)");
    if (merged.some((x) => x.includes("REGIONAL_DISCRIMINATION"))) reasons.push("phân biệt vùng miền");
    if (merged.some((x) => x.includes("POLITICAL_EXTREMISM"))) reasons.push("nội dung chính trị bị cấm");
    if (merged.some((x) => x.includes("HATE_OR_ABUSE"))) reasons.push("ngôn từ thù ghét/xúc phạm");
    if (merged.some((x) => x.includes("PROFANITY"))) reasons.push("ngôn từ tục tĩu/chửi thề");
    if (merged.some((x) => x.includes("SUSPICIOUS"))) reasons.push("tệp có định dạng không an toàn");
    if (reasons.length > 0) {
      const smartCount =
        backendCount > 0
          ? backendCount
          : violations.reduce((sum: number, item: any) => sum + Number(item?.count || 0), 0);
      return `Vi phạm: ${reasons.join(", ")}.${smartCount > 0 ? ` Phát hiện ${smartCount} dấu hiệu.` : ""}`;
    }
    return String(payload?.message || "Vi phạm chính sách nội dung.");
  };

  // ── Group chat hook (tách logic group ra file riêng) ──────────────────────
  const groupChat = useGroupChat(selectedChat, user as any);

  /** Lấy tên hiển thị của sender (ưu tiên biệt danh group → tên thật) */
  const getSenderName = useCallback(
    (senderId: string) => {
      // 1-1: giữ logic cũ theo sender thật (không ép "Bạn/Đối phương")
      if (!selectedChat?.isGroup) {
        const currentUserId = String(user?.id ?? "");
        const isSelf = currentUserId && String(senderId) === currentUserId;
        if (isSelf) {
          const selfName = String(
            (user as any)?.name ??
              (user as any)?.displayName ??
              selectedChat?.participantInfo?.find((p) => p.id === currentUserId)?.nickname ??
              selectedChat?.participantInfo?.find((p) => p.id === currentUserId)?.name ??
              "",
          ).trim();
          return selfName || "Bạn";
        }
        const peerName = String(
          selectedChat?.participantInfo?.find((p) => p.id === senderId)?.nickname ??
            selectedChat?.participantInfo?.find((p) => p.id === senderId)?.name ??
            selectedChat?.participantInfo?.find((p) => p.id === senderId)?.displayName ??
            messageUsers[senderId]?.name ??
            messageUsers[senderId]?.displayName ??
            otherParticipant?.name ??
            "",
        ).trim();
        return peerName || "Đối phương";
      }

      // 1. Ưu tiên participantInfo của conversation hiện tại
      if (selectedChat?.participantInfo) {
        const p = selectedChat.participantInfo.find((x) => x.id === senderId);
        if (p?.nickname?.trim()) return p.nickname.trim();
        if (p?.name?.trim()) return p.name.trim();
      }
      // 2. Sau đó lấy từ cache user info đã fetch
      const cachedName = String(
        messageUsers[senderId]?.name ?? messageUsers[senderId]?.displayName ?? "",
      ).trim();
      if (cachedName) return cachedName;

      // 3. Cuối cùng mới dùng map từ hook (tránh fallback "Thành viên" lấn át tên thật)
      const groupDisplay = String(
        groupChat.memberDisplayNames[senderId] ?? "",
      ).trim();
      if (groupDisplay && groupDisplay !== "Thành viên") return groupDisplay;

      return "Người dùng";
    },
    [
      groupChat.isGroup,
      groupChat.memberDisplayNames,
      selectedChat?.participantInfo,
      selectedChat?.isGroup,
      user?.id,
      user?.name,
      (user as any)?.displayName,
      otherParticipant?.name,
      messageUsers,
    ],
  );
  const getSenderAvatar = useCallback(
    (senderId: string) => {
      const currentUserId = String(user?.id ?? "");
      const isSelf = currentUserId && String(senderId) === currentUserId;
      if (isSelf) {
        const selfAvatar = String(
          (user as any)?.avatarURL ??
            (user as any)?.avatarUrl ??
            (user as any)?.avatar ??
            "",
        ).trim();
        if (selfAvatar) return selfAvatar;
      }

      if (!selectedChat?.isGroup && otherParticipant?.avatar && !isSelf) {
        const peerAvatar = String(otherParticipant.avatar).trim();
        if (peerAvatar) return peerAvatar;
      }

      const fromParticipant = selectedChat?.participantInfo?.find(
        (p) => p.id === senderId,
      )?.avatar;
      const fromCache =
        messageUsers[senderId]?.avatarURL ??
        messageUsers[senderId]?.avatarUrl ??
        messageUsers[senderId]?.avatar;
      const resolved = String(fromParticipant ?? fromCache ?? "").trim();
      if (resolved) return resolved;
      const nameForFallback = getSenderName(senderId);
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(
        nameForFallback || "User",
      )}&background=0068FF&color=fff`;
    },
    [
      user?.id,
      (user as any)?.avatarURL,
      (user as any)?.avatarUrl,
      (user as any)?.avatar,
      selectedChat?.isGroup,
      selectedChat?.participantInfo,
      otherParticipant?.avatar,
      messageUsers,
      getSenderName,
    ],
  );

  const peerDisplayName = useMemo(() => {
    if (!selectedChat || !user?.id) return "đối phương";
    const peerFromConversation = selectedChat.participantInfo?.find(
      (p) => p.id !== user.id,
    )?.name;
    const peerFromFetched = otherParticipant?.name;
    return (
      String(peerFromConversation ?? peerFromFetched ?? "đối phương").trim() ||
      "đối phương"
    );
  }, [selectedChat, user?.id, otherParticipant?.name]);
  const getSenderDisplayLabel = useCallback(
    (senderId: string) => {
      return getSenderName(senderId);
    },
    [getSenderName],
  );

  // ── Attachment queue (Zalo-style staging) ─────────────────────────────────
  const [pendingAttachments, setPendingAttachments] = useState<PendingAsset[]>(
    [],
  );

  useEffect(() => {
    setTypingUsers({});
  }, [selectedChat?.id, (selectedChat as any)?.chatBackgroundId, (selectedChat as any)?.backgroundId]);

  // Đồng bộ nhanh tên/avatar từ participantInfo để tránh hiển thị fallback "Thành viên"
  useEffect(() => {
    if (!selectedChat?.participantInfo?.length) return;
    setMessageUsers((prev) => {
      const next = { ...prev };
      for (const p of selectedChat.participantInfo ?? []) {
        if (!p?.id) continue;
        const name = String(p.nickname ?? p.name ?? "").trim();
        if (!name && next[p.id]?.name) continue;
        next[p.id] = {
          ...(next[p.id] || {}),
          id: p.id,
          name: name || next[p.id]?.name || "Người dùng",
          avatarURL: p.avatar || next[p.id]?.avatarURL || "",
          displayName: name || next[p.id]?.displayName || "Người dùng",
        };
      }
      return next;
    });
  }, [selectedChat?.id, selectedChat?.participantInfo]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        for (const uid in next) {
          if (now - next[uid] > 4000) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedChat?.id) return;

    if (newMessage.trim().length === 0) {
      socketService.sendTyping(selectedChat.id, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      lastTypingEmitRef.current = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2500) {
      socketService.sendTyping(selectedChat.id, true);
      lastTypingEmitRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.sendTyping(selectedChat.id, false);
      lastTypingEmitRef.current = 0;
    }, 4000);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [newMessage, selectedChat?.id, socketService]);

  // ── Real-time: nhận lời mời vào nhóm (như Zalo) ───────────────────────────
  useEffect(() => {
    const handleInviteReceived = (data: {
      inviteId: string;
      groupName: string;
      inviterName: string;
      conversationId: string;
    }) => {
      Alert.alert(
        "📩 Lời mời tham gia nhóm",
        `${data.inviterName} mời bạn vào nhóm "${data.groupName}"`,
        [
          {
            text: "Từ chối",
            style: "destructive",
            onPress: () => {
              import("@/src/api/services/conversation.service")
                .then(({ conversationService }) =>
                  conversationService.declineGroupInvite(data.inviteId),
                )
                .catch(() => {});
            },
          },
          {
            text: "Tham gia",
            style: "default",
            onPress: () => {
              import("@/src/api/services/conversation.service")
                .then(({ conversationService }) =>
                  conversationService.acceptGroupInvite(data.inviteId),
                )
                .then((res) => {
                  if (res?.success) {
                    if (res.pendingAdminApproval) {
                      Alert.alert(
                        "Đã gửi yêu cầu",
                        `Nhóm "${data.groupName}" đang bật phê duyệt. Bạn sẽ được thêm khi quản trị viên duyệt.`,
                      );
                    } else {
                      Alert.alert(
                        "✅ Đã tham gia!",
                        `Bạn đã vào nhóm "${data.groupName}" thành công.`,
                      );
                    }
                  }
                })
                .catch(() => Alert.alert("Lỗi", "Không thể tham gia nhóm."));
            },
          },
        ],
        { cancelable: false },
      );
    };
    socketService.onGroupInviteReceived(handleInviteReceived);
    return () => {
      socketService.removeGroupInviteReceivedListener(handleInviteReceived);
    };
  }, [socketService]);

  const sendSystemNotice = useCallback(
    async (content: string) => {
      if (!selectedChat?.id || !user?.id) return;
      try {
        await MessageService.send({
          conversationId: selectedChat.id,
          senderId: user.id,
          content,
          type: "SYSTEM",
        });
      } catch (err) {
        console.error("sendSystemNotice:", err);
      }
    },
    [selectedChat?.id, user?.id],
  );

  // ── Chọn file → thêm vào hàng chờ (không upload ngay) ──────────────────
  const handleSelectFile = async () => {
    if (peerMessageBlockedMe) {
      setError("Bạn đang bị chặn nhắn tin trong cuộc trò chuyện này.");
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;
      const assets = result.assets;
      if (assets.length === 0) return;

      const oversized = assets.filter((a) => (a.size || 0) > 5 * 1024 * 1024);
      if (oversized.length > 0) {
        if (Platform.OS === "web")
          window.alert("bạn k được gửi file quá 5mb nha");
        else alert("bạn k được gửi file quá 5mb nha");
        return;
      }

      // Tạo previewUri cho ảnh trên web (blob URL)
      const enriched: PendingAsset[] = await Promise.all(
        assets.map(async (a) => {
          let previewUri = a.uri;
          if (
            Platform.OS === "web" &&
            a.mimeType?.startsWith("image/") &&
            a.file
          ) {
            try {
              previewUri = URL.createObjectURL(a.file as Blob);
            } catch {}
          }
          return { ...a, previewUri };
        }),
      );

      // Nếu đã có queue: gộp thêm. Nếu chưa: khởi tạo mới.
      setPendingAttachments((prev) => [...prev, ...enriched]);
      // Đóng popup chọn loại
      if (isModelChecked) toggleModelChecked();
    } catch (error) {
      console.error("Error picking document:", error);
      setError("Không thể chọn file. Vui lòng thử lại.");
    }
  };

  /** Xoá một item khỏi hàng chờ */
  const handleRemovePending = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const clearVoiceTimer = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  };

  const clearVoiceWaveTimer = () => {
    if (voiceWaveTimerRef.current) {
      clearInterval(voiceWaveTimerRef.current);
      voiceWaveTimerRef.current = null;
    }
  };

  const sendLocationMessage = (latitude: number, longitude: number) => {
    if (!selectedChat?.id || !user?.id) return;
    const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    const locationMessage: Message = {
      id: new Date().getTime().toString(),
      conversationId: selectedChat.id,
      senderId: user.id,
      content: `Vi tri hien tai: ${mapUrl}`,
      type: MessageType.TEXT,
      readBy: [],
      sentAt: new Date().toISOString(),
      metadata: {
        kind: "location",
        latitude,
        longitude,
        mapUrl,
      },
    };
    socketService.sendMessage(locationMessage);
  };

  const requestAndSendCurrentLocation = async () => {
    if (peerMessageBlockedMe) {
      setError("Bạn đang bị chặn nhắn tin trong cuộc trò chuyện này.");
      return;
    }
    if (isFetchingLocation) return;
    setIsFetchingLocation(true);
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          setError("Web chỉ cho lấy vị trí trên HTTPS hoặc localhost.");
          return;
        }
        if (!navigator?.geolocation) {
          setError("Thiết bị không hỗ trợ lấy vị trí.");
          return;
        }
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 30000,
            });
          },
        );
        sendLocationMessage(
          position.coords.latitude,
          position.coords.longitude,
        );
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        if (permission.canAskAgain === false) {
          Alert.alert(
            "Cần quyền vị trí",
            "Bạn đã chặn quyền vị trí. Vui lòng bật lại trong Cài đặt.",
            [
              { text: "Hủy", style: "cancel" },
              {
                text: "Mở cài đặt",
                onPress: () => {
                  Linking.openSettings().catch(() => {});
                },
              },
            ],
          );
        } else {
          setError("Bạn chưa cấp quyền vị trí.");
        }
        return;
      }

      if (Platform.OS === "android") {
        await Location.enableNetworkProviderAsync().catch(() => {});
      }

      const quick = await Location.getLastKnownPositionAsync({});
      const position =
        quick ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));

      if (!position?.coords) {
        setError("Không lấy được vị trí từ thiết bị. Hãy bật GPS và thử lại.");
        return;
      }

      sendLocationMessage(position.coords.latitude, position.coords.longitude);
    } catch (err: any) {
      if (Platform.OS === "web") {
        const code = Number(err?.code ?? 0);
        if (code === 1) {
          setError("Bạn đã từ chối quyền vị trí trên trình duyệt.");
        } else if (code === 2) {
          setError(
            "Không xác định được vị trí. Kiểm tra mạng hoặc dịch vụ vị trí.",
          );
        } else if (code === 3) {
          setError("Hết thời gian lấy vị trí. Vui lòng thử lại.");
        } else {
          setError(
            "Không thể lấy vị trí trên web. Hãy kiểm tra quyền vị trí của trình duyệt.",
          );
        }
      } else {
        setError("Không thể lấy vị trí. Vui lòng bật GPS và thử lại.");
      }
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleShareLocation = () => {
    if (Platform.OS === "web") {
      const ok =
        typeof window === "undefined"
          ? true
          : window.confirm(
              "Bạn có muốn cấp quyền và gửi vị trí hiện tại không?",
            );
      if (ok) {
        void requestAndSendCurrentLocation();
      }
      return;
    }
    Alert.alert(
      "Chia sẻ vị trí",
      "Bạn có muốn cấp quyền và gửi vị trí hiện tại không?",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Đồng ý", onPress: requestAndSendCurrentLocation },
      ],
    );
  };

  const formatAppointmentTime = (iso: string) => {
    const dt = new Date(iso);
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    const mo = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${hh}:${mm} ${dd}/${mo}/${yy}`;
  };

  /** Cùng logic với chattemp — thanh ngày giữa các tin (Hôm nay / Hôm qua / …) */
  const isSameDayChat = (a: string | Date, b: string | Date) => {
    const d1 = new Date(a);
    const d2 = new Date(b);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };
  const getChatDateSeparatorLabel = (dateStr: string | Date) => {
    const dt = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (isSameDayChat(dt, now)) return "Hôm nay";
    if (isSameDayChat(dt, yesterday)) return "Hôm qua";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${dd} tháng ${mm}, ${yy}`;
  };

  const parseAppointmentDateTimeInput = (
    dateInput: string,
    timeInput: string,
  ): string | null => {
    const mDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateInput.trim());
    const mTime = /^(\d{2}):(\d{2})$/.exec(timeInput.trim());
    if (!mDate || !mTime) return null;
    const dt = new Date(
      Number(mDate[3]),
      Number(mDate[2]) - 1,
      Number(mDate[1]),
      Number(mTime[1]),
      Number(mTime[2]),
      0,
      0,
    );
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const getAppointmentContext = (msg?: Message | null) => {
    const ctx =
      (msg?.storyContext as {
        kind?: string;
        title?: string;
        remindAt?: string;
        myReminderId?: string;
        peerReminderId?: string;
      } | null) ?? null;
    if (!ctx || ctx.kind !== "appointment") return null;
    return ctx;
  };

  const createAppointment = async (payload: {
    title: string;
    remindAtIso: string;
  }) => {
    if (!selectedChat?.id || !user?.id) {
      setError("Không thể tạo lịch hẹn.");
      return;
    }
    const otherIds = selectedChat.participantIds.filter((id) => id !== user.id);
    const title = payload.title.trim();
    if (!title) {
      setError("Tiêu đề lịch hẹn không hợp lệ.");
      return;
    }
    try {
      // Tạo reminder cho mình
      const myReminderRes: any = await reminderService.create({
        conversationId: selectedChat.id,
        userId: user.id,
        title,
        remindAt: payload.remindAtIso,
      });
      const myReminderData = unwrapData<any>(myReminderRes);
      // Tạo reminder cho tất cả thành viên khác (1-1: 1 người, group: N người)
      const peerReminderIds: string[] = [];
      for (const pid of otherIds) {
        try {
          const res: any = await reminderService.create({
            conversationId: selectedChat.id,
            userId: pid,
            title,
            remindAt: payload.remindAtIso,
          });
          const data = unwrapData<any>(res);
          if (data?._id || data?.id) peerReminderIds.push(data._id ?? data.id);
        } catch {}
      }

      const targetName = selectedChat.isGroup
        ? selectedChat.name
        : peerDisplayName;
      const content = `Lịch hẹn: ${title}\nThời gian: ${formatAppointmentTime(payload.remindAtIso)}`;
      const created: any = await MessageService.send({
        conversationId: selectedChat.id,
        senderId: user.id,
        content,
        type: "TEXT",
        storyContext: {
          kind: "appointment",
          title,
          remindAt: payload.remindAtIso,
          creatorId: user.id,
          myReminderId: myReminderData?._id ?? myReminderData?.id,
          peerReminderId: peerReminderIds[0] ?? null,
        },
      });
      const createdMessage = mapApiMessageToModel(unwrapData<any>(created));
      if (createdMessage?.id) {
        await MessageService.pin(createdMessage.id);
        setMessages((prev) =>
          prev.some((m) => m.id === createdMessage.id)
            ? prev
            : [...prev, createdMessage],
        );
        void refreshPinnedMessages();
      }
      await sendSystemNotice(
        selectedChat.isGroup
          ? `${actorDisplayName} đã tạo lịch hẹn "${title}" trong nhóm vào ${formatAppointmentTime(payload.remindAtIso)}.`
          : `${actorDisplayName} đã tạo lịch hẹn "${title}" với ${peerDisplayName} vào ${formatAppointmentTime(payload.remindAtIso)}.`,
      );
      onConversationMetaChanged?.();
      setError(null);
    } catch (err: any) {
      console.error("createAppointment:", err);
      setError("Không thể tạo lịch hẹn. Vui lòng thử lại.");
      throw err;
    }
  };

  const updateAppointmentFromMessage = async (
    msg: Message,
    title: string,
    remindAtIso: string,
  ) => {
    if (!selectedChat?.id || !user?.id) return;
    const oldCtx = getAppointmentContext(msg);
    const peerId = selectedChat.participantIds.find((id) => id !== user.id);
    try {
      if (oldCtx?.myReminderId) {
        await reminderService.update(oldCtx.myReminderId, {
          title,
          remindAt: remindAtIso,
        });
      } else {
        await reminderService.create({
          conversationId: selectedChat.id,
          userId: user.id,
          title,
          remindAt: remindAtIso,
        });
      }
      if (oldCtx?.peerReminderId) {
        await reminderService.update(oldCtx.peerReminderId, {
          title,
          remindAt: remindAtIso,
        });
      } else if (peerId) {
        await reminderService.create({
          conversationId: selectedChat.id,
          userId: peerId,
          title,
          remindAt: remindAtIso,
        });
      }

      const content = `Lịch hẹn: ${title}\nThời gian: ${formatAppointmentTime(remindAtIso)}`;
      const created: any = await MessageService.send({
        conversationId: selectedChat.id,
        senderId: user.id,
        content,
        type: "TEXT",
        storyContext: {
          kind: "appointment",
          title,
          remindAt: remindAtIso,
          creatorId: user.id,
          myReminderId: oldCtx?.myReminderId,
          peerReminderId: oldCtx?.peerReminderId,
        },
      });
      const createdMessage = mapApiMessageToModel(unwrapData<any>(created));
      if (createdMessage?.id) {
        await MessageService.pin(createdMessage.id);
      }
      if (msg.pinned) {
        await MessageService.unpin(msg.id).catch(() => {});
      }
      await sendSystemNotice(
        `${actorDisplayName} đã cập nhật lịch hẹn với ${peerDisplayName} thành "${title}" vào ${formatAppointmentTime(remindAtIso)}.`,
      );
      void refreshPinnedMessages();
      setShowMessageOptions(false);
    } catch (err) {
      console.error("updateAppointmentFromMessage:", err);
      setError("Không thể đổi lịch hẹn.");
    }
  };

  const cancelAppointmentFromMessage = async (msg: Message) => {
    const ctx = getAppointmentContext(msg);
    if (!ctx) return;
    try {
      if (ctx.myReminderId) {
        await reminderService.delete(ctx.myReminderId).catch(() => {});
      }
      if (ctx.peerReminderId) {
        await reminderService.delete(ctx.peerReminderId).catch(() => {});
      }
      if (msg.pinned) {
        await MessageService.unpin(msg.id).catch(() => {});
      }
      await sendSystemNotice(
        `${actorDisplayName} đã hủy lịch hẹn "${ctx.title || "không tên"}" với ${peerDisplayName}.`,
      );
      void refreshPinnedMessages();
      setShowMessageOptions(false);
    } catch (err) {
      console.error("cancelAppointmentFromMessage:", err);
      setError("Không thể hủy lịch hẹn.");
    }
  };

  const openAppointmentEditModal = (msg: Message) => {
    const ctx = getAppointmentContext(msg);
    if (!ctx) return;
    setAppointmentTargetMessage(msg);
    setAppointmentEditTitle(String(ctx.title ?? "").trim());
    if (ctx.remindAt) {
      const dt = new Date(ctx.remindAt);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yy = dt.getFullYear();
      const hh = String(dt.getHours()).padStart(2, "0");
      const mi = String(dt.getMinutes()).padStart(2, "0");
      setAppointmentEditDate(`${dd}/${mm}/${yy}`);
      setAppointmentEditTime(`${hh}:${mi}`);
    } else {
      setAppointmentEditDate("");
      setAppointmentEditTime("");
    }
    setShowAppointmentEditModal(true);
  };

  const handleCreateAppointmentQuick = () => {
    if (!selectedChat?.id || !user?.id) {
      setError("Vui lòng chọn cuộc trò chuyện.");
      return;
    }
    if (Platform.OS === "web") {
      const title = window.prompt("Tiêu đề lịch hẹn:");
      if (!title?.trim()) return;
      const date = window.prompt("Nhập ngày (DD/MM/YYYY):");
      const time = window.prompt("Nhập giờ (HH:mm):");
      if (!date || !time) return;
      const mDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
      const mTime = /^(\d{2}):(\d{2})$/.exec(time.trim());
      if (!mDate || !mTime) {
        setError("Sai định dạng ngày/giờ.");
        return;
      }
      const iso = new Date(
        Number(mDate[3]),
        Number(mDate[2]) - 1,
        Number(mDate[1]),
        Number(mTime[1]),
        Number(mTime[2]),
        0,
        0,
      ).toISOString();
      void createAppointment({ title: title.trim(), remindAtIso: iso });
      return;
    }
    Alert.alert(
      "Tạo lịch hẹn",
      "Dùng nút lịch ở header để nhập thời gian chi tiết.",
      [{ text: "OK" }],
    );
  };

  const startVoiceTimer = () => {
    clearVoiceTimer();
    setVoiceRecordingSeconds(0);
    voiceTimerRef.current = setInterval(() => {
      setVoiceRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  useEffect(() => {
    if (!isRecordingVoice) {
      clearVoiceWaveTimer();
      setRecordingWaveform(Array.from({ length: 20 }, () => 6));
      return;
    }
    clearVoiceWaveTimer();
    voiceWaveTimerRef.current = setInterval(() => {
      setRecordingWaveform((prev) =>
        prev.map((_, idx) => {
          const base = 6 + ((idx * 3) % 5);
          const rand = Math.floor(Math.random() * 12);
          return Math.min(22, base + rand);
        }),
      );
    }, 140);
    return () => clearVoiceWaveTimer();
  }, [isRecordingVoice]);

  const startVoiceRecording = async () => {
    if (peerMessageBlockedMe) {
      setError("Bạn đang bị chặn nhắn tin trong cuộc trò chuyện này.");
      return;
    }
    try {
      if (Platform.OS === "web") {
        const mediaDevices = navigator?.mediaDevices;
        if (!mediaDevices?.getUserMedia) {
          setError("Trình duyệt không hỗ trợ ghi âm.");
          return;
        }
        const stream = await mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        voiceChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            voiceChunksRef.current.push(event.data);
          }
        };
        recorder.start();
        startVoiceTimer();
        setIsRecordingVoice(true);
        return;
      }

      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Bạn chưa cấp quyền microphone.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      await recording.startAsync();
      voiceRecordingRef.current = recording;
      startVoiceTimer();
      setIsRecordingVoice(true);
    } catch (err) {
      console.error("startVoiceRecording error", err);
      setError("Không thể bắt đầu ghi âm.");
    }
  };

  const stopAndSendVoiceRecording = async () => {
    try {
      clearVoiceTimer();
      if (Platform.OS === "web") {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;
        const blob = await new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(voiceChunksRef.current, { type: "audio/webm" }));
          };
          recorder.stop();
        });
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        const uri = URL.createObjectURL(blob);
        await uploadAndSendFile({
          uri,
          name: `voice-${Date.now()}.webm`,
          mimeType: "audio/webm",
          size: blob.size,
          lastModified: Date.now(),
        } as DocumentPicker.DocumentPickerAsset);
        setTimeout(() => URL.revokeObjectURL(uri), 60_000);
      } else {
        const recording = voiceRecordingRef.current;
        if (!recording) return;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        voiceRecordingRef.current = null;
        if (!uri) throw new Error("Recording uri is empty");
        await uploadAndSendFile({
          uri,
          name: `voice-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
          size: 0,
          lastModified: Date.now(),
        } as DocumentPicker.DocumentPickerAsset);
      }
    } catch (err) {
      console.error("stopAndSendVoiceRecording error", err);
      setError("Không thể gửi ghi âm.");
    } finally {
      setIsRecordingVoice(false);
      setVoiceRecordingSeconds(0);
      clearVoiceTimer();
      clearVoiceWaveTimer();
    }
  };

  const handleVoiceAction = async () => {
    if (isRecordingVoice) {
      await stopAndSendVoiceRecording();
      return;
    }
    await startVoiceRecording();
  };

  const uploadAndSendFile = async (
    fileAsset: DocumentPicker.DocumentPickerAsset,
  ) => {
    const conversationId = String(
      selectedChat?.id ?? (selectedChat as any)?._id ?? "",
    ).trim();
    if (!conversationId || !user?.id) return;

    // Ensure socket uses latest auth before sending binary payloads (mobile reconnect-safe)
    void socketService.connect();

    const isLargeFile = (fileAsset.size || 0) > 10 * 1024 * 1024;

    try {
      // Show upload modal
      setShowUploadModal(true);
      setFileUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatusMessage("Preparing file...");

      if (isLargeFile) {
        setUploadStatusMessage("File too large. Please try again.");
        // setShowUploadModal(false);
        // setError('Tệp quá lớn. Vui lòng thử lại.');
        return;
      }

      // Chuẩn bị fileData để gửi qua socket
      let fileBuffer: ArrayBuffer;

      setUploadStatusMessage("Reading file content...");
      setUploadProgress(10);

      fileBuffer = await readBufferFromAsset(fileAsset);

      setUploadProgress(40);
      setUploadStatusMessage("Preparing to send file...");

      // Cấu trúc dữ liệu file để gửi qua socket
      const fileData = {
        buffer: fileBuffer,
        fileName: fileAsset.name,
        contentType: fileAsset.mimeType || "application/octet-stream",
      };

      setUploadProgress(50);
      setUploadStatusMessage("Setting up connection...");

      // Lắng nghe phản hồi từ socket về việc gửi attachment thành công
      const attachmentSentHandler = (data: {
        success: boolean;
        messageId: string;
      }) => {
        console.log("Attachment sent successfully:", data);
        if (data.success) {
          setUploadProgress(100);
          setUploadStatusMessage("File sent successfully!");

          // Sau khi gửi thành công, cập nhật danh sách tin nhắn
          void fetchMessages({ silent: true });

          // Reset reply state nếu có
          if (replyingTo) {
            setReplyingTo(null);
          }

          // Close modal after short delay to show success
          setTimeout(() => {
            setShowUploadModal(false);
          }, 800);
        }
        // Gỡ bỏ event listener sau khi nhận được phản hồi
        socketService.removeAttachmentSentListener(attachmentSentHandler);
      };

      // Lắng nghe lỗi từ socket (nếu có)
      const attachmentErrorHandler = (error: { message: string; code?: string; reasonCode?: string; labels?: string[]; violationCount?: number; violations?: Array<{ reasonCode?: string; label?: string; count?: number }> }) => {
        console.error("Attachment error:", error.message);
        if (isPolicyViolationPayload(error)) {
          const detail = getViolationDetail(error);
          setUploadStatusMessage(`Lỗi: ${detail}`);
          setPolicyWarning(detail);
          setToastType("error");
          setToastDuration(15000);
          setToastMessage(detail);
          setToastVisible(true);
        } else {
          setUploadStatusMessage(`Error: ${error.message}`);
          setError(`Không thể gửi tệp đính kèm: ${error.message}`);
          // Close modal after showing non-policy errors
          setTimeout(() => {
            setShowUploadModal(false);
          }, 2000);
        }

        // Gỡ bỏ event listener sau khi nhận được lỗi
        socketService.removeAttachmentErrorListener(attachmentErrorHandler);
      };

      // Đăng ký các event handlers
      socketService.onAttachmentSent(attachmentSentHandler);
      socketService.onAttachmentError(attachmentErrorHandler);

      setUploadProgress(70);
      setUploadStatusMessage("Sending file via socket...");

      // Gửi file thông qua socket
      socketService.sendAttachment(
        conversationId,
        fileData,
        replyingTo?.id, // Truyền repliedTold nếu có
      );

      setUploadProgress(80);
      setUploadStatusMessage("Waiting for server confirmation...");

      console.log(`Sending file via socket: ${fileAsset.name}`);
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadStatusMessage("Upload failed");
      setError(
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Không thể gửi file. Vui lòng thử lại.",
      );

      // Close modal after showing error
      setTimeout(() => {
        setShowUploadModal(false);
      }, 2000);
    } finally {
      setFileUploading(false);
      toggleModelChecked(); // Đóng modal chọn loại file
    }
  };

  const uploadAndSendMediaAlbum = async (
    assets: DocumentPicker.DocumentPickerAsset[],
  ) => {
    const conversationId = String(
      selectedChat?.id ?? (selectedChat as any)?._id ?? "",
    ).trim();
    if (!conversationId || !user?.id) return;

    // Ensure socket uses latest auth before sending binary payloads (mobile reconnect-safe)
    void socketService.connect();

    const MAX_FILES = 20;
    const MAX_BYTES = 10 * 1024 * 1024;
    const slice = assets.slice(0, MAX_FILES);

    try {
      setShowUploadModal(true);
      setFileUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatusMessage("Đang đọc nhiều file...");

      for (const a of slice) {
        if ((a.size || 0) > MAX_BYTES) {
          setUploadStatusMessage("File quá lớn (tối đa 10MB mỗi file).");
          setTimeout(() => setShowUploadModal(false), 2000);
          return;
        }
      }

      const files: Array<{
        buffer: ArrayBuffer;
        fileName: string;
        contentType: string;
      }> = [];
      const total = slice.length;
      for (let i = 0; i < slice.length; i++) {
        setUploadStatusMessage(`Đang đọc ${i + 1}/${total}...`);
        const buf = await readBufferFromAsset(slice[i]);
        files.push({
          buffer: buf,
          fileName: slice[i].name ?? "file",
          contentType: slice[i].mimeType || "application/octet-stream",
        });
        setUploadProgress(Math.round(((i + 1) / total) * 50));
      }

      setUploadStatusMessage("Đang gửi album...");
      const attachmentSentHandler = (data: {
        success: boolean;
        messageId: string;
      }) => {
        if (data.success) {
          setUploadProgress(100);
          setUploadStatusMessage("Đã gửi!");
          void fetchMessages({ silent: true });
          if (replyingTo) setReplyingTo(null);
          setTimeout(() => setShowUploadModal(false), 600);
        }
        socketService.removeAttachmentSentListener(attachmentSentHandler);
      };
      const attachmentErrorHandler = (error: { message: string; code?: string; reasonCode?: string; labels?: string[]; violationCount?: number; violations?: Array<{ reasonCode?: string; label?: string; count?: number }> }) => {
        if (isPolicyViolationPayload(error)) {
          const detail = getViolationDetail(error);
          setUploadStatusMessage(`Lỗi: ${detail}`);
          setPolicyWarning(detail);
          setToastType("error");
          setToastDuration(15000);
          setToastMessage(detail);
          setToastVisible(true);
        } else {
          setUploadStatusMessage(`Lỗi: ${error.message}`);
          setError(`Không gửi được album: ${error.message}`);
          setTimeout(() => setShowUploadModal(false), 2000);
        }
        socketService.removeAttachmentErrorListener(attachmentErrorHandler);
      };
      socketService.onAttachmentSent(attachmentSentHandler);
      socketService.onAttachmentError(attachmentErrorHandler);

      setUploadProgress(60);
      socketService.sendMediaAlbum(conversationId, files, replyingTo?.id);
      setUploadProgress(85);
      setUploadStatusMessage("Đang chờ server...");
    } catch (error) {
      console.error("uploadAndSendMediaAlbum:", error);
      setError("Không gửi được album.");
      setShowUploadModal(false);
    } finally {
      setFileUploading(false);
      toggleModelChecked();
    }
  };

  // Update the getAttachmentByMessageId function
  const getAttachmentByMessageId = async (messageId: string) => {
    try {
      // Check if we already have the attachment in local state
      if (attachments[messageId]) {
        return attachments[messageId];
      }

      // If not, fetch it from the server
      const response =
        await AttachmentService.getAttachmentByMessageId(messageId);

      if (response.success && response.data && response.data.length > 0) {
        const attachment = response.data[0]; // Get the first attachment if there are multiple

        // Save to local state for future use
        setAttachments((prev) => ({
          ...prev,
          [messageId]: attachment,
        }));

        return attachment;
      }

      return null;
    } catch (error) {
      console.error("Error fetching attachment:", error);
      return null;
    }
  };

  const fetchUserInfo = async (userId: string) => {
    if (userId === BOT_AI_ID) {
      setMessageUsers((prev) => ({ ...prev, [BOT_AI_ID]: BOT_AI_PROFILE }));
      return;
    }
    try {
      const response = await UserService.getUserById(userId);
      if (response.success) {
        setMessageUsers((prev) => ({
          ...prev,
          [userId]: response.user,
        }));
      }
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  };

  // Fetch messages from server — silent: không che cả khung chat bằng "Đang tải..."
  const fetchMessages = async (opts?: { silent?: boolean }) => {
    if (!selectedChat?.id) return;
    const silent = Boolean(opts?.silent);

    try {
      if (!silent) setLoading(true);
      const response = await MessageService.getMessages(
        selectedChat.id,
        0,
        CHAT_HISTORY_PAGE_SIZE,
        user?.id,
      );
      console.log("response fetch messages: ", response);
      if (response.success) {
        const normalized = Array.isArray(response.messages)
          ? sanitizeMessages(response.messages)
          : [];
        setMessages(normalized);
        if (response.participantReadStatus) {
          setParticipantReadStatus(response.participantReadStatus);
        }
        setMessagePage(response.page ?? 0);
        setHasOlderMessages(Boolean(response.hasMore));
        setShowLoadOlderButton(false);
        setIsNewer(response.isNewer);
        setError(null);

        // ── Real-time status: chỉ emit READ cho tin cuối người kia gửi ──
        // (Mở chat = đã xem rồi — không need spam delivered cho tất cả)
        if (!selectedChat?.isGroup) {
          const lastOtherMsg = [...normalized]
            .reverse()
            .find((m) => m.senderId !== user?.id && !m.isDeletedForEveryone);
          if (lastOtherMsg?.id && selectedChat?.id) {
            socketService.markAsSeen({
              conversationId: selectedChat.id,
              messageId: lastOtherMsg.id,
            });
          }
          // Reset status map khi đổi conversation (tránh stale data)
          setMsgStatusMap({});
        }
      } else {
        setError(response.statusMessage);
      }
    } catch (err: any) {
      const backendMsg = err?.response?.data?.message || err?.message || "";
      setError(backendMsg || "Failed to load messages");
      console.error("Error fetching messages:", err);
      setHasOlderMessages(false);

      // Auto-heal ghost conversation
      if (err?.response?.status === 403 || backendMsg.includes("thuộc cuộc hội thoại") || backendMsg.includes("trong nhóm này")) {
        console.log("ChatArea auto-removed ghost conversation:", selectedChat?.id);
        if (selectedChat?.id) {
            onRemovedFromConversation(selectedChat.id);
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (!selectedChat?.id || loadingOlderMessages || !hasOlderMessages) return;

    try {
      setLoadingOlderMessages(true);
      preserveScrollOffsetRef.current = scrollOffsetRef.current;
      const nextPage = messagePage + 1;

      const response = await MessageService.getMessages(
        selectedChat.id,
        nextPage,
        CHAT_HISTORY_PAGE_SIZE,
        user?.id,
      );

      if (!response.success) {
        setError(response.statusMessage || "Không thể tải thêm dữ liệu cũ");
        preserveScrollOffsetRef.current = null;
        return;
      }

      const olderRows = Array.isArray(response.messages)
        ? sanitizeMessages(response.messages)
        : [];

      if (olderRows.length === 0) {
        setHasOlderMessages(false);
        preserveScrollOffsetRef.current = null;
        return;
      }

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const prependRows = olderRows.filter((m) => !existingIds.has(m.id));
        if (prependRows.length === 0) {
          return prev;
        }
        return [...prependRows, ...prev];
      });

      setMessagePage(response.page ?? nextPage);
      setHasOlderMessages(Boolean(response.hasMore));
      setError(null);
    } catch (err) {
      preserveScrollOffsetRef.current = null;
      setError("Không thể tải thêm dữ liệu cũ");
      console.error("Error loading older messages:", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [
    hasOlderMessages,
    loadingOlderMessages,
    messagePage,
    sanitizeMessages,
    selectedChat?.id,
    user?.id,
  ]);

  const handleMessagesContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const previousHeight = contentHeightRef.current;
      contentHeightRef.current = h;

      const preserveOffset = preserveScrollOffsetRef.current;
      if (preserveOffset != null && h > previousHeight) {
        const delta = h - previousHeight;
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({
            y: preserveOffset + delta,
            animated: false,
          });
        });
        preserveScrollOffsetRef.current = null;
      }
    },
    [],
  );

  const handleMessagesScroll = useCallback(
    (event: any) => {
      const yOffset = Number(event?.nativeEvent?.contentOffset?.y ?? 0);
      scrollOffsetRef.current = yOffset;

      if (!hasOlderMessages) {
        setShowLoadOlderButton(false);
        return;
      }

      const atTop = yOffset <= TOP_LOAD_OLDER_THRESHOLD;
      setShowLoadOlderButton((prev) => (prev === atTop ? prev : atTop));
    },
    [hasOlderMessages],
  );

  // Join + load tin. Cùng conversationId nhưng effect chạy lại (vd. user?.id vừa load) → refetch im lặng,
  // không full-screen "Đang tải...". Chỉ khi thật sự đổi hội thoại mới reset + loading.
  useEffect(() => {
    const convId = selectedChat?.id;
    if (!convId) {
      prevJoinedConvIdRef.current = null;
      setLoading(false);
      return;
    }

    const switchedConv = prevJoinedConvIdRef.current !== convId;
    prevJoinedConvIdRef.current = convId;

    if (switchedConv) {
      contentHeightRef.current = 0;
      scrollOffsetRef.current = 0;
      preserveScrollOffsetRef.current = null;
      prevMessagesLengthRef.current = 0;
      setMessagePage(0);
      setHasOlderMessages(false);
      setShowLoadOlderButton(false);
      messageRefs.current = {};
      setMessages([]);
      void fetchMessages();
    } else {
      void fetchMessages({ silent: true });
    }

    // Khởi tạo userLastReadMap từ participants hiện có
    if (selectedChat.participants) {
      const initialMap: Record<
        string,
        { messageId: string; avatarUrl: string; displayName: string }
      > = {};
      selectedChat.participants.forEach((p) => {
        if (p.userId !== user?.id && p.lastReadMessageId) {
          const info = selectedChat.participantInfo?.find(
            (pi) => pi.id === p.userId,
          );
          initialMap[p.userId] = {
            messageId: p.lastReadMessageId,
            avatarUrl: info?.avatar || "",
            displayName: info?.name || "User",
          };
        }
      });
      setUserLastReadMap(initialMap);
    }

    socketService.joinConversation(convId);

    const handleReconnect = () => {
      socketService.joinConversation(convId);
    };
    socketService.onConnect(handleReconnect);

    return () => {
      socketService.removeConnectListener(handleReconnect);
      socketService.leaveConversation(convId);
    };
  }, [selectedChat?.id, user?.id]);

  /** Rời nhóm / bị kick: đảm bảo thoát màn chat khi socket tới (đặc biệt desktop — ChatArea vẫn mount cùng Info) */
  useEffect(() => {
    if (!selectedChat?.id || !user?.id || !onRemovedFromConversation) return;
    const convId = selectedChat.id;
    const myId = String(user.id);
    const handler = (data: { conversationId?: string; removedParticipants?: string[] }) => {
      const cid = String(data?.conversationId ?? "");
      if (!cid || cid !== convId) return;
      if (!data.removedParticipants?.some((id) => String(id) === myId)) return;
      try {
        socketService.leaveConversation(convId);
      } catch {
        /* noop */
      }
      onRemovedFromConversation(convId);
    };
    socketService.onParticipantsRemoved(handler);
    return () => socketService.removeParticipantsRemovedListener(handler);
  }, [selectedChat?.id, user?.id, onRemovedFromConversation]);

  useEffect(() => {
    if (messagesRefreshKey == null || messagesRefreshKey < 1) return;
    if (!selectedChat?.id) return;
    void fetchMessages({ silent: true });
  }, [messagesRefreshKey, selectedChat?.id]);

  // Auto scroll to bottom khi thêm tin mới (không áp dụng lúc prepend dữ liệu cũ)
  useEffect(() => {
    const prevLen = prevMessagesLengthRef.current;
    const currentLen = messages.length;
    const hasNewRows = currentLen > prevLen;
    const isPrependingOlder = preserveScrollOffsetRef.current !== null;

    if (hasNewRows && !isPrependingOlder) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }

    prevMessagesLengthRef.current = currentLen;
  }, [messages]);

  // Listen for new messages (chuẩn hoá payload backend: _id → id, type enum, …)
  useEffect(() => {
    const handlePinnedMessage = (payload: any) => {
      if (
        payload?.conversationId === selectedChat?.id ||
        payload?.message?.conversationId === selectedChat?.id
      ) {
        const msg = payload.message || payload;
        const mapped = mapApiMessageToModel(msg);
        if (mapped) {
          setMessages((prev) =>
            prev.map((m) => (m.id === mapped.id ? mapped : m)),
          );
        }
      }
    };

    const handleMessageUnpinned = (payload: any) => {
      if (
        payload?.conversationId === selectedChat?.id ||
        payload?.message?.conversationId === selectedChat?.id
      ) {
        const msg = payload.message || payload;
        const mapped = mapApiMessageToModel(msg);
        if (mapped) {
          setMessages((prev) =>
            prev.map((m) => (m.id === mapped.id ? mapped : m)),
          );
        }
      }
    };

    const handleMessageDeletedForEveryone = (payload: any) => {
      const mid =
        payload?.messageId ??
        payload?.id ??
        payload?._id ??
        payload?.message?.id;
      const cid = payload?.conversationId ?? payload?.message?.conversationId;
      if (cid === selectedChat?.id && mid) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === mid ? { ...m, isDeletedForEveryone: true } : m,
          ),
        );
      }
    };

    const handleConversationUpdated = (updatedConv: any) => {
      const convId = String(updatedConv?._id || updatedConv?.id);
      if (convId === String(selectedChat?.id)) {
        console.log("[ChatArea] Active conversation updated:", updatedConv);
        // updatedConv from socket lacks full participant relationships.
        // Fetch to safely build the full Conversation object without wiping participantIds.
        void ConversationService.getConversationById(convId, user?.id)
          .then((res: any) => {
            if (res?.success && res?.conversation) {
              onConversationMetaChanged?.(res.conversation);
            }
          })
          .catch(console.error);
      }
    };

    const handleChatTyping = (data: any) => {
      if (data?.conversationId !== selectedChat?.id) return;
      if (data?.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data?.isTyping) {
          next[data.userId] = Date.now();
        } else {
          delete next[data.userId];
        }
        return next;
      });
    };

    const handleNewMessage = (raw: Message | Record<string, unknown>) => {
      if (!raw || typeof raw !== "object") return;
      const message = mapApiMessageToModel(raw as any);
      if (
        !message?.id ||
        !message.conversationId ||
        message.conversationId !== selectedChat?.id
      )
        return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (String(message.senderId) === "BotAi") {
        setIsWaitingBotAi(false);
      }
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Xử lý status & mark as seen
      if (message.senderId === user?.id) {
        // NGƯỜI GỬI LÀ TÔI
        if (!selectedChat?.isGroup) {
          upgradeMsgStatus(message.id, "sent");
        }

        // XOÁ TIN NHÁP (PENDING/FAILED) DỰA THEO CONTENT ĐỂ TRÁNH TRÙNG LẶP DO OPTIMISTIC UI
        setMessages((prev) => {
          // Xem có tin nhắn ảo PENDING hoặc FAILED nào có cùng content không
          const pendingIdx = prev.findIndex(
            (m) =>
              (m.status === "PENDING" || m.status === "FAILED") &&
              m.content === message.content &&
              m.senderId === user?.id,
          );
          if (pendingIdx !== -1) {
            const newMsgs = [...prev];
            newMsgs.splice(pendingIdx, 1);
            return newMsgs;
          }
          return prev;
        });
      } else {
        // NGƯỜI KIA GỬI
        if (message.id && message.conversationId) {
          // Xin đánh dấu đã xem ngay
          socketService.sendRead(message.conversationId, message.id);
          // sendSeen cũng giữ lại để tương thích
          socketService.sendSeen(message.id, message.conversationId);
        }
      }
    };

    const handleCheckReminderRefresh = (raw: any) => {
      const msg = mapApiMessageToModel(raw);
      if (
        msg?.conversationId === selectedChat?.id &&
        (msg?.storyContext as any)?.kind === "appointment"
      ) {
        refreshRemindersRef.current?.();
      }
    };

    const handleNotifRefresh = (payload: any) => {
      if (
        payload?.conversationId === selectedChat?.id ||
        String(payload?.type ?? "").toUpperCase() === "REMINDER"
      ) {
        setTimeout(() => {
          if (!isDeletingReminderRef.current) {
            refreshRemindersRef.current?.();
          }
        }, 1200);
      }
    };

    const handleNotifDeleted = () => {
      if (!isDeletingReminderRef.current) {
        refreshRemindersRef.current?.();
      }
    };

    socketService.onNewMessage(handleNewMessage);
    socketService.onNewMessage(handleCheckReminderRefresh);
    socketService.onPinnedMessage(handlePinnedMessage);
    socketService.onMessageUnpinned(handleMessageUnpinned);
    socketService.onMessageDeletedForEveryone(handleMessageDeletedForEveryone);
    socketService.onConversationUpdated(handleConversationUpdated);
    socketService.onChatTyping(handleChatTyping);
    socketService.onNotificationNew(handleNotifRefresh);
    socketService.onNotificationDeleted(handleNotifDeleted);

    return () => {
      socketService.removeMessageListener(handleNewMessage);
      socketService.removeMessageListener(handleCheckReminderRefresh);
      socketService.removePinnedMessageListener(handlePinnedMessage);
      socketService.removeMessageUnpinnedListener(handleMessageUnpinned as any);
      socketService.removeMessageDeletedForEveryoneListener(
        handleMessageDeletedForEveryone,
      );
      socketService.removeConversationUpdatedListener(
        handleConversationUpdated,
      );
      socketService.removeChatTypingListener(handleChatTyping);
      socketService.removeNotificationNewListener(handleNotifRefresh);
      socketService.removeNotificationDeletedListener(handleNotifDeleted);
    };
  }, [
    selectedChat?.id,
    socketService,
    onConversationMetaChanged,
    user?.id,
    upgradeMsgStatus,
  ]);

  useEffect(() => {
    setIsWaitingBotAi(false);
  }, [selectedChat?.id]);

  // ── Lắng nghe chat:read → nâng status lên "read" ──────────────────────────
  useEffect(() => {
    const handleRead = (data: {
      conversationId: string;
      messageId: string;
      userId: string;
      avatarUrl?: string;
      displayName?: string;
    }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return;
      upgradeMsgStatus(data.messageId, "read");

      // Update readBy local cho message đó để UI avatar render ngay
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            const rb = m.readBy || [];
            if (!rb.includes(data.userId)) {
              return { ...m, readBy: [...rb, data.userId] };
            }
          }
          return m;
        }),
      );

      const localParticipant = selectedChat?.participantInfo?.find(
        (p) => String(p.id) === String(data.userId),
      );
      const localCache = (messageUsers as any)?.[data.userId] ?? null;
      const localDisplayName = normalizeSeenText(
        localParticipant?.nickname ??
          localParticipant?.name ??
          localCache?.name ??
          localCache?.displayName ??
          (!selectedChat?.isGroup && data.userId !== user?.id
            ? otherParticipant?.name
            : ""),
      );
      const localAvatarUrl = normalizeSeenAvatarUrl(
        localParticipant?.avatar ??
          localCache?.avatarURL ??
          localCache?.avatarUrl ??
          localCache?.avatar ??
          (!selectedChat?.isGroup && data.userId !== user?.id
            ? otherParticipant?.avatar
            : ""),
      );

      // Di chuyển avatar người đã đọc tới tin nhắn mới nhất họ vừa đọc
      setUserLastReadMap((prev) => ({
        ...prev,
        [data.userId]: {
          messageId: data.messageId,
          avatarUrl:
            normalizeSeenAvatarUrl(data.avatarUrl) ||
            localAvatarUrl ||
            normalizeSeenAvatarUrl(prev[data.userId]?.avatarUrl) ||
            "",
          displayName:
            normalizeSeenText(data.displayName) ||
            localDisplayName ||
            normalizeSeenText(prev[data.userId]?.displayName) ||
            "User",
        },
      }));
    };
    socketService.onMessageRead(handleRead);
    return () => socketService.removeMessageReadListener(handleRead);
  }, [
    selectedChat?.id,
    selectedChat?.isGroup,
    selectedChat?.participantInfo,
    user?.id,
    messageUsers,
    otherParticipant?.avatar,
    otherParticipant?.name,
    upgradeMsgStatus,
  ]);

  // ── Tự động mark as seen khi vào chat hoặc có tin mới ─────────────────────
  useEffect(() => {
    if (messages.length > 0 && selectedChat?.id && user?.id) {
      // Lấy tin cuối cùng
      const lastMsg = messages[messages.length - 1];
      // Nếu là từ người khác và mình chưa đọc (theo readBy local)
      if (lastMsg && lastMsg.senderId !== user.id) {
        const myUid = user.id;
        const alreadyRead = (lastMsg.readBy || []).includes(myUid);
        if (!alreadyRead) {
          console.log("[ChatArea] Marking last message as seen:", lastMsg.id);
          socketService.markAsSeen({
            conversationId: selectedChat.id,
            messageId: lastMsg.id,
          });
          void MessageService.markRead(selectedChat.id, myUid, lastMsg.id).catch(() => {});
          // Optimistic update readBy local
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === lastMsg.id) {
                const rb = m.readBy || [];
                if (!rb.includes(myUid))
                  return { ...m, readBy: [...rb, myUid] };
              }
              return m;
            }),
          );
        }
      }
    }
  }, [messages.length, selectedChat?.id, user?.id]);

  // ── Lắng nghe Poll Events (Zalo-style) ────────────────────────────────────
  useEffect(() => {
    if (!selectedChat?.id) return;

    const handlePollUpdate = (data: { conversationId: string; vote: any }) => {
      if (data.conversationId !== selectedChat.id) return;
      const updatedVote = mapApiMessageToModel(data.vote);
      if (!updatedVote) return;

      setMessages((prev) => {
        // Remove old position and move to end (Zalo-style)
        const filtered = prev.filter((m) => m.id !== updatedVote.id);
        return [...filtered, updatedVote];
      });

      // Auto-scroll to show the moved poll
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    };

    socketService.onVoteCreated(handlePollUpdate);
    socketService.onVoteUpdated(handlePollUpdate);
    socketService.onVoteClosed(handlePollUpdate); // handles poll:expired
    socketService.onVoteOptionAdded(handlePollUpdate);

    return () => {
      socketService.removeVoteCreatedListener(handlePollUpdate);
      socketService.removeVoteUpdatedListener(handlePollUpdate);
      socketService.removeVoteClosedListener(handlePollUpdate);
      socketService.removeVoteOptionAddedListener(handlePollUpdate);
    };
  }, [selectedChat?.id]);

  // ── Lắng nghe chat:delivered → nâng status lên "delivered" ────────────────
  useEffect(() => {
    if (selectedChat?.isGroup) return;
    const handleDelivered = (data: {
      conversationId: string;
      messageId: string;
      userId: string;
    }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return;
      upgradeMsgStatus(data.messageId, "delivered");
    };
    socketService.onMessageDelivered(handleDelivered);
    return () => socketService.removeMessageDeliveredListener(handleDelivered);
  }, [selectedChat?.id, selectedChat?.isGroup, user?.id, upgradeMsgStatus]);

  // ── Load ảnh nền: ưu tiên từ backend, fallback local storage ─────────────
  useEffect(() => {
    if (!selectedChat?.id) return;
    const serverBgId = String(
      (selectedChat as any)?.chatBackgroundId ||
        (selectedChat as any)?.backgroundId ||
        "",
    ).trim();
    const isServerPreset = CHAT_BACKGROUNDS.some((bg) => bg.id === serverBgId);
    if (isServerPreset) {
      setChatBgId(serverBgId);
      void AsyncStorage.setItem(BG_STORAGE_KEY(selectedChat.id), serverBgId);
      return;
    }
    AsyncStorage.getItem(BG_STORAGE_KEY(selectedChat.id))
      .then((saved) => {
        setChatBgId(saved ?? "default");
      })
      .catch(() => setChatBgId("default"));
  }, [selectedChat?.id]);

  // ── Lắng nghe chat:background real-time từ người kia ──────────────────────
  useEffect(() => {
    if (!selectedChat?.id) return;
    const handleBgChange = (data: {
      conversationId: string;
      backgroundId: string;
      userId: string;
    }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return; // chính mình đổi → bỏ qua
      setChatBgId(data.backgroundId);
      // Lưu lại để persistent
      void AsyncStorage.setItem(
        BG_STORAGE_KEY(data.conversationId),
        data.backgroundId,
      );
    };
    socketService.onBackgroundChanged(handleBgChange);
    return () => socketService.removeBackgroundListener(handleBgChange);
  }, [selectedChat?.id, user?.id]);

  /** Đổi ảnh nền: lưu local + broadcast + system message */
  const handleChangeBg = useCallback(
    async (bgId: string) => {
      if (!selectedChat?.id || !user?.id) return;
      const preset = CHAT_BACKGROUNDS.find((b) => b.id === bgId);
      if (!preset) return;

      setChatBgId(bgId);
      setShowBgPicker(false);

      // Persistent local
      await AsyncStorage.setItem(BG_STORAGE_KEY(selectedChat.id), bgId);

      // Broadcast real-time cho người kia
      socketService.sendBackground(selectedChat.id, bgId);

      // System message: phân biệt "xóa" vs "đổi"
      const actorName =
        String((user as any)?.name ?? t('chatArea.defaultUser')).trim() || t('chatArea.defaultUser');
      const isReset = bgId === "default";
      const systemContent = isReset
        ? t('chatArea.sysClearedBackground').replace('{actor}', actorName)
        : t('chatArea.sysChangedBackground').replace('{actor}', actorName).replace('{label}', preset.label);
      try {
        await MessageService.send({
          conversationId: selectedChat.id,
          senderId: user.id,
          content: systemContent,
          type: "SYSTEM",
        });
      } catch {
        // System message không critical
      }
    },
    [selectedChat?.id, user?.id, actorDisplayName],
  );

  // Fetch user info for each unique sender
  useEffect(() => {
    const senderIds = [
      ...new Set(
        messages.map((msg) => msg?.senderId).filter(Boolean) as string[],
      ),
    ];
    senderIds.forEach((id) => {
      if (!messageUsers[id]) {
        fetchUserInfo(id);
      }
    });
    // load lai messages
  }, [messages]);

  // Load other participant info when selectedChat changes
  useEffect(() => {
    const loadOtherParticipant = async () => {
      if (!selectedChat || !user) return;

      // Find the other participant's ID
      const otherUserId = selectedChat.participantIds.find(
        (id) => id !== user.id,
      );
      if (!otherUserId) return;
      // Lưu userId người kia để lắng nghe presence update của đúng người
      otherUserIdRef.current = otherUserId;

      try {
        const response = await UserService.getUserById(otherUserId);
        if (response.success && response.user) {
          setOtherParticipant({
            name: response.user.name,
            avatar:
              response.user.avatarURL ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                response.user.name,
              )}&background=0068FF&color=fff`,
            isOnline: response.user.isOnline,
          });
        }
      } catch (error) {
        console.error("Error loading other participant:", error);
      }
    };

    loadOtherParticipant();
  }, [selectedChat, user]);

  // Group: hydrate đầy đủ tên/avatar theo participantIds để tránh hiện "Người dùng".
  useEffect(() => {
    if (!selectedChat?.isGroup || !selectedChat?.participantIds?.length) return;
    const missingIds = selectedChat.participantIds.filter(
      (id) =>
        !messageUsers[id]?.name ||
        !(
          messageUsers[id]?.avatarURL ||
          messageUsers[id]?.avatarUrl ||
          messageUsers[id]?.avatar
        ),
    );
    if (missingIds.length === 0) return;

    void Promise.all(
      missingIds.map(async (id) => {
        try {
          const res = await UserService.getUserById(id);
          if (res?.success && res?.user) {
            setMessageUsers((prev) => ({
              ...prev,
              [id]: {
                ...(prev[id] || {}),
                ...res.user,
              },
            }));
          }
        } catch {
          // keep silent; fallback name/avatar still handled
        }
      }),
    );
  }, [selectedChat?.id, selectedChat?.isGroup, selectedChat?.participantIds, messageUsers]);

  // ─── Real-time presence update ───────────────────────────────────────
  // Giống bài tham khảo nhưng thêm real-time: lắng nghe `presence:update`
  // để cập nhật chấm xanh ngay khi người dùng kia thay đổi online/offline
  useEffect(() => {
    const handlePresenceUpdate = (data: {
      userId: string;
      status: "online" | "offline";
      lastSeen: string;
    }) => {
      if (data.userId !== otherUserIdRef.current) return;
      setOtherParticipant((prev) => {
        if (!prev) return prev;
        return { ...prev, isOnline: data.status === "online" };
      });
    };

    socketService.onPresenceUpdate(handlePresenceUpdate);
    return () => {
      socketService.removePresenceUpdateListener(handlePresenceUpdate);
    };
  }, []);

  // ─── Heartbeat: giữ trạng thái online cho chính mình ─────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      socketService.sendHeartbeat();
    }, 30_000); // 30 giây một lần
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      clearVoiceTimer();
      clearVoiceWaveTimer();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const sendTextMessage = async (messageContent: string) => {
    if (!selectedChat?.id || !user?.id) return;
    const tempId = "temp-" + Date.now();
    const isBotTrigger = /^@ZalaAi\b/i.test(messageContent);
    if (isBotTrigger) setIsWaitingBotAi(true);

    const messageData: Message = {
      id: tempId,
      conversationId: selectedChat.id,
      senderId: user.id,
      content: messageContent,
      type: MessageType.TEXT,
      repliedToId: replyingTo?.id || "",
      readBy: [],
      sentAt: new Date().toISOString(),
      status: "PENDING",
    };

    setMessages((prev) => [...prev, messageData]);

    try {
      socketService.sendMessage(messageData);
      setTimeout(() => {
        setMessages((prev) => {
          const isStillPending = prev.find(
            (m) => m.id === tempId && m.status === "PENDING",
          );
          if (isStillPending) {
            return prev.map((m) =>
              m.id === tempId ? { ...m, status: "FAILED" } : m,
            );
          }
          return prev;
        });
      }, 10000);
    } catch (err) {
      console.error("Error sending message:", err);
      if (isBotTrigger) setIsWaitingBotAi(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m)),
      );
    }
  };

  // ── Send: gửi file trong queue TRƯỚC, rồi mới gửi text ──────────────────
  const handleSendMessage = async () => {
    // Guard: block setting (1-1)
    if (peerMessageBlockedMe) {
      setError(t('chatArea.errBlockedMessaging'));
      return;
    }
    // Guard: group allowMessaging (admin lock)
    if (!groupChat.canSendMessage) {
      setError(
        groupChat.lockedChatMessage ||
          t('chatArea.errNoPermissionMessaging'),
      );
      return;
    }
    const hasText = newMessage.trim().length > 0;
    const hasFiles = pendingAttachments.length > 0;
    if (!selectedChat?.id || !user?.id) return;
    if (!hasText && !hasFiles) return;

    // 1) Gửi các file đính kèm
    if (hasFiles) {
      if (pendingAttachments.length === 1) {
        await uploadAndSendFile(pendingAttachments[0]);
      } else {
        await uploadAndSendMediaAlbum(pendingAttachments);
      }
      setPendingAttachments([]);
    }

    // 2) Gửi text (nếu có)
    if (hasText) {
      const messageContent = newMessage.trim();
      const isBotTrigger = /^@ZalaAi\b/i.test(messageContent);
      if (isBotTrigger) {
        let latestAiEnabled = Boolean((selectedChat as any)?.aiEnabled);
        try {
          const detail: any = await ConversationService.getConversationById(
            selectedChat.id,
            user?.id,
          );
          if (detail?.success && detail?.conversation) {
            latestAiEnabled = Boolean(detail.conversation.aiEnabled);
          }
        } catch {
          // fallback state từ selectedChat nếu API đọc fail
        }
        if (!latestAiEnabled) {
          setPendingAiMessage(messageContent);
          setShowEnableAiModal(true);
          return;
        }
      }
      await sendTextMessage(messageContent);
    }

    setNewMessage("");
    setReplyingTo(null);
    setSelectedMessage(null);
  };

  const handleConfirmEnableAi = async () => {
    if (!selectedChat?.id || !pendingAiMessage.trim()) return;
    setEnablingAi(true);
    try {
      const res: any = await ConversationService.updateAiEnabled(
        selectedChat.id,
        true,
      );
      if (res?.success === false) {
        setError(t('chatArea.errEnableBot'));
        return;
      }
      onConversationMetaChanged?.();
      await sendTextMessage(pendingAiMessage.trim());
      setNewMessage("");
      setReplyingTo(null);
      setSelectedMessage(null);
      setPendingAiMessage("");
      setShowEnableAiModal(false);
    } catch {
      setError(t('chatArea.errEnableBot'));
    } finally {
      setEnablingAi(false);
    }
  };

  const handleDeclineEnableAi = () => {
    setShowEnableAiModal(false);
    setPendingAiMessage("");
    setToastMessage(
      t('chatArea.errBotNotEnabled')
    );
    setToastVisible(true);
  };

  /** Hàm chuyên dùng gửi lại tin nhắn bị lỗi mạng */
  const handleRetryMessage = (failedMsg: Message) => {
    try {
      // Chuyển lại thành PENDING
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id ? { ...m, status: "PENDING" } : m,
        ),
      );
      // Tính lại timestamp mới
      const newMsgData = {
        ...failedMsg,
        sentAt: new Date().toISOString(),
        status: "PENDING",
      };
      socketService.sendMessage(newMsgData);

      // Setup lại timeout rớt mạng
      setTimeout(() => {
        setMessages((prev) => {
          const isStillPending = prev.find(
            (m) => m.id === failedMsg.id && m.status === "PENDING",
          );
          if (isStillPending) {
            return prev.map((m) =>
              m.id === failedMsg.id ? { ...m, status: "FAILED" } : m,
            );
          }
          return prev;
        });
      }, 10000);
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id ? { ...m, status: "FAILED" } : m,
        ),
      );
    }
  };

  const handleReactionToggle = (messageId: string) => {
    setActiveReactionId((prev) => (prev === messageId ? null : messageId));
  };

  // ── Reactions state (local, được update qua socket) ──────────────────────────
  const [messageReactions, setMessageReactions] = useState<
    Record<string, Array<{ userId: string; emoji: string; reactedAt?: string }>>
  >({});

  /** Khởi tạo reactions từ messages đã tải */
  useEffect(() => {
    const init: Record<string, Array<{ userId: string; emoji: string }>> = {};
    messages.forEach((m) => {
      if (m.reactions && m.reactions.length > 0) init[m.id] = m.reactions;
    });
    setMessageReactions((prev) => ({ ...init, ...prev }));
  }, [messages]);

  /** Lắng nghe broadcast reaction từ server */
  useEffect(() => {
    const handler = (data: {
      messageId: string;
      reactions?: Array<{ userId: string; emoji: string; reactedAt?: string }>;
      userId?: string;
      emoji?: string | null;
      conversationId?: string;
    }) => {
      if (!data?.messageId) return;
      if (Array.isArray(data.reactions)) {
        setMessageReactions((prev) => ({
          ...prev,
          [data.messageId]: data.reactions || [],
        }));
        return;
      }
      if (!data.userId) return;
      const incomingUserId = String(data.userId);
      setMessageReactions((prev) => {
        const current = prev[data.messageId] ?? [];
        if (!data.emoji) {
          // Unreact incremental: giảm đúng 1 lần react gần nhất của user này
          const idx = [...current]
            .reverse()
            .findIndex((x) => x.userId === incomingUserId);
          if (idx === -1) return prev;
          const realIdx = current.length - 1 - idx;
          return {
            ...prev,
            [data.messageId]: current.filter((_, i) => i !== realIdx),
          };
        }
        // React incremental: append để giữ logic spam cộng dồn
        return {
          ...prev,
          [data.messageId]: [
            ...current,
            {
              userId: incomingUserId,
              emoji: String(data.emoji),
              reactedAt: new Date().toISOString(),
            },
          ],
        };
      });
    };
    socketService.onReactionUpdated(handler);
    return () => socketService.removeReactionUpdatedListener(handler);
  }, []);

  /** Gửi react → cộng dồn (1 người có thể spam react nhiều lần) */
  const handleReact = (
    messageId: string,
    conversationId: string,
    emoji: string,
  ) => {
    if (!user?.id) return;
    const myUserId = user.id;
    // Không optimistic update để tránh double apply khi event realtime về.
    void MessageService.react(messageId, myUserId, emoji).catch(() => {
      socketService.sendReaction({ messageId, conversationId, emoji });
    });
    setActiveReactionId(null);
  };

  /** Thu hồi 1 lần react (giảm count đi 1) */
  const handleUnreact = (
    messageId: string,
    conversationId: string,
    emoji: string,
  ) => {
    if (!user?.id) return;
    const myUserId = user.id;
    // Không optimistic update để tránh double apply khi event realtime về.
    void MessageService.removeReaction(messageId, myUserId).catch(() => {
      socketService.sendUnreaction({ messageId, conversationId, emoji });
    });
    setActiveReactionId(null);
  };

  const handleForward = async (selectedConversations: string[]) => {
    const sourceMessages =
      forwardTargets.length > 0
        ? forwardTargets
        : replyingTo
          ? [replyingTo]
          : [];

    const actorUserId = String(user?.id ?? (user as any)?._id ?? "").trim();
    if (sourceMessages.length === 0 || !actorUserId) return;

    const normalizedSourceMessageIds = Array.from(
      new Set(
        sourceMessages
          .map((src) => {
            if (!src || src.isDeletedForEveryone) return "";

            const status = String(src.status ?? "").toUpperCase();
            if (status === "PENDING" || status === "FAILED") return "";

            const resolvedId = String(
              (src as any)?.id ?? (src as any)?._id ?? "",
            ).trim();
            if (!resolvedId || resolvedId.startsWith("temp-")) return "";
            return resolvedId;
          })
          .filter((id) => id.length > 0),
      ),
    );

    const normalizedConversationIds = Array.from(
      new Set(
        selectedConversations
          .map((id) => String(id ?? "").trim())
          .filter((id) => id.length > 0),
      ),
    );

    if (
      normalizedSourceMessageIds.length === 0 ||
      normalizedConversationIds.length === 0
    ) {
      setError(t('chatArea.errNoValidMsgToForward'));
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const skippedSourceCount = Math.max(
      sourceMessages.length - normalizedSourceMessageIds.length,
      0,
    );

    for (const conversationId of normalizedConversationIds) {
      for (const sourceMessageId of normalizedSourceMessageIds) {
        try {
          await MessageService.forward(
            sourceMessageId,
            conversationId,
            actorUserId,
          );
          successCount += 1;
        } catch (err) {
          failedCount += 1;
          console.error("Error forwarding message:", {
            messageId: sourceMessageId,
            conversationId,
            err,
          });
        }
      }
    }

    if (successCount === 0) {
      setError(t('chatArea.errForwardMessage'));
      return;
    }

    setShowForwardModal(false);
    setReplyingTo(null);
    setForwardTargets([]);
    setIsMultiSelectMode(false);
    setSelectedMessageIds([]);

    // Force reload inbox/nav-left so forwarded target conversations show latest preview immediately.
    onConversationMetaChanged?.();

    if (failedCount > 0 || skippedSourceCount > 0) {
      const parts = [t('chatArea.forwardSuccessCount').replace('{count}', String(successCount))];
      if (failedCount > 0) parts.push(t('chatArea.forwardFailedCount').replace('{count}', String(failedCount)));
      if (skippedSourceCount > 0)
        parts.push(t('chatArea.forwardSkippedCount').replace('{count}', String(skippedSourceCount)));
      setError(parts.join(", "));
    }
  };

  // Toggle models
  const toggleModelChecked = () => {
    if (isModelChecked) {
      Animated.timing(scaleAnimation, {
        toValue: 0,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setIsModelChecked(false));
    } else {
      setIsModelChecked(true);
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  };

  const toggleModelImage = () => {
    setIsModelImage(!isModelImage);
  };

  const toggleModelEmoji = () => {
    setIsModelEmoji(!isModelEmoji);
    console.log("Emoji model toggled: ", isModelEmoji);
  };

  const toggleModelSticker = () => {
    setIsModelSticker(!isModelSticker);
  };

  const toggleModelGift = () => {
    setIsModelGift(!isModelGift);
  };

  const handleReplyMessage = (msg: Message) => {
    console.log("msg now: ", msg);
    setReplyingTo(msg);
    setShowMessageOptions(false);
    // Focus vào input
  };

  const handleForwardMessage = async (msg: Message) => {
    setForwardTargets([msg]);
    setShowMessageOptions(false);
    setShowForwardModal(true);
  };

  const toggleSelectMessage = useCallback((msg: Message) => {
    setSelectedMessageIds((prev) => {
      const mid = String(msg.id);
      if (prev.includes(mid)) {
        const next = prev.filter((id) => id !== mid);
        if (next.length === 0) {
          setIsMultiSelectMode(false);
        }
        return next;
      }
      return [...prev, mid];
    });
  }, []);

  const handleEnterMultiSelect = useCallback((msg: Message) => {
    setShowMessageOptions(false);
    setIsMultiSelectMode(true);
    setSelectedMessageIds([String(msg.id)]);
  }, []);

  const handleForwardSelected = useCallback(() => {
    if (!canMultiForward) return;
    setForwardTargets(selectedMessages);
    setShowForwardModal(true);
  }, [canMultiForward, selectedMessages]);

  const handleDeleteForMeSelected = useCallback(async () => {
    if (!canMultiDeleteForMe) return;
    try {
      const ids = selectedMessages.map((m) => m.id);
      const results = await Promise.allSettled(
        ids.map((id) => MessageService.deleteMessageForMe(id)),
      );
      const successIds = results
        .map((r, idx) => ({ r, id: ids[idx] }))
        .filter(
          ({ r }) =>
            r.status === "fulfilled" && (r.value as any)?.success !== false,
        )
        .map(({ id }) => id);
      if (successIds.length > 0) {
        setMessages((prev) => prev.filter((m) => !successIds.includes(m.id)));
      }
      setIsMultiSelectMode(false);
      setSelectedMessageIds([]);
    } catch (err) {
      console.error("Error deleting selected messages for me:", err);
      setError(t('chatArea.errDeleteSelected'));
    }
  }, [canMultiDeleteForMe, selectedMessages]);

  const handleRecallSelected = useCallback(async () => {
    if (!canMultiRecall) return;
    try {
      for (const msg of selectedMessages) {
        const response = await MessageService.deleteMessage(msg.id);
        socketService.sendDeleteMessage(msg);
        if ((response as any)?.success !== false) {
          recallMessageLocally(msg.id);
        }
      }
      setIsMultiSelectMode(false);
      setSelectedMessageIds([]);
    } catch (err) {
      console.error("Error recalling selected messages:", err);
      setError(t('chatArea.errRecallSelected'));
    }
  }, [canMultiRecall, selectedMessages, socketService]);

  /** Xóa phía tôi — mọi tin (kể cả người khác gửi) */
  const openDeleteForMe = (msg: Message) => {
    setMessageToDelete(msg);
    setDeleteMode("me");
    setShowDeleteConfirm(true);
    setShowMessageOptions(false);
  };

  /** Thu hồi — chỉ tin của mình */
  const openRecallMessage = (msg: Message) => {
    setMessageToDelete(msg);
    setDeleteMode("everyone");
    setShowDeleteConfirm(true);
    setShowMessageOptions(false);
  };

  // Then update the state variable names:
  const [voteQuestion, setVoteQuestion] = useState("");
  const [voteOptions, setVoteOptions] = useState([""]);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [voteDeadlineDate, setVoteDeadlineDate] = useState(""); // dd/mm/yyyy
  const [voteDeadlineTime, setVoteDeadlineTime] = useState(""); // hh:mm
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(new Date());

  // Change these functions:
  const toggleModelVote = () => {
    setShowVoteModal(!showVoteModal);
  };

  const addVoteOption = () => {
    setVoteOptions([...voteOptions, ""]);
  };

  const handleVoteOptionChange = (index: number, value: string) => {
    const newOptions = [...voteOptions];
    newOptions[index] = value;
    setVoteOptions(newOptions);
  };

  const removeVoteOption = (index: number) => {
    if (voteOptions.length <= 1) return;
    const newOptions = voteOptions.filter((_, i) => i !== index);
    setVoteOptions(newOptions);
  };

  const handleCreateVote = () => {
    // Kiểm tra dữ liệu hợp lệ
    if (!voteQuestion.trim()) {
      // Có thể thêm thông báo lỗi
      return;
    }

    // Lọc ra các lựa chọn không trống
    const filteredOptions = voteOptions.filter((opt) => opt.trim());

    if (filteredOptions.length < 2) {
      // Có thể thêm thông báo lỗi: cần ít nhất 2 lựa chọn
      return;
    }

    // Xử lý deadline (nếu có)
    let deadlineIso = null;
    if (voteDeadlineDate) {
      const timeToUse = voteDeadlineTime || "23:59";
      console.log(
        `[handleCreateVote] Processing deadline: Date=${voteDeadlineDate}, Time=${timeToUse}`,
      );
      deadlineIso = parseAppointmentDateTimeInput(voteDeadlineDate, timeToUse);
      if (!deadlineIso) {
        const errorMsg =
          t('chatArea.errInvalidPollDeadline')
        console.error(`[handleCreateVote] ${errorMsg}`);
        setError(errorMsg);
        return;
      }
      // Validate: deadline phải ở tương lai
      if (new Date(deadlineIso) <= new Date()) {
        const errorMsg = 'Thời hạn bình chọn phải ở tương lai. Vui lòng chọn lại ngày/giờ.';
        console.error(`[handleCreateVote] ${errorMsg}`);
        setError(errorMsg);
        return;
      }
    }

    console.log("[handleCreateVote] Emitting vote:create", {
      conversationId: selectedChat.id,
      question: voteQuestion,
      options: filteredOptions,
      multiple: allowMultipleVotes,
      deadline: deadlineIso,
    });

    // Gửi yêu cầu tạo vote thông qua socket
    socketService.createVote({
      conversationId: selectedChat.id,
      question: voteQuestion,
      options: filteredOptions,
      multiple: allowMultipleVotes,
      deadline: deadlineIso,
    });

    // System message thông báo tạo bình chọn
    const deadlineNotice = deadlineIso
      ? t('chatArea.pollDeadlineNotice').replace('{time}', formatAppointmentTime(deadlineIso))
      : "";
    void sendSystemNotice(
      t('chatArea.sysCreatedPoll').replace('{actor}', actorDisplayName).replace('{question}', voteQuestion.trim()).replace('{notice}', deadlineNotice)
    );

    // Reset form và đóng modal
    setVoteQuestion("");
    setVoteOptions([""]);
    setVoteDeadlineDate("");
    setVoteDeadlineTime("");
    setAllowMultipleVotes(false);
    setShowVoteModal(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    console.log(
      "[onDateChange] event:",
      event?.type,
      "selectedDate:",
      selectedDate,
    );
    setShowDatePicker(false);
    if (selectedDate) {
      setTempSelectedDate(selectedDate);
      const day = selectedDate.getDate().toString().padStart(2, "0");
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
      const year = selectedDate.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;
      console.log("[onDateChange] Setting voteDeadlineDate to:", formattedDate);
      setVoteDeadlineDate(formattedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    console.log(
      "[onTimeChange] event:",
      event?.type,
      "selectedTime:",
      selectedTime,
    );
    setShowTimePicker(false);
    if (selectedTime) {
      // Sync giờ vào tempSelectedDate (giữ ngày đã chọn)
      const next = new Date(tempSelectedDate);
      next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

      // Auto-advance: nếu datetime kết hợp < hiện tại → tăng 1 ngày
      if (next <= new Date()) {
        next.setDate(next.getDate() + 1);
        const dd = next.getDate().toString().padStart(2, "0");
        const mm = (next.getMonth() + 1).toString().padStart(2, "0");
        const yy = next.getFullYear();
        setVoteDeadlineDate(`${dd}/${mm}/${yy}`);
        console.log(`[onTimeChange] Auto-advanced date to: ${dd}/${mm}/${yy}`);
      }

      setTempSelectedDate(next);
      const hours = selectedTime.getHours().toString().padStart(2, "0");
      const minutes = selectedTime.getMinutes().toString().padStart(2, "0");
      const formattedTime = `${hours}:${minutes}`;
      console.log("[onTimeChange] Setting voteDeadlineTime to:", formattedTime);
      setVoteDeadlineTime(formattedTime);
    }
  };

  const setQuickDeadline = (hours: number) => {
    const future = new Date();
    future.setTime(future.getTime() + hours * 60 * 60 * 1000);

    const d = future.getDate().toString().padStart(2, "0");
    const m = (future.getMonth() + 1).toString().padStart(2, "0");
    const y = future.getFullYear();
    const h = future.getHours().toString().padStart(2, "0");
    const min = future.getMinutes().toString().padStart(2, "0");

    setVoteDeadlineDate(`${d}/${m}/${y}`);
    setVoteDeadlineTime(`${h}:${min}`);
    console.log(
      `[setQuickDeadline] Set deadline to ${hours}h later: ${d}/${m}/${y} ${h}:${min}`,
    );
  };

  const openEditMessage = (msg: Message) => {
    if (msg.senderId !== user?.id || msg.isDeletedForEveryone || msg.editedAt)
      return;
    if (msg.type !== MessageType.TEXT) return;
    setMessageToEdit(msg);
    setEditContent(msg.content ?? "");
    setShowEditModal(true);
    setShowMessageOptions(false);
  };

  const confirmEditMessage = async () => {
    if (!messageToEdit) return;
    const next = editContent.trim();
    if (!next) return;
    if (next === String(messageToEdit.content ?? "").trim()) {
      setShowEditModal(false);
      setMessageToEdit(null);
      return;
    }
    try {
      const response: any = await MessageService.edit(
        messageToEdit.id,
        next,
        user?.id,
      );
      if (response?.success === false) {
        setError(response?.message || t('chatArea.errEditMessage'));
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageToEdit.id
            ? { ...m, content: next, editedAt: new Date().toISOString() }
            : m,
        ),
      );
      setShowEditModal(false);
      setMessageToEdit(null);
    } catch (err) {
      console.error("Error editing message:", err);
      setError(t('chatArea.errEditMessage'));
    }
  };

  const recallMessageLocally = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? (() => {
              // Nếu đã là tin thu hồi và đã có bản gốc → giữ nguyên, chỉ đảm bảo cache đồng bộ.
              const existingMeta =
                (m.metadata as { recalledOriginalContent?: unknown } | null) ??
                {};
              const existingOriginal =
                typeof existingMeta.recalledOriginalContent === "string"
                  ? existingMeta.recalledOriginalContent
                  : "";
              if (m.isDeletedForEveryone && existingOriginal) {
                recalledContentCacheRef.current[m.id] = existingOriginal;
                return m;
              }

              const originalContent =
                typeof m.content === "string" ? m.content : "";
              if (originalContent.trim()) {
                recalledContentCacheRef.current[m.id] = originalContent;
              }
              return {
                ...m,
                isDeletedForEveryone: true,
                content: t('chatArea.pollRevoked'),
                metadata: {
                  ...(m.metadata ?? {}),
                  recalledOriginalContent:
                    originalContent ||
                    existingOriginal ||
                    recalledContentCacheRef.current[m.id] ||
                    "",
                },
                mediaItems: [],
              };
            })()
          : m,
      ),
    );
  };

  const getRecalledOriginalContent = (
    msg: Message | null | undefined,
  ): string => {
    if (!msg?.isDeletedForEveryone) return "";
    const raw = (
      msg.metadata as { recalledOriginalContent?: unknown } | null | undefined
    )?.recalledOriginalContent;
    const text = typeof raw === "string" ? raw : "";
    return text || recalledContentCacheRef.current[String(msg.id)] || "";
  };

  const prefillInputFromRecalledMessage = (msg: Message) => {
    const recalledText = getRecalledOriginalContent(msg);
    if (!recalledText.trim()) {
      setError(t('chatArea.errCannotCopyOriginal'));
      return;
    }
    setNewMessage(recalledText);
    setShowMessageOptions(false);
  };

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.isDeletedForEveryone) {
        const recalled = (
          msg.metadata as
            | { recalledOriginalContent?: unknown }
            | null
            | undefined
        )?.recalledOriginalContent;
        if (typeof recalled === "string" && recalled) {
          recalledContentCacheRef.current[msg.id] = recalled;
        }
        return;
      }
      if (
        msg.type === MessageType.TEXT &&
        typeof msg.content === "string" &&
        msg.content.trim()
      ) {
        recalledContentCacheRef.current[msg.id] = msg.content;
      }
    });
  }, [messages]);

  useEffect(() => {
    const handleVoteCreated = (data: { conversationId: string; vote: any }) => {
      if (data.conversationId !== selectedChat?.id) return;
      const vote = mapApiMessageToModel(data.vote);
      setMessages((prev) =>
        prev.some((m) => m.id === vote.id) ? prev : [...prev, vote],
      );
    };

    socketService.onVoteCreated(handleVoteCreated);

    return () => {
      socketService.removeVoteCreatedListener(handleVoteCreated);
    };
  }, [selectedChat?.id]);

  useEffect(() => {
    const loadBlockState = async () => {
      if (!selectedChat?.id || selectedChat.isGroup || !user?.id) {
        setPeerMessageBlockedMe(false);
        setPeerCallBlockedMe(false);
        return;
      }
      const peerId = selectedChat.participantIds.find((id) => id !== user.id);
      if (!peerId) return;
      try {
        const statusRes: any = await blockSettingService.status<any>(
          peerId,
          user.id,
        );
        const status = statusRes?.data ?? statusRes;
        setPeerMessageBlockedMe(Boolean(status?.messageBlocked));
        setPeerCallBlockedMe(Boolean(status?.callBlocked));
      } catch {
        setPeerMessageBlockedMe(false);
        setPeerCallBlockedMe(false);
      }
    };
    void loadBlockState();
  }, [
    selectedChat?.id,
    selectedChat?.isGroup,
    selectedChat?.participantIds,
    user?.id,
  ]);

  useEffect(() => {
    const onBlockUpdated = (payload: any) => {
      if (!selectedChat?.id || payload?.conversationId !== selectedChat.id)
        return;
      if (selectedChat.isGroup || !user?.id) return;
      const peerId = selectedChat.participantIds.find((id) => id !== user.id);
      if (!peerId) return;
      if (payload.blockerId === peerId && payload.blockedId === user.id) {
        setPeerMessageBlockedMe(Boolean(payload.messageBlocked));
        setPeerCallBlockedMe(Boolean(payload.callBlocked));
      }
    };
    socketService.onBlockSettingUpdated(onBlockUpdated);
    return () =>
      socketService.removeBlockSettingUpdatedListener(onBlockUpdated);
  }, [
    selectedChat?.id,
    selectedChat?.isGroup,
    selectedChat?.participantIds,
    user?.id,
  ]);

  useEffect(() => {
    const onNotification = (payload: {
      type?: string;
      title?: string;
      conversationId?: string;
      triggeredAt?: string;
    }) => {
      if (String(payload?.type ?? "").toUpperCase() !== "REMINDER") return;
      if (
        selectedChat?.id &&
        payload?.conversationId &&
        payload.conversationId !== selectedChat.id
      )
        return;
      const title = payload?.title || t('chatArea.defaultAppointment');
      Alert.alert(t('chatArea.reminderAlertTitle'), t('chatArea.reminderAlertMsg').replace('{title}', title));
    };
    socketService.onNotificationNew(onNotification);
    return () =>
      socketService.removeNotificationNewListener(onNotification as any);
  }, [selectedChat?.id, socketService]);

  const confirmDeleteMessage = async () => {
    if (!messageToDelete || !deleteMode) return;

    try {
      if (deleteMode === "me") {
        const response = await MessageService.deleteMessageForMe(
          messageToDelete.id,
        );
        if (response.success) {
          setMessages((prev) =>
            prev.filter((m) => m.id !== messageToDelete.id),
          );
          setShowDeleteConfirm(false);
          setMessageToDelete(null);
          setDeleteMode(null);
        } else {
          setError(response.statusMessage || t('chatArea.errDeleteMessage'));
        }
        return;
      }

      const response = await MessageService.deleteMessage(messageToDelete.id);
      socketService.sendDeleteMessage(messageToDelete);
      if (response.success) {
        recallMessageLocally(messageToDelete.id);
        setShowDeleteConfirm(false);
        setMessageToDelete(null);
        setDeleteMode(null);
      } else {
        setError(response.statusMessage || t('chatArea.errCannotRecallMessage'));
      }
    } catch (err) {
      console.error("Error deleting message:", err);
      setError(t('chatArea.errDeleteMessage'));
    }
  };

  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const displayedPinnedMessages = useMemo(() => {
    return pinnedMessages.filter((m) => {
      const ctx = (m.storyContext ?? {}) as { kind?: string } | null;
      if (ctx?.kind === "appointment") return false;
      const content = String(m.content ?? "").trim().toLowerCase();
      return !content.startsWith("lịch hẹn:");
    });
  }, [pinnedMessages]);
  const [showPinsAndRemindersModal, setShowPinsAndRemindersModal] =
    useState(false);
  const [pinEditMode, setPinEditMode] = useState(false);
  const [upcomingReminders, setUpcomingReminders] = useState<any[]>([]);
  const refreshRemindersRef = useRef<(() => void) | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const messageRefs = useRef<{ [key: string]: number }>({});
  const isDeletingReminderRef = useRef(false);

  const refreshPinnedMessages = useCallback(async () => {
    if (!selectedChat?.id) {
      setPinnedMessages([]);
      return;
    }
    try {
      const res: any = await MessageService.getPinned(selectedChat.id);
      const raw = unwrapData<any>(res);
      const arr = Array.isArray(raw) ? raw : [];
      setPinnedMessages(arr.map((m: any) => mapApiMessageToModel(m)));
    } catch {
      setPinnedMessages([]);
    }
  }, [selectedChat?.id]);

  const refreshReminders = useCallback(async () => {
    if (!selectedChat?.id || !user?.id || isDeletingReminderRef.current) {
      if (!selectedChat?.id || !user?.id) setUpcomingReminders([]);
      return;
    }
    try {
      const res: any = await reminderService.getByConversation(
        selectedChat.id,
        user.id,
      );
      const data = res?.data ?? res;
      const arr = Array.isArray(data) ? data : [];
      const now = new Date();
      const upcoming = arr.filter(
        (r: any) => !r.isTriggered && new Date(r.remindAt) > now,
      );
      const uniqMap = new Map<string, any>();
      for (const r of upcoming) {
        const rid = String(r?._id ?? r?.id ?? `${r?.title}-${r?.remindAt}`);
        if (!uniqMap.has(rid)) uniqMap.set(rid, r);
      }
      const dedupedUpcoming = Array.from(uniqMap.values());
      dedupedUpcoming.sort(
        (a: any, b: any) =>
          new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
      );
      setUpcomingReminders(dedupedUpcoming);
    } catch {
      setUpcomingReminders([]);
    }
  }, [selectedChat?.id, user?.id]);

  useEffect(() => {
    refreshRemindersRef.current = () => {
      void refreshReminders();
    };
  }, [refreshReminders]);

  useEffect(() => {
    void refreshReminders();
  }, [refreshReminders]);

  const movePinUp = (index: number) => {
    if (index <= 0) return;
    setPinnedMessages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const movePinDown = (index: number) => {
    setPinnedMessages((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const savePinOrder = async () => {
    if (!selectedChat?.id) return;
    const orderedIds = pinnedMessages.map((m) => m.id);
    try {
      await ConversationService.reorderPinnedMessages(selectedChat.id, orderedIds);
      socketService.reorderPinnedMessages({
        conversationId: selectedChat.id,
        orderedMessageIds: orderedIds,
      });
    } catch {
      setError(t('chatArea.errSavePinOrder'));
    }
    setPinEditMode(false);
    void refreshPinnedMessages();
  };

  const handleUnpinFromPanel = async (msg: Message) => {
    if (!selectedChat) return;
    try {
      await MessageService.unpin(msg.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, pinned: false, pinnedAt: null } : m,
        ),
      );
      void refreshPinnedMessages();
    } catch {
      setError(t('chatArea.errUnpinMessage'));
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    const sid = String(reminderId);
    try {
      isDeletingReminderRef.current = true;
      setUpcomingReminders((prev) =>
        prev.filter((r) => String(r._id ?? r.id) !== sid),
      );
      await reminderService.delete(sid);
      setTimeout(() => {
        isDeletingReminderRef.current = false;
        void refreshReminders();
      }, 800);
    } catch (err) {
      console.error("handleDeleteReminder error:", err);
      isDeletingReminderRef.current = false;
      setError(t('chatArea.errDeleteReminder'));
      void refreshReminders();
    }
  };

  const handlePinMessage = async (message: Message) => {
    if (!selectedChat) return;
    try {
      const res: any = await MessageService.pin(message.id);
      const data = res?.data || res; // depending on interceptor

      // Check if limit was reached
      if (data?.limitReached || data?.errorCode === "PIN_LIMIT_REACHED") {
        setShowMessageOptions(false);
        setPendingPinMessage(message);
        setShowPinLimitModal(true);
        return;
      }

      setShowMessageOptions(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, pinned: true, pinnedAt: new Date().toISOString() }
            : m,
        ),
      );
      void refreshPinnedMessages();
    } catch (error) {
      console.error("Error pinning message:", error);
      setError(t('chatArea.errPinMessage'));
    }
  };

  const handleReplacePin = async (messageToUnpin: Message) => {
    if (!selectedChat || !pendingPinMessage) return;
    try {
      await MessageService.unpin(messageToUnpin.id);
      await MessageService.pin(pendingPinMessage.id);

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageToUnpin.id)
            return { ...m, pinned: false, pinnedAt: null };
          if (m.id === pendingPinMessage.id)
            return { ...m, pinned: true, pinnedAt: new Date().toISOString() };
          return m;
        }),
      );

      setShowPinLimitModal(false);
      setPendingPinMessage(null);
      void refreshPinnedMessages();
    } catch (e) {
      console.error("Error replacing pinned message:", e);
    }
  };

  const handleUnpinMessage = async (message: Message) => {
    if (!selectedChat) return;
    try {
      await MessageService.unpin(message.id);
      setShowMessageOptions(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, pinned: false, pinnedAt: null } : m,
        ),
      );
      void refreshPinnedMessages();
    } catch (error) {
      console.error("Error unpinning message:", error);
      setError(t('chatArea.errUnpinMessage'));
    }
  };

  const isSelectedMessagePinned = useMemo(() => {
    if (!selectedMessage) return false;
    const sid = String(selectedMessage.id ?? "");
    if (selectedMessage.pinned) return true;
    return pinnedMessages.some((p) => String(p.id ?? "") === sid);
  }, [selectedMessage, pinnedMessages]);

  /** Ghép trạng thái ghim từ GET /pinned vì list tin nhắn thường không có field pinned. */
  const openMessageOptions = useCallback(
    (msg: Message) => {
      const sid = String(msg.id ?? "");
      const fromPinned = pinnedMessages.find((p) => String(p.id ?? "") === sid);
      const isPinned = Boolean(msg.pinned) || Boolean(fromPinned);
      setSelectedMessage({
        ...msg,
        pinned: isPinned,
        pinnedAt: msg.pinnedAt ?? fromPinned?.pinnedAt ?? null,
      });
      setShowMessageOptions(true);
    },
    [pinnedMessages],
  );

  // Socket `message:pinned` (ít field) + REST `chat:message-pinned` — đồng bộ qua GET /pinned
  useEffect(() => {
    const handlePinnedMessage = (data: {
      conversationId?: string;
      pinnedMessages?: Message[];
      message?: any;
    }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (Array.isArray(data.pinnedMessages)) {
        setPinnedMessages(
          data.pinnedMessages.map((m: any) => mapApiMessageToModel(m)),
        );
        return;
      }
      void refreshPinnedMessages();
    };

    socketService.onPinnedMessage(handlePinnedMessage);

    return () => {
      socketService.removePinnedMessageListener(handlePinnedMessage);
    };
  }, [selectedChat?.id, refreshPinnedMessages]);

  useEffect(() => {
    const handlePinsReordered = (data: {
      conversationId?: string;
      pinnedMessages?: any[];
    }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (Array.isArray(data.pinnedMessages)) {
        setPinnedMessages(data.pinnedMessages.map((m: any) => mapApiMessageToModel(m)));
      } else {
        void refreshPinnedMessages();
      }
    };
    socketService.onPinsReordered?.(handlePinsReordered);
    return () => {
      socketService.removePinsReorderedListener?.(handlePinsReordered);
    };
  }, [selectedChat?.id, refreshPinnedMessages, socketService]);

  useEffect(() => {
    const handleUnpinned = (data: { conversationId?: string }) => {
      if (data.conversationId !== selectedChat?.id) return;
      void refreshPinnedMessages();
    };
    socketService.onMessageUnpinned(handleUnpinned);

    const handlePinnedOrderUpdated = (data: {
      conversationId?: string;
      pinnedMessages?: any[];
    }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (Array.isArray(data.pinnedMessages)) {
        setPinnedMessages(
          data.pinnedMessages.map((m: any) => mapApiMessageToModel(m)),
        );
      } else {
        void refreshPinnedMessages();
      }
    };
    socketService.onPinnedOrderUpdated?.(handlePinnedOrderUpdated);

    return () => {
      socketService.removeMessageUnpinnedListener(handleUnpinned);
      socketService.removePinnedOrderUpdatedListener?.(
        handlePinnedOrderUpdated,
      );
    };
  }, [selectedChat?.id, refreshPinnedMessages]);

  useEffect(() => {
    if (!selectedChat) {
      setPinnedMessages([]);
    } else if (selectedChat.pinMessages?.length) {
      setPinnedMessages(
        selectedChat.pinMessages.map((m) => mapApiMessageToModel(m as any)),
      );
    }
    void refreshPinnedMessages();
  }, [selectedChat?.id, refreshPinnedMessages]);

  useEffect(() => {
    const onRemoteDelete = (payload: any) => {
      const mid = String(
        payload?.messageId ?? payload?.id ?? payload?._id ?? "",
      );
      const cid = payload?.conversationId;
      if (!mid || cid !== selectedChat?.id) return;
      recallMessageLocally(mid);
    };
    socketService.onMessageDeletedForEveryone(onRemoteDelete);
    return () => {
      socketService.removeMessageDeletedForEveryoneListener(onRemoteDelete);
    };
  }, [selectedChat?.id]);

  useEffect(() => {
    setIsMultiSelectMode(false);
    setSelectedMessageIds([]);
    setForwardTargets([]);
  }, [selectedChat?.id]);

  useEffect(() => {
    const onMessageEdited = (payload: any) => {
      const editedRaw = payload?.message ?? payload;
      const editedMsg = mapApiMessageToModel(editedRaw);
      if (!editedMsg?.id) return;
      if (String(editedMsg.conversationId) !== String(selectedChat?.id)) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editedMsg.id
            ? {
                ...m,
                content: editedMsg.content ?? m.content,
                editedAt: editedMsg.editedAt ?? new Date().toISOString(),
              }
            : m,
        ),
      );
    };
    socketService.onMessageEdited(onMessageEdited);
    return () => {
      socketService.removeMessageEditedListener(onMessageEdited);
    };
  }, [selectedChat?.id]);

  const scrollToMessage = (messageId: string): boolean => {
    if (!messageId) return false;

    // Find the message index in the messages array
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) {
      setError(t('chatArea.errCannotFindOriginalMsg'));
      return false;
    }

    // Get the position from refs or calculate approximate position
    const yOffset = messageRefs.current[messageId] || messageIndex * 80;

    // Scroll to the message
    scrollViewRef.current?.scrollTo({ y: yOffset, animated: true });

    // Highlight the message briefly
    setHighlightedMessageId(messageId);
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1500);

    // Close pin/reminder overlays when jumping
    setShowPinsAndRemindersModal(false);
    return true;
  };

  useEffect(() => {
    if (initialScrollMessageId && messages.length > 0) {
      // Wait a bit to ensure the message list and refs are settled
      const tid = setTimeout(() => {
        const ok = scrollToMessage(initialScrollMessageId);
        // Whether successful or not (message might not be in loaded set),
        // we notify the parent we've attempted the scroll to avoid infinite loops.
        onInitialScrollDone?.();
      }, 600);
      return () => clearTimeout(tid);
    }
  }, [initialScrollMessageId, messages.length]);

  const openExternalLink = useCallback((href: string) => {
    if (!href) return;

    try {
      const normalized = href.startsWith("zala://")
        ? href.replace("zala://", "http://")
        : href;
      const url = new URL(normalized);
      const isJoinLink =
        href.startsWith("zala://join/") ||
        url.pathname === "/join" ||
        href.includes("/join?conversationId=");

      if (isJoinLink) {
        let conversationId = "";
        let code = "";

        if (href.startsWith("zala://join/")) {
          const parts = href.split("/");
          if (parts.length >= 5) {
            conversationId = parts[3] ?? "";
            code = parts[4] ?? "";
          }
        } else {
          conversationId = url.searchParams.get("conversationId") || "";
          code = url.searchParams.get("code") || "";
        }

        if (conversationId && code) {
          router.push({
            pathname: "/(main)/join",
            params: { conversationId, code },
          });
          return;
        }
      }
    } catch {
      // Fall through to default open link.
    }

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    Linking.openURL(href).catch(() => {
      setError(t('chatArea.errCannotOpenLink'));
    });
  }, [router]);

  const renderTextWithLinks = useCallback(
    (text: string, isSender: boolean, messageId: string) => {
      // Thu thập đầy đủ tên thành viên để Regex có thể bắt được các tên có dấu cách
      const memberNames = (selectedChat?.participantInfo || [])
        .map((p) => {
          const userInfo = messageUsers[p.id];
          return (
            p.nickname || p.name || userInfo?.name || userInfo?.displayName
          );
        })
        .filter(Boolean) as string[];

      return splitTextIntoChunks(text, memberNames).map((chunk, index) => {
        const key = `${messageId}-chunk-${index}`;

        if (chunk.isMention) {
          return (
            <Text
              key={key}
              style={{
                color: isSender ? "#BFDBFE" : "#2563EB",
                fontWeight: "700",
              }}
            >
              {chunk.value}
            </Text>
          );
        }

        if (!chunk.href) {
          return <Text key={key}>{chunk.value}</Text>;
        }

        return (
          <Text
            key={`${messageId}-link-${index}`}
            suppressHighlighting
            style={{
              color: isSender ? "#BFDBFE" : "#2563EB",
              textDecorationLine: "underline",
            }}
            onPress={(event: any) => {
              event?.stopPropagation?.();
              void openExternalLink(chunk.href as string);
            }}
          >
            {chunk.value}
          </Text>
        );
      });
    },
    [selectedChat?.participantInfo, messageUsers, openExternalLink],
  );

  if (!selectedChat) {
    const displayName = user?.displayName || user?.name || "";
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
          {t('chatArea.welcomeToZala')}
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
            ? t('chatArea.selectChatDesktop')
            : t('chatArea.selectChatMobile')}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#6d28d9" />
        <Text style={{ marginTop: 12, color: "#6b7280", fontSize: 15 }}>
          {t('chatArea.loading')}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-red-500">{t('chatArea.errorPrefix')}{error}</Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1 flex-col"
      style={{ flex: 1, paddingBottom: keyboardInset }}
    >
      {/* Chat Header */}
      <ChatHeader
        selectedChat={selectedChat}
        onBackPress={onBackPress}
        onInfoPress={onInfoPress}
        callBlocked={peerCallBlockedMe}
        onCreateAppointment={createAppointment}
        onOpenScheduleRef={openScheduleRef}
        onOpenNicknameRef={openNicknameRef}
        onNicknameUpdated={(payload) => {
          const { nickname, previousNickname, action } = payload;
          if (action === "set") {
            void sendSystemNotice(
              t('chatArea.sysSetNickname')
                .replace('{actor}', actorDisplayName)
                .replace('{nickname}', nickname)
                .replace('{peer}', peerDisplayName)
            );
          } else if (action === "clear") {
            void sendSystemNotice(
              previousNickname
                ? t('chatArea.sysClearNickname')
                    .replace('{actor}', actorDisplayName)
                    .replace('{previous}', previousNickname)
                    .replace('{peer}', peerDisplayName)
                : t('chatArea.sysClearNicknameNoPrev')
                    .replace('{actor}', actorDisplayName)
                    .replace('{peer}', peerDisplayName)
            );
          } else {
            void sendSystemNotice(
              t('chatArea.sysChangeNickname')
                .replace('{actor}', actorDisplayName)
                .replace('{previous}', previousNickname || t('chatArea.emptyNicknameFallback'))
                .replace('{nickname}', nickname || t('chatArea.emptyNicknameFallback'))
                .replace('{peer}', peerDisplayName)
            );
          }
          onConversationMetaChanged?.();
        }}
      />

      {/* Messages Area with dynamic wallpaper */}
      {(() => {
        const activeBg =
          CHAT_BACKGROUNDS.find((b) => b.id === chatBgId) ??
          CHAT_BACKGROUNDS[0];
        const activeBgFill = String((activeBg as any)["value"] ?? "#f9fafb");
        const bgProps =
          activeBg.type === "image"
            ? {
                source: { uri: activeBgFill },
                imageStyle: { opacity: 0.75 } as any,
              }
            : { source: {} };
        return (
          <ImageBackground
            {...bgProps}
            style={[
              { flex: 1 },
              activeBg.type === "color"
                ? { backgroundColor: activeBgFill }
                : undefined,
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              className={`flex-1 p-4 ${pinnedMessages.length > 0 ? "pt-16" : "pt-4"}`}
              removeClippedSubviews={false}
              keyboardShouldPersistTaps="handled"
              onScroll={handleMessagesScroll}
              scrollEventThrottle={16}
              onContentSizeChange={handleMessagesContentSizeChange}
              contentContainerStyle={{
                paddingBottom: isMultiSelectMode
                  ? mobileBottomSafeOffset + 4
                  : Platform.OS === "web"
                    ? 0
                    : mobileBottomSafeOffset + 16,
              }}
            >
              {hasOlderMessages && showLoadOlderButton && (
                <View className="items-center mb-3">
                  <TouchableOpacity
                    onPress={loadOlderMessages}
                    disabled={loadingOlderMessages}
                    activeOpacity={0.85}
                    className="px-4 py-2 rounded-full bg-white border border-gray-200 flex-row items-center"
                    style={Shadows.sm}
                  >
                    {loadingOlderMessages ? (
                      <ActivityIndicator size="small" color="#6B7280" />
                    ) : (
                      <Ionicons
                        name="arrow-up-circle-outline"
                        size={16}
                        color="#6B7280"
                      />
                    )}
                    <Text style={{ marginLeft: 6, color: "#6B7280", fontSize: 14 }}>
                      {loadingOlderMessages
                        ? t('chatArea.loadingOlderData')
                        : t('chatArea.loadOlderDataPrompt')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {messages.length === 0 && (
                <ChatNewer selectedChat={selectedChat} />
              )}

              {/* Render messages */}
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
                                  ? t('chatArea.image')
                                  : rType === MessageType.VIDEO
                                    ? "Video"
                                    : rType === MessageType.AUDIO
                                      ? t('chatArea.voiceMessage')
                                      : rType === MessageType.FILE
                                        ? ((repliedToMessage?.metadata as any)
                                            ?.fileName ?? "File")
                                        : rType === MessageType.MEDIA_ALBUM
                                          ? t('chatArea.mediaAlbum')
                                          : repliedToMessage?.content ||
                                            t('chatArea.messageDeleted');

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
                                    {t('chatArea.pollRevoked')}
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
                                    ) : /^https?:\/\/.+\.(gif|png|jpg|jpeg|webp)(\?.*)?$/i.test(String(msg.content ?? "").trim()) || /^https?:\/\/media\d*\.giphy\.com\//i.test(String(msg.content ?? "").trim()) ? (
                                      <TouchableOpacity activeOpacity={0.85} onPress={() => setFullScreenImage(String(msg.content).trim())}>
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
                                                  t('chatArea.cannotOpenMap'),
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
                                          ? t('chatArea.image')
                                          : msg.type === MessageType.VIDEO
                                            ? "Video"
                                            : msg.type === MessageType.AUDIO
                                              ? t('chatArea.voiceMessage')
                                              : t('chatArea.fileLabel'))
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
                                      <View className="flex-col">
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
                                                return t('chatArea.callStarting');
                                              return d
                                                ? t('chatArea.callEndedDuration').replace('{duration}', d)
                                                : t('chatArea.callEnded');
                                            }

                                            if (msg.content === "start")
                                              return t('chatArea.groupCallStarting');
                                            if (msg.content === "group_declined")
                                              return t('chatArea.groupCallDeclined').replace('{actorName}', actorName);
                                            if (msg.content === "group_joined")
                                              return t('chatArea.groupCallJoined').replace('{actorName}', actorName);
                                            if (msg.content === "group_left")
                                              return t('chatArea.groupCallLeft').replace('{actorName}', actorName);
                                            return d
                                              ? t('chatArea.groupCallEndedDuration').replace('{duration}', d)
                                              : t('chatArea.groupCallEnded');
                                          })()}
                                        </Text>
                                        
                                        {/* Nút Tham gia cuộc gọi nhóm */}
                                        {msg.content === "start" && (
                                          (() => {
                                            const ctx = (msg.storyContext ?? {}) as any;
                                            const isGroupCall = Boolean(ctx?.isGroupCall) || Boolean(selectedChat?.isGroup);
                                            const sessionId = ctx?.callSessionId;
                                            // Kiểm tra xem đã có tin nhắn kết thúc (end/missed) cho session này chưa
                                            const isEnded = messages.some(
                                              (m) =>
                                                m.type === MessageType.CALL &&
                                                (m.content === "end" || m.content === "missed") &&
                                                (m.storyContext as any)?.callSessionId === sessionId
                                            );

                                            if (isGroupCall && !isEnded) {
                                              return (
                                                <TouchableOpacity
                                                  className="mt-2 bg-blue-500 rounded px-4 py-2 self-start flex-row items-center justify-center"
                                                  onPress={() => {
                                                    if (activeCallCtx?.joinOngoingCall && selectedChat) {
                                                      activeCallCtx.joinOngoingCall(
                                                        selectedChat.id,
                                                        sessionId || "",
                                                        msg.id,
                                                        ctx?.callType || "VIDEO"
                                                      );
                                                    }
                                                  }}
                                                >
                                                  <Text className="text-white text-sm font-bold">Tham gia cuộc gọi</Text>
                                                </TouchableOpacity>
                                              );
                                            }
                                            return null;
                                          })()
                                        )}
                                      </View>
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
                              {t('chatArea.msgSending')}
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
                                {t('chatArea.msgSendError')}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {msg.editedAt && !msg.isDeletedForEveryone && (
                            <Text className="text-[11px] text-gray-400 mt-1 italic">
                              {t('chatArea.msgEdited')}
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
                                      {t('chatArea.msgSeenAll')}
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
                                          {t('chatArea.msgReceived')}
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
                                        {t('chatArea.msgSent')}
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
            </ScrollView>
          </ImageBackground>
        );
      })()}

      {/* Vote Modal */}
      {showVoteModal && (
        <View className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center">
          <View className="bg-white rounded-2xl p-5 w-[90%] max-w-md">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-semibold">{t('chatArea.createPollTitle')}</Text>
              <TouchableOpacity onPress={toggleModelVote}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Vote Question */}
            <View className="mb-5">
              <Text className="text-gray-500 mb-2">{t('chatArea.pollSubject')}</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 min-h-[45px] text-base"
                placeholder={t('chatArea.pollQuestionPlaceholder')}
                value={voteQuestion}
                onChangeText={setVoteQuestion}
                multiline
                maxLength={200}
              />
              <Text className="text-right text-gray-500 mt-1">
                {voteQuestion.length}/200
              </Text>
            </View>

            {/* Vote Options */}
            <View className="mb-5">
              <Text className="text-gray-500 mb-2">{t('chatArea.pollOptions')}</Text>
              {voteOptions.map((option, index) => (
                <View
                  key={`option-${index}`}
                  className="flex-row items-center mb-3"
                >
                  <TextInput
                    className="flex-1 border border-gray-300 rounded-lg p-3 min-h-[45px] text-base"
                    placeholder={t('chatArea.pollOptionPlaceholder').replace('{index}', String(index + 1))}
                    value={option}
                    onChangeText={(text) => handleVoteOptionChange(index, text)}
                  />
                  {voteOptions.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeVoteOption(index)}
                      className="ml-2 p-2"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#ef4444"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Add option button */}
              <TouchableOpacity
                className="flex-row items-center mb-5"
                onPress={addVoteOption}
              >
                <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
                <Text className="ml-2 text-blue-500">{t('chatArea.addOption')}</Text>
              </TouchableOpacity>

              {/* Deadline selection */}
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-500">
                  {t('chatArea.deadlineLabel')}
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setQuickDeadline(1)}
                    className="bg-blue-50 px-2 py-1 rounded"
                  >
                    <Text className="text-blue-600 text-xs font-medium">
                      {t('chatArea.plus1Hour')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setQuickDeadline(24)}
                    className="bg-blue-50 px-2 py-1 rounded"
                  >
                    <Text className="text-blue-600 text-xs font-medium">
                      {t('chatArea.plus24Hours')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row gap-2 mb-2">
                <View className="flex-1 relative">
                  {Platform.OS === "web" ? (
                    <View className="flex-row items-center border border-gray-300 rounded-lg bg-white p-2">
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color="#666"
                        style={{ marginRight: 8 }}
                      />
                      <input
                        type="date"
                        min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()}
                        value={
                          voteDeadlineDate
                            ? voteDeadlineDate.split("/").reverse().join("-")
                            : ""
                        }
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: "14px",
                          color: voteDeadlineDate ? "#000" : "#9ca3af",
                        }}
                        onChange={(e) => {
                          const val = e.target.value; // YYYY-MM-DD
                          console.log("[Web-input:date] onChange:", val);
                          if (val) {
                            const [y, m, d] = val.split("-");
                            onDateChange(
                              {},
                              new Date(
                                parseInt(y),
                                parseInt(m) - 1,
                                parseInt(d),
                              ),
                            );
                          } else {
                            setVoteDeadlineDate("");
                          }
                        }}
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="w-full border border-gray-300 rounded-lg p-3 justify-center"
                      onPress={() => {
                        console.log("[ChatArea] Opening DatePicker (Mobile)");
                        setShowDatePicker(true);
                      }}
                    >
                      <Text
                        style={{ color: voteDeadlineDate ? "#000" : "#9ca3af" }}
                      >
                        {voteDeadlineDate || t('chatArea.selectDate')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View className="flex-1 relative">
                  {Platform.OS === "web" ? (
                    <View className="flex-row items-center border border-gray-300 rounded-lg bg-white p-2">
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color="#666"
                        style={{ marginRight: 8 }}
                      />
                      <input
                        type="time"
                        value={voteDeadlineTime || ""}
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: "14px",
                          color: voteDeadlineTime ? "#000" : "#9ca3af",
                        }}
                        onChange={(e) => {
                          const val = e.target.value; // HH:MM
                          console.log("[Web-input:time] onChange:", val);
                          if (val) {
                            const [h, min] = val.split(":");
                            const d = new Date(tempSelectedDate || new Date());
                            d.setHours(parseInt(h));
                            d.setMinutes(parseInt(min));
                            onTimeChange({}, d);
                          } else {
                            setVoteDeadlineTime("");
                          }
                        }}
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="w-full border border-gray-300 rounded-lg p-3 justify-center"
                      onPress={() => {
                        console.log("[ChatArea] Opening TimePicker (Mobile)");
                        setShowTimePicker(true);
                      }}
                    >
                      <Text
                        style={{ color: voteDeadlineTime ? "#000" : "#9ca3af" }}
                      >
                        {voteDeadlineTime || t('chatArea.selectTime')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Mobile Pickers */}
              {Platform.OS !== "web" && showDatePicker && (
                <DateTimePicker
                  value={tempSelectedDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}

              {Platform.OS !== "web" && showTimePicker && (
                <DateTimePicker
                  value={tempSelectedDate}
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={onTimeChange}
                />
              )}
            </View>

            <View className="flex-row items-center mb-5">
              <Switch
                value={allowMultipleVotes}
                onValueChange={setAllowMultipleVotes}
                trackColor={{ false: "#d1d5db", true: "#bfdbfe" }}
                thumbColor={allowMultipleVotes ? "#3B82F6" : "#9ca3af"}
              />
              <Text className="ml-2 text-gray-700">
                {t('chatArea.allowMultipleChoices')}
              </Text>
            </View>

            {/* Footer buttons */}
            <View className="flex-row justify-end mt-2">
              <TouchableOpacity
                className="px-5 py-2 mr-2 rounded-lg bg-gray-100"
                onPress={toggleModelVote}
              >
                <Text className="font-medium text-gray-700">{t('chatArea.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="px-5 py-2 rounded-lg bg-blue-500"
                onPress={handleCreateVote}
              >
                <Text className="font-medium text-white">{t('chatArea.createPollBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Message Options Modal */}
      {showMessageOptions && selectedMessage && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center">
          <View className="bg-white rounded-2xl w-[90%] max-w-md overflow-hidden shadow-lg">
            {/* Modal content */}
            <View className="p-4 border-b border-gray-100">
              <View className="flex-row items-center">
                <Image
                  source={{
                    uri: getSenderAvatar(selectedMessage.senderId),
                  }}
                  className="w-10 h-10 rounded-full"
                  resizeMode="cover"
                />
                <View className="ml-3 flex-1">
                  <Text className="text-gray-800 font-medium">
                    {getSenderDisplayLabel(selectedMessage.senderId)}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {new Date(selectedMessage.sentAt).toLocaleString("vi-VN", {
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
                <Text className="text-gray-800">
                  {(() => {
                    if (selectedMessage.isDeletedForEveryone) {
                      return (
                        getRecalledOriginalContent(selectedMessage) ||
                        t('chatArea.pollRevoked')
                      );
                    }
                    if (selectedMessage.type === MessageType.VOTE) {
                      try {
                        const data = JSON.parse(selectedMessage.content);
                        return `${t('chatArea.pollPrefixMsg')} ${data.question}`;
                      } catch (e) {
                        return selectedMessage.content;
                      }
                    }
                    return selectedMessage.content;
                  })()}
                </Text>
              </View>
            </View>
            <View className="divide-y divide-gray-100">
              <TouchableOpacity
                className="flex-row items-center p-4 active:bg-gray-50"
                onPress={() => {
                  handleReplyMessage(selectedMessage);
                }}
              >
                <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                  <Ionicons name="return-up-back" size={20} color="#3B82F6" />
                </View>
                <Text className="ml-3 text-gray-800">{t('chatArea.reply')}</Text>
              </TouchableOpacity>

              {selectedMessage.isDeletedForEveryone &&
                Boolean(getRecalledOriginalContent(selectedMessage)) && (
                  <TouchableOpacity
                    className="flex-row items-center p-4 active:bg-gray-50"
                    onPress={() =>
                      prefillInputFromRecalledMessage(selectedMessage)
                    }
                  >
                    <View className="w-8 h-8 rounded-full bg-violet-50 items-center justify-center">
                      <Ionicons name="copy-outline" size={20} color="#7c3aed" />
                    </View>
                    <Text className="ml-3 text-gray-800">
                      {t('chatArea.copyRecalled')}
                    </Text>
                  </TouchableOpacity>
                )}

              {selectedMessage.senderId === user?.id &&
                selectedMessage.type === MessageType.TEXT &&
                !selectedMessage.isDeletedForEveryone &&
                !selectedMessage.editedAt && (
                  <TouchableOpacity
                    className="flex-row items-center p-4 active:bg-gray-50"
                    onPress={() => openEditMessage(selectedMessage)}
                  >
                    <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color="#D97706"
                      />
                    </View>
                    <Text className="ml-3 text-gray-800">{t('chatArea.edit')}</Text>
                  </TouchableOpacity>
                )}

              {selectedMessage.senderId === user?.id &&
                selectedMessage.type === MessageType.TEXT &&
                !selectedMessage.isDeletedForEveryone &&
                Boolean(getAppointmentContext(selectedMessage)) && (
                  <TouchableOpacity
                    className="flex-row items-center p-4 active:bg-gray-50"
                    onPress={() => openAppointmentEditModal(selectedMessage)}
                  >
                    <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#2563eb"
                      />
                    </View>
                    <Text className="ml-3 text-gray-800">{t('chatArea.editAppointment')}</Text>
                  </TouchableOpacity>
                )}

              {selectedMessage.senderId === user?.id &&
                selectedMessage.type === MessageType.TEXT &&
                !selectedMessage.isDeletedForEveryone &&
                Boolean(getAppointmentContext(selectedMessage)) && (
                  <TouchableOpacity
                    className="flex-row items-center p-4 active:bg-gray-50"
                    onPress={() => {
                      Alert.alert(
                        t('chatArea.cancelAppointment'),
                        t('chatArea.cancelAppointmentConfirm'),
                        [
                          { text: t('chatArea.cancel'), style: "cancel" },
                          {
                            text: t('chatArea.cancelConfirmBtn'),
                            style: "destructive",
                            onPress: () => {
                              void cancelAppointmentFromMessage(
                                selectedMessage,
                              );
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        color="#dc2626"
                      />
                    </View>
                    <Text className="ml-3 text-red-500">{t('chatArea.cancelAppointment')}</Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                className="flex-row items-center p-4 active:bg-gray-50"
                onPress={() => handleForwardMessage(selectedMessage)}
              >
                <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                  <Ionicons name="arrow-redo" size={20} color="#3B82F6" />
                </View>
                <Text className="ml-3 text-gray-800">{t('chatArea.forward')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center p-4 active:bg-gray-50"
                onPress={() => handleEnterMultiSelect(selectedMessage)}
              >
                <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
                  <Ionicons
                    name="checkmark-done-outline"
                    size={20}
                    color="#4F46E5"
                  />
                </View>
                <Text className="ml-3 text-gray-800">{t('chatArea.multiSelect')}</Text>
              </TouchableOpacity>

              {!selectedMessage.isDeletedForEveryone &&
                !isSelectedMessagePinned &&
                (groupChat.isAdminOrMod || groupChat.isAllowMemberPin) && (
                  <TouchableOpacity
                    className="flex-row items-center p-4 active:bg-gray-50"
                    onPress={() => void handlePinMessage(selectedMessage)}
                  >
                    <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                      <Image
                        source={{
                          uri: "https://res-zalo.zadn.vn/upload/media/2023/8/23/ic_pin_1692773653119_121326.png",
                        }}
                        style={{ width: 18, height: 18 }}
                        resizeMode="contain"
                      />
                    </View>
                    <Text className="ml-3 text-gray-800">{t('chatArea.pinMessage')}</Text>
                  </TouchableOpacity>
                )}
              {!selectedMessage.isDeletedForEveryone &&
                isSelectedMessagePinned &&
                (groupChat.isAdminOrMod || groupChat.isAllowMemberPin) && (
                  <TouchableOpacity
                    className="flex-row items-center p-4 active:bg-gray-50"
                    onPress={() => void handleUnpinMessage(selectedMessage)}
                  >
                    <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                      <Image
                        source={{
                          uri: "https://res-zalo.zadn.vn/upload/media/2023/8/23/ic_pin_1692773653119_121326.png",
                        }}
                        style={{ width: 18, height: 18, opacity: 0.6 }}
                        resizeMode="contain"
                      />
                    </View>
                    <Text className="ml-3 text-gray-800">{t('chatArea.unpinMessage')}</Text>
                  </TouchableOpacity>
                )}

              {!selectedMessage.isDeletedForEveryone && (
                <TouchableOpacity
                  className="flex-row items-center p-4 active:bg-gray-50"
                  onPress={() => openDeleteForMe(selectedMessage)}
                >
                  <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                    <Ionicons
                      name="eye-off-outline"
                      size={20}
                      color="#6b7280"
                    />
                  </View>
                  <Text className="ml-3 text-gray-800">{t('chatArea.deleteForMe')}</Text>
                </TouchableOpacity>
              )}

              {selectedMessage.senderId === user?.id &&
                !selectedMessage.isDeletedForEveryone && (
                  <TouchableOpacity
                    className="flex-row items-center p-4 active:bg-gray-50"
                    onPress={() => openRecallMessage(selectedMessage)}
                  >
                    <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                      <Ionicons name="trash" size={20} color="#EF4444" />
                    </View>
                    <Text className="ml-3 text-red-500">
                      {t('chatArea.recallMessageAll')}
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
              onPress={() => setShowMessageOptions(false)}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit Message Modal */}
      {showEditModal && messageToEdit && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center z-40">
          <View className="bg-white rounded-2xl w-[90%] max-w-md overflow-hidden shadow-lg">
            <View className="p-5 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-800 mb-2">
                {t('chatArea.editMessageTitle')}
              </Text>
              <Text className="text-sm text-gray-500">
                {t('chatArea.editMessageWarning')}
              </Text>
            </View>
            <View className="p-4">
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 min-h-[90px]"
                multiline
                value={editContent}
                onChangeText={setEditContent}
                placeholder={t('chatArea.editMessagePlaceholder')}
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View className="flex-row p-4 border-t border-gray-100">
              <TouchableOpacity
                className="flex-1 mr-2 h-12 rounded-xl bg-gray-100 items-center justify-center active:bg-gray-200"
                onPress={() => {
                  setShowEditModal(false);
                  setMessageToEdit(null);
                }}
              >
                <Text className="text-gray-800 font-medium">{t('chatArea.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90"
                style={{ backgroundColor: "#2563eb" }}
                onPress={confirmEditMessage}
              >
                <Text
                  style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}
                >
                  {t('chatArea.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showAppointmentEditModal && appointmentTargetMessage && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center z-40">
          <View className="bg-white rounded-2xl w-[90%] max-w-md overflow-hidden shadow-lg">
            <View className="p-5 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-800 mb-1">
                {t('chatArea.editAppointmentTitle')}
              </Text>
              <Text className="text-sm text-gray-500">
                {t('chatArea.editAppointmentDesc')}
              </Text>
            </View>
            <View className="p-4">
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 mb-3"
                value={appointmentEditTitle}
                onChangeText={setAppointmentEditTitle}
                placeholder={t('chatArea.appointmentTitlePlaceholder')}
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 mb-3"
                value={appointmentEditDate}
                onChangeText={setAppointmentEditDate}
                placeholder={t('chatArea.datePlaceholder')}
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900"
                value={appointmentEditTime}
                onChangeText={setAppointmentEditTime}
                placeholder={t('chatArea.timePlaceholder')}
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View className="flex-row p-4 border-t border-gray-100">
              <TouchableOpacity
                className="flex-1 mr-2 h-12 rounded-xl bg-gray-100 items-center justify-center active:bg-gray-200"
                onPress={() => {
                  setShowAppointmentEditModal(false);
                  setAppointmentTargetMessage(null);
                }}
              >
                <Text className="text-gray-800 font-medium">{t('chatArea.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90 bg-blue-600"
                onPress={() => {
                  const nextTitle = appointmentEditTitle.trim();
                  if (!nextTitle) {
                    setError(t('chatArea.invalidTitle'));
                    return;
                  }
                  const nextIso = parseAppointmentDateTimeInput(
                    appointmentEditDate,
                    appointmentEditTime,
                  );
                  if (!nextIso) {
                    setError(t('chatArea.invalidDateTime'));
                    return;
                  }
                  if (new Date(nextIso).getTime() <= Date.now() + 15_000) {
                    setError(t('chatArea.futureTimeRequired'));
                    return;
                  }
                  setShowAppointmentEditModal(false);
                  void updateAppointmentFromMessage(
                    appointmentTargetMessage,
                    nextTitle,
                    nextIso,
                  );
                  setAppointmentTargetMessage(null);
                }}
              >
                <Text
                  style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}
                >
                  {t('chatArea.saveChanges')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && messageToDelete && deleteMode && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center">
          <View className="bg-white rounded-2xl w-[90%] max-w-md overflow-hidden shadow-lg">
            <View className="p-6 items-center">
              <View
                className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
                  deleteMode === "me" ? "bg-gray-100" : "bg-red-50"
                }`}
              >
                <Ionicons
                  name={deleteMode === "me" ? "eye-off-outline" : "trash"}
                  size={32}
                  color={deleteMode === "me" ? "#6b7280" : "#EF4444"}
                />
              </View>
              <Text className="text-xl font-semibold text-gray-800 mb-2">
                {deleteMode === "me" ? t('chatArea.deleteForMe') : t('chatArea.recallMessage')}
              </Text>
              <Text className="text-gray-600 text-center">
                {deleteMode === "me"
                  ? t('chatArea.deleteForMeDesc')
                  : t('chatArea.recallDesc')}
              </Text>
            </View>
            <View className="flex-row p-4 border-t border-gray-100">
              <TouchableOpacity
                className="flex-1 mr-2 h-12 rounded-xl bg-gray-100 items-center justify-center active:bg-gray-200"
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setMessageToDelete(null);
                  setDeleteMode(null);
                }}
              >
                <Text className="text-gray-800 font-medium">{t('chatArea.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90"
                style={{
                  backgroundColor: deleteMode === "me" ? "#1f2937" : "#ef4444",
                }}
                onPress={confirmDeleteMessage}
              >
                <Text
                  style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}
                >
                  {deleteMode === "me" ? t('chatArea.deleteForMe') : t('chatArea.recall')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Reply Preview bar */}
      {replyingTo &&
        !peerMessageBlockedMe &&
        (() => {
          const rType = replyingTo.type;
          const previewIcon =
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
          const previewLabel =
            rType === MessageType.IMAGE
              ? t('chatArea.image')
              : rType === MessageType.VIDEO
                ? "Video"
                : rType === MessageType.AUDIO
                  ? t('chatArea.voiceMessage')
                  : rType === MessageType.FILE
                    ? ((replyingTo.metadata as any)?.fileName ?? "File")
                    : rType === MessageType.MEDIA_ALBUM
                      ? t('chatArea.mediaAlbum')
                      : replyingTo.content || "";

          return (
            <View
              style={{
                backgroundColor: "#F8FAFF",
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                borderTopWidth: 1,
                borderTopColor: "#E5E7EB",
                gap: 10,
              }}
            >
              {/* Accent */}
              <View
                style={{
                  width: 3,
                  alignSelf: "stretch",
                  backgroundColor: "#0068FF",
                  borderRadius: 2,
                }}
              />

              {/* Thumbnail nhỏ nếu là ảnh */}
              {(rType === MessageType.IMAGE ||
                rType === MessageType.MEDIA_ALBUM) && (
                <Image
                  source={{
                    uri:
                      (replyingTo.metadata as any)?.cdnUrl ??
                      replyingTo.mediaItems?.[0]?.cdnUrl ??
                      "https://placehold.co/40x40/0068FF/fff",
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: "#D1D5DB",
                  }}
                  resizeMode="cover"
                />
              )}

              {/* Icon box cho file/audio/video */}
              {previewIcon &&
                rType !== MessageType.IMAGE &&
                rType !== MessageType.MEDIA_ALBUM && (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: "#EFF6FF",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={previewIcon as any}
                      size={20}
                      color="#0068FF"
                    />
                  </View>
                )}

              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    marginBottom: 3,
                  }}
                >
                  <Ionicons name="return-up-back" size={13} color="#0068FF" />
                  <Text
                    style={{
                      color: "#0068FF",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {getSenderDisplayLabel(replyingTo.senderId)}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  {previewIcon && (
                    <Ionicons
                      name={previewIcon as any}
                      size={12}
                      color="#9CA3AF"
                    />
                  )}
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 13, color: "#6B7280", flex: 1 }}
                  >
                    {previewLabel}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setReplyingTo(null)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "#E5E7EB",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={14} color="#6B7280" />
              </TouchableOpacity>
            </View>
          );
        })()}

      {/* ── Typing Indicator ── */}
      {Object.keys(typingUsers).length > 0 &&
        !peerMessageBlockedMe &&
        groupChat.canSendMessage && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 4,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <ActivityIndicator
              size="small"
              color="#9CA3AF"
              style={{ marginRight: 6, transform: [{ scale: 0.7 }] }}
            />
            <Text style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
              {Object.keys(typingUsers).length === 1
                ? `${getSenderName(Object.keys(typingUsers)[0])} ${t('chatArea.typingOne')}`
                : `${Object.keys(typingUsers).length} ${t('chatArea.typingMultiple')}`}
            </Text>
          </View>
        )}

      {/* ── Attachment Queue (Zalo-style) ── */}
      {!peerMessageBlockedMe && (
        <AttachmentQueue
          items={pendingAttachments}
          onRemove={handleRemovePending}
          onAddMore={handleSelectFile}
        />
      )}

      {/* Forward Message Modal */}
      {showForwardModal && (forwardTargets.length > 0 || replyingTo) && (
        <ForwardMessageModal
          message={forwardTargets[0] ?? replyingTo ?? undefined}
          messages={forwardTargets}
          onClose={() => setShowForwardModal(false)}
          onForward={handleForward}
        />
      )}

      {/* Multi-select Action Bar */}
      {isMultiSelectMode ? (
        <View
          className="border-t border-gray-200 p-3 bg-white"
          style={{ paddingBottom: mobileBottomSafeOffset }}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-700 font-medium">
              {t('chatArea.selectedMessages').replace('{count}', String(selectedMessages.length))}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsMultiSelectMode(false);
                setSelectedMessageIds([]);
              }}
            >
              <Text className="text-blue-600 font-medium">{t('chatArea.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              className={`px-3 py-2 rounded-lg ${canMultiDeleteForMe ? "bg-gray-100" : "bg-gray-50"}`}
              disabled={!canMultiDeleteForMe}
              onPress={() => void handleDeleteForMeSelected()}
            >
              <Text
                className={`${canMultiDeleteForMe ? "text-gray-800" : "text-gray-400"}`}
              >
                {t('chatArea.deleteForMe')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-3 py-2 rounded-lg bg-blue-50`}
              disabled={!canMultiForward}
              onPress={handleForwardSelected}
            >
              <Text
                className={`${canMultiForward ? "text-blue-700" : "text-blue-300"}`}
              >
                {t('chatArea.forward')}
              </Text>
            </TouchableOpacity>
            {canMultiRecall && (
              <TouchableOpacity
                className="px-3 py-2 rounded-lg bg-red-50"
                onPress={() => void handleRecallSelected()}
              >
                <Text className="text-red-600">{t('chatArea.recall')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : peerMessageBlockedMe ? (
        <View
          className="mx-4 mb-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2"
          style={{ marginBottom: Math.max(insets.bottom + 4, 10) }}
        >
          <Text className="text-red-600 text-sm">
            {t('chatArea.blockedMessage')}
          </Text>
        </View>
      ) : !groupChat.canSendMessage ? (
        <View
          className="mx-4 mb-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2"
          style={{ marginBottom: Math.max(insets.bottom + 4, 10) }}
        >
          <Text className="text-amber-700 text-sm">
            {groupChat.lockedChatMessage}
          </Text>
        </View>
      ) : (
        <View
          className="border-t border-gray-200 p-4"
          style={{ paddingBottom: mobileBottomSafeOffset }}
        >
          {isRecordingVoice && (
            <View
              style={{
                marginBottom: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: "#FEF2F2",
                borderWidth: 1,
                borderColor: "#FECACA",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                <Ionicons name="mic" size={16} color="#DC2626" />
                <Text
                  style={{ marginLeft: 8, color: "#B91C1C", fontWeight: "600" }}
                >
                  {t('chatArea.recording')} {voiceRecordingSeconds}s
                </Text>
                <View
                  style={{
                    marginLeft: 10,
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: 2,
                    height: 22,
                    flexShrink: 1,
                  }}
                >
                  {recordingWaveform.map((bar, idx) => (
                    <View
                      key={`rec-wave-${idx}`}
                      style={{
                        width: 2,
                        height: bar,
                        borderRadius: 2,
                        backgroundColor: "#EF4444",
                        opacity: 0.95,
                      }}
                    />
                  ))}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => void stopAndSendVoiceRecording()}
                style={{
                  backgroundColor: "#DC2626",
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}
                >
                  {t('chatArea.stopAndSend')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View className="flex-row items-center position-relative">
            {/* Nút ➕ mở popup chọn loại file (giữ nguyên như cũ) */}
            <View className="relative">
              <TouchableOpacity className="p-2" onPress={toggleModelChecked}>
                <Ionicons name="add-circle-outline" size={24} color="#666" />
              </TouchableOpacity>

              {/* Badge đỏ khi có file trong queue */}
              {pendingAttachments.length > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    backgroundColor: "#3b82f6",
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}
                  >
                    {pendingAttachments.length}
                  </Text>
                </View>
              )}

              {/* Popup chọn loại tệp — giống cũ */}
              {isModelChecked && (
                <View className="absolute bottom-full left-0 bg-white z-50">
                  <Animated.View
                    style={{
                      transform: [
                        {
                          translateY: scaleAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [30, 0],
                          }),
                        },
                      ],
                      opacity: scaleAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    }}
                  >
                    <View
                      className="bg-white rounded-lg p-4 w-[220px]"
                      style={Shadows.md}
                    >
                      <Text className="text-gray-500 text-xs font-semibold uppercase mb-3">
                        {t('chatArea.attach')}
                      </Text>

                      {/* Hình ảnh / Video */}
                      <TouchableOpacity
                        className="flex-row items-center mb-2"
                        onPress={() => {
                          toggleModelChecked();
                          handleSelectFile();
                        }}
                      >
                        <Ionicons name="image-outline" size={24} color="#666" />
                        <Text className="ml-2 text-gray-800">
                          {t('chatArea.imageVideo')}
                        </Text>
                      </TouchableOpacity>

                      {/* File */}
                      <TouchableOpacity
                        className="flex-row items-center mb-2"
                        onPress={() => {
                          toggleModelChecked();
                          handleSelectFile();
                        }}
                      >
                        <Ionicons
                          name="file-tray-full-outline"
                          size={24}
                          color="#666"
                        />
                        <Text className="ml-2 text-gray-800">File</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="flex-row items-center mb-2"
                        disabled={isFetchingLocation}
                        onPress={() => {
                          toggleModelChecked();
                          handleShareLocation();
                        }}
                      >
                        {isFetchingLocation ? (
                          <ActivityIndicator
                            size="small"
                            color="#2563eb"
                            style={{ width: 24, height: 24 }}
                          />
                        ) : (
                          <Ionicons
                            name="location-outline"
                            size={24}
                            color="#2563eb"
                          />
                        )}
                        <Text className="ml-2 text-gray-800">
                          {isFetchingLocation
                            ? t('chatArea.gettingLocation')
                            : t('chatArea.shareLocation')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="flex-row items-center mb-2"
                        style={{
                          opacity:
                            groupChat.isAdminOrMod ||
                            groupChat.isAllowMemberCreateNote
                              ? 1
                              : 0.5,
                        }}
                        onPress={() => {
                          if (
                            !groupChat.isAdminOrMod &&
                            !groupChat.isAllowMemberCreateNote
                          ) {
                            Alert.alert(
                              t('chatArea.permissionTitle'),
                              t('chatArea.appointmentPermDenied'),
                            );
                            return;
                          }
                          toggleModelChecked();
                          handleCreateAppointmentQuick();
                        }}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={24}
                          color="#2563eb"
                        />
                        <Text className="ml-2 text-gray-800">{t('chatArea.createAppointment')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="flex-row items-center"
                        onPress={() => {
                          toggleModelChecked();
                          setShowVoiceSheet(true);
                        }}
                      >
                        <Ionicons
                          name="mic-outline"
                          size={24}
                          color="#666"
                        />
                        <Text className="ml-2 text-gray-800">
                          {t('chatArea.voiceRecord')}
                        </Text>
                      </TouchableOpacity>

                      {/* Đổi ảnh nền */}
                      <TouchableOpacity
                        className="flex-row items-center mt-2"
                        onPress={() => {
                          toggleModelChecked();
                          setShowBgPicker(true);
                        }}
                      >
                        <Ionicons
                          name="image-outline"
                          size={24}
                          color="#7c3aed"
                        />
                        <Text
                          className="ml-2"
                          style={{ color: "#7c3aed", fontWeight: "600" }}
                        >
                          {t('chatArea.changeBackground')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                </View>
              )}
            </View>

            <View className="relative">
              <TouchableOpacity className="p-2" onPress={toggleModelSticker}>
                <Ionicons name="apps" size={24} color="#666" />
              </TouchableOpacity>
              {isModelSticker && (
                <View
                  className="absolute bottom-full bg-white z-50 left-0 rounded-lg overflow-hidden border border-gray-200"
                  style={Shadows.xl}
                >
                  <StickerPicker
                    setMessage={setNewMessage}
                    toggleModelSticker={toggleModelSticker}
                    onSendGiphySticker={(url: string) => {
                      setNewMessage(url);
                      toggleModelSticker();
                      setTimeout(() => handleSendMessage(), 100);
                    }}
                  />
                </View>
              )}
            </View>

            <View className="relative">
              <TouchableOpacity
                className="p-2"
                onPress={() => {
                  if (
                    !groupChat.isAdminOrMod &&
                    !groupChat.isAllowMemberCreatePoll
                  ) {
                    Alert.alert(
                      t('chatArea.permissionTitle'),
                      t('chatArea.pollPermDenied'),
                    );
                    return;
                  }
                  toggleModelVote();
                }}
                style={{
                  opacity:
                    groupChat.isAdminOrMod || groupChat.isAllowMemberCreatePoll
                      ? 1
                      : 0.5,
                }}
              >
                <Ionicons name="bar-chart-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View className="flex-1 bg-gray-100 rounded-full mx-2 px-4 py-2 relative">
              {showMentionSuggestions && filteredMembers.length > 0 && (
                <View
                  className="absolute bottom-full left-0 right-0 bg-white border border-gray-200 rounded-lg mb-2 overflow-hidden"
                  style={[Shadows.lg, { maxHeight: 200, width: 250 }]}
                >
                  <ScrollView keyboardShouldPersistTaps="handled">
                    {filteredMembers.map((item: any, idx) => (
                      <TouchableOpacity
                        key={item.id}
                        className={`flex-row items-center p-3 border-b border-gray-50 ${idx === mentionSelectedIndex ? "bg-blue-50" : "active:bg-gray-100"}`}
                        onPress={() => onSelectMention(item)}
                      >
                        <Image
                          source={{
                            uri:
                              item.avatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`,
                          }}
                          className="w-8 h-8 rounded-full"
                        />
                        <View className="ml-3">
                          <Text className="text-gray-900 font-semibold text-sm">
                            {item.name}
                          </Text>
                          {item.nickname && (
                            <Text className="text-gray-500 text-xs italic">
                              ({item.nickname})
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <TextInput
                className="text-base text-gray-800"
                placeholder={t('chatArea.messagePlaceholder')}
                value={newMessage}
                onChangeText={handleTextChange}
                onSelectionChange={(event) =>
                  setCursorPosition(event.nativeEvent.selection.start)
                }
                onKeyPress={(e: any) => {
                  if (showMentionSuggestions && filteredMembers.length > 0) {
                    if (e.nativeEvent.key === "ArrowDown") {
                      setMentionSelectedIndex(
                        (prev) => (prev + 1) % filteredMembers.length,
                      );
                      return;
                    }
                    if (e.nativeEvent.key === "ArrowUp") {
                      setMentionSelectedIndex(
                        (prev) =>
                          (prev - 1 + filteredMembers.length) %
                          filteredMembers.length,
                      );
                      return;
                    }
                    if (e.nativeEvent.key === "Enter") {
                      e.preventDefault();
                      onSelectMention(filteredMembers[mentionSelectedIndex]);
                      return;
                    }
                  }

                  if (
                    Platform.OS === "web" &&
                    e.nativeEvent.key === "Enter" &&
                    !e.nativeEvent.shiftKey
                  ) {
                    e.preventDefault();
                    void handleSendMessage();
                  }
                }}
                multiline
                numberOfLines={1}
                placeholderTextColor="#666"
                style={{
                  borderWidth: 0,
                  height: Math.max(24, Math.min(inputHeight, 72)),
                  paddingVertical: 0,
                  lineHeight: 20,
                  textAlignVertical: "center",
                  ...(Platform.OS === "web"
                    ? { outlineStyle: "none" as any, outlineWidth: 0 }
                    : {}),
                  ...(Platform.OS === "android"
                    ? { includeFontPadding: false }
                    : {}),
                }}
                onContentSizeChange={(event) => {
                  const { height } = event.nativeEvent.contentSize;
                  setInputHeight(height > 24 ? height : 24);
                }}
              />
              {/* Nút GIF inline — hiện khi có text */}
              {newMessage.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => void searchGiphyInline(newMessage)}
                  style={{
                    position: 'absolute', right: 8, bottom: 6,
                    backgroundColor: '#6d28d9', borderRadius: 6,
                    paddingHorizontal: 6, paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>GIF</Text>
                </TouchableOpacity>
              )}
              {/* GIPHY inline popup */}
              {showGiphyInline && (
                <View
                  style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0,
                    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb',
                    borderRadius: 12, marginBottom: 4, padding: 8,
                    ...Shadows.lg,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#6d28d9' }}>
                      🎬 GIPHY: "{newMessage.trim().slice(0, 20)}"
                    </Text>
                    <TouchableOpacity onPress={() => setShowGiphyInline(false)}>
                      <Ionicons name="close-circle" size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  </View>
                  {giphyInlineLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <ActivityIndicator size="small" color="#6d28d9" />
                    </View>
                  ) : giphyInlineResults.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, paddingVertical: 12 }}>
                      {t('chatArea.stickerNotFound')}
                    </Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 80 }}>
                      {giphyInlineResults.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={{
                            width: 70, height: 70, borderRadius: 8, overflow: 'hidden',
                            backgroundColor: '#f9fafb', marginRight: 6,
                          }}
                          onPress={() => {
                            setNewMessage(item.original);
                            setShowGiphyInline(false);
                            setTimeout(() => void handleSendMessage(), 100);
                          }}
                        >
                          <Image
                            source={{ uri: item.preview }}
                            style={{ width: 70, height: 70 }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>

            <View className="relative">
              <TouchableOpacity className="p-2" onPress={toggleModelEmoji}>
                <Ionicons name="happy-outline" size={24} color="#666" />
              </TouchableOpacity>
              {isModelEmoji && (
                <View
                  className="absolute bottom-full bg-white z-50 right-0 w-[300px] rounded-lg overflow-hidden border border-gray-200"
                  style={Shadows.xl}
                >
                  <EmojiPicker
                    setMessage={setNewMessage}
                    toggleModelEmoji={toggleModelEmoji}
                  />
                </View>
              )}
            </View>

            <TouchableOpacity
              className={`p-3 rounded-full ${
                (newMessage.trim() || pendingAttachments.length > 0) &&
                !peerMessageBlockedMe
                  ? ""
                  : "bg-gray-200"
              }`}
              onPress={handleSendMessage}
              disabled={
                peerMessageBlockedMe ||
                !groupChat.canSendMessage ||
                (!newMessage.trim() && pendingAttachments.length === 0)
              }
              style={[
                (newMessage.trim() || pendingAttachments.length > 0) &&
                  !peerMessageBlockedMe &&
                  Shadows.md,
                {
                  backgroundColor:
                    (newMessage.trim() || pendingAttachments.length > 0) &&
                    !peerMessageBlockedMe
                      ? "#6d28d9"
                      : undefined,
                  transform: [
                    {
                      scale:
                        (newMessage.trim() || pendingAttachments.length > 0) &&
                        !peerMessageBlockedMe
                          ? 1
                          : 0.95,
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name="send"
                size={20}
                color={
                  (newMessage.trim() || pendingAttachments.length > 0) &&
                  !peerMessageBlockedMe
                    ? "#FFF"
                    : "#999"
                }
              />
            </TouchableOpacity>
          </View>
          {policyWarning && (
            <View
              style={{
                marginTop: 6,
                backgroundColor: "#fef2f2",
                borderColor: "#fecaca",
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "#b91c1c",
                  fontSize: 12,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {policyWarning}
              </Text>
              <TouchableOpacity
                onPress={() => setPolicyWarning(null)}
                style={{ marginLeft: 8, paddingHorizontal: 4, paddingVertical: 2 }}
              >
                <Ionicons name="close" size={14} color="#b91c1c" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Modal
        transparent
        animationType="fade"
        visible={showEnableAiModal}
        onRequestClose={() => setShowEnableAiModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 18,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "white",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: "#f3f4f6",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                {t('chatArea.botNotEnabled')}
              </Text>
              <Text style={{ fontSize: 14, color: "#4b5563", lineHeight: 20 }}>
                {t('chatArea.botEnablePrompt')}
              </Text>
            </View>
            <View style={{ flexDirection: "row", padding: 14, gap: 10 }}>
              <TouchableOpacity
                onPress={handleDeclineEnableAi}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: "#f3f4f6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#111827", fontWeight: "600" }}>
                  Không
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={enablingAi}
                onPress={() => void handleConfirmEnableAi()}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 12,
                  backgroundColor: "#6d28d9",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: enablingAi ? 0.6 : 1,
                }}
              >
                <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                  {enablingAi ? t('chatArea.enabling') : t('common.yes')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Viewer */}
      {fullScreenImage && (
        <View className="absolute inset-0 bg-black z-50 flex-1 justify-center items-center">
          <Image
            source={{ uri: fullScreenImage }}
            className="w-full h-full"
            resizeMode="contain"
          />
          <TouchableOpacity
            className="absolute top-10 right-20 bg-black/30 rounded-full p-2"
            onPress={() => {
              downloadSingleItem({
                url: fullScreenImage,
                fileName: `image_${Date.now()}.jpg`,
                mimeType: "image/jpeg",
              });
            }}
          >
            <Ionicons name="download" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            className="absolute top-10 right-5 bg-black/30 rounded-full p-2"
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        duration={toastDuration}
        onHide={() => setToastVisible(false)}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <View className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center">
          <View className="bg-white rounded-2xl p-5 w-[85%] max-w-md">
            <View className="items-center">
              <View className="w-16 h-16 rounded-full bg-blue-50 items-center justify-center mb-4">
                {uploadProgress < 100 ? (
                  <Ionicons
                    name="cloud-upload-outline"
                    size={32}
                    color="#3B82F6"
                  />
                ) : (
                  <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                )}
              </View>
              <Text className="text-lg font-medium text-gray-900 mb-2">
                {uploadProgress < 100 ? "Uploading File" : "Upload Complete"}
              </Text>
              <Text className="text-gray-600 text-center mb-4">
                {uploadStatusMessage}
              </Text>
              {(policyWarning || String(uploadStatusMessage || "").toLowerCase().includes("vi pham")) && (
                <Text style={{ color: "#dc2626", fontSize: 12, fontWeight: "600", textAlign: "center", marginBottom: 8 }}>
                  {policyWarning || "Nội dung vi phạm chính sách. Vui lòng chọn tệp khác."}
                </Text>
              )}
            </View>

            {/* Progress Bar */}
            <View className="bg-gray-200 h-2 rounded-full mb-4 overflow-hidden">
              <View
                className="bg-blue-500 h-full rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </View>

            {/* Cancel button - only show during active upload */}
            {uploadProgress < 100 && (
              <TouchableOpacity
                className="mt-2 py-3 px-4 rounded-lg bg-gray-100 items-center"
                onPress={() => {
                  setShowUploadModal(false);
                }}
              >
                <Text className="text-gray-700 font-medium">Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {(pinnedMessages.length > 0 || upcomingReminders.length > 0) &&
        !showMessageOptions &&
        !showPinsAndRemindersModal && (
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
              onPress={() => setShowPinsAndRemindersModal(true)}
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
                    {t('chatArea.pinAndReminder')}
                  </Text>
                  <Text style={{ color: "#6B7280", fontSize: 11 }}>
                    {displayedPinnedMessages.length > 0
                      ? t('chatArea.pinCount').replace('{count}', String(displayedPinnedMessages.length))
                      : ""}
                    {displayedPinnedMessages.length > 0 &&
                    upcomingReminders.length > 0
                      ? ", "
                      : ""}
                    {upcomingReminders.length > 0
                      ? t('chatArea.reminderCount').replace('{count}', String(upcomingReminders.length))
                      : ""}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: "#0068FF", fontSize: 12, fontWeight: "500" }}>
                  {t('chatArea.viewAll')}
                </Text>
                <Ionicons name="chevron-forward" size={12} color="#0068FF" />
              </View>
            </TouchableOpacity>
          </View>
        )}

      {showPinsAndRemindersModal && (
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
              setShowPinsAndRemindersModal(false);
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
                        {t('chatArea.upcomingReminders')}
                      </Text>
                    </View>
                    <View>
                      {upcomingReminders.map((reminder) => {
                        const rid = reminder._id ?? reminder.id;
                        const dateObj = new Date(reminder.remindAt);
                        const monthNames = [
                          "THG 1",
                          "THG 2",
                          "THG 3",
                          "THG 4",
                          "THG 5",
                          "THG 6",
                          "THG 7",
                          "THG 8",
                          "THG 9",
                          "THG 10",
                          "THG 11",
                          "THG 12",
                        ];
                        const monthLabel = monthNames[dateObj.getMonth()];
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
                                {reminder.title || t('chatArea.defaultAppointment')}
                              </Text>
                              <Text style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
                                Hôm nay (lúc {timeStr})
                              </Text>
                            </View>
                            <TouchableOpacity onPress={() => handleDeleteReminder(rid)} style={{ padding: 6 }}>
                              <Ionicons name="trash-outline" size={20} color="#D1D5DB" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

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
                      displayedPinnedMessages.map((pinnedMsg, idx) => {
                        return (
                          <TouchableOpacity
                            key={pinnedMsg.id}
                            activeOpacity={0.7}
                            onPress={() => scrollToMessage(pinnedMsg.id)}
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
                                {t('chatArea.messageFrom').replace('{sender}', getSenderDisplayLabel(pinnedMsg.senderId))}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              {pinEditMode &&
                              (groupChat.isAdminOrMod || groupChat.isAllowMemberPin) ? (
                                <>
                                  <TouchableOpacity
                                    onPress={() => handleUnpinFromPanel(pinnedMsg)}
                                    style={{ padding: 4 }}
                                  >
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() =>
                                      movePinUp(
                                        pinnedMessages.findIndex(
                                          (m) => m.id === pinnedMsg.id,
                                        ),
                                      )
                                    }
                                    disabled={
                                      pinnedMessages.findIndex(
                                        (m) => m.id === pinnedMsg.id,
                                      ) <= 0
                                    }
                                    style={{ padding: 4 }}
                                  >
                                    <Ionicons
                                      name="arrow-up-circle"
                                      size={22}
                                      color={
                                        pinnedMessages.findIndex(
                                          (m) => m.id === pinnedMsg.id,
                                        ) <= 0
                                          ? "#CBD5E1"
                                          : "#0068FF"
                                      }
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() =>
                                      movePinDown(
                                        pinnedMessages.findIndex(
                                          (m) => m.id === pinnedMsg.id,
                                        ),
                                      )
                                    }
                                    disabled={
                                      pinnedMessages.findIndex(
                                        (m) => m.id === pinnedMsg.id,
                                      ) >=
                                      pinnedMessages.length - 1
                                    }
                                    style={{ padding: 4 }}
                                  >
                                    <Ionicons
                                      name="arrow-down-circle"
                                      size={22}
                                      color={
                                        pinnedMessages.findIndex(
                                          (m) => m.id === pinnedMsg.id,
                                        ) >=
                                        pinnedMessages.length - 1
                                          ? "#CBD5E1"
                                          : "#0068FF"
                                      }
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
                          {t('chatArea.noPinnedMessages')}
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
                    {(groupChat.isAdminOrMod || groupChat.isAllowMemberPin) && (
                      <TouchableOpacity
                        onPress={() => {
                          if (pinEditMode) void savePinOrder();
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
                          {pinEditMode ? t('chatArea.done') : t('chatArea.edit')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        setShowPinsAndRemindersModal(false);
                        setPinEditMode(false);
                      }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#64748B" }}>
                        {t('chatArea.collapse')}
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

      {/* ── Pin Limit Modal ── */}
      <Modal
        visible={showPinLimitModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPinLimitModal(false);
          setPendingPinMessage(null);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setShowPinLimitModal(false);
            setPendingPinMessage(null);
          }}
        >
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
                  {t('chatArea.pinLimitReached')}
                </Text>
                <Text className="text-gray-600 text-center mb-4 leading-5">
                  {t('chatArea.pinLimitDesc')}
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
                                {t('chatArea.oldestPin')}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => handleReplacePin(msg)}
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
                  onPress={() => {
                    setShowPinLimitModal(false);
                    setPendingPinMessage(null);
                  }}
                >
                  <Text className="text-gray-700 font-semibold">{t('chatArea.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Wallpaper / Background Picker Modal ── */}
      <Modal
        visible={showBgPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBgPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowBgPicker(false)}>
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
                    {t('chatArea.selectBackground')}
                  </Text>
                  <TouchableOpacity onPress={() => setShowBgPicker(false)}>
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
                      const isActive = bg.id === chatBgId;
                      const bgFill = String((bg as any)["value"] ?? "#f9fafb");
                      const useThreeCols = Platform.OS === "web" && viewportWidth >= 1300;
                      const cardWidth = useThreeCols ? "31.6%" : "48.2%";
                      return (
                        <TouchableOpacity
                          key={bg.id}
                          onPress={() => void handleChangeBg(bg.id)}
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
      {/* Voice Recorder Sheet */}
      <VoiceRecorderSheet
        visible={showVoiceSheet}
        onClose={() => setShowVoiceSheet(false)}
        onSendVoice={async (audioBlob, durationSec, mimeType) => {
          try {
            const ext = mimeType === 'audio/m4a' ? 'm4a' : 'webm';
            const uri = URL.createObjectURL(audioBlob);
            await uploadAndSendFile({
              uri,
              name: `voice-${Date.now()}.${ext}`,
              mimeType,
              size: audioBlob.size,
              lastModified: Date.now(),
            } as any);
            setTimeout(() => URL.revokeObjectURL(uri), 60_000);
          } catch (err) {
            console.error('VoiceSheet sendVoice error:', err);
          }
        }}
        onConvertedText={(text) => {
          setNewMessage((prev) => (prev ? prev + ' ' + text : text));
        }}
      />
    </View>
  );
}
