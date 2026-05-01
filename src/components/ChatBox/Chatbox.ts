/**
 * Chatbox.ts — Service giao tiếp với ZalaBot AI backend
 * Dùng trong ZalaBotChatbox.tsx
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const HOST = process.env.EXPO_PUBLIC_HOST_BE ?? "localhost";
const PORT = process.env.EXPO_PUBLIC_PORT_BE ?? "3000";
const BASE_URL = `http://${HOST}:${PORT}`;

// Key đúng với AuthStorage trong app (src/constants/StorageKeyConstant.ts)
const ACCESS_TOKEN_KEY = "@IUH_CNM_APP:accessToken";

async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export interface ZalaBotResponse {
  success: boolean;
  answer: string;
}

/**
 * Gửi câu hỏi đến ZalaBot AI (backend Groq/LLM).
 * @param question - Chuỗi đã strip @ZalaBot prefix (FE strip trước khi gọi)
 */
export async function askZalaBot(question: string): Promise<string> {
  try {
    const token = await getAuthToken();

    const res = await fetch(`${BASE_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as any;
      return errBody?.message ?? `Lỗi ${res.status}: ZalaBot không phản hồi lúc này.`;
    }

    const data = await res.json() as ZalaBotResponse;
    return data.answer ?? "Xin lỗi ZalaBot chưa có câu trả lời, thử lại nhé!";
  } catch (err) {
    console.error("[Chatbox] askZalaBot error:", err);
    return "Không kết nối được đến ZalaBot. Kiểm tra mạng và thử lại nhé!";
  }
}
