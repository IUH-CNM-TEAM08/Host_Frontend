import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';

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
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0))[0];

  useImperativeHandle(ref, () => ({
    showGift: (gift: GiftData) => {
      setCurrentGift(gift);
      
      // Animation sequence
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 0.8, duration: 500, useNativeDriver: true }),
        ]).start(() => {
          setCurrentGift(null);
          fadeAnim.setValue(0);
          scaleAnim.setValue(0);
        });
      }, 3500);
    },
  }));

  if (!currentGift) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View 
        style={[
          styles.container, 
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Image 
          source={typeof currentGift.stickerUrl === 'string' ? { uri: currentGift.stickerUrl } : currentGift.stickerUrl as any} 
          style={styles.sticker} 
          resizeMode="contain" 
        />
        <View style={styles.textContainer}>
          <Text style={styles.senderName}>{currentGift.senderName}</Text>
          <Text style={styles.giftText}>
            đã tặng <Text style={styles.stickerName}>{currentGift.stickerName}</Text>
          </Text>
          {currentGift.message && (
            <View style={styles.messageBox}>
              <Text style={styles.messageText}>"{currentGift.message}"</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 25,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#7c3aed',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  sticker: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  textContainer: {
    alignItems: 'center',
  },
  senderName: {
    color: '#7c3aed',
    fontSize: 18,
    fontWeight: '800',
  },
  giftText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '600',
  },
  stickerName: {
    color: '#db2777',
  },
  messageBox: {
    marginTop: 10,
    backgroundColor: '#fdf2f8',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f9a8d4',
    maxWidth: 180,
  },
  messageText: {
    color: '#be185d',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default GiftOverlay;
