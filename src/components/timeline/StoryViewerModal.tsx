import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Image,
  Dimensions, Platform, StyleSheet, StatusBar,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Story } from '@/src/models/Post';
import { storyService } from '@/src/api/services/social.service';
import { useUser } from '@/src/contexts/user/UserContext';
import { API_URL } from '@/src/api/AxiosConfig';

const { width: SW, height: SH } = Dimensions.get('window');

const normalizeUrl = (rawUrl?: string | null): string | undefined => {
  const trimmed = rawUrl?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'default') return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;
  return `${API_URL}/${trimmed}`;
};

/** Thời gian tương đối chi tiết < 24h */
function storyTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'Vừa xong';
  if (s < 60) return `${s} giây trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  return `${h} giờ trước`;
}

/** Còn bao lâu hết hạn (24h từ lúc tạo) */
function storyExpiresIn(dateStr?: string): string {
  if (!dateStr) return '';
  const created = new Date(dateStr).getTime();
  const expiresAt = created + 24 * 60 * 60 * 1000;
  const remain = expiresAt - Date.now();
  if (remain <= 0) return 'Đã hết hạn';
  const h = Math.floor(remain / (60 * 60 * 1000));
  const m = Math.floor((remain % (60 * 60 * 1000)) / 60000);
  if (h === 0) return `Còn ${m} phút`;
  return `Còn ${h}g ${m}p`;
}

interface StoryViewerModalProps {
  visible: boolean;
  stories: Story[];           // danh sách nhiều story để điều hướng
  initialIndex?: number;
  onClose: () => void;
  onDeleted?: (storyId: string) => void;
}

export default function StoryViewerModal({
  visible, stories, initialIndex = 0, onClose, onDeleted,
}: StoryViewerModalProps) {
  const { user } = useUser();
  const [index, setIndex] = useState(initialIndex);
  const [now, setNow] = useState(Date.now());

  const story = stories[index] ?? null;
  const mediaUri = story?.mediaURL ?? (story as any)?.mediaUrl ?? (story as any)?.mediaURL ?? '';
  const isVideo = String(story?.mediaType ?? story?.type ?? '')
    .toUpperCase() === 'VIDEO' || /\.(mp4|mov|webm|ogg)$/i.test(String(mediaUri ?? ''));

  // Story video mặc định tắt âm thanh, user có thể bật/tắt bằng nút.
  const [isMuted, setIsMuted] = useState(true);

  // Cập nhật thời gian mỗi 30 giây
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, visible]);

  useEffect(() => {
    // Khi đổi sang story/video khác, reset muted để không bật tiếng ngoài ý muốn.
    if (!visible) return;
    if (isVideo) setIsMuted(true);
  }, [visible, isVideo, index]);

  useEffect(() => {
    if (visible && story && !story.viewed && user?.id !== story.authorId) {
      storyService.view(story.id).catch(() => {});
    }
  }, [visible, story?.id]);

  const handleDelete = async () => {
    if (!story?.id) return;
    const ok = Platform.OS === 'web'
      ? window.confirm('Xóa story này?')
      : true;
    if (!ok) return;
    try {
      await storyService.delete(story.id);
      onDeleted?.(story.id);
      if (stories.length <= 1) { onClose(); return; }
      setIndex((i) => Math.max(0, i - 1));
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert(e?.response?.data?.message ?? 'Lỗi xóa story');
    }
  };

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => {
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }, [index, stories.length, onClose]);

  const toggleMute = useCallback(() => {
    if (!isVideo) return;
    setIsMuted((m) => !m);
  }, [isVideo]);

  if (!story) return null;

  const avatarUri = normalizeUrl(story.author?.avatarURL ?? (story.author as any)?.avatarUrl) ?? '';
  const normalizedMediaUri = normalizeUrl(story.mediaURL ?? (story as any).mediaUrl) ?? '';
  const isOwner = user?.id === story.authorId;
  const topOffset = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 24) + 8;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.container, { paddingTop: topOffset }]}>

          {/* ── Progress bar ── */}
          <View style={styles.progressRow}>
            {stories.map((_, i) => (
              <View key={i} style={[styles.progressSegment, { flex: 1 / stories.length }]}>
                <View style={[styles.progressFill, i <= index ? { width: '100%' } : { width: 0 }]} />
              </View>
            ))}
          </View>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={{ uri: avatarUri || 'https://www.gravatar.com/avatar/0?d=mp' }}
                style={styles.avatar}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.authorName}>{story.author?.name || 'Vô danh'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.timeText}>{storyTimeAgo(story.createdAt)}</Text>
                  <Text style={styles.dotSep}>·</Text>
                  <Text style={[styles.timeText, { color: '#fbbf24' }]}>{storyExpiresIn(story.createdAt)}</Text>
                  {story.visibility && story.visibility !== 'PUBLIC' && (
                    <View style={styles.visibilityBadge}>
                      <Ionicons
                        name={story.visibility === 'FRIENDS' ? 'people-outline' : 'lock-closed-outline'}
                        size={9}
                        color="rgba(255,255,255,0.85)"
                      />
                      <Text style={styles.visibilityText}>
                        {story.visibility === 'FRIENDS' ? 'Bạn bè' : 'Chỉ tôi'}
                      </Text>
                    </View>
                  )}
                  {story.visibility === 'PUBLIC' && (
                    <View style={styles.visibilityBadge}>
                      <Ionicons name="earth-outline" size={9} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.visibilityText}>Công khai</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.headerRight}>
              {isVideo && (
                <TouchableOpacity onPress={toggleMute} style={styles.iconBtn}>
                  <Ionicons
                    name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
                    size={22}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}
              {isOwner && (
                <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Media ── */}
          {normalizedMediaUri ? (
            isVideo ? (
              <Video
                source={{ uri: normalizedMediaUri }}
                style={styles.media}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                useNativeControls={false}
                isMuted={isMuted}
              />
            ) : (
              <Image source={{ uri: normalizedMediaUri }} style={styles.media} resizeMode="contain" />
            )
          ) : (
            <View style={[styles.media, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e1b4b' }]}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', padding: 32 }}>
                {story.caption ?? ''}
              </Text>
            </View>
          )}

          {/* Caption */}
          {story.caption && normalizedMediaUri ? (
            <View style={styles.captionBox}>
              <Text style={styles.captionText}>{story.caption}</Text>
            </View>
          ) : null}

          {/* ── Prev / Next tap zones ── */}
          {/* Lưu ý: 2 vùng chạm này phủ gần toàn màn, cần nằm dưới header để nút mute không bị "ăn" tap */}
          <TouchableOpacity style={styles.prevZone} onPress={goPrev} activeOpacity={1} />
          <TouchableOpacity style={styles.nextZone} onPress={goNext} activeOpacity={1} />

          {/* ── Arrow buttons (nếu nhiều story) ── */}
          {stories.length > 1 && (
            <>
              {index > 0 && (
                <TouchableOpacity style={styles.arrowLeft} onPress={goPrev}>
                  <Ionicons name="chevron-back-circle" size={36} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              )}
              {index < stories.length - 1 && (
                <TouchableOpacity style={styles.arrowRight} onPress={goNext}>
                  <Ionicons name="chevron-forward-circle" size={36} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Counter */}
          {stories.length > 1 && (
            <View style={styles.counterBox}>
              <Text style={styles.counterText}>{index + 1} / {stories.length}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  container: {
    width: '100%', maxWidth: 480,
    height: Platform.OS === 'web' ? '92%' : '100%',
    maxHeight: 920,
    backgroundColor: '#000',
    borderRadius: Platform.OS === 'web' ? 20 : 0,
    overflow: 'hidden', position: 'relative',
  },
  progressRow: { flexDirection: 'row', gap: 3, paddingHorizontal: 10, marginBottom: 8 },
  progressSegment: { height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 8,
    position: 'relative',
    zIndex: 5,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    zIndex: 6,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  authorName: {
    color: '#fff', fontWeight: '700', fontSize: 15,
    ...(Platform.OS === 'web'
      ? ({ textShadow: '1px 1px 3px rgba(0,0,0,0.6)' } as any)
      : { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }),
  },
  visibilityBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 3, alignSelf: 'flex-start',
  },
  visibilityText: { color: 'rgba(255,255,255,0.85)', fontSize: 10.5, fontWeight: '600' },
  timeText: { color: 'rgba(255,255,255,0.75)', fontSize: 11.5 },
  dotSep: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', flex: 1 },
  captionBox: { position: 'absolute', bottom: 60, left: 20, right: 20, alignItems: 'center' },
  captionText: { color: '#fff', fontSize: 16, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  prevZone: { position: 'absolute', left: 0, top: 60, bottom: 0, width: '35%', zIndex: 1 },
  nextZone: { position: 'absolute', right: 0, top: 60, bottom: 0, width: '35%', zIndex: 1 },
  arrowLeft: { position: 'absolute', left: 10, top: '50%', marginTop: -18 },
  arrowRight: { position: 'absolute', right: 10, top: '50%', marginTop: -18 },
  counterBox: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
