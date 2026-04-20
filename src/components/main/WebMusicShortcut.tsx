import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Platform, Text, TouchableOpacity, View, Animated } from 'react-native';
import { useRouter } from 'expo-router';

type MiniSong = { title: string; artist: string; cover?: string; source?: string };
type MiniState = { song?: MiniSong | null; isPlaying?: boolean; progress?: number };

export default function WebMusicShortcut() {
    const router = useRouter();
    const [state, setState] = useState<MiniState>({ song: null, isPlaying: false, progress: 0 });
    const [visible, setVisible] = useState(false); // collapsed=FAB | expanded=full bar
    const barAnim = useRef(new Animated.Value(0)).current;   // 0=hidden 1=shown
    const eq1 = useRef(new Animated.Value(0.3)).current;
    const eq2 = useRef(new Animated.Value(0.6)).current;
    const eq3 = useRef(new Animated.Value(0.4)).current;

    // Poll window.__zalaMusicState every 400ms
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const t = setInterval(() => {
            const w = window as any;
            const s = w.__zalaMusicState || {};
            setState({
                song: s.song || null,
                isPlaying: !!s.isPlaying,
                progress: Number.isFinite(s.progress) ? s.progress : 0,
            });
        }, 400);
        return () => clearInterval(t);
    }, []);

    // Equalizer animation when playing
    useEffect(() => {
        if (!state.isPlaying) {
            [eq1, eq2, eq3].forEach(a => Animated.timing(a, { toValue: 0.3, duration: 200, useNativeDriver: false }).start());
            return;
        }
        const loop = (anim: Animated.Value, min: number, max: number, dur: number) =>
            Animated.loop(Animated.sequence([
                Animated.timing(anim, { toValue: max, duration: dur, useNativeDriver: false }),
                Animated.timing(anim, { toValue: min, duration: dur, useNativeDriver: false }),
            ]));
        const a1 = loop(eq1, 0.25, 1.0, 320);
        const a2 = loop(eq2, 0.15, 0.85, 450);
        const a3 = loop(eq3, 0.3, 0.95, 380);
        a1.start(); a2.start(); a3.start();
        return () => { a1.stop(); a2.stop(); a3.stop(); };
    }, [state.isPlaying]);

    // Slide bar in/out
    useEffect(() => {
        Animated.spring(barAnim, {
            toValue: visible ? 1 : 0,
            useNativeDriver: true,
            tension: 60, friction: 10,
        }).start();
    }, [visible]);

    const callFn = (key: '__scOnPlayPause' | '__scOnNext' | '__scOnPrev') => {
        const w = window as any;
        if (typeof w[key] === 'function') w[key]();
        else router.replace('/(main)/music');
    };

    const goMusic = () => router.replace('/(main)/music');

    if (Platform.OS !== 'web' || !state.song) return null;

    const coverSrc = state.song.cover ? { uri: state.song.cover } : undefined;
    const prog = Math.max(0, Math.min(100, state.progress || 0));

    // ── Collapsed FAB ──
    if (!visible) {
        return (
            <TouchableOpacity
                onPress={() => setVisible(true)}
                activeOpacity={0.9}
                style={{
                    position: 'absolute',
                    bottom: 24,
                    right: 24,
                    zIndex: 9999,
                    // Album cover as FAB
                    width: 56, height: 56, borderRadius: 28,
                    overflow: 'hidden',
                    shadowColor: '#000',
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 12,
                    borderWidth: 2,
                    borderColor: '#8B5CF6',
                }}
            >
                {coverSrc ? (
                    <Image source={coverSrc} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                    <View style={{ flex: 1, backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="musical-notes" size={22} color="#8B5CF6" />
                    </View>
                )}

                {/* Playing indicator dot */}
                {state.isPlaying && (
                    <View style={{
                        position: 'absolute', bottom: 3, right: 3,
                        width: 12, height: 12, borderRadius: 6,
                        backgroundColor: '#10B981', borderWidth: 2, borderColor: 'white',
                    }} />
                )}
            </TouchableOpacity>
        );
    }

    // ── Expanded mini player bar ──
    const translateY = barAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });

    return (
        <Animated.View style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            zIndex: 9999,
            transform: [{ translateY }],
        }}>
            <View style={{
                width: 320,
                backgroundColor: '#0F0A1E',
                borderRadius: 20,
                overflow: 'hidden',
                shadowColor: '#8B5CF6',
                shadowOpacity: 0.35,
                shadowRadius: 20,
                elevation: 16,
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.3)',
            }}>
                {/* Progress bar (top accent) */}
                <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <View style={{ height: '100%', width: `${prog}%`, backgroundColor: '#8B5CF6', borderRadius: 2 }} />
                </View>

                {/* Main row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
                    {/* Album art */}
                    <TouchableOpacity onPress={goMusic} activeOpacity={0.8}
                        style={{ width: 46, height: 46, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E1B4B' }}>
                        {coverSrc
                            ? <Image source={coverSrc} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="musical-notes" size={20} color="#8B5CF6" /></View>
                        }
                    </TouchableOpacity>

                    {/* Song info + equalizer */}
                    <TouchableOpacity style={{ flex: 1 }} onPress={goMusic} activeOpacity={0.7}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text numberOfLines={1} style={{ color: 'white', fontSize: 13, fontWeight: '700', flex: 1 }}>
                                {state.song.title}
                            </Text>
                            {/* Equalizer bars */}
                            {state.isPlaying && (
                                <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 14 }}>
                                    {[eq1, eq2, eq3].map((a, i) => (
                                        <Animated.View key={i} style={{
                                            width: 3, borderRadius: 2, backgroundColor: '#A78BFA',
                                            height: a.interpolate({ inputRange: [0, 1], outputRange: [3, 14] }),
                                        }} />
                                    ))}
                                </View>
                            )}
                        </View>
                        <Text numberOfLines={1} style={{ color: '#A78BFA', fontSize: 11 }}>
                            {state.song.artist}
                        </Text>
                    </TouchableOpacity>

                    {/* Controls */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TouchableOpacity
                            onPress={() => callFn('__scOnPrev')}
                            style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Ionicons name="play-skip-back" size={16} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => callFn('__scOnPlayPause')}
                            style={{
                                width: 38, height: 38, borderRadius: 19,
                                backgroundColor: '#8B5CF6',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Ionicons
                                name={state.isPlaying ? 'pause' : 'play'}
                                size={17} color="white"
                                style={{ marginLeft: state.isPlaying ? 0 : 2 }}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => callFn('__scOnNext')}
                            style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Ionicons name="play-skip-forward" size={16} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    </View>

                    {/* Close */}
                    <TouchableOpacity
                        onPress={() => setVisible(false)}
                        style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                </View>

                {/* Bottom: open music tab link */}
                <TouchableOpacity onPress={goMusic}
                    style={{ paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="musical-notes-outline" size={11} color="rgba(255,255,255,0.3)" />
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '500' }}>Mở tab Nhạc để xem thêm</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}
