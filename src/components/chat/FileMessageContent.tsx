import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { Attachment } from '@/src/models/Attachment';
import { Video, ResizeMode, Audio } from 'expo-av';
import { URL_BE } from '@/src/constants/ApiConstant';
import { downloadSingleItem } from '@/src/utils/FileDownloadUtil';

interface FileMessageContentProps {
    messageId: string;
    fileName: string;
    isSender: boolean;
    getAttachment: (messageId: string) => Promise<Attachment | null>;
    onImagePress: (url: string) => void;
    metadata?: Record<string, unknown> | null;
    mediaKind?: "image" | "video" | "file";
}

type GLYPHS = keyof typeof Ionicons.glyphMap;

// ─── helpers ────────────────────────────────────────────────────────────────

function guessKindFromFileName(name: string): 'image' | 'video' | 'file' {
    const n = name.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n)) return 'image';
    if (/\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(n)) return 'video';
    return 'file';
}

function resolveMediaUrl(url: string): string {
    const u = url.trim();
    if (!u) return u;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (u.startsWith('/')) return `${URL_BE}${u}`;
    return `${URL_BE}/${u}`;
}

function attachmentFromMetadata(
    meta: Record<string, unknown> | null | undefined,
    fallbackName: string,
    mediaKind: "image" | "video" | "file"
): Attachment | null {
    const cdnUrl = meta?.cdnUrl != null ? resolveMediaUrl(String(meta.cdnUrl)) : '';
    if (!cdnUrl.trim()) return null;
    let mimeType = meta?.mimeType != null ? String(meta.mimeType).trim() : '';
    if (!mimeType || mimeType === "application/octet-stream") {
        if (mediaKind === "image") mimeType = "image/jpeg";
        else if (mediaKind === "video") mimeType = "video/mp4";
        else mimeType = "application/octet-stream";
    }
    const name = meta?.fileName != null ? String(meta.fileName) : fallbackName;
    const size = typeof meta?.fileSize === "number" ? meta.fileSize : 0;
    return { id: "", messageId: "", url: cdnUrl, fileType: mimeType, fileName: name, size };
}

function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileExt(name: string): string {
    const m = name.match(/\.([^.]+)$/);
    return m ? m[1].toUpperCase() : 'FILE';
}

// ─── dimension helpers ───────────────────────────────────────────────────────

/**
 * Given real image dimensions, compute the display size for a message bubble.
 * Rules:
 *   - Portrait (h > w): max-height = MAX_H, width scales proportionally, capped at maxW
 *   - Landscape (w >= h): max-width = maxW, height scales proportionally, capped at MAX_H
 *   - Min 80px each side
 */
function computeDisplaySize(
    realW: number,
    realH: number,
    maxW: number,
    maxH: number
): { width: number; height: number } {
    if (realW <= 0 || realH <= 0) return { width: maxW, height: maxH * 0.75 };

    const isPortrait = realH > realW;

    let w: number, h: number;
    if (isPortrait) {
        h = Math.min(maxH, realH);
        w = (realW / realH) * h;
        if (w > maxW) { w = maxW; h = (realH / realW) * w; }
    } else {
        w = Math.min(maxW, realW);
        h = (realH / realW) * w;
        if (h > maxH) { h = maxH; w = (realW / realH) * h; }
    }

    return {
        width: Math.max(80, Math.round(w)),
        height: Math.max(80, Math.round(h)),
    };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Small label overlay (filename / type badge) */
function MediaOverlayLabel({ label, icon }: { label: string; icon?: GLYPHS }) {
    return (
        <View
            style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                backgroundColor: 'rgba(0,0,0,0.52)',
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 6,
                paddingVertical: 2,
            }}
        >
            {icon && <Ionicons name={icon} size={11} color="white" style={{ marginRight: 3 }} />}
            <Text style={{ color: 'white', fontSize: 11 }} numberOfLines={1}>{label}</Text>
        </View>
    );
}

/** File type icon / colour based on extension */
function getFileIcon(fileType: string | undefined): { icon: GLYPHS; color: string } {
    if (!fileType) return { icon: 'document-outline', color: '#6b7280' };
    if (fileType.startsWith('image/')) return { icon: 'image-outline', color: '#8b5cf6' };
    if (fileType.startsWith('video/')) return { icon: 'videocam-outline', color: '#ef4444' };
    if (fileType.startsWith('audio/')) return { icon: 'musical-notes-outline', color: '#f59e0b' };
    if (fileType.includes('pdf')) return { icon: 'document-text-outline', color: '#ef4444' };
    if (fileType.includes('word') || fileType.includes('document')) return { icon: 'document-text-outline', color: '#3b82f6' };
    if (fileType.includes('excel') || fileType.includes('sheet')) return { icon: 'grid-outline', color: '#10b981' };
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return { icon: 'easel-outline', color: '#f97316' };
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('compressed')) return { icon: 'archive-outline', color: '#6b7280' };
    if (fileType.includes('text')) return { icon: 'document-text-outline', color: '#64748b' };
    return { icon: 'document-outline', color: '#6b7280' };
}

// ─── Main Component ───────────────────────────────────────────────────────────

const FileMessageContent = ({
    messageId,
    fileName,
    isSender,
    getAttachment,
    onImagePress,
    metadata,
    mediaKind = "file",
}: FileMessageContentProps) => {
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioDurationMs, setAudioDurationMs] = useState(0);
    const [audioPositionMs, setAudioPositionMs] = useState(0);
    const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
    const videoRef = useRef<Video>(null);
    const audioRef = useRef<Audio.Sound | null>(null);

    // ─── Responsive sizing ───────────────────────────────────────────────
    const screen = Dimensions.get('window');
    const isWeb = Platform.OS === 'web';

    // On web the "window" is the whole browser — use a sensible cap
    // On mobile, 72% of screen width keeps it inside the bubble nicely
    const maxW = isWeb
        ? Math.min(420, screen.width * 0.38)   // web: up to 420 px, max 38% viewport
        : screen.width * 0.68;                  // mobile: 68% screen width

    const maxH = isWeb ? 520 : 400;

    // ─── Fetch attachment ────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
            setLoading(true);
            const kind = mediaKind !== 'file' ? mediaKind : guessKindFromFileName(fileName);
            const fromMeta = attachmentFromMetadata(metadata, fileName, kind);
            const resolved = fromMeta ?? await getAttachment(messageId);
            if (!cancelled) {
                setAttachment(resolved);
                setLoading(false);
            }
        };
        fetch();
        return () => { cancelled = true; };
    }, [messageId, metadata, fileName, mediaKind]);

    // ─── Image dimension detection ───────────────────────────────────────
    useEffect(() => {
        if (!attachment?.url || !attachment.fileType?.startsWith('image/')) {
            setImgSize(null);
            return;
        }
        let cancelled = false;
        Image.getSize(
            attachment.url,
            (w, h) => { if (!cancelled) setImgSize(computeDisplaySize(w, h, maxW, maxH)); },
            () => { if (!cancelled) setImgSize(computeDisplaySize(4, 3, maxW, maxH)); }  // landscape fallback
        );
        return () => { cancelled = true; };
    }, [attachment?.url]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.unloadAsync().catch(() => {});
                audioRef.current = null;
            }
        };
    }, []);

    // ─── Video play/pause ────────────────────────────────────────────────
    const handleVideoPress = async () => {
        if (!videoRef.current) return;
        try {
            const status = await videoRef.current.getStatusAsync();
            if (status.isLoaded) {
                if (status.isPlaying) {
                    await videoRef.current.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await videoRef.current.playAsync();
                    setIsPlaying(true);
                }
            }
        } catch (e) { console.error(e); }
    };

    const onVideoStatus = (status: any) => {
        if (status.isLoaded) setIsPlaying(status.isPlaying);
    };

    // ─── Media type flags ────────────────────────────────────────────────
    const isImage = attachment?.fileType?.startsWith('image/');
    const isVideo = attachment?.fileType?.startsWith('video/');
    const isAudio = attachment?.fileType?.startsWith('audio/');

    const formatMs = (ms: number): string => {
        const sec = Math.max(0, Math.floor(ms / 1000));
        const mm = Math.floor(sec / 60);
        const ss = sec % 60;
        return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    };

    const waveformBars = useMemo(() => {
        const seedText = `${messageId}-${attachment?.fileName ?? fileName}`;
        let seed = 0;
        for (let i = 0; i < seedText.length; i++) {
            seed = (seed * 31 + seedText.charCodeAt(i)) % 9973;
        }
        return Array.from({ length: 26 }, (_, idx) => {
            const value = (seed + idx * 17) % 100;
            return 6 + Math.round((value / 100) * 16); // 6..22
        });
    }, [messageId, attachment?.fileName, fileName]);

    const handleAudioStatusUpdate = (status: any) => {
        if (!status?.isLoaded) return;
        setAudioPositionMs(status.positionMillis ?? 0);
        setAudioDurationMs(status.durationMillis ?? 0);
        setIsAudioPlaying(Boolean(status.isPlaying));
        if (status.didJustFinish) {
            setIsAudioPlaying(false);
            setAudioPositionMs(0);
        }
    };

    const toggleAudioPlayback = async () => {
        if (!attachment?.url) return;
        try {
            if (!audioRef.current) {
                const { sound, status } = await Audio.Sound.createAsync(
                    { uri: attachment.url },
                    { shouldPlay: true },
                    handleAudioStatusUpdate
                );
                audioRef.current = sound;
                if ((status as any)?.isLoaded) {
                    setAudioDurationMs((status as any).durationMillis ?? 0);
                    setAudioPositionMs((status as any).positionMillis ?? 0);
                    setIsAudioPlaying(Boolean((status as any).isPlaying));
                }
                return;
            }
            const status = await audioRef.current.getStatusAsync();
            if (!(status as any).isLoaded) return;
            if ((status as any).isPlaying) {
                await audioRef.current.pauseAsync();
            } else {
                await audioRef.current.playAsync();
            }
        } catch (e) {
            console.error("audio playback error", e);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Loading state
    if (loading) {
        return (
            <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 140 }}>
                <View style={{
                    width: 40, height: 40, borderRadius: 8,
                    backgroundColor: isSender ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
                    alignItems: 'center', justifyContent: 'center', marginRight: 10,
                }}>
                    <Ionicons name="hourglass-outline" size={22} color={isSender ? '#fff' : '#9ca3af'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: isSender ? '#fff' : '#111827', fontWeight: '500' }} numberOfLines={1}>{fileName}</Text>
                    <Text style={{ color: isSender ? 'rgba(255,255,255,0.65)' : '#6b7280', fontSize: 12, marginTop: 2 }}>Đang tải…</Text>
                </View>
            </View>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // IMAGE
    if (isImage && attachment?.url) {
        // While image size is being measured, use a placeholder w/h
        const { width: dw, height: dh } = imgSize ?? { width: maxW * 0.8, height: maxW * 0.6 };

        return (
            <TouchableOpacity
                onPress={() => onImagePress(attachment.url)}
                activeOpacity={0.88}
                style={{ borderRadius: 12, overflow: 'hidden' }}
            >
                <Image
                    source={{ uri: attachment.url }}
                    style={{ width: dw, height: dh, borderRadius: 12 }}
                    resizeMode="cover"
                />
                <TouchableOpacity
                    onPress={() => downloadSingleItem({ url: attachment.url, fileName, mimeType: attachment.fileType })}
                    style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 20, padding: 6, zIndex: 10 }}
                >
                    <Ionicons name="download-outline" size={16} color="white" />
                </TouchableOpacity>
                <MediaOverlayLabel label={fileName} />
            </TouchableOpacity>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIDEO
    if (isVideo && attachment?.url) {
        // Compute video display size from aspect ratio, correctly pinned to maxW/maxH.
        // assumePortrait → 9:16 ratio; landscape → 16:9.
        // We do NOT pass tiny numbers to computeDisplaySize because it uses Math.min(maxW, realW)
        // which would give realW (9 or 16) pixels — way too small!
        const assumePortrait = /portrait|vertical|story/i.test(attachment.fileName ?? '');

        let videoW: number, videoH: number;
        if (assumePortrait) {
            // Portrait 9:16
            videoH = Math.min(maxH, maxW * (16 / 9));
            videoW = videoH * (9 / 16);
            if (videoW > maxW) { videoW = maxW; videoH = videoW * (16 / 9); }
        } else {
            // Landscape 16:9
            videoW = maxW;
            videoH = maxW * (9 / 16);
            if (videoH > maxH) { videoH = maxH; videoW = videoH * (16 / 9); }
        }
        videoW = Math.round(videoW);
        videoH = Math.round(videoH);

        // On web — use native HTML5 <video> controls via expo-av's useNativeControls
        return (
            <View style={{ borderRadius: 12, overflow: 'hidden', width: videoW, height: videoH }}>
                {isWeb ? (
                    // Web: full native controls, no overlay needed
                    <Video
                        ref={videoRef}
                        source={{ uri: attachment.url }}
                        style={{ width: videoW, height: videoH }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        onPlaybackStatusUpdate={onVideoStatus}
                        shouldPlay={false}
                    />
                ) : (
                    // Mobile: tap-to-play with play/pause overlay
                    <TouchableOpacity onPress={handleVideoPress} activeOpacity={0.9} style={{ flex: 1 }}>
                        <Video
                            ref={videoRef}
                            source={{ uri: attachment.url }}
                            style={{ width: videoW, height: videoH }}
                            useNativeControls={false}
                            resizeMode={ResizeMode.CONTAIN}
                            onPlaybackStatusUpdate={onVideoStatus}
                            shouldPlay={false}
                            isLooping
                        />
                        {/* Play/Pause overlay */}
                        <View style={{
                            position: 'absolute', inset: 0,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isPlaying ? 'transparent' : 'rgba(0,0,0,0.28)',
                        }}>
                            {!isPlaying && (
                                <View style={{
                                    backgroundColor: 'rgba(255,255,255,0.28)',
                                    borderRadius: 999, padding: 12,
                                }}>
                                    <Ionicons name="play" size={28} color="white" />
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => downloadSingleItem({ url: attachment.url, fileName, mimeType: attachment.fileType })}
                            style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 20, padding: 6, zIndex: 10 }}
                        >
                            <Ionicons name="download-outline" size={16} color="white" />
                        </TouchableOpacity>
                        <MediaOverlayLabel label={attachment.fileName ?? fileName} icon="videocam" />
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AUDIO
    if (isAudio && attachment?.url) {
        const progress = audioDurationMs > 0 ? Math.min(1, audioPositionMs / audioDurationMs) : 0;
        const playedBars = Math.round(waveformBars.length * progress);
        return (
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isSender ? 'rgba(255,255,255,0.15)' : '#f3f4f6',
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                minWidth: 220,
                maxWidth: maxW,
            }}>
                <TouchableOpacity
                    onPress={toggleAudioPlayback}
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSender ? 'rgba(255,255,255,0.25)' : '#E5E7EB',
                        marginRight: 10,
                    }}
                >
                    <Ionicons name={isAudioPlaying ? 'pause' : 'play'} size={18} color={isSender ? '#fff' : '#374151'} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: isSender ? '#fff' : '#111827', fontWeight: '600' }}>
                        Ghi âm thoại
                    </Text>
                    <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 24 }}>
                        {waveformBars.map((barHeight, index) => {
                            const isPlayed = index < playedBars;
                            return (
                                <View
                                    key={`wave-${index}`}
                                    style={{
                                        width: 3,
                                        height: barHeight,
                                        borderRadius: 2,
                                        backgroundColor: isPlayed
                                            ? (isSender ? '#FFFFFF' : '#2563EB')
                                            : (isSender ? 'rgba(255,255,255,0.35)' : '#D1D5DB'),
                                    }}
                                />
                            );
                        })}
                    </View>
                    <Text style={{ marginTop: 4, fontSize: 11, color: isSender ? 'rgba(255,255,255,0.9)' : '#6B7280' }}>
                        {formatMs(audioPositionMs)} / {formatMs(audioDurationMs)}
                    </Text>
                </View>
            </View>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GENERIC FILE — rich card
    const { icon, color } = getFileIcon(attachment?.fileType);
    const ext = getFileExt(attachment?.fileName ?? fileName);
    const sizeText = formatFileSize(attachment?.size ?? 0);
    const displayName = attachment?.fileName ?? fileName;

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isSender ? 'rgba(255,255,255,0.15)' : '#f3f4f6',
            borderRadius: 12,
            padding: 10,
            minWidth: 180,
            maxWidth: maxW,
        }}>
            {/* File icon badge */}
            <View style={{
                width: 46, height: 46, borderRadius: 10,
                backgroundColor: isSender ? 'rgba(255,255,255,0.2)' : '#fff',
                alignItems: 'center', justifyContent: 'center',
                marginRight: 10,
                borderWidth: 1,
                borderColor: isSender ? 'rgba(255,255,255,0.18)' : '#e5e7eb',
            }}>
                <Ionicons name={icon} size={24} color={isSender ? '#fff' : color} />
                {/* Extension badge */}
                <View style={{
                    position: 'absolute', bottom: -4, right: -4,
                    backgroundColor: isSender ? 'rgba(255,255,255,0.85)' : color,
                    borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1,
                }}>
                    <Text style={{ fontSize: 8, color: isSender ? color : '#fff', fontWeight: '700' }}>{ext}</Text>
                </View>
            </View>

            {/* File info */}
            <View style={{ flex: 1 }}>
                <Text
                    style={{ color: isSender ? '#fff' : '#111827', fontWeight: '600', fontSize: 14 }}
                    numberOfLines={2}
                >
                    {displayName}
                </Text>
                {sizeText ? (
                    <Text style={{ color: isSender ? 'rgba(255,255,255,0.65)' : '#6b7280', fontSize: 11, marginTop: 2 }}>
                        {sizeText}
                    </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                        style={{
                            marginTop: 6,
                            backgroundColor: isSender ? 'rgba(255,255,255,0.22)' : '#ede9fe',
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            alignSelf: 'flex-start',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                        }}
                        onPress={() => { if (attachment?.url) Linking.openURL(attachment.url); }}
                    >
                        <Ionicons name="open-outline" size={12} color={isSender ? '#fff' : color} />
                        <Text style={{ fontSize: 12, color: isSender ? '#fff' : color, fontWeight: '600' }}>
                            Mở
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            marginTop: 6,
                            backgroundColor: isSender ? 'rgba(255,255,255,0.22)' : '#ede9fe',
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            alignSelf: 'flex-start',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                        }}
                        onPress={() => downloadSingleItem({ url: attachment.url, fileName: displayName, mimeType: attachment.fileType })}
                    >
                        <Ionicons name="download-outline" size={12} color={isSender ? '#fff' : color} />
                        <Text style={{ fontSize: 12, color: isSender ? '#fff' : color, fontWeight: '600' }}>
                            Tải về
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

export default FileMessageContent;