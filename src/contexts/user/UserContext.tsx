import React, {createContext, ReactNode, useContext, useEffect, useState, useCallback} from 'react';
import {Alert, Platform, Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions} from 'react-native';
import SocketService from '@/src/api/socketCompat';
import {User} from '@/src/models/User';
import {Profile} from '@/src/models/Profile';
import {useRouter} from 'expo-router';
import {ApiResponse} from "@/src/contexts/user/ApiResponse";
import UserManager from "@/src/contexts/user/UserManager";
import AuthManager from "@/src/contexts/user/AuthManager";

interface LoginCredentials {
    email?: string;
    phone?: string;
    password: string;
    otp?: string | null;
}

interface UserContextType {
    user: Partial<User> | null;
    profile: Profile | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    login: (credentials: LoginCredentials) => Promise<ApiResponse>;
    logout: (redirect?: boolean) => Promise<void>;
    update: (updatedUser: Partial<User>) => Promise<ApiResponse>;
    refreshUserData: () => Promise<boolean>;
}

interface UserProviderProps {
    children: ReactNode;
}

const UserContext = createContext<UserContextType>({
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
    login: async () => ({success: false}),
    logout: async () => {
    },
    update: async () => ({success: false}),
    refreshUserData: async () => false,
});


export const useUser = () => useContext(UserContext);

// ── Session Kicked Modal Component ──────────────────────────────────────────
const SessionKickedModal = ({ visible, message, onConfirm }: { visible: boolean; message: string; onConfirm: () => void }) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onConfirm}
        >
            <View style={kickedStyles.overlay}>
                <View style={kickedStyles.card}>
                    {/* Icon */}
                    <View style={kickedStyles.iconContainer}>
                        <Text style={kickedStyles.icon}>🔒</Text>
                    </View>

                    {/* Title */}
                    <Text style={kickedStyles.title}>Phiên đăng nhập kết thúc</Text>

                    {/* Message */}
                    <Text style={kickedStyles.message}>{message}</Text>

                    {/* Divider */}
                    <View style={kickedStyles.divider} />

                    {/* Button */}
                    <TouchableOpacity style={kickedStyles.button} onPress={onConfirm} activeOpacity={0.8}>
                        <Text style={kickedStyles.buttonText}>Đăng nhập lại</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const kickedStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    card: {
        width: Math.min(SCREEN_WIDTH - 64, 380),
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingTop: 28,
        paddingBottom: 20,
        paddingHorizontal: 24,
        alignItems: 'center',
        // Shadow
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fef2f2',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    icon: {
        fontSize: 28,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: '#f3f4f6',
        marginBottom: 16,
    },
    button: {
        width: '100%',
        backgroundColor: '#6d28d9',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
});

// ── User Provider ───────────────────────────────────────────────────────────
export const UserProvider = ({children}: UserProviderProps) => {
    const router = useRouter();
    const [user, setUser] = useState<Partial<User> | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const socketService = React.useRef(SocketService.getInstance()).current;

    // Session kicked modal state
    const [kickedModalVisible, setKickedModalVisible] = useState(false);
    const [kickedMessage, setKickedMessage] = useState('');

    const loadUserData = async (): Promise<boolean> => {
        const result = await UserManager.getUserData();
        if (!result.success || !result.data) {
            setUser(null);
            setProfile(null);
            setIsAuthenticated(false);
            return false;
        }

        setUser(result.data);
        setProfile(UserManager.computeProfile(result.data));
        setIsAuthenticated(true);
        return true;
    };

    useEffect(() => {
        const initializeUser = async () => {
            try {
                const userLoaded = await loadUserData();

                if (!userLoaded) {
                    await handleLogout(true);
                }
            } catch (error) {
                console.error('Error initializing user:', error);
                await handleLogout(true);
            } finally {
                setIsLoading(false);
            }
        };

        initializeUser();
    }, []);

    const handleLogin = async (credentials: LoginCredentials): Promise<ApiResponse> => {
        const result = await AuthManager.login(credentials);

        if (result.success && result.data) {
            setUser(result.data);
            setProfile(UserManager.computeProfile(result.data));
            setIsAuthenticated(true);
        }

        return result;
    };

    const handleLogout = async (redirect: boolean = true): Promise<void> => {
        await AuthManager.logout();
        setUser(null);
        setProfile(null);
        setIsAuthenticated(false);

        if (redirect) {
            router.replace("/(auth)");
        }
    };

    const handleUpdate = async (updatedUser: Partial<User>): Promise<ApiResponse> => {
        const result = await UserManager.updateUser(updatedUser);

        if (result.success && result.data) {
            setUser(result.data);
            setProfile(UserManager.computeProfile(result.data));
        }

        return result;
    };

    const refreshUserData = async (): Promise<boolean> => {
        setIsLoading(true);
        try {
            return await loadUserData();
        } finally {
            setIsLoading(false);
        }
    };

    // Handle the modal confirm button — logout and redirect
    const handleKickedConfirm = useCallback(async () => {
        setKickedModalVisible(false);
        setKickedMessage('');
        await handleLogout(true);
    }, []);

    // Real-time: Kick session (e.g. login from another browser, account locked by admin)
    useEffect(() => {
        if (!user?.id) return;
        const handleKicked = (data: any) => {
            const msg = data?.reason || 'Tài khoản của bạn đã được đăng nhập ở một trình duyệt khác.';
            setKickedMessage(msg);
            setKickedModalVisible(true);
        };
        socketService.onSessionKicked(handleKicked);
        return () => socketService.removeSessionKickedListener(handleKicked);
    }, [user?.id, socketService]);

    return (
        <UserContext.Provider
            value={{
                user,
                profile,
                isAuthenticated,
                isLoading,
                login: handleLogin,
                logout: handleLogout,
                update: handleUpdate,
                refreshUserData
            }}
        >
            {children}
            <SessionKickedModal
                visible={kickedModalVisible}
                message={kickedMessage}
                onConfirm={handleKickedConfirm}
            />
        </UserContext.Provider>
    );
};