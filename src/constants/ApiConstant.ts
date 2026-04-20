import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
// const RAW_HOST_BE = process.env.EXPO_PUBLIC_HOST_BE;
// const PORT_BE = process.env.EXPO_PUBLIC_PORT_BE;
const RAW_HOST_BE = process.env.EXPO_PUBLIC_HOST_BE?.trim();
const PORT_BE = process.env.EXPO_PUBLIC_PORT_BE ?? '3000';
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/** Production / HTTPS: đặt `EXPO_PUBLIC_API_BASE_URL` hoặc `EXPO_PUBLIC_HOST_BE=https://domain...` */
function pickExplicitApiBase(): string | null {
  // Dev: `EXPO_PUBLIC_DEV_USE_LOCAL_BACKEND=1` → bỏ qua URL production, dùng HOST_BE + PORT_BE (backend máy)
  if (isDev && process.env.EXPO_PUBLIC_DEV_USE_LOCAL_BACKEND === '1') {
    return null;
  }
  const extra = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  for (const raw of [extra, RAW_HOST_BE].filter((x): x is string => Boolean(x))) {
    if (/^https?:\/\//i.test(raw)) {
      try {
        return new URL(raw).origin.replace(/\/$/, '');
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

const EXPLICIT_API_BASE = pickExplicitApiBase();

/** Host thuần (không scheme) — lấy từ env khi env là hostname hoặc từ URL đầy đủ */
const hostOnlyFromEnv = (() => {
  if (!RAW_HOST_BE) return null as string | null;
  if (/^https?:\/\//i.test(RAW_HOST_BE)) {
    try {
      return new URL(RAW_HOST_BE).hostname;
    } catch {
      return null;
    }
  }
  return RAW_HOST_BE;
})();

/**
 * URL bundle JS từ Metro (vd: `http://192.168.1.5:8081/...`) — host luôn là máy dev thật sự đang phục vụ app.
 * Tin cậy hơn `expoConfig.hostUri` khi manifest thiếu (một số bản build / Expo Go).
 */
function parseHostFromMetroScriptUrl(): string | null {
  try {
    const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
    if (!scriptURL || typeof scriptURL !== 'string' || !scriptURL.startsWith('http')) {
      return null;
    }
    const u = new URL(scriptURL);
    const host = u.hostname;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return host;
    if (host === 'localhost' || host === '127.0.0.1') {
      return Platform.OS === 'android' ? '10.0.2.2' : host;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Expo dev: `hostUri` (vd: `192.168.1.5:8081`).
 */
function parseLanHostFromExpoDev(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri || typeof hostUri !== 'string') return null;
  const withoutScheme = hostUri.replace(/^exp:\/\//i, '').trim();
  const host = withoutScheme.split(':')[0]?.trim();
  if (host && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return host;
  return null;
}
// let resolvedHost = RAW_HOST_BE ?? 'localhost';
// if (Platform.OS === 'web' && typeof window !== 'undefined') {
// Tự động phân giải IP:
// - Web localhost → host của trang (camera / mixed content).
// - Native __DEV__: ưu tiên IP từ Expo (cùng máy dev), trừ khi EXPO_PUBLIC_FORCE_ENV_HOST=1.
// - Android emulator + localhost trong .env → 10.0.2.2 (host loopback).
let resolvedHost = hostOnlyFromEnv ?? 'localhost';
if (!EXPLICIT_API_BASE && Platform.OS === 'web' && typeof window !== 'undefined') {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    resolvedHost = window.location.hostname;
  }
} else if (
  !EXPLICIT_API_BASE &&
  Platform.OS !== 'web' &&
  isDev &&
  process.env.EXPO_PUBLIC_FORCE_ENV_HOST !== '1'
) {
  // Ưu tiên script Metro (luôn khớp máy đang chạy bundle), sau đó hostUri, cuối cùng .env.
  const fromScript = parseHostFromMetroScriptUrl();
  const fromExpo = parseLanHostFromExpoDev();
  if (fromScript) {
    resolvedHost = fromScript;
  } else if (fromExpo) {
    resolvedHost = fromExpo;
  } else if (Platform.OS === 'android') {
    const h = (hostOnlyFromEnv ?? '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      resolvedHost = '10.0.2.2';
    }
  }
}

export const URL_BE = EXPLICIT_API_BASE ?? `http://${resolvedHost}:${PORT_BE}`;
/** Gốc public cho trang gọi WebRTC (tunnel Loophole, ngrok, …). Không dấu / cuối. Để trống thì dùng `URL_BE`. */
function getWebrtcCallOrigin(): string {
	const fromEnv = process.env.EXPO_PUBLIC_WEBRTC_CALL_ORIGIN?.trim().replace(/\/$/, "");
	const fallback = fromEnv || URL_BE;
	// Trên web:
	// - Route `/webrtc/...` nằm ở BE (thường port khác FE).
	// - Tránh mixed-content/SSL protocol error.
	// - Đặc biệt: nếu FE đang chạy ở `localhost`/`127.0.0.1` thì thay host thành localhost để
	//   trình duyệt coi là secure-context (getUserMedia sẽ hoạt động trên http).
	try {
		if (typeof window !== "undefined" && window.location) {
			const u = new URL(fallback);
			const feHost = window.location.hostname;
			const feProtocol = window.location.protocol;
			const isLocalSecureHost = feHost === "localhost" || feHost === "127.0.0.1";
			if (isLocalSecureHost) {
				// dùng port của BE nhưng host của FE (localhost)
				return `${feProtocol}//${feHost}${u.port ? `:${u.port}` : ""}`;
			}
			return `${feProtocol}//${u.host}`;
		}
	} catch {
		// ignore (node/react-native)
	}
	return fallback;
}

/** URL trang cuộc gọi đến: `/webrtc/call/:conversationId/:senderId/:messageId` */
export function buildWebrtcIncomingCallUrl(
	conversationId: string,
	senderId: string,
	messageId: string
): string {
	const base = getWebrtcCallOrigin();
	return `${base}/webrtc/call/${encodeURIComponent(conversationId)}/${encodeURIComponent(senderId)}/${encodeURIComponent(messageId)}`;
}

/** Query `embedded=1` cho trang WebRTC nhúng trong app (iframe) — ẩn link ngoài, báo parent khi kết thúc. */
export function appendWebrtcEmbedParams(url: string): string {
	const sep = url.includes("?") ? "&" : "?";
	return `${url}${sep}embedded=1`;
}

export function appendWebrtcQueryParams(
	url: string,
	params: Record<string, string | null | undefined>
): string {
	const u = new URL(url);
	Object.entries(params).forEach(([key, value]) => {
		if (value != null && value !== "") {
			u.searchParams.set(key, value);
		}
	});
	return u.toString();
}

export const ApiEndpoints = {
	API_2FA: `${URL_BE}/api/2fa`,
	API_AUTH: `${URL_BE}/api/auth`,
	API_USER: `${URL_BE}/api/user`,
	API_CONVERSATION: `${URL_BE}/api/conversations`,
	API_MESSAGE: `${URL_BE}/api/messages`,
	API_FILE: `${URL_BE}/api/file`,
	API_FRIEND_REQUEST: `${URL_BE}/api/friendRequests`,
	API_ATTACHMENTS: `${URL_BE}/api/attachments`,
	API_REACTION: `${URL_BE}/api/reaction`,
	API_WEBRTC: `${URL_BE}/webrtc`,
	SOCKET_URL: `${URL_BE}`,
};
