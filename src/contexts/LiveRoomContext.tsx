import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';

export type LiveRoomState = {
  roomCode: string;
  isHost: boolean;
  displayName: string;
  hostMediaState?: {
    cameraEnabled: boolean;
    microphoneEnabled: boolean;
    screenShareEnabled: boolean;
  };
};

export type ChatMessage = {
  id: string;
  text?: string;
  message?: string;
  timestamp: number;
  from?: { identity: string; name: string };
  isSystem?: boolean;
  isGift?: boolean;
  stickerUrl?: string;
};

type LiveRoomContextType = {
  activeRoom: LiveRoomState | null;
  token: string | null;
  canSubscribe: boolean;
  chatHistory: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  clearChatHistory: () => void;
  setActiveRoom: (room: LiveRoomState | null) => void;
  setToken: (token: string | null) => void;
  setCanSubscribe: (can: boolean) => void;
  disconnect: () => void;
};

const LiveRoomContext = createContext<LiveRoomContextType>({
  activeRoom: null,
  token: null,
  canSubscribe: true,
  chatHistory: [],
  addChatMessage: () => {},
  clearChatHistory: () => {},
  setActiveRoom: () => {},
  setToken: () => {},
  setCanSubscribe: () => {},
  disconnect: () => {},
});

export function LiveRoomProvider({ children }: { children: ReactNode }) {
  const [activeRoom, setActiveRoomState] = useState<LiveRoomState | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem('liveRoomActiveRoom');
      return saved ? JSON.parse(saved) as LiveRoomState : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(null);
  const [canSubscribe, setCanSubscribe] = useState(true);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setChatHistory(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const clearChatHistory = useCallback(() => setChatHistory([]), []);

  const setActiveRoom = (room: LiveRoomState | null) => {
    setActiveRoomState(room);
    if (typeof window === 'undefined') return;
    try {
      if (room) {
        window.localStorage.setItem('liveRoomActiveRoom', JSON.stringify(room));
      } else {
        window.localStorage.removeItem('liveRoomActiveRoom');
      }
    } catch {
      // ignore storage failures
    }
  };

  const disconnect = () => {
    setToken(null);
    setActiveRoom(null);
    clearChatHistory();
  };

  const contextValue = React.useMemo(() => ({ 
    activeRoom, 
    token, 
    canSubscribe, 
    chatHistory,
    addChatMessage,
    clearChatHistory,
    setActiveRoom, 
    setToken, 
    setCanSubscribe,
    disconnect 
  }), [activeRoom, token, canSubscribe, chatHistory, addChatMessage, clearChatHistory]);

  return (
    <LiveRoomContext.Provider value={contextValue}>
      {children}
    </LiveRoomContext.Provider>
  );
}

export function useLiveRoom() {
  return useContext(LiveRoomContext);
}
