import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
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
import {
  mapApiConversationToModel,
  mapApiMessageToModel,
  unwrapData,
} from "@/src/models/mappers";
import { messageService as MessageService } from "@/src/api/services/message.service";
import { conversationService as ConversationService } from "@/src/api/services/conversation.service";
import { useUser } from "@/src/contexts/user/UserContext";
import { userService as UserService } from "@/src/api/services/user.service";
import SocketService from "@/src/api/socketCompat";
import ForwardMessageModal from "./ForwardMessageModal";

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
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

// ΓöÇΓöÇ 6 preset nß╗ün ─æoß║ín chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
type BgType = "color" | "gradient" | "image";
interface ChatBgPreset {
  id: string;
  label: string;
  type: BgType;
  /** M├áu nß╗ün (color) hoß║╖c URI ß║únh */
  value: string;
  /** M├áu preview cho gradient (t├╣y ├╜) */
  preview?: string;
}

export const CHAT_BACKGROUNDS: ChatBgPreset[] = [
  {
    id: "default",
    label: "Mß║╖c ─æß╗ïnh",
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
    id: "sky",
    label: "Bß║ºu trß╗¥i",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=60",
    preview: "#bfdbfe",
  },
  {
    id: "forest",
    label: "Rß╗½ng xanh",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=60",
    preview: "#6ee7b7",
  },
  {
    id: "galaxy",
    label: "V┼⌐nh trß╗Ñ",
    type: "image",
    value:
      "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=800&q=60",
    preview: "#1e1b4b",
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

  // 1. Tß║ío regex ─æß╗Öng tß╗½ memberNames ─æß╗â bß║»t ch├¡nh x├íc c├íc t├¬n c├│ khoß║úng trß║»ng
  // ╞»u ti├¬n t├¬n d├ái tr╞░ß╗¢c ─æß╗â tr├ính khß╗¢p substring
  const sortedNames = [...memberNames].sort((a, b) => b.length - a.length);
  const escapedNames = sortedNames.map((name) =>
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );

  // Regex kß║┐t hß╗úp URL, @all, c├íc t├¬n cß╗Ñ thß╗â, v├á fallback @[^\s]+
  const mentionPattern =
    escapedNames.length > 0
      ? `@(?:all|${escapedNames.join("|")}|[^\\s@]+)`
      : `@(?:all|[^\\s@]+)`;

  const matcher = new RegExp(
    `((?:https?://|www\\.)[^\\s]+|${mentionPattern})`,
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
          href: /^https?:\/\//i.test(cleanUrl)
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
      ? `B├¼nh chß╗ìn: ${msg.metadata.question}`
      : "B├¼nh chß╗ìn";
  }
  if (msg.type === MessageType.IMAGE) return "[H├¼nh ß║únh]";
  if (msg.type === MessageType.MEDIA_ALBUM) return "[Album]";
  if (msg.type === MessageType.VIDEO) return "[Video]";
  if (msg.type === MessageType.FILE)
    return `[Tß╗çp tin] ${msg.metadata?.fileName || ""}`.trim();
  if (msg.type === MessageType.SYSTEM) return msg.content;
  return "[Tin nhß║»n]";
};

export interface ChatAreaProps {
  selectedChat: Conversation | null;
  onBackPress?: () => void;
  onInfoPress?: () => void;
  onConversationMetaChanged?: () => void;
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
    encoding: FileSystem.EncodingType.Base64,
  });
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function ChatArea({
  selectedChat,
  onBackPress,
  onInfoPress,
  onConversationMetaChanged,
  openScheduleRef,
  openNicknameRef,
  initialScrollMessageId,
  onInitialScrollDone,
}: ChatAreaProps) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const mobileBottomSafeOffset =
    Platform.OS === "web" ? 0 : Math.max(insets.bottom + 6, 12);
  const mobileMessageMaxWidth = Math.min(420, Math.floor(viewportWidth * 0.82));
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagePage, setMessagePage] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [showLoadOlderButton, setShowLoadOlderButton] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingBotAi, setIsWaitingBotAi] = useState(false);
  const [showEnableAiModal, setShowEnableAiModal] = useState(false);
  const [pendingAiMessage, setPendingAiMessage] = useState("");
  const [enablingAi, setEnablingAi] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isNewer, setIsNewer] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [isModelChecked, setIsModelChecked] = useState(false);
  const [isModelImage, setIsModelImage] = useState(false);
  const [isModelEmoji, setIsModelEmoji] = useState(false);
  const [isModelSticker, setIsModelSticker] = useState(false);
  const [isModelGift, setIsModelGift] = useState(false);
  const scaleAnimation = useRef(new Animated.Value(0)).current;
  const socketService = useRef(SocketService.getInstance()).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const preserveScrollOffsetRef = useRef<number | null>(null);
  const prevMessagesLengthRef = useRef(0);
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

    // Lu├┤n c├│ @all ß╗ƒ ─æß║ºu
    const allOption = { id: "all", name: "Tß║Ñt cß║ú mß╗ìi ng╞░ß╗¥i", type: "all" };

    const query = (mentionQuery || "").toLowerCase();
    const members = selectedChat.participantInfo
      .filter((p) => p.id !== user?.id) // kh├┤ng nhß║»c ch├¡nh m├¼nh
      .map((p) => {
        const userInfo = messageUsers[p.id];
        const name =
          p.nickname ||
          p.name ||
          userInfo?.name ||
          userInfo?.displayName ||
          "Ng╞░ß╗¥i d├╣ng";
        const avatar = p.avatar || userInfo?.avatarURL || userInfo?.avatarUrl;
        return { ...p, name, avatar, type: "user" };
      })
      .filter((p) => p.name.toLowerCase().includes(query))
      .slice(0, 5); // giß╗¢i hß║ín 5 ng╞░ß╗¥i theo y├¬u cß║ºu

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

    // Mention chß╗ë hoß║ít ─æß╗Öng trong group chat
    if (!selectedChat?.isGroup) {
      setShowMentionSuggestions(false);
      return;
    }

    // Logic t├¼m dß║Ñu @ gß║ºn nhß║Ñt tr╞░ß╗¢c con trß╗Å
    const lastAtPos = text.lastIndexOf("@", cursorPosition);
    if (lastAtPos !== -1) {
      const textAfterAt = text.slice(lastAtPos + 1, cursorPosition);
      // Nß║┐u kh├┤ng c├│ dß║Ñu c├ích giß╗»a @ v├á con trß╗Å -> ─æang g├╡ mention
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt);
        setShowMentionSuggestions(true);
        setMentionSelectedIndex(0); // Reset index khi g├╡ tß╗½ kh├│a mß╗¢i
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
  const [otherParticipant, setOtherParticipant] = useState<{
    name: string;
    avatar: string;
    isOnline: boolean;
  } | null>(null);
  // L╞░u userId cß╗ºa ng╞░ß╗¥i kia ─æß╗â filter presence update
  const otherUserIdRef = useRef<string | null>(null);

  // ΓöÇΓöÇ Trß║íng th├íi tin nhß║»n: sent / delivered / read ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  type MsgStatus = "sent" | "delivered" | "read";
  const [msgStatusMap, setMsgStatusMap] = useState<Record<string, MsgStatus>>(
    {},
  );

  // ΓöÇΓöÇ Avatar ng╞░ß╗¥i ─æ├ú xem ΓÇö key = userId, value = { messageId, avatarUrl, displayName } ΓöÇΓöÇ
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

  // Th├¬m v├áo danh s├ích state trong ChatArea
  const [fileUploading, setFileUploading] = useState(false);
  const [attachments, setAttachments] = useState<{ [key: string]: Attachment }>(
    {},
  );
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [peerMessageBlockedMe, setPeerMessageBlockedMe] = useState(false);
  const [peerCallBlockedMe, setPeerCallBlockedMe] = useState(false);
  // ΓöÇΓöÇ Wallpaper ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
    String((user as any)?.name ?? "Ng╞░ß╗¥i d├╣ng").trim() || "Ng╞░ß╗¥i d├╣ng";

  // ΓöÇΓöÇ Group chat hook (t├ích logic group ra file ri├¬ng) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const groupChat = useGroupChat(selectedChat, user as any);

  /** Lß║Ñy t├¬n hiß╗ân thß╗ï cß╗ºa sender (╞░u ti├¬n biß╗çt danh group ΓåÆ t├¬n thß║¡t) */
  const getSenderName = useCallback(
    (senderId: string) => {
      // 1. Check biß╗çt danh tß╗½ groupChat hook (─æ├ú lß║Ñy p.nickname || p.name)
      if (groupChat.isGroup && groupChat.memberDisplayNames[senderId]) {
        return groupChat.memberDisplayNames[senderId];
      }
      // 2. Fallback t├¼m trß╗▒c tiß║┐p trong participantInfo cß╗ºa conversation
      if (selectedChat?.participantInfo) {
        const p = selectedChat.participantInfo.find((x) => x.id === senderId);
        if (p?.name) return p.name;
      }
      // 3. Cuß╗æi c├╣ng mß╗¢i lß║Ñy tß╗½ cache messageUsers hoß║╖c mß║╖c ─æß╗ïnh
      return messageUsers[senderId]?.name || "Ng╞░ß╗¥i d├╣ng";
    },
    [
      groupChat.isGroup,
      groupChat.memberDisplayNames,
      selectedChat?.participantInfo,
      messageUsers,
    ],
  );
  const peerDisplayName = useMemo(() => {
    if (!selectedChat || !user?.id) return "─æß╗æi ph╞░╞íng";
    const peerFromConversation = selectedChat.participantInfo?.find(
      (p) => p.id !== user.id,
    )?.name;
    const peerFromFetched = otherParticipant?.name;
    return (
      String(peerFromConversation ?? peerFromFetched ?? "─æß╗æi ph╞░╞íng").trim() ||
      "─æß╗æi ph╞░╞íng"
    );
  }, [selectedChat, user?.id, otherParticipant?.name]);

  // ΓöÇΓöÇ Attachment queue (Zalo-style staging) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const [pendingAttachments, setPendingAttachments] = useState<PendingAsset[]>(
    [],
  );

  // ΓöÇΓöÇ Real-time: nhß║¡n lß╗¥i mß╗¥i v├áo nh├│m (nh╞░ Zalo) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    const handleInviteReceived = (data: {
      inviteId: string;
      groupName: string;
      inviterName: string;
      conversationId: string;
    }) => {
      Alert.alert(
        "≡ƒô⌐ Lß╗¥i mß╗¥i tham gia nh├│m",
        `${data.inviterName} mß╗¥i bß║ín v├áo nh├│m "${data.groupName}"`,
        [
          {
            text: "Tß╗½ chß╗æi",
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
                    Alert.alert(
                      "Γ£à ─É├ú tham gia!",
                      `Bß║ín ─æ├ú v├áo nh├│m "${data.groupName}" th├ánh c├┤ng.`,
                    );
                  }
                })
                .catch(() => Alert.alert("Lß╗ùi", "Kh├┤ng thß╗â tham gia nh├│m."));
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

  // ΓöÇΓöÇ Chß╗ìn file ΓåÆ th├¬m v├áo h├áng chß╗¥ (kh├┤ng upload ngay) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const handleSelectFile = async () => {
    if (peerMessageBlockedMe) {
      setError("Bß║ín ─æang bß╗ï chß║╖n nhß║»n tin trong cuß╗Öc tr├▓ chuyß╗çn n├áy.");
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
          window.alert("bß║ín k ─æ╞░ß╗úc gß╗¡i file qu├í 5mb nha");
        else alert("bß║ín k ─æ╞░ß╗úc gß╗¡i file qu├í 5mb nha");
        return;
      }

      // Tß║ío previewUri cho ß║únh tr├¬n web (blob URL)
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

      // Nß║┐u ─æ├ú c├│ queue: gß╗Öp th├¬m. Nß║┐u ch╞░a: khß╗ƒi tß║ío mß╗¢i.
      setPendingAttachments((prev) => [...prev, ...enriched]);
      // ─É├│ng popup chß╗ìn loß║íi
      if (isModelChecked) toggleModelChecked();
    } catch (error) {
      console.error("Error picking document:", error);
      setError("Kh├┤ng thß╗â chß╗ìn file. Vui l├▓ng thß╗¡ lß║íi.");
    }
  };

  /** Xo├í mß╗Öt item khß╗Åi h├áng chß╗¥ */
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
      setError("Bß║ín ─æang bß╗ï chß║╖n nhß║»n tin trong cuß╗Öc tr├▓ chuyß╗çn n├áy.");
      return;
    }
    if (isFetchingLocation) return;
    setIsFetchingLocation(true);
    try {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && !window.isSecureContext) {
          setError("Web chß╗ë cho lß║Ñy vß╗ï tr├¡ tr├¬n HTTPS hoß║╖c localhost.");
          return;
        }
        if (!navigator?.geolocation) {
          setError("Thiß║┐t bß╗ï kh├┤ng hß╗ù trß╗ú lß║Ñy vß╗ï tr├¡.");
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
            "Cß║ºn quyß╗ün vß╗ï tr├¡",
            "Bß║ín ─æ├ú chß║╖n quyß╗ün vß╗ï tr├¡. Vui l├▓ng bß║¡t lß║íi trong C├ái ─æß║╖t.",
            [
              { text: "Hß╗ºy", style: "cancel" },
              {
                text: "Mß╗ƒ c├ái ─æß║╖t",
                onPress: () => {
                  Linking.openSettings().catch(() => {});
                },
              },
            ],
          );
        } else {
          setError("Bß║ín ch╞░a cß║Ñp quyß╗ün vß╗ï tr├¡.");
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
        setError("Kh├┤ng lß║Ñy ─æ╞░ß╗úc vß╗ï tr├¡ tß╗½ thiß║┐t bß╗ï. H├úy bß║¡t GPS v├á thß╗¡ lß║íi.");
        return;
      }

      sendLocationMessage(position.coords.latitude, position.coords.longitude);
    } catch (err: any) {
      if (Platform.OS === "web") {
        const code = Number(err?.code ?? 0);
        if (code === 1) {
          setError("Bß║ín ─æ├ú tß╗½ chß╗æi quyß╗ün vß╗ï tr├¡ tr├¬n tr├¼nh duyß╗çt.");
        } else if (code === 2) {
          setError(
            "Kh├┤ng x├íc ─æß╗ïnh ─æ╞░ß╗úc vß╗ï tr├¡. Kiß╗âm tra mß║íng hoß║╖c dß╗ïch vß╗Ñ vß╗ï tr├¡.",
          );
        } else if (code === 3) {
          setError("Hß║┐t thß╗¥i gian lß║Ñy vß╗ï tr├¡. Vui l├▓ng thß╗¡ lß║íi.");
        } else {
          setError(
            "Kh├┤ng thß╗â lß║Ñy vß╗ï tr├¡ tr├¬n web. H├úy kiß╗âm tra quyß╗ün vß╗ï tr├¡ cß╗ºa tr├¼nh duyß╗çt.",
          );
        }
      } else {
        setError("Kh├┤ng thß╗â lß║Ñy vß╗ï tr├¡. Vui l├▓ng bß║¡t GPS v├á thß╗¡ lß║íi.");
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
              "Bß║ín c├│ muß╗æn cß║Ñp quyß╗ün v├á gß╗¡i vß╗ï tr├¡ hiß╗çn tß║íi kh├┤ng?",
            );
      if (ok) {
        void requestAndSendCurrentLocation();
      }
      return;
    }
    Alert.alert(
      "Chia sß║╗ vß╗ï tr├¡",
      "Bß║ín c├│ muß╗æn cß║Ñp quyß╗ün v├á gß╗¡i vß╗ï tr├¡ hiß╗çn tß║íi kh├┤ng?",
      [
        { text: "Hß╗ºy", style: "cancel" },
        { text: "─Éß╗ông ├╜", onPress: requestAndSendCurrentLocation },
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
      setError("Kh├┤ng thß╗â tß║ío lß╗ïch hß║╣n.");
      return;
    }
    const otherIds = selectedChat.participantIds.filter((id) => id !== user.id);
    const title = payload.title.trim();
    if (!title) {
      setError("Ti├¬u ─æß╗ü lß╗ïch hß║╣n kh├┤ng hß╗úp lß╗ç.");
      return;
    }
    try {
      // Tß║ío reminder cho m├¼nh
      const myReminderRes: any = await reminderService.create({
        conversationId: selectedChat.id,
        userId: user.id,
        title,
        remindAt: payload.remindAtIso,
      });
      const myReminderData = unwrapData<any>(myReminderRes);
      // Tß║ío reminder cho tß║Ñt cß║ú th├ánh vi├¬n kh├íc (1-1: 1 ng╞░ß╗¥i, group: N ng╞░ß╗¥i)
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
      const content = `Lß╗ïch hß║╣n: ${title}\nThß╗¥i gian: ${formatAppointmentTime(payload.remindAtIso)}`;
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
          ? `${actorDisplayName} ─æ├ú tß║ío lß╗ïch hß║╣n "${title}" trong nh├│m v├áo ${formatAppointmentTime(payload.remindAtIso)}.`
          : `${actorDisplayName} ─æ├ú tß║ío lß╗ïch hß║╣n "${title}" vß╗¢i ${peerDisplayName} v├áo ${formatAppointmentTime(payload.remindAtIso)}.`,
      );
      onConversationMetaChanged?.();
      setError(null);
    } catch (err: any) {
      console.error("createAppointment:", err);
      setError("Kh├┤ng thß╗â tß║ío lß╗ïch hß║╣n. Vui l├▓ng thß╗¡ lß║íi.");
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

      const content = `Lß╗ïch hß║╣n: ${title}\nThß╗¥i gian: ${formatAppointmentTime(remindAtIso)}`;
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
        `${actorDisplayName} ─æ├ú cß║¡p nhß║¡t lß╗ïch hß║╣n vß╗¢i ${peerDisplayName} th├ánh "${title}" v├áo ${formatAppointmentTime(remindAtIso)}.`,
      );
      void refreshPinnedMessages();
      setShowMessageOptions(false);
    } catch (err) {
      console.error("updateAppointmentFromMessage:", err);
      setError("Kh├┤ng thß╗â ─æß╗òi lß╗ïch hß║╣n.");
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
        `${actorDisplayName} ─æ├ú hß╗ºy lß╗ïch hß║╣n "${ctx.title || "kh├┤ng t├¬n"}" vß╗¢i ${peerDisplayName}.`,
      );
      void refreshPinnedMessages();
      setShowMessageOptions(false);
    } catch (err) {
      console.error("cancelAppointmentFromMessage:", err);
      setError("Kh├┤ng thß╗â hß╗ºy lß╗ïch hß║╣n.");
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
      setError("Vui l├▓ng chß╗ìn cuß╗Öc tr├▓ chuyß╗çn.");
      return;
    }
    if (Platform.OS === "web") {
      const title = window.prompt("Ti├¬u ─æß╗ü lß╗ïch hß║╣n:");
      if (!title?.trim()) return;
      const date = window.prompt("Nhß║¡p ng├áy (DD/MM/YYYY):");
      const time = window.prompt("Nhß║¡p giß╗¥ (HH:mm):");
      if (!date || !time) return;
      const mDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
      const mTime = /^(\d{2}):(\d{2})$/.exec(time.trim());
      if (!mDate || !mTime) {
        setError("Sai ─æß╗ïnh dß║íng ng├áy/giß╗¥.");
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
      "Tß║ío lß╗ïch hß║╣n",
      "D├╣ng n├║t lß╗ïch ß╗ƒ header ─æß╗â nhß║¡p thß╗¥i gian chi tiß║┐t.",
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
      setError("Bß║ín ─æang bß╗ï chß║╖n nhß║»n tin trong cuß╗Öc tr├▓ chuyß╗çn n├áy.");
      return;
    }
    try {
      if (Platform.OS === "web") {
        const mediaDevices = navigator?.mediaDevices;
        if (!mediaDevices?.getUserMedia) {
          setError("Tr├¼nh duyß╗çt kh├┤ng hß╗ù trß╗ú ghi ├óm.");
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
        setError("Bß║ín ch╞░a cß║Ñp quyß╗ün microphone.");
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
      setError("Kh├┤ng thß╗â bß║»t ─æß║ºu ghi ├óm.");
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
      setError("Kh├┤ng thß╗â gß╗¡i ghi ├óm.");
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
    if (!selectedChat?.id || !user?.id) return;

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
        // setError('Tß╗çp qu├í lß╗¢n. Vui l├▓ng thß╗¡ lß║íi.');
        return;
      }

      // Chuß║⌐n bß╗ï fileData ─æß╗â gß╗¡i qua socket
      let fileBuffer: ArrayBuffer;

      setUploadStatusMessage("Reading file content...");
      setUploadProgress(10);

      fileBuffer = await readBufferFromAsset(fileAsset);

      setUploadProgress(40);
      setUploadStatusMessage("Preparing to send file...");

      // Cß║Ñu tr├║c dß╗» liß╗çu file ─æß╗â gß╗¡i qua socket
      const fileData = {
        buffer: fileBuffer,
        fileName: fileAsset.name,
        contentType: fileAsset.mimeType || "application/octet-stream",
      };

      setUploadProgress(50);
      setUploadStatusMessage("Setting up connection...");

      // Lß║»ng nghe phß║ún hß╗ôi tß╗½ socket vß╗ü viß╗çc gß╗¡i attachment th├ánh c├┤ng
      const attachmentSentHandler = (data: {
        success: boolean;
        messageId: string;
      }) => {
        console.log("Attachment sent successfully:", data);
        if (data.success) {
          setUploadProgress(100);
          setUploadStatusMessage("File sent successfully!");

          // Sau khi gß╗¡i th├ánh c├┤ng, cß║¡p nhß║¡t danh s├ích tin nhß║»n
          fetchMessages();

          // Reset reply state nß║┐u c├│
          if (replyingTo) {
            setReplyingTo(null);
          }

          // Close modal after short delay to show success
          setTimeout(() => {
            setShowUploadModal(false);
          }, 800);
        }
        // Gß╗í bß╗Å event listener sau khi nhß║¡n ─æ╞░ß╗úc phß║ún hß╗ôi
        socketService.removeAttachmentSentListener(attachmentSentHandler);
      };

      // Lß║»ng nghe lß╗ùi tß╗½ socket (nß║┐u c├│)
      const attachmentErrorHandler = (error: { message: string }) => {
        console.error("Attachment error:", error.message);
        setUploadStatusMessage(`Error: ${error.message}`);
        setError(`Kh├┤ng thß╗â gß╗¡i tß╗çp ─æ├¡nh k├¿m: ${error.message}`);

        // Close modal after showing error
        setTimeout(() => {
          setShowUploadModal(false);
        }, 2000);

        // Gß╗í bß╗Å event listener sau khi nhß║¡n ─æ╞░ß╗úc lß╗ùi
        socketService.removeAttachmentErrorListener(attachmentErrorHandler);
      };

      // ─É─âng k├╜ c├íc event handlers
      socketService.onAttachmentSent(attachmentSentHandler);
      socketService.onAttachmentError(attachmentErrorHandler);

      setUploadProgress(70);
      setUploadStatusMessage("Sending file via socket...");

      // Gß╗¡i file th├┤ng qua socket
      socketService.sendAttachment(
        selectedChat.id,
        fileData,
        replyingTo?.id, // Truyß╗ün repliedTold nß║┐u c├│
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
            : "Kh├┤ng thß╗â gß╗¡i file. Vui l├▓ng thß╗¡ lß║íi.",
      );

      // Close modal after showing error
      setTimeout(() => {
        setShowUploadModal(false);
      }, 2000);
    } finally {
      setFileUploading(false);
      toggleModelChecked(); // ─É├│ng modal chß╗ìn loß║íi file
    }
  };

  const uploadAndSendMediaAlbum = async (
    assets: DocumentPicker.DocumentPickerAsset[],
  ) => {
    if (!selectedChat?.id || !user?.id) return;
    const MAX_FILES = 20;
    const MAX_BYTES = 10 * 1024 * 1024;
    const slice = assets.slice(0, MAX_FILES);

    try {
      setShowUploadModal(true);
      setFileUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatusMessage("─Éang ─æß╗ìc nhiß╗üu file...");

      for (const a of slice) {
        if ((a.size || 0) > MAX_BYTES) {
          setUploadStatusMessage("File qu├í lß╗¢n (tß╗æi ─æa 10MB mß╗ùi file).");
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
        setUploadStatusMessage(`─Éang ─æß╗ìc ${i + 1}/${total}...`);
        const buf = await readBufferFromAsset(slice[i]);
        files.push({
          buffer: buf,
          fileName: slice[i].name ?? "file",
          contentType: slice[i].mimeType || "application/octet-stream",
        });
        setUploadProgress(Math.round(((i + 1) / total) * 50));
      }

      setUploadStatusMessage("─Éang gß╗¡i album...");
      const attachmentSentHandler = (data: {
        success: boolean;
        messageId: string;
      }) => {
        if (data.success) {
          setUploadProgress(100);
          setUploadStatusMessage("─É├ú gß╗¡i!");
          void fetchMessages();
          if (replyingTo) setReplyingTo(null);
          setTimeout(() => setShowUploadModal(false), 600);
        }
        socketService.removeAttachmentSentListener(attachmentSentHandler);
      };
      const attachmentErrorHandler = (error: { message: string }) => {
        setUploadStatusMessage(`Lß╗ùi: ${error.message}`);
        setError(`Kh├┤ng gß╗¡i ─æ╞░ß╗úc album: ${error.message}`);
        setTimeout(() => setShowUploadModal(false), 2000);
        socketService.removeAttachmentErrorListener(attachmentErrorHandler);
      };
      socketService.onAttachmentSent(attachmentSentHandler);
      socketService.onAttachmentError(attachmentErrorHandler);

      setUploadProgress(60);
      socketService.sendMediaAlbum(selectedChat.id, files, replyingTo?.id);
      setUploadProgress(85);
      setUploadStatusMessage("─Éang chß╗¥ server...");
    } catch (error) {
      console.error("uploadAndSendMediaAlbum:", error);
      setError("Kh├┤ng gß╗¡i ─æ╞░ß╗úc album.");
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

  // Fetch messages from server
  const fetchMessages = async () => {
    if (!selectedChat?.id) return;

    try {
      setLoading(true);
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

        // ΓöÇΓöÇ Real-time status: chß╗ë emit READ cho tin cuß╗æi ng╞░ß╗¥i kia gß╗¡i ΓöÇΓöÇ
        // (Mß╗ƒ chat = ─æ├ú xem rß╗ôi ΓÇö kh├┤ng need spam delivered cho tß║Ñt cß║ú)
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
          // Reset status map khi ─æß╗òi conversation (tr├ính stale data)
          setMsgStatusMap({});
        }
      } else {
        setError(response.statusMessage);
      }
    } catch (err) {
      setError("Failed to load messages");
      console.error("Error fetching messages:", err);
      setHasOlderMessages(false);
    } finally {
      setLoading(false);
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
        setError(response.statusMessage || "Kh├┤ng thß╗â tß║úi th├¬m dß╗» liß╗çu c┼⌐");
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
      setError("Kh├┤ng thß╗â tß║úi th├¬m dß╗» liß╗çu c┼⌐");
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

  // Join conversation when component mounts
  useEffect(() => {
    if (selectedChat) {
      contentHeightRef.current = 0;
      scrollOffsetRef.current = 0;
      preserveScrollOffsetRef.current = null;
      prevMessagesLengthRef.current = 0;
      setMessagePage(0);
      setHasOlderMessages(false);
      setShowLoadOlderButton(false);
      messageRefs.current = {};
      fetchMessages();

      // Khß╗ƒi tß║ío userLastReadMap tß╗½ participants hiß╗çn c├│
      if (selectedChat.participants) {
        const initialMap: Record<
          string,
          { messageId: string; avatarUrl: string; displayName: string }
        > = {};
        selectedChat.participants.forEach((p) => {
          if (p.userId !== user?.id && p.lastReadMessageId) {
            // T├¼m info user tß╗½ participantInfo (nß║┐u c├│) hoß║╖c mß║╖c ─æß╗ïnh
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

      socketService.joinConversation(selectedChat.id);
    }

    const handleReconnect = () => {
      if (selectedChat?.id) {
        socketService.joinConversation(selectedChat.id);
        // C├│ thß╗â fetch lß║íi messages ß╗ƒ ─æ├óy ─æß╗â m╞░ß╗út h╞ín, nh╞░ng tß║ím thß╗¥i cß╗⌐ join tr╞░ß╗¢c
      }
    };
    socketService.onConnect(handleReconnect);

    // Cleanup function to leave conversation when component unmounts or conversation changes
    return () => {
      socketService.removeConnectListener(handleReconnect);
      if (selectedChat) {
        socketService.leaveConversation(selectedChat.id);
      }
    };
  }, [selectedChat]);

  // Auto scroll to bottom khi th├¬m tin mß╗¢i (kh├┤ng ├íp dß╗Ñng l├║c prepend dß╗» liß╗çu c┼⌐)
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

  // Listen for new messages (chuß║⌐n ho├í payload backend: _id ΓåÆ id, type enum, ΓÇª)
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

      // Xß╗¡ l├╜ status & mark as seen
      if (message.senderId === user?.id) {
        // NG╞»ß╗£I Gß╗¼I L├Ç T├öI
        if (!selectedChat?.isGroup) {
          upgradeMsgStatus(message.id, "sent");
        }

        // XO├ü TIN NH├üP (PENDING/FAILED) Dß╗░A THEO CONTENT ─Éß╗é TR├üNH TR├ÖNG Lß║╢P DO OPTIMISTIC UI
        setMessages((prev) => {
          // Xem c├│ tin nhß║»n ß║úo PENDING hoß║╖c FAILED n├áo c├│ c├╣ng content kh├┤ng
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
        // NG╞»ß╗£I KIA Gß╗¼I
        if (message.id && message.conversationId) {
          // Xin ─æ├ính dß║Ñu ─æ├ú xem ngay
          socketService.sendRead(message.conversationId, message.id);
          // sendSeen c┼⌐ng giß╗» lß║íi ─æß╗â t╞░╞íng th├¡ch
          socketService.sendSeen(message.id, message.conversationId);
        }
      }
    };

    socketService.onNewMessage(handleNewMessage);
    socketService.onPinnedMessage(handlePinnedMessage);
    socketService.onMessageUnpinned(handleMessageUnpinned);
    socketService.onMessageDeletedForEveryone(handleMessageDeletedForEveryone);
    socketService.onConversationUpdated(handleConversationUpdated);

    return () => {
      socketService.removeMessageListener(handleNewMessage);
      socketService.removePinnedMessageListener(handlePinnedMessage);
      socketService.removeMessageUnpinnedListener(handleMessageUnpinned as any);
      socketService.removeMessageDeletedForEveryoneListener(
        handleMessageDeletedForEveryone,
      );
      socketService.removeConversationUpdatedListener(
        handleConversationUpdated,
      );
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

  // ΓöÇΓöÇ Lß║»ng nghe chat:read ΓåÆ n├óng status l├¬n "read" ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

      // Update readBy local cho message ─æ├│ ─æß╗â UI avatar render ngay
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

      // Di chuyß╗ân avatar ng╞░ß╗¥i ─æ├ú ─æß╗ìc tß╗¢i tin nhß║»n mß╗¢i nhß║Ñt hß╗ì vß╗½a ─æß╗ìc
      setUserLastReadMap((prev) => ({
        ...prev,
        [data.userId]: {
          messageId: data.messageId,
          avatarUrl: data.avatarUrl ?? prev[data.userId]?.avatarUrl ?? "",
          displayName: data.displayName ?? prev[data.userId]?.displayName ?? "",
        },
      }));
    };
    socketService.onMessageRead(handleRead);
    return () => socketService.removeMessageReadListener(handleRead);
  }, [selectedChat?.id, user?.id, upgradeMsgStatus]);

  // ΓöÇΓöÇ Tß╗▒ ─æß╗Öng mark as seen khi v├áo chat hoß║╖c c├│ tin mß╗¢i ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (messages.length > 0 && selectedChat?.id && user?.id) {
      // Lß║Ñy tin cuß╗æi c├╣ng
      const lastMsg = messages[messages.length - 1];
      // Nß║┐u l├á tß╗½ ng╞░ß╗¥i kh├íc v├á m├¼nh ch╞░a ─æß╗ìc (theo readBy local)
      if (lastMsg && lastMsg.senderId !== user.id) {
        const myUid = user.id;
        const alreadyRead = (lastMsg.readBy || []).includes(myUid);
        if (!alreadyRead) {
          console.log("[ChatArea] Marking last message as seen:", lastMsg.id);
          socketService.markAsSeen({
            conversationId: selectedChat.id,
            messageId: lastMsg.id,
          });
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

  // ΓöÇΓöÇ Lß║»ng nghe Poll Events (Zalo-style) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Lß║»ng nghe chat:delivered ΓåÆ n├óng status l├¬n "delivered" ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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

  // ΓöÇΓöÇ Load ß║únh nß╗ün tß╗½ AsyncStorage khi ─æß╗òi conversation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (!selectedChat?.id) return;
    AsyncStorage.getItem(BG_STORAGE_KEY(selectedChat.id))
      .then((saved) => {
        setChatBgId(saved ?? "default");
      })
      .catch(() => setChatBgId("default"));
  }, [selectedChat?.id]);

  // ΓöÇΓöÇ Lß║»ng nghe chat:background real-time tß╗½ ng╞░ß╗¥i kia ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    if (!selectedChat?.id) return;
    const handleBgChange = (data: {
      conversationId: string;
      backgroundId: string;
      userId: string;
    }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return; // ch├¡nh m├¼nh ─æß╗òi ΓåÆ bß╗Å qua
      setChatBgId(data.backgroundId);
      // L╞░u lß║íi ─æß╗â persistent
      void AsyncStorage.setItem(
        BG_STORAGE_KEY(data.conversationId),
        data.backgroundId,
      );
    };
    socketService.onBackgroundChanged(handleBgChange);
    return () => socketService.removeBackgroundListener(handleBgChange);
  }, [selectedChat?.id, user?.id]);

  /** ─Éß╗òi ß║únh nß╗ün: l╞░u local + broadcast + system message */
  const handleChangeBg = useCallback(
    async (bgId: string) => {
      if (!selectedChat?.id || !user?.id) return;
      const preset = CHAT_BACKGROUNDS.find((b) => b.id === bgId);
      if (!preset) return;

      setChatBgId(bgId);
      setShowBgPicker(false);

      // Persistent local
      await AsyncStorage.setItem(BG_STORAGE_KEY(selectedChat.id), bgId);

      // Broadcast real-time cho ng╞░ß╗¥i kia
      socketService.sendBackground(selectedChat.id, bgId);

      // System message: ph├ón biß╗çt "x├│a" vs "─æß╗òi"
      const actorName =
        String((user as any)?.name ?? "Ng╞░ß╗¥i d├╣ng").trim() || "Ng╞░ß╗¥i d├╣ng";
      const isReset = bgId === "default";
      const systemContent = isReset
        ? `${actorName} ─æ├ú x├│a ß║únh nß╗ün ─æoß║ín chat`
        : `${actorName} ─æ├ú ─æß╗òi ß║únh nß╗ün th├ánh ΓÇ£${preset.label}ΓÇ¥`;
      try {
        await MessageService.send({
          conversationId: selectedChat.id,
          senderId: user.id,
          content: systemContent,
          type: "SYSTEM",
        });
      } catch {
        // System message kh├┤ng critical
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
      // L╞░u userId ng╞░ß╗¥i kia ─æß╗â lß║»ng nghe presence update cß╗ºa ─æ├║ng ng╞░ß╗¥i
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

  // ΓöÇΓöÇΓöÇ Real-time presence update ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  // Giß╗æng b├ái tham khß║úo nh╞░ng th├¬m real-time: lß║»ng nghe `presence:update`
  // ─æß╗â cß║¡p nhß║¡t chß║Ñm xanh ngay khi ng╞░ß╗¥i d├╣ng kia thay ─æß╗òi online/offline
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

  // ΓöÇΓöÇΓöÇ Heartbeat: giß╗» trß║íng th├íi online cho ch├¡nh m├¼nh ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    const interval = setInterval(() => {
      socketService.sendHeartbeat();
    }, 30_000); // 30 gi├óy mß╗Öt lß║ºn
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

  // ΓöÇΓöÇ Send: gß╗¡i file trong queue TR╞»ß╗ÜC, rß╗ôi mß╗¢i gß╗¡i text ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const handleSendMessage = async () => {
    // Guard: block setting (1-1)
    if (peerMessageBlockedMe) {
      setError("Bß║ín ─æang bß╗ï chß║╖n nhß║»n tin trong cuß╗Öc tr├▓ chuyß╗çn n├áy.");
      return;
    }
    // Guard: group allowMessaging (admin lock)
    if (!groupChat.canSendMessage) {
      setError(
        groupChat.lockedChatMessage ||
          "Bß║ín kh├┤ng c├│ quyß╗ün nhß║»n tin trong nh├│m n├áy.",
      );
      return;
    }
    const hasText = newMessage.trim().length > 0;
    const hasFiles = pendingAttachments.length > 0;
    if (!selectedChat?.id || !user?.id) return;
    if (!hasText && !hasFiles) return;

    // 1) Gß╗¡i c├íc file ─æ├¡nh k├¿m
    if (hasFiles) {
      if (pendingAttachments.length === 1) {
        await uploadAndSendFile(pendingAttachments[0]);
      } else {
        await uploadAndSendMediaAlbum(pendingAttachments);
      }
      setPendingAttachments([]);
    }

    // 2) Gß╗¡i text (nß║┐u c├│)
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
          // fallback state tß╗½ selectedChat nß║┐u API ─æß╗ìc fail
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
        setError("Kh├┤ng bß║¡t ─æ╞░ß╗úc Bot AI. Vui l├▓ng thß╗¡ lß║íi.");
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
      setError("Kh├┤ng bß║¡t ─æ╞░ß╗úc Bot AI. Vui l├▓ng thß╗¡ lß║íi.");
    } finally {
      setEnablingAi(false);
    }
  };

  const handleDeclineEnableAi = () => {
    setShowEnableAiModal(false);
    setPendingAiMessage("");
    setToastMessage(
      "Bß║ín ch╞░a bß║¡t AI, Bot AI ch╞░a thß╗â ─æß╗ìc tin nhß║»n. Mß╗¥i bß║ín v├áo th├┤ng tin ─æoß║ín chat ─æß╗â bß║¡t.",
    );
    setToastVisible(true);
  };

  /** H├ám chuy├¬n d├╣ng gß╗¡i lß║íi tin nhß║»n bß╗ï lß╗ùi mß║íng */
  const handleRetryMessage = (failedMsg: Message) => {
    try {
      // Chuyß╗ân lß║íi th├ánh PENDING
      setMessages((prev) =>
        prev.map((m) =>
          m.id === failedMsg.id ? { ...m, status: "PENDING" } : m,
        ),
      );
      // T├¡nh lß║íi timestamp mß╗¢i
      const newMsgData = {
        ...failedMsg,
        sentAt: new Date().toISOString(),
        status: "PENDING",
      };
      socketService.sendMessage(newMsgData);

      // Setup lß║íi timeout rß╗¢t mß║íng
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

  // ΓöÇΓöÇ Reactions state (local, ─æ╞░ß╗úc update qua socket) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const [messageReactions, setMessageReactions] = useState<
    Record<string, Array<{ userId: string; emoji: string; reactedAt?: string }>>
  >({});

  /** Khß╗ƒi tß║ío reactions tß╗½ messages ─æ├ú tß║úi */
  useEffect(() => {
    const init: Record<string, Array<{ userId: string; emoji: string }>> = {};
    messages.forEach((m) => {
      if (m.reactions && m.reactions.length > 0) init[m.id] = m.reactions;
    });
    setMessageReactions((prev) => ({ ...init, ...prev }));
  }, [messages]);

  /** Lß║»ng nghe broadcast reaction tß╗½ server */
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
          // Unreact incremental: giß║úm ─æ├║ng 1 lß║ºn react gß║ºn nhß║Ñt cß╗ºa user n├áy
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
        // React incremental: append ─æß╗â giß╗» logic spam cß╗Öng dß╗ôn
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

  /** Gß╗¡i react ΓåÆ cß╗Öng dß╗ôn (1 ng╞░ß╗¥i c├│ thß╗â spam react nhiß╗üu lß║ºn) */
  const handleReact = (
    messageId: string,
    conversationId: string,
    emoji: string,
  ) => {
    if (!user?.id) return;
    const myUserId = user.id;
    // Kh├┤ng optimistic update ─æß╗â tr├ính double apply khi event realtime vß╗ü.
    void MessageService.react(messageId, myUserId, emoji).catch(() => {
      socketService.sendReaction({ messageId, conversationId, emoji });
    });
    setActiveReactionId(null);
  };

  /** Thu hß╗ôi 1 lß║ºn react (giß║úm count ─æi 1) */
  const handleUnreact = (
    messageId: string,
    conversationId: string,
    emoji: string,
  ) => {
    if (!user?.id) return;
    const myUserId = user.id;
    // Kh├┤ng optimistic update ─æß╗â tr├ính double apply khi event realtime vß╗ü.
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
    if (sourceMessages.length === 0 || !user?.id) return;

    let successCount = 0;
    let failedCount = 0;

    for (const conversationId of selectedConversations) {
      for (const src of sourceMessages) {
        try {
          await MessageService.forward(src.id, conversationId, user.id);
          successCount += 1;
        } catch (err) {
          failedCount += 1;
          console.error("Error forwarding message:", {
            messageId: src.id,
            conversationId,
            err,
          });
        }
      }
    }

    if (successCount === 0) {
      setError("Kh├┤ng thß╗â chuyß╗ân tiß║┐p tin nhß║»n");
      return;
    }

    setShowForwardModal(false);
    setReplyingTo(null);
    setForwardTargets([]);
    setIsMultiSelectMode(false);
    setSelectedMessageIds([]);

    // Force reload inbox/nav-left so forwarded target conversations show latest preview immediately.
    onConversationMetaChanged?.();

    if (failedCount > 0) {
      setError(`─É├ú chuyß╗ân tiß║┐p ${successCount} tin, ${failedCount} tin lß╗ùi`);
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
    // Focus v├áo input
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
      setError("Kh├┤ng thß╗â x├│a c├íc tin nhß║»n ─æ├ú chß╗ìn");
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
      setError("Kh├┤ng thß╗â thu hß╗ôi mß╗Öt sß╗æ tin nhß║»n ─æ├ú chß╗ìn");
    }
  }, [canMultiRecall, selectedMessages, socketService]);

  /** X├│a ph├¡a t├┤i ΓÇö mß╗ìi tin (kß╗â cß║ú ng╞░ß╗¥i kh├íc gß╗¡i) */
  const openDeleteForMe = (msg: Message) => {
    setMessageToDelete(msg);
    setDeleteMode("me");
    setShowDeleteConfirm(true);
    setShowMessageOptions(false);
  };

  /** Thu hß╗ôi ΓÇö chß╗ë tin cß╗ºa m├¼nh */
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
    // Kiß╗âm tra dß╗» liß╗çu hß╗úp lß╗ç
    if (!voteQuestion.trim()) {
      // C├│ thß╗â th├¬m th├┤ng b├ío lß╗ùi
      return;
    }

    // Lß╗ìc ra c├íc lß╗▒a chß╗ìn kh├┤ng trß╗æng
    const filteredOptions = voteOptions.filter((opt) => opt.trim());

    if (filteredOptions.length < 2) {
      // C├│ thß╗â th├¬m th├┤ng b├ío lß╗ùi: cß║ºn ├¡t nhß║Ñt 2 lß╗▒a chß╗ìn
      return;
    }

    // Xß╗¡ l├╜ deadline (nß║┐u c├│)
    let deadlineIso = null;
    if (voteDeadlineDate) {
      const timeToUse = voteDeadlineTime || "23:59";
      console.log(
        `[handleCreateVote] Processing deadline: Date=${voteDeadlineDate}, Time=${timeToUse}`,
      );
      deadlineIso = parseAppointmentDateTimeInput(voteDeadlineDate, timeToUse);
      if (!deadlineIso) {
        const errorMsg =
          "─Éß╗ïnh dß║íng ng├áy/giß╗¥ hß║┐t hß║ín kh├┤ng hß╗úp lß╗ç (DD/MM/YYYY HH:MM)";
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

    // Gß╗¡i y├¬u cß║ºu tß║ío vote th├┤ng qua socket
    socketService.createVote({
      conversationId: selectedChat.id,
      question: voteQuestion,
      options: filteredOptions,
      multiple: allowMultipleVotes,
      deadline: deadlineIso,
    });

    // System message th├┤ng b├ío tß║ío b├¼nh chß╗ìn
    const deadlineNotice = deadlineIso
      ? ` (Hß║┐t hß║ín l├║c: ${formatAppointmentTime(deadlineIso)})`
      : "";
    void sendSystemNotice(
      `${actorDisplayName} ─æ├ú tß║ío b├¼nh chß╗ìn: "${voteQuestion.trim()}"${deadlineNotice}`,
    );

    // Reset form v├á ─æ├│ng modal
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
        setError(response?.message || "Kh├┤ng thß╗â chß╗ënh sß╗¡a tin nhß║»n");
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
      setError("Kh├┤ng thß╗â chß╗ënh sß╗¡a tin nhß║»n");
    }
  };

  const recallMessageLocally = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? (() => {
              // Nß║┐u ─æ├ú l├á tin thu hß╗ôi v├á ─æ├ú c├│ bß║ún gß╗æc ΓåÆ giß╗» nguy├¬n, chß╗ë ─æß║úm bß║úo cache ─æß╗ông bß╗Ö.
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
                content: "Tin nhß║»n ─æ├ú ─æ╞░ß╗úc thu hß╗ôi",
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
      setError("Kh├┤ng t├¼m thß║Ñy nß╗Öi dung gß╗æc ─æß╗â sao ch├⌐p.");
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
      const title = payload?.title || "Lß╗ïch hß║╣n";
      Alert.alert("Nhß║»c lß╗ïch hß║╣n", `─Éß║┐n giß╗¥: ${title}`);
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
          setError(response.statusMessage || "Kh├┤ng thß╗â x├│a tin nhß║»n");
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
        setError(response.statusMessage || "Kh├┤ng thß╗â thu hß╗ôi tin nhß║»n");
      }
    } catch (err) {
      console.error("Error deleting message:", err);
      setError("C├│ lß╗ùi xß║úy ra khi x├│a tin nhß║»n");
    }
  };

  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [showPinnedMessagesList, setShowPinnedMessagesList] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const messageRefs = useRef<{ [key: string]: number }>({});

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

  const movePinnedMessage = async (index: number, direction: "up" | "down") => {
    if (!selectedChat?.id) return;
    const newPinned = [...pinnedMessages];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newPinned.length) return;

    const [removed] = newPinned.splice(index, 1);
    newPinned.splice(targetIndex, 0, removed);

    setPinnedMessages(newPinned);

    try {
      const messageIds = newPinned.map((m) => m.id);
      await MessageService.reorderPinned(selectedChat.id, messageIds);
    } catch (err) {
      console.error("Error reordering pinned messages:", err);
      void refreshPinnedMessages();
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
      setError("Kh├┤ng thß╗â ghim tin nhß║»n");
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
      setError("Kh├┤ng thß╗â bß╗Å ghim tin nhß║»n");
    }
  };

  const isSelectedMessagePinned = useMemo(() => {
    if (!selectedMessage) return false;
    const sid = String(selectedMessage.id ?? "");
    if (selectedMessage.pinned) return true;
    return pinnedMessages.some((p) => String(p.id ?? "") === sid);
  }, [selectedMessage, pinnedMessages]);

  /** Gh├⌐p trß║íng th├íi ghim tß╗½ GET /pinned v├¼ list tin nhß║»n th╞░ß╗¥ng kh├┤ng c├│ field pinned. */
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

  // Socket `message:pinned` (├¡t field) + REST `chat:message-pinned` ΓÇö ─æß╗ông bß╗Ö qua GET /pinned
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
      setError("Kh├┤ng t├¼m thß║Ñy tin nhß║»n gß╗æc trong ─æoß║ín hß╗Öi thoß║íi ─æ├ú tß║úi.");
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

    // Close the pinned messages list
    setShowPinnedMessagesList(false);
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

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    Linking.openURL(href).catch(() => {
      setError("Kh├┤ng thß╗â mß╗ƒ li├¬n kß║┐t.");
    });
  }, []);

  const renderTextWithLinks = useCallback(
    (text: string, isSender: boolean, messageId: string) => {
      // Thu thß║¡p ─æß║ºy ─æß╗º t├¬n th├ánh vi├¬n ─æß╗â Regex c├│ thß╗â bß║»t ─æ╞░ß╗úc c├íc t├¬n c├│ dß║Ñu c├ích
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>─Éang tß║úi...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-red-500">Lß╗ùi: {error}</Text>
      </View>
    );
  }

  if (!selectedChat) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">
          Chß╗ìn mß╗Öt cuß╗Öc tr├▓ chuyß╗çn ─æß╗â bß║»t ─æß║ºu
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-col">
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
              `${actorDisplayName} ─æ├ú ─æß║╖t biß╗çt danh cß╗ºa m├¼nh th├ánh "${nickname}" trong cuß╗Öc tr├▓ chuyß╗çn vß╗¢i ${peerDisplayName}.`,
            );
          } else if (action === "clear") {
            void sendSystemNotice(
              previousNickname
                ? `${actorDisplayName} ─æ├ú hß╗ºy biß╗çt danh "${previousNickname}" trong cuß╗Öc tr├▓ chuyß╗çn vß╗¢i ${peerDisplayName}.`
                : `${actorDisplayName} ─æ├ú hß╗ºy biß╗çt danh trong cuß╗Öc tr├▓ chuyß╗çn vß╗¢i ${peerDisplayName}.`,
            );
          } else {
            void sendSystemNotice(
              `${actorDisplayName} ─æ├ú ─æß╗òi biß╗çt danh tß╗½ "${previousNickname || "(trß╗æng)"}" th├ánh "${nickname || "(trß╗æng)"}" trong cuß╗Öc tr├▓ chuyß╗çn vß╗¢i ${peerDisplayName}.`,
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
        const bgProps =
          activeBg.type === "image"
            ? {
                source: { uri: activeBg.value },
                imageStyle: { opacity: 0.75 } as any,
              }
            : { source: {} };
        return (
          <ImageBackground
            {...bgProps}
            style={[
              { flex: 1 },
              activeBg.type === "color"
                ? { backgroundColor: activeBg.value }
                : undefined,
            ]}
          >
            <ScrollView
              ref={scrollViewRef}
              className={`flex-1 p-4 ${pinnedMessages.length > 0 ? "pt-16" : "pt-4"}`}
              removeClippedSubviews={false}
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
                    <Text className="ml-2 text-[12px] text-gray-600 font-medium">
                      {loadingOlderMessages
                        ? "─Éang tß║úi dß╗» liß╗çu c┼⌐..."
                        : "Bß║ín c├│ muß╗æn load data c┼⌐ h╞ín kh├┤ng?"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {messages.length === 0 && (
                <ChatNewer selectedChat={selectedChat} />
              )}

              {/* Render messages */}
              {(() => {
                // ID cß╗ºa tin cuß╗æi dß║íng bubble m├¼nh gß╗¡i (bß╗Å qua SYSTEM/─æ├ú x├│a)
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
                  const appointmentWhen = appointmentContext?.remindAt
                    ? formatAppointmentTime(appointmentContext.remindAt)
                    : null;

                  // Special rendering for SYSTEM type messages (pinned messages)
                  if (msg.type === MessageType.SYSTEM) {
                    return (
                      <View
                        key={msg.id}
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
                    );
                  }

                  // Regular message rendering
                  return (
                    <View
                      key={msg.id}
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
                              uri:
                                messageUsers[msg.senderId]?.avatarURL ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  messageUsers[msg.senderId]?.name || "User",
                                )}&background=0068FF&color=fff`,
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
                                ? undefined
                                : mobileMessageMaxWidth,
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
                                  ? "H├¼nh ß║únh"
                                  : rType === MessageType.VIDEO
                                    ? "Video"
                                    : rType === MessageType.AUDIO
                                      ? "Tin nhß║»n thoß║íi"
                                      : rType === MessageType.FILE
                                        ? ((repliedToMessage?.metadata as any)
                                            ?.fileName ?? "File")
                                        : rType === MessageType.MEDIA_ALBUM
                                          ? "Album ß║únh/video"
                                          : repliedToMessage?.content ||
                                            "Tin nhß║»n ─æ├ú bß╗ï xo├í";

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
                                  {/* Thumbnail ß║únh */}
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
                                      {messageUsers[
                                        repliedToMessage?.senderId ?? ""
                                      ]?.name || "Ng╞░ß╗¥i d├╣ng"}
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
                                  ? undefined
                                  : mobileMessageMaxWidth,
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
                                        {getSenderName(msg.senderId)}
                                      </Text>
                                    )}
                                  <Text
                                    className={`italic ${
                                      msg.senderId === user?.id
                                        ? "text-white/90"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    Tin nhß║»n ─æ├ú ─æ╞░ß╗úc thu hß╗ôi
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
                                        {getSenderName(msg.senderId)}
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
                                        {getSenderName(msg.senderId)}
                                      </Text>
                                    )}

                                  {msg.type === MessageType.TEXT ? (
                                    isAppointmentMessage ? (
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
                                                  "Kh├┤ng thß╗â mß╗ƒ bß║ún ─æß╗ô.",
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
                                          ? "ß║ónh"
                                          : msg.type === MessageType.VIDEO
                                            ? "Video"
                                            : msg.type === MessageType.AUDIO
                                              ? "Ghi ├óm thoß║íi"
                                              : "Tß╗çp")
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
                                          const actorName =
                                            msg.senderId === user?.id
                                              ? "Bß║ín"
                                              : getSenderName(msg.senderId);
                                          const d =
                                            ctx?.durationText ||
                                            (typeof ctx?.durationSeconds ===
                                            "number"
                                              ? `${ctx.durationSeconds}s`
                                              : "");

                                          if (!isGroupCall) {
                                            if (msg.content === "start")
                                              return "≡ƒô₧ Cuß╗Öc gß╗ìi ─æang bß║»t ─æß║ºu";
                                            return d
                                              ? `≡ƒô┤ Cuß╗Öc gß╗ìi ─æ├ú kß║┐t th├║c ΓÇó ${d}`
                                              : "≡ƒô┤ Cuß╗Öc gß╗ìi ─æ├ú kß║┐t th├║c";
                                          }

                                          if (msg.content === "start")
                                            return "≡ƒô₧ Cuß╗Öc gß╗ìi nh├│m ─æang bß║»t ─æß║ºu";
                                          if (msg.content === "group_declined")
                                            return `Γ¥î ${actorName} ─æ├ú tß╗½ chß╗æi tham gia gß╗ìi nh├│m`;
                                          if (msg.content === "group_joined")
                                            return `Γ£à ${actorName} ─æ├ú tham gia gß╗ìi nh├│m`;
                                          if (msg.content === "group_left")
                                            return `Γå⌐∩╕Å ${actorName} ─æ├ú rß╗¥i cuß╗Öc gß╗ìi nh├│m`;
                                          return d
                                            ? `≡ƒô┤ Cuß╗Öc gß╗ìi nh├│m ─æ├ú kß║┐t th├║c ΓÇó ${d}`
                                            : "≡ƒô┤ Cuß╗Öc gß╗ìi nh├│m ─æ├ú kß║┐t th├║c";
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

                          {/* ΓöÇΓöÇ Reaction summary ΓÇö render b├¬n NGO├ÇI bubble ΓöÇΓöÇ */}
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
                              ─Éang gß╗¡i...
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
                                Lß╗ùi kß║┐t nß╗æi. Thß╗¡ lß║íi
                              </Text>
                            </TouchableOpacity>
                          )}

                          {msg.editedAt && !msg.isDeletedForEveryone && (
                            <Text className="text-[11px] text-gray-400 mt-1 italic">
                              ─É├ú sß╗¡a
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

                          {/* Hiß╗ân thß╗ï avatar ng╞░ß╗¥i ─æ├ú xem tß║íi tin nhß║»n cuß╗æi c├╣ng hß╗ì ─æß╗ìc */}
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
                                        r.avatarUrl ||
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
                                      ─É├ú xem hß║┐t
                                    </Text>
                                  )}
                              </View>
                            );
                          })()}

                          {/* ΓöÇΓöÇ Status icon: chß╗ë hiß╗çn ß╗ƒ tin cuß╗æi m├¼nh gß╗¡i, chat 1-1, v├á kh├┤ng ─æang xß╗¡ l├╜ ΓöÇΓöÇ */}
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
                                  // Nß║┐u ─æ├ú c├│ avatar hiß╗ân thß╗ï tß╗⌐c l├á ─æ├ú 'read', ta kh├┤ng cß║ºn hiß╗çn tick t├¡m nß╗»a cho ─æß╗í rß╗æi
                                  const readers = Object.values(
                                    userLastReadMap,
                                  ).filter((v) => v.messageId === msg.id);
                                  if (status === "read" || readers.length > 0)
                                    return null;

                                  if (status === "delivered") {
                                    // ─É├ú nhß║¡n: 2 tick x├ím
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
                                          ─É├ú nhß║¡n
                                        </Text>
                                      </>
                                    );
                                  }
                                  // sent: 1 tick x├ím
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
                                        ─É├ú gß╗¡i
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
                              uri:
                                messageUsers[msg.senderId]?.avatarURL ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  messageUsers[msg.senderId]?.name || "User",
                                )}&background=0068FF&color=fff`,
                            }}
                            className={`w-8 h-8 rounded-full ml-2 mt-3 ${isConsecutiveWithPrev ? "opacity-0" : ""}`}
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    </View>
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
              <Text className="text-xl font-semibold">Tß║ío b├¼nh chß╗ìn</Text>
              <TouchableOpacity onPress={toggleModelVote}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Vote Question */}
            <View className="mb-5">
              <Text className="text-gray-500 mb-2">Chß╗º ─æß╗ü b├¼nh chß╗ìn</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 min-h-[45px] text-base"
                placeholder="─Éß║╖t c├óu hß╗Åi b├¼nh chß╗ìn"
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
              <Text className="text-gray-500 mb-2">C├íc lß╗▒a chß╗ìn</Text>
              {voteOptions.map((option, index) => (
                <View
                  key={`option-${index}`}
                  className="flex-row items-center mb-3"
                >
                  <TextInput
                    className="flex-1 border border-gray-300 rounded-lg p-3 min-h-[45px] text-base"
                    placeholder={`Lß╗▒a chß╗ìn ${index + 1}`}
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
                <Text className="ml-2 text-blue-500">Th├¬m lß╗▒a chß╗ìn</Text>
              </TouchableOpacity>

              {/* Deadline selection */}
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-500">
                  Thß╗¥i gian hß║┐t hß║ín (kh├┤ng bß║»t buß╗Öc)
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setQuickDeadline(1)}
                    className="bg-blue-50 px-2 py-1 rounded"
                  >
                    <Text className="text-blue-600 text-xs font-medium">
                      +1 giß╗¥
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setQuickDeadline(24)}
                    className="bg-blue-50 px-2 py-1 rounded"
                  >
                    <Text className="text-blue-600 text-xs font-medium">
                      +24 giß╗¥
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
                        {voteDeadlineDate || "Chß╗ìn ng├áy"}
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
                        {voteDeadlineTime || "Chß╗ìn giß╗¥"}
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
                Cho ph├⌐p chß╗ìn nhiß╗üu lß╗▒a chß╗ìn
              </Text>
            </View>

            {/* Footer buttons */}
            <View className="flex-row justify-end mt-2">
              <TouchableOpacity
                className="px-5 py-2 mr-2 rounded-lg bg-gray-100"
                onPress={toggleModelVote}
              >
                <Text className="font-medium text-gray-700">Hß╗ºy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="px-5 py-2 rounded-lg bg-blue-500"
                onPress={handleCreateVote}
              >
                <Text className="font-medium text-white">Tß║ío b├¼nh chß╗ìn</Text>
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
                    uri:
                      messageUsers[selectedMessage.senderId]?.avatarURL ||
                      "https://placehold.co/40x40/0068FF/FFFFFF/png?text=G",
                  }}
                  className="w-10 h-10 rounded-full"
                  resizeMode="cover"
                />
                <View className="ml-3 flex-1">
                  <Text className="text-gray-800 font-medium">
                    {messageUsers[selectedMessage.senderId]?.name}
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
                        "Tin nhß║»n ─æ├ú ─æ╞░ß╗úc thu hß╗ôi"
                      );
                    }
                    if (selectedMessage.type === MessageType.VOTE) {
                      try {
                        const data = JSON.parse(selectedMessage.content);
                        return `[B├¼nh chß╗ìn] ${data.question}`;
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
                <Text className="ml-3 text-gray-800">Trß║ú lß╗¥i</Text>
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
                      Sao ch├⌐p l├¬n ├┤ nhß║¡p ─æß╗â gß╗¡i lß║íi
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
                    <Text className="ml-3 text-gray-800">Chß╗ënh sß╗¡a</Text>
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
                    <Text className="ml-3 text-gray-800">─Éß╗òi lß╗ïch hß║╣n</Text>
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
                        "Hß╗ºy lß╗ïch hß║╣n",
                        "Bß║ín chß║»c chß║»n muß╗æn hß╗ºy lß╗ïch hß║╣n n├áy?",
                        [
                          { text: "Kh├┤ng", style: "cancel" },
                          {
                            text: "Hß╗ºy lß╗ïch",
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
                    <Text className="ml-3 text-red-500">Hß╗ºy lß╗ïch hß║╣n</Text>
                  </TouchableOpacity>
                )}

              <TouchableOpacity
                className="flex-row items-center p-4 active:bg-gray-50"
                onPress={() => handleForwardMessage(selectedMessage)}
              >
                <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                  <Ionicons name="arrow-redo" size={20} color="#3B82F6" />
                </View>
                <Text className="ml-3 text-gray-800">Chuyß╗ân tiß║┐p</Text>
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
                <Text className="ml-3 text-gray-800">Chß╗ìn nhiß╗üu</Text>
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
                    <Text className="ml-3 text-gray-800">Ghim tin nhß║»n</Text>
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
                    <Text className="ml-3 text-gray-800">Bß╗Å ghim</Text>
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
                  <Text className="ml-3 text-gray-800">X├│a ph├¡a t├┤i</Text>
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
                      Thu hß╗ôi (x├│a cho mß╗ìi ng╞░ß╗¥i)
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
                Chß╗ënh sß╗¡a tin nhß║»n
              </Text>
              <Text className="text-sm text-gray-500">
                Bß║ín chß╗ë c├│ thß╗â chß╗ënh sß╗¡a mß╗ùi tin nhß║»n 1 lß║ºn.
              </Text>
            </View>
            <View className="p-4">
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 min-h-[90px]"
                multiline
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Nhß║¡p nß╗Öi dung mß╗¢i..."
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
                <Text className="text-gray-800 font-medium">Hß╗ºy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90"
                style={{ backgroundColor: "#2563eb" }}
                onPress={confirmEditMessage}
              >
                <Text
                  style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}
                >
                  L╞░u
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
                ─Éß╗òi lß╗ïch hß║╣n
              </Text>
              <Text className="text-sm text-gray-500">
                Cß║¡p nhß║¡t ti├¬u ─æß╗ü, ng├áy v├á giß╗¥.
              </Text>
            </View>
            <View className="p-4">
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 mb-3"
                value={appointmentEditTitle}
                onChangeText={setAppointmentEditTitle}
                placeholder="Ti├¬u ─æß╗ü lß╗ïch hß║╣n"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 mb-3"
                value={appointmentEditDate}
                onChangeText={setAppointmentEditDate}
                placeholder="Ng├áy (DD/MM/YYYY)"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900"
                value={appointmentEditTime}
                onChangeText={setAppointmentEditTime}
                placeholder="Giß╗¥ (HH:mm)"
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
                <Text className="text-gray-800 font-medium">Hß╗ºy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90 bg-blue-600"
                onPress={() => {
                  const nextTitle = appointmentEditTitle.trim();
                  if (!nextTitle) {
                    setError("Ti├¬u ─æß╗ü lß╗ïch hß║╣n kh├┤ng hß╗úp lß╗ç.");
                    return;
                  }
                  const nextIso = parseAppointmentDateTimeInput(
                    appointmentEditDate,
                    appointmentEditTime,
                  );
                  if (!nextIso) {
                    setError("Sai ─æß╗ïnh dß║íng ng├áy/giß╗¥.");
                    return;
                  }
                  if (new Date(nextIso).getTime() <= Date.now() + 15_000) {
                    setError("Thß╗¥i gian lß╗ïch hß║╣n cß║ºn lß╗¢n h╞ín hiß╗çn tß║íi.");
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
                  L╞░u thay ─æß╗òi
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
                {deleteMode === "me" ? "X├│a ph├¡a t├┤i" : "Thu hß╗ôi tin nhß║»n"}
              </Text>
              <Text className="text-gray-600 text-center">
                {deleteMode === "me"
                  ? "Chß╗ë ß║⌐n tin tr├¬n thiß║┐t bß╗ï cß╗ºa bß║ín. Ng╞░ß╗¥i kh├íc trong cuß╗Öc tr├▓ chuyß╗çn vß║½n thß║Ñy tin n├áy."
                  : "Thu hß╗ôi sß║╜ x├│a tin cho mß╗ìi ng╞░ß╗¥i trong cuß╗Öc tr├▓ chuyß╗çn. H├ánh ─æß╗Öng n├áy kh├┤ng thß╗â ho├án t├íc."}
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
                <Text className="text-gray-800 font-medium">Hß╗ºy</Text>
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
                  {deleteMode === "me" ? "X├│a ph├¡a t├┤i" : "Thu hß╗ôi"}
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
              ? "H├¼nh ß║únh"
              : rType === MessageType.VIDEO
                ? "Video"
                : rType === MessageType.AUDIO
                  ? "Tin nhß║»n thoß║íi"
                  : rType === MessageType.FILE
                    ? ((replyingTo.metadata as any)?.fileName ?? "File")
                    : rType === MessageType.MEDIA_ALBUM
                      ? "Album ß║únh/video"
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

              {/* Thumbnail nhß╗Å nß║┐u l├á ß║únh */}
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
                    {messageUsers[replyingTo.senderId]?.name || "Ng╞░ß╗¥i d├╣ng"}
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

      {/* ΓöÇΓöÇ Attachment Queue (Zalo-style) ΓöÇΓöÇ */}
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
              ─É├ú chß╗ìn {selectedMessages.length} tin nhß║»n
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsMultiSelectMode(false);
                setSelectedMessageIds([]);
              }}
            >
              <Text className="text-blue-600 font-medium">Hß╗ºy</Text>
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
                X├│a ph├¡a t├┤i
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
                Chuyß╗ân tiß║┐p
              </Text>
            </TouchableOpacity>
            {canMultiRecall && (
              <TouchableOpacity
                className="px-3 py-2 rounded-lg bg-red-50"
                onPress={() => void handleRecallSelected()}
              >
                <Text className="text-red-600">Thu hß╗ôi</Text>
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
            Bß║ín kh├┤ng thß╗â nhß║»n tin trong cuß╗Öc tr├▓ chuyß╗çn n├áy v├¼ ─æ├ú bß╗ï chß║╖n.
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
                  ─Éang ghi ├óm {voiceRecordingSeconds}s
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
                  Dß╗½ng & gß╗¡i
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View className="flex-row items-center position-relative">
            {/* N├║t Γ₧ò mß╗ƒ popup chß╗ìn loß║íi file (giß╗» nguy├¬n nh╞░ c┼⌐) */}
            <View className="relative">
              <TouchableOpacity className="p-2" onPress={toggleModelChecked}>
                <Ionicons name="add-circle-outline" size={24} color="#666" />
              </TouchableOpacity>

              {/* Badge ─æß╗Å khi c├│ file trong queue */}
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

              {/* Popup chß╗ìn loß║íi tß╗çp ΓÇö giß╗æng c┼⌐ */}
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
                        ─É├¡nh k├¿m
                      </Text>

                      {/* H├¼nh ß║únh / Video */}
                      <TouchableOpacity
                        className="flex-row items-center mb-2"
                        onPress={() => {
                          toggleModelChecked();
                          handleSelectFile();
                        }}
                      >
                        <Ionicons name="image-outline" size={24} color="#666" />
                        <Text className="ml-2 text-gray-800">
                          H├¼nh ß║únh/Video
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
                            ? "─Éang lß║Ñy vß╗ï tr├¡..."
                            : "Chia sß║╗ vß╗ï tr├¡"}
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
                              "Quyß╗ün hß║ín",
                              "Quß║ún trß╗ï vi├¬n ─æ├ú tß║»t quyß╗ün tß║ío lß╗ïch hß║╣n ─æß╗æi vß╗¢i th├ánh vi├¬n.",
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
                        <Text className="ml-2 text-gray-800">Tß║ío lß╗ïch hß║╣n</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="flex-row items-center"
                        onPress={() => {
                          toggleModelChecked();
                          void handleVoiceAction();
                        }}
                      >
                        <Ionicons
                          name={
                            isRecordingVoice
                              ? "stop-circle-outline"
                              : "mic-outline"
                          }
                          size={24}
                          color={isRecordingVoice ? "#dc2626" : "#666"}
                        />
                        <Text className="ml-2 text-gray-800">
                          {isRecordingVoice
                            ? `Dß╗½ng v├á gß╗¡i ghi ├óm (${voiceRecordingSeconds}s)`
                            : "Ghi ├óm thoß║íi"}
                        </Text>
                      </TouchableOpacity>

                      {/* ─Éß╗òi ß║únh nß╗ün */}
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
                          ─Éß╗òi ß║únh nß╗ün
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
                      "Quyß╗ün hß║ín",
                      "Quß║ún trß╗ï vi├¬n ─æ├ú tß║»t quyß╗ün tß║ío b├¼nh chß╗ìn ─æß╗æi vß╗¢i th├ánh vi├¬n.",
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
                placeholder="Nhß║¡p tin nhß║»n..."
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
                  ...(Platform.OS === "android"
                    ? { includeFontPadding: false }
                    : {}),
                }}
                onContentSizeChange={(event) => {
                  const { height } = event.nativeEvent.contentSize;
                  setInputHeight(height > 24 ? height : 24);
                }}
              />
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
                Bß║ín ch╞░a bß║¡t Bot AI
              </Text>
              <Text style={{ fontSize: 14, color: "#4b5563", lineHeight: 20 }}>
                Bß║ín c├│ muß╗æn bß║¡t Bot AI ngay b├óy giß╗¥ ─æß╗â tiß║┐p tß╗Ñc c├óu hß╗Åi n├áy
                kh├┤ng?
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
                  Kh├┤ng
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
                  {enablingAi ? "─Éang bß║¡t..." : "C├│"}
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
        type="warning"
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
      {pinnedMessages.length > 0 && (
        <View className="absolute top-[70px] left-2 right-2 z-10 items-center">
          <TouchableOpacity
            className="bg-white rounded-lg p-3 mx-3 shadow-md w-[95%] flex-row items-center justify-between"
            onPress={() => setShowPinnedMessagesList(!showPinnedMessagesList)}
          >
            <View
              className="flex-row items-center flex-1 mr-2"
              style={{ overflow: "hidden" }}
            >
              <Image
                source={{
                  uri: "https://res-zalo.zadn.vn/upload/media/2023/8/23/ic_pin_1692773653119_121326.png",
                }}
                style={{ width: 16, height: 16 }}
                resizeMode="contain"
              />
              <Text
                className="text-gray-700 ml-2 font-medium"
                numberOfLines={1}
              >
                {messageUsers[pinnedMessages[0].senderId]?.name || "Ng╞░ß╗¥i d├╣ng"}
                : {getPinnedPreview(pinnedMessages[0])}
              </Text>
            </View>
            <Ionicons
              name={showPinnedMessagesList ? "chevron-up" : "chevron-down"}
              size={16}
              color="#666"
            />
          </TouchableOpacity>

          {showPinnedMessagesList && (
            <View className="bg-white rounded-lg mt-1 mx-3 p-2 shadow-md w-[95%] max-h-[300px]">
              <ScrollView className="max-h-[300px]">
                {pinnedMessages.map((pinnedMsg, index) => {
                  const sender = messageUsers[pinnedMsg.senderId];
                  return (
                    <View
                      key={pinnedMsg.id}
                      className="p-3 border-b border-gray-100 flex-row items-center"
                    >
                      <TouchableOpacity
                        className="flex-1 flex-row items-center active:bg-gray-50"
                        onPress={() => scrollToMessage(pinnedMsg.id)}
                      >
                        <Image
                          source={{
                            uri:
                              sender?.avatarURL ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                sender?.name || "User",
                              )}&background=0068FF&color=fff`,
                          }}
                          className="w-8 h-8 rounded-full"
                          resizeMode="cover"
                        />
                        <View className="ml-2 flex-1">
                          <Text
                            className="font-medium text-gray-800"
                            numberOfLines={1}
                          >
                            {sender?.name || "Unknown User"}
                          </Text>
                          <Text
                            className="text-gray-500 text-sm"
                            numberOfLines={1}
                          >
                            {getPinnedPreview(pinnedMsg)}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {groupChat.isAdminOrMod || groupChat.isAllowMemberPin ? (
                        <View className="flex-row items-center ml-2">
                          <TouchableOpacity
                            className={`p-1 ${index === 0 ? "opacity-20" : ""}`}
                            disabled={index === 0}
                            onPress={() => movePinnedMessage(index, "up")}
                          >
                            <Ionicons
                              name="arrow-up-circle"
                              size={24}
                              color="#3B82F6"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            className={`p-1 ${index === pinnedMessages.length - 1 ? "opacity-20" : ""}`}
                            disabled={index === pinnedMessages.length - 1}
                            onPress={() => movePinnedMessage(index, "down")}
                          >
                            <Ionicons
                              name="arrow-down-circle"
                              size={24}
                              color="#666"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            className="p-1 ml-1"
                            onPress={() => handleUnpinMessage(pinnedMsg)}
                          >
                            <Ionicons
                              name="close-circle-outline"
                              size={24}
                              color="#EF4444"
                            />
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* ΓöÇΓöÇ Pin Limit Modal ΓöÇΓöÇ */}
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
                  ─É├ú ─æß║ít giß╗¢i hß║ín ghim
                </Text>
                <Text className="text-gray-600 text-center mb-4 leading-5">
                  Bß║ín chß╗ë c├│ thß╗â ghim tß╗æi ─æa 3 tin nhß║»n. Vui l├▓ng chß╗ìn 1 tin
                  nhß║»n ─æß╗â bß╗Å ghim tr╞░ß╗¢c khi ghim tin mß╗¢i.
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
                                {messageUsers[msg.senderId]?.name ||
                                  "Ng╞░ß╗¥i d├╣ng"}
                                : {getPinnedPreview(msg)}
                              </Text>
                            </View>
                            {isOldest && (
                              <Text className="text-xs text-orange-500 font-medium">
                                Ghim c┼⌐ nhß║Ñt
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
                  <Text className="text-gray-700 font-semibold">Hß╗ºy</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ΓöÇΓöÇ Wallpaper / Background Picker Modal ΓöÇΓöÇ */}
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
              justifyContent: "flex-end",
            }}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingTop: 12,
                  paddingBottom: 36,
                  paddingHorizontal: 20,
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
                    Chß╗ìn ß║únh nß╗ün
                  </Text>
                  <TouchableOpacity onPress={() => setShowBgPicker(false)}>
                    <Ionicons name="close-circle" size={26} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                {/* Grid 2 cß╗Öt */}
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
                    return (
                      <TouchableOpacity
                        key={bg.id}
                        onPress={() => void handleChangeBg(bg.id)}
                        style={{
                          width: "47%",
                          height: 110,
                          borderRadius: 16,
                          overflow: "hidden",
                          borderWidth: isActive ? 3 : 1.5,
                          borderColor: isActive ? "#6d28d9" : "#e5e7eb",
                        }}
                      >
                        {bg.type === "image" ? (
                          <ImageBackground
                            source={{ uri: bg.value }}
                            style={{
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            imageStyle={{ borderRadius: 13 }}
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
                              backgroundColor: bg.value,
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
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
