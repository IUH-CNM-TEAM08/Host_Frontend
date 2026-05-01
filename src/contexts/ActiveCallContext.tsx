import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, Alert } from "react-native";
import { Audio } from "expo-av";
import SocketService from "@/src/api/socketCompat";
import { conversationService } from "@/src/api/services/conversation.service";
import { messageService } from "@/src/api/services/message.service";
import { userService } from "@/src/api/services/user.service";
import { callService } from "@/src/api/services/communication.service";
import {
  appendWebrtcEmbedParams,
  appendWebrtcQueryParams,
  buildWebrtcIncomingCallUrl,
} from "@/src/constants/ApiConstant";
import { mapApiMessageToModel } from "@/src/models/mappers";
import { Message, MessageType } from "@/src/models/Message";
import { useUser } from "@/src/contexts/user/UserContext";

export type CallType = "AUDIO" | "VIDEO";

export type ActiveCall =
  | null
  | {
      phase: "outgoing_ringing" | "incoming_ringing" | "connected";
      role: "caller" | "callee";
      conversationId: string;
      callSessionId: string;
      messageId: string;
      initiatorId: string;
      peerUserId: string;
      peerName: string;
      isGroupCall?: boolean;
      callType: CallType;
      webrtcUrl: string;
    };

type CallSessionPayload = {
  conversationId: string;
  callSessionId: string;
  kind: "answered" | "missed" | "ended" | "participant_declined" | "participant_left";
  byUserId?: string;
};

type Ctx = {
  activeCall: ActiveCall;
  startOutgoingCall: (
    conversationId: string,
    peerUserId: string,
    callType: CallType,
    options?: { displayName?: string; isGroupCall?: boolean }
  ) => Promise<void>;
  cancelOutgoing: () => Promise<void>;
  acceptIncoming: () => Promise<void>;
  rejectIncoming: () => Promise<void>;
  hangUpConnected: () => Promise<void>;
  joinOngoingCall: (
    conversationId: string,
    callSessionId: string,
    messageId: string,
    callType: CallType,
    peerName?: string
  ) => Promise<void>;
};

const ActiveCallContext = createContext<Ctx | null>(null);

function isRingingPhase(phase: string | undefined): boolean {
  return phase === "incoming_ringing" || phase === "outgoing_ringing";
}

async function resolvePeerName(userId: string): Promise<string> {
  try {
    const res = await userService.getUserById(userId);
    if (res.success && res.user?.name) return res.user.name;
  } catch {
    // ignore
  }
  return "Người gọi";
}

export function ActiveCallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const myId = user?.id ?? "";
  const [activeCall, setActiveCall] = useState<ActiveCall>(null);
  const activeRef = useRef<ActiveCall>(null);
  activeRef.current = activeCall;
  const soundRef = useRef<Audio.Sound | null>(null);
  const allRingtoneSoundsRef = useRef<Set<Audio.Sound>>(new Set());
  const ringtoneGenerationRef = useRef(0);
  const ringtoneStartingRef = useRef(false);

  const clear = useCallback(() => setActiveCall(null), []);

  const stopNativeRingtone = useCallback(async () => {
    ringtoneGenerationRef.current += 1;

    soundRef.current = null;
    const sounds = Array.from(allRingtoneSoundsRef.current);
    allRingtoneSoundsRef.current.clear();

    for (const s of sounds) {
      try {
        await s.setStatusAsync({
          shouldPlay: false,
          isLooping: false,
          positionMillis: 0,
        });
      } catch {}
      try {
        await s.stopAsync();
      } catch {}
      try {
        await s.unloadAsync();
      } catch {}
    }
  }, []);

  const startNativeRingtone = useCallback(async () => {
    if (soundRef.current || ringtoneStartingRef.current) return;

    const generationAtStart = ringtoneGenerationRef.current;
    ringtoneStartingRef.current = true;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      // Phát nhạc chuông điện thoại chuẩn (Standard Telephone Ring)
      const { sound } = await Audio.Sound.createAsync(
        require("@/src/ringtone.mp3"),
        { shouldPlay: true, isLooping: true }
      );
      allRingtoneSoundsRef.current.add(sound);

      // Nếu trạng thái call đã đổi trong lúc tạo sound thì dọn ngay để tránh chuông bị kẹt.
      if (
        generationAtStart !== ringtoneGenerationRef.current ||
        !isRingingPhase(activeRef.current?.phase)
      ) {
        await sound.stopAsync();
        await sound.unloadAsync();
        allRingtoneSoundsRef.current.delete(sound);
        return;
      }

      soundRef.current = sound;
    } catch (e) {
      console.log("Ringtone error:", e);
    } finally {
      ringtoneStartingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const shouldRing = isRingingPhase(activeCall?.phase);
    if (!shouldRing) {
      stopNativeRingtone();
      return;
    }
    startNativeRingtone();
    return () => {
      stopNativeRingtone();
    };
  }, [activeCall?.phase, startNativeRingtone, stopNativeRingtone]);



  const startOutgoingCall = useCallback(
    async (
      conversationId: string,
      peerUserId: string,
      callType: CallType,
      options?: { displayName?: string; isGroupCall?: boolean }
    ) => {
      if (!myId) return;

      // Nhất quán cho group call:
      // - Nếu caller không truyền `options.isGroupCall`, tự suy ra từ conversation type.
      // - Không ảnh hưởng call 1-1 vì PRIVATE => isGroupCall=false.
      let isGroupCall: boolean | undefined = options?.isGroupCall;
      if (typeof isGroupCall !== "boolean") {
        try {
          const detail: any = await conversationService.getConversationById(conversationId, myId);
          const conv = detail?.conversation ?? detail?.data ?? null;
          isGroupCall = Boolean(conv?.isGroup || String(conv?.type || "").toUpperCase() === "GROUP");
        } catch {
          isGroupCall = false;
        }
      }

      const res: any = await messageService.makeACall(conversationId, callType);
      if (!res?.success) return;
      const data = res.data as {
        session?: { _id?: string; id?: string };
        messageId?: string;
      };
      const callSessionId = String(data?.session?._id ?? data?.session?.id ?? "");
      const messageId = data?.messageId ?? "";
      if (!callSessionId || !messageId) {
        console.error("Missing callSessionId or messageId from backend!", data);
        return;
      }

      const peerName =
        options?.displayName?.trim() || (await resolvePeerName(peerUserId));
      const baseWebrtcUrl = buildWebrtcIncomingCallUrl(conversationId, myId, messageId);
      const isGroupCallFinal = Boolean(isGroupCall);
      const webrtcUrl = appendWebrtcEmbedParams(
        isGroupCallFinal
          ? appendWebrtcQueryParams(baseWebrtcUrl, {
              callSessionId,
              type: callType,
              group: "1",
            })
          : baseWebrtcUrl
      );
      setActiveCall({
        phase: "outgoing_ringing",
        role: "caller",
        conversationId,
        callSessionId,
        messageId,
        initiatorId: myId,
        peerUserId,
        peerName,
        isGroupCall: isGroupCallFinal,
        callType,
        webrtcUrl,
      });
    },
    [myId]
  );

  const cancelOutgoing = useCallback(async () => {
    const a = activeRef.current;
    if (!a || a.phase !== "outgoing_ringing" || a.role !== "caller") return;
    try {
      await messageService.endCall(a.callSessionId);
    } finally {
      clear();
    }
  }, [clear]);

  const acceptIncoming = useCallback(async () => {
    const a = activeRef.current;
    if (!a || a.phase !== "incoming_ringing" || a.role !== "callee") return;
    await stopNativeRingtone();
    try {
      await messageService.joinCall(a.callSessionId);
    } catch {
      clear();
      return;
    }
    setActiveCall({
      ...a,
      phase: "connected",
    });
  }, [clear, stopNativeRingtone]);

  const rejectIncoming = useCallback(async () => {
    const a = activeRef.current;
    if (!a || a.phase !== "incoming_ringing" || a.role !== "callee") return;
    try {
      await messageService.rejectCall(a.callSessionId);
    } finally {
      stopNativeRingtone();
      clear();
    }
  }, [clear, stopNativeRingtone]);

  const hangUpConnected = useCallback(async () => {
    const a = activeRef.current;
    if (!a || a.phase !== "connected") return;
    try {
      await messageService.endCall(a.callSessionId);
    } finally {
      stopNativeRingtone();
      clear();
    }
  }, [clear, stopNativeRingtone]);

  // 30 giây tự động tắt chuông nếu không ai nghe máy
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const shouldRing = isRingingPhase(activeCall?.phase);
    if (shouldRing) {
      timeoutId = setTimeout(() => {
        const a = activeRef.current;
        if (a && isRingingPhase(a.phase)) {
          console.log("[Call Timeout] Tự động ngắt cuộc gọi sau 30 giây");
          if (a.role === "caller") {
            // Người gọi: Tự động hủy cuộc gọi
            void cancelOutgoing();
          } else {
            // Người nhận: Tự động từ chối/nhỡ
            void rejectIncoming();
          }
        }
      }, 30000); // 30 seconds
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeCall?.phase, activeCall?.callSessionId, cancelOutgoing, rejectIncoming]);

  // Tin CALL qua chat — chỉ hiện incoming khi đối phương gọi
  useEffect(() => {
    const socket = SocketService.getInstance();
    const onMsg = (raw: Message | Record<string, unknown>) => {
      if (!myId) return;
      const message = mapApiMessageToModel(raw as any);
      if (message?.type !== MessageType.CALL || message.content !== "start") return;
      if (message.senderId === myId) return;

      const ctx = message.storyContext as
        | { callSessionId?: string; callType?: string }
        | undefined;
      const callSessionId = ctx?.callSessionId ?? "";
      if (!callSessionId) return;

      void (async () => {
        let peerName = await resolvePeerName(message.senderId);
        let isGroupCall = false;
        try {
          const detail: any = await conversationService.getConversationById(
            message.conversationId,
            myId
          );
          const conv = detail?.conversation ?? detail?.data ?? null;
          const groupFlag = Boolean(
            conv?.isGroup || String(conv?.type || "").toUpperCase() === "GROUP"
          );
          if (groupFlag) {
            isGroupCall = true;
            const groupName = String(conv?.name || "").trim();
            if (groupName) peerName = groupName;
          }
        } catch {
          // fallback to caller name
        }
        const callType: CallType =
          String(ctx?.callType).toUpperCase() === "AUDIO" ? "AUDIO" : "VIDEO";
        const baseWebrtcUrl = buildWebrtcIncomingCallUrl(
          message.conversationId,
          myId,
          message.id
        );
        const webrtcUrl = appendWebrtcEmbedParams(
          isGroupCall
            ? appendWebrtcQueryParams(baseWebrtcUrl, {
                callSessionId,
                type: callType,
                group: "1",
              })
            : baseWebrtcUrl
        );
        setActiveCall({
          phase: "incoming_ringing",
          role: "callee",
          conversationId: message.conversationId,
          callSessionId,
          messageId: message.id,
          initiatorId: message.senderId,
          peerUserId: message.senderId,
          peerName,
          isGroupCall,
          callType,
          webrtcUrl,
        });
      })();
    };
    socket.onNewMessage(onMsg);
    return () => socket.removeMessageListener(onMsg);
  }, [myId]);

  // Đồng bộ trạng thái gọi (đối phương bắt máy / từ chối / kết thúc)
  useEffect(() => {
    const socket = SocketService.getInstance();
    const onSession = (payload: CallSessionPayload) => {
      const a = activeRef.current;
      if (!a || payload.callSessionId !== a.callSessionId) return;

      if (payload.kind === "answered") {
        if (a.role === "caller" && a.phase === "outgoing_ringing") {
          void stopNativeRingtone();
          setActiveCall({ ...a, phase: "connected" });
        } else if (a.role === "callee" && payload.byUserId === myId && a.phase === "incoming_ringing") {
          // Bắt máy ở thiết bị khác -> tắt trên thiết bị này
          void stopNativeRingtone();
          clear();
        } else if (a.role === "callee" && payload.byUserId !== myId && a.isGroupCall) {
          // Người khác trong nhóm bắt máy -> KHÔNG làm gì cả
        }
        return;
      }

      if (payload.kind === "participant_declined" || payload.kind === "participant_left") {
        if (a.role === "callee" && payload.byUserId === myId && a.phase === "incoming_ringing") {
          // Từ chối ở thiết bị khác -> tắt trên thiết bị này
          void stopNativeRingtone();
          clear();
        } else if (a.isGroupCall && payload.byUserId && payload.byUserId !== myId) {
          // Hiển thị thông báo có người từ chối/rời nhóm
          void (async () => {
            try {
              const peerName = await resolvePeerName(payload.byUserId as string);
              const actionStr = payload.kind === "participant_declined" ? "từ chối" : "rời khỏi";
              Alert.alert("Cuộc gọi nhóm", `${peerName} đã ${actionStr} cuộc gọi.`);
            } catch (error) {
               console.log(error);
            }
          })();
        }
        return;
      }

      if (payload.kind === "missed") {
        // Cả caller và callee đều đóng khi có missed (do timeout/hủy)
        void stopNativeRingtone();
        clear();
        return;
      }

      if (payload.kind === "ended") {
        void stopNativeRingtone();
        clear();
      }
    };
    socket.onCallSession(onSession);
    return () => socket.removeCallSessionListener(onSession);
  }, [clear, stopNativeRingtone, myId]);

  // Polling fallback: khi socket event bị miss (vd: backend restart),
  // poll API mỗi 3s để kiểm tra session đã ONGOING chưa
  useEffect(() => {
    const a = activeRef.current;
    if (!a || a.phase !== "outgoing_ringing") return;
    const timer = setInterval(async () => {
      try {
        const resp = await callService.getStatus<{ data?: { status?: string } }>(a.callSessionId);
        const status = (resp as any)?.data?.status || (resp as any)?.status;
        if (status === "ONGOING") {
          console.log("[CallPoll] Session ONGOING → connecting");
          void stopNativeRingtone();
          setActiveCall({ ...a, phase: "connected" });
        }
      } catch {
        // ignore poll errors
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeCall?.phase, activeCall?.callSessionId, stopNativeRingtone]);

  const joinOngoingCall = useCallback(async (
    conversationId: string,
    callSessionId: string,
    messageId: string,
    callType: CallType,
    peerNameInput?: string
  ) => {
    if (!myId) return;
    try {
      // Gọi API join call để thông báo cho backend
      await messageService.joinCall(callSessionId);
      
      const peerName = peerNameInput?.trim() || await resolvePeerName(conversationId); // Fallback tạm
      const baseWebrtcUrl = buildWebrtcIncomingCallUrl(conversationId, myId, messageId);
      const webrtcUrl = appendWebrtcEmbedParams(
        appendWebrtcQueryParams(baseWebrtcUrl, {
          callSessionId,
          type: callType,
          group: "1",
        })
      );
      
      setActiveCall({
        phase: "connected",
        role: "callee",
        conversationId,
        callSessionId,
        messageId,
        initiatorId: "", // Không quan trọng khi đã connect
        peerUserId: conversationId,
        peerName,
        isGroupCall: true,
        callType,
        webrtcUrl,
      });
    } catch (e: any) {
      Alert.alert("Lỗi", e?.response?.data?.message || "Không thể tham gia cuộc gọi này (có thể đã kết thúc).");
    }
  }, [myId]);

  const value = useMemo<Ctx>(
    () => ({
      activeCall,
      startOutgoingCall,
      cancelOutgoing,
      acceptIncoming,
      rejectIncoming,
      hangUpConnected,
      joinOngoingCall,
    }),
    [
      activeCall,
      startOutgoingCall,
      cancelOutgoing,
      acceptIncoming,
      rejectIncoming,
      hangUpConnected,
      joinOngoingCall,
    ]
  );

  return (
    <ActiveCallContext.Provider value={value}>{children}</ActiveCallContext.Provider>
  );
}

export function useActiveCall(): Ctx {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) {
    throw new Error("useActiveCall must be used within ActiveCallProvider");
  }
  return ctx;
}

/** Phiên bản an toàn khi component có thể nằm ngoài provider (vd. test). */
export function useActiveCallOptional(): Ctx | null {
  return useContext(ActiveCallContext);
}
