import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Story } from '@/src/models/Post';
import { API_URL } from '@/src/api/AxiosConfig';
import { validateAvatar } from '@/src/utils/ImageValidator';

const normalizeUrl = (rawUrl?: string | null): string | undefined => {
  const trimmed = rawUrl?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'default') return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;
  return `${API_URL}/${trimmed}`;
};

interface StoryBubbleProps {
  story: Story;
  isOwn?: boolean;
  onPress?: () => void;
}

function StoryBubble({ story, isOwn, onPress }: StoryBubbleProps) {
  const authorAvatar = normalizeUrl(story?.author?.avatarURL ?? story?.author?.avatarUrl ?? '');
  const mediaUri = normalizeUrl(story?.mediaURL ?? story?.mediaUrl) || '';
  const storyText = story?.caption ?? story?.content ?? '';
  const isTextStory = !mediaUri || (story?.mediaType ?? '').toLowerCase() === 'text';
  const [avatarSrc, setAvatarSrc] = useState<any>({ uri: authorAvatar || '' });

  useEffect(() => {
    setAvatarSrc(authorAvatar ? { uri: authorAvatar } : { uri: '' });
  }, [authorAvatar]);

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-xl overflow-hidden mr-3 relative ${isOwn ? '' : 'border border-gray-200'}`}
      style={{ width: 100, height: 160 }}
    >
      {isOwn ? (
        <Image
          source={avatarSrc}
          className="w-full h-full"
          resizeMode="cover"
        />
      ) : isTextStory ? (
        <View className="w-full h-full bg-[#eef2ff] p-3 justify-center items-center">
          <Text className="text-center text-xs font-semibold text-gray-900" numberOfLines={6}>
            {storyText || story?.author?.name || 'Khoảnh khắc'}
          </Text>
        </View>
      ) : (
        <View className="w-full h-full">
          <Image
            source={{ uri: mediaUri || avatarSrc.uri }}
            className="w-full h-full"
            resizeMode="cover"
          />
          <View
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
          />
        </View>
      )}

      <View className="absolute top-2 left-2 z-10">
        {!isOwn && (
          <View className={`w-9 h-9 rounded-full border-2 overflow-hidden bg-gray-200 ${story.viewed ? 'border-gray-300' : 'border-[#6d28d9]'}`}>
            {avatarSrc && (avatarSrc.uri || typeof avatarSrc === 'number' || typeof avatarSrc === 'string') ? (
              <Image
                source={avatarSrc}
                className="w-full h-full"
              />
            ) : (
              <Image
                source={{ uri: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y' }}
                className="w-full h-full"
              />
            )}
          </View>
        )}
      </View>

      <View className="absolute left-2 right-2 bottom-2 p-1">
        <Text
          numberOfLines={1}
          style={
            Platform.OS === 'web'
              ? ({ textShadow: '0px 1px 3px rgba(0,0,0,0.8)' } as any)
              : { textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }
          }
          className="text-xs text-white font-semibold z-10"
        >
          {isOwn ? 'Tạo tin' : story?.author?.name || 'Vô danh'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface StoriesBarProps {
  stories: Story[];
  ownAvatar?: string;
  onAddStory?: () => void;
  onViewStory?: (story: Story) => void;
}

export function StoriesBar({ stories, ownAvatar, onAddStory, onViewStory }: StoriesBarProps) {
  const [ownSrc, setOwnSrc] = useState<any>({ uri: ownAvatar || '' });

  useEffect(() => {
    validateAvatar(normalizeUrl(ownAvatar || '') || '').then(setOwnSrc);
  }, [ownAvatar]);

  // Fake "own" story slot
  const ownStory: Story = {
    id: '__own__',
    author: { id: '', name: 'Tạo tin', avatarURL: ownAvatar || '' },
    mediaURL: '',
    mediaType: 'image',
    viewed: true,
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };

  return (
    <View className="bg-white py-3">
      <Text className="text-[17px] font-bold text-gray-900 px-4 mb-3">Khoảnh khắc</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <StoryBubble story={ownStory} isOwn onPress={onAddStory} />
        {stories.map((s) => (
          <StoryBubble key={s.id} story={s} onPress={() => onViewStory?.(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Tab types ───────────────────────────────────────────────────────────────

export type PostTab = {
  key: string;
  label: string;
  icon: 'newspaper-outline' | 'people-outline' | 'bookmark-outline' | 'time-outline';
};

export const POST_TABS: PostTab[] = [
  { key: 'feed', label: 'Bảng tin', icon: 'newspaper-outline' },
  { key: 'friends', label: 'Bạn bè', icon: 'people-outline' },
  { key: 'saved', label: 'Đã lưu', icon: 'bookmark-outline' },
  { key: 'recent', label: 'Gần đây', icon: 'time-outline' },
];

interface PostTabBarProps {
  tabs: PostTab[];
  activeKey: string;
  onTabChange: (key: string) => void;
  isDesktop?: boolean;
}

export function PostTabBar({ tabs, activeKey, onTabChange, isDesktop }: PostTabBarProps) {
  if (isDesktop) {
    // Desktop: show all tabs as a pill row
    return (
      <View className="flex-row items-center gap-2 px-2 pb-3 pt-1">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onTabChange(tab.key)}
              className={`flex-row items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                active ? 'bg-[#6d28d9]' : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <Ionicons
                name={tab.icon}
                size={15}
                color={active ? '#fff' : '#6b7280'}
              />
              <Text
                className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-600'}`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Mobile: scrollable horizontal tabs
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      className="border-b border-gray-100 bg-white"
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            className={`flex-row items-center gap-1.5 px-4 py-1.5 rounded-full mr-2 ${
              active ? 'bg-[#6d28d9]' : 'bg-gray-100'
            }`}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={active ? '#fff' : '#6b7280'}
            />
            <Text
              className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-600'}`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
