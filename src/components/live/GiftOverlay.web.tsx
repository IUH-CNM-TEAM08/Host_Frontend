import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Image } from 'react-native';

export interface GiftData {
  id: string;
  senderName: string;
  stickerUrl: string;
  stickerName: string;
  message?: string;
}

export interface GiftOverlayRef {
  showGift: (gift: GiftData) => void;
}

const GiftOverlay = forwardRef<GiftOverlayRef, {}>((props, ref) => {
  const [currentGift, setCurrentGift] = useState<GiftData | null>(null);

  useImperativeHandle(ref, () => ({
    showGift: (gift: GiftData) => {
      setCurrentGift(gift);
      // Auto hide after 4 seconds
      setTimeout(() => {
        setCurrentGift(prev => (prev?.id === gift.id ? null : prev));
      }, 4000);
    },
  }));

  if (!currentGift) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <style>{`
        @keyframes gift-pop {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          20% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          30% { transform: scale(1) rotate(0); }
          80% { transform: scale(1) translateY(0); opacity: 1; }
          100% { transform: scale(0.8) translateY(-100px); opacity: 0; }
        }
        .gift-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: gift-pop 4s ease-in-out forwards;
          background: rgba(255, 255, 255, 0.9);
          padding: 24px;
          border-radius: 24px;
          box-shadow: 0 12px 40px rgba(124, 58, 237, 0.4);
          border: 3px solid #7c3aed;
        }
      `}</style>
      <div className="gift-container">
        <Image
          source={currentGift.stickerUrl as any}
          style={{ width: 120, height: 120, marginBottom: 12 }}
          resizeMode="contain"
        />
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#7c3aed', fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
            {currentGift.senderName}
          </div>
          <div style={{ color: '#4b5563', fontSize: 14, fontWeight: 600 }}>
            đã tặng sticker <span style={{ color: '#db2777' }}>{currentGift.stickerName}</span>
          </div>
          {currentGift.message && (
            <div style={{ 
              marginTop: 12, padding: '8px 16px', backgroundColor: '#fdf2f8', 
              borderRadius: 12, color: '#be185d', fontSize: 14, fontStyle: 'italic',
              border: '1px dashed #f9a8d4', maxWidth: 200, wordWrap: 'break-word'
            }}>
              "{currentGift.message}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default GiftOverlay;
