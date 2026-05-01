import {
  Href,
  Link,
  Redirect,
  Stack,
  usePathname,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import ProfileModal from "@/app/(main)/profileUser";
import { validateAvatar } from "@/src/utils/ImageValidator";
import { useUser } from "@/src/contexts/user/UserContext";
import { TabBarProvider, useTabBar } from "@/src/contexts/TabBarContext";
import WebMusicShortcut from "@/src/components/main/WebMusicShortcut";
import FriendNotificationToast from "@/src/components/main/FriendNotificationToast";
import { ActiveCallProvider } from "@/src/contexts/ActiveCallContext";
import InAppCallOverlay from "@/src/components/call/InAppCallOverlay";
import SocketService from "@/src/api/socketCompat";
import { friendshipService } from "@/src/api/services/friendship.service";
import { MobileHeaderProvider, useMobileHeader } from "@/src/contexts/MobileHeaderContext";
import { useNotifications } from "@/src/contexts/NotificationContext";
import NotificationDrawer from "@/src/components/main/NotificationDrawer";
import SocialNotificationToast from "@/src/components/main/SocialNotificationToast";
import FeatureGuideBot from "@/src/components/ui/FeatureGuideBot";
import WhatsNewModal from "@/src/components/ui/WhatsNewModal";
import { useGuide } from "@/src/contexts/GuideContext";
import { useTranslation } from "@/src/contexts/i18n/I18nContext";
import { LiveRoomProvider, useLiveRoom } from "@/src/contexts/LiveRoomContext";
import { Platform as RNPlatform } from "react-native";
const LIVEKIT_URL = 'wss://livestream-zala-8almwmwe.livekit.cloud';

let LiveKitRoomComponent: any = ({ children }: { children: React.ReactNode }) => <>{children}</>;
let RoomAudioRendererComponent: any = () => null;
let VideoTrackComponent: any = () => null;
let useTracksHook: any = () => [];
let useLocalParticipantHook: any = () => ({ localParticipant: null });

if (RNPlatform.OS === 'web') {
  try {
    const livekit = require('@livekit/components-react');
    LiveKitRoomComponent = livekit.LiveKitRoom;
    RoomAudioRendererComponent = livekit.RoomAudioRenderer;
    VideoTrackComponent = livekit.VideoTrack;
    useTracksHook = livekit.useTracks;
    useLocalParticipantHook = livekit.useLocalParticipant;
    require('@livekit/components-styles');
  } catch (error) {
    console.warn('[LiveKit] Web components unavailable:', error);
  }
}

type Route = {
  name: string;
  title: string;
  icon:
  | "chatbubbles-outline"
  | "people-outline"
  | "game-controller-outline"
  | "musical-notes-outline"
  | "newspaper-outline"
  | "notifications-outline"
  | "compass-outline"
  | "videocam-outline"
  | "settings-outline";
};

const desktopRoutes: Route[] = [
  { name: "index", title: "nav.messages", icon: "chatbubbles-outline" },
  { name: "contacts", title: "nav.contacts", icon: "people-outline" },
  { name: "notifications", title: "nav.notifications", icon: "notifications-outline" },
  { name: "games", title: "nav.games", icon: "game-controller-outline" },
  { name: "music", title: "nav.music", icon: "musical-notes-outline" },
  { name: "live", title: "nav.live", icon: "videocam-outline" },
  { name: "timeline", title: "nav.timeline", icon: "newspaper-outline" },
  { name: "settings", title: "nav.settings", icon: "settings-outline" },
];

const mobileRoutes: Route[] = [
  { name: "index", title: "nav.messages", icon: "chatbubbles-outline" },
  { name: "contacts", title: "nav.contacts", icon: "people-outline" },
  { name: "timeline", title: "nav.timeline", icon: "newspaper-outline" },
  { name: "live", title: "nav.live", icon: "videocam-outline" },
  { name: "discovery", title: "nav.discovery", icon: "compass-outline" },
];

/** Tiêu đề hiển thị trên shared header theo tab đang active */
function getMobileTabTitle(pathname: string, routes: Route[], t: (key: string) => string): string {
  for (const r of routes) {
    if (r.name === 'index' && (pathname === '/' || pathname === '/index')) return t(r.title);
    if (r.name !== 'index' && (pathname === `/${r.name}` || pathname === `/(main)/${r.name}`)) return t(r.title);
  }
  return 'Zala';
}

/**
 * Shared mobile header — Zalo-style:
 * [  🟣 Zala  <tab-title>  ]  [ + ]  [ QR ]
 *
 * - Không có avatar (thiết kế hiện đại: logo/brand bên trái, action icons bên phải)
 * - Search bar thu gọn: placeholder, hiện thị nội dung lọc theo tab active
 */
function MobileHeader({ tabTitle, onBellPress }: { tabTitle: string; onBellPress: () => void }) {
  const { searchQuery, setSearchQuery, showQRScanner, setShowQRScanner } = useMobileHeader();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      style={{
        backgroundColor: '#fff',
        paddingTop: insets.top + 2,
        paddingBottom: 6,
        paddingHorizontal: 14,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        zIndex: 50,
      }}
    >
      {/* Hàng 1: Brand + Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {/* Logo wordmark */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Image
            source={require('@/resources/assets/zala.png')}
            style={{ width: 30, height: 30, borderRadius: 8, marginRight: 8 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#6d28d9', letterSpacing: -0.5 }}>
            {tabTitle}
          </Text>
        </View>

        {/* Action icons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {/* Bell icon */}
          <TouchableOpacity
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: '#f3f4f6',
              alignItems: 'center', justifyContent: 'center',
            }}
            onPress={onBellPress}
          >
            <Ionicons name="notifications-outline" size={20} color="#374151" />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute', top: 4, right: 4,
                minWidth: 14, height: 14, borderRadius: 7,
                backgroundColor: '#ef4444',
                alignItems: 'center', justifyContent: 'center',
                paddingHorizontal: 2, borderWidth: 1.5, borderColor: '#f3f4f6',
              }}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* QR Scanner */}
          <TouchableOpacity
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: '#f3f4f6',
              alignItems: 'center', justifyContent: 'center',
            }}
            onPress={() => setShowQRScanner(!showQRScanner)}
          >
            <Ionicons name="qr-code-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hàng 2: Search bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 36,
        borderWidth: 1,
        borderColor: '#e9eaec',
      }}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" />
        <TextInput
          style={{
            flex: 1,
            marginLeft: 6,
            fontSize: 14,
            color: '#111827',
            paddingVertical: 0,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } as any : {}),
          }}
          placeholder={t('nav.searchPlaceholder')}
          placeholderTextColor="#b0b3ba"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/** Inner component nằm bên trong MobileHeaderProvider để dùng context */
function MobileSection({ pathname }: { pathname: string }) {
  const { setSearchQuery, isHeaderVisible } = useMobileHeader();
  const [showNotif, setShowNotif] = useState(false);
  const { t } = useTranslation();

  // Reset search khi chuyển tab
  useEffect(() => {
    setSearchQuery('');
  }, [pathname]);

  return (
    <View style={{ flex: 1 }}>
      {isHeaderVisible && (
        <MobileHeader
          tabTitle={getMobileTabTitle(pathname, mobileRoutes, t)}
          onBellPress={() => setShowNotif(true)}
        />
      )}
      {/* Stack phải nằm trong vùng flex còn lại — không bọc thì màn con (Tin nhắn) không có chiều cao, ScrollView/FlatList không cuộn */}
      <View style={{ flex: 1, minHeight: 0 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { flex: 1 },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="contacts" />
            <Stack.Screen name="timeline" />
            <Stack.Screen name="live" />
            <Stack.Screen name="discovery" />
            <Stack.Screen name="games" />
            <Stack.Screen name="music" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="wallet" />
            <Stack.Screen
              name="profileUser"
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </Stack>
      </View>
      {/* Render drawer ở root level — Modal sẽ hiển fullscreen đúng */}
      <NotificationDrawer visible={showNotif} onClose={() => setShowNotif(false)} />
    </View>
  );
}

export default function AppLayout() {
  return (
    <LiveRoomProvider>
      <ActiveCallProvider>
        <AppContent />
      </ActiveCallProvider>
    </LiveRoomProvider>
  );
}

function AppContent() {
  const { user, isLoading, logout } = useUser();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [avatar, setAvatar] = useState<ImageSourcePropType>({ uri: "" });
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [isGuideButtonCompact, setIsGuideButtonCompact] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const routes = isDesktop ? desktopRoutes : mobileRoutes;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { isVisible: isTabBarVisible } = useTabBar();
  const { startBot, isActive: isGuideActive } = useGuide();
  const { t } = useTranslation();
  const { token, activeRoom } = useLiveRoom();

  const handleStartGuide = () => {
    startBot(isDesktop ? [
      { id: 'tab-index', title: t('nav.messages'), steps: [{ targetId: 'sidebar-index', text: t('nav.guideDesktopMessages') }] },
      { id: 'tab-contacts', title: t('nav.contacts'), steps: [{ targetId: 'sidebar-contacts', text: t('nav.guideDesktopContacts') }] },
      { id: 'tab-notifications', title: t('nav.notifications'), steps: [{ targetId: 'sidebar-notifications', text: t('nav.guideDesktopNotifications') }] },
      { id: 'tab-games', title: t('nav.games'), steps: [{ targetId: 'sidebar-games', text: t('nav.guideDesktopGames') }] },
      { id: 'tab-music', title: t('nav.music'), steps: [{ targetId: 'sidebar-music', text: t('nav.guideDesktopMusic') }] },
      { id: 'tab-timeline', title: t('nav.timeline'), steps: [{ targetId: 'sidebar-timeline', text: t('nav.guideDesktopTimeline') }] },
      { id: 'tab-settings', title: t('nav.settings'), steps: [{ targetId: 'sidebar-settings', text: t('nav.guideDesktopSettings') }] },
    ] : [
      { id: 'tab-index', title: t('nav.messages'), steps: [{ targetId: 'sidebar-index', text: t('nav.guideMobileMessages') }] },
      { id: 'tab-contacts', title: t('nav.contacts'), steps: [{ targetId: 'sidebar-contacts', text: t('nav.guideMobileContacts') }] },
      { id: 'tab-timeline', title: t('nav.timeline'), steps: [{ targetId: 'sidebar-timeline', text: t('nav.guideMobileTimeline') }] },
      { id: 'tab-live', title: t('nav.live'), steps: [{ targetId: 'sidebar-live', text: 'Đây là tab Live Stream' }] },
      { id: 'tab-discovery', title: t('nav.discovery'), steps: [{ targetId: 'sidebar-discovery', text: t('nav.guideMobileDiscovery') }] },
    ]);
  };

  // Load pending requests count
  const loadPendingCount = async () => {
    try {
      const res: any = await friendshipService.listIncomingPending();
      const arr = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setPendingRequestCount(arr.length);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!user) return;
    loadPendingCount();
    const socket = SocketService.getInstance();
    const handleNewRequest = () => setPendingRequestCount(c => c + 1);
    const handleAccepted = () => setPendingRequestCount(c => Math.max(0, c - 1));
    const handleDeclined = () => setPendingRequestCount(c => Math.max(0, c - 1));
    socket.onFriendRequest(handleNewRequest);
    socket.onFriendRequestAccepted(handleAccepted);
    socket.onDeleteFriendRequest(handleDeclined);

    const handleGroupInviteDeclinedGlobal = (payload: any) => {
      if (payload?.declinerName) {
        Alert.alert(t('nav.inviteDeclinedTitle'), `${payload.declinerName} ${t('nav.inviteDeclinedMessage')}\n\n${t('nav.reason')}: ${payload.reason || t('nav.noReason')}`);
      }
    };
    socket.onGroupInviteDeclined?.(handleGroupInviteDeclinedGlobal);

    return () => {
      socket.removeFriendRequestListener(handleNewRequest);
      socket.removeFriendRequestAcceptedListener(handleAccepted);
      socket.removeFriendRequestActionListener(handleDeclined);
      socket.removeGroupInviteDeclinedListener?.(handleGroupInviteDeclinedGlobal);
    };
  }, [user?.id]);

  useEffect(() => {
    if (pathname === '/contacts' || pathname === '/(main)/contacts') {
      loadPendingCount();
    }
  }, [pathname]);

  const isActive = (routeName: string) => {
    if (routeName === "index") {
      return pathname === "/" || pathname === "/index";
    }
    // Check if the routeName is part of the pathname
    return pathname === `/${routeName}` || pathname.startsWith(`/${routeName}/`) || pathname === `/(main)/${routeName}`;
  };

  const getHref = (routeName: string) => {
    if (routeName === "index") return "/";
    return `/${routeName}` as Href;
  };

  useEffect(() => {
    validateAvatar(user?.avatarURL || "").then((validatedAvatar) => {
      setAvatar(validatedAvatar);
    });
  }, [user?.avatarURL]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-base text-[#6d28d9]">{t('common.loading')}</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  const mainUI = (
    <View className="flex-1" style={{ flex: 1, height: '100%', width: '100%' }}>
      <View className="flex-1 flex-row" style={{ flex: 1, height: '100%', width: '100%' }}>
        {isDesktop && (
          <View
            className="w-20 bg-[#EAEAEA] items-center border-r border-gray-300"
            style={{ paddingTop: insets.top + 16 }}
          >
            <View className="flex-1 flex-col items-center justify-between">
              <View>
                <TouchableOpacity
                  className="relative mb-6"
                  onPress={() => {
                    setProfileModalVisible(true);
                  }}
                >
                  <Image
                    source={avatar}
                    resizeMode="cover"
                    className="w-12 h-12 rounded-full border-2 border-[#6d28d9]"
                    style={{ width: 48, height: 48 }}
                  />
                  <View className="absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white" />
                </TouchableOpacity>

                <View className="w-4/5 h-px bg-gray-300 mb-6" />

                {routes.map((route) => {
                  const active = isActive(route.name);
                  const isContacts = route.name === 'contacts';
                  const isNotifications = route.name === 'notifications';

                  const content = (
                    <View
                      key={route.name}
                      className="flex flex-col items-center justify-center py-2"
                      {...({ dataSet: { guide: `sidebar-${route.name}` } } as any)}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: active || (isNotifications && showNotif) ? "#6d28d9" : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                          position: 'relative',
                        }}
                        className={active || (isNotifications && showNotif) ? "" : "hover:bg-gray-100"}
                      >
                        <Ionicons
                          name={route.icon}
                          size={22}
                          color={active || (isNotifications && showNotif) ? "#fff" : "#4B5563"}
                        />
                        {isNotifications && unreadCount > 0 && (
                          <View style={{
                            position: 'absolute', top: -2, right: -2,
                            minWidth: 18, height: 18, borderRadius: 9,
                            backgroundColor: '#EF4444',
                            alignItems: 'center', justifyContent: 'center',
                            paddingHorizontal: 3, borderWidth: 2, borderColor: '#fff',
                          }}>
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '800', lineHeight: 13 }}>
                              {unreadCount > 99 ? '99+' : String(unreadCount)}
                            </Text>
                          </View>
                        )}
                        {isContacts && pendingRequestCount > 0 && (
                          <View style={{
                            position: 'absolute', top: -2, right: -2,
                            minWidth: 18, height: 18, borderRadius: 9,
                            backgroundColor: '#EF4444',
                            alignItems: 'center', justifyContent: 'center',
                            paddingHorizontal: 3, borderWidth: 2, borderColor: '#fff',
                          }}>
                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '800', lineHeight: 13 }}>
                              {pendingRequestCount > 99 ? '99+' : pendingRequestCount}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );

                  if (isNotifications) {
                    return (
                      <TouchableOpacity key={route.name} onPress={() => setShowNotif(!showNotif)}>
                        {content}
                      </TouchableOpacity>
                    );
                  }

                  return (
                    <Link href={getHref(route.name)} asChild key={route.name}>
                      <TouchableOpacity>
                        {content}
                      </TouchableOpacity>
                    </Link>
                  );
                })}
              </View>
              <View className="flex flex-col items-center justify-center py-4 relative" {...({ dataSet: { guide: 'sidebar-logout' } } as any)}>
                {/* What's New button */}
                <TouchableOpacity
                  className="p-3 rounded-xl bg-transparent hover:bg-purple-100 transition-colors duration-200 mb-1"
                  onPress={() => setShowWhatsNew(true)}
                  style={{ alignItems: 'center' }}
                >
                  <Ionicons name="information-circle-outline" size={24} color="#7c3aed" />
                </TouchableOpacity>

                {/* Admin Panel shortcut — only for ADMIN role */}
                {user?.role === 'ADMIN' && (
                  <TouchableOpacity
                    className="p-3 rounded-xl bg-transparent hover:bg-purple-100 transition-colors duration-200 mb-1"
                    onPress={() => router.replace('/admin')}
                    style={{ alignItems: 'center' }}
                  >
                    <Ionicons name="shield-checkmark-outline" size={24} color="#7C3AED" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  className="p-3 rounded-xl bg-transparent hover:bg-gray-200 transition-colors duration-200"
                  onPress={async () => {
                    try {
                      await logout();
                      router.replace("/(auth)");
                    } catch (error) {
                      console.error("Error during logout:", error);
                    }
                  }}
                >
                  <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {!isDesktop && (
          <MobileHeaderProvider>
            <MobileSection pathname={pathname} />
          </MobileHeaderProvider>
        )}

        {isDesktop && (
          <View className="flex-1">
            <View className="flex-1 bg-white">
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: {
                    backgroundColor: "transparent",
                  },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="contacts" />
                <Stack.Screen name="timeline" />
                <Stack.Screen name="live" />
                <Stack.Screen name="games" />
                <Stack.Screen name="music" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="wallet" />
                <Stack.Screen
                  name="profileUser"
                  options={{
                    presentation: 'transparentModal',
                    animation: 'fade',
                    contentStyle: { backgroundColor: 'transparent' },
                  }}
                />
              </Stack>
            </View>
          </View>
        )}

        {!isDesktop && isTabBarVisible && (
          <View
            className="absolute bottom-0 left-0 right-0 flex-row bg-white border-t border-[#6d28d9]"
            style={{
              paddingBottom: insets.bottom,
              height: 60 + insets.bottom,
              zIndex: 100,
              elevation: 8,
            }}
          >
            {routes.map((route) => {
              const active = isActive(route.name);
              return (
                <TouchableOpacity
                  key={route.name}
                  onPress={() => {
                    router.replace(getHref(route.name));
                  }}
                  className={`flex-1 h-full justify-center items-center`}
                >
                  <View className="items-center">
                    <View
                      className={`p-2 rounded-lg ${active ? "bg-[#6d28d9]/10" : ""}`}
                    >
                      <Ionicons
                        name={route.icon}
                        size={21}
                        color={active ? "#6d28d9" : "#6B7280"}
                      />
                    </View>
                    <Text
                      className={`text-xs mt-1 font-medium ${active ? "text-[#6d28d9]" : "text-gray-500"
                        }`}
                    >
                      {t(route.title)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              className="flex-1 h-full justify-center items-center"
              onPress={() => {
                router.replace(getHref("settings"));
              }}
            >
              <View className="items-center">
                <View style={{ position: 'relative' }}>
                  <Image
                    source={avatar}
                    resizeMode="cover"
                    className="w-8 h-8 rounded-full border-2 border-[#6d28d9]"
                    style={{ width: 32, height: 32 }}
                  />
                  {unreadCount > 0 && (
                    <View style={{
                      position: 'absolute', top: -3, right: -5,
                      minWidth: 15, height: 15, borderRadius: 8,
                      backgroundColor: '#EF4444',
                      alignItems: 'center', justifyContent: 'center',
                      paddingHorizontal: 2, borderWidth: 1.5, borderColor: '#fff',
                    }}>
                      <Text style={{ color: 'white', fontSize: 8, fontWeight: '800' }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs mt-1 font-medium text-gray-500">
                  {t('nav.account')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <ProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
        />
            {(pathname.startsWith('/(main)') || pathname === '/') && (
              <ProfileModal
                visible={profileModalVisible}
                onClose={() => setProfileModalVisible(false)}
              />
            )}

        {Platform.OS === "web" && isDesktop ? <WebMusicShortcut /> : null}
        {Platform.OS === "web" && isDesktop ? <FriendNotificationToast /> : null}
        <SocialNotificationToast />
        {Platform.OS === "web" && isDesktop && (
          <NotificationDrawer visible={showNotif} onClose={() => setShowNotif(false)} />
        )}

        {Platform.OS === "web" && !isGuideActive && (
          <View
            style={{
              position: 'absolute',
              bottom: 24,
              right: 24,
              zIndex: 999,
              alignItems: 'flex-end',
              gap: 10,
            }}
          >
            {/* What's New floating button — mobile web only */}
            {!isDesktop && (
              <TouchableOpacity
                onPress={() => setShowWhatsNew(true)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: '#7c3aed',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#7c3aed',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  elevation: 5,
                }}
              >
                <Ionicons name="information-circle-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            {!isGuideButtonCompact && (
              <TouchableOpacity
                onPress={() => setIsGuideButtonCompact(true)}
                style={{
                  position: 'absolute',
                  left: -14,
                  top: 7,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: 'rgba(17, 24, 39, 0.72)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <Ionicons name="remove" size={15} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                if (isGuideButtonCompact) {
                  setIsGuideButtonCompact(false);
                  return;
                }
                handleStartGuide();
              }}
              style={{
                backgroundColor: '#6d28d9',
                paddingHorizontal: isGuideButtonCompact ? 0 : 14,
                paddingVertical: isGuideButtonCompact ? 0 : 8,
                width: isGuideButtonCompact ? 46 : undefined,
                height: isGuideButtonCompact ? 46 : undefined,
                borderRadius: isGuideButtonCompact ? 23 : 22,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#6d28d9',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <Ionicons
                name={isGuideButtonCompact ? "help-buoy-outline" : "help-buoy"}
                size={18}
                color="#fff"
                style={{ marginRight: isGuideButtonCompact ? 0 : 6 }}
              />
              {!isGuideButtonCompact && (
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                  {t('nav.detailedGuide')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <FeatureGuideBot />
        <WhatsNewModal visible={showWhatsNew} onClose={() => setShowWhatsNew(false)} />
      </View>
      <InAppCallOverlay />
      {RNPlatform.OS === 'web' && token && activeRoom && (
        <FloatingLivePlayer />
      )}
    </View>
  );

  const isOnLiveRoute =
    pathname === '/live' ||
    pathname === '/(main)/live' ||
    pathname.startsWith('/live/');

  // Avoid creating a second LiveKit room context on the live page.
  // The live page already manages its own LiveKitRoom instance.
  if (RNPlatform.OS !== 'web' || isOnLiveRoute) {
    return mainUI;
  }

  return (
    <LiveKitRoomComponent
      video={
        !!activeRoom?.isHost &&
        (
          !!activeRoom?.hostMediaState?.cameraEnabled ||
          !!activeRoom?.hostMediaState?.screenShareEnabled
        )
      }
      audio={false}
      token={token || undefined}
      serverUrl={LIVEKIT_URL}
      connectOptions={{ autoSubscribe: true }}
      options={{
        adaptiveStream: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      }}
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: 'transparent',
        overflow: 'hidden'
      }}
    >
      {mainUI}
      {token && <RoomAudioRendererComponent />}
    </LiveKitRoomComponent>
  );
}

// ── Floating mini Live player (web only) ──────────────────────────────────────
function MiniPlayerContent({ activeRoom, user }: { activeRoom: any, user: any }) {
  const tracks = useTracksHook(['camera', 'screen_share']);
  const { localParticipant } = useLocalParticipantHook();
  // Prioritize screen share over camera in mini player
  const screenTrack = tracks.find((t: any) => t?.source === 'screen_share' && t?.publication);
  const cameraTrack = tracks.find((t: any) => t?.source === 'camera' && t?.publication);
  const videoTrack = (screenTrack || cameraTrack) as any;
  const [waitingForVideo, setWaitingForVideo] = useState(true);
  const router = useRouter();
  const { disconnect, setActiveRoom } = useLiveRoom();
  const lastAppliedMediaStateRef = useRef<string>('');

  useEffect(() => {
    if (videoTrack) {
      setWaitingForVideo(false);
      return;
    }
    setWaitingForVideo(true);
    const timer = window.setTimeout(() => setWaitingForVideo(false), 4500);
    return () => window.clearTimeout(timer);
  }, [videoTrack]);

  useEffect(() => {
    if (!activeRoom?.isHost || !activeRoom?.hostMediaState || !localParticipant) return;
    const desired = activeRoom.hostMediaState;
    const mediaKey = JSON.stringify(desired);
    if (lastAppliedMediaStateRef.current === mediaKey) return;

    lastAppliedMediaStateRef.current = mediaKey;

    localParticipant.setCameraEnabled(!!desired.cameraEnabled).catch(() => null);
    localParticipant.setMicrophoneEnabled(!!desired.microphoneEnabled).catch(() => null);

    if (desired.screenShareEnabled && !localParticipant.isScreenShareEnabled) {
      localParticipant.setScreenShareEnabled(true).catch(() => {
        // Browser may reject without user gesture; keep state consistent to avoid retry loop.
        setActiveRoom({
          ...activeRoom,
          hostMediaState: {
            ...desired,
            screenShareEnabled: false,
          },
        });
      });
    } else if (!desired.screenShareEnabled && localParticipant.isScreenShareEnabled) {
      localParticipant.setScreenShareEnabled(false).catch(() => null);
    }
  }, [activeRoom, localParticipant, setActiveRoom]);

  const handleClose = async () => {
    if (typeof window === 'undefined') return;

    if (activeRoom.isHost) {
      if (window.confirm('Bạn là chủ phòng. Bạn có chắc chắn muốn KẾT THÚC buổi live này?')) {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_HOST_BE || 'http://localhost:3000'}/api/live/room?roomName=${encodeURIComponent(activeRoom.roomCode)}&hostId=${encodeURIComponent(user?.id || '')}`, {
            method: 'DELETE',
          });
          const data = await response.json();
          if (data.success) {
            disconnect();
          } else {
            alert(data.error || 'Không thể kết thúc live.');
          }
        } catch (error) {
          console.error('Lỗi khi kết thúc live từ mini player:', error);
          disconnect(); // Vẫn disconnect local nếu lỗi API
        }
      }
    } else {
      if (window.confirm('Bạn muốn thoát khỏi phòng live này?')) {
        disconnect();
      }
    }
  };

  return (
    <View style={{
      position: 'absolute' as any,
      bottom: 24,
      right: 24,
      width: 320,
      backgroundColor: '#ffffff',
      borderRadius: 16,
      overflow: 'hidden' as any,
      zIndex: 9999,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 20,
      borderWidth: 1,
      borderColor: '#e5e7eb',
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8 }} />
        <Text style={{ color: '#111827', fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={1}>
          {activeRoom.displayName || 'Phòng Live'}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/live' as any)}
          style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#6d28d9', borderRadius: 6, marginRight: 8 }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Mở rộng</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleClose}
          style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: 12 }}
        >
          <Ionicons name="close" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Video Content */}
      <View style={{ height: 180, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        {videoTrack ? (
          <VideoTrackComponent trackRef={videoTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : waitingForVideo ? (
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator color="#6d28d9" size="small" />
            <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 8 }}>Đang tải tín hiệu live...</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="videocam-off-outline" size={22} color="#9ca3af" />
            <Text style={{ color: '#6b7280', fontSize: 11, marginTop: 8 }}>Hiện chưa có hình từ live stream</Text>
          </View>
        )}
      </View>
      
      {/* Footer Info */}
      <View style={{ padding: 10, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
        <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center' }}>
          Chế độ Mini Player đang hoạt động
        </Text>
      </View>
    </View>
  );
}

function FloatingLivePlayer() {
  const { activeRoom } = useLiveRoom();
  const { user } = useUser();
  const pathname = usePathname();

  if (RNPlatform.OS !== 'web' || !activeRoom) return null;
  const isOnLivePage = pathname === '/live' || pathname === '/(main)/live' || pathname.includes('/live');
  if (isOnLivePage) return null;

  return <MiniPlayerContent activeRoom={activeRoom} user={user} />;
}

