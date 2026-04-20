import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Modal, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useActiveCall } from "@/src/contexts/ActiveCallContext";
import { Conversation } from "@/src/models/Conversation";
import SocketService from "@/src/api/socketCompat";
import { userService as UserService } from "@/src/api/services/user.service";
import { useUser } from "@/src/contexts/user/UserContext";
import { friendshipService } from "@/src/api/services/friendship.service";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChatHeaderProps {
  selectedChat: Conversation;
  onBackPress?: () => void;
  onInfoPress?: () => void;
  information?: any;
  callBlocked?: boolean;
  onCreateAppointment?: (payload: { title: string; remindAtIso: string }) => Promise<void>;
  onNicknameUpdated?: (payload: {
    nickname: string;
    previousNickname: string;
    action: "set" | "update" | "clear";
  }) => void;
  // Mobile Info panel triggers
  onOpenScheduleRef?: React.MutableRefObject<(() => void) | null>;
  onOpenNicknameRef?: React.MutableRefObject<(() => void) | null>;
  onAddPeoplePress?: () => void;
}

export default function ChatHeader({
  selectedChat,
  onBackPress,
  onInfoPress,
  information,
  callBlocked = false,
  onCreateAppointment,
  onNicknameUpdated,
  onOpenScheduleRef,
  onOpenNicknameRef,
  onAddPeoplePress,
}: ChatHeaderProps) {
  const { user } = useUser();
  const { startOutgoingCall } = useActiveCall();
  const insets = useSafeAreaInsets();
  // Trên mobile: thêm paddingTop = status bar để không bị che
  const headerTopPadding = Platform.OS !== 'web' ? insets.top : 0;

  // ── State cho conversation (group có thể update real-time) ──
  const [groups, setGroups] = useState<Conversation | null>(selectedChat);

  // ── State cho người kia (chat 1-1) ──
  const [otherUser, setOtherUser] = useState<{
    name: string;
    avatar: string;
    isOnline: boolean;
  } | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<
    "none" | "pending_sent" | "pending_received" | "accepted"
  >("none");
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const otherUserIdRef = useRef<string | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [localNicknameOverride, setLocalNicknameOverride] = useState<string | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [webDate, setWebDate] = useState<{ day: number; month: number; year: number }>({
    day: new Date().getDate(),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [webTime, setWebTime] = useState<{ hour: number; minute: number }>({
    hour: new Date().getHours(),
    minute: new Date().getMinutes(),
  });

  const socketService = useRef(SocketService.getInstance()).current;
  const currentNickname = String(
    selectedChat?.participantInfo?.find((p) => p.id === user?.id)?.nickname ?? ""
  ).trim();

  // Expose modal openers cho mobile Info panel (dùng ref thay vì kéo state lên)
  useEffect(() => {
    let scheduleOpen: (() => void) | null = null;
    let nicknameOpen: (() => void) | null = null;
    if (onOpenScheduleRef) {
      scheduleOpen = () => {
        setAppointmentDate("");
        setAppointmentTime("");
        setAppointmentTitle('');
        setShowAppointmentModal(true);
      };
      onOpenScheduleRef.current = scheduleOpen;
    }
    if (onOpenNicknameRef) {
      nicknameOpen = () => {
        setNicknameInput(currentNickname);
        setShowNicknameModal(true);
      };
      onOpenNicknameRef.current = nicknameOpen;
    }
    return () => {
      if (onOpenScheduleRef?.current === scheduleOpen) onOpenScheduleRef.current = null;
      if (onOpenNicknameRef?.current === nicknameOpen) onOpenNicknameRef.current = null;
    };
  }, [onOpenScheduleRef, onOpenNicknameRef, currentNickname]);

  const refreshFriendshipStatus = useCallback(async () => {
    if (selectedChat?.isGroup || !user?.id) {
      setFriendshipStatus("none");
      setFriendshipId(null);
      return;
    }
    const otherId = selectedChat.participantIds?.find((id) => id !== user.id);
    if (!otherId) return;
    try {
      const res: any = await friendshipService.getStatus<any>(otherId);
      const payload = res?.data ?? res;
      const status = String(payload?.status || "NONE").toUpperCase();
      const iAmRequester = Boolean(payload?.iAmRequester);
      const id =
        payload?.friendship?.id ??
        payload?.friendship?._id ??
        payload?.friendshipId ??
        null;
      setFriendshipId(id);
      if (status === "ACCEPTED") {
        setFriendshipStatus("accepted");
      } else if (status === "PENDING") {
        setFriendshipStatus(iAmRequester ? "pending_sent" : "pending_received");
      } else {
        setFriendshipStatus("none");
      }
    } catch {
      setFriendshipStatus("none");
      setFriendshipId(null);
    }
  }, [selectedChat, user?.id]);

  // ── Sync group state khi selectedChat đổi ──
  useEffect(() => {
    setGroups(selectedChat);
  }, [selectedChat]);

  // ── Lắng nghe event thêm thành viên (group) ──
  useEffect(() => {
    const handleAddParticipant = (updatedConversation: Conversation) => {
      const nextConversation = (updatedConversation as any).updatedConversation ?? updatedConversation;
      const nextId = String((nextConversation as any)?.id ?? (nextConversation as any)?._id ?? "");
      if (!selectedChat?.id || nextId !== String(selectedChat.id)) return;
      setGroups(nextConversation);
    };

    const handleConversationUpdated = (payload: any) => {
      const nextConversation = payload?.conversation ?? payload;
      const nextId = String(nextConversation?.id ?? nextConversation?._id ?? "");
      if (!selectedChat?.id || nextId !== String(selectedChat.id)) return;
      setGroups((prev) => ({
        ...(prev ?? {}),
        ...(nextConversation ?? {}),
      }) as any);
    };

    socketService.onParticipantsAddedServer(handleAddParticipant);
    socketService.onConversationUpdated(handleConversationUpdated);
    return () => {
      socketService.removeParticipantsAddedServer(handleAddParticipant);
      socketService.removeConversationUpdatedListener(handleConversationUpdated);
    };
  }, [selectedChat?.id, socketService]);

  // ── Fetch thông tin người kia khi chat 1-1 ──
  useEffect(() => {
    if (selectedChat?.isGroup || !user?.id) return;

    const otherId = selectedChat.participantIds?.find((id) => id !== user.id);
    if (!otherId) return;
    otherUserIdRef.current = otherId;

    UserService.getUserById(otherId).then((res) => {
      if (res.success && res.user) {
        setOtherUser({
          name: res.user.name || res.user.displayName || "Unknown",
          avatar:
            res.user.avatarURL ||
            res.user.avatarUrl ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(res.user.name || "U")}&background=6d28d9&color=fff`,
          isOnline: res.user.isOnline ?? false,
        });
      }
    });
  }, [selectedChat?.id, user?.id]);

  useEffect(() => {
    void refreshFriendshipStatus();
  }, [refreshFriendshipStatus]);

  // ── Real-time presence update cho người kia và nhóm ──
  const [groupOnlineMap, setGroupOnlineMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedChat?.isGroup && user?.id) {
      const ids = selectedChat.participantIds?.filter(id => id !== user.id) || [];
      const fetchAll = async () => {
        try {
          const promises = ids.slice(0, 20).map(id => UserService.getUserById(id));
          const results = await Promise.all([...promises]);
          const newMap: Record<string, boolean> = {};
          results.forEach((res, idx) => {
            if (res.success && res.user) {
              newMap[ids[idx]] = res.user.isOnline ?? false;
            }
          });
          setGroupOnlineMap(newMap);
        } catch (e) {}
      };
      fetchAll();
    }
  }, [selectedChat?.id, user?.id]);

  useEffect(() => {
    const handlePresence = (data: {
      userId: string;
      status: "online" | "offline";
      lastSeen: string;
    }) => {
      // Cho 1-1
      if (data.userId === otherUserIdRef.current) {
        setOtherUser((prev) => {
          if (!prev) return prev;
          return { ...prev, isOnline: data.status === "online" };
        });
      }
      // Cho Group
      if (selectedChat?.isGroup && selectedChat.participantIds?.includes(data.userId)) {
        setGroupOnlineMap((prev) => ({
          ...prev,
          [data.userId]: data.status === "online",
        }));
      }
    };
    socketService.onPresenceUpdate(handlePresence);
    return () => {
      socketService.removePresenceUpdateListener(handlePresence);
    };
  }, [selectedChat?.isGroup, selectedChat?.participantIds]);

  useEffect(() => {
    const onFriendChanged = () => {
      void refreshFriendshipStatus();
    };
    socketService.onFriendRequest(onFriendChanged);
    socketService.onFriendRequestAccepted(onFriendChanged);
    socketService.onDeleteFriendRequest(onFriendChanged);
    return () => {
      socketService.removeFriendRequestListener(onFriendChanged);
      socketService.removeFriendRequestAcceptedListener(onFriendChanged);
      socketService.removeFriendRequestActionListener(onFriendChanged);
    };
  }, [refreshFriendshipStatus, socketService]);

  useEffect(() => {
    const onNickRealtime = (payload: { conversationId: string; userId: string; newNickname?: string | null }) => {
      if (!selectedChat?.id || !user?.id) return;
      if (payload.conversationId !== selectedChat.id || payload.userId !== user.id) return;
      setLocalNicknameOverride(String(payload.newNickname ?? "").trim());
    };
    socketService.onConversationNicknameUpdated(onNickRealtime);
    return () => socketService.removeConversationNicknameUpdatedListener(onNickRealtime as any);
  }, [selectedChat?.id, socketService, user?.id]);

  const handleSendFriendRequest = async () => {
    const otherId = otherUserIdRef.current;
    if (!otherId || !user?.id || friendshipLoading) return;
    try {
      setFriendshipLoading(true);
      await friendshipService.sendRequest(otherId);
      await refreshFriendshipStatus();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Không thể gửi lời mời kết bạn");
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleRecallFriendRequest = async () => {
    if (!friendshipId || friendshipLoading) return;
    try {
      setFriendshipLoading(true);
      await friendshipService.recall(friendshipId);
      await refreshFriendshipStatus();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Không thể thu hồi lời mời");
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!friendshipId || friendshipLoading) return;
    try {
      setFriendshipLoading(true);
      await friendshipService.accept(friendshipId);
      await refreshFriendshipStatus();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Không thể chấp nhận lời mời");
    } finally {
      setFriendshipLoading(false);
    }
  };

  const handleRejectFriendRequest = async () => {
    if (!friendshipId || friendshipLoading) return;
    try {
      setFriendshipLoading(true);
      await friendshipService.reject(friendshipId);
      await refreshFriendshipStatus();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Không thể từ chối lời mời");
    } finally {
      setFriendshipLoading(false);
    }
  };

  // ── Tên & avatar hiện trên header ──
  const displayName = selectedChat?.isGroup
    ? (groups?.name || selectedChat?.name || "No name")
    : (otherUser?.name || selectedChat?.name || "No name");

  const displayAvatar = selectedChat?.isGroup
    ? (groups?.avatarUrl?.trim() || "https://placehold.co/400")
    : (otherUser?.avatar || groups?.avatarUrl?.trim() || "https://placehold.co/400");

  const effectiveNickname = (localNicknameOverride ?? currentNickname).trim();
  const displayNameWithNickname = !selectedChat?.isGroup && effectiveNickname ? effectiveNickname : displayName;

  useEffect(() => {
    setLocalNicknameOverride(null);
  }, [selectedChat?.id, currentNickname]);

  const submitNickname = async () => {
    if (!selectedChat?.id || !user?.id || selectedChat.isGroup || nicknameSaving) return;
    const cleaned = nicknameInput.trim();
    setNicknameSaving(true);
    try {
      socketService.updateConversationNickname({
        conversationId: selectedChat.id,
        userId: user.id,
        newNickname: cleaned || null,
      });
      setLocalNicknameOverride(cleaned || "");
      const action: "set" | "update" | "clear" =
        !currentNickname && cleaned ? "set" : currentNickname && !cleaned ? "clear" : "update";
      onNicknameUpdated?.({
        nickname: cleaned,
        previousNickname: currentNickname,
        action,
      });
      setShowNicknameModal(false);
    } finally {
      setNicknameSaving(false);
    }
  };

  const parseAppointmentDateTime = (dateInput: string, timeInput: string): string | null => {
    const d = dateInput.trim();
    const t = timeInput.trim();
    const mDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
    const mTime = /^(\d{2}):(\d{2})$/.exec(t);
    if (!mDate || !mTime) return null;
    const day = Number(mDate[1]);
    const month = Number(mDate[2]);
    const year = Number(mDate[3]);
    const hour = Number(mTime[1]);
    const minute = Number(mTime[2]);
    const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      dt.getFullYear() !== year ||
      dt.getMonth() !== month - 1 ||
      dt.getDate() !== day ||
      dt.getHours() !== hour ||
      dt.getMinutes() !== minute
    ) return null;
    return dt.toISOString();
  };

  const formatDateDisplay = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatTimeDisplay = (date: Date) => {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const getPickerBaseDate = () => {
    const fromInputs = parseAppointmentDateTime(appointmentDate, appointmentTime);
    if (fromInputs) return new Date(fromInputs);
    return new Date();
  };

  const handleDatePicked = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(false);
    if (!selected) return;
    setAppointmentDate(formatDateDisplay(selected));
  };

  const handleTimePicked = (_event: DateTimePickerEvent, selected?: Date) => {
    setShowTimePicker(false);
    if (!selected) return;
    setAppointmentTime(formatTimeDisplay(selected));
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!showAppointmentModal) return;
    const dt = new Date(webDate.year, webDate.month - 1, webDate.day, webTime.hour, webTime.minute, 0, 0);
    if (Number.isNaN(dt.getTime())) return;
    setAppointmentDate(formatDateDisplay(dt));
    setAppointmentTime(formatTimeDisplay(dt));
  }, [webDate, webTime, showAppointmentModal]);

  const appointmentTitleTrimmed = appointmentTitle.trim();
  const parsedAppointmentIso = useMemo(
    () => parseAppointmentDateTime(appointmentDate, appointmentTime),
    [appointmentDate, appointmentTime],
  );
  const isAppointmentInFuture = Boolean(
    parsedAppointmentIso &&
      new Date(parsedAppointmentIso).getTime() > Date.now() + 15_000,
  );
  const hasAppointmentInputs =
    appointmentDate.trim().length > 0 || appointmentTime.trim().length > 0;
  const showAppointmentTimeWarning =
    hasAppointmentInputs && !!parsedAppointmentIso && !isAppointmentInFuture;
  const canSubmitAppointment =
    Boolean(onCreateAppointment) &&
    !appointmentSaving &&
    appointmentTitleTrimmed.length > 0 &&
    appointmentDate.trim().length > 0 &&
    appointmentTime.trim().length > 0 &&
    isAppointmentInFuture;

  const submitAppointment = async () => {
    if (!onCreateAppointment || appointmentSaving) return;
    const title = appointmentTitleTrimmed;
    if (!title) {
      Alert.alert("Thiếu tiêu đề", "Nhập tiêu đề lịch hẹn.");
      return;
    }
    if (!appointmentDate.trim() || !appointmentTime.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn đầy đủ ngày và giờ.");
      return;
    }
    const remindAtIso = parsedAppointmentIso;
    if (!remindAtIso) {
      Alert.alert("Sai định dạng", "Ngày dạng DD/MM/YYYY và giờ dạng HH:mm.");
      return;
    }
    if (new Date(remindAtIso).getTime() <= Date.now() + 15_000) {
      Alert.alert("Thời gian chưa hợp lệ", "Vui lòng chọn thời điểm lớn hơn hiện tại.");
      return;
    }
    setAppointmentSaving(true);
    try {
      await onCreateAppointment({ title, remindAtIso });
      setShowAppointmentModal(false);
      setAppointmentTitle("");
      setAppointmentDate("");
      setAppointmentTime("");
    } finally {
      setAppointmentSaving(false);
    }
  };

  return (
    <View
      className="px-4 border-b border-gray-200 bg-white flex-row items-center justify-between"
      style={{ paddingTop: headerTopPadding, minHeight: 56 + headerTopPadding }}
    >
      <View className="flex-row items-center flex-1">
        {onBackPress && (
          <TouchableOpacity onPress={onBackPress} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="#666" />
          </TouchableOpacity>
        )}

        {/* Avatar với chấm xanh online cho chat 1-1 */}
        <View className="relative">
          <Image
            source={{ uri: displayAvatar }}
            className="w-12 h-12 rounded-full"
          />
          {!selectedChat?.isGroup && otherUser?.isOnline && (
            <View className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          )}
        </View>

        <View className="ml-3" style={{ maxWidth: "50%" }}>
          <Text
            className="font-semibold text-gray-900 text-base"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
              {displayNameWithNickname}
          </Text>
          {/* Trạng thái online/offline cho 1-1 | số thành viên cho group */}
          {selectedChat?.isGroup ? (
            <Text className="text-xs text-gray-500">
              {groups?.participantIds?.length ?? 0} thành viên
              {Object.values(groupOnlineMap).filter(Boolean).length > 0 && ` • ${Object.values(groupOnlineMap).filter(Boolean).length + 1} người đang hoạt động`}
            </Text>
          ) : (
            <Text
              className={`text-xs ${otherUser?.isOnline ? "text-green-500" : "text-gray-400"}`}
            >
              {otherUser?.isOnline ? "Đang hoạt động" : "Không hoạt động"}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row items-center">
        {/* ĐẶT LỊCH: hiện trên Web cho cả group & private */}
        {Platform.OS === 'web' && (
          <TouchableOpacity
            className="p-2 mr-1"
            onPress={() => {
              setAppointmentDate("");
              setAppointmentTime("");
              setAppointmentTitle("");
              setShowAppointmentModal(true);
            }}
          >
            <Ionicons name="calendar-outline" size={22} color="#666" />
          </TouchableOpacity>
        )}
        {/* BIỆT DANH: chỉ hiện cho private chat trên Web */}
        {Platform.OS === 'web' && !selectedChat?.isGroup && (
          <TouchableOpacity
            className="p-2 mr-1"
            onPress={() => {
              setNicknameInput(currentNickname);
              setShowNicknameModal(true);
            }}
          >
            <Ionicons name="create-outline" size={22} color="#666" />
          </TouchableOpacity>
        )}
        {!selectedChat?.isGroup && friendshipStatus !== "accepted" && (
          <View className="flex-row items-center mr-2">
            {friendshipStatus === "none" && (
              <TouchableOpacity
                className="px-2 py-1 rounded-full bg-indigo-500"
                onPress={() => void handleSendFriendRequest()}
                disabled={friendshipLoading}
              >
                <Text className="text-[10px] text-white font-semibold">
                  {friendshipLoading ? "Đang gửi..." : "Gửi lời mời"}
                </Text>
              </TouchableOpacity>
            )}

            {friendshipStatus === "pending_sent" && (
              <>
                <View className="px-2 py-1 rounded-full bg-indigo-100 mr-1">
                  <Text className="text-[10px] text-indigo-700 font-semibold">Đã gửi</Text>
                </View>
                <TouchableOpacity
                  className="px-2 py-1 rounded-full bg-red-100"
                  onPress={() => void handleRecallFriendRequest()}
                  disabled={friendshipLoading}
                >
                  <Text className="text-[10px] text-red-600 font-semibold">
                    {friendshipLoading ? "..." : "Thu hồi"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {friendshipStatus === "pending_received" && (
              <>
                <TouchableOpacity
                  className="px-2 py-1 rounded-full bg-blue-500 mr-1"
                  onPress={() => void handleAcceptFriendRequest()}
                  disabled={friendshipLoading}
                >
                  <Text className="text-[10px] text-white font-semibold">
                    {friendshipLoading ? "..." : "Đồng ý"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-2 py-1 rounded-full bg-gray-100"
                  onPress={() => void handleRejectFriendRequest()}
                  disabled={friendshipLoading}
                >
                  <Text className="text-[10px] text-gray-700 font-semibold">
                    {friendshipLoading ? "..." : "Từ chối"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {!callBlocked && (
          <>
            <TouchableOpacity
              className="p-2 mr-1"
              onPress={() => {
                const peerId = selectedChat.participantIds?.find((id) => id !== user?.id);
                if (!peerId) return;
                void startOutgoingCall(
                  selectedChat.id,
                  peerId,
                  "AUDIO",
                  selectedChat.isGroup
                    ? {
                        displayName: selectedChat.name || "Nhóm chat",
                        isGroupCall: true,
                      }
                    : undefined
                );
              }}
            >
              <Ionicons name="call-outline" size={22} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const peerId = selectedChat.participantIds?.find((id) => id !== user?.id);
                if (!peerId) return;
                void startOutgoingCall(
                  selectedChat.id,
                  peerId,
                  "VIDEO",
                  selectedChat.isGroup
                    ? {
                        displayName: selectedChat.name || "Nhóm chat",
                        isGroupCall: true,
                      }
                    : undefined
                );
              }}
              className="p-2 mr-1"
            >
              <Ionicons name="videocam-outline" size={22} color="#666" />
            </TouchableOpacity>
          </>
        )}
        {!selectedChat?.isGroup && friendshipStatus !== "accepted" && (
          <TouchableOpacity
            onPress={onAddPeoplePress}
            className="p-2 mr-1"
          >
            <Ionicons name="person-add-outline" size={22} color="#666" />
          </TouchableOpacity>
        )}
        <TouchableOpacity className="p-2" onPress={onInfoPress}>
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#666"
          />
        </TouchableOpacity>
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={showNicknameModal}
        onRequestClose={() => setShowNicknameModal(false)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-5">
          <View className="w-full max-w-md bg-white rounded-2xl overflow-hidden">
            <View className="px-5 py-4 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-900">Đặt biệt danh</Text>
              <Text className="text-sm text-gray-500 mt-1">Biệt danh sẽ hiển thị ở chat và danh sách cuộc trò chuyện.</Text>
            </View>
            <View className="px-5 py-4">
              <TextInput
                value={nicknameInput}
                onChangeText={setNicknameInput}
                placeholder="Nhập biệt danh (để trống để xóa)"
                placeholderTextColor="#9ca3af"
                className="h-12 px-3 rounded-xl border border-gray-300 text-gray-900"
              />
            </View>
            <View className="flex-row px-5 pb-4">
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl bg-gray-100 items-center justify-center mr-2"
                onPress={() => setShowNicknameModal(false)}
              >
                <Text className="text-gray-800 font-semibold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center"
                onPress={() => void submitNickname()}
                disabled={nicknameSaving}
                style={{ backgroundColor: "#6d28d9", opacity: nicknameSaving ? 0.6 : 1 }}
              >
                <Text className="text-white font-semibold">{nicknameSaving ? "Đang lưu..." : "Lưu"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        animationType="fade"
        visible={showAppointmentModal}
        onRequestClose={() => setShowAppointmentModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 }}>
            {/* Header gradient */}
            <View style={{
              paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20,
              backgroundColor: '#7C3AED',
              borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="calendar" size={22} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#fff' }}>Tạo lịch hẹn</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                    {selectedChat?.isGroup ? selectedChat?.name || 'Nhóm' : 'Cuộc hội thoại'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Form */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
              {/* Title */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Tiêu đề</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB', paddingHorizontal: 12, marginBottom: 16 }}>
                <Ionicons name="create-outline" size={18} color="#9CA3AF" />
                <TextInput
                  value={appointmentTitle}
                  onChangeText={setAppointmentTitle}
                  placeholder="Nhập tiêu đề lịch hẹn..."
                  placeholderTextColor="#9ca3af"
                  style={{ flex: 1, height: 48, marginLeft: 8, color: '#111827', fontSize: 15, outlineStyle: 'none' } as any}
                />
              </View>

              {/* Date & Time Row */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ngày</Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB',
                      paddingHorizontal: 12, height: 48,
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                    <Text style={{ flex: 1, marginLeft: 8, color: appointmentDate ? '#111827' : '#9CA3AF', fontSize: 15 }}>
                      {appointmentDate || 'DD/MM/YYYY'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Giờ</Text>
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB',
                      paddingHorizontal: 12, height: 48,
                    }}
                  >
                    <Ionicons name="time-outline" size={18} color="#7C3AED" />
                    <Text style={{ flex: 1, marginLeft: 8, color: appointmentTime ? '#111827' : '#9CA3AF', fontSize: 15 }}>
                      {appointmentTime || 'HH:mm'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Info hint */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}>
                <Ionicons name="information-circle" size={16} color="#7C3AED" />
                <Text style={{ marginLeft: 8, fontSize: 12, color: '#6D28D9', flex: 1 }}>
                  Tất cả thành viên sẽ nhận được nhắc nhở khi đến giờ hẹn.
                </Text>
              </View>
              {showAppointmentTimeWarning && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#FEF2F2',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginBottom: 8,
                  }}
                >
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={{ marginLeft: 8, fontSize: 12, color: '#B91C1C', flex: 1 }}>
                    Giờ hẹn phải lớn hơn thời gian hiện tại.
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8, gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowAppointmentModal(false)}
                style={{
                  flex: 1, height: 48, borderRadius: 14, backgroundColor: '#F3F4F6',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#4B5563', fontWeight: '600', fontSize: 15 }}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void submitAppointment()}
                disabled={!canSubmitAppointment}
                style={{
                  flex: 1, height: 48, borderRadius: 14,
                  backgroundColor: canSubmitAppointment ? '#7C3AED' : '#C4B5FD',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: appointmentSaving ? 0.6 : 1,
                  shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={appointmentSaving ? "hourglass-outline" : "checkmark-circle"} size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                    {appointmentSaving ? 'Đang tạo...' : 'Tạo lịch hẹn'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {showDatePicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={getPickerBaseDate()}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDatePicked}
        />
      )}
      {showTimePicker && Platform.OS !== "web" && (
        <DateTimePicker
          value={getPickerBaseDate()}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimePicked}
        />
      )}
      {Platform.OS === "web" && (
        <Modal
          transparent
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View className="flex-1 bg-black/30 items-center justify-center px-4">
            <View className="bg-white rounded-xl border border-gray-200 p-4 w-[360px] max-w-full">
              <Text className="font-semibold text-gray-800 mb-2">Chọn ngày</Text>
              <View className="flex-row">
                <View className="flex-1 border border-gray-200 rounded-lg mr-2">
                  <Picker selectedValue={webDate.day} onValueChange={(v) => setWebDate((p) => ({ ...p, day: Number(v) }))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <Picker.Item key={`d-${d}`} label={`${d}`} value={d} />)}
                  </Picker>
                </View>
                <View className="flex-1 border border-gray-200 rounded-lg mr-2">
                  <Picker selectedValue={webDate.month} onValueChange={(v) => setWebDate((p) => ({ ...p, month: Number(v) }))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <Picker.Item key={`m-${m}`} label={`${m}`} value={m} />)}
                  </Picker>
                </View>
                <View className="flex-1 border border-gray-200 rounded-lg">
                  <Picker selectedValue={webDate.year} onValueChange={(v) => setWebDate((p) => ({ ...p, year: Number(v) }))}>
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => <Picker.Item key={`y-${y}`} label={`${y}`} value={y} />)}
                  </Picker>
                </View>
              </View>
              <TouchableOpacity className="mt-3 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: "#6d28d9" }} onPress={() => setShowDatePicker(false)}>
                <Text className="text-white font-semibold">Xong</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS === "web" && (
        <Modal
          transparent
          animationType="fade"
          visible={showTimePicker}
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View className="flex-1 bg-black/30 items-center justify-center px-4">
            <View className="bg-white rounded-xl border border-gray-200 p-4 w-[320px] max-w-full">
              <Text className="font-semibold text-gray-800 mb-2">Chọn giờ</Text>
              <View className="flex-row">
                <View className="flex-1 border border-gray-200 rounded-lg mr-2">
                  <Picker selectedValue={webTime.hour} onValueChange={(v) => setWebTime((p) => ({ ...p, hour: Number(v) }))}>
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => <Picker.Item key={`h-${h}`} label={String(h).padStart(2, "0")} value={h} />)}
                  </Picker>
                </View>
                <View className="flex-1 border border-gray-200 rounded-lg">
                  <Picker selectedValue={webTime.minute} onValueChange={(v) => setWebTime((p) => ({ ...p, minute: Number(v) }))}>
                    {Array.from({ length: 60 }, (_, i) => i).map((m) => <Picker.Item key={`min-${m}`} label={String(m).padStart(2, "0")} value={m} />)}
                  </Picker>
                </View>
              </View>
              <TouchableOpacity className="mt-3 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: "#6d28d9" }} onPress={() => setShowTimePicker(false)}>
                <Text className="text-white font-semibold">Xong</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}


