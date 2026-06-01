import { Ionicons } from "@expo/vector-icons";
import React, {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Camera } from "expo-camera";
import { Audio } from "expo-av";
import { useTabBar } from "@/src/contexts/TabBarContext";
import { useActiveCallOptional } from "@/src/contexts/ActiveCallContext";
import { useUser } from "@/src/contexts/user/UserContext";
import { conversationService } from "@/src/api/services/conversation.service";
import { messageService } from "@/src/api/services/message.service";

const HIDE_HTML_CONTROLS_JS = `
(function(){
  try {
    if (document.getElementById('zala-hide-html-controls')) return;
    var s = document.createElement('style');
    s.id = 'zala-hide-html-controls';
    s.textContent = '.controls{display:none!important}';
    document.head.appendChild(s);
  } catch (e) {}
})();
true;
`;

function runBridge(jsBody: string) {
  return `(function(){ try { ${jsBody} } catch (e) {} })(); true;`;
}

type HostAction =
  | "hideControls"
  | "toggleMute"
  | "toggleCamera"
  | "startScreenShare"
  | "toggleEffects"
  | "addParticipant"
  | "hangUp";

/* ─── Web control bar ───────────────────────────────────────────── */
function HostControlBar({
  onAction,
  bottomInset,
  micMuted,
  cameraMuted,
}: {
  onAction: (a: HostAction) => void;
  bottomInset: number;
  micMuted: boolean;
  cameraMuted: boolean;
}) {
  return (
    <View style={[styles.hostBar, { paddingBottom: Math.max(12, bottomInset) }]}>
      <TouchableOpacity
        style={[styles.hostBtn, micMuted && styles.hostBtnMuted]}
        onPress={() => onAction("toggleMute")}
        accessibilityLabel={micMuted ? "Bật mic" : "Tắt mic"}
      >
        <Ionicons
          name={micMuted ? "mic-off" : "mic"}
          size={22}
          color={micMuted ? "rgba(255,255,255,0.55)" : "#fff"}
        />
        <Text style={[styles.hostLbl, micMuted && styles.hostLblMuted]}>
          {micMuted ? "Tắt mic" : "Mic"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.hostBtn, cameraMuted && styles.hostBtnMuted]}
        onPress={() => onAction("toggleCamera")}
        accessibilityLabel={cameraMuted ? "Bật cam" : "Tắt cam"}
      >
        <Ionicons
          name={cameraMuted ? "videocam-off" : "videocam"}
          size={22}
          color={cameraMuted ? "rgba(255,255,255,0.55)" : "#fff"}
        />
        <Text style={[styles.hostLbl, cameraMuted && styles.hostLblMuted]}>
          {cameraMuted ? "Cam off" : "Cam"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.hostBtn}
        onPress={() => onAction("toggleEffects")}
        accessibilityLabel="Hiệu ứng"
      >
        <Ionicons name="sparkles" size={22} color="#fff" />
        <Text style={styles.hostLbl}>Hiệu ứng</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.hostBtn}
        onPress={() => onAction("addParticipant")}
        accessibilityLabel="Thêm người"
      >
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.hostLbl}>Thêm</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.hostBtn, styles.hostBtnDanger]}
        onPress={() => onAction("hangUp")}
        accessibilityLabel="Kết thúc cuộc gọi"
      >
        <Ionicons
          name="call"
          size={22}
          color="#fff"
          style={{ transform: [{ rotate: "135deg" }] }}
        />
        <Text style={styles.hostLbl}>End</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Mobile control bar (redesigned) ─────────────────────────────────────────
/**
 * Layout:            [  Mic  ]  [ ● END ● ]  [  Cam  ]
 *
 * - End Call: button lớn (80px), nền đỏ nổi bật ở giữa
 * - Mic / Camera: button tròn 64px cân đối hai bên
 */
function MobileHostControlBar({
  onAction,
  bottomInset,
  micMuted,
  cameraMuted,
}: {
  onAction: (a: HostAction) => void;
  bottomInset: number;
  micMuted: boolean;
  cameraMuted: boolean;
}) {
  return (
    <View style={[styles.mobileBar, { paddingBottom: Math.max(24, bottomInset + 12) }]}>
      {/* Hàng chính */}
      <View style={styles.mobileRowMain}>
        {/* Mic */}
        <TouchableOpacity
          style={[styles.mobileBtnSm, micMuted && styles.mobileBtnSmActive]}
          onPress={() => onAction("toggleMute")}
          accessibilityLabel={micMuted ? "Bật mic" : "Tắt mic"}
        >
          <Ionicons
            name={micMuted ? "mic-off" : "mic"}
            size={22}
            color={micMuted ? "rgba(255,255,255,0.40)" : "#fff"}
          />
          <Text style={[styles.mobileLblSm, micMuted && styles.mobileLblSmMuted]}>
            {micMuted ? "Muted" : "Mic"}
          </Text>
        </TouchableOpacity>

        {/* End Call — nút chính, to và đỏ */}
        <TouchableOpacity
          style={styles.mobileBtnEnd}
          onPress={() => onAction("hangUp")}
          accessibilityLabel="Kết thúc cuộc gọi"
        >
          <Ionicons
            name="call"
            size={28}
            color="#fff"
            style={{ transform: [{ rotate: "135deg" }] }}
          />
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.mobileBtnSm, cameraMuted && styles.mobileBtnSmActive]}
          onPress={() => onAction("toggleCamera")}
          accessibilityLabel={cameraMuted ? "Bật cam" : "Tắt cam"}
        >
          <Ionicons
            name={cameraMuted ? "videocam-off" : "videocam"}
            size={22}
            color={cameraMuted ? "rgba(255,255,255,0.40)" : "#fff"}
          />
          <Text style={[styles.mobileLblSm, cameraMuted && styles.mobileLblSmMuted]}>
            {cameraMuted ? "Cam off" : "Cam"}
          </Text>
        </TouchableOpacity>

        {/* Effects */}
        <TouchableOpacity
          style={styles.mobileBtnSm}
          onPress={() => onAction("toggleEffects")}
          accessibilityLabel="Hiệu ứng"
        >
          <Ionicons name="sparkles" size={22} color="#fff" />
          <Text style={styles.mobileLblSm}>Hiệu ứng</Text>
        </TouchableOpacity>

        {/* Thêm người */}
        <TouchableOpacity
          style={styles.mobileBtnSm}
          onPress={() => onAction("addParticipant")}
          accessibilityLabel="Thêm người"
        >
          <Ionicons name="person-add" size={22} color="#fff" />
          <Text style={styles.mobileLblSm}>Thêm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── WebRTC frame ─────────────────────────────────────────────────────────────
function WebrtcFrame({
  url,
  onWebrtcCallEnded,
  onAddParticipant,
}: {
  url: string;
  onWebrtcCallEnded?: () => void;
  onAddParticipant?: () => void;
}) {
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const insets = useSafeAreaInsets();
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(Platform.OS === "web");

  useEffect(() => {
    setMicMuted(false);
    setCameraMuted(false);
  }, [url]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      try {
        await Camera.requestCameraPermissionsAsync();
        await Audio.requestPermissionsAsync();
      } catch (e) {
        console.warn("Failed to request OS permissions:", e);
      } finally {
        setHasPermissions(true);
      }
    })();
  }, []);

  const dispatchHost = useCallback((action: HostAction) => {
    if (Platform.OS === "web") {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "zala-host-command", action },
          "*"
        );
      } catch {
        // ignore
      }
      return;
    }
    if (action === "hideControls") {
      webRef.current?.injectJavaScript(HIDE_HTML_CONTROLS_JS);
      return;
    }
    const scripts: Record<string, string> = {
      toggleMute: "if(window.zalaHostBridge)window.zalaHostBridge.toggleMute();",
      toggleCamera:
        "if(window.zalaHostBridge)window.zalaHostBridge.toggleCamera();",
      startScreenShare:
        "if(window.zalaHostBridge)window.zalaHostBridge.startScreenShare();",
      hangUp: "if(window.zalaHostBridge)window.zalaHostBridge.hangUp();",
      toggleEffects: "if(window.self !== window.top) { window.postMessage({type: 'zala-host-command', action: 'toggleEffects'}, '*'); }",
    };
    const code = scripts[action];
    if (code) webRef.current?.injectJavaScript(runBridge(code));
  }, []);

  const handleAction = useCallback(
    (action: HostAction) => {
      if (action === "toggleMute") {
        dispatchHost("toggleMute");
        setMicMuted((m) => !m);
        return;
      }
      if (action === "toggleCamera") {
        dispatchHost("toggleCamera");
        setCameraMuted((c) => !c);
        return;
      }
      if (action === "addParticipant") {
        onAddParticipant?.();
        return;
      }
      dispatchHost(action);
    },
    [dispatchHost, onAddParticipant]
  );

  if (!hasPermissions) {
    return (
      <View style={[styles.webrtcWrap, { justifyContent: "center", alignItems: "center", backgroundColor: "#000" }]}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[styles.webrtcWrap, { flexDirection: "column" }]}>
        {createElement("iframe", {
          ref: iframeRef,
          src: url,
          style: {
            flex: 1,
            width: "100%",
            // Bỏ height:"100%" — để flex:1 tự fill, tránh iframe tràn đè HostControlBar
            border: "none",
            backgroundColor: "#000",
            display: "block",
            minHeight: 0,
          },
          allow: "camera; microphone; fullscreen; autoplay",
          onLoad: (e: any) => {
            // Inject CSS trực tiếp (same-origin) để ẩn controls native của WebRTC page
            try {
              const doc = (e?.target as HTMLIFrameElement)?.contentDocument;
              if (doc?.head) {
                const s = doc.createElement("style");
                s.id = "zala-hide-native-controls";
                s.textContent = [
                  ".controls", "[class*='controls']", "[id*='controls']",
                  ".call-controls", ".control-bar", ".toolbar", "#controls",
                  ".btn-group.call", "[data-testid*='control']",
                ].join(",") + " { display: none !important; }";
                doc.head.appendChild(s);
              }
            } catch {
              // cross-origin → dùng postMessage fallback
            }
            dispatchHost("hideControls");
          },
        })}
        {/* Thanh điều khiển React — luôn clickable vì nằm NGOÀI iframe */}
        <HostControlBar
          micMuted={micMuted}
          cameraMuted={cameraMuted}
          onAction={handleAction}
          bottomInset={insets.bottom}
        />
      </View>
    );
  }

  // Mobile: dùng layout tối ưu cho điện thoại
  return (
    <View style={styles.webrtcWrap}>
      <WebView
        ref={webRef}
        source={{ uri: url, headers: { "ngrok-skip-browser-warning": "69420", "Bypass-Tunnel-Reminder": "true" } }}
        style={styles.webrtc}
        containerStyle={styles.webrtc}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaCapturePermissionGrantType="grant"
        nestedScrollEnabled={false}
        scrollEnabled={false}
        hideKeyboardAccessoryView={true}
        keyboardDisplayRequiresUserAction={true}
        overScrollMode="never"
        onLoadEnd={() => dispatchHost("hideControls")}
        onMessage={(e) => {
          if (!onWebrtcCallEnded) return;
          try {
            const data = JSON.parse(e.nativeEvent.data) as { type?: string };
            if (data?.type === "zala-webrtc-call-ended") onWebrtcCallEnded();
          } catch {
            // ignore non-JSON messages
          }
        }}
      />
      <MobileHostControlBar
        micMuted={micMuted}
        cameraMuted={cameraMuted}
        onAction={handleAction}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
/**
 * Modal chọn thành viên để thêm vào cuộc gọi.
 */
function AddParticipantModal({
  visible,
  onClose,
  conversationId,
  callSessionId,
  callType,
  myId,
}: {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  callSessionId: string;
  callType: string;
  myId: string;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible || !conversationId) return;
    setLoading(true);
    (async () => {
      try {
        const res: any = await conversationService.getParticipants(conversationId);
        const data = res?.data ?? res;
        const list = Array.isArray(data?.participants)
          ? data.participants
          : Array.isArray(data) ? data : [];
        // Lọc bỏ chính mình
        setMembers(list.filter((m: any) => {
          const id = m?.userId || m?._id || m?.id || "";
          return String(id) !== String(myId);
        }));
      } catch {
        setMembers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, conversationId, myId]);

  const handleInvite = async (userId: string) => {
    if (inviting.has(userId) || invited.has(userId)) return;
    setInviting((s) => new Set(s).add(userId));
    try {
      // Gửi tin nhắn gọi đến người được chọn bằng cách gọi lại API
      await messageService.makeACall(conversationId, callType);
      setInvited((s) => new Set(s).add(userId));
      Alert.alert("Thành công", "Đã gửi lời mời tham gia cuộc gọi.");
    } catch {
      Alert.alert("Lỗi", "Không thể mời người này vào cuộc gọi.");
    } finally {
      setInviting((s) => {
        const n = new Set(s);
        n.delete(userId);
        return n;
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={addStyles.overlay}>
        <View style={addStyles.sheet}>
          <View style={addStyles.header}>
            <Text style={addStyles.title}>Thêm người vào cuộc gọi</Text>
            <TouchableOpacity onPress={onClose} style={addStyles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={addStyles.loadingWrap}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={addStyles.loadingText}>Đang tải thành viên...</Text>
            </View>
          ) : members.length === 0 ? (
            <View style={addStyles.loadingWrap}>
              <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={addStyles.loadingText}>Không có thành viên nào</Text>
            </View>
          ) : (
            <ScrollView style={addStyles.list}>
              {members.map((m: any) => {
                const uid = String(m?.userId || m?._id || m?.id || "");
                const name = m?.name || m?.displayName || uid;
                const avatar = m?.avatar || m?.avatarUrl || "";
                const isInvited = invited.has(uid);
                const isInviting = inviting.has(uid);
                return (
                  <View key={uid} style={addStyles.row}>
                    <Image
                      source={{
                        uri: avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff`,
                      }}
                      style={addStyles.avatar}
                    />
                    <Text style={addStyles.name} numberOfLines={1}>{name}</Text>
                    <TouchableOpacity
                      style={[
                        addStyles.inviteBtn,
                        isInvited && addStyles.invitedBtn,
                      ]}
                      onPress={() => handleInvite(uid)}
                      disabled={isInvited || isInviting}
                    >
                      {isInviting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={addStyles.inviteBtnText}>
                          {isInvited ? "Đã mời" : "Mời"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#141c30",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "60%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1a2438",
  },
  name: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  inviteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#6366f1",
    minWidth: 70,
    alignItems: "center",
  },
  invitedBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  inviteBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});

/**
 * Full-screen overlay: đang gọi / cuộc gọi đến / đang trong cuộc (iframe WebRTC).
 */
export default function InAppCallOverlay() {
  const call = useActiveCallOptional();
  const active = call?.activeCall;
  const tabBar = useTabBar();
  const { user } = useUser();
  const myId = user?.id ?? "";
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!active) return;
    // Lưu trạng thái hiện tại trước khi ẩn — nếu đang ở chat thì tab bar đã bị ẩn rồi
    const wasVisible = tabBar.isVisible;
    tabBar.hideTabBar();
    return () => {
      // Chỉ show lại nếu trước khi gọi nó đang visible
      if (wasVisible) tabBar.showTabBar();
    };
  }, [active, tabBar]);

  /** iframe (Expo web) báo kết thúc / mất kết nối → đóng overlay + API end */
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "zala-webrtc-call-ended") return;
      void call?.hangUpConnected();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [call]);

  // Close add-participant modal when call ends
  useEffect(() => {
    if (!active) setShowAddModal(false);
  }, [active]);

  if (!active) return null;

  const isRinging =
    active.phase === "outgoing_ringing" || active.phase === "incoming_ringing";
  const isIncoming = active.phase === "incoming_ringing";
  const callTypeLabel = active.callType === "VIDEO" ? "video" : "thoại";
  const isGroupCall = Boolean(active.isGroupCall);

  return (
    <View
      style={styles.overlayRoot}
      pointerEvents="auto"
      collapsable={false}
    >
      <View style={styles.overlayInner} className="justify-center">
        {isRinging && (
          <View style={styles.ringingWrap}>
            <View style={styles.ringingCard}>
              <View style={styles.avatarShell}>
                <Image
                  source={{
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      active.peerName || "U"
                    )}&background=4f46e5&color=fff`,
                  }}
                  style={styles.avatarImage}
                />
                {active.phase === "outgoing_ringing" && (
                  <View style={styles.pulseDot}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </View>

              <Text style={styles.peerName}>
                {isGroupCall ? `Nhóm: ${active.peerName}` : active.peerName}
              </Text>
              <Text style={styles.ringingSubtitle}>
                {isIncoming
                  ? `Cuộc gọi ${isGroupCall ? "nhóm " : ""}${callTypeLabel} đến`
                  : `Đang gọi ${isGroupCall ? "nhóm " : ""}${callTypeLabel}...`}
              </Text>

              <View style={styles.actionRow}>
                {isIncoming ? (
                  <>
                    <TouchableOpacity
                      onPress={() => void call?.rejectIncoming()}
                      style={[styles.primaryBtn, styles.declineBtn]}
                    >
                      <Ionicons
                        name="call"
                        size={20}
                        color="#fff"
                        style={{ transform: [{ rotate: "135deg" }] }}
                      />
                      <Text style={styles.primaryBtnText}>Từ chối</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void call?.acceptIncoming()}
                      style={[styles.primaryBtn, styles.acceptBtn]}
                    >
                      <Ionicons name="call" size={20} color="#fff" />
                      <Text style={styles.primaryBtnText}>Nghe máy</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => void call?.cancelOutgoing()}
                    style={[styles.primaryBtn, styles.cancelBtnSingle]}
                  >
                    <Ionicons
                      name="call"
                      size={20}
                      color="#fff"
                      style={{ transform: [{ rotate: "135deg" }] }}
                    />
                    <Text style={styles.primaryBtnText}>Hủy cuộc gọi</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {active.phase === "connected" && (
          <View className="flex-1" collapsable={false}>
            <WebrtcFrame
              url={active.webrtcUrl}
              onWebrtcCallEnded={() => void call?.hangUpConnected()}
              onAddParticipant={() => setShowAddModal(true)}
            />
          </View>
        )}
      </View>

      {/* Modal thêm người tham gia */}
      <AddParticipantModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        conversationId={active.conversationId}
        callSessionId={active.callSessionId}
        callType={active.callType}
        myId={myId}
      />
    </View>
  );
}

const TAB_BAR_Z = 100;

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 99,
  },
  overlayInner: {
    flex: 1,
    backgroundColor: "rgba(7, 10, 18, 1)",
  },
  webrtcWrap: {
    flex: 1,
  },
  webrtc: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── Web bar (unchanged) ──────────────────────────────────────────────────────
  hostBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(14, 20, 34, 0.98)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  hostBtn: {
    marginHorizontal: 6,
    width: 64,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    gap: 4,
  },
  hostBtnDanger: {
    backgroundColor: "rgba(225, 29, 72, 0.95)",
    borderColor: "rgba(225, 29, 72, 0.35)",
  },
  hostBtnMuted: {
    opacity: 0.92,
  },
  hostLbl: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  hostLblMuted: {
    color: "rgba(255,255,255,0.55)",
  },

  // ── Mobile bar ───────────────────────────────────────────────────────────────
  mobileBar: {
    backgroundColor: "rgba(10, 14, 26, 0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.10)",
    paddingTop: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 10,
  },
  mobileRowMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    width: "100%",
    paddingHorizontal: 4,
  },
  /** Nút End Call — to và đỏ nổi bật */
  mobileBtnEnd: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e11d48",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#e11d48",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  /** Nút tròn nhỏ (Mic / Camera / Effects / Thêm) */
  mobileBtnSm: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  mobileBtnSmActive: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  mobileLblSm: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.80)",
  },
  mobileLblSmMuted: {
    color: "rgba(255,255,255,0.35)",
  },
  /** Pill "Chia sẻ màn hình" */
  mobileBtnShare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  mobileLblShare: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.60)",
  },
  ringingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  ringingCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
    backgroundColor: "rgba(20, 28, 48, 0.9)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  avatarShell: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  pulseDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#4f46e5",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  peerName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  ringingSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  actionRow: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  declineBtn: {
    backgroundColor: "#dc2626",
  },
  acceptBtn: {
    backgroundColor: "#16a34a",
  },
  cancelBtnSingle: {
    backgroundColor: "#dc2626",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
