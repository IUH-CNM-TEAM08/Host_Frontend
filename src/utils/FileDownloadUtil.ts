import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

export type DownloadItem = {
    url: string;
    fileName: string;
    mimeType?: string;
};

// Check if a file is media (image or video)
export const isMediaFile = (mimeType?: string, fileName?: string) => {
    if (mimeType && (mimeType.startsWith('image/') || mimeType.startsWith('video/'))) return true;
    if (fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'].includes(ext || '');
    }
    return false;
};

// Common download wrapper for Web
const downloadWeb = async (url: string, fileName: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (e) {
        console.error("Web download failed, falling back to direct open.", e);
        window.open(url, '_blank');
    }
};

// Formats file name safely for saving
const getSafeFilename = (item: DownloadItem) => {
    const extMatch = item.fileName.match(/\.([^.]+)$/);
    const existingExt = extMatch ? extMatch[1] : '';
    let name = item.fileName.split('/').pop() || `file_${Date.now()}`;
    
    // if no meaningful extension in file name, attempt to infer from mime
    if (!existingExt && item.mimeType) {
        const mimeExt = item.mimeType.split('/')[1];
        if (mimeExt && mimeExt.length < 5 && !mimeExt.includes('*')) {
            name += `.${mimeExt}`;
        }
    }
    return encodeURIComponent(name);
};

// Native download flow
const downloadMobile = async (item: DownloadItem, silent = false) => {
    try {
        const encodedName = getSafeFilename(item);
        const localUri = FileSystem.documentDirectory + encodedName;

        const downloadResult = await FileSystem.downloadAsync(item.url, localUri);

        const isMedia = isMediaFile(item.mimeType, item.fileName);

        if (isMedia) {
            // Request permissions for media library
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                if (!silent) Alert.alert("Lỗi", "Cần cấp quyền truy cập ảnh để lưu file.");
                return false;
            }
            await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
            if (!silent) Alert.alert("Thành công", "Đã lưu vào thư viện ảnh.");
            
            // Clean up cache
            await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
            return true;
        } else {
            // General files - Requires user to select where to save via Sharing
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(downloadResult.uri, {
                    dialogTitle: 'Lưu hoặc chia sẻ tệp',
                    mimeType: item.mimeType
                });
                return true;
            } else {
                if (!silent) Alert.alert("Lỗi", "Thiết bị không hỗ trợ chia sẻ tệp.");
                return false;
            }
        }
    } catch (e) {
        console.error("Mobile download failed", e);
        if (!silent) Alert.alert("Lỗi", "Tải tệp thất bại.");
        return false;
    }
};

export const downloadSingleItem = async (item: DownloadItem) => {
    if (Platform.OS === 'web') {
        await downloadWeb(item.url, item.fileName);
    } else {
        await downloadMobile(item);
    }
};

export const downloadGroup = async (items: DownloadItem[]) => {
    if (!items || items.length === 0) return;

    if (Platform.OS === 'web') {
        const maxConcurrent = 3;
        for (let i = 0; i < items.length; i += maxConcurrent) {
            const chunk = items.slice(i, i + maxConcurrent);
            await Promise.all(chunk.map(item => downloadWeb(item.url, item.fileName)));
            // short delay between chunks to avoid browser block
            await new Promise(r => setTimeout(r, 500));
        }
    } else {
        const isMediaGroup = items.every(i => isMediaFile(i.mimeType, i.fileName));
        Alert.alert("Đang tải xuống...", `Đang tiến hành tải ${items.length} tệp.`);
        
        let successCount = 0;
        
        for (const item of items) {
           // If it is mixed or not all medias, we might popup the sheet for every single doc.
           // However, if they are media files, they download silently to Camera Roll.
           const ok = await downloadMobile(item, true); // silent mode
           if (ok) successCount++;
        }
        Alert.alert("Hoàn tất", `Đã lưu thành công ${successCount}/${items.length} tệp.`);
    }
};
