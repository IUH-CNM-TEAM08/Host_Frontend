import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
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
import { Conversation } from "@/src/models/Conversation";
import EmojiPicker from "./EmojiPicker";
import StickerPicker from "./StickerPicker";
import { Shadows } from "@/src/styles/Shadow";
import { Message, MessageType } from "@/src/models/Message";
import { mapApiMessageToModel, unwrapData } from "@/src/models/mappers";
import { messageService as MessageService } from "@/src/api/services/message.service";
import { useUser } from "@/src/contexts/user/UserContext";
import { userService as UserService } from "@/src/api/services/user.service";
import SocketService from "@/src/api/socketCompat";
import ForwardMessageModal from "./ForwardMessageModal";

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
import { blockSettingService } from "@/src/api/services/communication.service";
import { reminderService } from "@/src/api/services/reminder.service";
import { conversationService as ConversationService } from "@/src/api/services/conversation.service";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TranslatedText from "./TranslatedText";
import { useGroupChat } from "@/src/hooks/useGroupChat";

// ── 6 preset nền đoạn chat ───────────────────────────────────────────────
type BgType = 'color' | 'gradient' | 'image';
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
    id: 'default',
    label: 'Mặc định',
    type: 'color',
    value: '#f9fafb',
    preview: '#f9fafb',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    type: 'color',
    value: '#ede9fe',
    preview: '#ede9fe',
  },
  {
    id: 'mint',
    label: 'Mint',
    type: 'color',
    value: '#d1fae5',
    preview: '#d1fae5',
  },
  {
    id: 'sky',
    label: 'Bầu trời',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=60',
    preview: '#bfdbfe',
  },
  {
    id: 'forest',
    label: 'Rừng xanh',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=60',
    preview: '#6ee7b7',
  },
  {
    id: 'galaxy',
    label: 'Vũnh trụ',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=800&q=60',
    preview: '#1e1b4b',
  },
];

const BG_STORAGE_KEY = (conversationId: string) => `chat_bg_${conversationId}`;
const CHAT_HISTORY_PAGE_SIZE = 30;
const TOP_LOAD_OLDER_THRESHOLD = 40;

const TRAILING_URL_PUNCTUATION = /[),.;!?]+$/;

type TextChunk = {
  value: string;
  href?: string;
};

function splitTextIntoChunks(text: string): TextChunk[] {
  const input = String(text ?? "");
  if (!input) return [{ value: "" }];

  const matcher = /((?:https?:\/\/|zala:\/\/|www\.)[^\s]+)/gi;
  const chunks: TextChunk[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(input)) !== null) {
    const matchStart = match.index;
    const rawMatch = match[0];

    if (matchStart > lastIndex) {
      chunks.push({ value: input.slice(lastIndex, matchStart) });
    }

    const trailing = rawMatch.match(TRAILING_URL_PUNCTUATION)?.[0] ?? "";
    const cleanUrl = trailing ? rawMatch.slice(0, -trailing.length) : rawMatch;

    if (cleanUrl) {
      const isCustomScheme = /^zala:\/\//i.test(cleanUrl);
      chunks.push({
        value: cleanUrl,
        href: isCustomScheme || /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`,
      });
    }

    if (trailing) {
      chunks.push({ value: trailing });
    }

    lastIndex = matchStart + rawMatch.length;
  }

  if (lastIndex < input.length) {
    chunks.push({ value: input.slice(lastIndex) });
  }

  return chunks.length > 0 ? chunks : [{ value: input }];
}

export interface ChatAreaProps {
  selectedChat: Conversation | null;
  onBackPress?: () => void;
  onInfoPress?: () => void;
  onConversationMetaChanged?: () => void;
  openScheduleRef?: React.MutableRefObject<(() => void) | null>;
  openNicknameRef?: React.MutableRefObject<(() => void) | null>;
  onAddPeoplePress?: () => void;
}

async function readBufferFromAsset(
  fileAsset: DocumentPicker.DocumentPickerAsset
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
  onAddPeoplePress,
}: ChatAreaProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const mobileBottomSafeOffset = Platform.OS === "web" ? 0 : Math.max(insets.bottom + 6, 12);
  const mobileMessageMaxWidth = Math.min(420, Math.floor(viewportWidth * 0.82));
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagePage, setMessagePage] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [showLoadOlderButton, setShowLoadOlderButton] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [messageUsers, setMessageUsers] = useState<{ [key: string]: any }>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageOptions, setShowMessageOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [deleteMode, setDeleteMode] = useState<"me" | "everyone" | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [messageToEdit, setMessageToEdit] = useState<Message | null>(null);
  const recalledContentCacheRef = useRef<Record<string, string>>({});
  const [editContent, setEditContent] = useState("");
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showAppointmentEditModal, setShowAppointmentEditModal] = useState(false);
  const [appointmentTargetMessage, setAppointmentTargetMessage] = useState<Message | null>(null);
  const [appointmentEditTitle, setAppointmentEditTitle] = useState("");
  const [appointmentEditDate, setAppointmentEditDate] = useState("");
  const [appointmentEditTime, setAppointmentEditTime] = useState("");
  const [forwardTargets, setForwardTargets] = useState<Message[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  
  const lastTypingEmitRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTypingUsers({});
  }, [selectedChat?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        for (const uid in next) {
          if (now - next[uid] > 6000) {
            delete next[uid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedChat?.id) return;
    if (newMessage.trim().length === 0) {
      socketService.sendTyping(selectedChat.id, false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
  }, [newMessage, selectedChat?.id, socketService]);
  const isDeletingReminderRef = useRef(false);
  const [otherParticipant, setOtherParticipant] = useState<{
    name: string;
    avatar: string;
    isOnline: boolean;
  } | null>(null);
  // Lưu userId của người kia để filter presence update
  const otherUserIdRef = useRef<string | null>(null);

  // ── Trạng thái tin nhắn: sent / delivered / read (chỉ cho 1-1) ─────────────
  // key = messageId, value = trạng thái cao nhất đạt được
  type MsgStatus = 'sent' | 'delivered' | 'read';
  const [msgStatusMap, setMsgStatusMap] = useState<Record<string, MsgStatus>>({});

  const upgradeMsgStatus = useCallback((messageId: string, newStatus: MsgStatus) => {
    setMsgStatusMap((prev) => {
      const cur = prev[messageId];
      // Chỉ upgrade: sent → delivered → read
      const rank: Record<MsgStatus, number> = { sent: 0, delivered: 1, read: 2 };
      if (cur && rank[cur] >= rank[newStatus]) return prev;
      return { ...prev, [messageId]: newStatus };
    });
  }, []);

  // Thêm vào danh sách state trong ChatArea
  const [fileUploading, setFileUploading] = useState(false);
  const [attachments, setAttachments] = useState<{ [key: string]: Attachment }>(
    {}
  );
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [peerMessageBlockedMe, setPeerMessageBlockedMe] = useState(false);
  const [peerCallBlockedMe, setPeerCallBlockedMe] = useState(false);
  // ── Wallpaper ──────────────────────────────────────────────────────────────
  const [chatBgId, setChatBgId] = useState<string>('default');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedMessageIds.includes(m.id)),
    [messages, selectedMessageIds]
  );
  const canMultiDeleteForMe = selectedMessages.length > 0;
  const canMultiForward = selectedMessages.length > 0;
  const canMultiRecall =
    selectedMessages.length > 0 &&
    selectedMessages.every((m) => m.senderId === user?.id && !m.isDeletedForEveryone);

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
    "Preparing to upload..."
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(
    Array.from({ length: 20 }, () => 6)
  );
  const voiceRecordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceWaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actorDisplayName = String((user as any)?.displayName ?? (user as any)?.name ?? "Người dùng").trim() || "Người dùng";

  // ── Group chat hook (tách logic group ra file riêng) ──────────────────────
  const groupChat = useGroupChat(selectedChat, user as any);

  /** Lấy tên hiển thị của sender (ưu tiên biệt danh group → tên thật) */
  const getSenderName = useCallback((senderId: string) => {
    const groupName = groupChat.isGroup ? groupChat.memberDisplayNames[senderId] : null;
    const userInMessages = messageUsers[senderId];
    const realName = userInMessages?.displayName || userInMessages?.name;

    // Nếu có biệt danh trong nhóm và không phải là fallback "Thành viên", dùng nó
    if (groupName && groupName !== 'Thành viên') {
      return groupName;
    }
    // Nếu không, ưu tiên dùng tên thật từ messageUsers
    if (realName) return realName;
    // Cuối cùng mới dùng cái gì còn lại (có thể là "Thành viên" hoặc "Người dùng")
    return groupName || 'Người dùng';
  }, [groupChat.isGroup, groupChat.memberDisplayNames, messageUsers]);
  const peerDisplayName = useMemo(() => {
    if (!selectedChat || !user?.id) return "đối phương";
    const peer = selectedChat.participantInfo?.find((p) => p.id !== user.id);
    const peerFromConversation = peer?.nickname || peer?.displayName || peer?.name;
    const peerFromFetched = otherParticipant?.name;
    return String(peerFromConversation ?? peerFromFetched ?? "đối phương").trim() || "đối phương";
  }, [selectedChat, user?.id, otherParticipant?.name]);

  // ── Attachment queue (Zalo-style staging) ─────────────────────────────────
  const [pendingAttachments, setPendingAttachments] = useState<PendingAsset[]>([]);

  // ── Real-time: nhận lời mời vào nhóm (như Zalo) ───────────────────────────
  useEffect(() => {
    const handleInviteReceived = (data: {
      inviteId: string; groupName: string; inviterName: string; conversationId: string;
    }) => {
      Alert.alert(
        '📩 Lời mời tham gia nhóm',
        `${data.inviterName} mời bạn vào nhóm "${data.groupName}"`,
        [
          {
            text: 'Từ chối', style: 'destructive',
            onPress: () => {
              import('@/src/api/services/conversation.service')
                .then(({ conversationService }) => conversationService.declineGroupInvite(data.inviteId))
                .catch(() => {});
            },
          },
          {
            text: 'Tham gia', style: 'default',
            onPress: () => {
              import('@/src/api/services/conversation.service')
                .then(({ conversationService }) => conversationService.acceptGroupInvite(data.inviteId))
                .then(res => {
                  if (res?.success) {
                    Alert.alert('✅ Đã tham gia!', `Bạn đã vào nhóm "${data.groupName}" thành công.`);
                  }
                })
                .catch(() => Alert.alert('Lỗi', 'Không thể tham gia nhóm.'));
            },
          },
        ],
        { cancelable: false }
      );
    };
    socketService.onGroupInviteReceived(handleInviteReceived);
    return () => { socketService.removeGroupInviteReceivedListener(handleInviteReceived); };
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
    [selectedChat?.id, user?.id]
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

      const oversized = assets.filter(a => (a.size || 0) > 5 * 1024 * 1024);
      if (oversized.length > 0) {
        if (Platform.OS === 'web') window.alert("bạn k được gửi file quá 5mb nha");
        else alert("bạn k được gửi file quá 5mb nha");
        return;
      }

      // Tạo previewUri cho ảnh trên web (blob URL)
      const enriched: PendingAsset[] = await Promise.all(
        assets.map(async (a) => {
          let previewUri = a.uri;
          if (Platform.OS === 'web' && a.mimeType?.startsWith('image/') && a.file) {
            try { previewUri = URL.createObjectURL(a.file as Blob); } catch {}
          }
          return { ...a, previewUri };
        })
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
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
          );
        });
        sendLocationMessage(position.coords.latitude, position.coords.longitude);
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
              { text: "Mở cài đặt", onPress: () => { Linking.openSettings().catch(() => {}); } },
            ]
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
          setError("Không xác định được vị trí. Kiểm tra mạng hoặc dịch vụ vị trí.");
        } else if (code === 3) {
          setError("Hết thời gian lấy vị trí. Vui lòng thử lại.");
        } else {
          setError("Không thể lấy vị trí trên web. Hãy kiểm tra quyền vị trí của trình duyệt.");
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
      const ok = typeof window === "undefined" ? true : window.confirm("Bạn có muốn cấp quyền và gửi vị trí hiện tại không?");
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
      ]
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

  const isSameDay = (d1: string | Date, d2: string | Date) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const getSeparatorDate = (dateStr: string | Date) => {
    const dt = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (isSameDay(dt, now)) return "Hôm nay";
    if (isSameDay(dt, yesterday)) return "Hôm qua";

    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = dt.getFullYear();
    return `${dd} tháng ${mm}, ${yy}`;
  };

  const parseAppointmentDateTimeInput = (dateInput: string, timeInput: string): string | null => {
    // Phân tích linh hoạt hơn (cho phép 1-2 chữ số, dùng dấu - hoặc / đều được, giờ có thể dùng dấu . thay cho :)
    const rawDate = String(dateInput).replace(/\s/g, "");
    const rawTime = String(timeInput).replace(/\s/g, "").replace(".", ":");
    const mDate = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(rawDate);
    const mTime = /^(\d{1,2}):(\d{1,2})$/.exec(rawTime);
    if (!mDate || !mTime) return null;
    let year = Number(mDate[3]);
    if (mDate[3].length === 2) {
      year += 2000;
    }
    const dt = new Date(
      year,
      Number(mDate[2]) - 1,
      Number(mDate[1]),
      Number(mTime[1]),
      Number(mTime[2]),
      0,
      0
    );
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const getAppointmentContext = (msg?: Message | null) => {
    const ctx = (msg?.storyContext as {
      kind?: string;
      title?: string;
      remindAt?: string;
      myReminderId?: string;
      peerReminderId?: string;
    } | null) ?? null;
    if (!ctx || ctx.kind !== "appointment") return null;
    return ctx;
  };

  const createAppointment = async (payload: { title: string; remindAtIso: string }) => {
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

      const targetName = selectedChat.isGroup ? selectedChat.name : peerDisplayName;
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
        setMessages((prev) => (prev.some((m) => m.id === createdMessage.id) ? prev : [...prev, createdMessage]));
        void refreshReminders(); // Refresh reminders list instead of pins
      }
      await sendSystemNotice(
        selectedChat.isGroup
          ? `${actorDisplayName} đã tạo lịch hẹn "${title}" trong nhóm vào ${formatAppointmentTime(payload.remindAtIso)}.`
          : `${actorDisplayName} đã tạo lịch hẹn "${title}" với ${peerDisplayName} vào ${formatAppointmentTime(payload.remindAtIso)}.`
      );
      onConversationMetaChanged?.();
      setError(null);
    } catch (err: any) {
      console.error("createAppointment:", err);
      setError("Không thể tạo lịch hẹn. Vui lòng thử lại.");
      throw err;
    }
  };

  const updateAppointmentFromMessage = async (msg: Message, title: string, remindAtIso: string) => {
    if (!selectedChat?.id || !user?.id) return;
    const oldCtx = getAppointmentContext(msg);
    const peerId = selectedChat.participantIds.find((id) => id !== user.id);
    try {
      if (oldCtx?.myReminderId) {
        await reminderService.update(oldCtx.myReminderId, { title, remindAt: remindAtIso });
      } else {
        await reminderService.create({
          conversationId: selectedChat.id,
          userId: user.id,
          title,
          remindAt: remindAtIso,
        });
      }
      if (oldCtx?.peerReminderId) {
        await reminderService.update(oldCtx.peerReminderId, { title, remindAt: remindAtIso });
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
      if (msg.pinned) {
        await MessageService.unpin(msg.id).catch(() => {});
      }
      await sendSystemNotice(
        `${actorDisplayName} đã cập nhật lịch hẹn với ${peerDisplayName} thành "${title}" vào ${formatAppointmentTime(remindAtIso)}.`
      );
      void refreshReminders();
      void refreshPinnedMessages(); // In case we unpinned the old one
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
        `${actorDisplayName} đã hủy lịch hẹn "${ctx.title || "không tên"}" với ${peerDisplayName}.`
      );
      void refreshReminders();
      void refreshPinnedMessages(); // In case we unpinned the old one
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
      const date = window.prompt("Nhập ngày (DD/MM/YYYY): (Ví dụ: 20/04/2026)");
      const time = window.prompt("Nhập giờ (HH:mm): (Ví dụ: 14:30)");
      if (!date || !time) return;
      
      const iso = parseAppointmentDateTimeInput(date, time);
      if (!iso) {
        setError("Sai định dạng ngày/giờ.");
        return;
      }
      if (new Date(iso).getTime() <= Date.now() + 15_000) {
        setError("Thời gian lịch hẹn cần lớn hơn hiện tại.");
        return;
      }
      void createAppointment({ title: title.trim(), remindAtIso: iso });
      return;
    }
    setAppointmentTargetMessage(null);
    setAppointmentEditTitle("");
    setAppointmentEditDate("");
    setAppointmentEditTime("");
    setShowAppointmentEditModal(true);
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
        })
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
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
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
    fileAsset: DocumentPicker.DocumentPickerAsset
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
          fetchMessages();

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
      const attachmentErrorHandler = (error: { message: string }) => {
        console.error("Attachment error:", error.message);
        setUploadStatusMessage(`Error: ${error.message}`);
        setError(`Không thể gửi tệp đính kèm: ${error.message}`);

        // Close modal after showing error
        setTimeout(() => {
          setShowUploadModal(false);
        }, 2000);

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
        selectedChat.id,
        fileData,
        replyingTo?.id // Truyền repliedTold nếu có
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
          : "Không thể gửi file. Vui lòng thử lại."
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
    assets: DocumentPicker.DocumentPickerAsset[]
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
      setUploadStatusMessage("Đang đọc nhiều file...");

      for (const a of slice) {
        if ((a.size || 0) > MAX_BYTES) {
          setUploadStatusMessage("File quá lớn (tối đa 10MB mỗi file).");
          setTimeout(() => setShowUploadModal(false), 2000);
          return;
        }
      }

      const files: Array<{ buffer: ArrayBuffer; fileName: string; contentType: string }> = [];
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
      const attachmentSentHandler = (data: { success: boolean; messageId: string }) => {
        if (data.success) {
          setUploadProgress(100);
          setUploadStatusMessage("Đã gửi!");
          void fetchMessages();
          if (replyingTo) setReplyingTo(null);
          setTimeout(() => setShowUploadModal(false), 600);
        }
        socketService.removeAttachmentSentListener(attachmentSentHandler);
      };
      const attachmentErrorHandler = (error: { message: string }) => {
        setUploadStatusMessage(`Lỗi: ${error.message}`);
        setError(`Không gửi được album: ${error.message}`);
        setTimeout(() => setShowUploadModal(false), 2000);
        socketService.removeAttachmentErrorListener(attachmentErrorHandler);
      };
      socketService.onAttachmentSent(attachmentSentHandler);
      socketService.onAttachmentError(attachmentErrorHandler);

      setUploadProgress(60);
      socketService.sendMediaAlbum(selectedChat.id, files, replyingTo?.id);
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
      const response = await AttachmentService.getAttachmentByMessageId(
        messageId
      );

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
        user?.id
      );
      console.log("response fetch messages: ", response);
      if (response.success) {
        const normalized = Array.isArray(response.messages)
          ? sanitizeMessages(response.messages)
          : [];
        setMessages(normalized);
        setMessagePage(response.page ?? 0);
        setHasOlderMessages(Boolean(response.hasMore));
        setShowLoadOlderButton(false);
        setIsNewer(response.isNewer);
        setError(null);

        // ── Real-time status: chỉ emit READ cho tin cuối người kia gửi ──
        // (Mở chat = đã xem rồi — không need spam delivered cho tất cả)
        if (!selectedChat?.isGroup) {
          const lastOtherMsg = [...normalized].reverse()
            .find((m) => m.senderId !== user?.id && !m.isDeletedForEveryone);
          if (lastOtherMsg?.id && selectedChat?.id) {
            socketService.sendRead(selectedChat.id, lastOtherMsg.id);
          }
          // Reset status map khi đổi conversation (tránh stale data)
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
        user?.id
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

  const handleMessagesContentSizeChange = useCallback((_w: number, h: number) => {
    const previousHeight = contentHeightRef.current;
    contentHeightRef.current = h;

    const preserveOffset = preserveScrollOffsetRef.current;
    if (preserveOffset != null && h > previousHeight) {
      const delta = h - previousHeight;
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: preserveOffset + delta, animated: false });
      });
      preserveScrollOffsetRef.current = null;
    }
  }, []);

  const handleMessagesScroll = useCallback((event: any) => {
    const yOffset = Number(event?.nativeEvent?.contentOffset?.y ?? 0);
    scrollOffsetRef.current = yOffset;

    if (!hasOlderMessages) {
      setShowLoadOlderButton(false);
      return;
    }

    const atTop = yOffset <= TOP_LOAD_OLDER_THRESHOLD;
    setShowLoadOlderButton((prev) => (prev === atTop ? prev : atTop));
  }, [hasOlderMessages]);

  // Join conversation when component mounts or ID changes
  useEffect(() => {
    if (selectedChat?.id) {
      contentHeightRef.current = 0;
      scrollOffsetRef.current = 0;
      preserveScrollOffsetRef.current = null;
      prevMessagesLengthRef.current = 0;
      setMessagePage(0);
      setHasOlderMessages(false);
      setShowLoadOlderButton(false);
      messageRefs.current = {};
      fetchMessages();
      socketService.joinConversation(selectedChat.id);
    }

    const handleReconnect = () => {
      if (selectedChat?.id) {
        socketService.joinConversation(selectedChat.id);
      }
    };
    socketService.onConnect(handleReconnect);

    return () => {
      socketService.removeConnectListener(handleReconnect);
      if (selectedChat?.id) {
        socketService.leaveConversation(selectedChat.id);
      }
    };
  }, [selectedChat?.id]); // Use ID instead of full object reference

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
    const handleNewMessage = (raw: Message | Record<string, unknown>) => {
      if (!raw || typeof raw !== "object") return;
      const message = mapApiMessageToModel(raw as any);
      if (!message?.id || !message.conversationId || message.conversationId !== selectedChat?.id) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (!selectedChat?.isGroup) {
        if (message.senderId === user?.id) {
          // Tin mình gửi (optimistic add từ socket broadcast) → khởi tạo 'sent'
          upgradeMsgStatus(message.id, 'sent');
          
          // XOÁ TIN NHÁP (PENDING/FAILED) DỰA THEO CONTENT ĐỂ TRÁNH TRÙNG LẶP DO OPTIMISTIC UI
          setMessages((prev) => {
            // Xem có tin nhắn ảo PENDING hoặc FAILED nào có cùng content không
            const pendingIdx = prev.findIndex(m => (m.status === 'PENDING' || m.status === 'FAILED') && m.content === message.content && m.senderId === user?.id);
            if (pendingIdx !== -1) {
              const newMsgs = [...prev];
              newMsgs.splice(pendingIdx, 1);
              return newMsgs;
            }
            return prev;
          });

        } else if (message.id && message.conversationId) {
          // Tin người kia gửi → đang trong chat = đã xem ngay
          socketService.sendRead(message.conversationId, message.id);
          // sendSeen cũng giữ lại để tương thích
          socketService.sendSeen(message.id, message.conversationId);
        }
      } else {
         // Nhóm: Xoá tin nháp nếu có
         if (message.senderId === user?.id) {
            setMessages((prev) => {
              const pendingIdx = prev.findIndex(m => (m.status === 'PENDING' || m.status === 'FAILED') && m.content === message.content && m.senderId === user?.id);
              if (pendingIdx !== -1) {
                const newMsgs = [...prev];
                newMsgs.splice(pendingIdx, 1);
                return newMsgs;
              }
              return prev;
            });
        };
      }
    };

    socketService.onNewMessage(handleNewMessage);

    // Refresh reminders if any new appointment message arrives
    const handleCheckReminderRefresh = (raw: any) => {
      const msg = mapApiMessageToModel(raw);
      if (msg?.conversationId === selectedChat?.id && (msg?.storyContext as any)?.kind === 'appointment') {
        void refreshReminders();
      }
    };
    socketService.onNewMessage(handleCheckReminderRefresh);

    const handleNotifRefresh = (payload: any) => {
      if (payload?.conversationId === selectedChat?.id || payload?.type === 'REMINDER') {
        // Debounce refresh to avoid race condition with local deletes
        setTimeout(() => {
          if (!isDeletingReminderRef.current) {
            void refreshReminders();
          }
        }, 1200);
      }
    };
    socketService.onNotificationNew(handleNotifRefresh);

    const handleNotifDeleted = (payload: any) => {
      // Remote deletion: always refresh to stay in sync
      if (!isDeletingReminderRef.current) {
        void refreshReminders();
      }
    };
    socketService.onNotificationDeleted(handleNotifDeleted);

    const handleChatTyping = (data: any) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.isTyping) {
          next[data.userId] = Date.now();
        } else {
          delete next[data.userId];
        }
        return next;
      });
    };
    socketService.onChatTyping(handleChatTyping);

    return () => {
      socketService.removeMessageListener(handleNewMessage);
      socketService.removeMessageListener(handleCheckReminderRefresh);
      socketService.removeNotificationNewListener(handleNotifRefresh);
      socketService.removeNotificationDeletedListener(handleNotifDeleted);
      socketService.removeChatTypingListener(handleChatTyping);
    };
  }, [selectedChat?.id]);

  // ── Lắng nghe chat:read → nâng status lên "read" ──────────────────────────
  useEffect(() => {
    if (selectedChat?.isGroup) return; // group: không xử lý ở đây (phức tạp hơn)
    const handleRead = (data: { conversationId: string; messageId: string; userId: string }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return; // chính mình đọc → skip
      upgradeMsgStatus(data.messageId, 'read');
    };
    socketService.onMessageRead(handleRead);
    return () => socketService.removeMessageReadListener(handleRead);
  }, [selectedChat?.id, selectedChat?.isGroup, user?.id, upgradeMsgStatus]);

  // ── Lắng nghe chat:delivered → nâng status lên "delivered" ────────────────
  useEffect(() => {
    if (selectedChat?.isGroup) return;
    const handleDelivered = (data: { conversationId: string; messageId: string; userId: string }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return;
      upgradeMsgStatus(data.messageId, 'delivered');
    };
    socketService.onMessageDelivered(handleDelivered);
    return () => socketService.removeMessageDeliveredListener(handleDelivered);
  }, [selectedChat?.id, selectedChat?.isGroup, user?.id, upgradeMsgStatus]);

  // ── Load ảnh nền từ AsyncStorage khi đổi conversation ─────────────────────
  useEffect(() => {
    if (!selectedChat?.id) return;
    AsyncStorage.getItem(BG_STORAGE_KEY(selectedChat.id)).then((saved) => {
      setChatBgId(saved ?? 'default');
    }).catch(() => setChatBgId('default'));
  }, [selectedChat?.id]);

  // ── Lắng nghe chat:background real-time từ người kia ──────────────────────
  useEffect(() => {
    if (!selectedChat?.id) return;
    const handleBgChange = (data: { conversationId: string; backgroundId: string; userId: string }) => {
      if (data.conversationId !== selectedChat?.id) return;
      if (data.userId === user?.id) return; // chính mình đổi → bỏ qua
      setChatBgId(data.backgroundId);
      // Lưu lại để persistent
      void AsyncStorage.setItem(BG_STORAGE_KEY(data.conversationId), data.backgroundId);
    };
    socketService.onBackgroundChanged(handleBgChange);
    return () => socketService.removeBackgroundListener(handleBgChange);
  }, [selectedChat?.id, user?.id]);

  /** Đổi ảnh nền: lưu local + broadcast + system message */
  const handleChangeBg = useCallback(async (bgId: string) => {
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
    const actorName = String((user as any)?.name ?? 'Người dùng').trim() || 'Người dùng';
    const isReset = bgId === 'default';
    const systemContent = isReset
      ? `${actorName} đã xóa ảnh nền đoạn chat`
      : `${actorName} đã đổi ảnh nền thành “${preset.label}”`;
    try {
      await MessageService.send({
        conversationId: selectedChat.id,
        senderId: user.id,
        content: systemContent,
        type: 'SYSTEM',
      });
    } catch {
      // System message không critical
    }
  }, [selectedChat?.id, user?.id, actorDisplayName]);

  // Fetch user info for each unique sender
  useEffect(() => {
    const senderIds = [...new Set(messages.map((msg) => msg?.senderId).filter(Boolean) as string[])];
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
        (id) => id !== user.id
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
                response.user.name
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

  // ─── Real-time presence update ───────────────────────────────────────
  // Giống bài tham khảo nhưng thêm real-time: lắng nghe `presence:update`
  // để cập nhật chấm xanh ngay khi người dùng kia thay đổi online/offline
  useEffect(() => {
    const handlePresenceUpdate = (data: { userId: string; status: 'online' | 'offline'; lastSeen: string }) => {
      if (data.userId !== otherUserIdRef.current) return;
      setOtherParticipant((prev) => {
        if (!prev) return prev;
        return { ...prev, isOnline: data.status === 'online' };
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


  // ── Send: gửi file trong queue TRƯỚC, rồi mới gửi text ──────────────────
  const handleSendMessage = async () => {
    // Guard: block setting (1-1)
    if (peerMessageBlockedMe) {
      setError("Bạn đang bị chặn nhắn tin trong cuộc trò chuyện này.");
      return;
    }
    // Guard: group allowMessaging (admin lock)
    if (!groupChat.canSendMessage) {
      setError(groupChat.lockedChatMessage || "Bạn không có quyền nhắn tin trong nhóm này.");
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
      const tempId = "temp-" + Date.now();
      const messageContent = newMessage.trim();
      const messageData: Message = {
        id: tempId,
        conversationId: selectedChat.id,
        senderId: user.id,
        content: messageContent,
        type: MessageType.TEXT,
        repliedToId: replyingTo?.id || "",
        readBy: [],
        sentAt: new Date().toISOString(),
        status: "PENDING", // Offline queue: chờ gửi
      };

      // 1. OPTIMISTIC UI: Hiển thị ngay lên màn hình
      setMessages((prev) => [...prev, messageData]);

      try {
        // 2. Gửi thật qua Socket
        socketService.sendMessage(messageData);
        
        // 3. Hẹn giờ Timeout: Nếu quá 10s không nhận được tin phản hồi từ Server (mất mạng) -> Báo FAILED
        setTimeout(() => {
          setMessages((prev) => {
            const isStillPending = prev.find(m => m.id === tempId && m.status === "PENDING");
            if (isStillPending) {
              return prev.map(m => m.id === tempId ? { ...m, status: "FAILED" } : m);
            }
            return prev;
          });
        }, 10000);
      } catch (err) {
        console.error("Error sending message:", err);
        setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, status: "FAILED" } : m));
      }
    }

    setNewMessage("");
    setReplyingTo(null);
    setSelectedMessage(null);
  };

  /** Hàm chuyên dùng gửi lại tin nhắn bị lỗi mạng */
  const handleRetryMessage = (failedMsg: Message) => {
    try {
      // Chuyển lại thành PENDING
      setMessages((prev) => prev.map(m => m.id === failedMsg.id ? { ...m, status: "PENDING" } : m));
      // Tính lại timestamp mới
      const newMsgData = { ...failedMsg, sentAt: new Date().toISOString(), status: "PENDING" };
      socketService.sendMessage(newMsgData);
      
      // Setup lại timeout rớt mạng
      setTimeout(() => {
        setMessages((prev) => {
          const isStillPending = prev.find(m => m.id === failedMsg.id && m.status === "PENDING");
          if (isStillPending) {
            return prev.map(m => m.id === failedMsg.id ? { ...m, status: "FAILED" } : m);
          }
          return prev;
        });
      }, 10000);
    } catch (err) {
      setMessages((prev) => prev.map(m => m.id === failedMsg.id ? { ...m, status: "FAILED" } : m));
    }
  };

  const handleReactionToggle = (messageId: string) => {
    setActiveReactionId(prev => prev === messageId ? null : messageId);
  };

  // ── Reactions state (local, được update qua socket) ──────────────────────────
  const [messageReactions, setMessageReactions] = useState<
    Record<string, Array<{ userId: string; emoji: string; reactedAt?: string }>>
  >({});

  /** Khởi tạo reactions từ messages đã tải */
  useEffect(() => {
    const init: Record<string, Array<{ userId: string; emoji: string }>> = {};
    messages.forEach(m => {
      if (m.reactions && m.reactions.length > 0) init[m.id] = m.reactions;
    });
    setMessageReactions(prev => ({ ...init, ...prev }));
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
        setMessageReactions(prev => ({ ...prev, [data.messageId]: data.reactions || [] }));
        return;
      }
      if (!data.userId) return;
      const incomingUserId = String(data.userId);
      setMessageReactions((prev) => {
        const current = prev[data.messageId] ?? [];
        if (!data.emoji) {
          // Unreact incremental: giảm đúng 1 lần react gần nhất của user này
          const idx = [...current].reverse().findIndex((x) => x.userId === incomingUserId);
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
            { userId: incomingUserId, emoji: String(data.emoji), reactedAt: new Date().toISOString() },
          ],
        };
      });
    };
    socketService.onReactionUpdated(handler);
    return () => socketService.removeReactionUpdatedListener(handler);
  }, []);

  /** Gửi react → cộng dồn (1 người có thể spam react nhiều lần) */
  const handleReact = (messageId: string, conversationId: string, emoji: string) => {
    if (!user?.id) return;
    const myUserId = user.id;
    // Không optimistic update để tránh double apply khi event realtime về.
    void MessageService.react(messageId, myUserId, emoji).catch(() => {
      socketService.sendReaction({ messageId, conversationId, emoji });
    });
    setActiveReactionId(null);
  };

  /** Thu hồi 1 lần react (giảm count đi 1) */
  const handleUnreact = (messageId: string, conversationId: string, emoji: string) => {
    if (!user?.id) return;
    const myUserId = user.id;
    // Không optimistic update để tránh double apply khi event realtime về.
    void MessageService.removeReaction(messageId, myUserId).catch(() => {
      socketService.sendUnreaction({ messageId, conversationId, emoji });
    });
    setActiveReactionId(null);
  };

  const handleForward = async (selectedConversations: string[]) => {
    const sourceMessages = forwardTargets.length > 0 ? forwardTargets : replyingTo ? [replyingTo] : [];
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
          console.error("Error forwarding message:", { messageId: src.id, conversationId, err });
        }
      }
    }

    if (successCount === 0) {
      setError("Không thể chuyển tiếp tin nhắn");
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
      setError(`Đã chuyển tiếp ${successCount} tin, ${failedCount} tin lỗi`);
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
        ids.map((id) => MessageService.deleteMessageForMe(id))
      );
      const successIds = results
        .map((r, idx) => ({ r, id: ids[idx] }))
        .filter(({ r }) => r.status === "fulfilled" && (r.value as any)?.success !== false)
        .map(({ id }) => id);
      if (successIds.length > 0) {
        setMessages((prev) => prev.filter((m) => !successIds.includes(m.id)));
      }
      setIsMultiSelectMode(false);
      setSelectedMessageIds([]);
    } catch (err) {
      console.error("Error deleting selected messages for me:", err);
      setError("Không thể xóa các tin nhắn đã chọn");
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
      setError("Không thể thu hồi một số tin nhắn đã chọn");
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
const [voteQuestion, setVoteQuestion] = useState('');
const [voteOptions, setVoteOptions] = useState(['', '']);
const [showVoteModal, setShowVoteModal] = useState(false);
const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);

// Change these functions:
const toggleModelVote = () => {
  setShowVoteModal(!showVoteModal);
};

const addVoteOption = () => {
  setVoteOptions([...voteOptions, '']);
};

const handleVoteOptionChange = (index: number, value: string) => {
  const newOptions = [...voteOptions];
  newOptions[index] = value;
  setVoteOptions(newOptions);
};

const handleCreateVote = () => {
  // Kiểm tra dữ liệu hợp lệ
  if (!voteQuestion.trim()) {
    // Có thể thêm thông báo lỗi
    return;
  }
  
  // Lọc ra các lựa chọn không trống
  const filteredOptions = voteOptions.filter(opt => opt.trim());
  
  if (filteredOptions.length < 2) {
    // Có thể thêm thông báo lỗi: cần ít nhất 2 lựa chọn
    return;
  }

  // Gửi yêu cầu tạo vote thông qua socket
  socketService.createVote({
    conversationId: selectedChat.id,
    question: voteQuestion,
    options: filteredOptions,
    multiple: allowMultipleVotes,
  });

  // System message thông báo tạo bình chọn
  void sendSystemNotice(`${actorDisplayName} đã tạo bình chọn: "${voteQuestion.trim()}"`);

  // Reset form và đóng modal
  setVoteQuestion('');
  setVoteOptions(['', '']);
  setShowVoteModal(false);
};

const openEditMessage = (msg: Message) => {
  if (msg.senderId !== user?.id || msg.isDeletedForEveryone || msg.editedAt) return;
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
    const response: any = await MessageService.edit(messageToEdit.id, next, user?.id);
    if (response?.success === false) {
      setError(response?.message || "Không thể chỉnh sửa tin nhắn");
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageToEdit.id
          ? { ...m, content: next, editedAt: new Date().toISOString() }
          : m
      )
    );
    setShowEditModal(false);
    setMessageToEdit(null);
  } catch (err) {
    console.error("Error editing message:", err);
    setError("Không thể chỉnh sửa tin nhắn");
  }
};

const recallMessageLocally = (messageId: string) => {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === messageId
        ? (() => {
            // Nếu đã là tin thu hồi và đã có bản gốc → giữ nguyên, chỉ đảm bảo cache đồng bộ.
            const existingMeta = (m.metadata as { recalledOriginalContent?: unknown } | null) ?? {};
            const existingOriginal =
              typeof existingMeta.recalledOriginalContent === "string"
                ? existingMeta.recalledOriginalContent
                : "";
            if (m.isDeletedForEveryone && existingOriginal) {
              recalledContentCacheRef.current[m.id] = existingOriginal;
              return m;
            }

            const originalContent = typeof m.content === "string" ? m.content : "";
            if (originalContent.trim()) {
              recalledContentCacheRef.current[m.id] = originalContent;
            }
            return {
              ...m,
              isDeletedForEveryone: true,
              content: "Tin nhắn đã được thu hồi",
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
        : m
    )
  );
};

const getRecalledOriginalContent = (msg: Message | null | undefined): string => {
  if (!msg?.isDeletedForEveryone) return "";
  const raw = (msg.metadata as { recalledOriginalContent?: unknown } | null | undefined)
    ?.recalledOriginalContent;
  const text = typeof raw === "string" ? raw : "";
  return text || recalledContentCacheRef.current[String(msg.id)] || "";
};

const prefillInputFromRecalledMessage = (msg: Message) => {
  const recalledText = getRecalledOriginalContent(msg);
  if (!recalledText.trim()) {
    setError("Không tìm thấy nội dung gốc để sao chép.");
    return;
  }
  setNewMessage(recalledText);
  setShowMessageOptions(false);
};

useEffect(() => {
  messages.forEach((msg) => {
    if (msg.isDeletedForEveryone) {
      const recalled = (msg.metadata as { recalledOriginalContent?: unknown } | null | undefined)
        ?.recalledOriginalContent;
      if (typeof recalled === "string" && recalled) {
        recalledContentCacheRef.current[msg.id] = recalled;
      }
      return;
    }
    if (msg.type === MessageType.TEXT && typeof msg.content === "string" && msg.content.trim()) {
      recalledContentCacheRef.current[msg.id] = msg.content;
    }
  });
}, [messages]);

useEffect(() => {
  const handleVoteCreated = (data: { conversationId: string; vote: any }) => {
    if (data.conversationId !== selectedChat?.id) return;
    const vote = mapApiMessageToModel(data.vote);
    setMessages((prev) => (prev.some((m) => m.id === vote.id) ? prev : [...prev, vote]));
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
        const statusRes: any = await blockSettingService.status<any>(peerId, user.id);
        const status = statusRes?.data ?? statusRes;
        setPeerMessageBlockedMe(Boolean(status?.messageBlocked));
        setPeerCallBlockedMe(Boolean(status?.callBlocked));
      } catch {
        setPeerMessageBlockedMe(false);
        setPeerCallBlockedMe(false);
      }
    };
    void loadBlockState();
  }, [selectedChat?.id, selectedChat?.isGroup, selectedChat?.participantIds, user?.id]);

  useEffect(() => {
    const onBlockUpdated = (payload: any) => {
      if (!selectedChat?.id || payload?.conversationId !== selectedChat.id) return;
      if (selectedChat.isGroup || !user?.id) return;
      const peerId = selectedChat.participantIds.find((id) => id !== user.id);
      if (!peerId) return;
      if (payload.blockerId === peerId && payload.blockedId === user.id) {
        setPeerMessageBlockedMe(Boolean(payload.messageBlocked));
        setPeerCallBlockedMe(Boolean(payload.callBlocked));
      }
    };
    socketService.onBlockSettingUpdated(onBlockUpdated);
    return () => socketService.removeBlockSettingUpdatedListener(onBlockUpdated);
  }, [selectedChat?.id, selectedChat?.isGroup, selectedChat?.participantIds, user?.id]);

  useEffect(() => {
    const onNotification = (payload: {
      type?: string;
      title?: string;
      conversationId?: string;
      triggeredAt?: string;
    }) => {
      if (String(payload?.type ?? "").toUpperCase() !== "REMINDER") return;
      if (selectedChat?.id && payload?.conversationId && payload.conversationId !== selectedChat.id) return;
      const title = payload?.title || "Lịch hẹn";
      Alert.alert("Nhắc lịch hẹn", `Đến giờ: ${title}`);
    };
    socketService.onNotificationNew(onNotification);
    return () => socketService.removeNotificationNewListener(onNotification as any);
  }, [selectedChat?.id, socketService]);

const confirmDeleteMessage = async () => {
  if (!messageToDelete || !deleteMode) return;

  try {
    if (deleteMode === "me") {
      const response = await MessageService.deleteMessageForMe(messageToDelete.id);
      if (response.success) {
        setMessages((prev) => prev.filter((m) => m.id !== messageToDelete.id));
        setShowDeleteConfirm(false);
        setMessageToDelete(null);
        setDeleteMode(null);
      } else {
        setError(response.statusMessage || "Không thể xóa tin nhắn");
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
      setError(response.statusMessage || "Không thể thu hồi tin nhắn");
    }
  } catch (err) {
    console.error("Error deleting message:", err);
    setError("Có lỗi xảy ra khi xóa tin nhắn");
  }
};

const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
const [showPinnedMessagesList, setShowPinnedMessagesList] = useState(false);
const [showPinsAndRemindersModal, setShowPinsAndRemindersModal] = useState(false);
const [pinsAndRemindersTab, setPinsAndRemindersTab] = useState<'reminders' | 'pins'>('pins');
const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
const messageRefs = useRef<{[key: string]: number}>({});
const [pinEditMode, setPinEditMode] = useState(false);
const [upcomingReminders, setUpcomingReminders] = useState<any[]>([]);

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

const handlePinMessage = async (message: Message) => {
  if (!selectedChat) return;
  try {
    await MessageService.pin(message.id);
    setShowMessageOptions(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, pinned: true, pinnedAt: new Date().toISOString() }
          : m
      )
    );
    void refreshPinnedMessages();
  } catch (error) {
    console.error("Error pinning message:", error);
    setError("Không thể ghim tin nhắn");
  }
};

const handleUnpinMessage = async (message: Message) => {
  if (!selectedChat) return;
  try {
    await MessageService.unpin(message.id);
    setShowMessageOptions(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, pinned: false, pinnedAt: null }
          : m
      )
    );
    void refreshPinnedMessages();
  } catch (error) {
    console.error("Error unpinning message:", error);
    setError("Không thể bỏ ghim tin nhắn");
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
  [pinnedMessages]
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
      setPinnedMessages(data.pinnedMessages.map((m: any) => mapApiMessageToModel(m)));
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
  return () => {
    socketService.removeMessageUnpinnedListener(handleUnpinned);
  };
}, [selectedChat?.id, refreshPinnedMessages]);

useEffect(() => {
  if (!selectedChat) {
    setPinnedMessages([]);
  } else if (selectedChat.pinMessages?.length) {
    setPinnedMessages(selectedChat.pinMessages.map((m) => mapApiMessageToModel(m as any)));
  }
  void refreshPinnedMessages();
}, [selectedChat?.id, refreshPinnedMessages]);

// Socket: listen for pins-reordered
useEffect(() => {
  const handleReordered = (data: { conversationId?: string; pinnedMessages?: any[] }) => {
    if (data.conversationId !== selectedChat?.id) return;
    if (Array.isArray(data.pinnedMessages)) {
      setPinnedMessages(data.pinnedMessages.map((m: any) => mapApiMessageToModel(m)));
    } else {
      void refreshPinnedMessages();
    }
  };
  socketService.onPinsReordered(handleReordered);
  return () => {
    socketService.removePinsReorderedListener(handleReordered);
  };
}, [selectedChat?.id, refreshPinnedMessages]);

// Load upcoming reminders for this conversation
const refreshReminders = useCallback(async () => {
  if (!selectedChat?.id || !user?.id || isDeletingReminderRef.current) {
    if (!selectedChat?.id || !user?.id) setUpcomingReminders([]);
    return;
  }
  try {
    const res: any = await reminderService.getByConversation(selectedChat.id, user.id);
    const data = res?.data ?? res;
    const arr = Array.isArray(data) ? data : [];
    const now = new Date();
    const upcoming = arr.filter((r: any) => !r.isTriggered && new Date(r.remindAt) > now);
    upcoming.sort((a: any, b: any) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
    setUpcomingReminders(upcoming);
  } catch {
    setUpcomingReminders([]);
  }
}, [selectedChat?.id, user?.id]);

useEffect(() => {
  void refreshReminders();
}, [refreshReminders]);

// Pin edit helpers
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
  } catch {
    setError("Không thể lưu thứ tự ghim");
  }
  setPinEditMode(false);
};

const handleUnpinFromPanel = async (msg: Message) => {
  if (!selectedChat) return;
  try {
    await MessageService.unpin(msg.id);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, pinned: false, pinnedAt: null } : m
      )
    );
    void refreshPinnedMessages();
  } catch {
    setError("Không thể bỏ ghim tin nhắn");
  }
};

const handleDeleteReminder = async (reminderId: string) => {
  const sid = String(reminderId);
  try {
    isDeletingReminderRef.current = true;
    // 1. Optimistic update: filter locally first
    setUpcomingReminders((prev) => prev.filter((r) => String(r._id ?? r.id) !== sid));
    
    // 2. Call API
    await reminderService.delete(sid);
    
    // 3. Small delay then refresh and unlock
    setTimeout(() => {
      isDeletingReminderRef.current = false;
      void refreshReminders();
    }, 1500);
  } catch (err) {
    console.error("handleDeleteReminder error:", err);
    isDeletingReminderRef.current = false;
    setError("Không thể xóa nhắc hẹn");
    void refreshReminders(); 
  }
};

useEffect(() => {
  const onRemoteDelete = (payload: any) => {
    const mid = String(
      payload?.messageId ?? payload?.id ?? payload?._id ?? ""
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
          : m
      )
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
  const messageIndex = messages.findIndex(msg => msg.id === messageId);
  if (messageIndex === -1) {
    setError("Không tìm thấy tin nhắn gốc trong đoạn hội thoại đã tải.");
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
  
  // Close modales/lists
  setShowPinnedMessagesList(false);
  setShowPinsAndRemindersModal(false);
  return true;
};

const openExternalLink = useCallback((href: string) => {
  if (!href) return;

  // Xử lý link tham gia nhóm nội bộ (cả zala://... và link web mới)
  try {
    const url = new URL(href.startsWith('zala://') ? href.replace('zala://', 'http://') : href);
    const isJoinLink = 
      href.startsWith('zala://join/') || 
      url.pathname === '/join' || 
      href.includes('/join?conversationId=');

    if (isJoinLink) {
      let conversationId = '';
      let code = '';

      if (href.startsWith('zala://join/')) {
        const parts = href.split('/');
        if (parts.length >= 5) {
          conversationId = parts[3];
          code = parts[4];
        }
      } else {
        const params = new URLSearchParams(url.search);
        conversationId = params.get('conversationId') || '';
        code = params.get('code') || '';
      }

      if (conversationId && code) {
        router.push({
          pathname: '/(main)/join',
          params: { conversationId, code }
        });
        return;
      }
    }
  } catch (e) {
    // Nếu parse lỗi thì thử fallback zala://join/ID/CODE định dạng cũ
    if (href.startsWith('zala://join/')) {
      const parts = href.split('/');
      if (parts.length >= 5) {
        router.push({
          pathname: '/(main)/join',
          params: { conversationId: parts[3], code: parts[4] }
        });
        return;
      }
    }
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }

  Linking.openURL(href).catch(() => {
    setError("Không thể mở liên kết.");
  });
}, [router]);

const renderTextWithLinks = useCallback(
  (text: string, isSender: boolean, messageId: string) => {
    return splitTextIntoChunks(text).map((chunk, index) => {
      if (!chunk.href) {
        return <Text key={`${messageId}-text-${index}`}>{chunk.value}</Text>;
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
  [openExternalLink]
);


  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Đang tải...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-red-500">Lỗi: {error}</Text>
      </View>
    );
  }

  if (!selectedChat) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">
          Chọn một cuộc trò chuyện để bắt đầu
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
        onAddPeoplePress={onAddPeoplePress}
        onNicknameUpdated={(payload) => {
          const { nickname, previousNickname, action } = payload;
          if (action === "set") {
            void sendSystemNotice(
              `${actorDisplayName} đã đặt biệt danh của mình thành "${nickname}" trong cuộc trò chuyện với ${peerDisplayName}.`
            );
          } else if (action === "clear") {
            void sendSystemNotice(
              previousNickname
                ? `${actorDisplayName} đã hủy biệt danh "${previousNickname}" trong cuộc trò chuyện với ${peerDisplayName}.`
                : `${actorDisplayName} đã hủy biệt danh trong cuộc trò chuyện với ${peerDisplayName}.`
            );
          } else {
            void sendSystemNotice(
              `${actorDisplayName} đã đổi biệt danh từ "${previousNickname || "(trống)"}" thành "${nickname || "(trống)"}" trong cuộc trò chuyện với ${peerDisplayName}.`
            );
          }
          onConversationMetaChanged?.();
        }}
      />
  
      {/* Messages Area with dynamic wallpaper */}
      {(() => {
        const activeBg = CHAT_BACKGROUNDS.find((b) => b.id === chatBgId) ?? CHAT_BACKGROUNDS[0];
        const bgProps = activeBg.type === 'image'
          ? { source: { uri: activeBg.value }, imageStyle: { opacity: 0.75 } as any }
          : { source: {} };
        return (
          <ImageBackground
            {...bgProps}
            style={[
              { flex: 1 },
              activeBg.type === 'color' ? { backgroundColor: activeBg.value } : undefined,
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
      : Platform.OS === "web" ? 0 : mobileBottomSafeOffset + 16,
  }}
>
  {hasOlderMessages && showLoadOlderButton && (
    <View className="items-center my-6">
      <TouchableOpacity
        onPress={loadOlderMessages}
        disabled={loadingOlderMessages}
        activeOpacity={0.8}
        className="px-6 py-3 rounded-xl bg-blue-50 border border-blue-100 flex-row items-center"
        style={Shadows.sm}
      >
        {loadingOlderMessages ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : (
          <Ionicons name="time-outline" size={18} color="#2563EB" />
        )}
        <Text className="ml-3 text-[14px] text-blue-700 font-semibold">
          {loadingOlderMessages
            ? "Đang tải tin nhắn cũ..."
            : "Bạn có muốn xem tin nhắn cũ hơn không?"}
        </Text>
      </TouchableOpacity>
    </View>
  )}

  {messages.length === 0 && <ChatNewer selectedChat={selectedChat} />}
  
  {/* Render messages */}
  {(() => {
    // ID của tin cuối dạng bubble mình gửi (bỏ qua SYSTEM/đã xóa)
    const lastSentMsgId = !selectedChat?.isGroup
      ? [...messages].reverse().find(
          (m) => m.senderId === user?.id
            && !m.isDeletedForEveryone
            && m.type !== MessageType.SYSTEM
        )?.id
      : undefined;
    const validMessages = messages.filter(Boolean);
    const renderedElements: React.ReactNode[] = [];

    validMessages.forEach((msg, index) => {
      const prevMsg = index > 0 ? validMessages[index - 1] : null;

      // Insert Date Separator if day changes
      if (!prevMsg || !isSameDay(msg.sentAt, prevMsg.sentAt)) {
        renderedElements.push(
          <View key={`date-sep-${msg.id || index}`} className="items-center my-8 flex-row justify-center">
            <View className="h-[1px] bg-gray-200 flex-1 mx-6" />
            <View className="bg-white px-5 py-2 rounded-full border border-gray-100 shadow-sm">
              <Text className="text-gray-400 text-[10px] font-extrabold uppercase tracking-[2px]">
                {getSeparatorDate(msg.sentAt)}
              </Text>
            </View>
            <View className="h-[1px] bg-gray-200 flex-1 mx-6" />
          </View>
        );
      }

      const nextMsg = index < validMessages.length - 1 ? validMessages[index + 1] : null;

      const isConsecutiveWithPrev =
        prevMsg &&
        prevMsg.senderId === msg.senderId &&
        prevMsg.type !== MessageType.SYSTEM &&
        msg.type !== MessageType.SYSTEM &&
        new Date(msg.sentAt).getTime() - new Date(prevMsg.sentAt).getTime() < 60000;

      const isConsecutiveWithNext =
        nextMsg &&
        nextMsg.senderId === msg.senderId &&
        nextMsg.type !== MessageType.SYSTEM &&
        msg.type !== MessageType.SYSTEM &&
        new Date(nextMsg.sentAt).getTime() - new Date(msg.sentAt).getTime() < 60000;
      // Store position for scrolling to messages
      const onLayout = (event: any) => {
        const layout = event.nativeEvent.layout;
        messageRefs.current[msg.id] = layout.y;
      };
      
      // Check if this message is currently highlighted
      const isHighlighted = msg.id === highlightedMessageId;
      const isReactionOpen = activeReactionId === msg.id;
      
      const repliedMessageId = msg.repliedToId || msg.repliedTold || msg.parentMessageId;
      const repliedToMessage =
        repliedMessageId
          ? messages.find((m) => m.id === repliedMessageId)
          : null;
      const locationMeta = (msg.metadata as { kind?: string; mapUrl?: string; latitude?: number; longitude?: number } | null);
      const contentText = String(msg.content ?? "");
      const mapUrlFromContent = contentText.match(/https?:\/\/maps\.google\.com\/\?q=[^\s]+/i)?.[0];
      const locationQuery = (locationMeta?.mapUrl ?? mapUrlFromContent ?? "").split("?q=")[1] ?? "";
      const isLocationMessage = locationMeta?.kind === "location" || Boolean(mapUrlFromContent);
      const appointmentContext = (msg.storyContext as { kind?: string; title?: string; remindAt?: string } | null);
      const isAppointmentMessage = appointmentContext?.kind === "appointment";
      const appointmentWhen = appointmentContext?.remindAt
        ? formatAppointmentTime(appointmentContext.remindAt)
        : null;
          
      // Special rendering for SYSTEM type messages (pinned messages)
      if (msg.type === MessageType.SYSTEM) {
        renderedElements.push(

        <View 
          key={msg.id} 
          className="flex-row justify-center mb-4"
          onLayout={onLayout}
        >
          <View className={`bg-gray-100 rounded-lg px-4 py-2 max-w-[80%] items-center ${
            isHighlighted ? "bg-yellow-100 border border-yellow-300" : ""
          }`}>
            <Text className="text-gray-500 text-xs mb-1">
              System Message
            </Text>
            <Text className="text-gray-800 text-center">
              {msg.content}
            </Text>
          </View>
        </View>
      );
      return;
    }

    // Regular message rendering
    renderedElements.push(
      <View 
        key={msg.id} 
        className={`flex-row items-end ${isConsecutiveWithNext ? "mb-1" : "mb-4"} ${msg.senderId === user?.id ? "justify-end" : "justify-start"}`}
        onLayout={onLayout}
        style={{
          position: 'relative',
          zIndex: isReactionOpen ? 999 : 1,
          elevation: isReactionOpen ? 30 : 0,
        }}
      >
        <View
          className={`relative mt-2 flex flex-row ${msg.senderId === user?.id ? "items-end" : "items-start"}`}
          style={{
            overflow: "visible",
            maxWidth: Platform.OS === "web" ? "70%" : mobileMessageMaxWidth,
          }}
        >
          {msg.senderId !== user?.id && (
            <Image 
              source={{ 
                uri: messageUsers[msg.senderId]?.avatarURL || 
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    messageUsers[msg.senderId]?.name || "User"
                  )}&background=0068FF&color=fff`
              }} 
              className={`w-8 h-8 rounded-full mr-2 mt-3 ${isConsecutiveWithPrev ? "opacity-0" : ""}`} 
              resizeMode="cover" 
            />
          )}
          
          <View
            className={`flex-col mt-2 ${msg.senderId === user?.id ? "items-end" : "items-start"}`}
            style={{ overflow: "visible", maxWidth: Platform.OS === "web" ? undefined : mobileMessageMaxWidth }}
          >
            {/* Replied message reference */}
            {repliedMessageId && (() => {
              const isMine = msg.senderId === user?.id;
              const rType = repliedToMessage?.type;
              const replyIcon =
                rType === MessageType.IMAGE ? 'image-outline' :
                rType === MessageType.MEDIA_ALBUM ? 'images-outline' :
                rType === MessageType.VIDEO ? 'videocam-outline' :
                rType === MessageType.AUDIO ? 'mic-outline' :
                rType === MessageType.FILE ? 'document-outline' : null;
              const replyLabel =
                rType === MessageType.IMAGE ? 'Hình ảnh' :
                rType === MessageType.VIDEO ? 'Video' :
                rType === MessageType.AUDIO ? 'Tin nhắn thoại' :
                rType === MessageType.FILE ? ((repliedToMessage?.metadata as any)?.fileName ?? 'File') :
                rType === MessageType.MEDIA_ALBUM ? 'Album ảnh/video' :
                repliedToMessage?.content || 'Tin nhắn đã bị xoá';

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    void scrollToMessage(repliedMessageId);
                  }}
                  style={{
                    backgroundColor: 'rgba(109,40,217,0.12)',
                    borderLeftWidth: 3,
                    borderLeftColor: '#6d28d9',
                    borderRadius: 8,
                    marginBottom: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    maxWidth: Platform.OS === "web" ? 260 : mobileMessageMaxWidth - 12,
                    minWidth: Platform.OS === "web" ? undefined : 170,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {/* Thumbnail ảnh */}
                  {(rType === MessageType.IMAGE || rType === MessageType.MEDIA_ALBUM) && (
                    <Image
                      source={{ uri:
                        (repliedToMessage?.metadata as any)?.cdnUrl ??
                        repliedToMessage?.mediaItems?.[0]?.cdnUrl ??
                        'https://placehold.co/36x36/0068FF/fff'
                      }}
                      style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#D1D5DB' }}
                      resizeMode="cover"
                    />
                  )}
                  {/* Icon type */}
                  {replyIcon && rType !== MessageType.IMAGE && rType !== MessageType.MEDIA_ALBUM && (
                    <View style={{
                      width: 32, height: 32, borderRadius: 6,
                      backgroundColor: 'rgba(109,40,217,0.16)',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Ionicons name={replyIcon as any} size={15}
                        color="#6d28d9"
                      />
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 11,
                        color: '#6d28d9',
                        fontWeight: '900',
                        marginBottom: 2
                      }}
                    >
                      {getSenderName(repliedToMessage?.senderId ?? '')}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {replyIcon && rType !== MessageType.IMAGE && rType !== MessageType.MEDIA_ALBUM && (
                        <Ionicons name={replyIcon as any} size={11}
                          color="#7c3aed"
                        />
                      )}
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          flex: 1,
                          color: '#1f2937',
                          fontWeight: '800'
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
              style={{ overflow: "visible", maxWidth: Platform.OS === "web" ? undefined : mobileMessageMaxWidth }}
            >
              {msg.isDeletedForEveryone ? (
                <TouchableOpacity
                  onLongPress={() => (isMultiSelectMode ? toggleSelectMessage(msg) : handleEnterMultiSelect(msg))}
                  onPress={() => (isMultiSelectMode ? toggleSelectMessage(msg) : openMessageOptions(msg))}
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
                    style={msg.senderId === user?.id ? { backgroundColor: isHighlighted ? "#7c3aed" : "#6d28d9" } : undefined}
                  >
                    {msg.senderId !== user?.id && (
                      <Text className="text-gray-500 text-xs mb-1">
                        {getSenderName(msg.senderId)}
                      </Text>
                    )}
                    <Text
                      className={`italic ${
                        msg.senderId === user?.id ? "text-white/90" : "text-gray-500"
                      }`}
                    >
                      Tin nhắn đã được thu hồi
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : msg.type === MessageType.VOTE ? (
                <TouchableOpacity
                  onLongPress={() => (isMultiSelectMode ? toggleSelectMessage(msg) : handleEnterMultiSelect(msg))}
                  onPress={() => (isMultiSelectMode ? toggleSelectMessage(msg) : openMessageOptions(msg))}
                  delayLongPress={200}
                  activeOpacity={0.7}
                >
                  <View
                    className={`rounded-2xl p-2 ${
                      msg.senderId === user?.id
                        ? ""
                        : isHighlighted ? "bg-yellow-50 border border-yellow-300" : "bg-gray-100"
                    } ${isMultiSelectMode && selectedMessageIds.includes(msg.id) ? "border-2 border-blue-300" : ""}`}
                    style={msg.senderId === user?.id ? { backgroundColor: isHighlighted ? "#7c3aed" : "#6d28d9" } : undefined}
                  >
                    {msg.senderId !== user?.id && (
                      <Text className="text-gray-500 text-xs mb-1">
                        {getSenderName(msg.senderId)}
                      </Text>
                    )}
                    
                    <TouchableWithoutFeedback 
                      onPress={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <View className="self-center w-full min-w-[300px] pointer-events-auto">
                        <VoteMessageContent 
                          messageId={msg.id}
                          voteData={msg.content}
                          userId={user?.id}
                          conversationId={selectedChat.id}
                        />
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onLongPress={() => (isMultiSelectMode ? toggleSelectMessage(msg) : handleEnterMultiSelect(msg))}
                  onPress={() => (isMultiSelectMode ? toggleSelectMessage(msg) : openMessageOptions(msg))}
                  delayLongPress={200}
                  activeOpacity={0.7}
                >
                  <View
                    className={`rounded-2xl p-2 ${
                      msg.senderId === user?.id
                        ? ""
                        : isHighlighted ? "bg-yellow-50 border border-yellow-300" : "bg-gray-100"
                    } ${isMultiSelectMode && selectedMessageIds.includes(msg.id) ? "border-2 border-blue-300" : ""}`}
                    style={{
                      overflow: 'visible',
                      ...(msg.senderId === user?.id ? { backgroundColor: isHighlighted ? "#7c3aed" : "#6d28d9" } : {}),
                    }}
                  >
                    {msg.senderId !== user?.id && (
                      <Text className="text-gray-500 text-xs mb-1">
                        {getSenderName(msg.senderId)}
                      </Text>
                    )}

                    {msg.type === MessageType.TEXT ? (
                      (isAppointmentMessage ? (
                        <View style={{ minWidth: 180, maxWidth: 260 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                            <Ionicons
                              name="calendar"
                              size={16}
                              color={msg.senderId === user?.id ? "#FFFFFF" : "#2563EB"}
                            />
                            <Text
                              style={{
                                marginLeft: 6,
                                fontWeight: "700",
                                color: msg.senderId === user?.id ? "#FFFFFF" : "#111827",
                              }}
                            >
                              Lich hen
                            </Text>
                          </View>
                          <Text className={msg.senderId === user?.id ? "text-white" : "text-gray-900"}>
                            {appointmentContext?.title || msg.content}
                          </Text>
                          {appointmentWhen && (
                            <Text
                              style={{
                                fontSize: 12,
                                marginTop: 4,
                                color: msg.senderId === user?.id ? "#DBEAFE" : "#2563EB",
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
                            const mapUrl = (locationMeta?.mapUrl || mapUrlFromContent) as string | undefined;
                            if (mapUrl) {
                              if (Platform.OS === "web" && typeof window !== "undefined") {
                                window.open(mapUrl, "_blank", "noopener,noreferrer");
                                return;
                              }
                              Linking.openURL(mapUrl).catch(() => {
                                setError("Không thể mở bản đồ.");
                              });
                            }
                          }}
                          activeOpacity={0.85}
                          style={{
                            minWidth: 160,
                            maxWidth: 240,
                            paddingVertical: 2,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                            <Ionicons
                              name="location"
                              size={16}
                              color={msg.senderId === user?.id ? "#FFFFFF" : "#2563EB"}
                            />
                            <Text
                              style={{
                                marginLeft: 6,
                                fontWeight: "700",
                                color: msg.senderId === user?.id ? "#FFFFFF" : "#111827",
                              }}
                            >
                              Vi tri hien tai
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: 12,
                              color: msg.senderId === user?.id ? "rgba(255,255,255,0.9)" : "#4B5563",
                            }}
                            numberOfLines={1}
                          >
                            {locationMeta?.latitude != null && locationMeta?.longitude != null
                              ? `${locationMeta.latitude.toFixed(5)},${locationMeta.longitude.toFixed(5)}`
                              : (locationQuery || "Vi tri duoc chia se")}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              marginTop: 4,
                              color: msg.senderId === user?.id ? "#DBEAFE" : "#2563EB",
                              fontWeight: "600",
                            }}
                          >
                            Mo ban do
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <Text className={msg.senderId === user?.id ? "text-white" : "text-gray-900"}>
                            {renderTextWithLinks(
                              String(msg.content ?? ""),
                              msg.senderId === user?.id,
                              msg.id
                            )}
                          </Text>
                          <TranslatedText
                            content={msg.content}
                            type={msg.type}
                            isSender={msg.senderId === user?.id}
                          />
                        </>
                      ))
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
                          (msg.metadata as { fileName?: string } | undefined)?.fileName ||
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
                        <Text className={msg.senderId === user?.id ? "text-white" : "text-gray-900"}>
                          {(() => {
                            const ctx = (msg.storyContext ?? {}) as any;
                            const isGroupCall = Boolean(ctx?.isGroupCall) || Boolean(selectedChat?.isGroup);
                            const actorName =
                              msg.senderId === user?.id ? "Bạn" : getSenderName(msg.senderId);
                            const d =
                              ctx?.durationText ||
                              (typeof ctx?.durationSeconds === "number"
                                ? `${ctx.durationSeconds}s`
                                : "");

                            if (!isGroupCall) {
                              if (msg.content === "start") return "📞 Cuộc gọi đang bắt đầu";
                              return d ? `📴 Cuộc gọi đã kết thúc • ${d}` : "📴 Cuộc gọi đã kết thúc";
                            }

                            if (msg.content === "start") return "📞 Cuộc gọi nhóm đang bắt đầu";
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
                      conversationId={selectedChat?.id ?? ''}
                      isVisible={activeReactionId === msg.id}
                      onToggle={() => handleReactionToggle(msg.id)}
                      isSender={msg.senderId === user?.id}
                      currentUserId={user?.id ?? ''}
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
              currentUserId={user?.id ?? ''}
              isSender={msg.senderId === user?.id}
              messageId={msg.id}
              conversationId={selectedChat?.id ?? ''}
              onReact={handleReact}
              onUnreact={handleUnreact}
            />

            {msg.status === "PENDING" && (
              <Text className="text-[10px] text-gray-400 mt-1 italic text-right">Đang gửi...</Text>
            )}
            
            {msg.status === "FAILED" && (
              <TouchableOpacity onPress={() => handleRetryMessage(msg)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
                <Ionicons name="alert-circle" size={14} color="#ef4444" />
                <Text className="text-[10px] text-red-500 font-medium">Lỗi kết nối. Thử lại</Text>
              </TouchableOpacity>
            )}

            {msg.editedAt && !msg.isDeletedForEveryone && (
              <Text className="text-[11px] text-gray-400 mt-1 italic">Đã sửa</Text>
            )}

            {/* Timestamp below message */}
            {!isConsecutiveWithNext && (
              <Text className="text-[10px] text-gray-400 mt-[2px] mb-[-4px]">
                {new Date(msg.sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            )}

            {/* ── Status icon: chỉ hiện ở tin cuối mình gửi, chat 1-1, và không đang xử lý ── */}
            {msg.senderId === user?.id && msg.id === lastSentMsgId && !selectedChat?.isGroup && msg.status !== "PENDING" && msg.status !== "FAILED" && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 2 }}>
                {(() => {
                  const status = msgStatusMap[msg.id] ?? 'sent';
                  if (status === 'read') {
                    // Đã xem: 2 tick tím
                    return (
                      <>
                        <Ionicons name="checkmark" size={12} color="#6d28d9" />
                        <Ionicons name="checkmark" size={12} color="#6d28d9" style={{ marginLeft: -6 }} />
                        <Text style={{ fontSize: 10, color: '#6d28d9', marginLeft: 1 }}>Đã xem</Text>
                      </>
                    );
                  }
                  if (status === 'delivered') {
                    // Đã nhận: 2 tick xám
                    return (
                      <>
                        <Ionicons name="checkmark" size={12} color="#9ca3af" />
                        <Ionicons name="checkmark" size={12} color="#9ca3af" style={{ marginLeft: -6 }} />
                        <Text style={{ fontSize: 10, color: '#9ca3af', marginLeft: 1 }}>Đã nhận</Text>
                      </>
                    );
                  }
                  // sent: 1 tick xám
                  return (
                    <>
                      <Ionicons name="checkmark" size={12} color="#9ca3af" />
                      <Text style={{ fontSize: 10, color: '#9ca3af', marginLeft: 1 }}>Đã gửi</Text>
                    </>
                  );
                })()}
              </View>
            )}
          </View>
          
            {msg.senderId === user?.id && Platform.OS === "web" && (
            <Image 
              source={{ 
                uri: messageUsers[msg.senderId]?.avatarURL || 
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    messageUsers[msg.senderId]?.name || "User"
                  )}&background=0068FF&color=fff`
              }} 
              className={`w-8 h-8 rounded-full ml-2 mt-3 ${isConsecutiveWithPrev ? "opacity-0" : ""}`} 
              resizeMode="cover" 
            />
          )}
        </View>
      </View>
      );
    });

    return renderedElements;
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
              <Text className="text-xl font-semibold">Tạo bình chọn</Text>
              <TouchableOpacity onPress={toggleModelVote}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Vote Question */}
            <View className="mb-5">
              <Text className="text-gray-500 mb-2">Chủ đề bình chọn</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 min-h-[45px] text-base"
                placeholder="Đặt câu hỏi bình chọn"
                value={voteQuestion}
                onChangeText={setVoteQuestion}
                multiline
                maxLength={200}
              />
              <Text className="text-right text-gray-500 mt-1">{voteQuestion.length}/200</Text>
            </View>
            
            {/* Vote Options */}
            <View className="mb-5">
              <Text className="text-gray-500 mb-2">Các lựa chọn</Text>
              {voteOptions.map((option, index) => (
                <TextInput
                  key={`option-${index}`}
                  className="border border-gray-300 rounded-lg p-3 mb-3 min-h-[45px] text-base"
                  placeholder={`Lựa chọn ${index + 1}`}
                  value={option}
                  onChangeText={(text) => handleVoteOptionChange(index, text)}
                />
              ))}
              
              {/* Add option button */}
              <TouchableOpacity 
                className="flex-row items-center" 
                onPress={addVoteOption}
              >
                <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
                <Text className="ml-2 text-blue-500">Thêm lựa chọn</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center mb-5">
              <Switch
                value={allowMultipleVotes}
                onValueChange={setAllowMultipleVotes}
                trackColor={{ false: "#d1d5db", true: "#bfdbfe" }}
                thumbColor={allowMultipleVotes ? "#3B82F6" : "#9ca3af"}
              />
              <Text className="ml-2 text-gray-700">Cho phép chọn nhiều lựa chọn</Text>
            </View>
            
            {/* Footer buttons */}
            <View className="flex-row justify-end mt-2">
              <TouchableOpacity 
                className="px-5 py-2 mr-2 rounded-lg bg-gray-100"
                onPress={toggleModelVote}
              >
                <Text className="font-medium text-gray-700">Hủy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="px-5 py-2 rounded-lg bg-blue-500"
                onPress={handleCreateVote}
              >
                <Text className="font-medium text-white">Tạo bình chọn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
  
      {/* Message Options Modal */}
      {showMessageOptions && selectedMessage && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center" style={{ zIndex: 20 }}>
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
                    {getSenderName(selectedMessage.senderId)}
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
                  {selectedMessage.isDeletedForEveryone
                    ? getRecalledOriginalContent(selectedMessage) || "Tin nhắn đã được thu hồi"
                    : selectedMessage.content}
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
                <Text className="ml-3 text-gray-800">Trả lời</Text>
              </TouchableOpacity>

              {selectedMessage.isDeletedForEveryone &&
                Boolean(getRecalledOriginalContent(selectedMessage)) && (
                <TouchableOpacity
                  className="flex-row items-center p-4 active:bg-gray-50"
                  onPress={() => prefillInputFromRecalledMessage(selectedMessage)}
                >
                  <View className="w-8 h-8 rounded-full bg-violet-50 items-center justify-center">
                    <Ionicons name="copy-outline" size={20} color="#7c3aed" />
                  </View>
                  <Text className="ml-3 text-gray-800">Sao chép lên ô nhập để gửi lại</Text>
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
                    <Ionicons name="create-outline" size={20} color="#D97706" />
                  </View>
                  <Text className="ml-3 text-gray-800">Chỉnh sửa</Text>
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
                    <Ionicons name="calendar-outline" size={20} color="#2563eb" />
                  </View>
                  <Text className="ml-3 text-gray-800">Đổi lịch hẹn</Text>
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
                      "Hủy lịch hẹn",
                      "Bạn chắc chắn muốn hủy lịch hẹn này?",
                      [
                        { text: "Không", style: "cancel" },
                        {
                          text: "Hủy lịch",
                          style: "destructive",
                          onPress: () => {
                            void cancelAppointmentFromMessage(selectedMessage);
                          },
                        },
                      ]
                    );
                  }}
                >
                  <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                    <Ionicons name="close-circle-outline" size={20} color="#dc2626" />
                  </View>
                  <Text className="ml-3 text-red-500">Hủy lịch hẹn</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                className="flex-row items-center p-4 active:bg-gray-50"
                onPress={() => handleForwardMessage(selectedMessage)}
              >
                <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                  <Ionicons name="arrow-redo" size={20} color="#3B82F6" />
                </View>
                <Text className="ml-3 text-gray-800">Chuyển tiếp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center p-4 active:bg-gray-50"
                onPress={() => handleEnterMultiSelect(selectedMessage)}
              >
                <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center">
                  <Ionicons name="checkmark-done-outline" size={20} color="#4F46E5" />
                </View>
                <Text className="ml-3 text-gray-800">Chọn nhiều</Text>
              </TouchableOpacity>
              
              {!selectedMessage.isDeletedForEveryone && !isSelectedMessagePinned && (
                <TouchableOpacity
                  className="flex-row items-center p-4 active:bg-gray-50"
                  onPress={() => void handlePinMessage(selectedMessage)}
                >
                  <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                    <Ionicons name="pin" size={20} color="#3B82F6" />
                  </View>
                  <Text className="ml-3 text-gray-800">Ghim tin nhắn</Text>
                </TouchableOpacity>
              )}
              {!selectedMessage.isDeletedForEveryone && isSelectedMessagePinned && (
                <TouchableOpacity
                  className="flex-row items-center p-4 active:bg-gray-50"
                  onPress={() => void handleUnpinMessage(selectedMessage)}
                >
                  <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                    <Ionicons name="pin-outline" size={20} color="#D97706" />
                  </View>
                  <Text className="ml-3 text-gray-800">Bỏ ghim</Text>
                </TouchableOpacity>
              )}
              
              {!selectedMessage.isDeletedForEveryone && (
              <TouchableOpacity
                className="flex-row items-center p-4 active:bg-gray-50"
                onPress={() => openDeleteForMe(selectedMessage)}
              >
                <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
                  <Ionicons name="eye-off-outline" size={20} color="#6b7280" />
                </View>
                <Text className="ml-3 text-gray-800">Xóa phía tôi</Text>
              </TouchableOpacity>
              )}

              {selectedMessage.senderId === user?.id && !selectedMessage.isDeletedForEveryone && (
                <TouchableOpacity
                  className="flex-row items-center p-4 active:bg-gray-50"
                  onPress={() => openRecallMessage(selectedMessage)}
                >
                  <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                    <Ionicons name="trash" size={20} color="#EF4444" />
                  </View>
                  <Text className="ml-3 text-red-500">Thu hồi (xóa cho mọi người)</Text>
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
                Chỉnh sửa tin nhắn
              </Text>
              <Text className="text-sm text-gray-500">
                Bạn chỉ có thể chỉnh sửa mỗi tin nhắn 1 lần.
              </Text>
            </View>
            <View className="p-4">
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 min-h-[90px]"
                multiline
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Nhập nội dung mới..."
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
                <Text className="text-gray-800 font-medium">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90"
                style={{ backgroundColor: "#2563eb" }}
                onPress={confirmEditMessage}
              >
                <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}>
                  Lưu
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showAppointmentEditModal && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center z-40">
          <View className="bg-white rounded-2xl w-[90%] max-w-md overflow-hidden shadow-lg">
            <View className="p-5 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-800 mb-1">
                {appointmentTargetMessage ? "Đổi lịch hẹn" : "Tạo lịch hẹn mới"}
              </Text>
              <Text className="text-sm text-gray-500">
                Cập nhật tiêu đề, ngày và giờ.
              </Text>
            </View>
            <View className="p-4">
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 mb-3"
                value={appointmentEditTitle}
                onChangeText={setAppointmentEditTitle}
                placeholder="Tiêu đề lịch hẹn"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900 mb-3"
                value={appointmentEditDate}
                onChangeText={setAppointmentEditDate}
                placeholder="Ngày (DD/MM/YYYY)"
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                className="border border-gray-300 rounded-xl p-3 text-base text-gray-900"
                value={appointmentEditTime}
                onChangeText={setAppointmentEditTime}
                placeholder="Giờ (HH:mm)"
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
                <Text className="text-gray-800 font-medium">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90 bg-blue-600"
                onPress={() => {
                  const nextTitle = appointmentEditTitle.trim();
                  if (!nextTitle) {
                    setError("Tiêu đề lịch hẹn không hợp lệ.");
                    return;
                  }
                  const nextIso = parseAppointmentDateTimeInput(appointmentEditDate, appointmentEditTime);
                  if (!nextIso) {
                    setError("Sai định dạng ngày/giờ.");
                    return;
                  }
                  if (new Date(nextIso).getTime() <= Date.now() + 15_000) {
                    setError("Thời gian lịch hẹn cần lớn hơn hiện tại.");
                    return;
                  }
                  setShowAppointmentEditModal(false);
                  if (appointmentTargetMessage) {
                    void updateAppointmentFromMessage(appointmentTargetMessage, nextTitle, nextIso);
                  } else {
                    void createAppointment({ title: nextTitle, remindAtIso: nextIso });
                  }
                  setAppointmentTargetMessage(null);
                }}
              >
                <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}>
                  Lưu thay đổi
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
                {deleteMode === "me" ? "Xóa phía tôi" : "Thu hồi tin nhắn"}
              </Text>
              <Text className="text-gray-600 text-center">
                {deleteMode === "me"
                  ? "Chỉ ẩn tin trên thiết bị của bạn. Người khác trong cuộc trò chuyện vẫn thấy tin này."
                  : "Thu hồi sẽ xóa tin cho mọi người trong cuộc trò chuyện. Hành động này không thể hoàn tác."}
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
                <Text className="text-gray-800 font-medium">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center active:opacity-90"
                style={{
                  backgroundColor: deleteMode === "me" ? "#1f2937" : "#ef4444",
                }}
                onPress={confirmDeleteMessage}
              >
                <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}>
                  {deleteMode === "me" ? "Xóa phía tôi" : "Thu hồi"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
  
      {/* Reply Preview bar */}
      {replyingTo && !peerMessageBlockedMe && (() => {
        const rType = replyingTo.type;
        const previewIcon =
          rType === MessageType.IMAGE ? 'image-outline' :
          rType === MessageType.MEDIA_ALBUM ? 'images-outline' :
          rType === MessageType.VIDEO ? 'videocam-outline' :
          rType === MessageType.AUDIO ? 'mic-outline' :
          rType === MessageType.FILE ? 'document-outline' : null;
        const previewLabel =
          rType === MessageType.IMAGE ? 'Hình ảnh' :
          rType === MessageType.VIDEO ? 'Video' :
          rType === MessageType.AUDIO ? 'Tin nhắn thoại' :
          rType === MessageType.FILE ? ((replyingTo.metadata as any)?.fileName ?? 'File') :
          rType === MessageType.MEDIA_ALBUM ? 'Album ảnh/video' :
          replyingTo.content || '';

        return (
          <View style={{
            backgroundColor: '#F8FAFF',
            paddingHorizontal: 12, paddingVertical: 10,
            flexDirection: 'row', alignItems: 'center',
            borderTopWidth: 1, borderTopColor: '#E5E7EB', gap: 10,
          }}>
            {/* Accent */}
            <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: '#0068FF', borderRadius: 2 }} />

            {/* Thumbnail nhỏ nếu là ảnh */}
            {(rType === MessageType.IMAGE || rType === MessageType.MEDIA_ALBUM) && (
              <Image
                source={{ uri:
                  (replyingTo.metadata as any)?.cdnUrl ??
                  replyingTo.mediaItems?.[0]?.cdnUrl ??
                  'https://placehold.co/40x40/0068FF/fff'
                }}
                style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: '#D1D5DB' }}
                resizeMode="cover"
              />
            )}

            {/* Icon box cho file/audio/video */}
            {previewIcon && rType !== MessageType.IMAGE && rType !== MessageType.MEDIA_ALBUM && (
              <View style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: '#EFF6FF',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <Ionicons name={previewIcon as any} size={20} color="#0068FF" />
              </View>
            )}

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <Ionicons name="return-up-back" size={13} color="#0068FF" />
                <Text style={{ color: '#0068FF', fontSize: 12, fontWeight: '700' }}>
                  {messageUsers[replyingTo.senderId]?.name || 'Người dùng'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {previewIcon && (
                  <Ionicons name={previewIcon as any} size={12} color="#9CA3AF" />
                )}
                <Text numberOfLines={1} style={{ fontSize: 13, color: '#6B7280', flex: 1 }}>
                  {previewLabel}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={14} color="#6B7280" />
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* ── Typing Indicator ── */}
      {Object.keys(typingUsers).length > 0 && !peerMessageBlockedMe && groupChat.canSendMessage && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#9CA3AF" style={{ marginRight: 6, transform: [{ scale: 0.7 }] }} />
          <Text style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>
            {Object.keys(typingUsers).length === 1 
              ? `${getSenderName(Object.keys(typingUsers)[0])} đang soạn tin nhắn...`
              : `${Object.keys(typingUsers).length} người đang soạn tin nhắn...`}
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
              Đã chọn {selectedMessages.length} tin nhắn
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsMultiSelectMode(false);
                setSelectedMessageIds([]);
              }}
            >
              <Text className="text-blue-600 font-medium">Hủy</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              className={`px-3 py-2 rounded-lg ${canMultiDeleteForMe ? "bg-gray-100" : "bg-gray-50"}`}
              disabled={!canMultiDeleteForMe}
              onPress={() => void handleDeleteForMeSelected()}
            >
              <Text className={`${canMultiDeleteForMe ? "text-gray-800" : "text-gray-400"}`}>
                Xóa phía tôi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-3 py-2 rounded-lg bg-blue-50`}
              disabled={!canMultiForward}
              onPress={handleForwardSelected}
            >
              <Text className={`${canMultiForward ? "text-blue-700" : "text-blue-300"}`}>
                Chuyển tiếp
              </Text>
            </TouchableOpacity>
            {canMultiRecall && (
              <TouchableOpacity
                className="px-3 py-2 rounded-lg bg-red-50"
                onPress={() => void handleRecallSelected()}
              >
                <Text className="text-red-600">Thu hồi</Text>
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
            Bạn không thể nhắn tin trong cuộc trò chuyện này vì đã bị chặn.
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
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons name="mic" size={16} color="#DC2626" />
              <Text style={{ marginLeft: 8, color: "#B91C1C", fontWeight: "600" }}>
                Đang ghi âm {voiceRecordingSeconds}s
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
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Dừng & gửi</Text>
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
              <View style={{
                position: 'absolute', top: 2, right: 2,
                backgroundColor: '#3b82f6',
                borderRadius: 8, minWidth: 16, height: 16,
                alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: 3,
              }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
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
                      Đính kèm
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
                      <Text className="ml-2 text-gray-800">Hình ảnh/Video</Text>
                    </TouchableOpacity>

                    {/* File */}
                    <TouchableOpacity
                      className="flex-row items-center mb-2"
                      onPress={() => {
                        toggleModelChecked();
                        handleSelectFile();
                      }}
                    >
                      <Ionicons name="file-tray-full-outline" size={24} color="#666" />
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
                        <ActivityIndicator size="small" color="#2563eb" style={{ width: 24, height: 24 }} />
                      ) : (
                        <Ionicons name="location-outline" size={24} color="#2563eb" />
                      )}
                      <Text className="ml-2 text-gray-800">
                        {isFetchingLocation ? "Đang lấy vị trí..." : "Chia sẻ vị trí"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-row items-center mb-2"
                      onPress={() => {
                        toggleModelChecked();
                        handleCreateAppointmentQuick();
                      }}
                    >
                      <Ionicons name="calendar-outline" size={24} color="#2563eb" />
                      <Text className="ml-2 text-gray-800">Tạo lịch hẹn</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-row items-center"
                      onPress={() => {
                        toggleModelChecked();
                        void handleVoiceAction();
                      }}
                    >
                      <Ionicons name={isRecordingVoice ? "stop-circle-outline" : "mic-outline"} size={24} color={isRecordingVoice ? "#dc2626" : "#666"} />
                      <Text className="ml-2 text-gray-800">
                        {isRecordingVoice ? `Dừng và gửi ghi âm (${voiceRecordingSeconds}s)` : "Ghi âm thoại"}
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
                      <Ionicons name="image-outline" size={24} color="#7c3aed" />
                      <Text className="ml-2" style={{ color: '#7c3aed', fontWeight: '600' }}>Đổi ảnh nền</Text>
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
            <TouchableOpacity className="p-2" onPress={toggleModelVote}>
              <Ionicons name="bar-chart-outline" size={24} color="#666" />
            </TouchableOpacity>
          </View>
  
          <View className="flex-1 bg-gray-100 rounded-full mx-2 px-4 py-2">
            <TextInput
              className="text-base text-gray-800"
              placeholder="Nhập tin nhắn..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              numberOfLines={1}
              placeholderTextColor="#666"
              style={{
                borderWidth: 0,
                height: Math.max(24, Math.min(inputHeight, 72)),
                paddingVertical: 0,
                lineHeight: 20,
                textAlignVertical: "center",
                ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
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
              (newMessage.trim() || pendingAttachments.length > 0) && !peerMessageBlockedMe ? "" : "bg-gray-200"
            }`}
            onPress={handleSendMessage}
            disabled={peerMessageBlockedMe || !groupChat.canSendMessage || (!newMessage.trim() && pendingAttachments.length === 0)}
            style={[
              ((newMessage.trim() || pendingAttachments.length > 0) && !peerMessageBlockedMe) && Shadows.md,
              {
                backgroundColor:
                  (newMessage.trim() || pendingAttachments.length > 0) && !peerMessageBlockedMe
                    ? "#6d28d9"
                    : undefined,
                transform: [{ scale: (newMessage.trim() || pendingAttachments.length > 0) && !peerMessageBlockedMe ? 1 : 0.95 }],
              },
            ]}
          >
            <Ionicons
              name="send"
              size={20}
              color={(newMessage.trim() || pendingAttachments.length > 0) && !peerMessageBlockedMe ? "#FFF" : "#999"}
            />
          </TouchableOpacity>
        </View>
      </View>
      )}
      
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
              downloadSingleItem({ url: fullScreenImage, fileName: `image_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
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

      {/* ─── Full-width Summary Bar ─── */}
      {(pinnedMessages.length > 0 || upcomingReminders.length > 0) && !showMessageOptions && !showPinsAndRemindersModal && (
        <View style={{
          position: 'absolute',
          top: Platform.OS === 'web' ? 70 : 90,
          left: 0, right: 0, zIndex: 30,
        }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowPinsAndRemindersModal(true)}
            style={{
              backgroundColor: '#fff',
              paddingHorizontal: 16, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
              height: 48,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="notifications-outline" size={18} color="#6B7280" />
              <View>
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 13 }}>
                  Ghim & Nhắc hẹn
                </Text>
                <Text style={{ color: '#6B7280', fontSize: 11 }}>
                  {pinnedMessages.length > 0 ? `${pinnedMessages.length} ghim` : ''}
                  {pinnedMessages.length > 0 && upcomingReminders.length > 0 ? ', ' : ''}
                  {upcomingReminders.length > 0 ? `${upcomingReminders.length} nhắc hẹn` : ''}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#0068FF', fontSize: 12, fontWeight: '500' }}>Xem tất cả</Text>
              <Ionicons name="chevron-forward" size={12} color="#0068FF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Pins & Reminders Overlay (Local View) ─── */}
      {showPinsAndRemindersModal && (
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 40,
        }}>
          {/* Custom Backdrop */}
          <TouchableWithoutFeedback onPress={() => setShowPinsAndRemindersModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} />
          </TouchableWithoutFeedback>

          <View style={{
            position: 'absolute',
            top: Platform.OS === 'web' ? 70 : 90,
            left: 0, right: 0,
            paddingHorizontal: 12, // Small margin from chat edges
          }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{ width: '100%' }}>
                
                {/* Section 1: Nhắc hẹn sắp tới (Separate Card) */}
                {upcomingReminders.length > 0 && (
                  <View style={{
                    backgroundColor: '#fff', 
                    borderRadius: 12, 
                    marginBottom: 10, // The gap between cards
                    overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6,
                    borderWidth: 1, borderColor: '#F1F5F9',
                  }}>
                    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>Nhắc hẹn sắp tới</Text>
                    </View>
                    <View>
                      {upcomingReminders.map((reminder) => {
                        const rid = reminder._id ?? reminder.id;
                        const dateObj = new Date(reminder.remindAt);
                        const monthNames = ['THG 1','THG 2','THG 3','THG 4','THG 5','THG 6','THG 7','THG 8','THG 9','THG 10','THG 11','THG 12'];
                        const monthLabel = monthNames[dateObj.getMonth()];
                        const dayNum = dateObj.getDate();
                        const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
                        
                        return (
                          <View key={rid} style={{
                            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
                            borderTopWidth: 1, borderTopColor: '#F8FAFC'
                          }}>
                            <View style={{
                              width: 44, height: 48, borderRadius: 10, backgroundColor: '#FFF5F5',
                              alignItems: 'center', justifyContent: 'center', marginRight: 14,
                              borderWidth: 0.5, borderColor: '#FEE2E2',
                            }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444' }}>{monthLabel}</Text>
                              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1F2937' }}>{dayNum}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>
                                {reminder.title || 'Lịch hẹn'}
                              </Text>
                              <Text style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>Hôm nay (lúc {timeStr})</Text>
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

                {/* Section 2: Danh sách ghim (Separate Card) */}
                <View style={{
                  backgroundColor: '#fff', 
                  borderRadius: 12, borderTopLeftRadius: upcomingReminders.length === 0 ? 0 : 12,
                  overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 6,
                  borderWidth: 1, borderColor: '#F1F5F9',
                }}>
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>Danh sách ghim</Text>
                  </View>
                  <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                    {pinnedMessages.length > 0 ? pinnedMessages.map((pinnedMsg, idx) => {
                      const sender = messageUsers[pinnedMsg.senderId];
                      const contentPreview = pinnedMsg.type === 'IMAGE' ? '[Hình ảnh]'
                        : pinnedMsg.type === 'VIDEO' ? '[Video]'
                        : pinnedMsg.type === 'FILE' ? '[File]'
                        : pinnedMsg.type === 'AUDIO' ? '[Ghi âm]'
                        : String(pinnedMsg.content || '[Tin nhắn]');
                      return (
                        <TouchableOpacity 
                          key={pinnedMsg.id} 
                          activeOpacity={0.7}
                          onPress={() => scrollToMessage(pinnedMsg.id)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
                            borderTopWidth: 1, borderTopColor: '#F8FAFC'
                          }}
                        >
                          <View style={{
                            width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF',
                            alignItems: 'center', justifyContent: 'center', marginRight: 14,
                          }}>
                            <Ionicons name="chatbubble-outline" size={18} color="#0068FF" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{contentPreview}</Text>
                            <Text style={{ fontSize: 13, color: '#64748B', marginTop: 3 }}>Tin nhắn của {sender?.name || "Unknown"}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {pinEditMode ? (
                              <>
                                <TouchableOpacity onPress={() => handleUnpinFromPanel(pinnedMsg)} style={{ padding: 4 }}>
                                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => movePinUp(idx)} disabled={idx === 0} style={{ padding: 4 }}>
                                  <Ionicons name="arrow-up-circle" size={22} color={idx === 0 ? '#F1F5F9' : '#0068FF'} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => movePinDown(idx)} disabled={idx === pinnedMessages.length - 1} style={{ padding: 4 }}>
                                  <Ionicons name="arrow-down-circle" size={22} color={idx === pinnedMessages.length - 1 ? '#F1F5F9' : '#0068FF'} />
                                </TouchableOpacity>
                              </>
                            ) : (
                              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    }) : (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 14 }}>Chưa có tin nhắn nào được ghim</Text>
                      </View>
                    )}
                  </ScrollView>

                  {/* Footer inside the Pin Card */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9',
                  }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (pinEditMode) savePinOrder();
                        else setPinEditMode(true);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                      <Ionicons name={pinEditMode ? "checkmark-circle" : "create-outline"} size={18} color={pinEditMode ? "#10B981" : "#475569"} />
                      <Text style={{ fontSize: 14, fontWeight: '700', color: pinEditMode ? "#10B981" : "#475569" }}>
                        {pinEditMode ? "Xong" : "Chỉnh sửa"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setShowPinsAndRemindersModal(false)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>Thu gọn</Text>
                      <Ionicons name="chevron-up" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      )}



      {/* ── Wallpaper / Background Picker Modal ── */}
      <Modal
        visible={showBgPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBgPicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowBgPicker(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={{
                backgroundColor: '#fff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                paddingBottom: 36,
                paddingHorizontal: 20,
              }}>
                {/* Handle bar */}
                <View style={{ width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>Chọn ảnh nền</Text>
                  <TouchableOpacity onPress={() => setShowBgPicker(false)}>
                    <Ionicons name="close-circle" size={26} color="#9ca3af" />
                  </TouchableOpacity>
                </View>

                {/* Grid 2 cột */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                  {CHAT_BACKGROUNDS.map((bg) => {
                    const isActive = bg.id === chatBgId;
                    return (
                      <TouchableOpacity
                        key={bg.id}
                        onPress={() => void handleChangeBg(bg.id)}
                        style={{
                          width: '47%',
                          height: 110,
                          borderRadius: 16,
                          overflow: 'hidden',
                          borderWidth: isActive ? 3 : 1.5,
                          borderColor: isActive ? '#6d28d9' : '#e5e7eb',
                        }}
                      >
                        {bg.type === 'image' ? (
                          <ImageBackground
                            source={{ uri: bg.value }}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                            imageStyle={{ borderRadius: 13 }}
                          >
                            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.35)', paddingVertical: 6, alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{bg.label}</Text>
                            </View>
                            {isActive && (
                              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#6d28d9', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              </View>
                            )}
                          </ImageBackground>
                        ) : (
                          <View style={{ flex: 1, backgroundColor: bg.value, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: isActive ? 4 : 0 }}>{bg.label}</Text>
                            {isActive && (
                              <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#6d28d9', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
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