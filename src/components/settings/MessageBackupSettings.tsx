import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useUser } from '@/src/contexts/user/UserContext';
import { messageService as MessageService } from '@/src/api/services/message.service';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }
  if (typeof (globalThis as any).Buffer === 'function') {
    return (globalThis as any).Buffer.from(binary, 'binary').toString('base64');
  }
  throw new Error('Base64 encoding is not available');
};

const downloadWebZip = async (buffer: ArrayBuffer, fileName: string) => {
  try {
    const blob = new Blob([buffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[MessageBackupSettings] Web download failed', error);
    Alert.alert('Lỗi', 'Không thể tải xuống sao lưu.');
  }
};

const saveMobileZip = async (buffer: ArrayBuffer, fileName: string) => {
  try {
    const base64 = arrayBufferToBase64(buffer);
    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/zip',
        dialogTitle: 'Lưu sao lưu tin nhắn',
      });
    } else {
      Alert.alert('Thành công', 'Sao lưu đã được lưu vào bộ nhớ thiết bị.');
    }
  } catch (error) {
    console.error('[MessageBackupSettings] saveMobileZip error', error);
    Alert.alert('Lỗi', 'Không thể lưu sao lưu vào thiết bị.');
  }
};

export default function MessageBackupSettings() {
  const { user } = useUser();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingProgress, setImportingProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = async () => {
    if (!user?.id) {
      Alert.alert('Lỗi', 'Không tìm thấy tài khoản người dùng.');
      return;
    }

    setExporting(true);
    try {
      const buffer = await MessageService.exportBackup(user.id);
      const fileName = `zala-messages-backup-${new Date().toISOString().replace(/:/g, '-')}.zip`;
      if (Platform.OS === 'web') {
        await downloadWebZip(buffer as ArrayBuffer, fileName);
      } else {
        await saveMobileZip(buffer as ArrayBuffer, fileName);
      }
    } catch (error) {
      console.error('[MessageBackupSettings] export error', error);
      Alert.alert('Lỗi', 'Tải sao lưu tin nhắn thất bại.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    console.log('[MessageBackupSettings] handleImport start');
    if (!user?.id) {
      console.log('[MessageBackupSettings] no user id');
      Alert.alert('Lỗi', 'Không tìm thấy tài khoản người dùng.');
      return;
    }

    try {
      const pickerType = DocumentPicker.types?.allFiles ?? '*/*';
      console.log('[MessageBackupSettings] pickerType', pickerType);
      const result: any = await DocumentPicker.getDocumentAsync({ type: pickerType, copyToCacheDirectory: true });
      console.log('[MessageBackupSettings] picker result', result);
      const isCancelled = result.type === 'cancel' || result.canceled === true;
      const resultUri = result.uri || result.assets?.[0]?.uri;
      const resultName = result.name || result.assets?.[0]?.name;
      const resultMimeType = result.mimeType || result.assets?.[0]?.mimeType;

      if (isCancelled) {
        console.log('[MessageBackupSettings] picker cancelled', result);
        return;
      }

      if (!resultUri) {
        console.log('[MessageBackupSettings] picker missing uri', result);
        Alert.alert('Lỗi', 'Không thể chọn file sao lưu.');
        return;
      }

      if (!resultName?.toLowerCase().endsWith('.zip')) {
        console.log('[MessageBackupSettings] invalid file extension', resultName);
        Alert.alert('Lỗi', 'Vui lòng chọn file ZIP sao lưu.');
        return;
      }

      setImporting(true);
      setImportingProgress(0);
      const formData = new FormData();
      if (Platform.OS === 'web') {
        console.log('[MessageBackupSettings] running web file fetch', resultUri);
        const response = await fetch(resultUri);
        console.log('[MessageBackupSettings] fetched file response', response.status, response.type);
        const blob = await response.blob();
        const file = new File([blob], resultName || 'backup.zip', { type: resultMimeType || 'application/zip' });
        formData.append('file', file);
      } else {
        console.log('[MessageBackupSettings] running native file append', resultUri, resultName, resultMimeType);
        formData.append('file', {
          uri: resultUri,
          name: resultName || 'backup.zip',
          type: resultMimeType || 'application/zip',
        } as any);
      }

      console.log('[MessageBackupSettings] calling importBackup');
      const res = await MessageService.importBackup(user.id, formData, {
        onUploadProgress: (event) => {
          const pct = event.total ? Math.min(100, Math.round((event.loaded / event.total) * 100)) : null;
          console.log('[MessageBackupSettings] upload progress', event.loaded, event.total, pct);
          if (pct != null) {
            setImportingProgress(pct);
          }
        },
      });
      console.log('[MessageBackupSettings] importBackup response', res);
      const imported = res?.data?.imported ?? 0;
      const skipped = res?.data?.skipped ?? 0;
      const restored = res?.data?.restored ?? 0;
      if (res?.success) {
        if (imported > 0 || restored > 0) {
          const parts: string[] = [];
          if (imported > 0) parts.push(`Đã thêm ${imported} tin nhắn mới từ file sao lưu`);
          if (restored > 0) {
            parts.push(
              `Đã hiển thị lại ${restored} tin (trước đó bạn đã xóa phía mình; dữ liệu vẫn còn trên máy chủ)`
            );
          }
          if (skipped > 0) parts.push(`${skipped} tin bỏ qua (trùng hoặc không thuộc hội thoại của bạn)`);
          const msg = parts.join('. ') + '.';
          setStatusMessage(msg);
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Thành công', msg);
        } else {
          const msg =
            skipped > 0
              ? `Không có thay đổi: ${skipped} tin trong file đã khớp dữ liệu hiện tại (đã hiển thị với bạn), hoặc không thuộc hội thoại của bạn. Để hiện lại tin đã xóa phía mình, cần file sao lưu xuất trước khi xóa (file sau khi xóa không còn chứa các tin đó).`
              : 'Không có tin nhắn nào trong file sao lưu.';
          setStatusMessage(msg);
          if (Platform.OS === 'web') window.alert(msg);
          else Alert.alert('Hoàn tất', msg);
        }
      } else {
        Alert.alert('Lỗi', res?.message || 'Nhập sao lưu không thành công.');
      }
    } catch (error) {
      console.error('[MessageBackupSettings] import error', error);
      Alert.alert('Lỗi', 'Nhập sao lưu tin nhắn thất bại.');
    } finally {
      setImporting(false);
      setImportingProgress(null);
    }
  };
  return (
    <View className="border-b border-gray-200 pb-6">
      <View className="flex-row justify-between items-center mb-4">
        <View>
          <Text className="text-lg font-medium text-gray-900">Sao lưu tin nhắn</Text>
          <Text className="text-sm text-gray-500">Xuất/nhập tin nhắn của bạn dưới dạng file ZIP.</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <TouchableOpacity
          className={`px-4 py-2 rounded-md ${exporting ? 'bg-blue-200' : 'bg-blue-50'}`}
          onPress={handleExport}
          disabled={exporting}
        >
          <Text className={`font-medium ${exporting ? 'text-blue-600' : 'text-blue-700'}`}>
            {exporting ? 'Đang xuất...' : 'Xuất sao lưu'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-4 py-2 rounded-md ${importing ? 'bg-green-200' : 'bg-green-50'}`}
          onPress={handleImport}
          disabled={importing}
        >
          <Text className={`font-medium ${importing ? 'text-green-600' : 'text-green-700'}`}>
            {importing ? 'Đang nhập...' : 'Nhập sao lưu'}
          </Text>
        </TouchableOpacity>
      </View>
      {importing && (
        <View className="mt-3 flex-row items-center space-x-2">
          <ActivityIndicator size="small" color="#10B981" />
          <Text className="text-sm text-gray-600">
            Đang khôi phục tin nhắn{importingProgress != null ? ` (${importingProgress}%)` : '...'}
          </Text>
        </View>
      )}
      {statusMessage && !importing && (
        <View className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <Text className="text-sm text-gray-700">{statusMessage}</Text>
        </View>
      )}
    </View>
  );
}
