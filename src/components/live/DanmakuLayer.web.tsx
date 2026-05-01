import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';

export interface DanmakuMessage {
  id: string;
  text: string;
  color?: string;
  isSelf?: boolean;
}

interface DanmakuItem extends DanmakuMessage {
  top: number;
  speed: number; // seconds
  startTime: number;
}

export interface DanmakuLayerRef {
  addMessage: (msg: DanmakuMessage) => void;
}

const DanmakuLayer = forwardRef<DanmakuLayerRef, { enabled: boolean }>(({ enabled }, ref) => {
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const nextTrackRef = useRef(0);
  const maxTracks = 6; // Number of horizontal rows
  const trackHeight = 32;

  useImperativeHandle(ref, () => ({
    addMessage: (msg: DanmakuMessage) => {
      if (!enabled) return;

      const track = nextTrackRef.current;
      nextTrackRef.current = (nextTrackRef.current + 1) % maxTracks;

      const newItem: DanmakuItem = {
        ...msg,
        top: 20 + track * trackHeight,
        speed: 8 + Math.random() * 4, // 8-12 seconds
        startTime: Date.now(),
      };

      setItems(prev => [...prev, newItem]);

      // Cleanup after animation ends
      setTimeout(() => {
        setItems(prev => prev.filter(item => item.id !== newItem.id));
      }, newItem.speed * 1000 + 500);
    },
  }));

  if (!enabled) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      <style>{`
        @keyframes danmaku-move {
          from { transform: translate3d(100vw, 0, 0); }
          to { transform: translate3d(-100%, 0, 0); }
        }
        .danmaku-item {
          position: absolute;
          white-space: nowrap;
          font-weight: 700;
          font-size: 16px;
          color: white;
          text-shadow: 
            -1px -1px 0 #000,  
             1px -1px 0 #000,
            -1px  1px 0 #000,
             1px  1px 0 #000,
             0px 2px 4px rgba(0,0,0,0.5);
          will-change: transform;
          animation-name: danmaku-move;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background-color: rgba(0,0,0,0.15);
          border-radius: 20px;
        }
      `}</style>
      {items.map(item => (
        <div
          key={item.id}
          className="danmaku-item"
          style={{
            top: item.top,
            animationDuration: `${item.speed}s`,
            color: item.isSelf ? '#facc15' : '#ffffff', // Yellow for self
            border: item.isSelf ? '1px solid rgba(250,204,21,0.5)' : 'none',
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
});

export default DanmakuLayer;
