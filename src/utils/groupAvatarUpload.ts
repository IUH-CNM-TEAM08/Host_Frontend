import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { messageService as MessageService } from '@/src/api/services/message.service';
import { AuthStorage } from '@/src/storage/AuthStorage';
import { API_URL } from '@/src/api/AxiosConfig';

/** Parse URL từ response upload tin nhắn (multipart → S3). */
export function parseUploadResponseCdnUrl(uploadRes: unknown): string | null {
  const r = uploadRes as any;
  const url =
    r?.cdnUrl ||
    r?.data?.cdnUrl ||
    r?.url ||
    r?.data?.url ||
    (typeof r === 'string' ? r : null);
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

async function resolveMobileUploadUri(inputUri: string): Promise<string> {
  const uri = String(inputUri || '').trim();
  if (!uri || Platform.OS === 'web') return uri;
  if (uri.startsWith('file://')) return uri;

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return uri;

  const ext = /\.png($|\?)/i.test(uri) ? 'png' : 'jpg';
  const target = `${cacheDir}group_avatar_${Date.now()}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: target });
    return target;
  } catch {
    return uri;
  }
}

/** Upload file ảnh cục bộ → URL https cho API cập nhật avatar nhóm. */
export async function uploadLocalGroupAvatar(localUri: string): Promise<string> {
  const resolvedUri = await resolveMobileUploadUri(localUri);
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(resolvedUri);
    const blob = await response.blob();
    const name = blob.type?.includes('png') ? 'group_avatar.png' : 'group_avatar.jpg';
    formData.append('file', blob, name);
  } else {
    const lowerUri = String(resolvedUri || '').toLowerCase();
    const inferredType = lowerUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const inferredName = lowerUri.endsWith('.png') ? 'group_avatar.png' : 'group_avatar.jpg';
    formData.append('file', {
      uri: resolvedUri,
      name: inferredName,
      type: inferredType,
    } as any);
  }

  let uploadRes: unknown;
  if (Platform.OS === 'web') {
    uploadRes = await MessageService.upload(formData);
  } else {
    const token = await AuthStorage.getAccessToken();
    const response = await fetch(`${API_URL}/api/messages/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.message || 'Không thể tải ảnh nhóm lên máy chủ.');
    }
    uploadRes = payload;
  }

  const url = parseUploadResponseCdnUrl(uploadRes);
  if (!url) throw new Error('Không nhận được URL ảnh sau khi upload');
  return url;
}
