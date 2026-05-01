import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '@/src/models/Post';
import { validateAvatar } from '@/src/utils/ImageValidator';
import { postService, commentService } from '@/src/api/services/social.service';
import { API_URL } from '@/src/api/AxiosConfig';
import SocketService from '@/src/api/socketCompat';
import PostActionMenu from '@/src/components/timeline/PostActionMenu';
import { useUser } from '@/src/contexts/user/UserContext';
import { mapApiPostToModel } from '@/src/models/mappers';
import MediaViewer from '@/src/components/timeline/MediaViewer';

interface PostCardProps {
  post: Post;
  onUpdated?: (post: Post) => void;
  onDeleted?: (postId: string) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(date?: string): string {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} ngày` : new Date(date).toLocaleDateString('vi-VN');
}

interface CommentData {
  id: string;
  postId?: string;
  parentId?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt?: string;
  replies?: CommentData[];
}

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
        multiline
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

const normalizeAvatarUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;
  return trimmed;
};

function normalizeComment(raw: any): CommentData {
  return {
    id: raw?.id ?? raw?._id ?? '',
    postId: raw?.postId ?? '',
    parentId: raw?.parentId ?? undefined,
    authorId: raw?.authorId ?? raw?.author?.id ?? '',
    authorName: raw?.author?.name ?? raw?.author?.displayName ?? raw?.authorName ?? 'Ẩn danh',
    authorAvatar: normalizeAvatarUrl(raw?.author?.avatarURL ?? raw?.author?.avatarUrl ?? raw?.authorAvatar),
    content: raw?.content ?? '',
    createdAt: raw?.createdAt,
    replies: Array.isArray(raw?.replies) ? raw.replies.map(normalizeComment) : undefined,
  };
}

const countComments = (items: CommentData[]): number => {
  return items.reduce((total, item) => total + 1 + countComments(item.replies ?? []), 0);
};

// ─── Inline CommentItem ──────────────────────────────────────────────────────

function CommentItem({ comment, currentUserId, onDelete, onReply, replyToId, replyText, onChangeReplyText, onSubmitReply, onCancelReply, submittingReply }: { comment: CommentData; currentUserId?: string; onDelete: (id: string) => void; onReply: (comment: CommentData) => void; replyToId?: string; replyText?: string; onChangeReplyText?: (text: string) => void; onSubmitReply?: () => void; onCancelReply?: () => void; submittingReply?: boolean }) {
  const [avatarSrc, setAvatarSrc] = useState<any>({ uri: comment.authorAvatar || '' });

  useEffect(() => {
    validateAvatar(comment.authorAvatar || '').then(setAvatarSrc);
  }, [comment.authorAvatar]);

  const isOwner = !!(currentUserId && currentUserId === comment.authorId);

  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 5 }}>
      <Image source={avatarSrc} style={{ width: 30, height: 30, borderRadius: 15 }} resizeMode="cover" />
      <View style={{ flex: 1 }}>
        <View style={{ backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6 }}>
          <Text style={{ fontWeight: '700', fontSize: 12.5, color: '#111827', marginBottom: 1 }}>
            {comment.authorName}
          </Text>
          <Text style={{ fontSize: 13.5, color: '#374151', lineHeight: 18 }}>{comment.content}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 3, paddingLeft: 4 }}>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(comment.createdAt)} trước</Text>
          <TouchableOpacity onPress={() => onReply(comment)}>
            <Text style={{ fontSize: 11, color: '#6d28d9', fontWeight: '600' }}>Trả lời</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={() => onDelete(comment.id)}>
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
          <View style={{ marginTop: 8, paddingLeft: 34, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }}>
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

  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 5 }}>
      <Image source={avatarSrc} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#f3f4f6' }} resizeMode="cover" />
      <View style={{ flex: 1 }}>
        <View style={{ backgroundColor: '#f9fafb', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6 }}>
          <Text style={{ fontWeight: '700', fontSize: 12.1, color: '#111827', marginBottom: 1 }}>
            {reply.authorName}
          </Text>
          <Text style={{ fontSize: 13.2, color: '#374151', lineHeight: 18 }}>{reply.content}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 3, paddingLeft: 4 }}>
          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(reply.createdAt)} trước</Text>
          <TouchableOpacity onPress={() => onReply(reply)}>
            <Text style={{ fontSize: 11, color: '#6d28d9', fontWeight: '600' }}>Trả lời</Text>
          </TouchableOpacity>
          {currentUserId && currentUserId === reply.authorId && (
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
        {reply.replies?.length ? (
          <View style={{ marginTop: 8, paddingLeft: 34, borderLeftWidth: 1, borderLeftColor: '#e5e7eb' }}>
            {reply.replies.map((nestedReply) => (
              <ReplyItem
                key={nestedReply.id}
                reply={nestedReply}
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

// ─── Main PostCard ───────────────────────────────────────────────────────────

const REACTION_OPTIONS = [
  { type: 'LIKE', emoji: '👍', label: 'Thích' },
  { type: 'HEART', emoji: '❤️', label: 'Yêu thích' },
  { type: 'HAHA', emoji: '😂', label: 'Haha' },
  { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'SAD', emoji: '😢', label: 'Buồn' },
  { type: 'ANGRY', emoji: '😡', label: 'Giận' },
] as const;

export default function PostCard({ post, onUpdated, onDeleted }: PostCardProps) {
  const { user } = useUser();
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(post.reactionCounts ?? {});
  const [userReaction, setUserReaction] = useState<string | null>(post.userReaction ?? null);
  const [currentPost, setCurrentPost] = useState(post);
  const [avatarSrc, setAvatarSrc] = useState<any>({ uri: post.author?.avatarURL || '' });

  // Inline comment states
  const [showComments, setShowComments] = useState(false);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentData | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [commentLoaded, setCommentLoaded] = useState(false);
  const [userAvatarSrc, setUserAvatarSrc] = useState<any>({ uri: user?.avatarURL || '' });

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const postId = currentPost.id || (currentPost as any)._id || '';
  const socketService = useRef(SocketService.getInstance()).current;
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  // Dùng ref để handler socket luôn thấy state mới nhất (tránh closure stale)
  const commentLoadedRef = useRef(commentLoaded);
  const commentsRef = useRef(comments);
  const appendReplyRef = useRef<(items: CommentData[], parentId: string, reply: CommentData) => CommentData[]>();

  useEffect(() => {
    validateAvatar(currentPost.author?.avatarURL || '').then(setAvatarSrc);
  }, [currentPost.author?.avatarURL]);

  useEffect(() => {
    validateAvatar(user?.avatarURL || '').then(setUserAvatarSrc);
  }, [user?.avatarURL]);

  useEffect(() => { commentLoadedRef.current = commentLoaded; }, [commentLoaded]);
  useEffect(() => { commentsRef.current = comments; }, [comments]);

  useEffect(() => {
    if (!postId) return;

    const handleSocialUpdate = (event: any) => {
      if (!event || event.postId !== postId) return;
      switch (event.type) {
        case 'NEW_COMMENT': {
          const authorId = event.comment?.author?.id ?? event.comment?.authorId;
          if (authorId && authorId === user?.id) return; // ignore self-sent events

          const newComment = event.comment ? normalizeComment(event.comment) : null;
          setCommentCount((prev) => prev + 1);

          if (newComment) {
            if (commentLoadedRef.current) {
              // Đã load comments → prepend lên đầu (mới nhất trên đầu, khớp với API sort createdAt:-1)
              setComments((prev) =>
                newComment.parentId
                  ? appendReplyToComments(prev, newComment.parentId!, newComment)
                  : [newComment, ...prev]
              );
            }
            // Nếu chưa load (commentLoaded=false) → khi user mở panel sẽ fetch mới từ server
          }
          break;
        }
        case 'POST_REACTION':
          setReactionCounts(event.reactions ?? {});
          setUserReaction(event.userReaction ?? null);
          setLikeCount((event.reactions ?? {})['LIKE'] ?? 0);
          setLiked(event.userReaction === 'LIKE');
          break;
        case 'POST_UPDATED': {
          if (event.post) {
            // Normalize raw socket data (mediaList → media, etc.) nhưng giữ author từ currentPost
            const normalized = mapApiPostToModel(event.post);
            setCurrentPost((prev) => ({
              ...prev,
              content: normalized.content ?? prev.content,
              media: normalized.media?.length ? normalized.media : prev.media,
              mediaList: normalized.mediaList ?? prev.mediaList,
              privacy: normalized.privacy ?? prev.privacy,
              visibility: normalized.visibility ?? prev.visibility,
              updatedAt: normalized.updatedAt ?? prev.updatedAt,
              // Giữ lại author/id vị trí cũ không bị ghi đè
              author: prev.author,
            }));
          }
          break;
        }
        case 'POST_DELETED':
          setCurrentPost((prev) => ({ ...prev, isDeleted: true } as Post));
          break;
        default:
          break;
      }
    };

    socketService.subscribeToPost(postId);
    socketService.onSocialUpdate(handleSocialUpdate);

    return () => {
      socketService.removeSocialUpdateListener(handleSocialUpdate);
      socketService.unsubscribeFromPost(postId);
    };
  }, [postId, socketService, user?.id]);

  // Sync post counts and reaction state when post prop updates
  useEffect(() => {
    setCommentCount(post.commentCount ?? 0);
    setLikeCount(post.likeCount ?? post.reactionCounts?.LIKE ?? 0);
    setReactionCounts(post.reactionCounts ?? {});
    setUserReaction(post.userReaction ?? null);
    setLiked(post.isLiked ?? post.userReaction === 'LIKE' ?? false);
  }, [post.commentCount, post.likeCount, post.isLiked, post.reactionCounts, post.userReaction]);

  // ── Load comments ──
  const appendReplyToComments = (items: CommentData[], parentId: string, reply: CommentData): CommentData[] =>
    items.map((item) => {
      if (item.id === parentId) {
        return { ...item, replies: [...(item.replies ?? []), reply] };
      }

      if (item.replies?.length) {
        return { ...item, replies: appendReplyToComments(item.replies, parentId, reply) };
      }

      return item;
    });

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoadingComments(true);
    try {
      const res: any = await commentService.listByPost(postId);
      const raw = res?.data ?? res;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
      const normalized = list.map(normalizeComment);
      setComments(normalized);
      setCommentCount(countComments(normalized)); // sync count với thực tế
      setCommentLoaded(true);
    } catch {
      // ignore
    } finally {
      setLoadingComments(false);
    }
  }, [postId]);

  const handleToggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentLoaded) {
      loadComments();
    }
  };

  // ── Like ──
  const handleReact = async (type: string) => {
    if (!postId) return;
    setShowReactionMenu(false);
    const prevReaction = userReaction;
    const prevCounts = { ...reactionCounts };

    try {
      const res: any = await postService.react(postId, type);
      const data = res?.data ?? res;
      const nextReactions = data?.reactions ?? {};
      setReactionCounts(nextReactions);
      setUserReaction(data?.userReaction ?? null);
      setLikeCount(nextReactions['LIKE'] ?? 0);
      setLiked(data?.userReaction === 'LIKE');
      setCurrentPost((prev) => ({ ...prev, reactionCounts: nextReactions, userReaction: data?.userReaction ?? null } as Post));
    } catch {
      setReactionCounts(prevCounts);
      setUserReaction(prevReaction);
    }
  };

  // ── Submit comment ──
  const handleSubmitComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !postId) return;
    setSubmittingComment(true);
    try {
      const res: any = await commentService.create({
        postId,
        content: trimmed,
      });
      const raw = res?.data ?? res;
      const newComment = normalizeComment({
        ...raw,
        authorName: user?.displayName ?? user?.name ?? 'Bạn',
        authorAvatar: user?.avatarURL,
        authorId: user?.id,
        createdAt: new Date().toISOString(),
      });

      setComments((prev) => [newComment, ...prev]);
      setCommentCount((c) => c + 1);
      setCommentText('');
      if (!showComments) setShowComments(true);
      setCommentLoaded(true);
    } catch {
      // ignore
    } finally {
      setSubmittingComment(false);
    }
  };

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
        createdAt: new Date().toISOString(),
      });

      const updated = appendReplyToComments(comments, replyTo.id, newComment);
      setComments(updated);
      setCommentCount((c) => c + 1);
      setReplyText('');
      setReplyTo(null);
      setCommentLoaded(true);
    } catch {
      // ignore
    } finally {
      setSubmittingReply(false);
    }
  };

  // ── Delete comment ──
  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentService.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  // ── Share ──
  const handleShare = async () => {
    try {
      await Share.share({
        message: currentPost.content
          ? `${currentPost.author?.name ?? ''}: ${currentPost.content}`
          : `Bài viết của ${currentPost.author?.name ?? ''}`,
      });
    } catch { /* ignore */ }
  };

  const handleUpdated = (updated: Post) => {
    setCurrentPost(updated);
    onUpdated?.(updated);
  };

  const privacyNorm = ((currentPost.privacy ?? currentPost.visibility ?? '') + '').toLowerCase() as any;

  const normalizeMediaUrl = (rawUrl?: string): string | undefined => {
    if (!rawUrl) return undefined;
    const url = rawUrl.trim();
    if (url.startsWith('http://') || url.startsWith('https://')) return encodeURI(url);
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('/')) return `${API_URL}${url}`;
    return encodeURI(url);
  };

  const mediaItems = (() => {
    const items = Array.isArray(currentPost.media) && currentPost.media.length > 0
      ? currentPost.media
      : Array.isArray(currentPost.mediaList) && currentPost.mediaList.length > 0
        ? currentPost.mediaList.map((m) => ({ url: m.url, type: (m.type + '').toLowerCase() as any }))
        : [];

    return items
      .map((m) => ({ ...m, url: normalizeMediaUrl(m.url) }))
      .filter((m) => !!m.url);
  })();

  return (
    <View style={{ backgroundColor: '#fff', paddingTop: 12, paddingBottom: 2 }}>
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <Image
            source={avatarSrc}
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(109,40,217,0.15)' }}
            resizeMode="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 14, color: '#111827' }}>
              {currentPost.author?.name || 'Người dùng'}
              {(currentPost as any).emotion ? (
                <Text style={{ fontWeight: '400', color: '#6b7280', fontSize: 13 }}>
                  {' '}đang cảm thấy {(currentPost as any).emotion}
                </Text>
              ) : null}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(currentPost.createdAt)} trước</Text>
              {privacyNorm === 'public' && <Ionicons name="earth-outline" size={10} color="#9ca3af" />}
              {privacyNorm === 'friends' && <Ionicons name="people-outline" size={10} color="#9ca3af" />}
              {privacyNorm === 'private' && <Ionicons name="lock-closed-outline" size={10} color="#9ca3af" />}
            </View>
          </View>
        </View>
        <PostActionMenu
          post={{ ...currentPost, id: postId }}
          currentUserId={user?.id}
          onDeleted={onDeleted}
          onUpdated={handleUpdated}
        />
      </View>

      {/* ── Content ── */}
      {currentPost.content ? (
        <Text style={{ fontSize: 14.5, lineHeight: 21, color: '#1f2937', paddingHorizontal: 14, marginBottom: 10 }}>
          {currentPost.content}
        </Text>
      ) : null}

      {/* ── Media ── */}
      {mediaItems.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          {mediaItems.length === 1 ? (
            /* 1 ảnh — full width */
            <TouchableOpacity activeOpacity={0.9} onPress={() => openViewer(0)}>
              <Image
                source={{ uri: mediaItems[0].url }}
                style={{ width: '100%', height: isDesktop ? 340 : 260 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : mediaItems.length === 2 ? (
            /* 2 ảnh — 2 cột ngang nhau */
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {mediaItems.map((m, i) => (
                <TouchableOpacity key={i} style={{ flex: 1 }} activeOpacity={0.9} onPress={() => openViewer(i)}>
                  <Image
                    source={{ uri: m.url }}
                    style={{ flex: 1, height: 200 }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            /* >2 ảnh — ảnh đầu + stack bên phải với +N */
            <View style={{ flexDirection: 'row', gap: 2, height: 240 }}>
              {/* Ảnh đầu — chiếm 60% */}
              <TouchableOpacity style={{ flex: 3 }} activeOpacity={0.9} onPress={() => openViewer(0)}>
                <Image
                  source={{ uri: mediaItems[0].url }}
                  style={{ flex: 1, height: '100%' }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              {/* Stack phải — 3 slot, ảnh cuối có overlay +N */}
              <View style={{ flex: 2, gap: 2 }}>
                {mediaItems.slice(1, 4).map((m, i) => {
                  const realIndex = i + 1;
                  const isLast = i === 2;
                  const remaining = mediaItems.length - 4;
                  return (
                    <TouchableOpacity key={i} style={{ flex: 1, position: 'relative' }} activeOpacity={0.9} onPress={() => openViewer(realIndex)}>
                      <Image
                        source={{ uri: m.url }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                      {isLast && remaining > 0 && (
                        <View style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                            +{remaining + 1}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Stats bar (like count + comment count) ── */}
      {(likeCount > 0 || commentCount > 0 || Object.keys(reactionCounts).length > 0) && (
        <View style={{
          paddingHorizontal: 14, paddingVertical: 6,
        }}>
          {Object.entries(reactionCounts).filter(([, count]) => count > 0).length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
              {Object.entries(reactionCounts)
                .filter(([, count]) => count > 0)
                .map(([type, count]) => {
                  const reaction = REACTION_OPTIONS.find((r) => r.type === type);
                  return (
                    <View
                      key={type}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 8, paddingVertical: 4,
                        backgroundColor: '#f3f4f6', borderRadius: 14,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{reaction?.emoji ?? '👍'}</Text>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>{count}</Text>
                    </View>
                  );
                })}
            </View>
          ) : null}

          {commentCount > 0 && (
            <TouchableOpacity onPress={handleToggleComments}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>
                {commentCount} bình luận
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Divider ── */}
      <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 }} />

      {/* ── Action buttons ── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 2 }}>
        <TouchableOpacity
          onPress={() => setShowReactionMenu((prev) => !prev)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 6, borderRadius: 10 }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 18 }}>{REACTION_OPTIONS.find((r) => r.type === userReaction)?.emoji ?? '👍'}</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280' }}>
            {userReaction ? REACTION_OPTIONS.find((r) => r.type === userReaction)?.label ?? 'React' : 'React'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleToggleComments}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 6, borderRadius: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name={showComments ? 'chatbubble' : 'chatbubble-outline'} size={17} color={showComments ? '#6d28d9' : '#6b7280'} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: showComments ? '#6d28d9' : '#6b7280' }}>
            {commentCount > 0 ? `${commentCount} Bình luận` : 'Bình luận'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShare}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 6, borderRadius: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-redo-outline" size={18} color="#6b7280" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#6b7280' }}>Chia sẻ</Text>
        </TouchableOpacity>
      </View>
      {showReactionMenu ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 14, paddingVertical: 8 }}>
          {REACTION_OPTIONS.map((reaction) => (
            <TouchableOpacity
              key={reaction.type}
              onPress={() => handleReact(reaction.type)}
              style={{
                alignItems: 'center', justifyContent: 'center', padding: 8,
                backgroundColor: userReaction === reaction.type ? '#ede9fe' : '#f8fafc',
                borderRadius: 14,
              }}
            >
              <Text style={{ fontSize: 18 }}>{reaction.emoji}</Text>
              <Text style={{ fontSize: 11, color: '#374151', marginTop: 4 }}>{reaction.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* ── Inline Comments Section ── */}
      {showComments && (
        <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
          {/* Comment input */}
          {!replyTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
              <Image source={userAvatarSrc} style={{ width: 30, height: 30, borderRadius: 15 }} resizeMode="cover" />
              <View style={{
                flex: 1, flexDirection: 'row', alignItems: 'flex-end',
                backgroundColor: '#f3f4f6', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7,
              }}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Viết bình luận..."
                  placeholderTextColor="#9ca3af"
                  style={{ flex: 1, fontSize: 13.5, color: '#111827', maxHeight: 72 }}
                  multiline
                  editable={!submittingComment}
                />
                <TouchableOpacity
                  onPress={handleSubmitComment}
                  disabled={!commentText.trim() || submittingComment}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#6d28d9" />
                  ) : (
                    <Ionicons
                      name="send"
                      size={18}
                      color={commentText.trim() ? '#6d28d9' : '#d1d5db'}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Loading */}
          {loadingComments && (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator size="small" color="#6d28d9" />
            </View>
          )}

          {/* Comments list */}
          {!loadingComments && comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={user?.id}
              onDelete={handleDeleteComment}
              onReply={(comment) => {
                setReplyTo(comment);
                setReplyText('');
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
          ))}

          {/* Empty state */}
          {!loadingComments && comments.length === 0 && commentLoaded && (
            <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 }}>
              Chưa có bình luận. Hãy là người đầu tiên! 💬
            </Text>
          )}
        </View>
      )}

      {/* ── Media Viewer ── */}
      <MediaViewer
        visible={viewerVisible}
        media={mediaItems}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}
