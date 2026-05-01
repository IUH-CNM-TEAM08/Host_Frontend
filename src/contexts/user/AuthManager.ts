import {authService as ApiAuthService} from '@/src/api/services/auth.service';
import {userService as ApiUserService} from '@/src/api/services/user.service';
import {AuthStorage} from '@/src/storage/AuthStorage';
import {UserStorage} from '@/src/storage/UserStorage';
import {User} from '@/src/models/User';
import {ApiResponse} from '@/src/contexts/user/ApiResponse';
import SocketService from '@/src/api/socketCompat';

interface LoginCredentials {
    email?: string;
    phone?: string;
    password: string;
    otp?: string | null;
}

class AuthManager {
    private socketService = SocketService.getInstance();

    async login({email, phone, password, otp = null}: LoginCredentials): Promise<ApiResponse> {
        try {
            const result: any = await ApiAuthService.login({
                email,
                phoneNumber: phone,
                password,
                ...(otp ? {otp} : {})
            } as any);

            const payload = result?.data ?? result;
            const accessToken = payload?.accessToken;
            const refreshToken = payload?.refreshToken;
            let user = payload?.user;

            if (accessToken && refreshToken) {
                await AuthStorage.saveTokens(accessToken, refreshToken);

                if (!user) {
                    const me = await ApiUserService.me();
                    if (me?.success && me?.user) {
                        user = me.user;
                    }
                }

                if (user) {
                    await UserStorage.saveUser(user as User);
                }
                this.socketService.connect(accessToken);
                return {
                    success: true,
                    message: 'Đăng nhập thành công!',
                    data: user
                };
            }

            return {
                success: false,
                message: result?.message || result?.errorMessage || 'Đăng nhập thất bại!',
                errorCode: result?.errorCode || 0,
            };
        } catch (error: any) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Có lỗi xảy ra, vui lòng thử lại sau',
                errorCode: 500,
            };
        }
    }

    async logout(): Promise<ApiResponse> {
        try {
            await UserStorage.removeUser();
            await AuthStorage.removeTokens();
            this.socketService.disconnect();

            return {
                success: true,
                message: 'Đăng xuất thành công!'
            };
        } catch (error) {
            console.error('Logout error:', error);
            return {
                success: false,
                message: 'Đã xảy ra lỗi khi đăng xuất'
            };
        }
    }

    async isAuthenticated(): Promise<boolean> {
        const token = await AuthStorage.getAccessToken();
        return !!token;
    }
}

export default new AuthManager();
