import React, {createContext, ReactNode, useContext, useEffect, useState} from 'react';
import {Alert, Platform} from 'react-native';
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

export const UserProvider = ({children}: UserProviderProps) => {
    const router = useRouter();
    const [user, setUser] = useState<Partial<User> | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const socketService = React.useRef(SocketService.getInstance()).current;

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

    // Real-time: Kick session (e.g. account locked by admin)
    useEffect(() => {
        if (!user?.id) return;
        const handleKicked = (data: any) => {
            const msg = data.reason || 'Phiên làm việc đã kết thúc hoặc tài khoản bị khóa.';
            if (Platform.OS === 'web') {
                alert(msg);
                handleLogout(true);
            } else {
                Alert.alert('Thông báo', msg, [{ text: 'OK', onPress: () => handleLogout(true) }]);
            }
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
        </UserContext.Provider>
    );
};