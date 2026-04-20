/**
 * AttachmentQueue.tsx
 * Hàng chờ file/ảnh/video phía trên ô nhập tin nhắn (giống Zalo).
 * - Hiển thị thumbnail cho ảnh, icon play cho video, icon document cho file
 * - Nút ✕ xoá từng item
 * - Nút ➕ thêm file
 */

import React from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

export type PendingAsset = DocumentPicker.DocumentPickerAsset & {
    /** local preview URI (same as .uri on native; object-URL on web) */
    previewUri?: string;
};

interface AttachmentQueueProps {
    items: PendingAsset[];
    onRemove: (index: number) => void;
    onAddMore: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isImageMime(mimeType?: string | null) {
    return Boolean(mimeType && mimeType.startsWith('image/'));
}
function isVideoMime(mimeType?: string | null) {
    return Boolean(mimeType && mimeType.startsWith('video/'));
}

function getFileIconName(mimeType?: string | null): { name: keyof typeof Ionicons.glyphMap; color: string } {
    if (!mimeType) return { name: 'document-outline', color: '#6b7280' };
    if (mimeType.includes('pdf')) return { name: 'document-text-outline', color: '#ef4444' };
    if (mimeType.includes('word') || mimeType.includes('document')) return { name: 'document-text-outline', color: '#3b82f6' };
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return { name: 'grid-outline', color: '#10b981' };
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return { name: 'easel-outline', color: '#f97316' };
    if (mimeType.includes('zip') || mimeType.includes('rar')) return { name: 'archive-outline', color: '#8b5cf6' };
    if (mimeType.startsWith('audio/')) return { name: 'musical-notes-outline', color: '#f59e0b' };
    return { name: 'document-outline', color: '#6b7280' };
}

function shortName(name: string, maxLen = 12): string {
    if (name.length <= maxLen) return name;
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    return name.slice(0, maxLen - ext.length - 1) + '…' + ext;
}

// ─── Single thumbnail cell ────────────────────────────────────────────────────

const CELL = 72;

function QueueItem({ item, index, onRemove }: {
    item: PendingAsset;
    index: number;
    onRemove: () => void;
}) {
    const img = isImageMime(item.mimeType);
    const vid = isVideoMime(item.mimeType);
    const previewSrc = item.previewUri || item.uri;

    return (
        <View style={{
            width: CELL,
            height: CELL,
            marginRight: 8,
            borderRadius: 10,
            overflow: 'visible',
        }}>
            {/* Thumbnail / icon */}
            <View style={{
                width: CELL,
                height: CELL,
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: '#f3f4f6',
                borderWidth: 1.5,
                borderColor: '#e5e7eb',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {img && previewSrc ? (
                    <Image
                        source={{ uri: previewSrc }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                ) : vid ? (
                    <View style={{ flex: 1, width: '100%', backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.85)" />
                        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, marginTop: 2, paddingHorizontal: 4 }} numberOfLines={1}>
                            {shortName(item.name ?? 'video', 10)}
                        </Text>
                    </View>
                ) : (
                    <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                        {(() => {
                            const { name: iconName, color } = getFileIconName(item.mimeType);
                            return (
                                <>
                                    <Ionicons name={iconName} size={24} color={color} />
                                    <Text style={{ fontSize: 9, color: '#6b7280', marginTop: 2, textAlign: 'center' }} numberOfLines={2}>
                                        {shortName(item.name ?? 'file', 12)}
                                    </Text>
                                </>
                            );
                        })()}
                    </View>
                )}

                {/* Video duration badge placeholder */}
                {vid && (
                    <View style={{
                        position: 'absolute', bottom: 2, left: 2,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
                    }}>
                        <Ionicons name="videocam" size={9} color="#fff" />
                    </View>
                )}
            </View>

            {/* Remove button */}
            <TouchableOpacity
                onPress={onRemove}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: '#ef4444',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: '#fff',
                    zIndex: 10,
                }}
            >
                <Ionicons name="close" size={11} color="white" />
            </TouchableOpacity>
        </View>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttachmentQueue({ items, onRemove, onAddMore }: AttachmentQueueProps) {
    if (items.length === 0) return null;

    return (
        <View style={{
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            backgroundColor: '#fff',
            paddingHorizontal: 12,
            paddingVertical: 10,
        }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="attach" size={14} color="#6b7280" />
                <Text style={{ fontSize: 12, color: '#6b7280', marginLeft: 4, flex: 1 }}>
                    {items.length} tệp đính kèm
                </Text>
                <Text style={{ fontSize: 11, color: '#9ca3af' }}>Nhấn ✕ để bỏ</Text>
            </View>

            {/* Horizontal scroll of thumbnails */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 4 }}
            >
                {items.map((item, idx) => (
                    <QueueItem
                        key={`${item.uri}-${idx}`}
                        item={item}
                        index={idx}
                        onRemove={() => onRemove(idx)}
                    />
                ))}

                {/* Add more button */}
                <TouchableOpacity
                    onPress={onAddMore}
                    style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        borderColor: '#93c5fd',
                        backgroundColor: '#eff6ff',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Ionicons name="add" size={24} color="#3b82f6" />
                    <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 2 }}>Thêm</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
