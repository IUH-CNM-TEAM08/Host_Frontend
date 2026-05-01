import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// ─── NPC Character SVG ───────────────────────────────────────────────────────
function NpcSvg({ size = 56, mood = 'happy' }: { size?: number; mood?: 'happy' | 'excited' | 'cool' }) {
  if (Platform.OS !== 'web') return null;
  const mouth =
    mood === 'excited' ? 'M21,24 Q28,29 35,24' :
    mood === 'cool'    ? 'M22,25 Q28,22 34,25' :
                         'M22,24 Q28,27 34,24';
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      {/* Head */}
      <rect x="11" y="7" width="34" height="27" rx="13" fill="#e9d5ff" stroke="#a78bfa" strokeWidth="1.2"/>
      {/* Face highlight */}
      <rect x="18" y="13" width="20" height="14" rx="6" fill="#f3e8ff" stroke="#c4b5fd" strokeWidth="0.8"/>
      {/* Eyes */}
      {mood === 'cool'
        ? <><path d="M21,19 Q23,17 25,19" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/>
             <path d="M31,19 Q33,17 35,19" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round"/></>
        : <><rect x="21" y="18" width="4" height="2.5" rx="1.2" fill="#374151"/>
             <rect x="31" y="18" width="4" height="2.5" rx="1.2" fill="#374151"/></>
      }
      {/* Cheeks when excited */}
      {mood === 'excited' && <>
        <ellipse cx="19" cy="25" rx="3" ry="1.8" fill="#fca5a5" opacity="0.55"/>
        <ellipse cx="37" cy="25" rx="3" ry="1.8" fill="#fca5a5" opacity="0.55"/>
      </>}
      {/* Mouth */}
      <path d={mouth} stroke={mood === 'excited' ? '#7c3aed' : '#6b7280'} strokeWidth="1.6" strokeLinecap="round"/>
      {/* Body */}
      <rect x="15" y="34" width="26" height="16" rx="8" fill="#ddd6fe" stroke="#a78bfa" strokeWidth="1.1"/>
      {/* Arms */}
      <rect x="7"  y="35" width="8" height="9" rx="4" fill="#e9d5ff" stroke="#a78bfa" strokeWidth="1"/>
      <rect x="41" y="35" width="8" height="9" rx="4" fill="#e9d5ff" stroke="#a78bfa" strokeWidth="1"/>
      {/* Legs */}
      <rect x="18" y="46" width="8" height="9" rx="4" fill="#f5f3ff" stroke="#a78bfa" strokeWidth="1"/>
      <rect x="30" y="46" width="8" height="9" rx="4" fill="#f5f3ff" stroke="#a78bfa" strokeWidth="1"/>
      {/* Belly button */}
      <circle cx="28" cy="41" r="2" fill="#7c3aed"/>
    </svg>
  );
}

// ─── SVG Icons (no emoji) ────────────────────────────────────────────────────
const IcoVideo = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> : null;
const IcoGift = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="5"/><path d="M20 12v10H4V12"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg> : null;
const IcoChat = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> : null;
const IcoSpeaker = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> : null;
const IcoUsers = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> : null;
const IcoGamepad = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><rect x="2" y="6" width="20" height="12" rx="4"/></svg> : null;
const IcoStar = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> : null;
const IcoInfo = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> : null;
const IcoBot = () => Platform.OS === 'web' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V5"/><circle cx="12" cy="4" r="1"/><line x1="8" y1="15" x2="8" y2="15"/><line x1="16" y1="15" x2="16" y2="15"/></svg> : null;

// ─── Boom Online characters ───────────────────────────────────────────────────
const BOOM_CHARS = [
  { img: require('@/resources/assets/game/Boom-Mobile-NV-1.jpg'), name: 'Momo', desc: 'Cô gái lanh lợi, tốc độ cao' },
  { img: require('@/resources/assets/game/Boom-Mobile-NV-2.jpg'), name: 'Robo', desc: 'Robot chiến đấu, phòng thủ tốt' },
  { img: require('@/resources/assets/game/Boom-Mobile-NV-3.jpg'), name: 'Baby', desc: 'Dễ thương nhưng khó đoán' },
  { img: require('@/resources/assets/game/Boom-Mobile-NV-4.jpg'), name: 'Zing', desc: 'Năng lượng vô tận, sát thương cao' },
  { img: require('@/resources/assets/game/Boom-Mobile-NV-5.jpg'), name: 'Linda', desc: 'Chiến thuật gia, đặt bom chính xác' },
  { img: require('@/resources/assets/game/Boom-Mobile-NV-6.jpg'), name: 'Rex',  desc: 'Khủng long mạnh nhất bản đồ' },
];

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'game', label: 'Game Bom',    Icon: IcoGamepad },
  { id: 'npc',  label: 'Nhân vật',   Icon: IcoBot },
  { id: 'live', label: 'Live Stream', Icon: IcoVideo },
] as const;
type TabId = 'game' | 'npc' | 'live';

// ─── Tab content ─────────────────────────────────────────────────────────────
function FeatureRow({ Icon, title, desc }: { Icon: () => JSX.Element | null; title: string; desc: string }) {
  if (Platform.OS !== 'web') return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

function GameTab() {
  if (Platform.OS !== 'web') return null;
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: -0.3 }}>Game Bom Zala</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Mini-game đặt bom cổ điển từ Boom Online — chơi ngay trong ứng dụng, không cần cài thêm.
        </div>
      </div>

      {/* Characters grid */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
        6 Nhân vật chơi
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {BOOM_CHARS.map((c) => (
          <div key={c.name} style={{ borderRadius: 12, overflow: 'hidden', border: '1.5px solid #e5e7eb', background: '#fff', transition: 'box-shadow 0.15s, transform 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as any).style.boxShadow = '0 4px 16px rgba(124,58,237,0.15)'; (e.currentTarget as any).style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { (e.currentTarget as any).style.boxShadow = 'none'; (e.currentTarget as any).style.transform = 'scale(1)'; }}
          >
            <img src={c.img} alt={c.name} style={{ width: '100%', height: 88, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{c.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Tính năng</div>
      <FeatureRow Icon={IcoGamepad} title="3 cấp độ khó" desc="Dễ — Trung bình — Khó. Phù hợp mọi lứa tuổi." />
      <FeatureRow Icon={IcoStar}    title="Bảng xếp hạng" desc="Ghi lại điểm cao nhất, thách thức bạn bè." />
      <FeatureRow Icon={IcoUsers}   title="Chiến thuật đánh cờ" desc="Đánh dấu ô nghi ngờ để không lật nhầm mìn." />
    </div>
  );
}

function NpcTab() {
  if (Platform.OS !== 'web') return null;
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: -0.3 }}>Trợ lý Zala Bot</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Nhân vật hướng dẫn tương tác — luôn ở đây để giúp bạn khám phá Zala.
        </div>
      </div>

      {/* NPC showcase */}
      <div style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', borderRadius: 16, padding: 28, display: 'flex', gap: 24, alignItems: 'center', marginBottom: 20, border: '1px solid #ddd6fe' }}>
        <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <NpcSvg size={64} mood="happy" />
            <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, marginTop: 4 }}>Bình thường</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <NpcSvg size={64} mood="excited" />
            <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, marginTop: 4 }}>Hào hứng</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <NpcSvg size={64} mood="cool" />
            <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600, marginTop: 4 }}>Ngầu</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4c1d95', marginBottom: 6 }}>Xin chào, mình là Bot!</div>
          <div style={{ fontSize: 13, color: '#6d28d9', lineHeight: 1.6 }}>
            Mình sẽ hướng dẫn bạn từng bước sử dụng Zala. Nhấn vào mình để bắt đầu nhé!
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Khả năng</div>
      <FeatureRow Icon={IcoBot}     title="Hướng dẫn tương tác" desc="Bay tới từng mục, giải thích chi tiết theo bước." />
      <FeatureRow Icon={IcoChat}    title="Trả lời thắc mắc" desc="Chọn chủ đề cần tìm hiểu, Bot dẫn đến đúng chỗ." />
      <FeatureRow Icon={IcoInfo}    title="3 trạng thái biểu cảm" desc="Vui, hào hứng, ngầu — thay đổi theo ngữ cảnh." />
      <FeatureRow Icon={IcoStar}    title="Hoạt ảnh mượt" desc="Chạy, nhảy, đổ bộ từ trên xuống — vui như game." />
    </div>
  );
}

function LiveTab() {
  if (Platform.OS !== 'web') return null;
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: -0.3 }}>Zala Live Stream</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Phát trực tiếp tới cộng đồng — tương tác, nhận quà và kết nối theo thời gian thực.
        </div>
      </div>

      {/* Live badge */}
      <div style={{ background: '#7c3aed', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <NpcSvg size={52} mood="excited" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171' }} />
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 800 }}>LIVE</span>
          </div>
        </div>
        <div style={{ color: '#fff' }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Phát sóng ngay hôm nay</div>
          <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>Tạo phòng bằng mã ngẫu nhiên, chia sẻ link và bắt đầu phát trong vài giây.</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Tính năng nổi bật</div>
      <FeatureRow Icon={IcoGift}    title="Quà tặng & Sticker" desc="Người xem gửi quà realtime — VIP, Thú cưng, Giáng sinh." />
      <FeatureRow Icon={IcoChat}    title="Danmaku — Chữ chạy màn hình" desc="Bình luận bay ngang như YouTube Super Chat." />
      <FeatureRow Icon={IcoSpeaker} title="Giọng đọc TTS tự động" desc="Đọc tên người tặng quà. Host bật/tắt được độc lập." />
      <FeatureRow Icon={IcoVideo}   title="Camera + Chia sẻ màn hình" desc="Phát camera và screen share song song (PiP)." />
      <FeatureRow Icon={IcoUsers}   title="Quản lý khán giả" desc="Kick thành viên, duyệt người vào, chia sẻ mã phòng." />
    </div>
  );
}

// ─── Modal root ───────────────────────────────────────────────────────────────
export default function WhatsNewModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState<TabId>('game');

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    } else {
      setShow(false);
      const t = setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (Platform.OS !== 'web') return null;

  if (!mounted) return null;

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      backgroundColor: show ? 'rgba(0,0,0,0.45)' : 'transparent',
      backdropFilter: show ? 'blur(4px)' : 'none',
      transition: 'background-color 0.26s, backdrop-filter 0.26s',
    }}>
      <style>{`
        @keyframes wn-in { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:none} }
        .wn-scroll::-webkit-scrollbar{width:4px}
        .wn-scroll::-webkit-scrollbar-thumb{background:#ddd6fe;border-radius:9px}
        .wn-tab-btn:hover{background:rgba(124,58,237,0.06)!important}
      `}</style>

      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 720,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.16), 0 6px 20px rgba(124,58,237,0.1)',
        border: '1px solid rgba(124,58,237,0.12)',
        animation: show ? 'wn-in 0.26s cubic-bezier(0.34,1.4,0.64,1) forwards' : 'none',
      }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#6d28d9,#7c3aed)', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NpcSvg size={42} mood="excited" />
            <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>Có gì mới trong Zala 2.0</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Cập nhật 01 / 05 / 2026</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 9, width: 32, height: 32, cursor: 'pointer', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Left tabs */}
          <div style={{ width: 148, flexShrink: 0, borderRight: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', flexDirection: 'column', padding: '10px 8px', gap: 4 }}>
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button key={id} className="wn-tab-btn" onClick={() => setTab(id as TabId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 11px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', background: active ? '#f5f3ff' : 'transparent', borderLeft: active ? '3px solid #7c3aed' : '3px solid transparent' }}>
                  <Icon />
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#6d28d9' : '#6b7280' }}>{label}</span>
                </button>
              );
            })}
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
              <NpcSvg size={34} mood="happy" />
            </div>
          </div>

          {/* Right content */}
          <div className="wn-scroll" style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
            {tab === 'game' && <GameTab />}
            {tab === 'npc'  && <NpcTab />}
            {tab === 'live' && <LiveTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
