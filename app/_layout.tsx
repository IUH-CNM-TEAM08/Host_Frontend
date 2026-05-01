import '@/src/polyfills/domException';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useFonts } from 'expo-font';

import { UserProvider } from '@/src/contexts/user/UserContext';
import { I18nProvider } from '@/src/contexts/i18n/I18nContext';
import { setupAxios } from '@/src/api/AxiosConfig';
import '../global.css';
import { TabBarProvider } from '@/src/contexts/TabBarContext';
import { NotificationProvider } from '@/src/contexts/NotificationContext';
import { ActiveCallProvider } from '@/src/contexts/ActiveCallContext';
import { GuideProvider } from '@/src/contexts/GuideContext';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(auth)' };

SplashScreen.preventAutoHideAsync().catch(console.warn);
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

export default function RootLayout() {
  const [loaded, error] = useFonts({});

  useEffect(() => {
    setupAxios().catch(console.warn);
    if (error) throw error;
    if (loaded) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [loaded, error]);

  if (!loaded) return null;

  return (
    <I18nProvider>
      <UserProvider>
        <TabBarProvider>
          <NotificationProvider>
            <ActiveCallProvider>
              <GuideProvider>
                {/* Important: Stack children must be ONLY Screen. */}
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(main)" />
                  <Stack.Screen name="admin" />
                </Stack>
              </GuideProvider>
            </ActiveCallProvider>
          </NotificationProvider>
        </TabBarProvider>
      </UserProvider>
    </I18nProvider>
  );
}