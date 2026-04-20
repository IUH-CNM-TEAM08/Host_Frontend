import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { AuthStorage } from '@/src/storage/AuthStorage';
import { API_URL } from '../AxiosConfig';

export interface UploadedMedia {
  url: string;
  type: 'IMAGE' | 'VIDEO';
  mimeType: string;
  size: number;
  name: string;
}

/**
 * Đọc file thành base64, sau đó gửi lên backend dạng JSON.
 * Không dùng multipart/form-data để tránh lỗi busboy "Malformed part header" trên mọi nền tảng.
 */
export async function uploadMediaToS3(
  files: Array<{ uri: string; name: string; type: string; file?: any }>
): Promise<UploadedMedia[]> {
  const token = await AuthStorage.getAccessToken();
  const url = `${API_URL}/api/posts/upload-media`;

  // Chuyển đổi từng file sang base64
  const base64Files = await Promise.all(
    files.map(async (item) => {
      let base64data: string;

      if (Platform.OS === 'web') {
        // Trên Web: dùng FileReader để đọc DOM File object
        const domFile: File | null = item.file ?? null;
        if (domFile) {
          base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(domFile);
          });
        } else {
          // Fallback: fetch uri
          const res = await fetch(item.uri);
          const blob = await res.blob();
          base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else {
        // Native iOS/Android: dùng expo-file-system
        // Dùng string literal 'base64' tránh lỗi FileSystem.EncodingType undefined
        try {
          const encoding = (FileSystem.EncodingType?.Base64 ?? 'base64') as any;
          base64data = await FileSystem.readAsStringAsync(item.uri, { encoding });
        } catch {
          // Fallback: fetch rồi convert blob → base64
          const res = await fetch(item.uri);
          const blob = await res.blob();
          base64data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          // Nếu readAsDataURL trả về data URL thì giữ nguyên
          if (base64data.startsWith('data:')) {
            return { data: base64data, name: item.name || `upload_${Date.now()}.jpg`, mimeType: item.type || 'image/jpeg' };
          }
        }
        // Thêm header data URI cho backend có thể nhận dạng
        base64data = `data:${item.type || 'image/jpeg'};base64,${base64data}`;
      }

      const safeName = item.name || `upload_${Date.now()}.jpg`;
      const safeMime = item.type || 'image/jpeg';

      return { data: base64data, name: safeName, mimeType: safeMime };
    })
  );

  // Gửi JSON lên backend
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ files: base64Files }),
  });

  const data = await response.json();
  if (!response.ok || !data?.success) {
    throw new Error(data?.message ?? 'Upload thất bại');
  }
  return data.data as UploadedMedia[];
}
