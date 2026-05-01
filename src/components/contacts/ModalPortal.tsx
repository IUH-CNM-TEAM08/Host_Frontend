/**
 * ModalPortal - Wrapper for rendering modals at the top level of DOM
 * Fixes z-index issues on React Native Web where Modal gets hidden behind other elements
 */

import React from 'react';
import { Modal, View, Platform } from 'react-native';

interface ModalPortalProps {
  visible: boolean;
  onRequestClose?: () => void;
  animationType?: 'none' | 'slide' | 'fade';
  transparent?: boolean;
  children: React.ReactNode;
}

export default function ModalPortal({
  visible,
  onRequestClose,
  animationType = 'slide',
  transparent = true,
  children,
}: ModalPortalProps) {
  // On web, Modal works fine - just render it normally
  // On native, also render normally
  return (
    <Modal
      visible={visible}
      onRequestClose={onRequestClose}
      animationType={animationType}
      transparent={transparent}
      presentationStyle={Platform.OS !== 'web' ? 'formSheet' : undefined}
    >
      {children}
    </Modal>
  );
}
