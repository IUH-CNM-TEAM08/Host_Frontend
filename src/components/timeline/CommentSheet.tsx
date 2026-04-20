import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commentService } from '@/src/api/services/social.service';
import SocketService from '@/src/api/socketCompat';
import { useUser } from '@/src/contexts/user/UserContext';
import { validateAvatar } from '@/src/utils/ImageValidator';
import { API_URL } from '@/src/api/AxiosConfig';
import { Post } from '@/src/models/Post';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

interface Comment {
  id: string;
  postId: string;
  parentId?: string;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  createdAt?: string;
  replies?: Comment[];
}

interface CommentSheetProps {
  visible: boolean;
  post: Post;
  onClose: () => void;
  onCommentCountChanged?: (count: number) => void;
}

function timeAgo(date?: string): string {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} ngày trước` : new Date(date).toLocaleDateString('vi-VN');
}

const normalizeAvatarUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;
  return trimmed;
};

function normalizeComment(raw: any): Comment {
  const avatarUrl = normalizeAvatarUrl(raw?.author?.avatarURL ?? raw?.author?.avatarUrl ?? raw?.authorAvatar);

  const comment: Comment = {
    id: raw?.id ?? raw?._id ?? '',
    postId: raw?.postId ?? '',
    parentId: raw?.parentId ?? undefined,
    authorId: raw?.authorId ?? raw?.author?.id ?? '',
    authorName: raw?.author?.name ?? raw?.author?.displayName ?? raw?.authorName ?? 'Ẩn danh',
    authorAvatar: avatarUrl,
    content: raw?.content ?? '',
    createdAt: raw?.createdAt,
    replies: Array.isArray(raw?.replies) ? raw.replies.map(normalizeComment) : undefined,
  };

  return comment;
}
const countComments = (items: Comment[]): number => {
  return items.reduce((total, item) => {
    return total + 1 + countComments(item.replies ?? []);
  }, 0);
};

const removeCommentAndCount = (items: Comment[], commentId: string): { items: Comment[]; removed: number } => {
  let removed = 0;
  const nextItems = items.filter((item) => {
    if (item.id === commentId) {
      removed += 1 + countComments(item.replies ?? []);
      return false;
    }
    return true;
  }).map((item) => {
    if (item.replies?.length) {
      const result = removeCommentAndCount(item.replies, commentId);
      if (result.removed > 0) {
        removed += result.removed;
        return { ...item, replies: result.items };
      }
    }
    return item;
  });
  return { items: nextItems, removed };
};
function ReplyComposer({ value, onChangeText, onSubmit, onCancel, submitting, targetAuthorName, targetSnippet }: { value: string; onChangeText: (text: string) => void; onSubmit: () => void; onCancel: () => void; submitting?: boolean; targetAuthorName?: string; targetSnippet?: string }) {
  return (
    <View style={{ marginTop: 10, padding: 12, backgroundColor: '#eef2ff', borderRadius: 14 }}>
      {targetAuthorName ? (
        <View style={{ marginBottom: 10, padding: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#dbeafe' }}>
          <Text style={{ fontSize: 12, color: '#3730a3', fontWeight: '700' }}>Trả lời {targetAuthorName}</Text>
          {targetSnippet ? (
            <Text numberOfLines={2} ellipsizeMode="tail" style={{ marginTop: 4, fontSize: 13, color: '#4b5563' }}>"{targetSnippet}"</Text>
          ) : null}
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Viết trả lời..."
        placeholderTextColor="#6b7280"
        multiline={Platform.OS !== 'web'}
        blurOnSubmit={Platform.OS === 'web'}
        onSubmitEditing={Platform.OS === 'web' ? onSubmit : undefined}
        style={{ minHeight: 44, maxHeight: 120, color: '#111827', fontSize: 14 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
        <TouchableOpacity onPress={onCancel} style={{ paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ color: '#6d28d9', fontWeight: '700' }}>Huỷ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!value.trim() || submitting}
          style={{
            backgroundColor: value.trim() && !submitting ? '#6d28d9' : '#c7d2fe',
            borderRadius: 16,
            paddingVertical: 8,
            paddingHorizontal: 14,
          }}
        >
          <Text style={{ color: value.trim() && !submitting ? '#fff' : '#9ca3af', fontWeight: '700' }}>
            {submitting ? 'Đang gửi...' : 'Gửi'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CommentItem({ comment, currentUserId, onDelete, onReply, replyToId, replyText, onChangeReplyText, onSubmitReply, onCancelReply, submittingReply }: { comment: Comment; currentUserId?: string; onDelete: (id: string) => void; onReply: (comment: Comment) => void; replyToId?: string; replyText?: string; onChangeReplyText?: (text: string) => void; onSubmitReply?: () => void; onCancelReply?: () => void; submittingReply?: boolean }) {
  const [avatarSrc, setAvatarSrc] = useState<any>({ uri: comment.authorAvatar || '' });
  const isOwner = currentUserId && currentUserId === comment.authorId;

  useEffect(() => {
    validateAvatar(comment.authorAvatar || '').then(setAvatarSrc);
  }, [comment.authorAvatar]);

  return (
    <View style={{ flexDirection: 'row', gap: 9, paddingHorizontal: 14, paddingVertical: 6 }}>
      <Image source={avatarSrc} style={{ width: 34, height: 34, borderRadius: 17, marginTop: 2 }} resizeMode="cover" />
      <View style={{ flex: 1 }}>
        <View style={{ backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 }}>
          <Text style={{ fontWeight: '700', fontSize: 13, color: '#111827', marginBottom: 1 }}>
            {comment.authorName}
          </Text>
          <Text style={{ fontSize: 14, color: '#374151', lineHeight: 19 }}>{comment.content}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 3, paddingLeft: 4 }}>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(comment.createdAt)}</Text>
          <TouchableOpacity onPress={() => onReply(comment)}>
            <Text style={{ fontSize: 11, color: '#6d28d9', fontWeight: '600' }}>Trả lời</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={() => {
              Alert.alert('Xoá bình luận?', '', [
                { text: 'Huỷ', style: 'cancel' },
                { text: 'Xoá', style: 'destructive', onPress: async () => {
                  try { await commentService.delete(comment.id); onDelete(comment.id); }
                  catch { Alert.alert('Lỗi', 'Không thể xoá bình luận.'); }
                }},
              ]);
            }}>
              <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>Xoá</Text>
            </TouchableOpacity>
          )}
        </View>
        {replyToId === comment.id && onSubmitReply ? (
          <ReplyComposer
            value={replyText ?? ''}
            onChangeText={onChangeReplyText ?? (() => {})}
            onSubmit={onSubmitReply}
            onCancel={onCancelReply ?? (() => {})}
            submitting={submittingReply}
            targetAuthorName={comment.authorName}
            targetSnippet={comment.content}
          />
        ) : null}
        {comment.replies?.length ? (
          <View style={{ marginTop: 8, paddingLeft: 42, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }}>
            {comment.replies.map((reply) => (
              <ReplyItem
                key={reply.id}
                reply={reply}
                currentUserId={currentUserId}
                onDelete={onDelete}
                onReply={onReply}
                replyToId={replyToId}
                replyText={replyText}
                onChangeReplyText={onChangeReplyText}
                onSubmitReply={onSubmitReply}
                onCancelReply={onCancelReply}
                submittingReply={submittingReply}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ReplyItem({ reply, currentUserId, onDelete, onReply, replyToId, replyText, onChangeReplyText, onSubmitReply, onCancelReply, submittingReply }: { reply: CommentData; currentUserId?: string; onDelete: (id: string) => void; onReply: (comment: CommentData) => void; replyToId?: string; replyText?: string; onChangeReplyText?: (text: string) => void; onSubmitReply?: () => void; onCancelReply?: () => void; submittingReply?: boolean }) {
  const [avatarSrc, setAvatarSrc] = useState<any>({ uri: reply.authorAvatar || '' });

  useEffect(() => {
    validateAvatar(reply.authorAvatar || '').then(setAvatarSrc);
  }, [reply.authorAvatar]);

  const isOwner = !!(currentUserId && currentUserId === reply.authorId);

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', gap: 9, paddingHorizontal: 0, paddingVertical: 0 }}>
        <Image source={avatarSrc} style={{ width: 28, height: 28, borderRadius: 14, marginTop: 2, backgroundColor: '#f3f4f6' }} resizeMode="cover" />
        <View style={{ flex: 1 }}>
          <View style={{ backgroundColor: '#f9fafb', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ fontWeight: '700', fontSize: 12.5, color: '#111827', marginBottom: 1 }}>
              {reply.authorName}
            </Text>
            <Text style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>{reply.content}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3, paddingLeft: 4 }}>
            <Text style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(reply.createdAt)}</Text>
            <TouchableOpacity onPress={() => onReply(reply)}>
              <Text style={{ fontSize: 11, color: '#6d28d9', fontWeight: '600' }}>Trả lời</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity onPress={() => onDelete(reply.id)}>
                <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: '600' }}>Xoá</Text>
              </TouchableOpacity>
            )}
          </View>
          {replyToId === reply.id && onSubmitReply ? (
            <ReplyComposer
              value={replyText ?? ''}
              onChangeText={onChangeReplyText ?? (() => {})}
              onSubmit={onSubmitReply}
              onCancel={onCancelReply ?? (() => {})}
              submitting={submittingReply}
              targetAuthorName={reply.authorName}
              targetSnippet={reply.content}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CommentSheet({ visible, post, onClose, onCommentCountChanged }: CommentSheetProps) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string; content: string } | null>(null);
  const [userAvatarSrc, setUserAvatarSrc] = useState<any>({ uri: '' });
  const [commentLoaded, setCommentLoaded] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const socketService = useRef(SocketService.getInstance()).current;
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const postId = post?.id || (post as any)?._id || '';

  useEffect(() => {
    validateAvatar(user?.avatarURL || '').then(setUserAvatarSrc);
  }, [user?.avatarURL]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const res: any = await commentService.listByPost(postId);
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
      const normalized = list.map(normalizeComment);
      setComments(normalized);
      const total = countComments(normalized);
      setCommentCount(total);
      onCommentCountChanged?.(total);
      setCommentLoaded(true);
    } catch {
      setComments([]);
      setCommentLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  const appendReplyToComments = (items: Comment[], parentId: string, reply: Comment): Comment[] =>
    items.map((item) => {
      if (item.id === parentId) {
        return { ...item, replies: [...(item.replies ?? []), reply] };
      }

      if (item.replies?.length) {
        return { ...item, replies: appendReplyToComments(item.replies, parentId, reply) };
      }

      return item;
    });

  const handleSubmitReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !postId || !replyTo?.id) return;
    setSubmittingReply(true);

    try {
      const res: any = await commentService.create({
        postId,
        content: trimmed,
        parentId: replyTo.id,
      });

      const raw = res?.data ?? res;
      const newComment = normalizeComment({
        ...raw,
        authorName: user?.displayName ?? user?.name ?? 'Bạn',
        authorAvatar: user?.avatarURL,
        authorId: user?.id,
      });

      setComments((prev) => {
        const next = appendReplyToComments(prev, replyTo.id, newComment);
        const total = countComments(next);
        setCommentCount(total);
        onCommentCountChanged?.(total);
        return next;
      });
      setReplyText('');
      setReplyTo(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.response?.data?.message ?? 'Không thể gửi trả lời.');
    } finally {
      setSubmittingReply(false);
    }
  };

  useEffect(() => {
    if (visible && postId) loadComments();
  }, [visible, postId]);

  useEffect(() => {
    if (!visible || !postId) return;

    socketService.connect();

    const handleSocialUpdate = async (event: any) => {
      if (!event || event.postId !== postId) return;
      if (event.type !== 'NEW_COMMENT' || !event.comment) return;
      const authorId = event.comment?.author?.id ?? event.comment?.authorId;
      if (authorId && authorId === user?.id) return; // ignore self-sent events

      const newComment = normalizeComment({
        ...event.comment,
        authorId: event.comment?.author?.id ?? event.comment?.authorId,
      });

      setComments((prev) => {
        const next = newComment.parentId
          ? appendReplyToComments(prev, newComment.parentId, newComment)
          : [newComment, ...prev];
        const total = countComments(next);
        setCommentCount(total);
        onCommentCountChanged?.(total);
        return next;
      });
      setCommentLoaded(true);
    };

    socketService.subscribeToPost(postId);
    socketService.onSocialUpdate(handleSocialUpdate);

    return () => {
      socketService.removeSocialUpdateListener(handleSocialUpdate);
      socketService.unsubscribeFromPost(postId);
    };
  }, [visible, postId, socketService, loadComments]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !postId) return;
    setSubmitting(true);
    try {
      const res: any = await commentService.create({
        postId,
        content: trimmed,
        ...(replyTo ? { parentId: replyTo.id } : {}),
      });
      const raw = res?.data ?? res;
      const newComment = normalizeComment({
        ...raw,
        authorName: user?.displayName ?? user?.name ?? 'Bạn',
        authorAvatar: user?.avatarURL,
        authorId: user?.id,
      });

      if (replyTo) {
        setComments((prev) => {
          const next = prev.map((comment) =>
            comment.id === replyTo.id
              ? { ...comment, replies: [...(comment.replies ?? []), newComment] }
              : comment
          );
          const total = countComments(next);
          setCommentCount(total);
          onCommentCountChanged?.(total);
          return next;
        });
      } else {
        setComments((prev) => {
          const next = [newComment, ...prev];
          const total = countComments(next);
          setCommentCount(total);
          onCommentCountChanged?.(total);
          return next;
        });
      }

      setText('');
      setReplyTo(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.response?.data?.message ?? 'Không thể gửi bình luận.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (commentId: string) => {
    const result = removeCommentAndCount(comments, commentId);
    setComments(result.items);
    const total = countComments(result.items);
    setCommentCount(total);
    onCommentCountChanged?.(total);
  };

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true,
    }).start(() => {
      setReplyTo(null);
      setReplyText('');
      setText('');
      onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}
        onPress={handleClose}
      />

      {/* Sheet */}
      <Animated.View
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: SHEET_HEIGHT,
          backgroundColor: '#fff',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          transform: [{ translateY: slideAnim }],
          shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1, shadowRadius: 12, elevation: 20,
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 }} />
          </View>

          {/* Title */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingBottom: 10,
            borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
              Bình luận
              {commentCount > 0 && (
                <Text style={{ fontWeight: '400', color: '#9ca3af', fontSize: 14 }}> · {commentCount}</Text>
              )}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#6d28d9" />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={(item) => item.id || String(Math.random())}
              renderItem={({ item }) => (
                <CommentItem
                  comment={item}
                  currentUserId={user?.id}
                  onDelete={handleDelete}
                  onReply={(comment) => {
                    setReplyText('');
                    setReplyTo({ id: comment.id, authorName: comment.authorName ?? 'Người dùng', content: comment.content });
                  }}
                  replyToId={replyTo?.id}
                  replyText={replyText}
                  onChangeReplyText={setReplyText}
                  onSubmitReply={handleSubmitReply}
                  onCancelReply={() => {
                    setReplyTo(null);
                    setReplyText('');
                  }}
                  submittingReply={submittingReply}
                />
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 48 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={36} color="#d1d5db" />
                  <Text style={{ color: '#9ca3af', marginTop: 8, fontSize: 14 }}>
                    Chưa có bình luận nào
                  </Text>
                </View>
              }
              contentContainerStyle={{ paddingVertical: 6, flexGrow: 1 }}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Input */}
          {!replyTo ? (
            <View style={{
              flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 16 : 12,
              borderTopWidth: 1, borderTopColor: '#f3f4f6', backgroundColor: '#fff',
            }}>
              <Image source={userAvatarSrc} style={{ width: 32, height: 32, borderRadius: 16, marginBottom: 2 }} resizeMode="cover" />
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'flex-end',
                backgroundColor: '#f3f4f6', borderRadius: 20,
                paddingHorizontal: 14, paddingVertical: 6, gap: 6,
              }}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Viết bình luận..."
                  placeholderTextColor="#9ca3af"
                  style={{ flex: 1, fontSize: 14, color: '#111827', maxHeight: 80 }}
                  multiline={Platform.OS !== 'web'}
                  editable={!submitting}
                  blurOnSubmit={Platform.OS === 'web'}
                  returnKeyType="send"
                  onSubmitEditing={Platform.OS === 'web' ? handleSubmit : undefined}
                />
              </View>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={!text.trim() || submitting}
                style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: text.trim() && !submitting ? '#6d28d9' : '#e5e7eb',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 2,
                }}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={15} color={text.trim() ? '#fff' : '#9ca3af'} />
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
