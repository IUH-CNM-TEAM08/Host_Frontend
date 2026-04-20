import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import SocketService from "@/src/api/socketCompat";
import { conversationService } from "@/src/api/services/conversation.service";
import { messageService } from "@/src/api/services/message.service";
import { userService } from "@/src/api/services/user.service";
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
};

const ActiveCallContext = createContext<Ctx | null>(null);

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

  const clear = useCallback(() => setActiveCall(null), []);

  const stopNativeRingtone = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
  }, []);

  const startNativeRingtone = useCallback(async () => {
    try {
      if (soundRef.current) return;
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
      soundRef.current = sound;
    } catch (e) {
      console.log("Ringtone error:", e);
    }
  }, []);

  useEffect(() => {
    const shouldRing =
      activeCall?.phase === "incoming_ringing" ||
      activeCall?.phase === "outgoing_ringing";
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
  }, [clear]);

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
          setActiveCall({ ...a, phase: "connected" });
        }
        return;
      }
      if (payload.kind === "missed") {
        if (a.role === "caller") clear();
        return;
      }
      if (payload.kind === "ended") {
        clear();
      }
    };
    socket.onCallSession(onSession);
    return () => socket.removeCallSessionListener(onSession);
  }, [clear]);

  const value = useMemo<Ctx>(
    () => ({
      activeCall,
      startOutgoingCall,
      cancelOutgoing,
      acceptIncoming,
      rejectIncoming,
      hangUpConnected,
    }),
    [
      activeCall,
      startOutgoingCall,
      cancelOutgoing,
      acceptIncoming,
      rejectIncoming,
      hangUpConnected,
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
