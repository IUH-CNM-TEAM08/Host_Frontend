import { del, get, post } from './http';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type LoginPayload = {
  email?: string;
  phoneNumber?: string;
  password: string;
  deviceId?: string;
  clientType?: string;
};

export const authService = {
  sendRegisterOtp: (email: string) => post('/auth/register/otp/send', { email }),
  verifyRegisterOtp: (email: string, code: string) => post('/auth/register/otp/verify', { email, code }),
  register: <T = unknown>(payload: Record<string, unknown>) => post<T>('/auth/register', payload),

  login: (payload: LoginPayload) => post<TokenPair>('/auth/login', payload),
  sendLoginOtp: (email: string) => post('/auth/login/otp/send', { email }),
  loginWithOtp: (email: string, code: string) => post<TokenPair>('/auth/login/otp/verify', { email, code }),

  refreshToken: (refreshToken: string) => post<TokenPair>('/auth/refresh', { refreshToken }),
  logout: (refreshToken?: string, accountId?: string) => post('/auth/logout', { refreshToken, accountId }),

  forgotPassword: (email: string) => post('/auth/forgot-password', { email }),
  resetPassword: (email: string, otp: string, newPassword: string) =>
    post('/auth/reset-password', { email, otp, newPassword }),
  changePassword: (oldPassword: string, newPassword: string) =>
    post('/auth/change-password', { oldPassword, newPassword }),
  verifyPhone: (phoneNumber: string, otp: string) => post('/auth/verify-phone', { phoneNumber, otp }),

  requestAccountRestore: (email: string) => post('/auth/restore-request', { email }),

  generateQr: () => get<{ qrId?: string; qrUrl?: string }>('/auth/generate'),
  checkQrStatus: (qrId: string) => get<{ status?: string; accessToken?: string; refreshToken?: string }>(`/auth/check/${encodeURIComponent(qrId)}`),
  scanQr: (qrId: string) => post(`/auth/scan/${encodeURIComponent(qrId)}`),
  verifyQr: (qrId: string) => post<{ status?: string; accessToken?: string; refreshToken?: string }>(`/auth/verify/${encodeURIComponent(qrId)}`),

  // ── Device Management (gọi API thật) ──────────────────────────────────────────
  getDevices: (refreshToken?: string): Promise<{ success: boolean; data?: any[]; message?: string }> =>
    get('/auth/devices', refreshToken ? { refreshToken } : undefined)
      .then((res: any) => ({
        success: true,
        data: Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []),
      }))
      .catch((err: any) => ({
        success: false,
        message: err?.response?.data?.message || 'Không thể tải danh sách thiết bị',
      })),

  logoutDevice: (payload: { deviceId: string }): Promise<{ success: boolean; message?: string }> =>
    post('/auth/logout-device', payload)
      .then(() => ({ success: true, message: 'Đã đăng xuất thiết bị' }))
      .catch((err: any) => ({
        success: false,
        message: err?.response?.data?.message || 'Không thể đăng xuất thiết bị',
      })),

  logoutAll: (refreshToken?: string): Promise<{ success: boolean; message?: string }> =>
    post('/auth/logout-all', refreshToken ? { refreshToken } : {})
      .then(() => ({ success: true, message: 'Đã đăng xuất tất cả thiết bị' }))
      .catch((err: any) => ({
        success: false,
        message: err?.response?.data?.message || 'Không thể đăng xuất',
      })),

  // ── 2FA (giữ nguyên nếu có) ───────────────────────────────────────────────────
  get2FAStatus: (): Promise<{ success: boolean; data?: any; message?: string }> =>
    get('/auth/2fa/status')
      .then((res: any) => ({ success: true, data: res?.data ?? res }))
      .catch(() => ({ success: false })),

  enable2FA: (payload: { secret: string; otp: string }): Promise<{ success: boolean; message?: string }> =>
    post('/auth/2fa/enable', payload)
      .then(() => ({ success: true }))
      .catch((err: any) => ({ success: false, message: err?.response?.data?.message || 'Lỗi' })),

  disable2FA: (payload: { otp: string }): Promise<{ success: boolean; message?: string }> =>
    post('/auth/2fa/disable', payload)
      .then(() => ({ success: true }))
      .catch((err: any) => ({ success: false, message: err?.response?.data?.message || 'Lỗi' })),
};
