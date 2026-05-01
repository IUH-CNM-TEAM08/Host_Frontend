import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  Dimensions, FlatList, Platform, StatusBar, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';

const { width: SW, height: SH } = Dimensions.get('window');

interface MediaItem {
  url: string;
  type?: string; // 'image' | 'video'
}

interface MediaViewerProps {
  visible: boolean;
  media: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
}

export default function MediaViewer({ visible, media, initialIndex = 0, onClose }: MediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatRef = useRef<FlatList>(null);

  const isVideo = (item: MediaItem) =>
    item.type === 'video' || /\.(mp4|mov|avi|mkv|webm)/i.test(item.url ?? '');

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems?.[0]?.index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {media.length > 1 && (
            <Text style={styles.counter}>{currentIndex + 1} / {media.length}</Text>
          )}
        </View>

        {/* Media list */}
        <FlatList
          ref={flatRef}
          data={media}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => (
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={styles.slide}>
                {isVideo(item) ? (
                  <Video
                    source={{ uri: item.url }}
                    style={styles.video}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay={false}
                  />
                ) : (
                  <Image
                    source={{ uri: item.url }}
                    style={styles.image}
                    resizeMode="contain"
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          )}
        />

        {/* Prev / Next arrow buttons */}
        {media.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={styles.arrowLeft}
                onPress={() => {
                  const next = currentIndex - 1;
                  flatRef.current?.scrollToIndex({ index: next, animated: true });
                  setCurrentIndex(next);
                }}
              >
                <View style={styles.arrowBtn}>
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
            {currentIndex < media.length - 1 && (
              <TouchableOpacity
                style={styles.arrowRight}
                onPress={() => {
                  const next = currentIndex + 1;
                  flatRef.current?.scrollToIndex({ index: next, animated: true });
                  setCurrentIndex(next);
                }}
              >
                <View style={styles.arrowBtn}>
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Dot indicators */}
        {media.length > 1 && (
          <View style={styles.dotsRow}>
            {media.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 52),
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  counter: {
    color: '#fff', fontSize: 15, fontWeight: '600',
  },
  slide: {
    width: SW,
    height: SH - 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SW,
    height: SH - 160,
  },
  video: {
    width: SW,
    height: SH - 160,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 28,
    gap: 6,
  },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  arrowLeft: {
    position: 'absolute',
    left: 12,
    top: '50%',
    marginTop: -24,
    zIndex: 20,
  },
  arrowRight: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -24,
    zIndex: 20,
  },
  arrowBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
});
