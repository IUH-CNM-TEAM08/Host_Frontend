import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

const RAW_HOST_BE = process.env.EXPO_PUBLIC_HOST_BE;
const PORT_BE = process.env.EXPO_PUBLIC_PORT_BE;
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

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

// Tự động phân giải IP:
// - Web localhost → host của trang (camera / mixed content).
// - Native __DEV__: ưu tiên IP từ Expo (cùng máy dev), trừ khi EXPO_PUBLIC_FORCE_ENV_HOST=1.
// - Android emulator + localhost trong .env → 10.0.2.2 (host loopback).
let resolvedHost = RAW_HOST_BE ?? 'localhost';
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    resolvedHost = window.location.hostname;
  }
} else if (
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
    const h = (RAW_HOST_BE ?? '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1') {
      resolvedHost = '10.0.2.2';
    }
  }
}

export const URL_BE = `http://${resolvedHost}:${PORT_BE}`;
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
			const feHost = window.location.hostname;
			const feProtocol = window.location.protocol;
			
			// Nếu chạy FE trên localhost (web), luôn dùng localhost cho WebRTC
			// để bỏ qua trang cảnh báo của Pinggy/Ngrok và đảm bảo secure-context.
			const isLocalSecureHost = feHost === "localhost" || feHost === "127.0.0.1";
			if (isLocalSecureHost) {
				return `http://${feHost}:${PORT_BE}`;
			}

			const u = new URL(fallback);
			if (u.protocol === "https:") {
			  return fallback;
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
