import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  Animated,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { postService } from '@/src/api/services/social.service';
import { uploadMediaToS3 } from '@/src/api/services/media.service';
import { Post } from '@/src/models/Post';
import { useTranslation } from '@/src/contexts/i18n/I18nContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PostActionMenuProps {
  post: Post;
  currentUserId?: string;
  onDeleted?: (postId: string) => void;
  onUpdated?: (post: Post) => void;
}

type EditableMediaItem = {
  id: string;
  url: string;
  type: 'image' | 'video';
  isNew?: boolean;
  name?: string;
  mimeType?: string;
  file?: any;
};

export default function PostActionMenu({
  post,
  currentUserId,
  onDeleted,
  onUpdated,
}: PostActionMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editContent, setEditContent] = useState(post.content ?? '');
  const [editMedia, setEditMedia] = useState<EditableMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const editSlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const { t } = useTranslation();

  const postId = post.id || (post as any)._id || '';
  const postAuthorId = post.author?.id ?? post.authorId ?? '';
  const isOwner = !!(currentUserId && postAuthorId && currentUserId.trim() === postAuthorId.trim());
  const showOwnerActions = isOwner || !currentUserId;

  const getEditableMedia = (sourcePost: Post): EditableMediaItem[] => {
    const source = Array.isArray(sourcePost.media) && sourcePost.media.length > 0
      ? sourcePost.media
      : Array.isArray(sourcePost.mediaList)
        ? sourcePost.mediaList
        : [];

    return source
      .filter((item: any) => typeof item?.url === 'string' && item.url.trim())
      .map((item: any, idx: number) => ({
        id: `existing-${idx}-${item.url}`,
        url: item.url,
        type: String(item.type || 'IMAGE').toLowerCase() === 'video' ? 'video' : 'image',
      }));
  };

  const removeMediaItem = (id: string) => setEditMedia((prev) => prev.filter((item) => item.id !== id));

  const pickMedia = async () => {
    if (loading || editMedia.length >= 10) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('postAction.needPhotoPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: Math.max(1, 10 - editMedia.length),
    });

    if (result.canceled || !result.assets) return;

    const added = result.assets.map((asset) => {
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const assetType = asset.type === 'video' ? 'video' : 'image';
      return {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        url: asset.uri,
        type: assetType,
        isNew: true,
        name: (asset as any).fileName ?? `media_${Date.now()}.${ext}`,
        mimeType: asset.mimeType ?? (assetType === 'video' ? `video/${ext}` : `image/${ext}`),
        file: (asset as any).file,
      } as EditableMediaItem;
    });

    setEditMedia((prev) => [...prev, ...added].slice(0, 10));
  };

  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 12,
    }).start();
  };

  const closeMenu = (cb?: () => void) => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true,
    }).start(() => { setMenuVisible(false); cb?.(); });
  };

  const openEdit = () => {
    setEditContent(post.content ?? '');
    setEditMedia(getEditableMedia(post));
    closeMenu(() => {
      setEditVisible(true);
      Animated.spring(editSlide, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 12,
      }).start();
    });
  };

  const closeEdit = () => {
    Animated.timing(editSlide, {
      toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true,
    }).start(() => setEditVisible(false));
  };

  const handleDelete = () => {
    closeMenu(async () => {
      // Trên Web, Alert.alert có thể không kích hoạt đúng callback của nút Xóa
      if (Platform.OS === 'web') {
        if (window.confirm(t('postAction.confirmDeleteTitle') + '? ' + t('postAction.confirmDeleteMessage'))) {
          executeDelete();
        }
      } else {
        Alert.alert(t('postAction.confirmDeleteTitle'), t('postAction.confirmDeleteMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: executeDelete },
        ]);
      }
    });
  };

  const executeDelete = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      await postService.delete(postId);
      onDeleted?.(postId);
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(e?.response?.data?.message ?? t('postAction.deleteError'));
      } else {
        Alert.alert(t('common.error'), e?.response?.data?.message ?? t('postAction.deleteError'));
      }
    } finally {
      setLoading(false);
    }
  };


  // ── Submit edit ──
  const canSubmitEdit = editContent.trim().length > 0 || editMedia.length > 0;

  const submitEdit = async () => {
    if (!canSubmitEdit || !postId) return;
    setLoading(true);
    try {
      const newMediaItems = editMedia.filter((item) => item.isNew);
      let uploadedMedia: Array<{ url: string; type: 'IMAGE' | 'VIDEO' }> = [];

      if (newMediaItems.length > 0) {
        const uploaded = await uploadMediaToS3(
          newMediaItems.map((item) => ({
            uri: item.url,
            name: item.name ?? `media_${Date.now()}`,
            type: item.mimeType ?? (item.type === 'video' ? 'video/mp4' : 'image/jpeg'),
            file: item.file,
          }))
        );
        uploadedMedia = uploaded.map((item) => ({ url: item.url, type: item.type }));
      }

      let uploadIndex = 0;
      const mediaUrls = editMedia.map((item) => {
        if (item.isNew) {
          const upload = uploadedMedia[uploadIndex++]!
          return { url: upload.url, type: upload.type };
        }
        return { url: item.url, type: item.type === 'video' ? 'VIDEO' : 'IMAGE' };
      });

      const body: Record<string, unknown> = {
        content: editContent.trim(),
        mediaUrls,
      };

      await postService.update(postId, body);

      const normalizedMedia = mediaUrls.map((media) => ({
        url: media.url,
        type: (media.type || 'IMAGE').toLowerCase() === 'video' ? 'video' : 'image',
      }));

      onUpdated?.({
        ...post,
        content: editContent.trim(),
        media: normalizedMedia,
        mediaList: mediaUrls,
      });
      closeEdit();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('postAction.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleReport = () => {
    closeMenu(() => {
      Alert.prompt?.(
        t('postAction.reportTitle'),
        t('postAction.reportReasonPrompt'),
        async (reason) => {
          if (reason === undefined) return; // cancel
          if (!postId) return;
          try {
            await postService.report(postId, reason ?? '');
            Alert.alert(t('postAction.reportedTitle'), t('postAction.reportedMessage'));
          } catch {
            Alert.alert(t('common.error'), t('postAction.reportError'));
          }
        },
        'plain-text',
        '',
      ) ?? (async () => {
        // Fallback cho Android (Alert.prompt không có)
        try {
          await postService.report(postId, '');
          Alert.alert(t('postAction.reportedTitle'), t('postAction.reportedMessage'));
        } catch {
          Alert.alert(t('common.error'), t('postAction.reportError'));
        }
      })();
    });
  };

  return (
    <>
      {/* Trigger: nút ··· */}
      <TouchableOpacity
        onPress={openMenu}
        style={{
          width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
          borderRadius: 16, backgroundColor: '#f3f4f6',
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#6d28d9" />
        ) : (
          <Ionicons name="ellipsis-horizontal" size={18} color="#6b7280" />
        )}
      </TouchableOpacity>

      {/* ── Action bottom sheet ── */}
      <Modal visible={menuVisible} transparent animationType="none" onRequestClose={() => closeMenu()}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
          onPress={() => closeMenu()}
        />
        <Animated.View
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: '#fff',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingBottom: 34,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginVertical: 10 }} />

          {showOwnerActions ? (
            <>
              <ActionRow icon="pencil-outline" label={t('postAction.editPost')} color="#6d28d9" onPress={openEdit} />
              <ActionRow icon="trash-outline" label={t('postAction.deletePost')} color="#dc2626" onPress={handleDelete} />
              <View style={{ height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 20, marginVertical: 4 }} />
              <ActionRow icon="flag-outline" label={t('postAction.reportTitle')} color="#f59e0b" onPress={handleReport} />
            </>
          ) : (
            <ActionRow icon="flag-outline" label={t('postAction.reportTitle')} color="#dc2626" onPress={handleReport} />
          )}
          <ActionRow icon="close-outline" label={t('common.close')} color="#6b7280" onPress={() => closeMenu()} />
        </Animated.View>
      </Modal>

      {/* ── Edit bottom sheet ── */}
      <Modal visible={editVisible} transparent animationType="none" onRequestClose={closeEdit}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => !loading && closeEdit()} />
        <Animated.View
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: '#fff',
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingBottom: 34, paddingHorizontal: 16, paddingTop: 8,
            transform: [{ translateY: editSlide }],
          }}
        >
          <View style={{ width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 14 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>{t('postAction.editPost')}</Text>
          <TextInput
            value={editContent}
            onChangeText={setEditContent}
            placeholder={t('postAction.contentPlaceholder')}
            placeholderTextColor="#9ca3af"
            multiline
            style={{
              fontSize: 15, color: '#111827', minHeight: 100, maxHeight: 200,
              borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
              padding: 12, textAlignVertical: 'top', backgroundColor: '#f9fafb',
              marginBottom: 12,
            }}
            editable={!loading}
            autoFocus
          />

          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{t('postAction.media')}</Text>
              <TouchableOpacity onPress={pickMedia} disabled={loading || editMedia.length >= 10} style={{ padding: 6 }}>
                <Text style={{ color: '#6d28d9', fontWeight: '700' }}>
                  {editMedia.length < 10 ? t('postAction.add') : t('postAction.full')}
                </Text>
              </TouchableOpacity>
            </View>
            {editMedia.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {editMedia.map((item) => (
                  <View key={item.id} style={{ width: 100, height: 100, marginRight: 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' }}>
                        <Ionicons name="play-circle" size={28} color="#fff" />
                        <Text style={{ fontSize: 11, color: '#fff', marginTop: 6 }}>{t('postAction.video')}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => removeMediaItem(item.id)}
                      style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('postAction.noMedia')}</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={closeEdit}
              disabled={loading}
              style={{
                flex: 1, paddingVertical: 12, borderRadius: 12,
                borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#6b7280' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submitEdit}
              disabled={loading || !canSubmitEdit}
              style={{
                flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
                backgroundColor: loading || !canSubmitEdit ? '#ddd6fe' : '#6d28d9',
              }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{t('postAction.saveChanges')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

function ActionRow({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13,
      }}
      activeOpacity={0.65}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '500', color: '#111827' }}>{label}</Text>
    </TouchableOpacity>
  );
}
