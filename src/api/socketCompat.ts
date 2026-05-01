import { io, Socket } from "socket.io-client";
import { ApiEndpoints } from "@/src/constants/ApiConstant";
import { AuthStorage } from "@/src/storage/AuthStorage";

type Handler = (...args: any[]) => void;

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

/** Log mạnh hơn để đảm bảo thấy được trong console của user */
const zalaLog = (...args: unknown[]) => {
  // Thay đổi: LUÔN log trong giai đoạn debug này để chắc chắn thấy được kết quả
  console.log("%c[Zala Socket]", "color: #2563eb; font-weight: bold", ...args);
};

class SocketCompat {
  private static instance: SocketCompat;
  private socket: Socket | null = null;
  private pendingToken: string | null = null;
  /** Wrapper fns so `off()` removes the exact listener registered for `chat:message-pinned` / delete */
  private pinnedListenerWrappers = new Map<Handler, Handler>();
  private unpinnedListenerWrappers = new Map<Handler, Handler>();
  private deletedListenerWrappers = new Map<Handler, Handler>();
  private friendRequestListenerWrappers = new Map<Handler, Handler>();
  private friendAcceptedListenerWrappers = new Map<Handler, Handler>();
  private friendActionListenerWrappers = new Map<Handler, Handler>();
  private nicknameUpdatedListenerWrappers = new Map<Handler, Handler>();
  private newConversationListenerWrappers = new Map<Handler, Handler>();

  private constructor() { }

  static getInstance() {
    if (!SocketCompat.instance) {
      SocketCompat.instance = new SocketCompat();
    }
    return SocketCompat.instance;
  }

  private ensureSocket() {
    if (this.socket) return this.socket;
    const url = ApiEndpoints.SOCKET_URL;
    zalaLog("creating client →", url);
    this.socket = io(url, {
      // Prioritize websocket for stability on mobile, keep polling as fallback if needed
      transports: ["websocket", "polling"],
      autoConnect: false,
      auth: this.pendingToken ? { token: this.pendingToken } : undefined,
    });

    const s = this.socket;
    if (!(s as any).__zalaLifecycle) {
      (s as any).__zalaLifecycle = true;
      s.on("connect", () => {
        zalaLog("✓ connected", { id: s.id, url });
      });
      s.on("disconnect", (reason: string) => {
        zalaLog("✗ disconnected", reason);
      });
      s.on("connect_error", (err: Error) => {
        console.error("[Zala Socket] CONNECT_ERROR", err?.message ?? err, { url });
      });
      s.on("error", (err: unknown) => {
        console.error("[Zala Socket] ERROR", err);
      });

      // Thêm onAny để bắt tất cả event từ server
      s.onAny((event, ...args) => {
        zalaLog("→ EVENT INCOMING:", event, args);
      });

      s.on("message:error", (payload: unknown) => {
        console.error("[Zala Socket] message:error (server)", payload);
      });
      // (duplicate onAny removed — using the one at L66 above)
    }

    return this.socket;
  }

  async connect(token?: string) {
    const t = token || (await AuthStorage.getAccessToken());
    const newToken = t || null;
    const s = this.ensureSocket();
    
    // Kiểm tra xem token có khác với token hiện tại của socket không
    const currentToken = (s.auth as any)?.token;
    const tokenChanged = newToken !== currentToken;
    
    this.pendingToken = newToken;
    s.auth = this.pendingToken ? { token: this.pendingToken } : {};
    
    zalaLog("connect() trigger", { 
      token: this.pendingToken ? (this.pendingToken.substring(0, 10) + "...") : "none",
      tokenChanged,
      alreadyConnected: s.connected 
    });

    if (s.connected && tokenChanged) {
      zalaLog("Token changed, forcing reconnect...");
      s.disconnect();
      s.connect();
    } else if (!s.connected) {
      zalaLog("Calling s.connect()...");
      s.connect();
    }
  }

  disconnect() {
    if (this.socket?.connected) this.socket.disconnect();
  }

  private on(event: string, cb: Handler) {
    this.ensureSocket().on(event, cb);
  }

  private off(event: string, cb: Handler) {
    this.socket?.off(event, cb);
  }

  onConnect(cb: Handler) {
    const s = this.ensureSocket();
    s.off("connect", cb); // Prevent duplicates
    s.on("connect", cb);
  }

  removeConnectListener(cb: Handler) {
    this.socket?.off("connect", cb);
  }

  joinConversation(conversationId: string) {
    zalaLog("emit chat:join", conversationId);
    this.ensureSocket().emit("chat:join", { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.ensureSocket().emit("chat:leave", { conversationId });
  }

  subscribeToPost(postId: string) {
    const s = this.ensureSocket();
    if (s.connected) {
      s.emit('social:subscribe', { postId });
    } else {
      // Đợi kết nối xong rồi mới subscribe (chỉ một lần)
      const onConnect = () => {
        s.emit('social:subscribe', { postId });
        s.off('connect', onConnect);
      };
      s.on('connect', onConnect);
    }
  }

  unsubscribeFromPost(postId: string) {
    this.ensureSocket().emit('social:unsubscribe', { postId });
  }

  onSocialUpdate(cb: Handler) {
    this.on('social:update', cb);
  }

  removeSocialUpdateListener(cb: Handler) {
    this.off('social:update', cb);
  }

  /** Lắng nghe bài viết mới từ bạn bè (server emit qua friendshipRoom) */
  onNewPost(cb: (post: any) => void) {
    const wrap: Handler = (event: any) => {
      if (event?.type === 'NEW_POST' && event?.post) {
        cb(event.post);
      }
    };
    // Dùng chính cb làm key để có thể remove đúng
    (cb as any).__newPostWrap = wrap;
    this.on('social:update', wrap);
  }

  removeNewPostListener(cb: (post: any) => void) {
    const wrap = (cb as any).__newPostWrap;
    if (wrap) {
      this.off('social:update', wrap);
      delete (cb as any).__newPostWrap;
    }
  }

  // (onNotificationNew / removeNotificationNewListener — see detailed version below at L719)

  sendSeen(messageId: string, conversationId?: string) {
    if (!conversationId) return;
    this.ensureSocket().emit("chat:read", { conversationId, messageId });
  }

  sendMessage(message: any) {
    zalaLog("emit message:send", {
      conversationId: message?.conversationId,
      type: message?.type,
      len: String(message?.content ?? "").length,
    });
    this.ensureSocket().emit("message:send", message);
  }

  sendDeleteMessage(message: any) {
    const messageId = message?.id || message?.messageId;
    const conversationId = message?.conversationId;
    if (!messageId || !conversationId) return;

    this.ensureSocket().emit("message:delete", {
      messageId,
      conversationId,
      forEveryone: true,
    });
  }

  createVote(payload: any) {
    this.ensureSocket().emit("vote:create", payload);
  }

  onVoteCreated(cb: Handler) {
    this.on("poll:created", cb);
    this.on("vote:created", cb);
  }

  removeVoteCreatedListener(cb: Handler) {
    this.off("poll:created", cb);
    this.off("vote:created", cb);
  }

  pinMessage(payload: any) {
    this.ensureSocket().emit("message:pin", payload);
  }

  onPinnedMessage(cb: Handler) {
    this.removePinnedMessageListener(cb);
    this.on("message:pinned", cb);
    const wrap: Handler = (payload: any) => {
      cb({
        conversationId: payload?.conversationId ?? payload?.message?.conversationId,
        messageId: payload?.messageId ?? payload?.message?._id ?? payload?.message?.id,
        pinnedMessages: payload?.pinnedMessages,
        message: payload?.message,
      });
    };
    this.pinnedListenerWrappers.set(cb, wrap);
    this.on("chat:message-pinned", wrap);
  }

  removePinnedMessageListener(cb: Handler) {
    this.off("message:pinned", cb);
    const wrap = this.pinnedListenerWrappers.get(cb);
    if (wrap) {
      this.off("chat:message-pinned", wrap);
      this.pinnedListenerWrappers.delete(cb);
    }
  }

  onMessageUnpinned(
    cb: (data: { conversationId?: string; messageId?: string; message?: any }) => void
  ) {
    this.removeMessageUnpinnedListener(cb);
    const wrap: Handler = (payload: any) => {
      cb({
        conversationId: payload?.conversationId ?? payload?.message?.conversationId,
        messageId: payload?.messageId ?? payload?.message?._id ?? payload?.message?.id,
        message: payload?.message,
      });
    };
    this.unpinnedListenerWrappers.set(cb as Handler, wrap);
    // Listen to all common unpin events
    this.on("chat:message-unpinned", wrap);
    this.on("message:unpinned", wrap);
    this.on("conversation:message_unpinned", wrap);
  }

  removeMessageUnpinnedListener(
    cb: (data: { conversationId?: string; messageId?: string; message?: any }) => void
  ) {
    const wrap = this.unpinnedListenerWrappers.get(cb as Handler);
    if (wrap) {
      this.off("chat:message-unpinned", wrap);
      this.off("message:unpinned", wrap);
      this.off("conversation:message_unpinned", wrap);
      this.unpinnedListenerWrappers.delete(cb as Handler);
    }
  }

  /** Emit reorder ghim tới server qua socket */
  reorderPinnedMessages(payload: { conversationId: string; orderedMessageIds: string[] }) {
    this.ensureSocket().emit("message:reorder-pins", payload);
  }

  /** Lắng nghe khi thứ tự ghim được cập nhật */
  onPinsReordered(cb: (data: { conversationId: string; pinnedMessages: any[] }) => void) {
    this.on("message:pins-reordered", cb as Handler);
    this.on("chat:message-pin-reordered", cb as Handler);
  }

  removePinsReorderedListener(cb: Handler) {
    this.off("message:pins-reordered", cb);
    this.off("chat:message-pin-reordered", cb);
  }

  /** REST thu hồi (`chat:message-deleted`) + socket `message:deleted_for_everyone` */
  onMessageDeletedForEveryone(cb: (payload: { message?: any; _id?: string; id?: string; conversationId?: string; messageId?: string }) => void) {
    this.removeMessageDeletedForEveryoneListener(cb);
    const wrap: Handler = (raw: any) => {
      const message = raw?.message ?? raw;
      const mid = String(
        raw?.messageId ?? raw?.id ?? raw?._id ?? message?._id ?? message?.id ?? ""
      );
      const conversationId = String(
        raw?.conversationId ?? raw?.message?.conversationId ?? message?.conversationId ?? ""
      );
      if (mid) {
        cb({
          id: mid,
          _id: mid,
          conversationId: conversationId || undefined,
          messageId: mid,
          message,
        });
        return;
      }
      cb(message ?? raw);
    };
    this.deletedListenerWrappers.set(cb as Handler, wrap);
    this.on("message:deleted_for_everyone", wrap);
    this.on("chat:message-deleted", wrap);
  }

  onMessageEdited(
    cb: (payload: { message?: any; conversationId?: string }) => void
  ) {
    this.on("chat:message-edited", cb);
  }

  removeMessageEditedListener(
    cb: (payload: { message?: any; conversationId?: string }) => void
  ) {
    this.off("chat:message-edited", cb as Handler);
  }

  onConversationUpdated(cb: (payload: any) => void) {
    this.on("chat:conversation-updated", cb as Handler);
  }

  removeConversationUpdatedListener(cb: (payload: any) => void) {
    this.off("chat:conversation-updated", cb as Handler);
  }

  removeMessageDeletedForEveryoneListener(
    cb: (payload: { message?: any; _id?: string; id?: string; conversationId?: string; messageId?: string }) => void
  ) {
    const wrap = this.deletedListenerWrappers.get(cb as Handler);
    if (wrap) {
      this.off("message:deleted_for_everyone", wrap);
      this.off("chat:message-deleted", wrap);
      this.deletedListenerWrappers.delete(cb as Handler);
    }
  }

  sendAttachment(conversationId: string, fileData: any, repliedToId?: string) {
    this.ensureSocket().emit("message:send_attachment", { conversationId, fileData, repliedToId });
  }

  /** Nhiều file → 1 tin MEDIA_ALBUM (tối đa 20 file phía server) */
  sendMediaAlbum(
    conversationId: string,
    files: Array<{ buffer: ArrayBuffer; fileName: string; contentType: string }>,
    repliedToId?: string
  ) {
    this.ensureSocket().emit("message:send_media_album", { conversationId, files, repliedToId });
  }

  onAttachmentSent(cb: Handler) {
    this.on("attachment:sent", cb);
  }

  removeAttachmentSentListener(cb: Handler) {
    this.off("attachment:sent", cb);
  }

  onAttachmentError(cb: Handler) {
    this.on("attachment:error", cb);
  }

  removeAttachmentErrorListener(cb: Handler) {
    this.off("attachment:error", cb);
  }

  onNewMessage(cb: Handler) {
    this.removeMessageListener(cb); // Prevent duplicates
    this.on("message:new", cb);
    this.on("chat:new-message", cb);
  }

  removeMessageListener(cb: Handler) {
    this.off("message:new", cb);
    this.off("chat:new-message", cb);
  }

  onParticipantsAddedServer(cb: Handler) {
    this.on("conversation:participants_added", cb);
  }

  removeParticipantsAddedServer(cb: Handler) {
    this.off("conversation:participants_added", cb);
  }

  onNewConversation(cb: Handler) {
    this.removeNewConversationListener(cb);
    const wrap: Handler = (payload: any) => {
      cb(payload?.conversation ?? payload);
    };
    this.newConversationListenerWrappers.set(cb, wrap);
    this.on("conversation:new", wrap);
    this.on("conversation:created", wrap);
    this.on("conversation:added", wrap);
    this.on("conversation:error", wrap); // Quan trọng: Bắt lỗi server để trigger fetch lại
    this.on("conversation:participant_added", wrap);
    this.on("group:created", wrap);
    this.on("group:member-added", wrap);
    this.on("chat:added-to-group", wrap);
    this.on("chat:new-conversation", wrap);
  }

  removeNewConversationListener(cb: Handler) {
    const wrap = this.newConversationListenerWrappers.get(cb);
    if (wrap) {
      this.off("conversation:new", wrap);
      this.off("conversation:created", wrap);
      this.off("conversation:added", wrap);
      this.off("group:created", wrap);
      this.off("group:member-added", wrap);
      this.off("chat:added-to-group", wrap);
      this.off("chat:new-conversation", wrap);
      this.newConversationListenerWrappers.delete(cb);
    }
  }

  actionParticipantsAdded(payload: { conversationId: string; participantIds: string[] }) {
    this.ensureSocket().emit("group:add_participants", payload);
  }

  sendFriendRequest(payload: any) {
    const receiverId = payload?.receiverId || payload?.targetId || payload?.userId;
    this.ensureSocket().emit("friend_request:send", { receiverId });
  }

  sendDeleteFriendRequest(payload: any) {
    this.ensureSocket().emit("friend_request:deny", payload);
  }

  onFriendRequest(cb: Handler) {
    this.off("friend_request:new", cb);
    const wrap: Handler = (payload: any) => {
      if (payload?.type && payload.type !== "FRIEND_REQUEST") return;
      cb(payload?.friendship ?? payload);
    };
    this.friendRequestListenerWrappers.set(cb, wrap);
    this.on("friend_request:new", cb);
    this.on("friendship:new", wrap);
  }

  removeFriendRequestListener(cb: Handler) {
    this.off("friend_request:new", cb);
    const wrap = this.friendRequestListenerWrappers.get(cb);
    if (wrap) {
      this.off("friendship:new", wrap);
      this.friendRequestListenerWrappers.delete(cb);
    }
  }

  onDeleteFriendRequest(cb: Handler) {
    this.on("friend_request:new_deny", cb);
    const wrap: Handler = (payload: any) => {
      const type = payload?.type;
      if (type !== "FRIEND_REJECTED" && type !== "FRIEND_RECALLED" && type !== "FRIEND_UNFRIENDED") return;
      cb(payload?.friendship ?? payload);
    };
    this.friendActionListenerWrappers.set(cb, wrap);
    this.on("friendship:new", wrap);
  }

  removeFriendRequestActionListener(cb: Handler) {
    this.off("friend_request:new_deny", cb);
    const wrap = this.friendActionListenerWrappers.get(cb);
    if (wrap) {
      this.off("friendship:new", wrap);
      this.friendActionListenerWrappers.delete(cb);
    }
  }

  onFriendRequestAccepted(cb: Handler) {
    this.on("friend_request:new_accept", cb);
    this.on("friendship:accepted", cb);
    const wrap: Handler = (payload: any) => {
      if (payload?.type !== "FRIEND_ACCEPTED") return;
      cb(payload?.friendship ?? payload);
    };
    this.friendAcceptedListenerWrappers.set(cb, wrap);
    this.on("friendship:new", wrap);
  }

  removeFriendRequestAcceptedListener(cb: Handler) {
    this.off("friend_request:new_accept", cb);
    this.off("friendship:accepted", cb);
    const wrap = this.friendAcceptedListenerWrappers.get(cb);
    if (wrap) {
      this.off("friendship:new", wrap);
      this.friendAcceptedListenerWrappers.delete(cb);
    }
  }


  // ─── REACTIONS ──────────────────────────────────────────────────
  /**
   * Gửi reaction (hoặc thay đổi emoji đã react).
   * Nếu emoji mới == emoji đang react → server xử lý toggle off (unreact).
   */
  sendReaction(payload: { messageId: string; conversationId: string; emoji: string }) {
    this.ensureSocket().emit("message:react", payload);
  }

  /** Thu hồi 1 lần react (giảm count emoji đó đi 1) */
  sendUnreaction(payload: { messageId: string; conversationId: string; emoji: string }) {
    this.ensureSocket().emit("message:unreact", payload);
  }

  /** Nhận broadcast reactions đã cập nhật từ server */
  onReactionUpdated(cb: (data: {
    messageId: string;
    reactions?: Array<{ userId: string; emoji: string; reactedAt?: string }>;
    userId?: string;
    emoji?: string | null;
    conversationId?: string;
  }) => void) {
    this.on("message:reaction_updated", cb);
    this.on("chat:reaction", cb as Handler);
  }

  removeReactionUpdatedListener(cb: Handler) {
    this.off("message:reaction_updated", cb);
    this.off("chat:reaction", cb);
  }

  submitVote(payload: any) {
    this.ensureSocket().emit("vote:submit", payload);
  }

  getVote(payload: any) {
    this.ensureSocket().emit("vote:get", payload);
  }

  onVoteUpdated(cb: Handler) {
    this.on("poll:voted", cb);
    this.on("vote:updated", cb);
  }

  onVoteResult(cb: Handler) {
    this.on("vote:result", cb);
  }

  onVoteError(cb: Handler) {
    this.on("vote:error", cb);
  }

  onBlockSettingUpdated(
    cb: (payload: {
      conversationId: string;
      blockerId: string;
      blockedId: string;
      messageBlocked: boolean;
      callBlocked: boolean;
      action?: 'upsert' | 'clear';
    }) => void
  ) {
    this.on('chat:block-setting-updated', cb as Handler);
  }

  removeBlockSettingUpdatedListener(cb: Handler) {
    this.off('chat:block-setting-updated', cb);
  }

  removeVoteUpdatedListener(cb: Handler) {
    this.off("poll:voted", cb);
    this.off("vote:updated", cb);
  }

  removeVoteResultListener(cb: Handler) {
    this.off("vote:result", cb);
  }

  removeVoteErrorListener(cb: Handler) {
    this.off("vote:error", cb);
  }

  /** Đóng bình chọn (chỉ creator) */
  closeVote(payload: { conversationId: string; voteId: string }) {
    this.ensureSocket().emit("poll:close", payload);
    this.ensureSocket().emit("vote:close", payload);
  }

  /** Thêm lựa chọn mới vào bình chọn */
  addVoteOption(payload: { messageId: string; optionText: string; conversationId: string }) {
    this.ensureSocket().emit("poll:add_option", payload);
    this.ensureSocket().emit("vote:add_option", payload);
  }

  /** Lắng nghe khi bình chọn bị đóng hoặc hết hạn */
  onVoteClosed(cb: Handler) {
    this.on("poll:expired", cb);
    this.on("vote:closed", cb);
  }

  removeVoteClosedListener(cb: Handler) {
    this.off("poll:expired", cb);
    this.off("vote:closed", cb);
  }

  /** Lắng nghe khi có option mới được thêm vào bình chọn */
  onVoteOptionAdded(cb: Handler) {
    this.on("poll:option_added", cb);
    this.on("vote:option_added", cb);
  }

  removeVoteOptionAddedListener(cb: Handler) {
    this.off("poll:option_added", cb);
    this.off("vote:option_added", cb);
  }

  // ─── PRESENCE (Online / Offline) ──────────────────────────────
  // Lắng nghe khi backend broadcast trạng thái online/offline của bất kỳ user nào
  onPresenceUpdate(cb: (data: { userId: string; status: 'online' | 'offline'; lastSeen: string }) => void) {
    this.on('presence:update', cb);
  }

  removePresenceUpdateListener(cb: Handler) {
    this.off('presence:update', cb);
  }

  // Gửi heartbeat lên server để giữ trạng thái online (dùng setInterval bên ngoài)
  sendHeartbeat() {
    this.ensureSocket().emit('presence:heartbeat');
  }

  onCallSession(
    cb: (payload: {
      conversationId: string;
      callSessionId: string;
      kind: 'answered' | 'missed' | 'ended' | 'participant_declined' | 'participant_left';
      byUserId?: string;
    }) => void
  ) {
    this.on('call:session', cb);
  }

  removeCallSessionListener(cb: Handler) {
    this.off('call:session', cb);
  }

  updateConversationNickname(payload: { conversationId: string; userId: string; newNickname?: string | null }) {
    this.ensureSocket().emit("conversation:update_nickname", payload);
  }

  onConversationNicknameUpdated(
    cb: (data: { conversationId: string; userId: string; newNickname?: string | null }) => void
  ) {
    this.removeConversationNicknameUpdatedListener(cb as Handler);
    const wrap: Handler = (payload: any) => {
      cb({
        conversationId: String(payload?.conversationId ?? ""),
        userId: String(payload?.userId ?? ""),
        newNickname:
          payload?.newNickname == null ? null : String(payload?.newNickname),
      });
    };
    this.nicknameUpdatedListenerWrappers.set(cb as Handler, wrap);
    this.on("conversation:nickname_updated", wrap);
  }

  removeConversationNicknameUpdatedListener(cb: Handler) {
    const wrap = this.nicknameUpdatedListenerWrappers.get(cb);
    if (wrap) {
      this.off("conversation:nickname_updated", wrap);
      this.nicknameUpdatedListenerWrappers.delete(cb);
    }
  }

  onConversationRenamed(cb: (data: { conversationId?: string; newName?: string }) => void) {
    this.on("conversation:renamed", cb as Handler);
  }

  removeConversationRenamedListener(cb: Handler) {
    this.off("conversation:renamed", cb);
  }

  // (onConversationUpdated / removeConversationUpdatedListener — see primary version at L356)

  onNotificationNew(
    cb: (payload: {
      type?: string;
      title?: string;
      conversationId?: string;
      reminderId?: string;
      triggeredAt?: string;
    }) => void
  ) {
    this.on("notification:new", cb as Handler);
  }

  removeNotificationNewListener(cb: Handler) {
    this.off("notification:new", cb);
  }

  onNotificationDeleted(cb: (payload: { notificationId: string }) => void) {
    this.on("notification:deleted", cb as Handler);
  }

  removeNotificationDeletedListener(cb: Handler) {
    this.off("notification:deleted", cb);
  }

  onSessionKicked(cb: (data: { userId: string; reason?: string; kickedAt?: string }) => void) {
    this.on("session:kicked", cb as Handler);
  }

  removeSessionKickedListener(cb: Handler) {
    this.off("session:kicked", cb);
  }

  onVipUpgraded(cb: (data: { vipTier: string; vipExpiryDate: string }) => void) {
    this.on("vip_upgraded", cb as Handler);
  }

  removeVipUpgradedListener(cb: Handler) {
    this.off("vip_upgraded", cb);
  }

  onCoinDeposited(cb: (data: { balance: number; coinAmount: number; transactionId: string }) => void) {
    this.on("coin_deposited", cb as Handler);
  }

  removeCoinDepositedListener(cb: Handler) {
    this.off("coin_deposited", cb);
  }

  // ─── MESSAGE READ / DELIVERED RECEIPTS ────────────────────────────────────

  /** Emit khi người dùng đã xem 1 tin nhắn (đang trong màn chat) */
  sendRead(conversationId: string, messageId: string) {
    this.ensureSocket().emit("chat:read", { conversationId, messageId });
  }

  /** Emit khi client nhận được tin nhắn (dù chưa mở màn chat) */
  sendDelivered(conversationId: string, messageId: string) {
    this.ensureSocket().emit("chat:delivered", { conversationId, messageId });
  }

  /** Đánh dấu đã xem (Zalo-style) */
  markAsSeen(payload: { conversationId: string; messageId: string }) {
    this.ensureSocket().emit("message:seen", payload);
    this.ensureSocket().emit("chat:read", payload);
  }

  /** Lắng nghe khi người kia đã XEM tin nhắn của mình */
  onMessageRead(cb: (data: { conversationId: string; messageId: string; userId: string; readAt: string; avatarUrl?: string; displayName?: string }) => void) {
    this.on("message:seen", cb as Handler);
    this.on("chat:read", cb as Handler);
  }

  removeMessageReadListener(cb: Handler) {
    this.off("chat:read", cb);
  }

  /** Lắng nghe khi người kia đã NHẬN tin nhắn của mình */
  onMessageDelivered(cb: (data: { conversationId: string; messageId: string; userId: string }) => void) {
    this.on("chat:delivered", cb as Handler);
  }

  removeMessageDeliveredListener(cb: Handler) {
    this.off("chat:delivered", cb);
  }

  // ─── TYPING INDICATOR ─────────────────────────────────────────────────────

  sendTyping(conversationId: string, isTyping: boolean) {
    this.ensureSocket().emit("chat:typing", { conversationId, isTyping });
  }

  onChatTyping(cb: (data: { conversationId: string; userId: string; isTyping: boolean; timestamp: number }) => void) {
    this.on("chat:typing", cb as Handler);
  }

  removeChatTypingListener(cb: Handler) {
    this.off("chat:typing", cb);
  }

  // (duplicate removeMessageDeliveredListener removed — see primary version at L776)

  // ─── CHAT WALLPAPER / BACKGROUND ──────────────────────────────────────────

  /** Broadcast khi mình đổi ảnh nền → người kia cùng thấy */
  sendBackground(conversationId: string, backgroundId: string) {
    this.ensureSocket().emit("chat:background", { conversationId, backgroundId });
  }

  /** Lắng nghe khi người kia đổi ảnh nền */
  onBackgroundChanged(cb: (data: { conversationId: string; backgroundId: string; userId: string }) => void) {
    this.on("chat:background", cb as Handler);
  }

  removeBackgroundListener(cb: Handler) {
    this.off("chat:background", cb);
  }

  // ─── GROUP MANAGEMENT ─────────────────────────────────────────────────────

  /** Chuyển quyền admin → backend event: `group:transfer_admin` */
  transferAdmin(payload: { conversationId: string; toUserId: string }) {
    this.ensureSocket().emit("group:transfer_admin", payload);
  }

  /** Cấp quyền phó nhóm → backend event: `group:grant_mod` */
  grantMod(payload: { conversationId: string; toUserId: string }) {
    this.ensureSocket().emit("group:grant_mod", payload);
  }

  /** Rời nhóm (member tự rời) → backend event: `group:leave` */
  leaveGroup(groupId: string) {
    this.ensureSocket().emit("group:leave", { groupId });
  }

  /** Giải tán nhóm (chỉ OWNER) → backend event: `conversation:delete` */
  deleteConversation(conversationId: string) {
    this.ensureSocket().emit("conversation:delete", { conversationId });
  }

  /** Lắng nghe khi admin được chuyển */
  onAdminTransferred(cb: (data: { conversationId: string; newAdminId: string }) => void) {
    this.on("conversation:admin_transferred", cb as Handler);
  }
  removeAdminTransferredListener(cb: Handler) {
    this.off("conversation:admin_transferred", cb);
  }

  /** Lắng nghe khi có mod mới */
  onModGranted(cb: (data: { conversationId: string; newModId: string }) => void) {
    this.on("conversation:mod_granted", cb as Handler);
  }
  removeModGrantedListener(cb: Handler) {
    this.off("conversation:mod_granted", cb);
  }

  /** Lắng nghe khi có mod bị hạ chức */
  onModRevoked(cb: (data: { conversationId: string; revokedModId: string }) => void) {
    this.on("conversation:mod_revoked", cb as Handler);
  }
  removeModRevokedListener(cb: Handler) {
    this.off("conversation:mod_revoked", cb);
  }

  /** Lắng nghe khi có thành viên rời/bị kick */
  onMemberOut(cb: (data: { userId: string; groupId: string }) => void) {
    this.on("group:member-out", cb as Handler);
  }
  removeMemberOutListener(cb: Handler) {
    this.off("group:member-out", cb);
  }

  /** Lắng nghe khi nhóm bị giải tán */
  onConversationDeleted(cb: (data: { conversationId: string }) => void) {
    this.on("conversation:deleted", cb as Handler);
    this.on("conversation:disbanded", cb as Handler);
  }
  removeConversationDeletedListener(cb: Handler) {
    this.off("conversation:deleted", cb);
    this.off("conversation:disbanded", cb);
  }

  /** Lắng nghe khi thành viên bị xóa khỏi nhóm */
  onParticipantsRemoved(cb: (data: { conversationId: string; removedParticipants: string[] }) => void) {
    this.on("conversation:participants_removed", cb as Handler);
  }
  removeParticipantsRemovedListener(cb: Handler) {
    this.off("conversation:participants_removed", cb);
  }

  // (duplicate onParticipantsAddedServer / removeParticipantsAddedServer removed — see primary version at L415)

  /** Lắng nghe khi có thành viên bị chặn khỏi nhóm */
  onParticipantBanned(cb: (data: { conversationId: string; targetUserId: string }) => void) {
    this.on("conversation:participant_banned", cb as Handler);
  }

  removeParticipantBannedListener(cb: Handler) {
    this.off("conversation:participant_banned", cb);
  }

  /** Lắng nghe khi có thành viên được bỏ chặn khỏi nhóm */
  onParticipantUnbanned(cb: (data: { conversationId: string; targetUserId: string }) => void) {
    this.on("conversation:participant_unbanned", cb as Handler);
  }

  removeParticipantUnbannedListener(cb: Handler) {
    this.off("conversation:participant_unbanned", cb);
  }

  /** Lắng nghe khi cài đặt nhóm thay đổi (hỗ trợ cả event cũ và mới). */
  onGroupSettingsUpdated(cb: (data: { conversationId: string; settings: Record<string, any> }) => void) {
    this.on("conversation:settings_updated", cb as Handler);
    this.on("chat:settings-update", cb as Handler);
  }
  removeGroupSettingsUpdatedListener(cb: Handler) {
    this.off("conversation:settings_updated", cb);
    this.off("chat:settings-update", cb);
  }

  /** Lắng nghe khi có tin nhắn được ghim trong nhóm */
  onMessagePinned(cb: (data: { conversationId: string; messageId: string }) => void) {
    this.on("conversation:message_pinned", cb as Handler);
  }
  removeMessagePinnedListener(cb: Handler) {
    this.off("conversation:message_pinned", cb);
  }



  /** Lắng nghe khi biệt danh thành viên được cập nhật */
  onNicknameUpdated(cb: (data: { conversationId: string; targetUserId: string; nickname: string | null; updatedBy: string }) => void) {
    this.on("conversation:nickname_updated", cb as Handler);
  }
  removeNicknameUpdatedListener(cb: Handler) {
    this.off("conversation:nickname_updated", cb);
  }

  // ─── Group Invite ────────────────────────────────────────────────────────
  /** Nhận lời mời vào nhóm (invitee lắng nghe) */
  onGroupInviteReceived(cb: (data: {
    inviteId: string; conversationId: string; groupName: string; groupAvatar: string;
    inviterId: string; inviterName: string; inviterAvatar: string;
  }) => void) {
    this.on('group_invite:received', cb as Handler);
  }
  removeGroupInviteReceivedListener(cb: Handler) {
    this.off('group_invite:received', cb);
  }

  /** Biết lời mời được chấp nhận (inviter lắng nghe) */
  onGroupInviteAccepted(cb: (data: {
    inviteId: string; conversationId: string; accepterId: string; accepterName: string;
  }) => void) {
    this.on('group_invite:accepted', cb as Handler);
  }
  removeGroupInviteAcceptedListener(cb: Handler) {
    this.off('group_invite:accepted', cb);
  }

  /** Biết lời mời bị từ chối (inviter lắng nghe) */
  onGroupInviteDeclined(cb: (data: {
    inviteId: string; conversationId: string; declinerId: string; declinerName: string; reason?: string;
  }) => void) {
    this.on('group_invite:declined', cb as Handler);
  }
  removeGroupInviteDeclinedListener(cb: Handler) {
    this.off('group_invite:declined', cb);
  }

  // ─── GROUP JOIN REQUESTS ──────────────────────────────────────────────────

  /** Lắng nghe khi có người yêu cầu vào nhóm (chỉ Admin nhận được) */
  onGroupJoinRequest(
    cb: (data: {
      inviteId?: string;
      conversationId: string;
      groupName: string;
      requesterId: string;
      requesterName?: string;
      requesterAvatar?: string;
      requesterAvatarUrl?: string;
    }) => void,
  ) {
    this.on("group:join_request", cb as Handler);
  }

  removeGroupJoinRequestListener(cb: Handler) {
    this.off("group:join_request", cb);
  }

  /** Bị mời ra khỏi nhóm (REST remove participant) */
  onGroupKickedFrom(cb: (data: { conversationId: string; groupName: string }) => void) {
    this.on("group:kicked_from", cb as Handler);
  }

  removeGroupKickedFromListener(cb: Handler) {
    this.off("group:kicked_from", cb);
  }

  /** Bị chặn khỏi nhóm (ban vĩnh viễn) */
  onGroupBannedFrom(cb: (data: { conversationId: string; groupName: string; actorName?: string }) => void) {
    this.on("group:banned_from", cb as Handler);
  }

  removeGroupBannedFromListener(cb: Handler) {
    this.off("group:banned_from", cb);
  }

  /** Được bỏ chặn khỏi nhóm */
  onGroupUnbannedFrom(cb: (data: { conversationId: string; groupName: string; actorName?: string }) => void) {
    this.on("group:unbanned_from", cb as Handler);
  }

  removeGroupUnbannedFromListener(cb: Handler) {
    this.off("group:unbanned_from", cb);
  }

  /** Chính user tự rời nhóm */
  onGroupLeftFrom(cb: (data: { conversationId: string; groupName: string; memberId?: string; memberName?: string }) => void) {
    this.on("group:left_from", cb as Handler);
  }

  removeGroupLeftFromListener(cb: Handler) {
    this.off("group:left_from", cb);
  }

  /** Thành viên khác trong nhóm tự rời */
  onGroupMemberLeft(cb: (data: { conversationId: string; groupName: string; memberId?: string; memberName?: string }) => void) {
    this.on("group:member_left", cb as Handler);
  }

  removeGroupMemberLeftListener(cb: Handler) {
    this.off("group:member_left", cb);
  }

  /** Thành viên bị admin kick khỏi nhóm */
  onGroupMemberKicked(cb: (data: { conversationId: string; groupName: string; actorName?: string; memberId?: string; memberName?: string }) => void) {
    this.on("group:member_kicked", cb as Handler);
  }

  removeGroupMemberKickedListener(cb: Handler) {
    this.off("group:member_kicked", cb);
  }

  /** Lắng nghe khi yêu cầu tham gia nhóm được duyệt (chỉ Người yêu cầu nhận được) */
  onGroupJoinApproved(cb: (data: { conversationId: string; groupName: string }) => void) {
    this.on("group:join_approved", cb as Handler);
  }

  removeGroupJoinApprovedListener(cb: Handler) {
    this.off("group:join_approved", cb);
  }

  /** Lắng nghe khi yêu cầu tham gia nhóm bị từ chối (chỉ Người yêu cầu nhận được) */
  onGroupJoinRejected(cb: (data: { conversationId: string; groupName: string }) => void) {
    this.on("group:join_rejected", cb as Handler);
  }

  removeGroupJoinRejectedListener(cb: Handler) {
    this.off("group:join_rejected", cb);
  }

  onUserPrivacyUpdated(
    cb: (payload: {
      userId: string;
      allowStrangerMessage: boolean;
      allowStrangerCall: boolean;
      allowStrangerGroupInvite: boolean;
    }) => void
  ) {
    this.on("user:privacy-updated", cb as Handler);
  }

  removeUserPrivacyUpdatedListener(cb: Handler) {
    this.off("user:privacy-updated", cb);
  }

  onUserProfileUpdated(
    cb: (payload: {
      userId: string;
      displayName?: string;
      avatarUrl?: string;
      coverUrl?: string;
      updatedAt?: string;
    }) => void
  ) {
    this.on("user:profile-updated", cb as Handler);
  }

  removeUserProfileUpdatedListener(cb: Handler) {
    this.off("user:profile-updated", cb);
  }
}

export default SocketCompat;
