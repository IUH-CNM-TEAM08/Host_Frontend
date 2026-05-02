import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ViewerCount } from '@/src/components/ViewerCount';
import DanmakuLayer, { DanmakuLayerRef } from './live/DanmakuLayer.web';
import GiftOverlay, { GiftOverlayRef } from './live/GiftOverlay.web';
import { STICKER_PACKS } from './chat/stickerAssets';
import LiveRegulationsModal from './live/LiveRegulationsModal';
import VipPurchaseModal from './live/VipPurchaseModal';
import SocketService from '@/src/api/socketCompat';
import axios from 'axios';

import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { LiveKitRoom, RoomAudioRenderer, useRoomContext, useParticipants, useChat, useParticipantTracks, useTracks, VideoTrack, useStartAudio } from '@livekit/components-react';
import { useUser } from '@/src/contexts/user/UserContext';
import { useLiveRoom, ChatMessage } from '@/src/contexts/LiveRoomContext';
import { billingService } from '@/src/api/services/billing.service';
import { URL_BE } from '@/src/constants/ApiConstant';
import '@livekit/components-styles';

const BACKEND_URL = URL_BE;
const LIVEKIT_URL = 'wss://livestream-zala-8almwmwe.livekit.cloud';

function LiveIcon({ name, size = 14, color = '#c4b5fd' }: { name: 'share' | 'users' | 'search' | 'chat' | 'mic' | 'camera' | 'screen' | 'end' | 'leave' | 'clock' | 'heart' | 'like' | 'shield' | 'spark' | 'trophy' | 'gift' | 'coin'; size?: number; color?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (name === 'share') return <svg {...common}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 16V3" /><path d="M7 8l5-5 5 5" /></svg>;
  if (name === 'users') return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>;
  if (name === 'chat') return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
  if (name === 'mic') return <svg {...common}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" /></svg>;
  if (name === 'camera') return <svg {...common}><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
  if (name === 'screen') return <svg {...common}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></svg>;
  if (name === 'end') return <svg {...common}><path d="M5 8c4-3 10-3 14 0" /><path d="M6 16h12" /></svg>;
  if (name === 'leave') return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
  if (name === 'heart') return <svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>;
  if (name === 'like') return <svg {...common}><path d="M14 9V5a3 3 0 0 0-3-3l-1 5-4 4v10h11.28a2 2 0 0 0 1.98-1.74l1.2-8a2 2 0 0 0-1.98-2.26H14z" /><path d="M6 21H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3" /></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
  if (name === 'shield') return <svg {...common}><path d="M12 3 4 7v6c0 5 3.5 7.8 8 9 4.5-1.2 8-4 8-9V7l-8-4z" /><path d="M9 12h6" /></svg>;
  if (name === 'spark') return <svg {...common}><path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" /><path d="M5 18h.01" /><path d="M19 18h.01" /></svg>;
  if (name === 'trophy') return <svg {...common}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M5 6H3a2 2 0 0 0 0 4h2" /><path d="M19 6h2a2 2 0 0 1 0 4h-2" /></svg>;
  if (name === 'gift') return <svg {...common}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13" /><path d="M3 12h18" /><path d="M12 8c-2.2 0-4-1.3-4-3s1.8-3 4 0c2.2-3 4-1.7 4 0s-1.8 3-4 3z" /></svg>;
  if (name === 'coin') return <svg {...common}><ellipse cx="12" cy="12" rx="8" ry="5" /><path d="M4 12v4c0 2.8 3.6 5 8 5s8-2.2 8-5v-4" /></svg>;
  return <svg {...common}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9" /><path d="M11 12H1" /><path d="M16 16H1" /><path d="M19 8H1" /></svg>;
}

// ─── Member Management Panel ─────────────────────────────────────────────────
function MemberPanel({ roomCode, displayName, isHost, identity }: { roomCode: string; displayName: string; isHost: boolean; identity: string }) {
  const participants = useParticipants();
  const [tab, setTab] = useState<'share' | 'members' | 'waiting' | 'settings'>('share');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const approved = participants.filter(p => {
    try { const m = JSON.parse(p.metadata || '{}'); return m.status !== 'waiting'; }
    catch { return true; }
  });
  const waiting = participants.filter(p => {
    try { return JSON.parse(p.metadata || '{}').status === 'waiting'; }
    catch { return false; }
  });

  const shareLink = typeof window !== 'undefined' ? `${window.location.origin}/live?room=${encodeURIComponent(roomCode)}` : '';
  const shareMessage = `Moi tham gia phong Live Stream tren Zala!\n\nMa phong: ${roomCode}\nLink tham gia nhanh: ${shareLink}\n\nNhap ma vao "Tham gia phong" la vao duoc ngay!`;

  const copyMessage = () => { navigator.clipboard.writeText(shareMessage); alert('Đã copy lời mời!'); };
  const copyCode = () => { navigator.clipboard.writeText(roomCode); alert('Đã copy mã phòng!'); };

  const approveUser = (pid: string) => {
    fetch(`${BACKEND_URL}/api/live/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: roomCode, participantIdentity: pid }),
    });
  };

  const kickUser = (pid: string) => {
    if (!window.confirm('Kick người này ra khỏi phòng?')) return;
    fetch(`${BACKEND_URL}/api/live/kick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: roomCode, hostId: identity, participantIdentity: pid }),
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    await fetch(`${BACKEND_URL}/api/live/room/settings`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: roomCode, hostId: identity, requiresApproval }),
    });
    setSaving(false);
    alert('Đã lưu cài đặt!');
  };

  const tabs = [
    { key: 'share', label: 'Chia sẻ' },
    { key: 'members', label: `Thành viên (${approved.length})` },
  ] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#111827', backgroundColor: '#ffffff' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '10px 4px', background: 'none', border: 'none',
            borderBottom: tab === t.key ? '2px solid #7c3aed' : '2px solid transparent',
            color: tab === t.key ? '#7c3aed' : '#6b7280',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.2s'
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {tab === 'share' && (
          <div>
            <div style={{ marginBottom: 16, padding: 14, backgroundColor: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontWeight: 600 }}>MÃ PHÒNG</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 10 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#7c3aed', letterSpacing: 1 }}>{roomCode}</span>
                <button onClick={copyCode} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>Copy</button>
              </div>
            </div>
            <div style={{ padding: 14, backgroundColor: '#f3f4f6', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>NỘI DUNG TIN NHẮN</p>
              <pre style={{ margin: 0, fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{shareMessage}</pre>
            </div>
            <button onClick={copyMessage} style={{ width: '100%', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Sao chép lời mời</button>
          </div>
        )}

        {tab === 'members' && (
          <div>
            {/* Search members */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Tìm thành viên..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  color: '#111827',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 14, fontSize: 13, fontWeight: 700, color: '#111827' }}>Thành viên hiện tại</div>
            {(() => {
              const filtered = approved.filter(p => {
                if (!memberSearch.trim()) return true;
                const name = (p.name || p.identity || '').toLowerCase();
                return name.includes(memberSearch.trim().toLowerCase());
              });
              if (filtered.length === 0) return (
                <p style={{ color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
                  {memberSearch.trim() ? 'Không tìm thấy thành viên nào' : 'Chưa có ai trong phòng'}
                </p>
              );
              return filtered.map(p => (
              <div key={p.identity} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  {(p.name || p.identity)[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || p.identity}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.identity === identity ? '(Bạn)' : ''}</div>
                </div>
                {isHost && p.identity !== identity && (
                  <button onClick={() => kickUser(p.identity)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Kick</button>
                )}
              </div>
            ));
            })()}

            {isHost && (
              <>
                <div style={{ marginTop: 20, marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#f9fafb' }}>Chờ duyệt</div>
                {(() => {
                  const filteredWaiting = waiting.filter(p => {
                    if (!memberSearch.trim()) return true;
                    const name = (p.name || p.identity || '').toLowerCase();
                    return name.includes(memberSearch.trim().toLowerCase());
                  });
                  if (filteredWaiting.length === 0) return (
                    <p style={{ color: '#9ca3af', fontSize: 13 }}>{memberSearch.trim() ? 'Không tìm thấy' : 'Không có yêu cầu nào'}</p>
                  );
                  return filteredWaiting.map(p => (
                    <div key={p.identity} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#374151', fontWeight: 700 }}>{(p.name || p.identity)[0]?.toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name || p.identity}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => approveUser(p.identity)} style={{ background: '#10b981', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Duyệt</button>
                        <button onClick={() => kickUser(p.identity)} style={{ background: '#ef4444', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Từ chối</button>
                      </div>
                    </div>
                  ));
                })()}

                <div style={{ marginTop: 20, padding: 14, backgroundColor: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: '#111827', fontSize: 13, fontWeight: 700 }}>Cài đặt phòng</div>
                      <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>Chủ phòng quản lý cách người xem tham gia</div>
                    </div>
                    <div onClick={() => setRequiresApproval(!requiresApproval)} style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', backgroundColor: requiresApproval ? '#7c3aed' : '#d1d5db', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', transition: 'left 0.2s', left: requiresApproval ? 22 : 2 }} />
                    </div>
                  </div>
                  <button onClick={saveSettings} disabled={saving} style={{ width: '100%', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>{saving ? 'Đang lưu...' : 'Lưu cài đặt'}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inner room (inside LiveKitRoom) ────────────────────────────────────────
const STICKERS = [
  // --- VIP Category ---
  { id: 'rose', name: 'Hoa hồng', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/2558/2558542.png' },
  { id: 'diamond', name: 'Kim cương', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/2950/2950098.png' },
  { id: 'heart_gold', name: 'Tim vàng', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/833/833472.png' },
  { id: 'rocket', name: 'Tên lửa', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/1356/1356479.png' },
  { id: 'crown', name: 'Vương miện', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/694/694431.png' },
  { id: 'supercar', name: 'Siêu xe', category: 'VIP', url: 'https://cdn-icons-png.flaticon.com/512/741/741407.png' },
  
  // --- Pets Category ---
  ...Object.entries(STICKER_PACKS.pets).map(([id, url]) => ({
    id, name: id.replace(/_/g, ' '), category: 'Pets', url
  })),
  
  // --- Christmas Category ---
  ...Object.entries(STICKER_PACKS.christmas).map(([id, url]) => ({
    id, name: id.replace(/_/g, ' '), category: 'Christmas', url
  })),

  // --- Home Category ---
  ...Object.entries(STICKER_PACKS.home).map(([id, url]) => ({
    id, name: id.replace(/_/g, ' '), category: 'Home', url
  })),
];

const STICKER_CATEGORIES = [
  { id: 'VIP', icon: 'spark' },
  { id: 'Pets', icon: 'heart' },
  { id: 'Christmas', icon: 'gift' },
  { id: 'Home', icon: 'shield' },
];

function InnerRoomUI({ roomCode, displayName, isHost, canSubscribe, identity, initialMicOn, initialCamOn, onRoomEnded, onLeave, vipTier = 'VIP0', onTimeExpired, maxLiveMinutesFromDb, onUpgradeVip }: { roomCode: string; displayName: string; isHost: boolean; canSubscribe: boolean; identity: string; initialMicOn?: boolean; initialCamOn?: boolean; onRoomEnded: () => void; onLeave: () => void; vipTier?: string; onTimeExpired?: () => void; maxLiveMinutesFromDb?: number; onUpgradeVip?: () => void }) {
  const room = useRoomContext();
  const { user } = useUser();
  const participants = useParticipants();
  const [isEndingLive, setIsEndingLive] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [systemMessages, setSystemMessages] = useState<Array<{ id: string; text: string; timestamp: number }>>([]);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; type: 'heart' | 'like'; left: number }>>([]);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [sendAsDanmaku, setSendAsDanmaku] = useState(true);
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [isGiftEnabled, setIsGiftEnabled] = useState(true);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeGiftCategory, setActiveGiftCategory] = useState('VIP');
  const [selectedGiftSticker, setSelectedGiftSticker] = useState<any | null>(null);
  const [giftMessage, setGiftMessage] = useState('');
  const [lastTtsMessage, setLastTtsMessage] = useState<string | null>(null);
  const [dbGifts, setDbGifts] = useState<any[]>([]);
  // Top Donors from DB (gắn với user host, không phải room)
  const [topDonors, setTopDonors] = useState<Array<{ userId: string; name: string; totalCoins: number; avatarLetter: string }>>([]);
  const [showTopDonors, setShowTopDonors] = useState(true);
  // Viewer wallet balance
  const [viewerBalance, setViewerBalance] = useState<number | null>(null);
  // Inline deposit modal
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const danmakuRef = useRef<DanmakuLayerRef>(null);
  const giftRef = useRef<GiftOverlayRef>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatOptions = useMemo(() => ({ channelTopic: 'chat' as const }), []);
  const { chatMessages, send, isSending } = useChat(chatOptions);
  const { activeRoom, setActiveRoom, chatHistory, addChatMessage } = useLiveRoom();
  const audioRef = useRef<HTMLDivElement | null>(null);
  const { canPlayAudio, startAudio } = useStartAudio({ room, element: audioRef });
  const localParticipant = room.localParticipant;
  const allTracks = useTracks(['camera', 'screen_share']);
  const localTracks = useMemo(
    () => allTracks.filter((track) => track.participant?.identity === localParticipant?.identity),
    [allTracks, localParticipant?.identity],
  );
  // Remote tracks for viewers
  const remoteTracks = useMemo(
    () => allTracks.filter((track) => track.participant?.identity !== localParticipant?.identity),
    [allTracks, localParticipant?.identity],
  );
  const isCameraOn = localParticipant?.isCameraEnabled ?? false;
  const isMicOn = localParticipant?.isMicrophoneEnabled ?? false;
  const isShareOn = localParticipant?.isScreenShareEnabled ?? false;
  const isPublishing = isCameraOn || isMicOn || isShareOn;

  // ── VIP Timer (timestamp-based, không bị reset khi chuyển tab) ──
  const VIP_LIMITS: Record<string, number> = { VIP0: 300, VIP1: 1800, VIP2: -1 };
  const dbLimitSeconds = maxLiveMinutesFromDb !== undefined ? (maxLiveMinutesFromDb === -1 ? -1 : maxLiveMinutesFromDb * 60) : undefined;
  const maxSeconds = dbLimitSeconds ?? (VIP_LIMITS[vipTier] ?? 300);
  const [liveElapsed, setLiveElapsed] = useState(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('liveStartTime') : null;
    return saved ? Math.floor((Date.now() - Number(saved)) / 1000) : 0;
  });
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningShownRef = useRef(false);
  const expiredRef = useRef(false);

  // Timer chạy liên tục theo isHost, KHÔNG phụ thuộc camera/mic
  useEffect(() => {
    if (isHost && maxSeconds > 0) {
      const startTime = Number(sessionStorage.getItem('liveStartTime') || Date.now());
      warningShownRef.current = false;
      expiredRef.current = false;
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setLiveElapsed(elapsed);
        // Cảnh báo trước 1 phút (chỉ 1 lần)
        if (!warningShownRef.current && elapsed >= maxSeconds - 60 && elapsed < maxSeconds) {
          warningShownRef.current = true;
          setShowTimeWarning(true);
          alert(`⚠️ Sắp hết giờ: Bạn còn 1 phút live. Nâng cấp VIP để live lâu hơn!`);
        }
        // Hết giờ (chỉ 1 lần)
        if (!expiredRef.current && elapsed >= maxSeconds) {
          expiredRef.current = true;
          if (timerRef.current) clearInterval(timerRef.current);
          sessionStorage.removeItem('liveStartTime');
          alert(`⏰ Hết thời gian live: Gói ${vipTier} chỉ cho phép live ${Math.floor(maxSeconds / 60)} phút. Vui lòng nâng cấp VIP.`);
          if (onTimeExpired) onTimeExpired();
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isHost, maxSeconds, vipTier, onTimeExpired]);

  const hostMetadata = useMemo(() => {
    try {
      return room.metadata ? JSON.parse(room.metadata) : {};
    } catch {
      return {};
    }
  }, [room.metadata]);
  const hostIdentity = hostMetadata.hostId as string | undefined;
  const hostName = hostMetadata.hostName as string | undefined;


  useEffect(() => {
    if (!isHost || !activeRoom) return;
    const current = activeRoom.hostMediaState;
    if (
      current?.cameraEnabled === isCameraOn &&
      current?.microphoneEnabled === isMicOn &&
      current?.screenShareEnabled === isShareOn
    ) {
      return;
    }
    setActiveRoom({
      ...activeRoom,
      hostMediaState: {
        cameraEnabled: isCameraOn,
        microphoneEnabled: isMicOn,
        screenShareEnabled: isShareOn,
      },
    });
  }, [isHost, activeRoom, isCameraOn, isMicOn, isShareOn, setActiveRoom]);

  useEffect(() => {
    billingService.getActiveGifts().then(res => {
      const data = (res as any)?.data?.data || (res as any)?.data || [];
      const gifts = data.map((g: any) => ({
        id: g._id,
        name: g.name,
        price: g.price,
        category: 'VIP',
        url: g.iconUrl
      }));
      setDbGifts(gifts);
    }).catch(err => {
      console.warn("Could not load gifts", err);
    });
  }, []);

  // Fetch top donors from DB (gắn với host user)
  // Retry khi hostIdentity chưa sẵn sàng (viewer cần chờ room.metadata)
  const hostIdRef = useRef(hostIdentity);
  hostIdRef.current = hostIdentity;
  useEffect(() => {
    const fetchTopDonors = () => {
      const hid = hostIdRef.current;
      if (!hid) return false;
      billingService.getTopDonors(hid).then(res => {
        const data = (res as any)?.data?.data || (res as any)?.data || [];
        setTopDonors(data);
      }).catch(err => {
        console.warn('Could not load top donors', err);
      });
      return true;
    };
    if (fetchTopDonors()) return;
    // Retry mỗi 1s cho đến khi có hostIdentity (viewer chờ metadata)
    const interval = setInterval(() => {
      if (fetchTopDonors()) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [hostIdentity]);

  // Fetch viewer wallet balance
  useEffect(() => {
    billingService.getWallet().then(res => {
      const data = (res as any)?.data?.data || (res as any)?.data;
      setViewerBalance(data?.balance ?? 0);
    }).catch(() => {});

    // Listen to coin_deposited for realtime balance update
    const socket = SocketService.getInstance();
    const handleCoinDeposited = (data: { balance: number; coinAmount: number }) => {
      setViewerBalance(data.balance);
      // Auto-close deposit modal
      setShowDepositModal(false);
      setDepositAmount('');
    };
    socket.onCoinDeposited(handleCoinDeposited);
    return () => { socket.removeCoinDepositedListener(handleCoinDeposited); };
  }, []);

  const spawnReaction = useCallback((type: 'heart' | 'like') => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const left = 12 + Math.random() * 76;
    setFloatingReactions(prev => [...prev, { id, type, left }]);
    window.setTimeout(() => {
      setFloatingReactions(prev => prev.filter(item => item.id !== id));
    }, 1800);
  }, []);

  const sendReaction = useCallback(async (type: 'heart' | 'like') => {
    try {
      if (!room?.localParticipant) return;
      const payload = new TextEncoder().encode(JSON.stringify({
        type: 'reaction',
        reaction: type,
        from: identity,
        ts: Date.now(),
      }));
      await room.localParticipant.publishData(payload, { reliable: false, topic: 'reaction' });
      spawnReaction(type);
    } catch (error) {
      console.error('Không gửi được reaction:', error);
    }
  }, [room, identity, spawnReaction]);

  const cleanName = (name: string) => {
    if (!name) return 'Người dùng';
    // Xóa tiền tố "Phòng ..." (với bất kỳ ký tự nào phía sau cho đến dấu gạch ngang)
    let cleaned = name.replace(/^Phòng\s+[\d:]+\s+-\s+/i, '');
    cleaned = cleaned.replace(/^Phòng\s+[\d:]+/i, '');
    // Xóa tiền tố "Phòng live của ..."
    cleaned = cleaned.replace(/^Phòng\s+live\s+của\s+/i, '');
    // Xóa tiền tố "uid_..."
    cleaned = cleaned.replace(/^uid_[\w\d]+/i, '');
    // Xóa tiền tố "Khách_"
    cleaned = cleaned.replace(/^Khách_[\w\d]+/i, '');
    
    return cleaned.trim() || 'Người dùng';
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const speakText = useCallback((text: string) => {
    if (!isTtsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [isTtsEnabled]);

  // Helper: cập nhật Top Donors (thêm vào mảng local, tương tự DB)
  const updateTopDonors = useCallback((senderIdentity: string, senderName: string, giftPrice: number) => {
    if (giftPrice <= 0) return;
    setTopDonors(prev => {
      const existing = prev.find(d => d.userId === senderIdentity);
      let updated;
      if (existing) {
        updated = prev.map(d => d.userId === senderIdentity
          ? { ...d, totalCoins: d.totalCoins + giftPrice, name: senderName }
          : d
        );
      } else {
        updated = [...prev, {
          userId: senderIdentity,
          name: senderName,
          totalCoins: giftPrice,
          avatarLetter: (senderName || 'U')[0].toUpperCase(),
        }];
      }
      return updated.sort((a, b) => b.totalCoins - a.totalCoins).slice(0, 5);
    });
  }, []);

  const sendGift = useCallback(async (sticker: typeof STICKERS[0], message: string) => {
    try {
      if (!room?.localParticipant) return;
      if (!hostIdentity) {
        alert('Không tìm thấy thông tin chủ phòng!');
        return;
      }

      // 1. Deduct balance via API
      try {
        const donateRes = await billingService.donate(hostIdentity, sticker.id, roomCode);
        // Cập nhật số xu sau khi donate
        const newBalance = (donateRes as any)?.data?.data?.senderBalance;
        if (typeof newBalance === 'number') {
          setViewerBalance(newBalance);
        } else {
          // Fallback: fetch lại wallet
          billingService.getWallet().then(res => {
            const data = (res as any)?.data?.data || (res as any)?.data;
            setViewerBalance(data?.balance ?? 0);
          }).catch(() => {});
        }
      } catch (err: any) {
        alert(err?.response?.data?.message || 'Lỗi khi tặng quà, có thể bạn không đủ xu.');
        return;
      }

      // 2. Broadcast via LiveKit
      const senderDisplayName = cleanName(
        (user as any)?.name ||
        (user as any)?.displayName ||
        (user as any)?.fullName ||
        room?.localParticipant?.name ||
        identity
      );
      const giftData = {
        type: 'gift',
        stickerId: sticker.id,
        stickerName: sticker.name,
        stickerUrl: sticker.url,
        stickerPrice: (sticker as any).price || 0,
        message: message || '',
        fromName: senderDisplayName,
        fromIdentity: identity,
        ts: Date.now(),
      };
      const payload = new TextEncoder().encode(JSON.stringify(giftData));
      await room.localParticipant.publishData(payload, { reliable: true, topic: 'gift' });
      
      // Local display - Chỉ hiện nếu nút "Hiện chữ Donate" đang bật
      if (isGiftEnabled && giftRef.current) {
        giftRef.current.showGift({
          id: `gift-${Date.now()}`,
          senderName: 'Bạn',
          stickerUrl: sticker.url,
          stickerName: sticker.name,
          message: message || '',
        });
      }

      // Update Top Donors (local user)
      updateTopDonors(identity, senderDisplayName, (sticker as any).price || 0);
      
      // Add to chat history
      addChatMessage({
        id: `sys-gift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: `Bạn đã tặng ${sticker.name}${message ? `: "${message}"` : ''}`,
        timestamp: Date.now(),
        isSystem: true,
        isGift: true,
        stickerUrl: sticker.url,
      });

      setShowStickerPicker(false);
      setSelectedGiftSticker(null);
      setGiftMessage('');
    } catch (error) {
      console.error('Không gửi được quà:', error);
    }
  }, [room, identity, hostIdentity, roomCode, isGiftEnabled, user, addChatMessage, updateTopDonors]);

  const handleDeviceError = useCallback((error: Error | null, kind: 'camera' | 'microphone') => {
    if (!error) { setDeviceError(null); return; }
    const isPermissionDenied = error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
    if (isPermissionDenied) {
      setDeviceError(
        kind === 'camera'
          ? 'Quyền camera bị từ chối. Hãy bấm vào biểu tượng khóa trên thanh địa chỉ rồi cho phép Camera.'
          : 'Quyền micro bị từ chối. Hãy bấm vào biểu tượng khóa trên thanh địa chỉ rồi cho phép Microphone.'
      );
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      setDeviceError(kind === 'camera' ? `Không thể bật camera: ${msg}` : `Không thể bật micro: ${msg}`);
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!localParticipant) return;
    try {
      setDeviceError(null);
      await localParticipant.setMicrophoneEnabled(!isMicOn);
    } catch (error) {
      handleDeviceError(error as Error, 'microphone');
    }
  }, [handleDeviceError, isMicOn, localParticipant]);

  const toggleCamera = useCallback(async () => {
    if (!localParticipant) return;
    try {
      setDeviceError(null);
      await localParticipant.setCameraEnabled(!isCameraOn);
    } catch (error) {
      handleDeviceError(error as Error, 'camera');
    }
  }, [handleDeviceError, isCameraOn, localParticipant]);

  // Apply initial media state once when the room first connects.
  // If host media state already exists in context (e.g. back from mini player),
  // prioritize that state to avoid unexpectedly re-enabling camera/mic.
  const appliedInitialDevices = useRef(false);
  useEffect(() => {
    if (appliedInitialDevices.current) return;
    if (room.state !== 'connected' || !localParticipant) return;
    appliedInitialDevices.current = true;
    const targetMicOn = activeRoom?.hostMediaState?.microphoneEnabled ?? !!initialMicOn;
    const targetCamOn = activeRoom?.hostMediaState?.cameraEnabled ?? !!initialCamOn;
    localParticipant.setMicrophoneEnabled(targetMicOn).catch((e: Error) => handleDeviceError(e, 'microphone'));
    localParticipant.setCameraEnabled(targetCamOn).catch((e: Error) => handleDeviceError(e, 'camera'));
  }, [room.state, localParticipant, activeRoom, initialMicOn, initialCamOn, handleDeviceError]);

  const handleEndLive = useCallback(async () => {
    if (isEndingLive) return;
    if (!confirm('Bạn có chắc chắn muốn kết thúc live?')) return;
    try {
      setIsEndingLive(true);
      
      // Cập nhật UI ngay lập tức
      onRoomEnded();
      if (room?.disconnect) {
        try { room.disconnect(); } catch {}
      }

      // Fire and forget API call
      fetch(`${BACKEND_URL}/api/live/room?roomName=${encodeURIComponent(roomCode)}&hostId=${encodeURIComponent(identity)}`, {
        method: 'DELETE',
      }).catch(err => console.error('Lỗi API kết thúc live:', err));

    } catch (error) {
      console.error('Kết thúc live lỗi:', error);
      alert('Có lỗi khi kết thúc live.');
      setIsEndingLive(false);
    }
  }, [isEndingLive, room, roomCode, identity, onRoomEnded]);

  // Sync system join messages to context history
  const hasAnnouncedJoin = useRef(false);
  useEffect(() => {
    if (!hasAnnouncedJoin.current && localParticipant) {
      addChatMessage({
        id: `self-join-${localParticipant.identity}-${Date.now()}`,
        text: 'Bạn đã vào phòng',
        timestamp: Date.now(),
        isSystem: true,
      });
      hasAnnouncedJoin.current = true;
    }
  }, [localParticipant, addChatMessage]);

  // Safe sync: only runs when message COUNT changes, uses ref to avoid re-processing
  const lastSyncedIdxRef = useRef(0);
  useEffect(() => {
    const newMsgs = chatMessages.slice(lastSyncedIdxRef.current);
    if (newMsgs.length === 0) return;
    newMsgs.forEach(msg => {
      const rawText = msg.message;
      const isDanmaku = rawText.startsWith('\u200B[D]');
      const cleanText = isDanmaku ? rawText.replace('\u200B[D]', '') : rawText;

      addChatMessage({
        id: msg.id,
        message: cleanText,
        timestamp: msg.timestamp,
        from: msg.from ? { identity: msg.from.identity, name: msg.from.name || msg.from.identity } : undefined,
        isSystem: false,
      });

      if (isDanmaku && danmakuEnabled && danmakuRef.current) {
        danmakuRef.current.addMessage({
          id: msg.id,
          text: cleanText,
          isSelf: msg.from?.identity === localParticipant?.identity,
        });
      }
    });
    lastSyncedIdxRef.current = chatMessages.length;
  }, [chatMessages.length]); // ← number, not array ref → no infinite loop

  useEffect(() => {
    if (!room) return;

    const handleJoin = (participant: any) => {
      if (participant.identity === localParticipant?.identity) return;
      const msg = { id: `join-${participant.identity}-${Date.now()}`, text: `${participant.name || participant.identity} đã vào phòng`, timestamp: Date.now() };
      setSystemMessages(prev => [...prev, msg]);
      addChatMessage({ ...msg, isSystem: true });
    };

    const handleLeave = (participant: any) => {
      if (participant.identity === localParticipant?.identity) return;
      const msg = { id: `leave-${participant.identity}-${Date.now()}`, text: `${participant.name || participant.identity} đã rời phòng`, timestamp: Date.now() };
      setSystemMessages(prev => [...prev, msg]);
      addChatMessage({ ...msg, isSystem: true });
    };

    const handleRoomDisconnect = async (reason?: any) => {
      const reasonText = String(
        reason?.reason ||
        reason?.message ||
        reason?.code ||
        reason ||
        ''
      ).toLowerCase();
      console.log('Room disconnected, reason:', reason);

      // Chỉ kết thúc hẳn phiên khi room thực sự bị đóng/kick.
      // Mất mạng tạm thời hoặc chuyển trạng thái reconnect không được coi là "kết thúc live".
      const isTerminalDisconnect =
        reasonText.includes('room') && (reasonText.includes('deleted') || reasonText.includes('closed') || reasonText.includes('ended')) ||
        reasonText.includes('participant') && (reasonText.includes('removed') || reasonText.includes('kicked')) ||
        reasonText.includes('kick');

      if (isTerminalDisconnect) {
        setIsEndingLive(false);
        onRoomEnded();
        return;
      }

      // Viewer có thể nhận disconnect không rõ reason khi host end live.
      // Fallback: hỏi backend xem phòng còn tồn tại không, nếu không thì kết thúc UI.
      if (!isHost) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/live/rooms`);
          const data = await res.json();
          const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
          const roomStillExists = rooms.some((r: any) => r?.roomName === roomCode || r?.code === roomCode);
          if (!roomStillExists) {
            setIsEndingLive(false);
            onRoomEnded();
          }
        } catch (error) {
          console.warn('[Live] Không thể kiểm tra trạng thái phòng sau disconnect:', error);
        }
      }
    };

    const handleReactionData = (payload: Uint8Array, participant?: any, _kind?: any, topic?: string) => {
      if (topic !== 'reaction') return;
      if (participant?.identity === localParticipant?.identity) return;
      try {
        const text = new TextDecoder().decode(payload);
        const parsed = JSON.parse(text);
        if (parsed?.type === 'reaction' && (parsed?.reaction === 'heart' || parsed?.reaction === 'like')) {
          spawnReaction(parsed.reaction);
        }
      } catch (error) {
        console.warn('Reaction payload không hợp lệ:', error);
      }
    };

    const handleGiftData = (payload: Uint8Array, participant?: any, _kind?: any, topic?: string) => {
        if (topic !== 'gift') return;
        try {
          const text = new TextDecoder().decode(payload);
          const parsed = JSON.parse(text);
            // 1. Luôn ưu tiên xử lý âm thanh (nếu loa đang bật)
            if (isHost || isTtsEnabled) {
              const msg = parsed.message ? ` với lời nhắn ${parsed.message}` : '';
              speakText(`Cảm ơn ${parsed.fromName} đã tặng bạn món quà ${parsed.stickerName}${msg}!`);
            }

            // 2. Chỉ hiển thị hình ảnh nếu nút "Hiện quà" đang bật
            if (isGiftEnabled && giftRef.current) {
              giftRef.current.showGift({
                id: `gift-${Date.now()}`,
                senderName: parsed.fromName,
                stickerUrl: parsed.stickerUrl,
                stickerName: parsed.stickerName,
                message: parsed.message,
              });
            }

            // 3. Update Top Donors (remote user)
            const senderIdentity = parsed.fromIdentity || participant?.identity || `unknown-${Date.now()}`;
            updateTopDonors(senderIdentity, parsed.fromName || 'Khách', parsed.stickerPrice || 0);

            // 4. Hiển thị tin nhắn trong khung chat
            addChatMessage({
              id: `sys-gift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              text: `${parsed.fromName} đã tặng ${parsed.stickerName}${parsed.message ? `: "${parsed.message}"` : ''}`,
              timestamp: Date.now(),
              isSystem: true,
              isGift: true,
              stickerUrl: parsed.stickerUrl,
            });
        } catch (error) {
          console.warn('Gift payload không hợp lệ:', error);
        }
      };

    room.on('participantConnected', handleJoin);
    room.on('participantDisconnected', handleLeave);
    room.on('disconnected', handleRoomDisconnect);
    room.on('dataReceived', handleReactionData);
    room.on('dataReceived', handleGiftData);

    // Handle chat messages sent from mobile via publishData (not LiveKit useChat protocol)
    const handleNativeChatData = (payload: Uint8Array, participant?: any, _kind?: any, topic?: string) => {
      if (topic !== 'chat') return;
      // Skip messages from self
      if (participant?.identity === localParticipant?.identity) return;
      try {
        const rawText = new TextDecoder().decode(payload);
        let cleanText = rawText;
        let isDanmaku = false;
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed.message === 'string') {
            const msg = parsed.message;
            isDanmaku = msg.startsWith('[D]') || msg.startsWith('\u200B[D]');
            cleanText = isDanmaku ? msg.replace(/^(\u200B)?\[D\]/, '') : msg;
          } else {
            // Plain text fallback
            isDanmaku = rawText.startsWith('\u200B[D]');
            cleanText = isDanmaku ? rawText.replace('\u200B[D]', '') : rawText;
          }
        } catch {
          // Plain text fallback
          isDanmaku = rawText.startsWith('\u200B[D]');
          cleanText = isDanmaku ? rawText.replace('\u200B[D]', '') : rawText;
        }

        const msgId = `native-${Date.now()}-${Math.random()}`;
        addChatMessage({
          id: msgId,
          message: cleanText,
          timestamp: Date.now(),
          from: participant ? { identity: participant.identity, name: participant.name || participant.identity } : undefined,
          isSystem: false,
        });

        if (isDanmaku && danmakuEnabled && danmakuRef.current) {
          danmakuRef.current.addMessage({
            id: msgId,
            text: cleanText,
            isSelf: false,
          });
        }
      } catch (error) {
        console.warn('[Live] Native chat parse error:', error);
      }
    };
    room.on('dataReceived', handleNativeChatData);

    return () => {
      room.off('participantConnected', handleJoin);
      room.off('participantDisconnected', handleLeave);
      room.off('disconnected', handleRoomDisconnect);
      room.off('dataReceived', handleReactionData);
      room.off('dataReceived', handleGiftData);
      room.off('dataReceived', handleNativeChatData);
    };
  }, [room, roomCode, localParticipant?.identity, onRoomEnded, addChatMessage, spawnReaction, isHost, isTtsEnabled, speakText, isGiftEnabled, updateTopDonors]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [systemMessages.length, chatHistory.length]);

  const waiting = participants.filter(p => {
    try { return JSON.parse(p.metadata || '{}').status === 'waiting'; }
    catch { return false; }
  });

  const handleSendComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    try {
      const messageToSend = sendAsDanmaku ? `\u200B[D]${trimmed}` : trimmed;
      await send(messageToSend);
      setNewComment('');
    } catch (error) {
      console.error('Không gửi được bình luận:', error);
    }
  };
  const isApproved = localParticipant.permissions?.canSubscribe ?? canSubscribe;

  if (!isApproved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#111827', fontSize: 18, marginTop: 20 }}>Vui lòng chờ chủ phòng duyệt...</Text>
      </View>
    );
  }

  const isConnecting = room.state === 'connecting' || room.state === 'reconnecting';

  return (
    <>
      <style>{`
        @keyframes live-end-spin { to { transform: rotate(360deg); } }
        @keyframes reaction-float {
          0% { transform: translateY(0) scale(0.7); opacity: 0; }
          15% { opacity: 1; transform: translateY(-22px) scale(1); }
          100% { transform: translateY(-170px) scale(1.08); opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.08); }
        }
      `}</style>
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isConnecting ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, color: '#94a3b8' }}>
                <div style={{ width: 40, height: 40, border: '3px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: 15 }}>Đang kết nối phòng live...</span>
              </div>
            ) : isHost ? (
              localTracks.length > 0 ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
                  {localTracks.some(t => t.source === 'screen_share') ? (
                    <>
                      <VideoTrack trackRef={localTracks.find(t => t.source === 'screen_share')!} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      {localTracks.some(t => t.source === 'camera') && (
                        <div style={{ position: 'absolute', bottom: 16, right: 16, width: 200, height: 150, borderRadius: 12, overflow: 'hidden', border: '2px solid #6d28d9', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10 }}>
                          <VideoTrack trackRef={localTracks.find(t => t.source === 'camera')!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                    </>
                  ) : (
                    <VideoTrack trackRef={localTracks.find(t => t.source === 'camera')!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              ) : isCameraOn || isShareOn ? (
                <div style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center', padding: 24 }}>Đang khởi động thiết bị...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#64748b' }}>
                  <span style={{ opacity: 0.7 }}>
                    <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  </span>
                  <span style={{ fontSize: 15 }}>Chưa có camera hoặc màn hình đang chia sẻ</span>
                  <span style={{ fontSize: 13, color: '#475569' }}>Bật camera hoặc share màn hình để bắt đầu phát</span>
                </div>
              )
            ) : remoteTracks.length > 0 ? (
              <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
                {remoteTracks.some(t => t.source === 'screen_share') ? (
                  <>
                    <VideoTrack trackRef={remoteTracks.find(t => t.source === 'screen_share')!} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    {remoteTracks.some(t => t.source === 'camera') && (
                      <div style={{ position: 'absolute', bottom: 16, right: 16, width: 200, height: 150, borderRadius: 12, overflow: 'hidden', border: '2px solid #6d28d9', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10 }}>
                        <VideoTrack trackRef={remoteTracks.find(t => t.source === 'camera')!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </>
                ) : (
                  <VideoTrack trackRef={remoteTracks.find(t => t.source === 'camera')!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#64748b' }}>
                <span style={{ opacity: 0.8 }}><LiveIcon name="clock" size={38} color="#a78bfa" /></span>
                <span style={{ fontSize: 15 }}>Đang chờ host phát video...</span>
                <span style={{ fontSize: 13, color: '#475569' }}>Hãy giữ kết nối, live stream sẽ sớm bắt đầu</span>
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {floatingReactions.map(item => (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    bottom: 22,
                    left: `${item.left}%`,
                    animation: 'reaction-float 1.8s ease-out forwards',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: item.type === 'heart' ? 'rgba(244,63,94,0.18)' : 'rgba(124,58,237,0.18)',
                    border: item.type === 'heart' ? '1px solid rgba(244,63,94,0.45)' : '1px solid rgba(124,58,237,0.45)',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
                  }}
                >
                  <LiveIcon name={item.type} size={20} color={item.type === 'heart' ? '#f43f5e' : '#7c3aed'} />
                </div>
              ))}
            </div>

            {/* VIP Timer Overlay (Web) - hiện luôn khi là host, kể cả tắt cam */}
            {isHost && maxSeconds > 0 && (
              <div style={{
                position: 'absolute', top: 56, left: 10,
                backgroundColor: showTimeWarning ? 'rgba(239,68,68,0.92)' : 'rgba(17,24,39,0.72)',
                padding: '6px 12px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6,
                color: '#fff', fontSize: 13, fontWeight: 700, zIndex: 50,
                backdropFilter: 'blur(3px)', border: showTimeWarning ? '1px solid #fca5a5' : '1px solid rgba(255,255,255,0.18)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.25)'
              }}>
                <LiveIcon name="clock" size={13} color="#ffffff" />
                <span>{formatTime(maxSeconds - liveElapsed)}</span>
                {showTimeWarning && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.9 }}>(Sắp hết giờ!)</span>}
                {showTimeWarning && onUpgradeVip && (
                  <button
                    onClick={onUpgradeVip}
                    style={{
                      marginLeft: 6, padding: '3px 10px', borderRadius: 999,
                      backgroundColor: '#f59e0b', color: '#fff', border: 'none',
                      fontWeight: 700, fontSize: 11, cursor: 'pointer',
                      animation: 'pulse 1.5s infinite',
                    }}
                  >
                    Nâng cấp VIP
                  </button>
                )}
              </div>
            )}

            {/* Top 5 Donors Overlay - góc trên cùng bên phải, luôn hiện kể cả tắt cam */}
            {showTopDonors && topDonors.length > 0 && (
              <div style={{
                position: 'absolute', top: 10, right: 10, zIndex: 50,
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(6px)', borderRadius: 12,
                padding: '10px 12px', minWidth: 200, maxWidth: 240,
                border: '1px solid rgba(17,24,39,0.08)',
                boxShadow: '0 10px 24px rgba(2,6,23,0.16)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>
                  <LiveIcon name="trophy" size={13} color="#7c3aed" />
                  <span style={{ color: '#374151', fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>Top Donate</span>
                </div>
                {topDonors.map((donor, idx) => {
                  const medal = `#${idx + 1}`;
                  const nameColor = '#111827';
                  return (
                    <div key={donor.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, padding: '3px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', width: 22, textAlign: 'center', flexShrink: 0 }}>{medal}</span>
                      <div style={{
                        width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                        background: idx === 0 ? '#fde68a' : idx === 1 ? '#dbeafe' : '#e9d5ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#374151',
                        border: '1px solid #e5e7eb',
                      }}>{donor.avatarLetter}</div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: nameColor, fontSize: 11, fontWeight: 600 }}>
                        {donor.name}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>{donor.totalCoins}</span>
                      <span style={{ fontSize: 9, color: '#6b7280', opacity: 0.9, flexShrink: 0 }}>xu</span>
                    </div>
                  );
                })}
              </div>
            )}

            <DanmakuLayer ref={danmakuRef} enabled={danmakuEnabled} />
            <GiftOverlay ref={giftRef} />
          </div>

          <div style={{ height: 220, backgroundColor: '#ffffff', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #1e293b' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'inline-flex', alignItems: 'center', gap: 6 }}><LiveIcon name="chat" size={14} color="#7c3aed" />Bình luận</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{chatHistory.length} tin nhắn</span>
            </div>
            <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
              {chatHistory.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', marginTop: 16 }}>Chưa có bình luận nào</div>
              ) : (
                <>
                  {chatHistory.map((message) => {
                    if (message.isSystem) {
                      const isGiftMsg = message.isGift || (message.text && message.text.includes('đã tặng'));
                      if (isGiftMsg) {
                        return (
                          <div key={message.id} style={{ marginBottom: 4, padding: '8px 10px', backgroundColor: '#fdf2f8', borderRadius: 8, borderLeft: '3px solid #db2777', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {message.stickerUrl ? (
                              <img src={message.stickerUrl} alt="gift" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                            ) : (
                              <LiveIcon name="gift" size={14} color="#be185d" />
                            )}
                            <span style={{ color: '#be185d', fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{message.text}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={message.id} style={{ marginBottom: 4, padding: '5px 10px', backgroundColor: '#f3f4f6', borderRadius: 8, borderLeft: '3px solid #d1d5db' }}>
                          <span style={{ color: '#6b7280', fontSize: 12 }}>{message.text}</span>
                        </div>
                      );
                    }
                    const fromIdentity = message.from?.identity;
                    const fromName = message.from?.name;
                    const isHostMessage = fromIdentity === hostIdentity || fromName === hostName;
                    return (
                      <div key={message.id} style={{ marginBottom: 4, padding: '6px 10px', backgroundColor: isHostMessage ? '#ede9fe' : '#f9fafb', borderRadius: 8, borderLeft: isHostMessage ? '3px solid #7c3aed' : '3px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontWeight: 700, color: isHostMessage ? '#6d28d9' : '#374151', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {message.from?.name || message.from?.identity || 'Khách'}
                            {isHostMessage && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />}
                          </span>
                          <span style={{ color: '#9ca3af', fontSize: 10 }}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ color: '#111827', fontSize: 13, lineHeight: 1.4 }}>{message.message}</div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: '1px solid #e5e7eb', alignItems: 'center' }}>
              <button 
                onClick={() => setSendAsDanmaku(!sendAsDanmaku)} 
                title="Gửi dưới dạng chữ chạy"
                style={{ 
                  background: sendAsDanmaku ? 'rgba(124,58,237,0.1)' : 'none', 
                  border: sendAsDanmaku ? '1px solid #7c3aed' : '1px solid #e5e7eb', 
                  borderRadius: 8, width: 34, height: 34, display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
                }}
              >
                <LiveIcon name="clock" size={14} color={sendAsDanmaku ? '#7c3aed' : '#9ca3af'} />
              </button>

              {/* Số xu hiện có + Nạp xu */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', borderRadius: 8, backgroundColor: '#fffbeb', border: '1px solid #fcd34d', height: 34 }}>
                <LiveIcon name="coin" size={13} color="#f59e0b" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>{viewerBalance ?? '...'}</span>
                <button
                  onClick={() => setShowDepositModal(true)}
                  title="Nạp xu"
                  style={{ background: '#f59e0b', border: 'none', borderRadius: 6, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', cursor: 'pointer', marginLeft: 2 }}
                >+</button>
              </div>

              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowStickerPicker(!showStickerPicker)} 
                  title="Tặng quà"
                  style={{ 
                    background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, 
                    width: 34, height: 34, display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', cursor: 'pointer' 
                  }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth={2}>
                    <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                  </svg>
                </button>
                {showStickerPicker && (
                  <div style={{ 
                    position: 'absolute', bottom: 44, left: 0, backgroundColor: '#fff', 
                    borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', 
                    border: '1px solid #e5e7eb', padding: 10, display: 'flex', 
                    flexDirection: 'column', gap: 10, zIndex: 100, width: selectedGiftSticker ? 200 : 280 
                  }}>
                    {!selectedGiftSticker ? (
                      <>
                        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', paddingBottom: 6, gap: 15 }}>
                          {STICKER_CATEGORIES.map(cat => (
                            <div 
                              key={cat.id} 
                              onClick={() => setActiveGiftCategory(cat.id)}
                              style={{ 
                                cursor: 'pointer', fontSize: 16, opacity: activeGiftCategory === cat.id ? 1 : 0.4,
                                transition: 'opacity 0.2s', padding: '2px 4px',
                                borderBottom: activeGiftCategory === cat.id ? '2px solid #7c3aed' : '2px solid transparent'
                              }}
                              title={cat.id}
                            >
                              <LiveIcon name={cat.icon as any} size={14} color={activeGiftCategory === cat.id ? '#7c3aed' : '#94a3b8'} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, minHeight: 60 }}>
                          {(dbGifts.length > 0 ? dbGifts : STICKERS).filter(s => s.category === activeGiftCategory).map(s => (
                            <div 
                              key={s.id} 
                              onClick={() => setSelectedGiftSticker(s)} 
                              style={{ 
                                cursor: 'pointer', padding: 6, borderRadius: 10, 
                                backgroundColor: '#f8fafc', border: '1px solid #f1f5f9',
                                transition: 'all 0.2s', display: 'flex', alignItems: 'center', 
                                justifyContent: 'center', flexShrink: 0
                              }}
                              title={s.name + (s.price ? ` (${s.price} xu)` : '')}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <Image 
                                  source={typeof s.url === 'string' ? { uri: s.url } : s.url} 
                                  style={{ width: 44, height: 44 }} 
                                  resizeMode="contain"
                                />
                                {s.price && <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: 'bold' }}>{s.price}</Text>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Image source={selectedGiftSticker.url} style={{ width: 30, height: 30 }} resizeMode="contain" />
                          <span style={{ fontSize: 12, fontWeight: 700 }}>Tặng {selectedGiftSticker.name}</span>
                          <button onClick={() => setSelectedGiftSticker(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>✕</button>
                        </div>
                        <input 
                          value={giftMessage}
                          onChange={e => setGiftMessage(e.target.value)}
                          placeholder="Nhập lời nhắn..."
                          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', outline: 'none' }}
                          autoFocus
                        />
                        <button 
                          onClick={() => sendGift(selectedGiftSticker, giftMessage)}
                          style={{ backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '6px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Gửi ngay
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                placeholder={sendAsDanmaku ? "Nhập tin nhắn chạy màn hình..." : "Viết bình luận..."}
                style={{ flex: 1, height: 36, backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10, color: '#111827', padding: '0 12px', fontSize: 13, outline: 'none' }}
              />
              <button 
                onClick={handleSendComment} 
                disabled={!newComment.trim() || isSending} 
                style={{ 
                  height: 36, padding: '0 16px', backgroundColor: '#7c3aed', 
                  border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, 
                  fontSize: 13, cursor: newComment.trim() && !isSending ? 'pointer' : 'not-allowed', 
                  opacity: newComment.trim() && !isSending ? 1 : 0.5 
                }}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>

        <div style={{ width: 320, flexShrink: 0, backgroundColor: '#ffffff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: 'linear-gradient(180deg, rgba(124,58,237,0.10), rgba(124,58,237,0))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>Live Stream</div>
                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{isHost ? 'Bạn là chủ phòng' : 'Đang xem live'}</div>
              </div>
              <button onClick={() => setShowPanel(!showPanel)} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', fontSize: 12, cursor: 'pointer', borderRadius: 8, padding: '6px 12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {showPanel
                  ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2.5} strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Controls */}
          {isHost ? (
            <div style={{ padding: 12, borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button disabled={isEndingLive} onClick={toggleMicrophone} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: isMicOn ? '#7c3aed' : '#1e293b', color: '#fff', border: isMicOn ? 'none' : '1px solid #334155', cursor: isEndingLive ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.2s', boxShadow: isMicOn ? '0 0 14px rgba(124,58,237,0.4)' : 'none', opacity: isEndingLive ? 0.65 : 1 }}>
                  <LiveIcon name="mic" size={13} color="#ffffff" /> {isMicOn ? 'Tắt mic' : 'Bật mic'}
                </button>
                <button disabled={isEndingLive} onClick={toggleCamera} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: isCameraOn ? '#7c3aed' : '#1e293b', color: '#fff', border: isCameraOn ? 'none' : '1px solid #334155', cursor: isEndingLive ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.2s', boxShadow: isCameraOn ? '0 0 14px rgba(124,58,237,0.4)' : 'none', opacity: isEndingLive ? 0.65 : 1 }}>
                  <LiveIcon name="camera" size={13} color="#ffffff" /> {isCameraOn ? 'Tắt cam' : 'Bật cam'}
                </button>
                <button disabled={isEndingLive} onClick={async () => { if (!localParticipant) return; await localParticipant.setScreenShareEnabled(!isShareOn, { audio: true }); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: isShareOn ? '#9333ea' : '#1e293b', color: '#fff', border: isShareOn ? 'none' : '1px solid #334155', cursor: isEndingLive ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.2s', boxShadow: isShareOn ? '0 0 14px rgba(147,51,234,0.45)' : 'none', opacity: isEndingLive ? 0.65 : 1 }}>
                  <LiveIcon name="screen" size={13} color="#ffffff" /> {isShareOn ? 'Dừng' : 'Share'}
                </button>
                <button disabled={isEndingLive} onClick={handleEndLive} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: '#dc2626', color: '#fff', border: 'none', cursor: isEndingLive ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s', boxShadow: '0 0 14px rgba(220,38,38,0.35)', opacity: isEndingLive ? 0.7 : 1 }}>
                  {isEndingLive ? (
                    <>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px dashed #fff', borderTopColor: 'transparent', display: 'inline-block', animation: 'live-end-spin 0.9s linear infinite' }} />
                      Đang kết thúc...
                    </>
                  ) : (
                    <>
                      <LiveIcon name="end" size={13} color="#ffffff" /> Kết thúc
                    </>
                  )}
                </button>
                <button onClick={() => setDanmakuEnabled(!danmakuEnabled)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: danmakuEnabled ? '#10b981' : '#1e293b', color: '#fff', border: danmakuEnabled ? 'none' : '1px solid #334155', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.2s', boxShadow: danmakuEnabled ? '0 0 14px rgba(16,185,129,0.4)' : 'none' }}>
                  <LiveIcon name="clock" size={13} color="#ffffff" /> {danmakuEnabled ? 'Hiện chữ' : 'Ẩn chữ'}
                </button>
                <button onClick={() => setIsTtsEnabled(!isTtsEnabled)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: isTtsEnabled ? '#7c3aed' : '#1e293b', color: '#fff', border: isTtsEnabled ? 'none' : '1px solid #334155', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.2s', boxShadow: isTtsEnabled ? '0 0 14px rgba(124,58,237,0.4)' : 'none' }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  {isTtsEnabled ? 'Tắt loa' : 'Bật loa'}
                </button>
                <button onClick={() => setIsGiftEnabled(!isGiftEnabled)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: isGiftEnabled ? '#db2777' : '#1e293b', color: '#fff', border: isGiftEnabled ? 'none' : '1px solid #334155', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.2s', boxShadow: isGiftEnabled ? '0 0 14px rgba(219,39,119,0.4)' : 'none' }}>
                  <LiveIcon name="chat" size={13} color="#ffffff" /> {isGiftEnabled ? 'Ẩn chữ Donate' : 'Hiện chữ Donate'}
                </button>
                <button onClick={() => setShowTopDonors(!showTopDonors)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px', borderRadius: 12, backgroundColor: showTopDonors ? '#f59e0b' : '#1e293b', color: '#fff', border: showTopDonors ? 'none' : '1px solid #334155', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.2s', boxShadow: showTopDonors ? '0 0 14px rgba(245,158,11,0.4)' : 'none' }}>
                  <LiveIcon name="trophy" size={13} color="#ffffff" /> {showTopDonors ? 'Ẩn Top Donate' : 'Hiện Top Donate'}
                </button>
              </div>
              {deviceError && (
                <div style={{ marginTop: 8, padding: 10, backgroundColor: '#fef3c7', color: '#92400e', fontSize: 12, borderRadius: 8, border: '1px solid #fde68a' }}>
                  {deviceError}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <button onClick={() => sendReaction('heart')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 8px', borderRadius: 10, backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                  <LiveIcon name="heart" size={13} color="#e11d48" /> Thả tim
                </button>
                <button onClick={() => sendReaction('like')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 8px', borderRadius: 10, backgroundColor: '#f3e8ff', color: '#7c3aed', border: '1px solid #ddd6fe', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                  <LiveIcon name="like" size={13} color="#7c3aed" /> Like
                </button>
                <button onClick={() => setDanmakuEnabled(!danmakuEnabled)} style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, backgroundColor: danmakuEnabled ? '#10b981' : '#f3f4f6', color: danmakuEnabled ? '#fff' : '#374151', border: danmakuEnabled ? 'none' : '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                   <LiveIcon name="clock" size={14} color={danmakuEnabled ? '#fff' : '#374151'} /> {danmakuEnabled ? 'Đang bật chữ chạy' : 'Đang tắt chữ chạy'}
                </button>
              </div>
              <button onClick={() => { if(window.confirm('Bạn muốn rời khỏi phòng?')) onLeave(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, backgroundColor: '#ffffff', color: '#374151', border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                <LiveIcon name="leave" size={13} color="#374151" /> Rời phòng
              </button>
            </div>
          )}

          {/* Panel content */}
          {showPanel ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <MemberPanel roomCode={roomCode} displayName={displayName} isHost={isHost} identity={identity} />
            </div>
          ) : (
            <div style={{ flex: 1, padding: 16, color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
              {isHost ? 'Nhấn biểu tượng menu để quản lý thành viên và chia sẻ phòng.' : 'Đang xem live stream. Nhấn menu để xem chi tiết.'}
            </div>
          )}
        </div>
      </div>
      {isEndingLive && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(2px)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px dashed #7c3aed', borderTopColor: 'transparent', animation: 'live-end-spin 1s linear infinite' }} />
          <div style={{ fontSize: 14, color: '#4b5563', fontWeight: 700 }}>Đang kết thúc live...</div>
        </div>
      )}

      {/* TTS Debug Overlay */}
      {lastTtsMessage && (
        <div style={{ 
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.7)', color: '#10b981', padding: '6px 12px',
          borderRadius: 20, fontSize: 12, fontWeight: 600, zIndex: 1000,
          border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{ color: '#fff', opacity: 0.7 }}>Debug TTS:</span> {lastTtsMessage}
        </div>
      )}

      {/* Inline Deposit Modal */}
      {showDepositModal && (() => {
        const DEPOSIT_BANK = 'MB';
        const DEPOSIT_ACC = '0326829327';
        const DEPOSIT_NAME = 'TRAN CONG TINH';
        const DEPOSIT_RATE = 100;
        const DEPOSIT_PACKAGES = [
          { coin: 10, vnd: 1000 },
          { coin: 50, vnd: 5000 },
          { coin: 100, vnd: 10000 },
          { coin: 500, vnd: 50000 },
          { coin: 1000, vnd: 100000 },
        ];
        const coinVal = parseInt(depositAmount, 10) || 0;
        const vndVal = coinVal * DEPOSIT_RATE;
        const transferContent = `ZALAXU ${coinVal} ${identity}`;
        const qrUrl = `https://qr.sepay.vn/img?acc=${DEPOSIT_ACC}&bank=${DEPOSIT_BANK}&amount=${vndVal}&des=${encodeURIComponent(transferContent)}&template=compact`;

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={(e) => { if (e.target === e.currentTarget) setShowDepositModal(false); }}>
            <div style={{
              background: '#fff', borderRadius: 16, padding: 24,
              width: 380, maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: 8 }}><LiveIcon name="coin" size={16} color="#f59e0b" />Nạp Xu</span>
                <button onClick={() => setShowDepositModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
              </div>

              {coinVal < 10 ? (
                <>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="Nhập số xu muốn nạp..."
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 15, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {DEPOSIT_PACKAGES.map(p => (
                      <button key={p.coin} onClick={() => setDepositAmount(p.coin.toString())}
                        style={{ flex: '1 1 30%', padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#334155' }}>
                        {p.coin} xu<br/><span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{p.vnd.toLocaleString()}đ</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Chọn gói hoặc nhập số xu tối thiểu 10</div>
                </>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 14, padding: 12, background: '#f1f5f9', borderRadius: 12, border: '2px solid #4f46e5' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{coinVal} Xu</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#4f46e5' }}>{vndVal.toLocaleString()} VND</div>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}><LiveIcon name="search" size={12} color="#1e293b" />Quét mã QR để thanh toán</div>
                    <div style={{ display: 'inline-block', padding: 8, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <img src={qrUrl} alt="QR" style={{ width: 200, height: 200 }} />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: 12, fontSize: 12, marginBottom: 12, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: '#1e293b', display: 'inline-flex', alignItems: 'center', gap: 6 }}><LiveIcon name="shield" size={12} color="#1e293b" />Thông tin CK</div>
                    {[
                      ['Ngân hàng', DEPOSIT_BANK],
                      ['Số TK', DEPOSIT_ACC],
                      ['Chủ TK', DEPOSIT_NAME],
                      ['Số tiền', `${vndVal.toLocaleString()} VND`],
                      ['Nội dung CK', transferContent],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>{label}:</span>
                        <span style={{ fontWeight: 600, color: '#4f46e5' }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#fef3c7', borderRadius: 10, padding: 10, fontSize: 11, color: '#92400e', marginBottom: 12, border: '1px solid #fcd34d' }}>
                    ⚠️ Nhập <b>chính xác</b> nội dung CK. Xu sẽ được cộng <b>ngay lập tức</b> sau khi hệ thống xác nhận.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, background: '#f5f3ff', borderRadius: 10, border: '1px solid #ddd6fe' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #7c3aed', borderTopColor: 'transparent', animation: 'live-end-spin 0.8s linear infinite' }} />
                    <span style={{ color: '#7c3aed', fontSize: 13, fontWeight: 600 }}>Đang chờ thanh toán...</span>
                  </div>

                  <button onClick={() => { setDepositAmount(''); }} style={{ marginTop: 10, width: '100%', background: 'none', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px', cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 600 }}>
                    ← Chọn gói khác
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ─── Pre-join screen ─────────────────────────────────────────────────────────
function PreJoinScreen({
  defaultName,
  onJoin,
  onCancel,
  allowPublish,
  isJoining,
  thumbnailUrl,
  onThumbnailChange,
}: {
  defaultName: string;
  onJoin: (name: string, camOn: boolean, micOn: boolean) => void;
  onCancel: () => void;
  allowPublish: boolean;
  isJoining: boolean;
  thumbnailUrl: string;
  onThumbnailChange: (url: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  useEffect(() => {
    if (defaultName && !defaultName.startsWith('Khách_')) {
      setName(defaultName);
    }
  }, [defaultName]);

  const handleJoin = () => {
    if (isJoining) return;
    if (allowPublish) {
      onJoin(name.trim() || defaultName, camOn, micOn);
    } else {
      onJoin(name.trim() || defaultName, false, false);
    }
  };

  const handleThumbnailUpload = async (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh.');
      return;
    }
    try {
      setUploadingThumb(true);
      const formData = new FormData();
      formData.append('thumbnail', file);
      const res = await fetch(`${BACKEND_URL}/api/live/thumbnail`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Upload thumbnail thất bại');
      }
      onThumbnailChange(data.url);
    } catch (error: any) {
      alert(error?.message || 'Không thể upload thumbnail');
    } finally {
      setUploadingThumb(false);
      if (event?.target) event.target.value = '';
    }
  };

  return (
    <ScrollView style={styles.preJoinOverlay} contentContainerStyle={styles.preJoinOverlayContent} showsVerticalScrollIndicator={true}>
      <View style={styles.preJoinCard}>
        <Text style={styles.preJoinTitle}>Chuẩn bị tham gia</Text>

        {allowPublish ? (
          <View style={styles.preJoinMainGrid}>
            <View style={styles.preJoinMediaCol}>
              {/* Camera preview placeholder - LiveKit will request permission inside room */}
              <View style={styles.previewBox}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 40, color: '#7c3aed', fontWeight: '700' }}>{camOn ? 'CAM' : 'USER'}</Text>
                  <Text style={{ color: '#6b7280', marginTop: 8, fontSize: 13, textAlign: 'center' }}>
                    {camOn ? 'Camera sẽ bật khi vào phòng' : 'Camera đang tắt'}
                  </Text>
                  {micOn && <Text style={{ color: '#7c3aed', fontSize: 12 }}>Mic sẽ bật khi vào phòng</Text>}
                </View>
              </View>

              {/* Cam / Mic toggles */}
              <View style={styles.preJoinControls}>
                <TouchableOpacity style={[styles.toggleBtn, camOn && styles.toggleBtnActive]} onPress={() => setCamOn(!camOn)}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={camOn ? '#fff' : '#7c3aed'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  <Text style={[styles.toggleBtnText, camOn && { color: '#fff' }]}>{camOn ? 'Tắt cam' : 'Bật cam'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.toggleBtn, micOn && styles.toggleBtnActive]} onPress={() => setMicOn(!micOn)}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={micOn ? '#fff' : '#7c3aed'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/></svg>
                  <Text style={[styles.toggleBtnText, micOn && { color: '#fff' }]}>{micOn ? 'Tắt mic' : 'Bật mic'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.preJoinFormCol}>
              <Text style={styles.preJoinLabel}>Tên hiển thị</Text>
              <TextInput
                style={styles.preJoinInput}
                value={name}
                onChangeText={setName}
                placeholder="Nhập tên của bạn..."
                placeholderTextColor="#9ca3af"
              />

              {!camOn && (
                <View style={styles.thumbnailSection}>
                  <Text style={styles.preJoinLabel}>Thumbnail khi tắt cam</Text>
                  {thumbnailUrl ? (
                    <View style={styles.thumbnailPreviewWrap}>
                      <Image source={{ uri: thumbnailUrl }} style={styles.thumbnailPreview} resizeMode="cover" />
                    </View>
                  ) : (
                    <Text style={styles.thumbnailHint}>Chưa có thumbnail. Tải ảnh lên để hiển thị ở danh sách phòng live.</Text>
                  )}
                  <View style={styles.thumbnailActionRow}>
                    <label style={styles.thumbnailUploadBtn as any}>
                      <input type="file" accept="image/*" onChange={handleThumbnailUpload} style={{ display: 'none' }} disabled={uploadingThumb || isJoining} />
                      {uploadingThumb ? 'Đang tải ảnh...' : (thumbnailUrl ? 'Đổi thumbnail' : 'Tải thumbnail')}
                    </label>
                    {!!thumbnailUrl && (
                      <TouchableOpacity onPress={() => onThumbnailChange('')} disabled={uploadingThumb || isJoining} style={[styles.thumbnailClearBtn, (uploadingThumb || isJoining) && { opacity: 0.6 }]}>
                        <Text style={styles.thumbnailClearText}>Xóa ảnh</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={{ padding: 14, backgroundColor: '#f3f4f6', borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <Text style={{ color: '#111827', fontWeight: '700', marginBottom: 6 }}>Bạn đang vào xem live</Text>
            <Text style={{ color: '#6b7280', lineHeight: 20 }}>Nếu đây không phải chủ phòng thì bạn chỉ xem và bình luận, không bật camera/micro.</Text>
          </View>
        )}

        {!allowPublish && (
          <>
            {/* Display name */}
            <Text style={styles.preJoinLabel}>Tên hiển thị</Text>
            <TextInput
              style={styles.preJoinInput}
              value={name}
              onChangeText={setName}
              placeholder="Nhập tên của bạn..."
              placeholderTextColor="#9ca3af"
            />
          </>
        )}

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <TouchableOpacity style={[styles.cancelBtn, isJoining && { opacity: 0.6 }]} onPress={onCancel} disabled={isJoining}>
            <Text style={styles.cancelBtnText}>Huỷ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { flex: 1, opacity: isJoining ? 0.85 : 1 }]} onPress={handleJoin} disabled={isJoining}>
            {isJoining ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px dashed #ffffff', borderTopColor: 'transparent', animation: 'live-end-spin 0.9s linear infinite' }} />
                <Text style={styles.buttonText}>{allowPublish ? 'Đang tạo phòng...' : 'Đang vào phòng...'}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Vào phòng</Text>
            )}
          </TouchableOpacity>
        </View>

        {isJoining && (
          <View style={styles.preJoinLoadingOverlay}>
            <View style={styles.preJoinLoadingCard}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', border: '3px dashed #7c3aed', borderTopColor: 'transparent', animation: 'live-end-spin 0.75s linear infinite' }} />
              <Text style={styles.preJoinLoadingText}>{allowPublish ? 'Đang tạo phòng live...' : 'Đang kết nối phòng live...'}</Text>
              <Text style={styles.preJoinLoadingSubText}>Vui lòng chờ trong giây lát</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Main lobby ──────────────────────────────────────────────────────────────
export default function LiveScreenWeb() {
  const [joined, setJoined] = useState(false);
  const [roomStarting, setRoomStarting] = useState(false);
  const [roomReconnecting, setRoomReconnecting] = useState(false);
  const [roomReady, setRoomReady] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [initialMicOn, setInitialMicOn] = useState(false);
  const [initialCamOn, setInitialCamOn] = useState(false);
  const [roomEndedMessage, setRoomEndedMessage] = useState('Phiên live đã kết thúc.');
  const [rooms, setRooms] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [currentRoomCode, setCurrentRoomCode] = useState('');
  const [currentDisplayName, setCurrentDisplayName] = useState('');
  const [preJoinCode, setPreJoinCode] = useState<string | null>(null);
  const [preJoinIsCreate, setPreJoinIsCreate] = useState(false);
  const [preJoinDisplayName, setPreJoinDisplayName] = useState('');
  const [preJoinThumbnailUrl, setPreJoinThumbnailUrl] = useState('');

  // VIP States
  const [vipTier, setVipTier] = useState<string>('VIP0');
  const [vipExpiry, setVipExpiry] = useState<string | null>(null);
  const [maxLiveMinutes, setMaxLiveMinutes] = useState<number>(5);
  // liveElapsed đã được chuyển vào InnerRoomUI dùng sessionStorage
  const [showRegulations, setShowRegulations] = useState(false);
  const [showVipPurchase, setShowVipPurchase] = useState(false);

  const { user } = useUser();
  const { activeRoom, token, setActiveRoom, setToken, setCanSubscribe: setGlobalCanSubscribe, canSubscribe: globalCanSubscribe, disconnect } = useLiveRoom();
  const [isHost, setIsHost] = useState(false);
  const [canSubscribe, setCanSubscribe] = useState(true);
  const isRestoringRoomRef = useRef(false);
  const [tempId] = useState('uid_' + Math.floor(Math.random() * 9999));
  const [tempName] = useState('Khách_' + Math.floor(Math.random() * 999));
  const currentIdentity = user?.id || user?.accountId || tempId;
  const currentName = user?.name || user?.displayName || user?.fullName || tempName;
  const approvalRefreshInFlightRef = useRef(false);
  const endingSessionRef = useRef(false);

  const fetchVipStatus = useCallback(async () => {
    if (!currentIdentity || currentIdentity.startsWith('uid_')) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/api/payment/vip-status`, { params: { accountId: currentIdentity } });
      if (res.data?.success) {
        setVipTier(res.data.vipTier || 'VIP0');
        setVipExpiry(res.data.vipExpiryDate || null);
        if (res.data.tierInfo) {
          setMaxLiveMinutes(res.data.tierInfo.maxLiveMinutes);
        }
      }
    } catch (err) { console.warn('Lỗi lấy VIP status:', err); }
  }, [currentIdentity]);

  useEffect(() => {
    fetchVipStatus();
  }, [currentIdentity, fetchVipStatus]);

  useEffect(() => {
    const socket = SocketService.getInstance();
    const handleVipUpgraded = (data: { vipTier: string; vipExpiryDate: string }) => {
      setVipTier(data.vipTier);
      setVipExpiry(data.vipExpiryDate);
      setShowVipPurchase(false);
      alert(`Tài khoản của bạn đã được kích hoạt ${data.vipTier} thành công!`);
    };
    socket.onVipUpgraded(handleVipUpgraded);
    return () => socket.removeVipUpgradedListener(handleVipUpgraded);
  }, []);

  const defaultRoomName = () => {
    return `Phòng live của ${currentName}`;
  };

  const fetchRooms = () => {
    setLoadingRooms(true);
    fetch(`${BACKEND_URL}/api/live/rooms`)
      .then(r => r.json())
      .then(data => { setRooms(data.rooms || []); setLoadingRooms(false); })
      .catch(() => setLoadingRooms(false));
  };

  useEffect(() => {
    fetchRooms();
    if (typeof window !== 'undefined') {
      const code = new URLSearchParams(window.location.search).get('room');
      if (code) openPreJoin(code, false);
    }
  }, []);

  const genCode = () => {
    const c = 'abcdefghijklmnopqrstuvwxyz';
    const s = (n: number) => Array.from({ length: n }).map(() => c[Math.floor(Math.random() * c.length)]).join('');
    return `${s(3)}-${s(4)}-${s(3)}`;
  };

  const openPreJoin = (code: string, isCreate: boolean, displayName = '') => {
    setPreJoinCode(code);
    setPreJoinIsCreate(isCreate);
    setPreJoinDisplayName(displayName);
    if (!isCreate) setPreJoinThumbnailUrl('');
  };

  const enterRoom = (participantDisplayName: string, camOn: boolean, micOn: boolean, isReconnect = false) => {
    if (!preJoinCode) return;
    const code = preJoinCode;
    const isCreate = preJoinIsCreate;
    const roomDisplayName = preJoinDisplayName || defaultRoomName();

    let url = `${BACKEND_URL}/api/live/token?roomName=${encodeURIComponent(code)}&participantName=${encodeURIComponent(participantDisplayName)}&participantId=${encodeURIComponent(currentIdentity)}`;
    if (isCreate) {
      url += `&requiresApproval=${requiresApproval}&displayName=${encodeURIComponent(roomDisplayName)}`;
      if (preJoinThumbnailUrl) {
        url += `&thumbnailUrl=${encodeURIComponent(preJoinThumbnailUrl)}`;
      }
    }

    setIsJoiningRoom(true);
    setInitialMicOn(micOn);
    setInitialCamOn(camOn);
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setToken(data.token);
        setIsHost(data.isHost);
        setCanSubscribe(data.canSubscribe ?? true);
        setCurrentRoomCode(code);
        setCurrentDisplayName(roomDisplayName);
        setPreJoinCode(null);
        // liveStartTime đã được set ở Lobby button
        endingSessionRef.current = false; // Reset guard cho phiên mới
        setJoined(true);
        setRoomStarting(true);
        setRoomReady(false);
        setRoomEnded(false);
        setRoomEndedMessage('Phiên live đã kết thúc.');
        setGlobalCanSubscribe(data.canSubscribe ?? true);
        setActiveRoom({
          roomCode: code,
          isHost: data.isHost,
          displayName: roomDisplayName,
          hostMediaState: data.isHost
            ? {
                cameraEnabled: camOn,
                microphoneEnabled: micOn,
                screenShareEnabled: false,
              }
            : undefined,
        });
      })
      .catch(() => {
        alert('Không thể vào phòng live. Vui lòng thử lại.');
      })
      .finally(() => {
        setIsJoiningRoom(false);
      });
  };

  const deleteRoom = (roomCode: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phòng này không?')) return;
    fetch(`${BACKEND_URL}/api/live/room?roomName=${encodeURIComponent(roomCode)}&hostId=${encodeURIComponent(currentIdentity)}`, { method: 'DELETE' })
      .then(r => r.json())
      .then(data => {
        if (data.success) { alert('Đã xóa phòng'); setActiveRoom(null); fetchRooms(); }
        else alert(data.error);
      });
  };

  const handleLiveKitError = useCallback((error: Error | any) => {
    const message = error?.message || String(error || '');
    const ignoredPatterns = [
      /DataChannel/i,
      /RTCErrorEvent/i,
      /Unknown DataChannel/i,
      /UnexpectedConnectionState/i,
      /cannot publish track when not connected/i,
      /could not determine track dimensions/i,
    ];

    if (ignoredPatterns.some((pattern) => pattern.test(message))) {
      console.warn('[LiveKit] Ignored non-fatal error:', message, error);
      return;
    }

    console.error('[LiveKit] Room error:', error);
  }, []);

  useEffect(() => {
    if (activeRoom && token && !joined) {
      setIsHost(activeRoom.isHost);
      setCanSubscribe(globalCanSubscribe);
      setCurrentRoomCode(activeRoom.roomCode);
      setCurrentDisplayName(activeRoom.displayName);
      setJoined(true);
    }
  }, [activeRoom, token, joined, globalCanSubscribe]);

  // Khôi phục phiên live sau khi F5:
  // activeRoom đã có trong localStorage nhưng token nằm trong memory nên bị mất.
  // Effect này sẽ tự xin token mới và vào lại phòng.
  useEffect(() => {
    if (joined || token || !activeRoom) return;
    if (isRestoringRoomRef.current) return;

    isRestoringRoomRef.current = true;
    const roomCodeToRestore = activeRoom.roomCode;
    const displayNameToRestore = activeRoom.displayName || defaultRoomName();
    const restoreUrl = `${BACKEND_URL}/api/live/token?roomName=${encodeURIComponent(roomCodeToRestore)}&participantName=${encodeURIComponent(currentName)}&participantId=${encodeURIComponent(currentIdentity)}`;

    fetch(restoreUrl)
      .then((r) => r.json())
      .then((data) => {
        if (!data?.token) return;
        setToken(data.token);
        setIsHost(data.isHost ?? activeRoom.isHost);
        const nextCanSubscribe = data.canSubscribe ?? true;
        setCanSubscribe(nextCanSubscribe);
        setGlobalCanSubscribe(nextCanSubscribe);
        setCurrentRoomCode(roomCodeToRestore);
        setCurrentDisplayName(displayNameToRestore);
        setJoined(true);
        setRoomStarting(true);
        setRoomReady(false);
        setRoomEnded(false);
        setRoomEndedMessage('Phiên live đã kết thúc.');
      })
      .catch((err) => {
        console.warn('[Live] Không thể khôi phục phòng sau F5:', err);
      })
      .finally(() => {
        isRestoringRoomRef.current = false;
      });
  }, [joined, token, activeRoom, currentIdentity, currentName, setToken, setGlobalCanSubscribe]);

  // Viewer: khi reconnect/mở lại mini-player, refresh token để lấy quyền duyệt mới nhất.
  // Nếu đã được host duyệt trước đó, backend sẽ trả canSubscribe=true và không rơi lại màn "chờ duyệt".
  useEffect(() => {
    if (!joined || isHost || !currentRoomCode || !token) return;
    if (approvalRefreshInFlightRef.current) return;
    if (!roomReconnecting && canSubscribe) return;

    approvalRefreshInFlightRef.current = true;
    const refreshTokenForViewer = async () => {
      try {
        const url = `${BACKEND_URL}/api/live/token?roomName=${encodeURIComponent(currentRoomCode)}&participantName=${encodeURIComponent(currentName)}&participantId=${encodeURIComponent(currentIdentity)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data?.token) {
          setToken(data.token);
          const nextCanSubscribe = data.canSubscribe ?? false;
          setCanSubscribe(nextCanSubscribe);
          setGlobalCanSubscribe(nextCanSubscribe);
          if (nextCanSubscribe) {
            setRoomReconnecting(false);
          }
        }
      } catch (err) {
        console.warn('[Live] Không thể refresh token viewer:', err);
      } finally {
        approvalRefreshInFlightRef.current = false;
      }
    };

    refreshTokenForViewer();
  }, [
    joined,
    isHost,
    currentRoomCode,
    token,
    roomReconnecting,
    canSubscribe,
    currentIdentity,
    currentName,
    setToken,
    setGlobalCanSubscribe,
  ]);

  // ── Joined view ──

  const endLiveSession = useCallback((message: string, showVipModal = false) => {
    // Đánh dấu đã kết thúc để onDisconnected không ghi đè
    endingSessionRef.current = true;
    sessionStorage.removeItem('liveStartTime');
    disconnect();
    setJoined(false);
    setRoomStarting(false);
    setRoomReady(false);
    setRoomReconnecting(false);
    setRoomEndedMessage(message);
    setRoomEnded(true);
    // Delay fetchRooms để server kịp xóa phòng khỏi LiveKit
    setTimeout(() => fetchRooms(), 1500);
    setTimeout(() => fetchRooms(), 4000);
    if (showVipModal) {
      setShowVipPurchase(true);
    }
  }, [disconnect, fetchRooms]);

  const handleTimeExpired = useCallback(() => {
    endLiveSession(`Phiên Live kết thúc do hết thời gian của gói ${vipTier}.`, true);
  }, [vipTier, endLiveSession]);

  if (roomEnded) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
          <Text style={{ color: '#111827', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>Buổi live đã kết thúc</Text>
          <Text style={{ color: '#6b7280', fontSize: 16, textAlign: 'center', maxWidth: 520, marginBottom: 24 }}>{roomEndedMessage}</Text>
          <TouchableOpacity
            style={[styles.button, { width: 220, alignItems: 'center' }]}
            onPress={() => {
              setRoomEnded(false);
              setJoined(false);
              setToken(null);
              setRoomStarting(false);
              setRoomReady(false);
              setActiveRoom(null);
            }}
          >
            <Text style={styles.buttonText}>Quay về phòng Live</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (joined && token) {
    return (
      <View style={styles.container}>
        <LiveKitRoom
          token={token}
          serverUrl={LIVEKIT_URL}
          connect
          video={isHost}
          audio={isHost}
          options={{ adaptiveStream: true }}
          onConnected={() => {
            setRoomReady(true);
            setRoomStarting(false);
            setRoomReconnecting(false);
          }}
          onDisconnected={() => {
            setRoomReady(false);
            console.log('[LiveKit] Room disconnected, checking if room still exists...');
            // Nếu endLiveSession đã được gọi (host bấm kết thúc), không cần kiểm tra lại
            if (endingSessionRef.current) return;
            // Delay 1.5s rồi kiểm tra phòng còn tồn tại không
            setTimeout(async () => {
              if (endingSessionRef.current) return; // double check
              try {
                const res = await fetch(`${BACKEND_URL}/api/live/rooms`);
                const data = await res.json();
                const exists = (data.rooms || []).some((r: any) => r?.name === currentRoomCode);
                if (!exists) {
                  // Phòng đã bị xóa → host đã kết thúc live
                  endLiveSession('Buổi live đã kết thúc. Cảm ơn bạn đã tham gia.');
                } else {
                  // Phòng vẫn tồn tại → mất mạng, cho reconnect
                  setRoomReconnecting(true);
                }
              } catch {
                // Không thể kiểm tra → coi như phòng đã đóng
                endLiveSession('Kết nối phòng live đã đóng.');
              }
            }, 1500);
          }}
          onError={handleLiveKitError}
          style={{ width: '100%', height: '100%' }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' }}>
            <ViewerCount />
            <InnerRoomUI
              roomCode={currentRoomCode}
              displayName={currentDisplayName}
              isHost={isHost}
              canSubscribe={canSubscribe}
              identity={currentIdentity}
              initialMicOn={initialMicOn}
              initialCamOn={initialCamOn}
              onLeave={disconnect}
              vipTier={vipTier}
              maxLiveMinutesFromDb={maxLiveMinutes}
              onUpgradeVip={() => setShowVipPurchase(true)}
              onTimeExpired={handleTimeExpired}
              onRoomEnded={() => {
                endLiveSession('Buổi live đã kết thúc. Cảm ơn bạn đã tham gia.');
              }}
            />
            <RoomAudioRenderer />
          </div>
        </LiveKitRoom>
        {/* VipPurchaseModal c\u1ea7n render trong joined view \u0111\u1ec3 n\u00fat n\u00e2ng c\u1ea5p ho\u1ea1t \u0111\u1ed9ng khi \u0111ang live */}
        <VipPurchaseModal
          visible={showVipPurchase}
          onClose={() => { setShowVipPurchase(false); fetchVipStatus(); }}
          accountId={currentIdentity}
          currentTier={vipTier}
        />
      </View>
    );
  }

  // ── Pre-join overlay ──
  if (preJoinCode !== null) {
    return (
      <PreJoinScreen
        defaultName={currentName}
        onJoin={enterRoom}
        onCancel={() => setPreJoinCode(null)}
        allowPublish={preJoinIsCreate}
        isJoining={isJoiningRoom}
        thumbnailUrl={preJoinThumbnailUrl}
        onThumbnailChange={setPreJoinThumbnailUrl}
      />
    );
  }

  // ── Lobby ──
  return (
    <ScrollView style={styles.lobbyScroll} contentContainerStyle={styles.lobbyContainer} showsVerticalScrollIndicator={true}>
      {/* VIP Badge & Actions */}
      <View style={{ width: '100%', maxWidth: 860, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, backgroundColor: '#ffffff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: vipTier === 'VIP2' ? '#ef4444' : vipTier === 'VIP1' ? '#f59e0b' : '#6b7280' }}>
            <LiveIcon name={vipTier === 'VIP0' ? 'spark' : 'heart'} size={13} color="#ffffff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{vipTier}</Text>
          </View>
          {vipExpiry && (
            <Text style={{ color: '#6b7280', fontSize: 13, fontWeight: '600' }}>
              Hết hạn: {new Date(vipExpiry).toLocaleDateString('vi-VN')}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity style={{ backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }} onPress={() => setShowRegulations(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LiveIcon name="shield" size={14} color="#ffffff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Quy Định</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: '#7c3aed', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }} onPress={() => setShowVipPurchase(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LiveIcon name="spark" size={14} color="#ffffff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{vipTier !== 'VIP0' ? 'Gia Hạn' : 'Nâng Cấp'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ width: '100%', maxWidth: 860, borderRadius: 24, padding: 24, marginBottom: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', shadowColor: '#7c3aed', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
        <Text style={styles.title}>Zala Live</Text>
        <Text style={{ color: '#6b7280', fontSize: 14, marginTop: -10 }}>
          Phát trực tiếp và kết nối cộng đồng theo thời gian thực.
        </Text>
      </View>

      <View style={styles.cardsRow}>
        {/* Card 1: Join by code */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tham gia phòng</Text>
          <Text style={styles.cardSub}>Nhập mã phòng để vào ngay</Text>
          <TextInput
            style={styles.input}
            placeholder="abc-defg-hij"
            placeholderTextColor="#9ca3af"
            value={joinCode}
            onChangeText={setJoinCode}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={() => { if (joinCode.trim()) openPreJoin(joinCode.trim(), false); }}
          >
            <Text style={styles.buttonText}>Tham gia</Text>
          </TouchableOpacity>
        </View>

        {/* Card 2: Create room */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tạo phòng mới</Text>
          <Text style={styles.cardSub}>Mã phòng được sinh tự động</Text>
          <TextInput
            style={styles.input}
            placeholder="Tên phòng (tuỳ chọn)..."
            placeholderTextColor="#9ca3af"
            value={newRoomName}
            onChangeText={setNewRoomName}
          />
          <TouchableOpacity style={styles.toggleRow} onPress={() => setRequiresApproval(!requiresApproval)}>
            <View style={[styles.checkbox, requiresApproval && styles.checkboxActive]}>
              {requiresApproval && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.toggleText}>Duyệt người vào</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.createBtn]}
            onPress={() => { const code = genCode(); sessionStorage.setItem('liveStartTime', String(Date.now())); openPreJoin(code, true, newRoomName.trim()); }}
          >
            <Text style={styles.buttonText}>Tạo phòng</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Room list */}
      <View style={styles.roomListSection}>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Các phòng đang Live:</Text>
          <TouchableOpacity onPress={fetchRooms} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>Làm mới</Text>
          </TouchableOpacity>
        </View>

        {loadingRooms ? (
          <ActivityIndicator size="large" color="#6d28d9" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.roomList}>
            {rooms.filter((r: any) => r.numParticipants > 0).length === 0 ? (
              <Text style={styles.emptyText}>Hiện chưa có ai đang live.</Text>
            ) : (
              rooms.filter((r: any) => r.numParticipants > 0).map((room: any) => {
                const meta = room.metadata ? JSON.parse(room.metadata) : {};
                const isRoomHost = meta.hostId === currentIdentity || meta.hostName === currentName;
                const displayN = meta.displayName || room.name;
                const code = meta.roomCode || room.name;
                const thumbnailUrl = meta.thumbnailUrl || '';
                return (
                  <View key={room.name} style={styles.roomItem}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 14 }}>
                      {thumbnailUrl ? (
                        <Image source={{ uri: thumbnailUrl }} style={styles.roomThumbnail} resizeMode="cover" />
                      ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' }}>
                          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#ffffff', opacity: 0.95 }} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.roomName}>{displayN}</Text>
                          {isRoomHost && (
                            <View style={{ backgroundColor: '#7c3aed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>HOST</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', opacity: 0.9 }} />
                          <Text style={styles.roomInfo}>LIVE · {Math.max(0, (room.numParticipants || 0) - 1)} người xem</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.roomActions}>
                      {isRoomHost && (
                        <TouchableOpacity
                          style={[styles.joinBadge, { backgroundColor: '#dc2626', marginRight: 8 }]}
                          onPress={() => deleteRoom(code)}
                        >
                          <Text style={styles.joinText}>Xóa</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={styles.joinBadge} onPress={() => openPreJoin(code, false)}>
                        <Text style={styles.joinText}>Tham gia</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>

      {/* Modals */}
      <LiveRegulationsModal visible={showRegulations} onClose={() => setShowRegulations(false)} />
      <VipPurchaseModal
        visible={showVipPurchase}
        onClose={() => { setShowVipPurchase(false); fetchVipStatus(); }}
        accountId={currentIdentity}
        currentTier={vipTier}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  lobbyScroll: { flex: 1, backgroundColor: '#ffffff' },
  lobbyContainer: {
    backgroundColor: '#ffffff',
    padding: 28,
    alignItems: 'center',
    paddingBottom: 36,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 8, marginTop: 0, letterSpacing: -0.4 },

  cardsRow: { flexDirection: 'row', width: '100%', maxWidth: 800, gap: 20, marginBottom: 32 },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6b7280', marginTop: -4 },
  createBtn: { marginTop: 4 },

  input: { height: 48, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: '#d1d5db', color: '#111827' },
  button: { backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 12, height: 48, shadowColor: '#7c3aed', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  roomListSection: { width: '100%', maxWidth: 800 },
  headerRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  subtitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  refreshBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  refreshText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  roomList: { width: '100%' },
  roomItem: { backgroundColor: '#ffffff', padding: 18, borderRadius: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  roomThumbnail: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f3f4f6' },
  roomName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  roomInfo: { fontSize: 13, color: '#6b7280' },
  joinBadge: { backgroundColor: '#7c3aed', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  joinText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  roomActions: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#6b7280', fontSize: 15, marginTop: 48 },

  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  checkboxActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  toggleText: { fontSize: 14, color: '#374151' },

  // In-room overlays
  floatingHeader: { position: 'absolute', top: 20, right: 20, zIndex: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', maxWidth: 'calc(100% - 40px)' },
  actionBtn: { backgroundColor: 'rgba(109, 40, 217, 0.9)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, margin: 4 },
  actionBtnText: { color: '#fff', fontWeight: 'bold' },
  approvalList: { position: 'absolute', bottom: 80, left: 20, backgroundColor: 'rgba(0,0,0,0.85)', padding: 15, borderRadius: 12, width: 300, zIndex: 10 },
  approvalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  waitingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  waitingName: { color: '#e5e7eb', flex: 1, fontSize: 14 },
  approveBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  approveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Pre-join screen
  preJoinOverlay: { flex: 1, backgroundColor: '#f3f4f6' },
  preJoinOverlayContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  preJoinCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 980,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  preJoinLoadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  preJoinLoadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minWidth: 250,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  preJoinLoadingText: {
    color: '#6d28d9',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  preJoinLoadingSubText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  preJoinTitle: { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center', letterSpacing: -0.3 },
  preJoinMainGrid: { width: '100%', flexDirection: 'row', gap: 16, alignItems: 'stretch' },
  preJoinMediaCol: { flex: 1.05, gap: 12 },
  preJoinFormCol: { flex: 1, gap: 10 },
  previewBox: { height: 240, backgroundColor: '#f8fafc', borderRadius: 12, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  preJoinControls: { flexDirection: 'row', gap: 12 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 999, borderWidth: 1.5, borderColor: '#d1d5db', backgroundColor: '#ffffff' },
  toggleBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed', shadowColor: '#7c3aed', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  toggleBtnIcon: { fontSize: 16 },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  preJoinLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: -2 },
  preJoinInput: { height: 48, backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: '#d1d5db', color: '#111827' },
  thumbnailSection: { gap: 10, marginTop: 4, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ede9fe', backgroundColor: '#faf5ff' },
  thumbnailPreviewWrap: { width: '100%', height: 165, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#ddd6fe', backgroundColor: '#f8fafc' },
  thumbnailPreview: { width: '100%', height: '100%' },
  thumbnailHint: { fontSize: 12, color: '#6b7280', lineHeight: 18 },
  thumbnailActionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-start' },
  thumbnailUploadBtn: { height: 38, minWidth: 132, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#7c3aed', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 10px rgba(124,58,237,0.25)' },
  thumbnailClearBtn: { height: 38, minWidth: 92, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  thumbnailClearText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  cancelBtn: { paddingHorizontal: 20, borderRadius: 12, height: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1d5db' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  // Legacy compat
  inputWrapper: { flex: 1, gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
  createSection: { flexDirection: 'column', width: '100%', maxWidth: 800, marginBottom: 20 },
});
