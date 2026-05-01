import React from 'react';
import { useParticipants } from '@livekit/components-react';

export const ViewerCount = () => {
  const participants = useParticipants(); // includes local + remote participants
  const count = participants.length;

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '5px 12px',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ef4444',
          animation: 'pulse-live 1.5s infinite',
        }}
      />
      {count} người xem
      <style>{`@keyframes pulse-live { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
};
