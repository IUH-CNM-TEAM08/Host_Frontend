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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
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

type Route = {
  name: string;
  title: string;
  icon:
  | "chatbubbles-outline"
  | "people-outline"
  | "game-controller-outline"
  | "musical-notes-outline"
  | "newspaper-outline"
  | "compass-outline"
  | "settings-outline";
};

const desktopRoutes: Route[] = [
  { name: "index", title: "Tin nhắn", icon: "chatbubbles-outline" },
  { name: "contacts", title: "Danh bạ", icon: "people-outline" },
  { name: "notifications", title: "Thông báo", icon: "notifications-outline" },
  { name: "games", title: "Game", icon: "game-controller-outline" },
  { name: "music", title: "Nhạc", icon: "musical-notes-outline" },
  { name: "timeline", title: "Tường nhà", icon: "newspaper-outline" },
  { name: "settings", title: "Cài đặt", icon: "settings-outline" },
];

const mobileRoutes: Route[] = [
  { name: "index", title: "Tin nhắn", icon: "chatbubbles-outline" },
  { name: "contacts", title: "Danh bạ", icon: "people-outline" },
  { name: "timeline", title: "Tường nhà", icon: "newspaper-outline" },
  { name: "discovery", title: "Khám phá", icon: "compass-outline" },
];

/** Tiêu đề hiển thị trên shared header theo tab đang active */
function getMobileTabTitle(pathname: string, routes: Route[]): string {
  for (const r of routes) {
    if (r.name === 'index' && (pathname === '/' || pathname === '/index')) return r.title;
    if (r.name !== 'index' && (pathname === `/${r.name}` || pathname === `/(main)/${r.name}`)) return r.title;
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
          placeholder="Tìm kiếm tin nhắn, bạn bè..."
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

  // Reset search khi chuyển tab
  useEffect(() => {
    setSearchQuery('');
  }, [pathname]);

  return (
    <View style={{ flex: 1 }}>
      {isHeaderVisible && (
        <MobileHeader
          tabTitle={getMobileTabTitle(pathname, mobileRoutes)}
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
  const { user, isLoading, logout } = useUser();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [avatar, setAvatar] = useState<ImageSourcePropType>({ uri: "" });
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const isDesktop = width > 768;
  const routes = isDesktop ? desktopRoutes : mobileRoutes;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { isVisible: isTabBarVisible } = useTabBar();

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

    // Lắng nghe lời mời nhóm bị từ chối
    const handleGroupInviteDeclinedGlobal = (payload: any) => {
      if (payload?.declinerName) {
        Alert.alert('Từ chối lời mời', `${payload.declinerName} đã từ chối lời mời tham gia nhóm.\n\nLý do: ${payload.reason || 'Không có lý do'}`);
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

  // Reset badge when user opens contacts tab
  useEffect(() => {
    if (pathname === '/contacts' || pathname === '/(main)/contacts') {
      loadPendingCount();
    }
  }, [pathname]);

  // Check if the current route is active
  const isActive = (routeName: string) => {
    if (routeName === "index") {
      return pathname === "/" || pathname === "/index";
    }
    return pathname === `/${routeName}`;
  };

  // Get the href for the route
  const getHref = (routeName: string) => {
    console.log("routeName", routeName);
    if (routeName === "index") return "/";
    return `/(main)/${routeName}` as Href;
  };

  useEffect(() => {
    validateAvatar(user?.avatarURL || "").then((validatedAvatar) => {
      setAvatar(validatedAvatar);
    });
  }, [user?.avatarURL]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-base text-[#6d28d9]">Đang tải...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/" />;
  }

  return (
      <ActiveCallProvider>
        <View className="flex-1">
          <View className="flex-1 flex-row">
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
                      const isSettings = route.name === 'settings';
                      const isNotifications = route.name === 'notifications';

                      const content = (
                        <View
                          key={route.name}
                          className="flex flex-col items-center justify-center py-2"
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
                            {/* Badge cho thông báo */}
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

                            {/* Badge cho danh bạ (pending requests) */}
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
                  <View className="flex flex-col items-center justify-center py-4 relative">
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
              <View className="flex-1 mx-4 my-4">
                <View className="flex-1 bg-white">
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: {
                        backgroundColor: "transparent",
                      },
                    }}
                  >
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
                          {route.title}
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
                      Tài khoản
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <ProfileModal
              visible={profileModalVisible}
              onClose={() => setProfileModalVisible(false)}
            />

            {Platform.OS === "web" && isDesktop ? <WebMusicShortcut /> : null}
            {Platform.OS === "web" && isDesktop ? <FriendNotificationToast /> : null}
            {/* Social notification toast — web slides from right, mobile drops from top */}
            <SocialNotificationToast />
            {/* Notification panel web desktop */}
            {Platform.OS === "web" && isDesktop && (
              <NotificationDrawer visible={showNotif} onClose={() => setShowNotif(false)} />
            )}
          </View>
          <InAppCallOverlay />
        </View>
      </ActiveCallProvider>
  );
}
