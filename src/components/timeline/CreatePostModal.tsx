import React, { useState, useRef } from 'react';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { postService } from '@/src/api/services/social.service';
import { uploadMediaToS3 } from '@/src/api/services/media.service';
import { Post } from '@/src/models/Post';
import { validateAvatar } from '@/src/utils/ImageValidator';

type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface SelectedMedia {
  uri: string;
  name: string;
  type: string;
  mediaType: 'IMAGE' | 'VIDEO';
  file?: any;
}

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated?: (post: Post) => void;
  userAvatarURL?: string;
  userName?: string;
}

type PrivacyConfigType = {
  PUBLIC:  { label: string; icon: string; color: string };
  FRIENDS: { label: string; icon: string; color: string };
  PRIVATE: { label: string; icon: string; color: string };
};

const EMOTIONS = [
  { key: '', emoji: '', label: 'Không có' },
  { key: 'happy',    emoji: '😊', label: 'Hạnh phúc' },
  { key: 'loved',    emoji: '🥰', label: 'Yêu thương' },
  { key: 'excited',  emoji: '🤩', label: 'Hợp đỏng' },
  { key: 'blessed',  emoji: '🙏', label: 'Được phước' },
  { key: 'sad',      emoji: '😢', label: 'Buồn' },
  { key: 'angry',    emoji: '😠', label: 'Tức giận' },
  { key: 'tired',    emoji: '😴', label: 'Mệt mỏi' },
  { key: 'grateful', emoji: '😌', label: 'Biết ơn' },
  { key: 'proud',    emoji: '💪', label: 'Tự hào' },
  { key: 'cool',     emoji: '😎', label: 'Cực cảnh' },
  { key: 'foodie',   emoji: '😋', label: 'Đang ăn' },
] as const;
type EmotionKey = typeof EMOTIONS[number]['key'];

export default function CreatePostModal({
  visible, onClose, onCreated, userAvatarURL, userName,
}: CreatePostModalProps) {
  const { t } = useTranslation();
  const PRIVACY_CONFIG: PrivacyConfigType = {
    PUBLIC:  { label: t('createPost.privacyPublic'),    icon: 'earth-outline',         color: '#059669' },
    FRIENDS: { label: t('createPost.privacyFriends'),   icon: 'people-outline',        color: '#6d28d9' },
    PRIVATE: { label: t('createPost.privacyPrivate'),   icon: 'lock-closed-outline',   color: '#6b7280' },
  };
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [emotion, setEmotion] = useState<EmotionKey>('');
  const [showEmotionPicker, setShowEmotionPicker] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [showPrivacyPicker, setShowPrivacyPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moderationWarning, setModerationWarning] = useState<string | null>(null);
  const getViolationDetail = (err: any): string => {
    const reasonCode = String(err?.reasonCode || err?.response?.data?.reasonCode || "").toUpperCase();
    const labelsRaw = err?.labels || err?.response?.data?.labels;
    const labels = Array.isArray(labelsRaw) ? labelsRaw.map((x: unknown) => String(x).toUpperCase()) : [];
    const violations = err?.violations || err?.response?.data?.violations;
    const violationCount = Number(err?.violationCount || err?.response?.data?.violationCount || 0);
    const merged = [reasonCode, ...labels];
    const reasons: string[] = [];
    if (merged.some((x) => x.includes("NSFW"))) reasons.push("nội dung nhạy cảm (18+)");
    if (merged.some((x) => x.includes("REGIONAL_DISCRIMINATION"))) reasons.push("phân biệt vùng miền");
    if (merged.some((x) => x.includes("POLITICAL_EXTREMISM"))) reasons.push("nội dung chính trị bị cấm");
    if (merged.some((x) => x.includes("HATE_OR_ABUSE"))) reasons.push("ngôn từ thù ghét/xúc phạm");
    if (merged.some((x) => x.includes("PROFANITY"))) reasons.push("ngôn từ tục tĩu/chửi thề");
    if (merged.some((x) => x.includes("SUSPICIOUS"))) reasons.push("tệp có định dạng không an toàn");
    if (reasons.length > 0) {
      return `Vi phạm: ${reasons.join(", ")}.${violationCount > 0 ? ` Phát hiện ${violationCount} dấu hiệu.` : ""}`;
    }
    return String(err?.message || err?.response?.data?.message || "Vi phạm chính sách nội dung.");
  };

  const [avatarSrc, setAvatarSrc] = useState<any>({ uri: userAvatarURL || '' });

  React.useEffect(() => {
    validateAvatar(userAvatarURL || '').then(setAvatarSrc);
  }, [userAvatarURL]);

  const resetForm = () => {
    setContent('');
    setSelectedMedia([]);
    setVisibility('PUBLIC');
    setEmotion('');
    setShowPrivacyPicker(false);
    setShowEmotionPicker(false);
    setUploading(false);
    setSubmitting(false);
    setModerationWarning(null);
  };

  const handleClose = () => {
    if (uploading) return;
    if (content.trim() || selectedMedia.length > 0) {
      if (Platform.OS === 'web') {
        resetForm();
        onClose();
        return;
      }
      Alert.alert(t('createPost.cancelTitle'), t('createPost.cancelMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: () => { resetForm(); onClose(); } },
        ]);
    } else {
      resetForm();
      onClose();
    }
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert(t('createPost.permissionGallery'));
        return;
      }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10 - selectedMedia.length,
    });
    if (result.canceled || !result.assets) return;
    const items: SelectedMedia[] = result.assets.map((a) => {
      const ext = a.uri.split('.').pop() ?? 'jpg';
      return {
        uri: a.uri,
        name: a.fileName ?? `media_${Date.now()}.${ext}`,
        type: a.type === 'video' ? `video/${ext}` : `image/${ext}`,
        mediaType: a.type === 'video' ? 'VIDEO' : 'IMAGE',
        file: (a as any).file,
      } as SelectedMedia;
    });
    setSelectedMedia((prev) => [...prev, ...items].slice(0, 10));
    setModerationWarning(null);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert(t('createPost.permissionCamera'));
        return;
      }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const ext = a.uri.split('.').pop() ?? 'jpg';
    setSelectedMedia((prev) => [...prev, {
      uri: a.uri,
      name: a.fileName ?? `photo_${Date.now()}.${ext}`,
      type: a.type === 'video' ? `video/${ext}` : `image/${ext}`,
      mediaType: a.type === 'video' ? 'VIDEO' : 'IMAGE',
      file: (a as any).file,
    } as SelectedMedia].slice(0, 10));
    setModerationWarning(null);
  };

  const removeMedia = (i: number) => {
    setSelectedMedia((prev) => prev.filter((_, idx) => idx !== i));
    setModerationWarning(null);
  };

  const canPost = (content.trim().length > 0 || selectedMedia.length > 0) && !submitting && !uploading;

  const handleSubmit = async () => {
    if (!canPost) return;
    setModerationWarning(null);
    setSubmitting(true);
    try {
      let mediaUrls: { url: string; type: string }[] = [];
      if (selectedMedia.length > 0) {
        setUploading(true);
        const uploaded = await uploadMediaToS3(
          selectedMedia.map((m) => ({ uri: m.uri, name: m.name, type: m.type, file: m.file }))
        );
        setUploading(false);
        // Giữ cả url và type để backend lưu đúng vào mediaList
        mediaUrls = uploaded.map((u) => ({ url: u.url, type: u.type }));
      }
      const emotionObj = emotion ? EMOTIONS.find(e => e.key === emotion) : null;
      const body: Record<string, unknown> = {
        content: content.trim() || undefined,
        emotion: emotionObj ? `${emotionObj.emoji} ${emotionObj.label}` : undefined,
        visibility,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      };
      const res: any = await postService.create(body);
      const created: Post = res?.data ?? res;
      onCreated?.(created);
      resetForm();
      onClose();
    } catch (e: any) {
      setUploading(false);
      const errPayload = e?.response?.data || e;
      const isPolicyViolation =
        errPayload?.code === 'CONTENT_POLICY_VIOLATION' ||
        Boolean(errPayload?.reasonCode) ||
        String(errPayload?.message || e?.message || '').toLowerCase().includes('vi pham');
      if (isPolicyViolation) {
        const detail = getViolationDetail(errPayload);
        setModerationWarning(detail);
        return;
      }
      Alert.alert(t('common.error'), e?.response?.data?.message ?? e?.message ?? t('createPost.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const privacy = PRIVACY_CONFIG[visibility];
  const isLoading = uploading || submitting;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* Backdrop */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={handleClose}
      >
        {/* Dialog box — bấm vào đây không đóng */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: Math.min(SCREEN_W - 32, 480) }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{
              backgroundColor: '#fff',
              borderRadius: 18,
              overflow: 'hidden',
              maxHeight: SCREEN_H * 0.85,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.2,
              shadowRadius: 24,
              elevation: 20,
            }}>
              {/* ── Header ── */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
                borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
              }}>
                <TouchableOpacity onPress={handleClose} disabled={uploading} style={{ padding: 4 }}>
                  <Ionicons name="close" size={21} color="#6b7280" />
                </TouchableOpacity>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{t('createPost.title')}</Text>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!canPost}
                  style={{
                    backgroundColor: canPost ? '#6d28d9' : '#e5e7eb',
                    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                  }}
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: canPost ? '#fff' : '#9ca3af', fontWeight: '700', fontSize: 14 }}>{t('createPost.post')}</Text>
                  }
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* ── Author + Privacy + Emotion ── */}
                {moderationWarning && (
                  <View style={{ marginHorizontal: 14, marginTop: 10, backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: '#b91c1c', fontSize: 12, fontWeight: '700', flex: 1 }}>
                        Cảnh báo vi phạm: {moderationWarning}
                      </Text>
                      <TouchableOpacity onPress={() => setModerationWarning(null)} style={{ marginLeft: 8, padding: 2 }}>
                        <Ionicons name="close" size={14} color="#b91c1c" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
                  <Image source={avatarSrc} style={{ width: 40, height: 40, borderRadius: 20 }} resizeMode="cover" />
                  <View>
                    <Text style={{ fontWeight: '700', fontSize: 14, color: '#111827', marginBottom: 4 }}>
                      {userName || t('commentSheet.you')}
                      {emotion ? (
                        <Text style={{ fontWeight: '400', color: '#6b7280', fontSize: 14 }}>
                          {' '}đang cảm thấy {EMOTIONS.find(e => e.key === emotion)?.emoji} {EMOTIONS.find(e => e.key === emotion)?.label}
                        </Text>
                      ) : null}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setShowPrivacyPicker((p) => !p)}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          backgroundColor: '#f3f4f6', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7,
                        }}
                      >
                        <Ionicons name={privacy.icon as any} size={12} color={privacy.color} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{privacy.label}</Text>
                        <Ionicons name="chevron-down" size={10} color="#9ca3af" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => { setShowEmotionPicker((p) => !p); setShowPrivacyPicker(false); }}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          backgroundColor: emotion ? '#fef3c7' : '#f3f4f6',
                          paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7,
                        }}
                      >
                        {emotion ? (
                          <Text style={{ fontSize: 13 }}>{EMOTIONS.find(e => e.key === emotion)?.emoji}</Text>
                        ) : (
                          <Ionicons name="happy-outline" size={12} color="#6b7280" />
                        )}
                        <Text style={{ fontSize: 12, fontWeight: '600', color: emotion ? '#92400e' : '#374151' }}>
                          {emotion ? EMOTIONS.find(e => e.key === emotion)?.label : t('createPost.emotion')}
                        </Text>
                        <Ionicons name="chevron-down" size={10} color="#9ca3af" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Emotion picker */}
                {showEmotionPicker && (
                  <View style={{ marginTop: 6, marginBottom: 2, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fde68a', overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6 }}>
                      {EMOTIONS.map((em) => (
                        <TouchableOpacity
                          key={em.key}
                          onPress={() => { setEmotion(em.key as EmotionKey); setShowEmotionPicker(false); }}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                            backgroundColor: emotion === em.key ? '#fde68a' : '#fff',
                            borderWidth: 1, borderColor: emotion === em.key ? '#f59e0b' : '#e5e7eb',
                          }}
                        >
                          {em.emoji ? <Text style={{ fontSize: 16 }}>{em.emoji}</Text> : null}
                          <Text style={{ fontSize: 12, fontWeight: '600', color: emotion === em.key ? '#92400e' : '#374151' }}>
                            {em.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Privacy picker */}
                {showPrivacyPicker && (
                  <View style={{ marginHorizontal: 14, marginBottom: 8, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' }}>
                    {(Object.keys(PRIVACY_CONFIG) as Visibility[]).map((key) => {
                      const cfg = PRIVACY_CONFIG[key];
                      const active = visibility === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => { setVisibility(key); setShowPrivacyPicker(false); }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: active ? '#ede9fe' : 'transparent' }}
                        >
                          <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                          <Text style={{ flex: 1, fontSize: 14, fontWeight: active ? '700' : '500', color: active ? cfg.color : '#374151' }}>{cfg.label}</Text>
                          {active && <Ionicons name="checkmark-circle" size={16} color={cfg.color} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* ── Text input ── */}
                <TextInput
                  value={content}
                  onChangeText={(value) => {
                    setContent(value);
                    if (moderationWarning) setModerationWarning(null);
                  }}
                  placeholder={t('createPost.contentPlaceholder')}
                  placeholderTextColor="#9ca3af"
                  multiline
                  style={{
                    fontSize: 15, lineHeight: 22, color: '#111827',
                    paddingHorizontal: 14, paddingVertical: 4, minHeight: 90,
                    textAlignVertical: 'top',
                  }}
                  editable={!isLoading}
                  maxLength={5000}
                  autoFocus
                />

                {/* ── Media preview ── */}
                {selectedMedia.length > 0 && (
                  <View style={{ paddingHorizontal: 12, marginTop: 6 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 6 }}>
                      {selectedMedia.map((m, i) => (
                        <View key={i} style={{ position: 'relative', marginRight: 6 }}>
                          <Image
                            source={{ uri: m.uri }}
                            style={{
                              width: selectedMedia.length === 1 ? 240 : 100,
                              height: selectedMedia.length === 1 ? 160 : 100,
                              borderRadius: 10,
                            }}
                            resizeMode="cover"
                          />
                          {m.mediaType === 'VIDEO' && (
                            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                              <Ionicons name="play-circle" size={28} color="#fff" />
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => removeMedia(i)}
                            style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Ionicons name="close" size={13} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Upload progress */}
                {uploading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10 }}>
                    <ActivityIndicator size="small" color="#6d28d9" />
                    <Text style={{ fontSize: 12, color: '#6d28d9' }}>{t('common.processing')}</Text>
                  </View>
                )}
              </ScrollView>

              {/* ── Toolbar ── */}
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                borderTopWidth: 1, borderTopColor: '#f0f0f0',
                paddingHorizontal: 10, paddingVertical: 8, gap: 2,
              }}>
                <Text style={{ fontSize: 12.5, color: '#9ca3af', flex: 1 }}>{t('createPost.addPhoto')}:</Text>

                {/* Chọn từ thư viện */}
                <TouchableOpacity
                  onPress={pickImages}
                  disabled={isLoading || selectedMedia.length >= 10}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
                    backgroundColor: '#f0fdf4',
                  }}
                >
                  <Ionicons name="images" size={19} color="#059669" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#059669' }}>{t('createPost.addPhoto')}</Text>
                </TouchableOpacity>

                {/* Chụp ảnh */}
                <TouchableOpacity
                  onPress={takePhoto}
                  disabled={isLoading || selectedMedia.length >= 10}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
                    backgroundColor: '#f5f3ff',
                  }}
                >
                  <Ionicons name="camera" size={19} color="#6d28d9" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6d28d9' }}>Camera</Text>
                </TouchableOpacity>

                {selectedMedia.length > 0 && (
                  <Text style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>{selectedMedia.length}/10</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}
