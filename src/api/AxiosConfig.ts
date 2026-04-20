import axios from 'axios';
import {AuthStorage} from '@/src/storage/AuthStorage';
import {Platform} from 'react-native';
import {URL_BE} from '../constants/ApiConstant';
import {router} from 'expo-router';

let isAxiosSetup = false;
let refreshPromise: Promise<string | null> | null = null;
let isForceLogout = false; // tránh redirect nhiều lần cùng lúc

const getApiUrl = () => {
    if (Platform.OS === 'web') {
        return URL_BE;
    } else if (Platform.OS === 'android') {
        return URL_BE;
    } else {
        return URL_BE;
    }
};

export const API_URL = getApiUrl();

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/** Xóa token + điều hướng về màn login */
const forceLogout = async () => {
    if (isForceLogout) return;
    isForceLogout = true;
    await AuthStorage.removeTokens();
    try {
        router.replace('/(auth)');
    } catch {
        // router chưa ready (hiếm)
    }
    // Reset sau 3s để cho phép login lại
    setTimeout(() => { isForceLogout = false; }, 3000);
};

export const setupAxios = async () => {
    if (isAxiosSetup) return;

    axios.defaults.baseURL = API_URL;
    axios.defaults.timeout = 15000;
    axios.defaults.headers.post['Content-Type'] = 'application/json';

    if (isDev) {
        console.warn('[Zala API] baseURL =', API_URL);
    }

    axios.interceptors.request.use(
        async (config) => {
            if (isDev) {
                console.warn(`[Zala API] → ${config.method?.toUpperCase()} ${config.baseURL ?? ''}${config.url ?? ''}`);
            }
            const token = await AuthStorage.getAccessToken();

            if (token) config.headers.Authorization = `Bearer ${token}`;

            // Multipart: default post Content-Type là application/json — làm multer không nhận file.
            // Axios: đặt Content-Type = false để bỏ header, RN/Web tự gắn multipart + boundary.
            const data = config.data;
            if (data instanceof FormData) {
                const h = config.headers as Record<string, unknown> & {
                    set?: (k: string, v: unknown) => void;
                    delete?: (k: string) => void;
                };
                h['Content-Type'] = false;
                h.delete?.('Content-Type');
                h.delete?.('content-type');
            }

            return config;
        },
        (error) => {
            console.error('[Zala API] request error', error);
            return Promise.reject(error);
        }
    );

    axios.interceptors.response.use(
        (response) => {
            if (isDev) {
                console.warn(`[Zala API] ← ${response.status} ${response.config.url ?? ''}`);
            }
            return response;
        },
        async (error) => {
            const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

            // ── Xử lý 401: thử refresh token trước khi báo lỗi ──────────────
            if (
                error.response?.status === 401 &&
                originalRequest &&
                !originalRequest._retry &&
                !String(originalRequest.url || '').includes('/auth/login') &&
                !String(originalRequest.url || '').includes('/auth/refresh')
            ) {
                originalRequest._retry = true;
                try {
                    if (!refreshPromise) {
                        refreshPromise = (async () => {
                            const currentRefreshToken = await AuthStorage.getRefreshToken();
                            if (!currentRefreshToken) {
                                // Không có refresh token → buộc logout
                                await forceLogout();
                                return null;
                            }

                            const refreshRes = await axios.post(
                                '/auth/refresh',
                                { refreshToken: currentRefreshToken },
                                {
                                    baseURL: API_URL,
                                    timeout: 15000,
                                    headers: { 'Content-Type': 'application/json' },
                                }
                            );

                            const payload = refreshRes?.data?.data ?? refreshRes?.data ?? {};
                            const nextAccessToken = payload?.accessToken
                                ?? payload?.token
                                ?? payload?.access_token
                                ?? null;
                            const nextRefreshToken = payload?.refreshToken
                                ?? payload?.refresh_token
                                ?? currentRefreshToken;

                            if (!nextAccessToken || !nextRefreshToken) return null;
                            await AuthStorage.saveTokens(nextAccessToken, nextRefreshToken);
                            return nextAccessToken as string;
                        })();
                    }

                    const newAccessToken = await refreshPromise;
                    if (!newAccessToken) {
                        // Refresh trả về null → token hết hạn hoàn toàn
                        await forceLogout();
                        return Promise.reject(error);
                    }

                    // Retry request gốc với token mới
                    originalRequest.headers = originalRequest.headers ?? {};
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return axios(originalRequest);
                } catch (refreshError) {
                    // Refresh thất bại (refresh token expired/revoked) → logout
                    await forceLogout();
                    return Promise.reject(refreshError);
                } finally {
                    refreshPromise = null;
                }
            }

            // ── Log lỗi những trường hợp còn lại (không phải 401 đã handle) ──
            if (isDev) {
                const status = error.response?.status ?? '—';
                const url = String(error.config?.url ?? '');
                const serverMessage = String(
                    error?.response?.data?.message || error?.response?.data?.error || ''
                );
                const isBlockedInviteAccept =
                    status === 403 &&
                    /\/api\/group-invites\/[^/]+\/accept$/i.test(url) &&
                    /bị chặn khỏi nhóm/i.test(serverMessage);

                if (isBlockedInviteAccept) {
                    return Promise.reject(error);
                }
                // Chỉ warn, không error — để giảm noise
                const logFn = status === 401 ? console.warn : console.error;
                logFn('[Zala API] response error', {
                    message: error.message,
                    code: error.code,
                    status,
                    url,
                    data: error.response?.data ?? '—',
                });
            }

            return Promise.reject(error);
        }
    );

    isAxiosSetup = true;
};
