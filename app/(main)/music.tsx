import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, Image, TouchableOpacity,
  ScrollView, Platform, TextInput, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ── Track list ──────────────────────────────────────────────────────────────
const TRACKS = [
  { id: 1,  title: "Lắng Nghe Nước Mắt",               artist: "Mr. Siro",       url: "https://soundcloud.com/m-nh-735721498/lang-nghe-nuoc-mat-mr-siro" },
  { id: 2,  title: "Tháng Tư Là Lời Nói Dối Của Em",   artist: "Hà Anh Tuấn",    url: "https://soundcloud.com/haanhtuan-music/th-ng-t-l-l-i-n-i-d-i-c-a-em" },
  { id: 3,  title: "Chắc Ai Đó Sẽ Về",                 artist: "Sơn Tùng M-TP",  url: "https://soundcloud.com/chu-quoc-viet/chac-ai-do-se-ve-ost-chang-trai-nam-ay-son-tung-m-tp" },
  { id: 4,  title: "Âm Thầm Bên Em (8D)",              artist: "Sơn Tùng M-TP",  url: "https://soundcloud.com/hidro_natri311004/am-tham-ben-em-son-tung-m-tp-8d-audio" },
  { id: 5,  title: "Vết Mưa",                          artist: "Vũ",             url: "https://soundcloud.com/dung-tran-51117479/v-t-m-a-v-c-t-t-ng" },
  { id: 6,  title: "Tìm Được Nhau Khó Thế Nào",        artist: "Mr. Siro",       url: "https://soundcloud.com/mangca/mr-liro-tim-duoc-nhau-kho-the-nao" },
  { id: 7,  title: "Tình Yêu Chắp Vá",                 artist: "Mr. Siro",       url: "https://soundcloud.com/hieu-th/tinh-yeu-chap-va-mrsiro" },
  { id: 8,  title: "Xao Xuyến Remix",                  artist: "Mr. Siro",       url: "https://soundcloud.com/h-ng-gia-13543967/xao-xuye-n-remix-mrsiro" },
  { id: 9,  title: "Đừng Lo Anh Đợi Mà",              artist: "Mr. Siro",       url: "https://soundcloud.com/user-553628931/dung-lo-anh-doi-ma-mr-siro" },
  { id: 10, title: "1 Bước Yêu Vạn Dặm Đau",          artist: "Lê Bảo Bình",    url: "https://soundcloud.com/c-minh-tr-n-160098783/vid_20240702035932-mp3" },
].map((t, i) => ({
  ...t,
  cover: `https://picsum.photos/seed/music${i+1}/400/400`,
  embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(t.url)}&color=%238b5cf6&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`,
}));

type Track = typeof TRACKS[0];

// ── SoundCloud Widget API helper (web only) ─────────────────────────────────
function useSCWidget(iframeRef: React.RefObject<any>) {
  const widgetRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const initWidget = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const w = window as any;
    if (!w.SC || !iframeRef.current) return;
    const widget = w.SC.Widget(iframeRef.current);
    widgetRef.current = widget;
    widget.bind(w.SC.Widget.Events.READY, () => setReady(true));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w = window as any;
    if (w.SC) { initWidget(); return; }
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.onload = initWidget;
    document.head.appendChild(script);
  }, [initWidget]);

  return { widget: widgetRef, ready };
}

// ── PlaylistItem row ────────────────────────────────────────────────────────
function TrackRow({ track, active, playing, onPress }: {
  track: Track; active: boolean; playing: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
        paddingHorizontal: 12, borderRadius: 14, marginBottom: 4,
        backgroundColor: active ? '#F5F3FF' : 'transparent',
      }}
    >
      <View style={{ position: 'relative', width: 44, height: 44, borderRadius: 10, overflow: 'hidden', marginRight: 12 }}>
        <Image source={{ uri: track.cover }} style={{ width: 44, height: 44 }} resizeMode="cover" />
        {active && (
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(139,92,246,0.55)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={playing ? "pause" : "play"} size={18} color="white" />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? '#7C3AED' : '#1E293B' }}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{track.artist}</Text>
      </View>
      {active && (
        <View style={{ flexDirection: 'row', gap: 3, marginLeft: 8 }}>
          {[0,1,2].map(i => (
            <View key={i} style={{
              width: 3, height: playing ? 12 + i * 4 : 6, borderRadius: 2, backgroundColor: '#8B5CF6',
              opacity: playing ? 1 : 0.4,
            }} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────
export default function MusicScreen() {
  const [idx,       setIdx]      = useState(0);
  const [playing,   setPlaying]  = useState(false);
  const [progress,  setProgress] = useState(0);  // 0..1
  const [shuffle,   setShuffle]  = useState(false);
  const [repeat,    setRepeat]   = useState(false);
  const [search,    setSearch]   = useState('');
  const [duration,  setDuration] = useState(0);
  const [position,  setPosition] = useState(0);

  const iframeRef = useRef<any>(null);
  const { widget, ready } = useSCWidget(iframeRef);

  const filtered = search.trim()
    ? TRACKS.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.artist.toLowerCase().includes(search.toLowerCase()))
    : TRACKS;

  const current = TRACKS[idx];

  // ── Bind SC events when widget is ready ──
  useEffect(() => {
    if (!ready || !widget.current) return;
    const w = window as any;
    const ev = w.SC.Widget.Events;

    widget.current.bind(ev.PLAY,  () => setPlaying(true));
    widget.current.bind(ev.PAUSE, () => setPlaying(false));
    widget.current.bind(ev.FINISH, () => {
      if (repeat) { widget.current.seekTo(0); widget.current.play(); }
      else handleNext();
    });
    widget.current.bind(ev.PLAY_PROGRESS, (d: any) => {
      setProgress(d.relativePosition ?? 0);
      setPosition(d.currentPosition ?? 0);
    });
    widget.current.bind(ev.READY, () => {
      widget.current.getDuration((d: number) => setDuration(d));
    });
  }, [ready]);

  // ── Load new track when idx changes ──
  useEffect(() => {
    if (!ready || !widget.current) return;
    const w = window as any;
    widget.current.load(current.url, {
      auto_play: playing,
      callback: () => widget.current.getDuration((d: number) => setDuration(d)),
    });
    setProgress(0); setPosition(0);
  }, [idx, ready]);

  const handlePlayPause = () => {
    if (!widget.current) return;
    playing ? widget.current.pause() : widget.current.play();
  };

  const handleNext = useCallback(() => {
    setIdx(prev => {
      if (shuffle) return Math.floor(Math.random() * TRACKS.length);
      return (prev + 1) % TRACKS.length;
    });
  }, [shuffle]);

  const handlePrev = useCallback(() => {
    if (position > 3000) { widget.current?.seekTo(0); return; }
    setIdx(prev => (prev - 1 + TRACKS.length) % TRACKS.length);
  }, [position]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  };

  const handleProgressClick = (e: any) => {
    if (Platform.OS !== 'web' || !widget.current || !duration) return;
    const rect = e.nativeEvent.target?.getBoundingClientRect?.();
    if (!rect) return;
    const x = e.nativeEvent.clientX - rect.left;
    const pct = x / rect.width;
    widget.current.seekTo(pct * duration);
  };

  // ── Expose state + controls to window so WebMusicShortcut can access ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w = window as any;
    w.__zalaMusicState = {
      song: {
        title: current.title,
        artist: current.artist,
        cover: current.cover,
        source: 'soundcloud',
      },
      isPlaying: playing,
      progress: progress * 100,  // 0..100 for compatibility
    };
    w.__scOnPlayPause = handlePlayPause;
    w.__scOnNext     = handleNext;
    w.__scOnPrev     = handlePrev;
  }, [playing, progress, idx, current, handlePlayPause, handleNext, handlePrev]);


  // ── Non-web fallback ──
  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="musical-notes-outline" size={48} color="#8B5CF6" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#64748B', textAlign: 'center', paddingHorizontal: 32 }}>
          Tính năng nghe nhạc chỉ hoạt động trên web
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0F0A1E', flexDirection: 'row' }}>

      {/* ── Left: Now Playing ───────────────────────────── */}
      <View style={{ width: 360, padding: 24, justifyContent: 'space-between' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Zala Music</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setShuffle(s => !s)}>
              <Ionicons name="shuffle" size={20} color={shuffle ? '#A78BFA' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setRepeat(r => !r)}>
              <Ionicons name="repeat" size={20} color={repeat ? '#A78BFA' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Album Art */}
        <View style={{ alignSelf: 'center', marginBottom: 28 }}>
          <View style={{ width: 220, height: 220, borderRadius: 24, overflow: 'hidden', shadowColor: '#8B5CF6', shadowRadius: 40, shadowOpacity: 0.5, elevation: 20 }}>
            <Image source={{ uri: current.cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
        </View>

        {/* Title */}
        <View style={{ marginBottom: 20 }}>
          <Text numberOfLines={1} style={{ color: 'white', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{current.title}</Text>
          <Text numberOfLines={1} style={{ color: '#A78BFA', fontSize: 14, textAlign: 'center', marginTop: 4 }}>{current.artist}</Text>
        </View>

        {/* Progress bar */}
        <View style={{ marginBottom: 20 }}>
          <View
            onStartShouldSetResponder={() => true}
            onResponderGrant={handleProgressClick}
            style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, marginBottom: 8, cursor: 'pointer' } as any}
          >
            <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: '#8B5CF6', borderRadius: 4 }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{fmt(position)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{fmt(duration)}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
          <TouchableOpacity onPress={handlePrev}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play-skip-back" size={22} color="white" />
          </TouchableOpacity>

          <TouchableOpacity onPress={handlePlayPause}
            style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center', shadowColor: '#8B5CF6', shadowRadius: 20, shadowOpacity: 0.7 }}>
            <Ionicons name={playing ? "pause" : "play"} size={30} color="white" style={{ marginLeft: playing ? 0 : 3 }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNext}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play-skip-forward" size={22} color="white" />
          </TouchableOpacity>
        </View>

        {/* Hidden SC iframe — controlled via Widget API */}
        {/* @ts-ignore */}
        <iframe
          ref={iframeRef}
          title="sc-player"
          src={current.embedUrl}
          style={{ width: 1, height: 1, position: 'absolute', opacity: 0, pointerEvents: 'none', bottom: 0, left: 0 }}
          allow="autoplay"
        />
      </View>

      {/* ── Right: Playlist ─────────────────────────────── */}
      <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 32, borderBottomLeftRadius: 32, padding: 24, overflow: 'hidden' }}>
        {/* Search */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            placeholder="Tìm bài hát, nghệ sĩ..."
            placeholderTextColor="#CBD5E1"
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, marginLeft: 10, fontSize: 14, color: '#1E293B', outline: 'none' } as any}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>Danh sách phát</Text>
          <Text style={{ fontSize: 13, color: '#94A3B8' }}>{filtered.length} bài</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {filtered.map(track => {
            const gIdx = TRACKS.findIndex(t => t.id === track.id);
            return (
              <TrackRow
                key={track.id}
                track={track}
                active={gIdx === idx}
                playing={playing}
                onPress={() => {
                  if (gIdx === idx) { handlePlayPause(); }
                  else { setIdx(gIdx); setPlaying(true); }
                }}
              />
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
