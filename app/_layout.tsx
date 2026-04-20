import {SplashScreen, Stack} from 'expo-router';
import {useEffect} from 'react';
import {useFonts} from 'expo-font';
import {UserProvider} from '@/src/contexts/user/UserContext';
import {setupAxios} from "@/src/api/AxiosConfig";
import "../global.css";
import { TabBarProvider } from '@/src/contexts/TabBarContext';
import { NotificationProvider } from '@/src/contexts/NotificationContext';
import { ActiveCallProvider } from '@/src/contexts/ActiveCallContext';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

export {ErrorBoundary} from 'expo-router';

export const unstable_settings = {initialRouteName: '(auth)'};

SplashScreen.preventAutoHideAsync().catch(console.warn);
configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
});

/**
 * Static web export (`expo export`) không copy font từ `node_modules/@expo/vector-icons/...`
 * vào `dist/assets/node_modules/...` → request .ttf 404 → icon thành ô vuông trên Vercel.
 * Preload font từ `assets/fonts/` để Metro đưa file .ttf vào bản build.
 */
export default function RootLayout() {
    const [loaded, error] = useFonts({
        ionicons: require('../assets/fonts/Ionicons.ttf'),
        FontAwesome: require('../assets/fonts/FontAwesome.ttf'),
        'material-community': require('../assets/fonts/MaterialCommunityIcons.ttf'),
    });

    useEffect(() => {
        setupAxios().catch(console.warn);

        if (error) throw error;

        if (loaded) {
            SplashScreen.hideAsync().catch(console.warn);
        }
    }, [loaded, error]);

    if (!loaded) return null;

    return (
        <UserProvider>
			<TabBarProvider>
        <NotificationProvider>
        <ActiveCallProvider>
            <Stack screenOptions={{headerShown: false}}>
                <Stack.Screen name="(auth)"/>
                <Stack.Screen name="(main)"/>
            </Stack>
        </ActiveCallProvider>
        </NotificationProvider>
      </TabBarProvider>
        </UserProvider>
    );
}