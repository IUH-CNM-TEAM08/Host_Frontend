import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@/src/contexts/user/UserContext';
import { validateAvatar } from '@/src/utils/ImageValidator';
import { postService, storyService } from '@/src/api/services/social.service';
import { Post, Story } from '@/src/models/Post';
import PostCard from '@/src/components/timeline/PostCard';
import { StoriesBar, PostTabBar, POST_TABS, PostTab } from '@/src/components/timeline/PostTabBar';
import CreatePostModal from '@/src/components/timeline/CreatePostModal';
import CreateStoryModal from '@/src/components/timeline/CreateStoryModal';
import StoryViewerModal from '@/src/components/timeline/StoryViewerModal';
import SocketService from '@/src/api/socketCompat';
import { mapApiPostToModel } from '@/src/models/mappers';


interface CreatePostBarProps {
  avatarSrc: any;
  onPress?: () => void;
  isDesktop?: boolean;
}

function CreatePostBar({ avatarSrc, onPress, isDesktop }: CreatePostBarProps) {
  // Trên mobile: ẩn avatar vì đã có ở shared header (layout)
  const showAvatar = isDesktop || Platform.OS === 'web';
  return (
    <View
      className={`bg-white ${
        isDesktop
          ? 'rounded-2xl border border-gray-100 shadow-sm mb-4'
          : 'border-b border-gray-100'
      }`}
    >
      {/* Row 1: avatar (desktop only on mobile) + input */}
      <View className="flex-row items-center gap-3 px-4 pt-3 pb-2">
        {showAvatar && (
          <Image
            source={avatarSrc}
            className="w-10 h-10 rounded-full border-2 border-[#6d28d9]/20"
            style={{ width: 40, height: 40 }}
            resizeMode="cover"
          />
        )}
        <TouchableOpacity
          onPress={onPress}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5"
          activeOpacity={0.7}
        >
          <Text className="text-gray-400 text-sm">Bạn đang nghĩ gì?</Text>
        </TouchableOpacity>
      </View>

      {/* Row 2: quick action buttons */}
      <View className="flex-row border-t border-gray-100 mx-2 mb-1">
        <TouchableOpacity
          onPress={onPress}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:bg-gray-50"
          activeOpacity={0.7}
        >
          <Ionicons name="images-outline" size={19} color="#059669" />
          <Text className="text-xs font-semibold text-gray-600">Ảnh/Video</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPress}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:bg-gray-50"
          activeOpacity={0.7}
        >
          <Ionicons name="camera-outline" size={19} color="#6d28d9" />
          <Text className="text-xs font-semibold text-gray-600">Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPress}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl active:bg-gray-50"
          activeOpacity={0.7}
        >
          <Ionicons name="happy-outline" size={19} color="#f59e0b" />
          <Text className="text-xs font-semibold text-gray-600">Cảm xúc</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


// ─── Empty / Error states ───────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Ionicons name="newspaper-outline" size={48} color="#d1d5db" />
      <Text className="text-gray-400 mt-3 text-base">Chưa có bài viết nào</Text>
      <Text className="text-gray-300 text-sm mt-1">Hãy kết bạn thêm hoặc tạo bài viết!</Text>
    </View>
  );
}

// ─── Main Timeline Component ────────────────────────────────────────────────

export default function TimelineFeed() {
  const { user } = useUser();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<any>({ uri: '' });
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createStoryVisible, setCreateStoryVisible] = useState(false);
  const [viewingStoryIndex, setViewingStoryIndex] = useState<number | null>(null);
  const [newPostCount, setNewPostCount] = useState(0);
  const socketService = useRef(SocketService.getInstance()).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    validateAvatar(user?.avatarURL || '').then(setAvatarSrc);
  }, [user?.avatarURL]);

  const fetchData = useCallback(async () => {
    try {
      const [postsRes, storiesRes] = await Promise.allSettled([
        postService.list<{ data: Post[] }>(0, 20),   // page=0 (0-based)
        storyService.listFriends<{ data: Story[] }>(),
      ]);

      if (postsRes.status === 'fulfilled') {
        const raw = postsRes.value as any;
        // getFeedPosts trả về { success, data: { items: [], total, ... } }
        // getAllActivePosts trả về { success, data: [...] }
        const dataPayload = raw?.data;
        let fetched: Post[] = [];
        if (Array.isArray(dataPayload)) {
          fetched = dataPayload;
        } else if (Array.isArray(dataPayload?.items)) {
          fetched = dataPayload.items;
        } else if (Array.isArray(raw)) {
          fetched = raw;
        }
        // Chỉ dùng mock khi chưa đăng nhập / lỗi thực sự — không fallback khi DB rỗng
        setPosts(fetched);
      } else {
        setPosts([]);
      }
      if (storiesRes.status === 'fulfilled') {
        const raw = storiesRes.value as any;
        const fetched = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        setStories(fetched);
      } else {
        setStories([]);
      }
    } catch (e) {
      // fallback to mock on error
      setPosts([]);
      setStories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Real-time new post từ bạn bè — prepend trực tiếp ───────────────────────────────
  useEffect(() => {
    const handleNewPost = (rawPost: any) => {
      if (rawPost?.authorId === user?.id || rawPost?.author?.id === user?.id) return;
      const mapped = mapApiPostToModel(rawPost);
      if (!mapped?.id) return;
      setPosts((prev) => {
        if (prev.some((p) => p.id === mapped.id)) return prev;
        return [mapped, ...prev];
      });
    };
    socketService.onNewPost(handleNewPost);
    return () => socketService.removeNewPostListener(handleNewPost);
  }, [socketService, user?.id]);


  const onRefresh = () => {
    setRefreshing(true);
    setNewPostCount(0);
    fetchData();
  };

  const handlePostCreated = (newPost: any) => {
    // newPost có thể là { data: Post } hoặc Post trực tiếp
    const post: Post = newPost?.data ?? newPost;
    if (post?.id || post?._id) {
      const normalized: Post = { ...post, id: post.id ?? (post as any)._id };
      setPosts((prev) => [normalized, ...prev.filter((p) => p.id !== normalized.id)]);
    } else {
      // Nếu API không trả về post đầy đủ, reload lại feed
      fetchData();
    }
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handlePostUpdated = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onDeleted={handlePostDeleted}
      onUpdated={handlePostUpdated}
    />
  );

  const handleStoryCreated = (story: Story) => {
    setStories(prev => [story, ...prev]);
  };

  const handleStoryDeleted = (storyId: string) => {
    setStories(prev => {
      const next = prev.filter(s => s.id !== storyId);
      if (next.length === 0) {
        setViewingStoryIndex(null);
      } else {
        setViewingStoryIndex(i => (i !== null ? Math.min(i, next.length - 1) : null));
      }
      return next;
    });
  };

  const feedHeader = (
    <View className="bg-gray-200">
      {/* Create post */}
      <CreatePostBar
        avatarSrc={avatarSrc}
        isDesktop={false}
        onPress={() => setCreateModalVisible(true)}
      />
      
      {/* Gap */}
      <View style={{ height: 8 }} />
      
      {/* Stories */}
      <StoriesBar
        stories={stories}
        ownAvatar={user?.avatarURL}
        onAddStory={() => setCreateStoryVisible(true)}
        onViewStory={(s) => {
          const idx = stories.findIndex(st => st.id === s.id);
          setViewingStoryIndex(idx >= 0 ? idx : 0);
        }}
      />
      
      {/* Gap before feed */}
      <View style={{ height: 8 }} />
    </View>
  );

  // ── Desktop Layout ──────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <View className="flex-1 bg-gray-200 items-center">
        <FlatList
          ref={flatListRef}
          className="w-full bg-gray-200"
          style={{ maxWidth: 800 }}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={feedHeader}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#6d28d9" />
            </View>
          ) : (
            <EmptyFeed />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />
          }
          contentContainerStyle={{ paddingBottom: 80 }}
        />

        <CreatePostModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onCreated={handlePostCreated}
          userAvatarURL={user?.avatarURL}
          userName={user?.displayName ?? user?.name}
        />

        <CreateStoryModal 
          visible={createStoryVisible}
          onClose={() => setCreateStoryVisible(false)}
          onCreated={handleStoryCreated}
        />

        <StoryViewerModal
          visible={viewingStoryIndex !== null}
          stories={stories}
          initialIndex={viewingStoryIndex ?? 0}
          onClose={() => setViewingStoryIndex(null)}
          onDeleted={handleStoryDeleted}
        />
      </View>
    );
  }

  // ── Mobile Layout ───────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-gray-200">
      {/* MainSearchHeader đã được xóa — shared header lo bởi _layout.tsx */}

      <FlatList
        ref={flatListRef}
        className="flex-1 bg-gray-200"
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        ListHeaderComponent={feedHeader}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator size="large" color="#6d28d9" />
          </View>
        ) : (
          <EmptyFeed />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* Create post modal */}
      <CreatePostModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreated={handlePostCreated}
        userAvatarURL={user?.avatarURL}
        userName={user?.displayName ?? user?.name}
      />

      {/* Create story modal */}
      <CreateStoryModal
        visible={createStoryVisible}
        onClose={() => setCreateStoryVisible(false)}
        onCreated={handleStoryCreated}
      />

      {/* View story modal */}
      <StoryViewerModal
        visible={viewingStoryIndex !== null}
        stories={stories}
        initialIndex={viewingStoryIndex ?? 0}
        onClose={() => setViewingStoryIndex(null)}
        onDeleted={handleStoryDeleted}
      />
    </View>
  );
}
