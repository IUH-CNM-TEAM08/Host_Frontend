/**
 * VoiceRecorderSheet
 * Bottom sheet cho ghi âm giọng nói với 2 option:
 *  - Gửi voice message (AUDIO)
 *  - Chuyển thành text (Speech-to-Text)
 *
 * UI tối giản, dùng SVG thay emoji, trải nghiệm người dùng cao.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

// ── SVG Icons ──────────────────────────────────────────────────────

const MicIcon = ({ size = 28, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"
      fill={color}
      opacity={0.85}
    />
    <Path
      d="M19 10v2a7 7 0 0 1-14 0v-2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Line x1={12} y1={19} x2={12} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1={8} y1={23} x2={16} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const StopIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={4} y={4} width={16} height={16} rx={2} fill={color} />
  </Svg>
);

const SendVoiceIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 20V4l19 8-19 8Z" fill={color} />
  </Svg>
);

const TextConvertIcon = ({ size = 22, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 7V4h16v3M9 20h6M12 4v16"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CloseIcon = ({ size = 20, color = '#94a3b8' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 6 6 18M6 6l12 12"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const DeleteIcon = ({ size = 20, color = '#ef4444' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ── Types ──────────────────────────────────────────────────────────

type VoiceRecorderSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Callback khi user chọn "Gửi voice" — trả về blob audio */
  onSendVoice: (audioBlob: Blob, durationSeconds: number, mimeType: string) => void;
  /** Callback khi user chọn "Chuyển thành text" — trả về string text */
  onConvertedText: (text: string) => void;
};

type RecordState = 'idle' | 'recording' | 'recorded' | 'transcribing';

// ── Helpers ───────────────────────────────────────────────────────

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ── Component ─────────────────────────────────────────────────────

export default function VoiceRecorderSheet({
  visible,
  onClose,
  onSendVoice,
  onConvertedText,
}: VoiceRecorderSheetProps) {
  const [state, setState] = useState<RecordState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 24 }, () => 4));
  const [transcribeError, setTranscribeError] = useState('');

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const nativeRecordingRef = useRef<Audio.Recording | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioUriRef = useRef<string | null>(null);
  const durationRef = useRef(0);
  const mimeTypeRef = useRef('audio/webm');
  // Web Speech API — chạy song song khi ghi âm, hoàn toàn FREE
  const speechRecRef = useRef<any>(null);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Animation
  const slideAnim = useRef(new Animated.Value(300)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Lifecycle ──
  useEffect(() => {
    if (visible) {
      setState('idle');
      setSeconds(0);
      setTranscribeError('');
      audioBlobRef.current = null;
      audioUriRef.current = null;
      setLiveTranscript('');
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      // Auto start recording
      setTimeout(() => startRecording(), 250);
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 180, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      cleanup();
    }
  }, [visible]);

  // Pulse animation for recording
  useEffect(() => {
    if (state === 'recording') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Timer
  useEffect(() => {
    if (state === 'recording') {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((p) => p + 1), 1000);
      // Waveform
      waveRef.current = setInterval(() => {
        setWaveform((prev) =>
          prev.map(() => Math.max(3, Math.floor(Math.random() * 22))),
        );
      }, 120);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (waveRef.current) clearInterval(waveRef.current);
    };
  }, [state]);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveRef.current) clearInterval(waveRef.current);
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    // Stop speech recognition
    try { speechRecRef.current?.stop(); } catch {} 
    speechRecRef.current = null;
  }, []);

  // ── Recording Logic ──

  const startRecording = async () => {
    setTranscribeError('');
    try {
      if (Platform.OS === 'web') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start();
        mimeTypeRef.current = 'audio/webm';
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (perm.status !== 'granted') {
          setTranscribeError('Cần cấp quyền microphone');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await recording.startAsync();
        nativeRecordingRef.current = recording;
        mimeTypeRef.current = 'audio/m4a';
      }
      setState('recording');
      // Khởi động Web Speech API song song (FREE, không cần API key)
      startSpeechRecognition();
    } catch (err) {
      console.error('startRecording error:', err);
      setTranscribeError('Không thể bắt đầu ghi âm');
    }
  };

  /** Web Speech API — chạy song song khi ghi âm để thu text realtime */
  const startSpeechRecognition = () => {
    if (Platform.OS !== 'web') return; // Chỉ hỗ trợ trên web
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return; // Browser không hỗ trợ
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN'; // Tiếng Việt
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let finalText = '';
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript + ' ';
          } else {
            interim += result[0].transcript;
          }
        }
        setLiveTranscript((finalText + interim).trim());
      };
      recognition.onerror = (e: any) => {
        console.warn('[SpeechRecognition] error:', e.error);
      };
      recognition.onend = () => {
        // Auto-restart nếu vẫn đang recording
        // (SpeechRecognition tự stop sau vài giây im lặng)
      };
      recognition.start();
      speechRecRef.current = recognition;
    } catch (err) {
      console.warn('[SpeechRecognition] not available:', err);
    }
  };

  const stopRecording = async (): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;
        const blob = await new Promise<Blob>((resolve) => {
          recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: 'audio/webm' }));
          recorder.stop();
        });
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioBlobRef.current = blob;
        durationRef.current = seconds;
      } else {
        const rec = nativeRecordingRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        nativeRecordingRef.current = null;
        audioUriRef.current = uri;
        durationRef.current = seconds;
        // Tạo blob từ URI cho mobile (fetch local file)
        if (uri) {
          const resp = await fetch(uri);
          audioBlobRef.current = await resp.blob();
        }
      }
      setState('recorded');
      // Stop speech recognition
      try { speechRecRef.current?.stop(); } catch {}
    } catch (err) {
      console.error('stopRecording error:', err);
      setTranscribeError('Lỗi khi dừng ghi âm');
    }
  };

  const handleDiscard = () => {
    cleanup();
    audioBlobRef.current = null;
    audioUriRef.current = null;
    setState('idle');
    onClose();
  };

  const handleSendVoice = () => {
    const blob = audioBlobRef.current;
    if (!blob) return;
    onSendVoice(blob, durationRef.current, mimeTypeRef.current);
    handleDiscard();
  };

  const handleConvertToText = async () => {
    // Dùng Web Speech API (FREE) — text đã được thu song song khi ghi âm
    const text = liveTranscript.trim();
    if (!text) {
      setTranscribeError('Không nhận dạng được giọng nói. Hãy thử nói rõ hơn hoặc dùng Chrome/Edge.');
      return;
    }
    onConvertedText(text);
    handleDiscard();
  };

  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      {/* Overlay */}
      <Pressable onPress={state === 'idle' ? onClose : undefined} style={{ flex: 1 }}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            opacity: overlayAnim,
          }}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={{
          transform: [{ translateY: slideAnim }],
          backgroundColor: '#1e293b',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'web' ? 24 : 36,
          paddingHorizontal: 20,
        }}
      >
        {/* Handle bar */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#475569',
            }}
          />
        </View>

        {/* ── RECORDING STATE ── */}
        {state === 'recording' && (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            {/* Pulse mic circle */}
            <Animated.View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#ef4444',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pulseAnim }],
                marginBottom: 16,
              }}
            >
              <MicIcon size={36} color="#fff" />
            </Animated.View>

            {/* Timer */}
            <Text
              style={{
                color: '#f1f5f9',
                fontSize: 28,
                fontWeight: '300',
                fontVariant: ['tabular-nums'],
                letterSpacing: 2,
              }}
            >
              {formatTime(seconds)}
            </Text>

            {/* Waveform */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                height: 28,
                gap: 2,
                marginTop: 16,
                marginBottom: 20,
              }}
            >
              {waveform.map((h, i) => (
                <View
                  key={i}
                  style={{
                    width: 3,
                    height: h,
                    borderRadius: 2,
                    backgroundColor: '#ef4444',
                    opacity: 0.7 + (h / 22) * 0.3,
                  }}
                />
              ))}
            </View>

            {/* Stop button */}
            <TouchableOpacity
              onPress={() => void stopRecording()}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#334155',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 999,
                gap: 8,
              }}
            >
              <StopIcon size={18} color="#f1f5f9" />
              <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '600' }}>
                Dừng ghi âm
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── RECORDED STATE ── */}
        {state === 'recorded' && (
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            {/* Duration summary */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#334155',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 12,
                gap: 8,
                marginBottom: 20,
              }}
            >
              <MicIcon size={18} color="#94a3b8" />
              <Text
                style={{
                  color: '#e2e8f0',
                  fontSize: 15,
                  fontVariant: ['tabular-nums'],
                }}
              >
                Ghi âm {formatTime(seconds)}
              </Text>
              <TouchableOpacity onPress={handleDiscard} style={{ marginLeft: 8 }}>
                <DeleteIcon size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {transcribeError ? (
              <Text
                style={{
                  color: '#fca5a5',
                  fontSize: 13,
                  marginBottom: 12,
                  textAlign: 'center',
                  paddingHorizontal: 12,
                }}
              >
                {transcribeError}
              </Text>
            ) : null}

            {/* Live transcript preview */}
            {liveTranscript ? (
              <View
                style={{
                  backgroundColor: '#1e1b4b',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: '#4338ca',
                  width: '100%',
                }}
              >
                <Text style={{ color: '#a5b4fc', fontSize: 11, marginBottom: 4, fontWeight: '600' }}>
                  {"Nh\u1EADn d\u1EA1ng \u0111\u01B0\u1EE3c:"}
                </Text>
                <Text style={{ color: '#e0e7ff', fontSize: 14, lineHeight: 20 }}>
                  {liveTranscript}
                </Text>
              </View>
            ) : null}

            {/* Two option buttons */}
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                width: '100%',
              }}
            >
              {/* Send as Voice */}
              <TouchableOpacity
                onPress={handleSendVoice}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  backgroundColor: '#3b82f6',
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <SendVoiceIcon size={24} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  Gửi voice
                </Text>
              </TouchableOpacity>

              {/* Convert to Text */}
              <TouchableOpacity
                onPress={() => void handleConvertToText()}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  backgroundColor: '#8b5cf6',
                  paddingVertical: 14,
                  borderRadius: 14,
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <TextConvertIcon size={24} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                  Chuyển text
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── TRANSCRIBING STATE ── */}
        {state === 'transcribing' && (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator size="large" color="#8b5cf6" />
            <Text
              style={{
                color: '#cbd5e1',
                fontSize: 15,
                marginTop: 16,
                fontWeight: '500',
              }}
            >
              Đang chuyển đổi giọng nói...
            </Text>
          </View>
        )}

        {/* ── IDLE STATE ── */}
        {state === 'idle' && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator size="small" color="#94a3b8" />
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>
              Đang khởi tạo microphone...
            </Text>
          </View>
        )}

        {/* Close / Cancel */}
        {state !== 'transcribing' && (
          <TouchableOpacity
            onPress={handleDiscard}
            activeOpacity={0.7}
            style={{
              alignSelf: 'center',
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 16,
            }}
          >
            <CloseIcon size={16} color="#64748b" />
            <Text style={{ color: '#64748b', fontSize: 14 }}>Hủy</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}
