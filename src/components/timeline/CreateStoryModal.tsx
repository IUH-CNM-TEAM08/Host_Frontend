import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Alert, Image, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { storyService } from '@/src/api/services/social.service';
import { uploadMediaToS3 } from '@/src/api/services/media.service';
import { Story } from '@/src/models/Post';

interface CreateStoryModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (story: Story) => void;
}

const VISIBILITY_OPTIONS = [
  { key: 'PUBLIC',  label: 'Công khai', icon: 'earth-outline',        color: '#059669' },
  { key: 'FRIENDS', label: 'Bạn bè',    icon: 'people-outline',       color: '#6d28d9' },
  { key: 'PRIVATE', label: 'Chỉ tôi',   icon: 'lock-closed-outline', color: '#6b7280' },
] as const;
type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE';

export default function CreateStoryModal({ visible, onClose, onCreated }: CreateStoryModalProps) {
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<any>(null);
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setMediaUri(null);
    setMediaFile(null);
    setCaption('');
    setVisibility('PUBLIC');
    setShowVisibilityPicker(false);
    onClose();
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Quyền truy cập bị từ chối', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'VIDEO' : 'IMAGE');
      if (Platform.OS === 'web') {
        setMediaFile((asset as any).file);
      }
    }
  };

  const handlePostStory = async () => {
    if (!mediaUri && !caption.trim()) return;
    setSubmitting(true);
    try {
      if (mediaUri) {
        // 1. Upload media
        const uploaded = await uploadMediaToS3([{
          uri: mediaUri,
          type: mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg',
          name: `story_${Date.now()}`,
          file: mediaFile,
        }]);

        if (!uploaded?.[0]?.url) throw new Error('Upload ảnh thất bại.');

        // 2. Create story media
        const res: any = await storyService.create({
          type: mediaType,
          mediaUrl: uploaded[0].url,
          caption: caption.trim() || undefined,
          visibility,
        });
        
        onCreated(res?.data ?? res);
      } else {
        // 2. Create text only story
        const res: any = await storyService.create({
          type: 'TEXT',
          caption: caption.trim(),
          visibility,
        });
        
        onCreated(res?.data ?? res);
      }
      handleClose();
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert(e?.response?.data?.message ?? e?.message ?? 'Đăng story thất bại');
      } else {
        Alert.alert('Lỗi', e?.response?.data?.message ?? e?.message ?? 'Đăng story thất bại');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? 'rgba(0,0,0,0.8)' : '#000', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ 
            width: '100%', 
            maxWidth: 480, 
            height: Platform.OS === 'web' ? '90%' : '100%', 
            maxHeight: 900,
            backgroundColor: '#000', 
            paddingTop: Platform.OS === 'ios' ? 44 : 24,
            borderRadius: Platform.OS === 'web' ? 20 : 0,
            overflow: 'hidden',
            flexDirection: 'column',
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
              <TouchableOpacity onPress={handleClose} disabled={submitting}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Tạo tin mới</Text>
              <View style={{ width: 28 }} />
            </View>

            {/* Media area */}
            <View style={{ flex: 1, backgroundColor: mediaUri ? '#000' : '#1f2937', justifyContent: 'center', alignItems: 'center' }}>
              {mediaUri ? (
                <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              ) : (
                <TouchableOpacity 
                  onPress={pickMedia}
                  style={{ alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#374151', borderRadius: 20 }}
                >
                  <Ionicons name="images" size={40} color="#9ca3af" />
                  <Text style={{ color: '#d1d5db', marginTop: 10, fontSize: 16 }}>Chọn ảnh hoặc video</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Caption + Footer — nằm dưới media, tránh bàn phím */}
            <View style={{ backgroundColor: '#111', paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 20 : 16 }}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Nhập nội dung khoảnh khắc..."
                placeholderTextColor="#9ca3af"
                style={{ color: '#fff', fontSize: 16, textAlign: 'center', minHeight: 44, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}
                multiline
                returnKeyType="done"
              />
              {/* Visibility + Share button */}
              {(mediaUri || caption.trim().length > 0) && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  {/* Visibility picker toggle */}
                  <TouchableOpacity
                    onPress={() => setShowVisibilityPicker(p => !p)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 }}
                  >
                    <Ionicons
                      name={VISIBILITY_OPTIONS.find(v => v.key === visibility)?.icon as any}
                      size={14}
                      color={VISIBILITY_OPTIONS.find(v => v.key === visibility)?.color}
                    />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                      {VISIBILITY_OPTIONS.find(v => v.key === visibility)?.label}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>

                  {showVisibilityPicker && (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden' }}>
                      {VISIBILITY_OPTIONS.map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          onPress={() => { setVisibility(opt.key); setShowVisibilityPicker(false); }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: visibility === opt.key ? 'rgba(255,255,255,0.12)' : 'transparent' }}
                        >
                          <Ionicons name={opt.icon as any} size={16} color={opt.color} />
                          <Text style={{ color: '#fff', fontSize: 14, fontWeight: visibility === opt.key ? '700' : '400' }}>{opt.label}</Text>
                          {visibility === opt.key && <Ionicons name="checkmark" size={16} color="#fff" style={{ marginLeft: 'auto' }} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={handlePostStory}
                    disabled={submitting}
                    style={{ backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 24, alignItems: 'center', opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Chia sẻ</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
