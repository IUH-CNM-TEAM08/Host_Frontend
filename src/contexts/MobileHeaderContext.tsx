import React, { createContext, useContext, useState, useCallback } from 'react';

interface MobileHeaderContextValue {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showQRScanner: boolean;
  setShowQRScanner: (v: boolean) => void;
  // ── Header visibility (ẩn khi đang ở màn hình chat) ──
  isHeaderVisible: boolean;
  hideHeader: () => void;
  showHeader: () => void;
}

const MobileHeaderContext = createContext<MobileHeaderContextValue>({
  searchQuery: '',
  setSearchQuery: () => {},
  showQRScanner: false,
  setShowQRScanner: () => {},
  isHeaderVisible: true,
  hideHeader: () => {},
  showHeader: () => {},
});

export function MobileHeaderProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQueryRaw] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const setSearchQuery = useCallback((q: string) => setSearchQueryRaw(q), []);
  const hideHeader = useCallback(() => setIsHeaderVisible(false), []);
  const showHeader = useCallback(() => setIsHeaderVisible(true), []);

  return (
    <MobileHeaderContext.Provider value={{
      searchQuery, setSearchQuery,
      showQRScanner, setShowQRScanner,
      isHeaderVisible, hideHeader, showHeader,
    }}>
      {children}
    </MobileHeaderContext.Provider>
  );
}

export function useMobileHeader() {
  return useContext(MobileHeaderContext);
}
